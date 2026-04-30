import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import styles from './UpgradeAccountModal.module.css'

// UpgradeAccountModal is the blocking signup gate that fires when an
// anonymous trial user tries to write something they'd be upset to lose
// (first item save, first scan commit, first bag creation, etc.).
//
// Single-step flow:
//   - User types email + password (8+ chars), taps Create account.
//   - useAuth.upgradeAccount() calls auth.updateUser({ email, password }).
//   - Project has "Confirm email" disabled, so this converts the user
//     inline: same auth.users.id, just with email and password set, and
//     is_anonymous flipped to false. Every household / baby /
//     clothing_items row written during the trial automatically belongs
//     to the permanent account because the UID is unchanged.
//   - Welcome email fires from the auth listener post-conversion.
//
// Why password is required (not optional): OTP-only accounts can't
// recover if the user loses inbox access. Pairing email + password gives
// redundancy. After conversion the user can log in either way — email +
// password OR email + 6-digit OTP via signInWithOtp — both work because
// both fields are set on auth.users. Login.jsx already supports both.
//
// The modal is mounted by UpgradeGateContext when a gated action fires.
// onSuccess is called after upgradeAccount succeeds; the gate replays
// the deferred action right after. onDismiss is called when the user
// taps Not now or the backdrop, and the gate rejects the deferred
// action's promise with { cancelled: true } so the caller can roll back
// any optimistic UI state.
export default function UpgradeAccountModal({ onSuccess, onDismiss }) {
  const { upgradeAccount } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const emailInputRef = useRef(null)

  useEffect(() => {
    if (emailInputRef.current) emailInputRef.current.focus()
  }, [])

  useEffect(() => {
    track.upgradeModalOpened?.({})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()
    if (!trimmedEmail || trimmedPassword.length < 8 || loading) return

    setLoading(true)
    setError(null)

    const { error: upErr } = await upgradeAccount({
      email: trimmedEmail,
      password: trimmedPassword,
    })
    setLoading(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    track.upgradeCompleted?.({})
    onSuccess()
  }

  function handleBackdropClick() {
    if (loading) return
    track.upgradeModalDismissed?.({})
    onDismiss()
  }

  function handleCancel() {
    if (loading) return
    track.upgradeModalDismissed?.({})
    onDismiss()
  }

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="upgrade-modal-title" className={styles.title}>
            Save your wardrobe
          </h2>
          <p className={styles.body}>
            Create your account to lock in what you&rsquo;ve added so far. You can sign in later with this password or with a 6-digit code emailed to you.
          </p>

          <label className={styles.label} htmlFor="upgrade-email">
            Email
          </label>
          <input
            id="upgrade-email"
            ref={emailInputRef}
            type="email"
            className={styles.input}
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={loading}
          />

          <label className={`${styles.label} ${styles.labelStacked}`} htmlFor="upgrade-password">
            Password
          </label>
          <input
            id="upgrade-password"
            type="password"
            className={styles.input}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
            disabled={loading}
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={handleCancel}
              disabled={loading}
            >
              Not now
            </button>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={loading || !email.trim() || password.trim().length < 8}
            >
              {loading ? 'Saving…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
