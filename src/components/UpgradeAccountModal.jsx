import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import styles from './UpgradeAccountModal.module.css'

// UpgradeAccountModal is the blocking signup gate that fires when an
// anonymous trial user tries to write something they'd be upset to lose
// (first item save, first scan commit, first bag creation, etc.).
//
// Two-step OTP flow that mirrors the existing 6-digit pattern from
// Signup.jsx and ResetPassword.jsx:
//   1. Email step — user types their email, taps Continue. We call
//      auth.updateUser({ email }) which mails a 6-digit confirmation
//      code (no clickable link, sidesteps Outlook Safe Links pre-fetch).
//   2. Code step — user types the code from their inbox, taps Confirm.
//      verifyOtp({type:'email_change'}) finalizes the conversion. Same
//      auth.users.id, just with an email attached and is_anonymous flipped
//      to false. Every row the user wrote during the trial belongs to the
//      permanent account because the UID never changed.
//
// The modal is mounted by UpgradeGateContext when a gated action fires.
// onSuccess is called after confirmEmailChange succeeds; the gate replays
// the deferred action right after. onDismiss is called when the user
// taps the Cancel button or the backdrop, and the gate rejects the
// deferred action's promise with { cancelled: true } so the caller can
// roll back any optimistic UI state.
export default function UpgradeAccountModal({ onSuccess, onDismiss }) {
  const { requestEmailChange, confirmEmailChange } = useAuth()
  const [step, setStep] = useState('email') // 'email' | 'code'
  // Mirror Signup.jsx's method toggle so the conversion moment offers the
  // same two paths a fresh signup does: 'password' sets a password during
  // upgrade (so future logins can skip the email round-trip), 'magic'
  // skips it (passwordless — every login goes through email+OTP).
  // Default 'magic' for the lower-friction path; user can flip to
  // password if they prefer.
  const [method, setMethod] = useState('magic') // 'magic' | 'password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const emailInputRef = useRef(null)
  const codeInputRef = useRef(null)

  // Auto-focus the active step's input on mount and on step change so the
  // user can type immediately without an extra tap.
  useEffect(() => {
    if (step === 'email' && emailInputRef.current) {
      emailInputRef.current.focus()
    } else if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [step])

  useEffect(() => {
    track.upgradeModalOpened?.({ step })
    // Track the first opening only; step changes are tracked via their
    // own success-path handlers below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEmailSubmit(e) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    const trimmedPw = password.trim()
    if (!trimmedEmail || loading) return
    if (method === 'password' && !trimmedPw) return

    setLoading(true)
    setError(null)

    const { error: reqErr } = await requestEmailChange(
      trimmedEmail,
      method === 'password' ? trimmedPw : undefined,
    )
    setLoading(false)

    if (reqErr) {
      setError(reqErr.message)
      return
    }

    track.upgradeEmailRequested?.({ method })
    setStep('code')
    setCode('')
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setError(null)

    const { error: confirmErr } = await confirmEmailChange(email, trimmed)
    setLoading(false)

    if (confirmErr) {
      const msg = confirmErr.message?.toLowerCase() || ''
      setError(
        msg.includes('expired') || msg.includes('invalid')
          ? "That code didn't work. Double-check it, or tap Resend to get a new one."
          : confirmErr.message,
      )
      return
    }

    track.upgradeCompleted?.({ method })
    onSuccess()
  }

  async function handleResend() {
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    const { error: reqErr } = await requestEmailChange(
      email,
      method === 'password' ? password : undefined,
    )
    setLoading(false)
    if (reqErr) {
      setError(reqErr.message)
      return
    }
    setCode('')
    if (codeInputRef.current) codeInputRef.current.focus()
  }

  function handleBackdropClick() {
    if (loading) return
    track.upgradeModalDismissed?.({ step })
    onDismiss()
  }

  function handleCancel() {
    if (loading) return
    track.upgradeModalDismissed?.({ step })
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
        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <h2 id="upgrade-modal-title" className={styles.title}>
              Save your wardrobe
            </h2>
            <p className={styles.body}>
              Add an email to lock in everything you&rsquo;ve added so far.
            </p>

            {/* Method toggle — mirrors Signup.jsx so the conversion moment
                offers the same shape as a fresh signup. Magic is the
                default (lower-friction) path; users who want a password
                they can type into a login form later flip the toggle. */}
            <div className={styles.methodToggle}>
              <button
                type="button"
                className={`${styles.methodBtn} ${method === 'magic' ? styles.methodActive : ''}`}
                onClick={() => { setMethod('magic'); setError(null) }}
                disabled={loading}
              >
                Email a code
              </button>
              <button
                type="button"
                className={`${styles.methodBtn} ${method === 'password' ? styles.methodActive : ''}`}
                onClick={() => { setMethod('password'); setError(null) }}
                disabled={loading}
              >
                Password
              </button>
            </div>

            <p className={styles.methodHint}>
              {method === 'password'
                ? "Set a password you'll remember. We'll still email a code to verify your email."
                : "We'll email you a 6-digit code. Type it in to save your account. No password to remember."}
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

            {method === 'password' && (
              <>
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
              </>
            )}

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
                disabled={
                  loading ||
                  !email.trim() ||
                  (method === 'password' && password.trim().length < 8)
                }
              >
                {loading
                  ? 'Sending…'
                  : method === 'password'
                    ? 'Create account'
                    : 'Email me a code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit}>
            <h2 id="upgrade-modal-title" className={styles.title}>
              Enter your code
            </h2>
            <p className={styles.body}>
              We sent a 6-digit code to <strong>{email}</strong>. It&rsquo;s good for a few minutes.
            </p>

            <label className={styles.label} htmlFor="upgrade-code">
              Code
            </label>
            <input
              id="upgrade-code"
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              className={`${styles.input} ${styles.codeInput}`}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
            />

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.resendRow}>
              Didn&rsquo;t get it?{' '}
              <button
                type="button"
                className={styles.resendBtn}
                onClick={handleResend}
                disabled={loading}
              >
                Resend
              </button>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => { setStep('email'); setError(null) }}
                disabled={loading}
              >
                Back
              </button>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={loading || code.length < 6}
              >
                {loading ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
