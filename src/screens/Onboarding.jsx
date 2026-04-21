import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import LogoutButton from '../components/LogoutButton'
import styles from './Onboarding.module.css'

// Onboarding is a single-screen state machine with four UI steps plus a done
// screen. We intentionally don't nest routes — the flow is strictly linear
// and internal state is simpler to reason about than URL-driven navigation.
//
// Resume is driven by beta.user_activity_summary.onboarding_step:
//   0 → not started     → step "household"
//   1 → household created → step "baby" (household pre-loaded)
//   2 → baby added      → step "sizemode" (household + baby pre-loaded)
//   3 → size mode set   → step "invite"   (household + baby pre-loaded)
//   4 → complete        → redirect to /home
//
// A row in user_activity_summary exists for every user (auto-created on signup
// via trigger, backfilled for existing users). We bump onboarding_step after
// each successful transition so resume is reliable across sessions/devices.
const STEPS = ['household', 'baby', 'sizemode', 'invite']
const STEP_TO_INDEX = Object.fromEntries(STEPS.map((s, i) => [s, i]))

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'done'
  const [step, setStep] = useState('household')
  const [household, setHousehold] = useState(null)
  const [baby, setBaby] = useState(null)

  // Step 1 — household
  const [householdName, setHouseholdName] = useState('')

  // Step 2 — baby
  const [babyName, setBabyName] = useState('')
  const [birthMode, setBirthMode] = useState('born') // 'born' | 'expecting'
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState(null) // 'girl' | 'boy' | 'neutral' | null

  // Step 3 — size mode
  const [sizeMode, setSizeMode] = useState('by_age')

  // Step 4 — invite
  const [inviteEmail, setInviteEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // ── Initial load: figure out where the user is in the flow ────────────
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function resume() {
      // Read onboarding progress from the canonical source.
      const { data: summary, error: summaryErr } = await supabase
        .schema(currentSchema)
        .from('user_activity_summary')
        .select('onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      if (summaryErr) {
        setError(summaryErr.message)
        setStatus('ready')
        return
      }

      // Fallback: if somehow the row is missing (trigger skipped, backfill
      // didn't cover this user), assume not started. We'll upsert when they
      // advance past step 0.
      const onboardingStep = summary?.onboarding_step ?? 0

      if (onboardingStep >= 4) {
        navigate('/home', { replace: true })
        return
      }

      // Hydrate household/baby for any step after the first.
      if (onboardingStep >= 1) {
        const { data: memberships, error: memErr } = await supabase
          .schema(currentSchema)
          .from('household_members')
          .select('household_id, households(id, name)')
          .eq('user_id', user.id)
          .order('joined_at', { ascending: false })
          .limit(1)

        if (cancelled) return
        if (memErr) {
          setError(memErr.message)
          setStatus('ready')
          return
        }

        const existing = memberships?.[0]?.households
        if (existing) {
          setHousehold(existing)
          setHouseholdName(existing.name ?? '')

          if (onboardingStep >= 2) {
            const { data: babies, error: babyErr } = await supabase
              .schema(currentSchema)
              .from('babies')
              .select('*')
              .eq('household_id', existing.id)
              .limit(1)

            if (cancelled) return
            if (babyErr) {
              setError(babyErr.message)
            } else if (babies && babies.length > 0) {
              setBaby(babies[0])
              setSizeMode(babies[0].size_mode ?? 'by_age')
            }
          }
        }
      }

      // Only fire onboardingStarted if this is genuinely a fresh start —
      // re-entry from step 1+ means it was fired in an earlier session.
      if (onboardingStep === 0) {
        track.onboardingStarted()
      }

      setStep(STEPS[onboardingStep])
      setStatus('ready')
    }

    resume()
    return () => { cancelled = true }
  }, [user, navigate])

  // Writes the user's highest-reached step. Best-effort — a failure here
  // shouldn't block the UX, it just means resume is less accurate next time.
  async function bumpOnboardingStep(newStep) {
    if (!user) return
    const { error: upsertErr } = await supabase
      .schema(currentSchema)
      .from('user_activity_summary')
      .upsert({ user_id: user.id, onboarding_step: newStep }, { onConflict: 'user_id' })
    if (upsertErr) {
      // Swallow — onboarding_step is recovery metadata, not a blocker.
      // If this becomes a source of bugs, surface it; for now log and move on.
      // eslint-disable-next-line no-console
      console.warn('Failed to bump onboarding_step:', upsertErr.message)
    }
  }

  // ── Step 1 — create household ─────────────────────────────────────────
  async function submitHousehold(e) {
    e.preventDefault()
    if (!householdName.trim()) return

    setLoading(true)
    setError(null)

    const { data, error: insertErr } = await supabase
      .schema(currentSchema)
      .from('households')
      .insert({ name: householdName.trim() })
      .select()
      .single()

    setLoading(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setHousehold(data)
    track.householdNamed()
    await bumpOnboardingStep(1)
    setStep('baby')
  }

  // ── Step 2 — create baby ──────────────────────────────────────────────
  async function submitBaby(e) {
    e.preventDefault()
    if (!babyName.trim() || !birthDate) return

    setLoading(true)
    setError(null)

    const row = {
      household_id: household.id,
      name: babyName.trim(),
      gender,
      // size_mode stays at its DB default for now; updated in step 3.
      ...(birthMode === 'born'
        ? { date_of_birth: birthDate }
        : { due_date: birthDate }),
    }

    const { data, error: insertErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .insert(row)
      .select()
      .single()

    setLoading(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setBaby(data)
    track.babyAdded({
      mode: birthMode, // 'born' | 'expecting'
      has_gender: !!gender,
    })
    await bumpOnboardingStep(2)
    setStep('sizemode')
  }

  // ── Step 3 — pick size mode ──────────────────────────────────────────
  async function selectSizeMode(mode) {
    setSizeMode(mode)
    setLoading(true)
    setError(null)

    const { error: updateErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .update({ size_mode: mode })
      .eq('id', baby.id)

    setLoading(false)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    track.sizeModeSelected(mode)
    await bumpOnboardingStep(3)
    setStep('invite')
  }

  // ── Step 4 — invite (UI only for now) ────────────────────────────────
  function sendInvite() {
    // Real invite plumbing (pending_invites table + email sending) is a
    // follow-up. For now, we just log the event so the funnel data is
    // honest about intent.
    track.inviteSent(false)
    finishOnboarding()
  }

  function skipInvite() {
    track.inviteSent(true)
    finishOnboarding()
  }

  function finishOnboarding() {
    track.onboardingCompleted()
    // Fire-and-forget — the 'done' screen doesn't need to wait on the bump.
    bumpOnboardingStep(4)
    setStatus('done')
  }

  // ── Render ───────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.logoutCorner}><LogoutButton /></div>
        <div className={styles.wrap}>
          <div className={styles.loadingState}>Setting things up…</div>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    const firstName = user?.user_metadata?.name?.split(' ')[0] ?? ''
    return (
      <div className={styles.page}>
        <div className={styles.logoutCorner}><LogoutButton /></div>
        <div className={styles.wrap}>
          <div className={styles.doneIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.doneTitle}>
            You're all set{firstName ? `, ${firstName}` : ''}!
          </div>
          <div className={styles.doneSub}>
            {baby?.name
              ? `${baby.name}'s wardrobe is ready. Start by adding what you have, or browse what you need.`
              : "Your wardrobe is ready. Start by adding what you have."}
          </div>
          <button
            className={`${styles.primaryBtn} ${styles.doneBtn}`}
            onClick={() => navigate('/home', { replace: true })}
          >
            Go to my inventory
          </button>
        </div>
      </div>
    )
  }

  const stepIndex = STEPS.indexOf(step)
  const pips = STEPS.map((_, i) => i <= stepIndex)

  return (
    <div className={styles.page}>
      <div className={styles.logoutCorner}><LogoutButton /></div>
      <div className={styles.wrap}>
        <div className={styles.progress}>
          {pips.map((done, i) => (
            <div
              key={i}
              className={`${styles.pip} ${done ? styles.pipDone : ''}`}
            />
          ))}
        </div>

        <div className={styles.stepLabel}>
          Step {stepIndex + 1} of {STEPS.length}
        </div>

        {step === 'household' && (
          <>
            <h1 className={styles.title}>Name your household</h1>
            <p className={styles.sub}>
              This is what your family's account will be called. You can invite others later.
            </p>
            <form onSubmit={submitHousehold}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Household name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="The Johnson Family"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={loading || !householdName.trim()}
              >
                {loading ? 'Saving…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'baby' && (
          <>
            <h1 className={styles.title}>Tell us about your baby</h1>
            <p className={styles.sub}>
              We'll use this to track sizes and plan ahead for you.
            </p>
            <form onSubmit={submitBaby}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Baby's name</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Lily"
                  value={babyName}
                  onChange={e => setBabyName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className={styles.segToggle}>
                <button
                  type="button"
                  className={`${styles.segBtn} ${birthMode === 'born' ? styles.segActive : ''}`}
                  onClick={() => setBirthMode('born')}
                >
                  Already born
                </button>
                <button
                  type="button"
                  className={`${styles.segBtn} ${birthMode === 'expecting' ? styles.segActive : ''}`}
                  onClick={() => setBirthMode('expecting')}
                >
                  Expecting
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>
                  {birthMode === 'born' ? 'Date of birth' : 'Due date'}
                </label>
                <input
                  className={styles.input}
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  required
                />
              </div>

              <div className={styles.sectionLabel}>
                Gender tag <span className={styles.sectionLabelNote}>(optional)</span>
              </div>
              <div className={styles.chipGrid}>
                {['girl', 'boy', 'neutral'].map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`${styles.chip} ${gender === g ? styles.chipSel : ''}`}
                    onClick={() => setGender(gender === g ? null : g)}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>

              {error && <div className={styles.error}>{error}</div>}
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={loading || !babyName.trim() || !birthDate}
              >
                {loading ? 'Saving…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {step === 'sizemode' && (
          <>
            <h1 className={styles.title}>How do you think about sizes?</h1>
            <p className={styles.sub}>
              Choose what feels most natural — you can always change this later.
            </p>
            <div className={styles.cardStack}>
              <button
                type="button"
                className={`${styles.card} ${sizeMode === 'by_age' ? styles.cardSel : ''}`}
                onClick={() => selectSizeMode('by_age')}
                disabled={loading}
              >
                <div className={styles.cardTitle}>By age</div>
                <div className={styles.cardSub}>0–3M, 3–6M, 6–9M… Most familiar for new parents.</div>
              </button>
              <button
                type="button"
                className={`${styles.card} ${sizeMode === 'by_weight' ? styles.cardSel : ''}`}
                onClick={() => selectSizeMode('by_weight')}
                disabled={loading}
              >
                <div className={styles.cardTitle}>By weight / height</div>
                <div className={styles.cardSub}>More precise — great if your baby is running big or small.</div>
              </button>
              <button
                type="button"
                className={`${styles.card} ${sizeMode === 'both' ? styles.cardSel : ''}`}
                onClick={() => selectSizeMode('both')}
                disabled={loading}
              >
                <div className={styles.cardTitle}>Both</div>
                <div className={styles.cardSub}>Show age labels and weight ranges together.</div>
              </button>
            </div>
            {error && <div className={styles.error}>{error}</div>}
          </>
        )}

        {step === 'invite' && (
          <>
            <h1 className={styles.title}>Invite a family member?</h1>
            <p className={styles.sub}>
              Co-parents, grandparents, anyone helping out — they'll get access to
              {baby?.name ? ` ${baby.name}'s` : ' the'} wardrobe.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email address</label>
              <input
                className={styles.input}
                type="email"
                placeholder="partner@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={sendInvite}
              disabled={!inviteEmail.trim()}
            >
              Send invite
            </button>
            <div className={styles.skipLink}>
              <button type="button" className={styles.skipBtn} onClick={skipInvite}>
                Skip for now
              </button>
            </div>
            <p className={styles.helperNote}>
              Invites are coming soon. For now, we'll note who you'd like to bring in
              and reach out when the feature launches.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
