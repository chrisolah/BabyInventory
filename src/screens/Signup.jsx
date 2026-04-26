import { useState, useEffect, useMemo } from 'react'
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
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    track.signupPageViewed()
  }, [])

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

    // Where the confirmation / magic-link email link should point. If we
    // arrived via ?next= (invite flow), the email link must come back to
    // /invite/:token so the recipient lands on the accept screen with a
    // fresh session — without this, Supabase falls back to siteUrl (/home)
    // and the user runs into the onboarding gate even though they're meant
    // to be joining an existing household.
    //
    // For non-invite signups we leave emailRedirectTo undefined and let
    // Supabase apply its default (siteUrl, configured per-project).
    //
    // The destination URL has to be in Supabase Auth → URL Configuration →
    // Redirect URLs. A wildcard like https://sprigloop.com/invite/* is the
    // cleanest match — see the deploy notes.
    const emailRedirectTo = nextPath
      ? `${window.location.origin}${nextPath}`
      : undefined

    if (method === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: getMetadata(),
          emailRedirectTo,
        },
      })
      authError = error
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: getMetadata(),
          emailRedirectTo,
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
      setSent(true)
      return
    }

    // Password signup. Two outcomes depending on whether email confirmation
    // is enabled in this Supabase project:
    //   • session present → user is immediately authenticated. Navigate to
    //     ?next= if set (invite flow), otherwise into onboarding.
    //   • session absent  → confirmation email is required. Showing the
    //     "check your email" splash here keeps the user oriented; the link
    //     in the email (governed by emailRedirectTo above) will land them
    //     on the right destination once clicked. Without this branch the
    //     immediate navigate() would push them into ProtectedLayout, which
    //     would bounce them back to / because they have no session yet.
    if (postSignupSession) {
      navigate(nextPath || '/onboarding')
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.successIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.sub}>
            We sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.
          </p>
          <p className={styles.hint}>
            Didn't get it? Check your spam folder or{' '}
            <button className={styles.resendBtn} onClick={() => setSent(false)}>
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
            Magic link
          </button>
        </div>

        <p className={styles.methodHint}>
          {method === 'password'
            ? "Create a password you'll remember and sign in anytime."
            : "We'll email you a link — one click and you're in. No password ever."}
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
              : 'Send magic link'}
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