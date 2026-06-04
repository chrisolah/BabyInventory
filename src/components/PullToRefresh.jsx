import { useEffect, useRef, useState } from 'react'
import styles from './PullToRefresh.module.css'

// PullToRefresh — adds a pull-down-to-reload gesture to the page.
//
// Works on mobile web (Safari, Chrome) and the iOS Capacitor WebView.
// Desktop is unaffected — mouse events don't fire touchstart.
//
// Behaviour:
//   - Only triggers when the page is scrolled to the very top (scrollY === 0)
//   - Tracks finger pull distance; shows a sprig indicator that grows
//     with the pull and locks at THRESHOLD
//   - On release at or past THRESHOLD: window.location.reload()
//   - Below threshold: snaps back with a spring transition
//
// Why window.location.reload():
//   The goal is a full data refresh. React Query / SWR refetch would work
//   too if we ever add a cache layer, but for now a hard reload keeps it
//   simple and is what iOS users expect from the gesture.

const THRESHOLD = 72    // px pulled before the indicator commits
const MAX_PULL  = 110   // px — visual travel cap (indicator doesn't go further)
const DAMPEN    = 0.45  // resistance factor — feels like elastic, not linear

export default function PullToRefresh() {
  const [pull, setPull]         = useState(0)   // 0–MAX_PULL px
  const [releasing, setReleasing] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const startYRef  = useRef(null)
  const pullingRef = useRef(false)

  useEffect(() => {
    function onTouchStart(e) {
      // Only start tracking when at the very top of the page
      if (window.scrollY > 2) return
      startYRef.current  = e.touches[0].clientY
      pullingRef.current = false
    }

    function onTouchMove(e) {
      if (startYRef.current === null) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) {
        // Scrolling up — cancel
        startYRef.current = null
        setPull(0)
        return
      }
      // Re-check we're still at top (user may have scrolled slightly)
      if (window.scrollY > 2 && !pullingRef.current) {
        startYRef.current = null
        return
      }
      pullingRef.current = true
      const damped = Math.min(dy * DAMPEN, MAX_PULL)
      setPull(damped)
      setReleasing(false)
    }

    function onTouchEnd() {
      if (!pullingRef.current) return
      const committed = pull >= THRESHOLD
      setReleasing(true)
      if (committed) {
        setTriggered(true)
        // Brief pause so user sees the "committed" state, then reload
        setTimeout(() => window.location.reload(), 400)
      } else {
        setTimeout(() => {
          setPull(0)
          setReleasing(false)
        }, 300)
      }
      startYRef.current  = null
      pullingRef.current = false
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [pull])

  if (pull === 0 && !releasing) return null

  const progress  = Math.min(pull / THRESHOLD, 1)   // 0–1
  const committed = pull >= THRESHOLD || triggered

  return (
    <div
      className={`${styles.wrap} ${releasing ? styles.releasing : ''}`}
      style={{ '--pull': `${pull}px` }}
      aria-hidden="true"
    >
      <div className={`${styles.indicator} ${committed ? styles.committed : ''}`}>
        {/* Sprig mark — scales and spins on commit */}
        <svg
          viewBox="0 0 32 32"
          width="28"
          height="28"
          fill="none"
          className={styles.sprig}
          style={{ opacity: progress, transform: `rotate(${progress * 180}deg)` }}
        >
          <rect width="32" height="32" rx="6" fill="#2D8C6E" />
          <path
            d="M15.5 27 C14.5 22 14 18 15 14 C15.5 11 15.5 9 15.5 7"
            stroke="white" strokeWidth="2.8" strokeLinecap="round"
          />
          <ellipse cx="15.5" cy="5" rx="2.2" ry="3" fill="white" />
          <ellipse cx="20" cy="12" rx="5" ry="2.2"
            transform="rotate(-30 20 12)" fill="white" />
          <ellipse cx="11" cy="18" rx="5" ry="2.2"
            transform="rotate(30 11 18)" fill="white" />
        </svg>
        <span className={styles.label}>
          {triggered ? 'Refreshing…' : committed ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  )
}
