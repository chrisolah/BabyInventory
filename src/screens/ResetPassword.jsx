import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './ResetPassword.module.css'

// Landing page for the password-reset email link.
//
// Flow:
//  1. User clicks the link in their reset email.
//  2. Supabase drops them here with a recovery token in the URL hash.
//  3. @supabase/supabase-js auto-exchanges the token for a recovery session
//     and fires onAuthStateChange with event === 'PASSWORD_RECOVERY'.
//  4. We show the "choose a new password" form once a session exists.
//  5. On submit: updateUser({ password }) → signOut() → redirect to /login.
//
// If the user lands here without a session (link expired, or visited directly),
// we show an error and link back to /login.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // 'checking' | 'ready' | 'invalid' | 'done'
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let settled = false

    // If Supabase has already processed the hash by the time we mount, we'll
    // have a session immediately.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return
      if (session) {
        settled = true
        setStatus('ready')
      }
    })

    // Otherwise wait for the PASSWORD_RECOVERY event (or any signed-in event
    // that lands us here with a valid session).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return
      if (event === 'PASSWORD_RECOVERY' || session) {
        settled = true
        setStatus('ready')
      }
    })

    // If nothing shows up within ~3s, assume the link was invalid/expired.
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setStatus('invalid')
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
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
          <div className={styles.loadingState}>Checking your reset link…</div>
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Link expired</h1>
          <p className={styles.sub}>
            This password reset link is invalid or has expired. Request a new one from the log in screen.
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
