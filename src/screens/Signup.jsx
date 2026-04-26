import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { track, getSessionId } from '../lib/analytics'
import styles from './Signup.module.css'

// Whitelist for ?next= post-auth redirects. Only same-origin paths starting
// with '/' (and not '//') are honoured — a malicious link must not be able
// to bounce a freshly-signed-up user to an external site or unintended
// internal route. Everything else falls back to /onboarding.
function safeNext(raw) {
  if (!raw) return null
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  return raw
}

export default function Signup() {
  const navigate = useNavigate()
  const location = useLocation()
  // ?next=<path> + ?email=<addr> — set by AcceptInvite when sending an
  // unauthed recipient through sign-up. The email is pre-filled (and the
  // recipient should not change it, otherwise accept_invite() will reject
  // them on the back end). After sign-up we bounce to `next`, skipping the
  // usual /onboarding handoff because the invite acceptance flow handles
  // joining the existing household — the new user doesn't need to create
  // their own. The accept screen will then pick up the now-signed-in
  // session and let them tap "Join".
  const { nextPath, prefillEmail } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      nextPath: safeNext(params.get('next')),
      prefillEmail: params.get('email') || '',
    }
  }, [location.search])
  const [name, setName] = useState('')
  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState('password')
  const [loading, setLoading] = useState(false)
  // Code-entry state. Once a signup request has produced a confirmation /
  // magic-link email, we flip to the code-entry screen. The string carries
  // the verifyOtp `type`:
  //   • 'signup' — email confirmation after a password signup (no session yet,
  //                verifyOtp creates one)
  //   • 'email'  — magic-link signup (no password set; verifyOtp signs them in)
  const [codeStep, setCodeStep] = useState(null) // null | 'signup' | 'email'
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const codeInputRef = useRef(null)

  useEffect(() => {
    track.signupPageViewed()
  }, [])

  useEffect(() => {
    if (codeStep && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [codeStep])

  function getMetadata() {
    return {
      name: name.trim(),
      session_id: getSessionId(),
      acquisition_source: new URLSearchParams(window.location.search).get('utm_source') || 'direct',
      acquisition_medium: new URLSearchParams(window.location.search).get('utm_medium') || null,
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    if (method === 'password' && !password.trim()) return

    track.signupStarted()
    setLoading(true)
    setError(null)

    let authError = null
    let postSignupSession = null

    if (method === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: getMetadata(),
          // No emailRedirectTo: we're using the 6-digit code flow. The user
          // never clicks a link, so no redirect URL matters. After they enter
          // the code, the in-app navigation honors `nextPath` directly.
        },
      })
      authError = error
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: getMetadata(),
        },
      })
      authError = error
      postSignupSession = data?.session ?? null
    }

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    track.signupCompleted()

    if (method === 'magic') {
      setCodeStep('email')
      setCode('')
      return
    }

    // Password signup. Two outcomes depending on whether email confirmation
    // is enabled in this Supabase project:
    //   • session present → user is immediately authenticated (email
    //     confirmation disabled). Navigate straight to onboarding / nextPath.
    //   • session absent  → confirmation email is required. Move to the
    //     code-entry step. verifyOtp({type:'signup'}) will create the session
    //     once the user types the code.
    if (postSignupSession) {
      navigate(nextPath || '/onboarding')
    } else {
      setCodeStep('signup')
      setCode('')
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmed,
      type: codeStep, // 'signup' or 'email'
    })

    setLoading(false)

    if (verifyError) {
      setError(
        verifyError.message?.toLowerCase().includes('expired') || verifyError.message?.toLowerCase().includes('invalid')
          ? "That code didn't work. Double-check it, or tap \u201CResend\u201D to get a new one."
          : verifyError.message
      )
      return
    }

    // Session is live. AuthProvider will pick it up and fire the welcome
    // email. Send the user to nextPath (invite acceptance flow) or
    // onboarding for fresh signups.
    navigate(nextPath || '/onboarding')
  }

  async function handleResendCode() {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    // For both signup-confirmation and magic-link signup, signInWithOtp with
    // shouldCreateUser:true safely re-issues the token. (For an existing
    // unconfirmed user it just regenerates; for a confirmed user it would
    // sign them in via magic instead, but that's already a successful
    // outcome from the user's POV.)
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        data: getMetadata(),
      },
    })

    setLoading(false)

    if (resendError) {
      setError(resendError.message)
      return
    }
    setCode('')
    if (codeInputRef.current) codeInputRef.current.focus()
  }

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
          <h1 className={styles.title}>Enter your code</h1>
          <p className={styles.sub}>
            We sent a 6-digit code to <strong>{email}</strong>. Type it in to finish setting up your account.
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
              {loading ? 'Checking…' : 'Continue'}
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

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
        <div className={styles.logo}>sprigloop</div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.sub}>Free forever. No credit card needed.</p>

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
            ? "Create a password you'll remember and sign in anytime."
            : "We'll email you a 6-digit code. Type it in to sign up. No password ever."}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Your name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Sarah Johnson"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
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
              <label className={styles.label}>Password</label>
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
          )}

          {error && <div className={styles.error}>{error}</div>}

          <button
            className={styles.submitBtn}
            type="submit"
            disabled={loading || !name.trim() || !email.trim() || (method === 'password' && !password.trim())}
          >
            {loading
              ? 'Please wait…'
              : method === 'password'
              ? 'Create account'
              : 'Email me a code'}
          </button>
        </form>

        <div className={styles.footer}>
          Already have an account?{' '}
          <button
            className={styles.loginLink}
            onClick={() => navigate('/login')}
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  )
}
