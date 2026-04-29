import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUpgradeGate } from '../contexts/UpgradeGateContext'
import { track } from '../lib/analytics'
import styles from './TrialBanner.module.css'

// TrialBanner — persistent bottom-fixed reminder that the visitor is in
// trial mode (Supabase is_anonymous=true) and their data isn't backed by
// a permanent account yet. Tapping the banner opens the upgrade modal
// directly via UpgradeGateContext.triggerUpgrade — no need to first hit
// a save action and bounce off the gate.
//
// Auto-unmounts when isAnonymous flips to false (after a successful
// upgrade), so we don't need to handle a "dismissed permanently" state
// — the banner is its own success indicator by disappearing.
//
// Position: fixed at the bottom of the viewport with safe-area inset so
// it clears the iOS home indicator. z-index sits BELOW the toast layer
// (z-60 on Inventory) so a transient pass-on / tuck-away toast can
// overlay the banner without competing for the same vertical space.
export default function TrialBanner() {
  const { isAnonymous } = useAuth()
  const { triggerUpgrade } = useUpgradeGate()

  // Reserve space at the bottom of the document so the fixed-position
  // banner doesn't cover page CTAs (Add buttons, Save buttons, etc.).
  // Sets data-trial-banner="visible" on <body>; globals.css picks that
  // up and adds padding-bottom equal to the banner height + safe-area.
  // Cleared on unmount so permanent users don't keep the padding.
  useEffect(() => {
    if (!isAnonymous) return
    document.body.setAttribute('data-trial-banner', 'visible')
    return () => {
      document.body.removeAttribute('data-trial-banner')
    }
  }, [isAnonymous])

  if (!isAnonymous) return null

  function handleClick() {
    track.trialBannerTapped?.({})
    triggerUpgrade()
  }

  return (
    <button
      type="button"
      className={styles.banner}
      onClick={handleClick}
      aria-label="Save your wardrobe by creating an account"
    >
      <span className={styles.body}>
        <strong>Trial mode</strong> — your wardrobe isn&rsquo;t saved yet.
      </span>
      <span className={styles.cta} aria-hidden="true">
        Save it →
      </span>
    </button>
  )
}
