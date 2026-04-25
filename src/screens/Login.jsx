import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState('password')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    track.loginPageViewed()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    if (method === 'password' && !password.trim()) return

    track.loginStarted(method === 'magic' ? 'magic' : 'password')
    setLoading(true)
    setError(null)

    let authError = null

    if (method === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Only sign in existing users from the login screen — new users should use /signup.
          shouldCreateUser: false,
        },
      })
      authError = error
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })
      authError = error
    }

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    track.loginCompleted(method === 'magic' ? 'magic' : 'password')

    if (method === 'magic') {
      setMagicSent(true)
    } else {
      // AuthProvider will pick up the session; PublicRoute on "/" will bounce to /home,
      // but navigate explicitly so the transition feels immediate.
      navigate('/home')
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError('Enter your email above first, then tap "Forgot password?" again.')
      return
    }

    setLoading(true)
    setError(null)
    track.passwordResetRequested()

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setResetSent(true)
  }

  if (magicSent) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.successIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.logo}>sprig</div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
          </p>
          <p className={styles.hint}>
            Didn't get it? Check your spam folder or{' '}
            <button className={styles.resendBtn} onClick={() => setMagicSent(false)}>
              try again
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  if (resetSent) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.successIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.logo}>sprig</div>
          <h1 className={styles.title}>Password reset sent</h1>
          <p className={styles.sub}>
            We sent a reset link to <strong>{email}</strong>. Click it to choose a new password.
          </p>
          <p className={styles.hint}>
            Didn't get it? Check your spam folder or{' '}
            <button className={styles.resendBtn} onClick={() => setResetSent(false)}>
              try again
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
        <div className={styles.logo}>sprig</div>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.sub}>Log in to your account.</p>

        <div className={styles.methodToggle}>
          <button
            className={`${styles.methodBtn} ${method === 'password' ? styles.methodActive : ''}`}
            onClick={() => { setMethod('password'); setError(null) }}
            type="button"
          >
            Password
          </button>
          <button
            className={`${styles.methodBtn} ${method === 'magic' ? styles.methodActive : ''}`}
            onClick={() => { setMethod('magic'); setError(null) }}
            type="button"
          >
            Magic link
          </button>
        </div>

        <p className={styles.methodHint}>
          {method === 'password'
            ? "Sign in with the password you chose when you signed up."
            : "We'll email you a link — one click and you're in. No password needed."}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Email address</label>
            <input
              className={styles.input}
              type="email"
              placeholder="sarah@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {method === 'password' && (
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>Password</label>
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>
              <input
                className={styles.input}
                type="password"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={loading || !email.trim() || (method === 'password' && !password.trim())}
          >
            {loading
              ? 'Please wait…'
              : method === 'password'
              ? 'Log in'
              : 'Send magic link'}
          </button>
        </form>

        <div className={styles.footer}>
          Don't have an account?{' '}
          <button
            className={styles.signupLink}
            onClick={() => navigate('/signup')}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  )
}
