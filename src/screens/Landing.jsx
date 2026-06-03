import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import IvyBanner from '../components/IvyBanner'
import styles from './Landing.module.css'

// Landing page — Option C build (2026-06-03).
//
// Structure:
//   1. Hero — full-width, no widget
//   2. Feature row: Scan (copy left, mock right)
//   3. Feature row: Plan (mock left, copy right — flipped)
//   4. Feature row: Wishlist (copy left, mock right)
//   5. Feature row: Pass-along (mock left, copy right — flipped)
//   6. Final CTA — dark card
//
// Framing shift: away from "wardrobe app" → baby prep and things management.

export default function Landing() {
  const navigate = useNavigate()
  const passAlongRef = useRef(null)
  const { signInAnonymously } = useAuth()
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    track.pageViewed({ page: 'landing', referrer: document.referrer })
  }, [])

  async function startTrial(ctaName) {
    if (starting) return
    setStarting(true)
    track.ctaClicked(ctaName)
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

  function handleGetStarted()  { startTrial('get_started') }
  function handleWishlistCta() { startTrial('wishlist_cta') }
  function handleFinalCta()    { startTrial('final_cta') }

  function handleSeeHow() {
    track.ctaClicked('see_how_it_works')
    passAlongRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>sprigloop</div>
        <button
          className={styles.navLink}
          onClick={() => {
            track.ctaClicked('nav_how_it_works')
            navigate('/how-it-works')
          }}
        >
          How it works
        </button>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>Log in</button>
      </nav>

      <IvyBanner />

      {/* ── 1. Hero ── */}
      <section className={styles.hero}>
        <div className={styles.eyebrow}>Free for all families</div>
        <h1 className={styles.headline}>Baby prep, <em>handled.</em></h1>
        <p className={styles.sub}>
          Track everything you have, plan everything you need, share a wishlist
          that&rsquo;s actually useful, and pass it all on when baby outgrows it.
          Sprigloop keeps up so you don&rsquo;t have to.
        </p>
        <div className={styles.heroBtns}>
          <button className={styles.heroCta} onClick={handleGetStarted} disabled={starting}>
            {starting ? 'Starting…' : 'Try Sprigloop free'}
          </button>
          <button className={styles.heroSecondaryCta} onClick={handleSeeHow}>
            See how it works
          </button>
        </div>
        <div className={styles.heroFootnote}>
          No account needed to start &nbsp;·&nbsp;{' '}
          <a
            className={styles.appStoreLink}
            href="https://apps.apple.com/us/app/sprigloop-baby-wardrobe/id6772641313"
            target="_blank"
            rel="noopener noreferrer"
          >
            Also on the App Store →
          </a>
        </div>
      </section>

      {/* ── 2. Scan ── */}
      <section className={styles.feature}>
        <div className={styles.featureInner}>
          <div className={styles.featureCopy}>
            <span className={`${styles.featLabel} ${styles.featLabelTeal}`}>Add items</span>
            <h2 className={styles.featureTitle}>Snap a tag.<br />Skip the typing.</h2>
            <p className={styles.featureBody}>
              Point your phone at a clothing tag and Sprigloop reads the brand,
              size, and category in seconds. Got a pile? Tap <strong>Scan many</strong> and
              knock out the whole basket without putting it down.
            </p>
            <p className={styles.featureNote}>Works on most baby-clothing brands and care labels. Edit anything before you save.</p>
          </div>
          <div className={styles.featureVisual}>
            {/* Phone mock: camera viewfinder + tag + extracted chips */}
            <div className={styles.scanMock} aria-hidden="true">
              <div className={styles.scanVf} />
              <span className={`${styles.scanCorner} ${styles.scTl}`} />
              <span className={`${styles.scanCorner} ${styles.scTr}`} />
              <span className={`${styles.scanCorner} ${styles.scBl}`} />
              <span className={`${styles.scanCorner} ${styles.scBr}`} />
              <div className={styles.scanTag}>
                <div className={styles.scanTagBrand}>carter&rsquo;s</div>
                <div className={styles.scanTagSize}>6&ndash;9M</div>
                <div className={styles.scanTagCare}>100% cotton &middot; machine wash</div>
              </div>
              <div className={`${styles.scanChip} ${styles.chip1}`}>
                <div className={styles.chipLabel}>Brand</div>
                <div className={styles.chipVal}>Carter&rsquo;s</div>
              </div>
              <div className={`${styles.scanChip} ${styles.chip2}`}>
                <div className={styles.chipLabel}>Size</div>
                <div className={styles.chipVal}>6&ndash;9M</div>
              </div>
              <div className={`${styles.scanChip} ${styles.chip3}`}>
                <div className={styles.chipLabel}>Category</div>
                <div className={styles.chipVal}>One-pieces</div>
              </div>
              <div className={styles.scanHint}>Got it&hellip;</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Plan ── (flipped) */}
      <section className={styles.feature}>
        <div className={`${styles.featureInner} ${styles.featureFlip}`}>
          <div className={styles.featureCopy}>
            <span className={`${styles.featLabel} ${styles.featLabelAmber}`}>Plan ahead</span>
            <h2 className={styles.featureTitle}>Know what&rsquo;s coming<br />before it arrives.</h2>
            <p className={styles.featureBody}>
              Sprigloop tracks your baby&rsquo;s age across 8 categories — clothing, sleep,
              feeding, travel, and more — and flags gaps before the next size window hits.
              No more last-minute panic buys.
            </p>
            <p className={styles.featureNote}>The Plan tab shows exactly what you&rsquo;re missing and what you already have covered.</p>
          </div>
          <div className={styles.featureVisual}>
            {/* Plan readiness mock */}
            <div className={styles.planMock} aria-hidden="true">
              <div className={styles.pmHeader}>PLAN &middot; 0&ndash;3M</div>
              <div className={styles.pmBig}>62%</div>
              <div className={styles.pmSub}>14 gaps across 8 categories</div>
              <div className={styles.pmRow}>
                <span className={styles.pmLabel}>Clothing</span>
                <div className={styles.pmTrack}><div className={styles.pmFill} style={{ width: '85%' }} /></div>
              </div>
              <div className={styles.pmRow}>
                <span className={styles.pmLabel}>Sleep</span>
                <div className={styles.pmTrack}><div className={`${styles.pmFill} ${styles.pmFillGap}`} style={{ width: '40%' }} /></div>
                <span className={styles.pmBadge}>4 gaps</span>
              </div>
              <div className={styles.pmRow}>
                <span className={styles.pmLabel}>Feeding</span>
                <div className={styles.pmTrack}><div className={`${styles.pmFill} ${styles.pmFillGap}`} style={{ width: '25%' }} /></div>
                <span className={styles.pmBadge}>6 gaps</span>
              </div>
              <div className={styles.pmRow}>
                <span className={styles.pmLabel}>Travel</span>
                <div className={styles.pmTrack}><div className={styles.pmFill} style={{ width: '90%' }} /></div>
              </div>
              <div className={styles.pmRow}>
                <span className={styles.pmLabel}>Play</span>
                <div className={styles.pmTrack}><div className={styles.pmFill} style={{ width: '60%' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Wishlist ── */}
      <section className={styles.feature}>
        <div className={styles.featureInner}>
          <div className={styles.featureCopy}>
            <span className={`${styles.featLabel} ${styles.featLabelPurple}`}>Share with family</span>
            <h2 className={styles.featureTitle}>Your registry is just<br />your gaps.</h2>
            <p className={styles.featureBody}>
              Sprigloop turns your Plan into a shareable wishlist. Family and friends
              see exactly what&rsquo;s missing — by size, by category — and can claim
              items without duplicating. No store account required.
            </p>
            <p className={styles.featureNote}>One link. Real gaps. No duplicate onesies.</p>
            <button className={styles.featureBtn} onClick={handleWishlistCta} disabled={starting}>
              {starting ? 'Starting…' : 'Try Sprigloop free'}
            </button>
          </div>
          <div className={styles.featureVisual}>
            {/* Wishlist card mock */}
            <div className={styles.wlMock} aria-hidden="true">
              <div className={styles.wlEye}>OLAH&rsquo;S WISHLIST</div>
              <div className={styles.wlTitle}>Baby Roo &middot; 0&ndash;3M</div>
              <div className={styles.wlMeta}>9 gaps &nbsp;&middot;&nbsp; updated today</div>
              <div className={styles.wlItems}>
                <div className={styles.wlRow}><span className={styles.wlItem}>Sleep sacks (4)</span><span className={styles.wlTag}>Sleep</span></div>
                <div className={styles.wlRow}><span className={styles.wlItem}>Bottle starter set</span><span className={styles.wlTag}>Feeding</span></div>
                <div className={styles.wlRow}><span className={styles.wlItem}>Swaddles (2)</span><span className={styles.wlTag}>Sleep</span></div>
                <div className={`${styles.wlRow} ${styles.wlRowLast}`}><span className={styles.wlItem}>+6 more items</span><span className={styles.wlTag}>Various</span></div>
              </div>
              <div className={styles.wlBtn}>Claim an item &rarr;</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Pass-along ── (flipped) */}
      <section className={styles.feature} ref={passAlongRef}>
        <div className={`${styles.featureInner} ${styles.featureFlip}`}>
          <div className={styles.featureCopy}>
            <span className={`${styles.featLabel} ${styles.featLabelGray}`}>Pass it on</span>
            <h2 className={styles.featureTitle}>When they outgrow it,<br />we take it from there.</h2>
            <p className={styles.featureBody}>
              Request a prepaid Sprigloop bag. Fill it when you&rsquo;re ready. We route
              it to another family, a friend, or a charity — your choice. Drop it in
              any mailbox. Done.
            </p>
            <p className={styles.featureNote}>No selling, no logistics, no coordinating with strangers. Sprigloop handles the handoff.</p>
          </div>
          <div className={styles.featureVisual}>
            {/* Pass-along destinations mock */}
            <div className={styles.paMock} aria-hidden="true">
              <div className={styles.paCard}>
                <div className={styles.paIcon} style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15c0-2.5 1.8-4 4-4s4 1.5 4 4M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className={styles.paCardTitle}>Another Sprigloop family</div>
                  <div className={styles.paCardBody}>We route the bag to a family who&rsquo;s ready for that size.</div>
                </div>
              </div>
              <div className={styles.paCard}>
                <div className={styles.paIcon} style={{ background: 'var(--purple-light)', color: 'var(--purple-dark)' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 16c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div className={styles.paCardTitle}>A friend or family member</div>
                  <div className={styles.paCardBody}>Write their address. Drop it in any mailbox.</div>
                </div>
              </div>
              <div className={`${styles.paCard} ${styles.paCardHighlight}`}>
                <div className={styles.paIcon} style={{ background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3l2 4 4 .5-3 3 .8 4.2L9 12.8 5.2 14.7 6 10.5 3 7.5 7 7l2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                </div>
                <div>
                  <div className={styles.paCardTitle}>A charity</div>
                  <div className={styles.paCardBody}>Local shelter, Goodwill, or org you already trust.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Final CTA ── */}
      <section className={styles.finalSection}>
        <div className={styles.finalCard}>
          <h2 className={styles.finalTitle}>Built for the whole journey.</h2>
          <p className={styles.finalSub}>
            From the first item you scan to the last bag you drop in a mailbox —
            Sprigloop is the one app that works through every size.
          </p>
          <button className={styles.finalBtn} onClick={handleFinalCta} disabled={starting}>
            {starting ? 'Starting…' : 'Try Sprigloop free'}
          </button>
          <div className={styles.finalNote}>Free for all families, always</div>
        </div>
      </section>
    </div>
  )
}
