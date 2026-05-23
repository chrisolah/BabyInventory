import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import styles from './AppSplash.module.css'
import { setStatusBarForSplash, setStatusBarForApp } from '../lib/nativeUI'

// Native-only animated splash. Bridges the moment between the static iOS
// launch screen (solid teal) and the app being ready: the sprig draws itself
// in, the leaves unfurl, and the wordmark rises — then the whole overlay
// fades out and the component unmounts.
//
// Skipped entirely on the web: Capacitor.isNativePlatform() is false in a
// browser, so the website is never gated behind a splash.
//
// The sprig geometry is the same mark as the app icon (see
// assets/sprigloop-icon-master.svg). The draw + unfurl recipe mirrors
// IvySprig: a pathLength="1" stem animated via stroke-dashoffset, and leaves
// whose inner <g> scales up from their base (transform-origin: 0 0).
export default function AppSplash() {
  const [visible, setVisible] = useState(() => {
    try {
      return Capacitor.isNativePlatform()
    } catch (_) {
      return false
    }
  })
  const [leaving, setLeaving] = useState(false)

  // Nudge Fraunces to load early so the wordmark renders in-font rather than
  // briefly swapping from the serif fallback mid-animation.
  useEffect(() => {
    if (document.fonts && document.fonts.load) {
      document.fonts.load('500 30px "Fraunces"').catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    // White status-bar text while the teal splash is up.
    setStatusBarForSplash()
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Hold long enough for the grow + wordmark to settle, then fade.
    const holdMs = reduced ? 700 : 1750
    const fadeMs = 380
    const t1 = setTimeout(() => {
      setLeaving(true)
      // Hand the status bar back to dark text as the app fades in.
      setStatusBarForApp()
    }, holdMs)
    const t2 = setTimeout(() => setVisible(false), holdMs + fadeMs)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className={`${styles.splash}${leaving ? ' ' + styles.leaving : ''}`}
      aria-hidden="true"
    >
      <div className={styles.lockup}>
        <svg
          className={styles.mark}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className={styles.stem}
            pathLength="1"
            d="M 46 84 C 41 68 55 60 54 46 C 53 38 54 31 52.7 25"
            stroke="#FFFFFF"
            strokeWidth="4.6"
            strokeLinecap="round"
            fill="none"
          />
          <g transform="translate(48 69) rotate(215)">
            <g className={`${styles.leaf} ${styles.leaf1}`} style={{ '--s': 1.05 }}>
              <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" fill="#FFFFFF" />
            </g>
          </g>
          <g transform="translate(55 48) rotate(325)">
            <g className={`${styles.leaf} ${styles.leaf2}`} style={{ '--s': 1 }}>
              <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" fill="#FFFFFF" />
            </g>
          </g>
          <g transform="translate(54.5 31) rotate(254)">
            <g className={`${styles.leaf} ${styles.leaf3}`} style={{ '--s': 0.85 }}>
              <path d="M 0 0 C 6 -8 21 -9 28 0 C 21 9 6 8 0 0 Z" fill="#FFFFFF" />
            </g>
          </g>
        </svg>
        <div className={styles.wordmark}>sprigloop</div>
      </div>
    </div>
  )
}
