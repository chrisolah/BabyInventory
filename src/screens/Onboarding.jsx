import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import LogoutButton from '../components/LogoutButton'
import styles from './Onboarding.module.css'

// Onboarding is a single-screen state machine with five UI steps plus a done
// screen. We intentionally don't nest routes — the flow is strictly linear
// and internal state is simpler to reason about than URL-driven navigation.
//
// Resume is driven by beta.user_activity_summary.onboarding_step (widened
// from 0..4 to 0..5 in migration 011):
//   0 → not started       → step "household"
//   1 → household created   → step "baby"      (household pre-loaded)
//   2 → baby added        → step "sizemode"  (household + babies pre-loaded)
//   3 → size mode set     → step "receiving" (receiving opt-in)
//   4 → receiving saved   → step "invite"
//   5 → complete          → redirect to /home
//
// The receiving step is opt-in: toggle defaults to off, skipping advances
// the flow with opted-in=false. We still bump onboarding_step when they
// advance so resume lands them on the next screen rather than making them
// revisit the toggle.
//
// A row in user_activity_summary exists for every user (auto-created on signup
// via trigger, backfilled for existing users). We bump onboarding_step after
// each successful transition so resume is reliable across sessions/devices.
const STEPS = ['household', 'baby', 'sizemode', 'receiving', 'invite']
const STEP_TO_INDEX = Object.fromEntries(STEPS.map((s, i) => [s, i]))
const ONBOARDING_COMPLETE = STEPS.length  // = 5

// Size + gender enums reused from Profile's ReceivingSection. Kept local so
// Onboarding can't drift if Profile ever adds a size (constraint in the DB
// is the source of truth; this is just the order we render chips in).
const RECEIVING_SIZES = ['0-3M','3-6M','6-9M','9-12M','12-18M','18-24M']
const RECEIVING_GENDERS = [
  { id: 'boy',     label: 'Boy'     },
  { id: 'girl',    label: 'Girl'    },
  { id: 'neutral', label: 'Neutral' },
]

// Step 2 lets the user add one or more babies before advancing — twins and
// triplets are common enough that forcing a second pass through onboarding
// would feel hostile. Each entry is an independent form in local state; all
// of them INSERT together when the user hits Continue.
function makeBabyForm(expanded = true) {
  return {
    name: '',
    birthMode: 'born',   // 'born' | 'expecting'
    birthDate: '',
    gender: null,        // 'girl' | 'boy' | 'neutral' | null
    expanded,
  }
}

