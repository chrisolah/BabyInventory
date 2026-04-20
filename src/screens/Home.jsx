import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import styles from './Home.module.css'

// Home is the signed-in landing page for the inventory app. For now it's a
// shell: a persistent header (brand + "Invite member" button) and an empty-
// state card where the inventory list will eventually live.
//
// The "Invite household member" button lives in the header so it's accessible
// from any scroll position and survives as we build out more body content.
// Invite plumbing (pending_invites + email delivery) isn't wired yet, so the
// modal currently just collects the email and fires an analytics event — we
// say so in the helper note to set expectations honestly.
export default function Home() {
  const { user } = useAuth()
  const [showInvite, setShowInvite] = useState(false)

  const firstName = user?.user_metadata?.name?.split(' ')[0] ?? ''

  function openInvite() {
    track.householdInviteOpened('home_header')
    setShowInvite(true)
  }

  function closeInvite() {
    setShowInvite(false)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>Littleloop</div>
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
      </header>

      <main className={styles.body}>
        <h1 className={styles.greeting}>
          {firstName ? `Hi, ${firstName}` : 'Welcome'}
        </h1>
        <p className={styles.sub}>
          Your inventory lives here. Add what you have, and we'll help you keep
          track of sizes, gaps, and outgrown items.
        </p>

        <div className={styles.emptyCard}>
          <div className={styles.emptyTitle}>Nothing here yet</div>
          <div className={styles.emptySub}>
            The inventory view is coming soon. In the meantime, invite a
            co-parent or grandparent so they're ready to help when it lands.
          </div>
        </div>
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
