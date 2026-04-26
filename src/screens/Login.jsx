import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './Login.module.css'

// Whitelist for ?next= post-auth redirects. We only honour same-origin paths
// that begin with '/' and don't try to escape (no '//' or 'http'). Everything
// else falls back to /home so a malicious link can't bounce a signed-in user
// off-site or to an unintended internal route.
function safeNext(raw) {
  if (!raw) return '/home'
  if (typeof raw !== 'string') return '/home'
  if (!raw.startsWith('/')) return '/home'
  if (raw.startsWith('//')) return '/home'
  return raw
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  // ?next=<path> — set by AcceptInvite (and any future "log in to continue"
  // flow) so we can return the user to where they were after auth completes.
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return safeNext(params.get('next'))
  }, [location.search])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // 'password' = email + password sign-in
  // 'magic'    = email-only, we send a 6-digit code, user enters it to sign in
  const [method, setMethod] = useState('password')
  const [loading, setLoading] = useState(false)
  // Magic-link code-entry state. When non-null we're on the code-entry screen
  // and `code` is what the user typed. Recovery is NOT handled here anymore —
  // the recovery code-entry lives on /reset-password (unguarded route) so the
  // post-verify auth-state flip can't race PublicRoute into bouncing the user
  // to /home before navigate('/reset-password') runs.
  const [codeStep, setCodeStep] = useState(null) // null | 'magic'
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const codeInputRef = useRef(null)

  useEffect(() => {
    track.loginPageViewed()
  }, [])

  // Autofocus the code input the moment we move to the code step. Saves a
  // tap on mobile after the user pivots from email tab back to the app.
  useEffect(() => {
    if (codeStep && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [codeStep])

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
          // No emailRedirectTo: we're using the 6-digit code flow, the user
          // never clicks a link. The token in the email is for typing in.
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

    if (method === 'magic') {
      // Move to code-entry step. We DON'T fire loginCompleted yet — that fires
      // after verifyOtp succeeds.
      setCodeStep('magic')
      setCode('')
    } else {
      track.loginCompleted('password')
      // AuthProvider will pick up the session; PublicRoute on "/" will bounce to /home,
      // but navigate explicitly so the transition feels immediate. If we got
      // here via ?next= (e.g. from /invite/:token), honour that path so the
      // user lands back on the screen they were trying to reach.
      navigate(nextPath)
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

    // Send the recovery email (issues a 6-digit token). The user's code-entry
    // screen lives at /reset-password — that route is unguarded, so verifying
    // the OTP there can't trigger PublicRoute on /login to redirect us to
    // /home in the same auth-state-flip tick.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim()
    )

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    // Hand the email off in URL state so the user doesn't have to retype it.
    navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    // Magic-link sign-in only — recovery code-entry now lives on /reset-password.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: 'email',
    })

    setLoading(false)

    if (verifyError) {
      // Most common: user typo or used an old code from a previous send.
      setError(
        verifyError.message?.toLowerCase().includes('expired') || verifyError.message?.toLowerCase().includes('invalid')
          ? "That code didn't work. Double-check it, or tap \u201CResend\u201D to get a new one."
          : verifyError.message
      )
      return
    }

    track.loginCompleted('magic')
    navigate(nextPath)
  }

  async function handleResendCode() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })

    setLoading(false)

    if (resendError) {
      setError(resendError.message)
      return
    }
    setCode('')
    if (codeInputRef.current) codeInputRef.current.focus()
  }

  // CODE ENTRY SCREEN (magic-link sign-in only — recovery lives on /reset-password)
  if (codeStep) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <button
            className={styles.back}
            onClick={() => { setCodeStep(null); setCode(''); setError(null) }}
            type="button"
          >
            ← Back
          </button>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Enter your sign-in code</h1>
          <p className={styles.sub}>
            We sent a 6-digit code to <strong>{email}</strong>. Type it in below.
          </p>

          <form onSubmit={handleVerifyCode} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>6-digit code</label>
              <input
                ref={codeInputRef}
                className={styles.input}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={loading || code.trim().length < 6}
            >
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.hint}>
            Didn't get it? Check your spam folder or{' '}
            <button className={styles.resendBtn} onClick={handleResendCode} disabled={loading}>
              resend the code
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  // REQUEST SCREEN (email + password OR email + "send me a code")
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
        <div className={styles.logo}>sprigloop</div>
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
            Email a code
          </button>
        </div>

        <p className={styles.methodHint}>
          {method === 'password'
            ? "Sign in with the password you chose when you signed up."
            : "We'll email you a 6-digit code. Type it in to sign in. No password needed."}
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
              : 'Email me a code'}
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
