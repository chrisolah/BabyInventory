import { useState } from 'react'
import { track } from '../lib/analytics'
import styles from './InviteMemberModal.module.css'

// Shared invite-member modal. Originally lived inside Home.jsx; promoted to
// a standalone component once a second caller (Profile → Household tab)
// needed the same UI.
//
// The `from` prop tags the analytics event so we can compare conversion
// across entry points (home_header vs profile_household vs wherever else
// this pops up later).
//
// Real invite delivery (pending_invites row + email send) is still a TODO.
// For now we record intent so the funnel stays honest, then flip to "Got
// it" confirmation state. A future PR will swap the submit handler for
// real plumbing without touching the chrome.

export default function InviteMemberModal({ from, onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  function submit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    track.householdInviteSubmitted({ from })
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
          Co-parents, grandparents, anyone helping out — they&rsquo;ll get
          access to your wardrobe once invites are live.
        </p>

        {sent ? (
          <>
            <div className={styles.success}>
              Got it. We&rsquo;ll reach out to {email.trim()} as soon as
              invites are live.
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
              Invites are coming soon. We&rsquo;ll capture who you&rsquo;d
              like to bring in and reach out when the feature launches.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