// Copy helpers — keep multi-baby wording centralised so twins/triplets read
// naturally everywhere instead of each call site reimplementing the logic.
function joinNames(names) {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function doneSubCopy(babies) {
  const named = babies.map(b => b.name).filter(Boolean)
  if (named.length === babies.length && named.length > 0) {
    const noun = named.length === 1 ? 'wardrobe' : 'wardrobes'
    return `${joinNames(named)}'s ${noun} ${named.length === 1 ? 'is' : 'are'} ready. Start by adding what you have, or browse what you need.`
  }
  return babies.length > 1
    ? 'Your wardrobes are ready. Start by adding what you have.'
    : 'Your wardrobe is ready. Start by adding what you have.'
}

function inviteWardrobeCopy(babies) {
  const named = babies.map(b => b.name).filter(Boolean)
  if (named.length === babies.length && named.length > 0) {
    const noun = named.length === 1 ? 'wardrobe' : 'wardrobes'
    return `${joinNames(named)}'s ${noun}`
  }
  return babies.length > 1 ? 'the wardrobes' : 'the wardrobe'
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'done'
  const [step, setStep] = useState('household')
  const [household, setHousehold] = useState(null)
  // Post-insert rows from beta.babies. Driven by either the step 2 submit or
  // the resume path. Used by steps 3 + 4 and the done screen.
  const [babies, setBabies] = useState([])

  // Step 1 — household
  const [householdName, setHouseholdName] = useState('')

  // Step 2 — babies. One form entry per baby; array grows as the user taps
  // "+ Add another". First form is always expanded on entry.
  const [babyForms, setBabyForms] = useState([makeBabyForm(true)])

  // Step 3 — size mode
  const [sizeMode, setSizeMode] = useState('by_age')

  // Step 4 — receiving opt-in. Mirrors Profile.ReceivingSection's fields,
  // written to beta.households on submit. Defaults to off; sub-prefs
  // (sizes, genders, notes, paused-until) only appear when toggled on.
  // We don't expose "pause until" here — it's a maintenance affordance, not
  // an onboarding decision, and showing it before there's any baseline
  // opt-in pattern would be confusing.
  const [acceptHandMeDowns, setAcceptHandMeDowns] = useState(false)
  const [receivingSizes,    setReceivingSizes]    = useState([])
  const [receivingGenders,  setReceivingGenders]  = useState([])
  const [receivingNotes,    setReceivingNotes]    = useState('')

  // Step 5 — invite
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

      if (onboardingStep >= ONBOARDING_COMPLETE) {
        navigate('/home', { replace: true })
        return
      }

      // Hydrate household/baby for any step after the first. Pull the
      // receiving-opt-in columns too so step 4 can resume with whatever
      // the user already saved (either mid-onboarding or later via Profile
      // and then re-entering the flow on a new device).
      if (onboardingStep >= 1) {
        const { data: memberships, error: memErr } = await supabase
          .schema(currentSchema)
          .from('household_members')
          .select(
            'household_id, households(' +
              'id, name, accepts_hand_me_downs, accepts_sizes, ' +
              'accepts_genders, receiving_notes' +
            ')',
          )
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
          // Seed the receiving step from whatever's already on the row.
          // For a fresh signup these are all falsy/empty; for a resume
          // after the Profile screen edits they reflect current state.
          setAcceptHandMeDowns(!!existing.accepts_hand_me_downs)
          setReceivingSizes(existing.accepts_sizes || [])
          setReceivingGenders(existing.accepts_genders || [])
          setReceivingNotes(existing.receiving_notes || '')

          if (onboardingStep >= 2) {
            // Fetch ALL babies, not just one — step 3 applies size_mode to
            // every baby in the household, and the done screen wants their
            // names. Ordered so twins resume in a stable order.
            const { data: rows, error: babyErr } = await supabase
              .schema(currentSchema)
              .from('babies')
              .select('*')
              .eq('household_id', existing.id)
              .order('created_at', { ascending: true })

            if (cancelled) return
            if (babyErr) {
              setError(babyErr.message)
            } else if (rows && rows.length > 0) {
              setBabies(rows)
              setSizeMode(rows[0].size_mode ?? 'by_age')
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

  // ── Step 2 — create babies ────────────────────────────────────────────
  // Every form must have a name + date before we'll submit. We INSERT them
  // all in a single batch so either every baby lands or none do — a partial
  // write here would leave the household in a weird state for resume.
  async function submitBabies(e) {
    e.preventDefault()

    const trimmed = babyForms.map(f => ({ ...f, name: f.name.trim() }))
    const invalid = trimmed.some(f => !f.name || !f.birthDate)
    if (invalid) {
      // Expand any form that's missing data so the user can see where the
      // gap is, rather than silently re-enabling a disabled button.
      setBabyForms(trimmed.map(f => ({
        ...f,
        expanded: f.expanded || !f.name || !f.birthDate,
      })))
      return
    }

    setLoading(true)
    setError(null)

    const rows = trimmed.map(f => ({
      household_id: household.id,
      name: f.name,
      gender: f.gender,
      // size_mode stays at its DB default here; step 3 sets it for everyone.
      ...(f.birthMode === 'born'
        ? { date_of_birth: f.birthDate }
        : { due_date: f.birthDate }),
    }))

    const { data, error: insertErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .insert(rows)
      .select()

    setLoading(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    setBabies(data ?? [])
    // One event per baby keeps the existing funnel analysis intact and lets
    // us count twin/triplet households by grouping user_id → count(events).
    for (const f of trimmed) {
      track.babyAdded({
        mode: f.birthMode, // 'born' | 'expecting'
        has_gender: !!f.gender,
      })
    }
    if (trimmed.length > 1) {
      track.babiesAddedOnboarding({ count: trimmed.length })
    }
    await bumpOnboardingStep(2)
    setStep('sizemode')
  }

  // ── Step 2 — baby form helpers ────────────────────────────────────────
  function updateBabyForm(idx, patch) {
    setBabyForms(forms =>
      forms.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    )
  }

  function addBabyForm() {
    // Collapse existing forms and expand the new one, so the user's focus
    // lands in exactly one place.
    setBabyForms(forms => [
      ...forms.map(f => ({ ...f, expanded: false })),
      makeBabyForm(true),
    ])
  }

  function removeBabyForm(idx) {
    setBabyForms(forms => forms.filter((_, i) => i !== idx))
  }

  function toggleBabyFormExpanded(idx) {
    setBabyForms(forms =>
      forms.map((f, i) => (i === idx ? { ...f, expanded: !f.expanded } : f))
    )
  }

  // ── Step 3 — pick size mode ──────────────────────────────────────────
  // Applies to every baby in the household. Tracking style tends to be a
  // household-level preference (what the parent's brain is used to), so we
  // don't ask per-baby. The Profile surface lets them diverge later if they
  // ever want to.
  async function selectSizeMode(mode) {
    setSizeMode(mode)
    setLoading(true)
    setError(null)

    const ids = babies.map(b => b.id)
    const { error: updateErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .update({ size_mode: mode })
      .in('id', ids)

    setLoading(false)

    if (updateErr) {
      setError(updateErr.message)
      return
    }

    track.sizeModeSelected(mode)
    await bumpOnboardingStep(3)
    setStep('receiving')
  }

  // ── Step 4 — receiving opt-in ────────────────────────────────────────
  // Writes the receiving preferences to the household row. Default state
  // (toggle off, empty arrays, no notes) is a valid save — that's an
  // explicit "not opted in" signal, not a skip that leaves NULL garbage
  // on the row. Empty size/gender arrays collapse to NULL so the matching
  // query only needs one branch for "any size/gender."
  async function submitReceiving() {
    if (!household) return
    setLoading(true)
    setError(null)

    const sizesToWrite   = receivingSizes.length   ? receivingSizes   : null
    const gendersToWrite = receivingGenders.length ? receivingGenders : null
    const notesToWrite   = receivingNotes.trim() || null

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('households')
      .update({
        accepts_hand_me_downs: acceptHandMeDowns,
        accepts_sizes:          sizesToWrite,
        accepts_genders:        gendersToWrite,
        receiving_notes:        notesToWrite,
      })
      .eq('id', household.id)

    setLoading(false)

    if (updErr) {
      setError(updErr.message)
      return
    }

    // Single event so the funnel can measure receiving-step opt-in rate
    // directly. Shape mirrors the Profile-side events so dashboards can
    // union the two surfaces.
    track.receivingOptInToggled({
      opted_in: acceptHandMeDowns,
      source:   'onboarding',
      sizes:    (sizesToWrite || []).length,
      genders:  (gendersToWrite || []).length,
      has_notes: !!notesToWrite,
    })

    await bumpOnboardingStep(4)
    setStep('invite')
  }

  function toggleReceivingSize(size) {
    setReceivingSizes(curr =>
      curr.includes(size) ? curr.filter(s => s !== size) : [...curr, size]
    )
  }

  function toggleReceivingGender(gender) {
    setReceivingGenders(curr =>
      curr.includes(gender) ? curr.filter(g => g !== gender) : [...curr, gender]
    )
  }

  // ── Step 5 — invite (UI only for now) ────────────────────────────────
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
    bumpOnboardingStep(ONBOARDING_COMPLETE)
    setStatus('done')
  }

  // ── Back navigation ──────────────────────────────────────────────────
  // Re-entrant: a user who lands on step 3 (size mode) and realizes they
  // typo'd a baby name needs a way back without losing the whole flow.
  //
  // We intentionally do NOT decrement user_activity_summary.onboarding_step —
  // that column is the "highest reached" semantic used for resume across
  // devices, and walking it backwards would make a later session resume at
  // an earlier screen than the user actually got to. Backing up is a local
  // UI affordance; the persisted progress stays at its high-water mark.
  //
  // Step 1 (household) is intentionally without a back button — there's
  // nowhere meaningful to go back to (the user arrived here by signing in)
  // and the Logout button in the top-right is the real "get me out" affordance.
  function goBack() {
    const idx = STEP_TO_INDEX[step]
    if (idx > 0) setStep(STEPS[idx - 1])
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
            {doneSubCopy(babies)}
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
        {stepIndex > 0 && (
          <button
            type="button"
            className={styles.backBtn}
            onClick={goBack}
            aria-label="Back to previous step"
          >
            ← Back
          </button>
        )}
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
            <h1 className={styles.title}>
              {babyForms.length > 1 ? 'Tell us about your babies' : 'Tell us about your baby'}
            </h1>
            <p className={styles.sub}>
              We'll use this to track sizes and plan ahead for you.
            </p>
            <form onSubmit={submitBabies}>
              {babyForms.map((form, idx) => {
                const canRemove = babyForms.length > 1
                const headerLabel = form.name.trim() || `Baby ${idx + 1}`
                return (
                  <div key={idx} className={styles.babyCard}>
                    {/* Collapsed header shows the baby's label + an expand
                        toggle. We render it for every form so the card style
                        stays consistent; the first form is expanded on entry
                        but can still be collapsed once a second one exists. */}
                    <div className={styles.babyCardHead}>
                      <button
                        type="button"
                        className={styles.babyCardToggle}
                        onClick={() => toggleBabyFormExpanded(idx)}
                        aria-expanded={form.expanded}
                      >
                        <span className={styles.babyCardLabel}>{headerLabel}</span>
                        <span
                          className={`${styles.babyCardChevron} ${form.expanded ? styles.babyCardChevronOpen : ''}`}
                          aria-hidden="true"
                        >
                          ▾
                        </span>
                      </button>
                      {canRemove && (
                        <button
                          type="button"
                          className={styles.babyCardRemove}
                          onClick={() => removeBabyForm(idx)}
                          aria-label={`Remove ${headerLabel}`}
                        >
                          ×
                        </button>
                      )}
                    </div>

                    {form.expanded && (
                      <div className={styles.babyCardBody}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Baby's name</label>
                          <input
                            className={styles.input}
                            type="text"
                            placeholder="Lily"
                            value={form.name}
                            onChange={e => updateBabyForm(idx, { name: e.target.value })}
                            autoFocus={idx === 0 && babyForms.length === 1}
                          />
                        </div>

                        <div className={styles.segToggle}>
                          <button
                            type="button"
                            className={`${styles.segBtn} ${form.birthMode === 'born' ? styles.segActive : ''}`}
                            onClick={() => updateBabyForm(idx, { birthMode: 'born' })}
                          >
                            Already born
                          </button>
                          <button
                            type="button"
                            className={`${styles.segBtn} ${form.birthMode === 'expecting' ? styles.segActive : ''}`}
                            onClick={() => updateBabyForm(idx, { birthMode: 'expecting' })}
                          >
                            Expecting
                          </button>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.label}>
                            {form.birthMode === 'born' ? 'Date of birth' : 'Due date'}
                          </label>
                          <input
                            className={styles.input}
                            type="date"
                            value={form.birthDate}
                            onChange={e => updateBabyForm(idx, { birthDate: e.target.value })}
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
                              className={`${styles.chip} ${form.gender === g ? styles.chipSel : ''}`}
                              onClick={() =>
                                updateBabyForm(idx, { gender: form.gender === g ? null : g })
                              }
                            >
                              {g.charAt(0).toUpperCase() + g.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              <button
                type="button"
                className={styles.addAnotherBtn}
                onClick={addBabyForm}
              >
                + Add another{' '}
                <span className={styles.addAnotherHint}>
                  (twins? triplets? bring &rsquo;em all)
                </span>
              </button>

              {error && <div className={styles.error}>{error}</div>}
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={
                  loading ||
                  babyForms.some(f => !f.name.trim() || !f.birthDate)
                }
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

        {step === 'receiving' && (
          <>
            <h1 className={styles.title}>Open to hand-me-downs?</h1>
            <p className={styles.sub}>
              When another Rooloop family has outgrown clothes to pass along,
              Rooloop can route a box your way. You&rsquo;ll always get a
              message before anything ships, and you can turn this off anytime
              from your profile.
            </p>

            <div className={styles.receivingToggleCard}>
              <div className={styles.receivingToggleBody}>
                <div className={styles.receivingToggleTitle}>
                  Open to receiving hand-me-downs
                </div>
                <div className={styles.receivingToggleSub}>
                  {acceptHandMeDowns
                    ? 'We\u2019ll match you when a box fits your household.'
                    : 'Toggle on to start receiving matches.'}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={acceptHandMeDowns}
                aria-label={
                  `Open to receiving hand-me-downs — ${acceptHandMeDowns ? 'on' : 'off'}`
                }
                className={
                  `${styles.switch} ${acceptHandMeDowns ? styles.switchOn : ''}`
                }
                onClick={() => setAcceptHandMeDowns(v => !v)}
              >
                <span className={styles.switchKnob} aria-hidden="true" />
              </button>
            </div>

            {acceptHandMeDowns && (
              <div className={styles.receivingDetails}>
                <div className={styles.sectionLabel}>
                  Sizes you&rsquo;d welcome{' '}
                  <span className={styles.sectionLabelNote}>
                    (leave blank for any)
                  </span>
                </div>
                <div className={styles.chipGrid}>
                  {RECEIVING_SIZES.map(size => (
                    <button
                      key={size}
                      type="button"
                      className={
                        `${styles.chip} ${receivingSizes.includes(size) ? styles.chipSel : ''}`
                      }
                      onClick={() => toggleReceivingSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <div className={styles.sectionLabel}>
                  Clothing style{' '}
                  <span className={styles.sectionLabelNote}>
                    (leave blank for any)
                  </span>
                </div>
                <div className={styles.chipGrid}>
                  {RECEIVING_GENDERS.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={
                        `${styles.chip} ${receivingGenders.includes(g.id) ? styles.chipSel : ''}`
                      }
                      onClick={() => toggleReceivingGender(g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Anything we should know?{' '}
                    <span className={styles.sectionLabelNote}>(optional)</span>
                  </label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    value={receivingNotes}
                    onChange={e => setReceivingNotes(e.target.value)}
                    maxLength={500}
                    placeholder="e.g. Baby #2 due in August, so sizes 6-12M would be extra helpful."
                  />
                </div>
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={submitReceiving}
              disabled={loading}
            >
              {loading
                ? 'Saving…'
                : acceptHandMeDowns ? 'Continue' : 'Not right now'}
            </button>
          </>
        )}

        {step === 'invite' && (
          <>
            <h1 className={styles.title}>Invite a family member?</h1>
            <p className={styles.sub}>
              Co-parents, grandparents, anyone helping out — they'll get access to
              {' '}{inviteWardrobeCopy(babies)}.
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
