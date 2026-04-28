import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import styles from './ResetPassword.module.css'

// Password reset flow, end-to-end on a single unguarded route.
//
// Flow:
//  1. /login: user taps "Forgot password?" → enters email → we call
//     resetPasswordForEmail() → navigate here with ?email=... in the URL.
//  2. Step 'code' (this screen): user enters the 6-digit code we just emailed.
//     verifyOtp({type:'recovery'}) creates a short-lived recovery session.
//  3. Step 'password' (this screen): user picks a new password →
//     updateUser({password}) → signOut → step 'done' → bounce to /login.
//
// Why both steps live here (and not on /login):
//   verifyOtp({type:'recovery'}) signs the user in. If we ran it on /login,
//   AuthProvider's setUser would propagate, PublicRoute on /login would
//   render <Navigate to="/home" replace/>, and that <Navigate>'s effect
//   would override our imperative navigate('/reset-password') in the same
//   tick. /reset-password is unguarded, so doing the verify here can't race.
//
// Direct landings (no email in URL): user is allowed to type their email
// manually and request a fresh code from this screen. This handles the case
// where the email link Outlook tried to "preview" never made it back to the
// browser tab.
export default function ResetPassword() {
  const navigate = useNavigate()
  const location = useLocation()
  const initialEmail = new URLSearchParams(location.search).get('email') || ''
  const [step, setStep] = useState('code') // 'code' | 'password' | 'done'
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const codeInputRef = useRef(null)

  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [step])

  async function handleVerifyCode(e) {
    e.preventDefault()
    const trimmedCode = code.trim()
    const trimmedEmail = email.trim()
    if (!trimmedCode || !trimmedEmail) return

    setLoading(true)
    setError(null)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedCode,
      type: 'recovery',
    })

    setLoading(false)

    if (verifyError) {
      setError(
        verifyError.message?.toLowerCase().includes('expired') || verifyError.message?.toLowerCase().includes('invalid')
          ? "That code didn't work. Double-check it, or tap \u201Cresend\u201D for a new one."
          : verifyError.message
      )
      return
    }

    track.passwordResetRequested() // arrival at the new-password screen
    setStep('password')
    setCode('')
  }

  async function handleResendCode() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email first.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: resendError } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
    setLoading(false)
    if (resendError) {
      setError(resendError.message)
      return
    }
    setCode('')
    if (codeInputRef.current) codeInputRef.current.focus()
  }

  async function handleSubmitPassword(e) {
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
    setStep('done')
  }

  // ─── STEP: code entry ──────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <button className={styles.back} onClick={() => navigate('/login')}>← Back to log in</button>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Enter your reset code</h1>
          <p className={styles.sub}>
            We sent a 6-digit code to <strong>{email || 'your email'}</strong>. Type it in below.
          </p>

          <form onSubmit={handleVerifyCode} className={styles.form}>
            {!initialEmail && (
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
            )}

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
              disabled={loading || !email.trim() || code.trim().length < 6}
            >
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>

          <p className={styles.sub} style={{ marginTop: 16 }}>
            Didn't get it? Check your spam folder or{' '}
            <button
              type="button"
              className={styles.resendBtn}
              onClick={handleResendCode}
              disabled={loading}
            >
              resend the code
            </button>
            .
          </p>
        </div>
      </div>
    )
  }

  // ─── STEP: done ────────────────────────────────────────────────────────────
  if (step === 'done') {
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

  // ─── STEP: new password ────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.logo}>sprigloop</div>
        <h1 className={styles.title}>Choose a new password</h1>
        <p className={styles.sub}>
          Pick something you'll remember. At least 8 characters.
        </p>

        <form onSubmit={handleSubmitPassword} className={styles.form}>
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
