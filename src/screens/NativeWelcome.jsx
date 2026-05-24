import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
export default function NativeWelcome() {
  const navigate = useNavigate()
  const { signInAnonymously } = useAuth()
  // Pending while the anon sign-in call is in flight, so a rapid double-tap
  // can't fire two sign-ins.
  const [starting, setStarting] = useState(false)

  // Mirrors Landing.jsx's startTrial: anonymous sign-in, then onboarding.
  // Falls back to /signup if anonymous auth is unavailable.
  async function handleTry() {
    if (starting) return
    setStarting(true)
    track.ctaClicked('native_welcome_try')
    const { error } = await signInAnonymously()
    if (error) {
      console.error('Anonymous sign-in failed; falling back to /signup', error)
      track.ctaClicked('try_anon_fallback_signup')
      setStarting(false)
      navigate('/signup')
      return
    }
    setStarting(false)
    navigate('/onboarding')
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
        <button className={styles.primary} onClick={handleTry} disabled={starting}>
          {starting ? 'Starting…' : 'Try Sprigloop free'}
        </button>
        <button className={styles.secondary} onClick={() => navigate('/login')}>
          Log in
        </button>
      </div>
    </div>
  )
}
