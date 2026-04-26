import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './ResetPassword.module.css'

// New-password screen, reached after a user verifies their 6-digit recovery
// code on the Login screen.
//
// Flow:
//  1. User taps "Forgot password?" on /login → enters email → receives a
//     6-digit code by email.
//  2. User enters the code into the Login code-entry screen, which calls
//     verifyOtp({ type: 'recovery' }). On success, Supabase establishes a
//     short-lived recovery session that allows updateUser({ password }).
//  3. Login navigates here. We expect a session to already exist.
//  4. On submit: updateUser({ password }) → signOut() → redirect to /login.
//
// If the user lands here without a session (visited directly, or recovery
// session expired), we show an error and link back to /login.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking' | 'ready' | 'invalid' | 'done'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // After verifyOtp({type:'recovery'}) on /login the session should already
    // be in place. We do a single getSession check; no need to wait for
    // PASSWORD_RECOVERY events anymore (those came from the link/hash flow).
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setStatus(session ? 'ready' : 'invalid')
    })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }

    track.passwordResetCompleted()

    // Clear the recovery session so the user has to log in fresh with the new password.
    await supabase.auth.signOut()

    setLoading(false)
    setStatus('done')
  }

  if (status === 'checking') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <div className={styles.loadingState}>Loading…</div>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Session expired</h1>
          <p className={styles.sub}>
            Your password reset session has expired. Request a new code from the log in screen.
          </p>
          <button className={styles.submitBtn} onClick={() => navigate('/login')}>
            Go to log in
          </button>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.successIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Password updated</h1>
          <p className={styles.sub}>
            Your new password is set. Log in to continue.
          </p>
          <button className={styles.submitBtn} onClick={() => navigate('/login')}>
            Go to log in
          </button>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.logo}>sprigloop</div>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.sub}>
          Pick something you'll remember. At least 8 characters.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>New password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Confirm new password</label>
            <input
              className={styles.input}
              type="password"
              placeholder="Re-enter your new password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={loading || !password || !confirm}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <div className={styles.footer}>
          <button className={styles.loginLink} onClick={() => navigate('/login')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
