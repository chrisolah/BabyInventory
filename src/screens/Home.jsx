import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import LogoutButton from '../components/LogoutButton'
import styles from './Home.module.css'

// Home is the signed-in landing page for the inventory app. For now it's a
// shell: a persistent header (brand + "Invite member" button) and an empty-
// state card inviting the user to start their inventory.
//
// Home ALSO acts as the onboarding + "already-started" gate. PublicRoute's
// declarative redirect beats Signup/Login's imperative `navigate(...)` when
// the auth state flips, so any post-auth path funnels through /home first.
// From here we do two checks in order:
//   1. onboarding_step < 4 → /onboarding (incomplete profile)
//   2. any clothing_items exist → /inventory (they've started; the empty-
//      state card on Home is the wrong frame once the inventory isn't empty)
// Everyone else stays on Home and sees the "Start your inventory" card.
//
// The "Invite household member" button lives in the header so it's accessible
// from any scroll position and survives as we build out more body content.
// Invite plumbing (pending_invites + email delivery) isn't wired yet, so the
// modal currently just collects the email and fires an analytics event — we
// say so in the helper note to set expectations honestly.
export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showInvite, setShowInvite] = useState(false)
  // 'checking' until we know onboarding is complete; 'ready' once we do.
  // We never transition to an "incomplete" state because we just redirect.
  const [status, setStatus] = useState('checking')

  const firstName = user?.user_metadata?.name?.split(' ')[0] ?? ''

  // Onboarding gate. Runs once per mounted user. If the summary query fails
  // (e.g. migration 003 hasn't been applied in this env), we log and let the
  // user stay on Home rather than trapping them in a redirect loop.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function check() {
      const { data, error } = await supabase
        .schema(currentSchema)
        .from('user_activity_summary')
        .select('onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Onboarding gate: user_activity_summary query failed —', error.message)
        setStatus('ready')
        return
      }

      const step = data?.onboarding_step ?? 0
      if (step < 4) {
        navigate('/onboarding', { replace: true })
        return
      }

      // Onboarding done — if they've already added anything, skip the empty
      // "Start your inventory" framing and drop them straight on /inventory.
      // RLS scopes this to households the user belongs to, so a single-row
      // head-count query is enough; no need to resolve the household first.
      const { count, error: countErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('id', { count: 'exact', head: true })
        .limit(1)

      if (cancelled) return

      if (countErr) {
        // Don't trap the user if the count query fails (e.g. migration 006
        // hasn't landed in this env). Fall back to the empty-state Home.
        // eslint-disable-next-line no-console
        console.warn('Home: clothing_items count failed —', countErr.message)
        setStatus('ready')
        return
      }

      if ((count ?? 0) > 0) {
        navigate('/inventory', { replace: true })
        return
      }

      setStatus('ready')
    }

    check()
    return () => { cancelled = true }
  }, [user, navigate])

  function openInvite() {
    track.householdInviteOpened('home_header')
    setShowInvite(true)
  }

  function closeInvite() {
    setShowInvite(false)
  }

  if (status === 'checking') {
    // Brief blank screen while we resolve the gate. Keeps the page from
    // flashing "Welcome" at users we're about to redirect.
    return <div className={styles.page} />
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Littleloop</div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.inviteBtn}
            onClick={openInvite}
            aria-label="Invite household member"
          >
            <svg
              className={styles.inviteIcon}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 3.5v9M3.5 8h9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Invite member
          </button>
          <LogoutButton />
        </div>
      </header>

      <main className={styles.body}>
        <h1 className={styles.greeting}>
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </h1>
        <p className={styles.sub}>
          Your inventory lives here. Add what you have, and we'll help you keep
          track of sizes, gaps, and outgrown items.
        </p>

        <button
          type="button"
          className={styles.emptyCard}
          onClick={() => navigate('/inventory')}
        >
          <div className={styles.emptyTitle}>Start your inventory</div>
          <div className={styles.emptySub}>
            Tap here to see your wardrobe and add your first item — a onesie,
            sleepsuit, anything you already have.
          </div>
        </button>
      </main>

      {showInvite && (
        <InviteMemberModal onClose={closeInvite} />
      )}
    </div>
  )
}

// ── Invite modal ────────────────────────────────────────────────────────
// Kept in the same file because it's small and tightly coupled to Home's
// "persistent button → modal" UX. If a third place needs to invite
// (settings, inventory header, etc.), promote to its own component.
function InviteMemberModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    // Fire-and-forget. Real invite delivery is a follow-up; for now we log
    // intent so we can measure demand before building the plumbing.
    track.householdInviteSubmitted({ from: 'home_header' })
    setSent(true)
  }

  // Close on backdrop click but not on modal click.
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={onBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Invite a household member</div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.modalSub}>
          Co-parents, grandparents, anyone helping out — they'll get access to
          your wardrobe once invites are live.
        </p>

        {sent ? (
          <>
            <div className={styles.success}>
              Got it. We'll reach out to {email.trim()} as soon as invites are
              live.
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onClose}
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email address</label>
              <input
                className={styles.input}
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={!email.trim()}
            >
              Send invite
            </button>
            <p className={styles.helperNote}>
              Invites are coming soon. We'll capture who you'd like to bring in
              and reach out when the feature launches.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
