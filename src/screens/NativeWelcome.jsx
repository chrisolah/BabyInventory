import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import styles from './NativeWelcome.module.css'

// Native-only entry screen for logged-out users. The website keeps its full
// marketing Landing page; in the iOS app the App Store listing has already
// done the landing page's job, so the app opens to this focused get-started
// screen instead. Routed as /welcome from App.jsx — see RootIndex there.
//
// Layout: the sprig + wordmark lockup centers in the space above the two
// action buttons, which are anchored full-width at the bottom of the screen.

// ── Nonce helpers ─────────────────────────────────────────────────────────
// Apple Sign In requires a nonce to prevent replay attacks. We generate a
// random raw nonce, SHA-256 hash it, and send the *hash* to Apple. Apple
// embeds the hash in the identity token. We pass the *raw* nonce to Supabase,
// which hashes it again and compares — if they match, the token is valid.
function generateRawNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function NativeWelcome() {
  const navigate = useNavigate()
  const { signInAnonymously } = useAuth()
  const [starting, setStarting] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [error, setError] = useState(null)

  // Mirrors Landing.jsx's startTrial: anonymous sign-in, then onboarding.
  // Falls back to /signup if anonymous auth is unavailable.
  async function handleTry() {
    if (starting || appleLoading) return
    setStarting(true)
    setError(null)
    track.ctaClicked('native_welcome_try')
    const { error: anonError } = await signInAnonymously()
    if (anonError) {
      console.error('Anonymous sign-in failed; falling back to /signup', anonError)
      track.ctaClicked('try_anon_fallback_signup')
      setStarting(false)
      navigate('/signup')
      return
    }
    setStarting(false)
    navigate('/onboarding')
  }

  async function handleAppleSignIn() {
    if (starting || appleLoading) return
    setAppleLoading(true)
    setError(null)
    track.ctaClicked('native_welcome_apple_sign_in')

    try {
      const rawNonce = generateRawNonce()
      const hashedNonce = await sha256Hex(rawNonce)

      const { response } = await SignInWithApple.authorize({
        clientId: 'com.sprigloop.app',
        redirectURI: 'https://sprigloop.com',
        scopes: 'email name',
        nonce: hashedNonce,
      })

      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: response.identityToken,
        nonce: rawNonce,
      })

      if (authError) throw authError

      track.loginCompleted('apple')
      // Home's onboarding gate redirects to /onboarding if step < 5,
      // so new Apple users get the full setup flow automatically.
      navigate('/home')
    } catch (err) {
      // Cancellation: user tapped Cancel in the Apple sheet — silent dismiss.
      const msg = err?.message ?? ''
      if (msg.toLowerCase().includes('cancel') || err?.code === 'ERR_CANCELED') {
        // no-op
      } else {
        setError('Sign in with Apple failed. Please try again.')
        console.error('Apple sign-in error:', err)
      }
    } finally {
      setAppleLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.lockupArea}>
        <div className={styles.lockup}>
          <svg
            className={styles.mark}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M 46 84 C 41 68 55 60 54 46 C 53 38 54 31 52.7 25"
              stroke="#FFFFFF"
              strokeWidth="4.6"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" transform="translate(48 69) rotate(215) scale(1.05)" fill="#FFFFFF" />
            <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" transform="translate(55 48) rotate(325)" fill="#FFFFFF" />
            <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" transform="translate(54.5 31) rotate(254) scale(0.85)" fill="#FFFFFF" />
          </svg>
          <h1 className={styles.wordmark}>sprigloop</h1>
          <p className={styles.tagline}>Baby clothes, <em>organized</em> and shared.</p>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.primary} onClick={handleTry} disabled={starting || appleLoading}>
          {starting ? 'Starting…' : 'Try Sprigloop free'}
        </button>

        <button className={styles.appleBtn} onClick={handleAppleSignIn} disabled={starting || appleLoading}>
          <svg className={styles.appleLogo} viewBox="0 0 17 20" fill="currentColor" aria-hidden="true">
            <path d="M16.2 13.9c-.3.8-.6 1.5-1.1 2.2-.6.9-1.1 1.5-1.5 1.8-.6.6-1.2.9-1.9.9-.5 0-1.1-.1-1.7-.4-.7-.3-1.3-.4-1.8-.4-.6 0-1.2.1-1.9.4-.7.3-1.2.4-1.6.5-.7 0-1.3-.3-2-.9-.5-.4-1-1-1.6-1.9-.6-.9-1.1-2-1.5-3.3C.3 11.4 0 10 0 8.6c0-1.5.3-2.9 1-4 .5-.9 1.1-1.6 2-2.2.8-.5 1.7-.8 2.6-.8.5 0 1.2.2 2 .5.8.3 1.3.5 1.5.5.2 0 .7-.2 1.6-.5.9-.3 1.6-.5 2.2-.5 1.6.1 2.8.8 3.6 2-1.4.9-2.1 2.1-2.1 3.7 0 1.2.4 2.2 1.3 3 .4.4.8.7 1.3.9l-.8 1.7zM12.1 0c0 .9-.3 1.8-.9 2.6-.7.9-1.6 1.5-2.6 1.4V3.7c0-.9.4-1.8 1-2.6.3-.4.7-.7 1.3-1 .5-.2 1-.4 1.5-.4L12.1 0z" />
          </svg>
          {appleLoading ? 'Signing in…' : 'Continue with Apple'}
        </button>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button className={styles.secondary} onClick={() => navigate('/login')} disabled={starting || appleLoading}>
          Log in with email
        </button>
        <button
          className={styles.tertiary}
          onClick={() => {
            track.ctaClicked('native_welcome_find_registry')
            navigate('/find-registry')
          }}
        >
          Find a registry
        </button>
      </div>
    </div>
  )
}
