import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import { GUIDES } from '../lib/guides'
import IvyBanner from '../components/IvyBanner'
import styles from './Landing.module.css'

// Landing page — Option B redesign (2026-06-03).
//
// Structure:
//   1. Hero — split layout: settled copy left, readiness widget right
//   2. Wishlist / registry — split with dark mock card
//   3. Countdown / age-aware — single countdown card
//   4. Pass-along hub — compact 3-card grid
//   5. Final CTA — dark card
//
// Removed from previous version: features 3-up, scan spotlight, opt-in,
// mission band. Content is tighter; wishlist angle is now prominent.

// Guides strip (section 5, below) shows whichever 5 guides were most
// recently updated, instead of a hardcoded list — so it never goes stale
// again the way the original hardcoded picks did (2026-07-07). GUIDES is a
// static import, so this only needs to be computed once at module load.
const FEATURED_GUIDES = [...GUIDES]
  .filter(g => g.lastmod)
  .sort((a, b) => new Date(b.lastmod) - new Date(a.lastmod))
  .slice(0, 5)

export default function Landing() {
  const navigate = useNavigate()
  const hubRef = useRef(null)
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
  function handleHubCta()      { startTrial('hub_cta') }
  function handleFinalCta()    { startTrial('final_cta') }

  function handleSeeHub() {
    track.ctaClicked('see_pass_along_hub')
    hubRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navTop}>
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
          <button
            className={styles.navLink}
            onClick={() => {
              track.ctaClicked('nav_guides')
              navigate('/guides')
            }}
          >
            Guides
          </button>
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>Log in</button>
        </div>
        <div className={styles.navLinks}>
          <button
            className={styles.findRegistryBtn}
            onClick={() => {
              track.ctaClicked('nav_find_registry')
              navigate('/find-registry')
            }}
          >
            Find a registry
          </button>
        </div>
      </nav>

      <IvyBanner />

      {/* ── 1. Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <div className={styles.eyebrow}>Free for all families</div>
            <h1 className={styles.headline}>Baby clothes,<br /><em>organized</em> and shared.</h1>
            <p className={styles.heroEnv}>Built for parents who&rsquo;d rather pass it on than throw it out.</p>
            <p className={styles.sub}>Sprigloop is a wardrobe app for baby clothes, with a built-in way to pass them on to another family once they&rsquo;re outgrown.</p>
            <div className={styles.heroBtns}>
              <button className={styles.heroCta} onClick={handleGetStarted} disabled={starting}>
                {starting ? 'Starting…' : 'Try Sprigloop free'}
              </button>
              <button className={styles.heroSecondaryCta} onClick={handleSeeHub}>
                See how pass-along works
              </button>
            </div>
            <a
              className={styles.appStoreLink}
              href="https://apps.apple.com/us/app/sprigloop-baby-wardrobe/id6772641313"
              target="_blank"
              rel="noopener noreferrer"
            >
              Also on the App Store →
            </a>
          </div>

          {/* Readiness widget — static mockup illustrating the Plan feature */}
          <div className={styles.readinessWidget} aria-hidden="true">
            <div className={styles.rwHeader}>OVERALL READINESS</div>
            <div className={styles.rwPct}>62%</div>
            <div className={styles.rwSub}>0–3M &nbsp;·&nbsp; 14 gaps flagged</div>
            <div className={styles.rwRow}>
              <span className={styles.rwLabel}>Clothing</span>
              <div className={styles.rwTrack}><div className={styles.rwFill} style={{ width: '80%' }} /></div>
            </div>
            <div className={styles.rwRow}>
              <span className={styles.rwLabel}>Sleep</span>
              <div className={styles.rwTrack}><div className={`${styles.rwFill} ${styles.rwFillLow}`} style={{ width: '45%' }} /></div>
            </div>
            <div className={styles.rwRow}>
              <span className={styles.rwLabel}>Feeding</span>
              <div className={styles.rwTrack}><div className={`${styles.rwFill} ${styles.rwFillLow}`} style={{ width: '30%' }} /></div>
            </div>
            <div className={styles.rwRow}>
              <span className={styles.rwLabel}>Travel</span>
              <div className={styles.rwTrack}><div className={styles.rwFill} style={{ width: '90%' }} /></div>
            </div>
            <div className={`${styles.rwRow} ${styles.rwRowLast}`}>
              <span className={styles.rwLabel}>Play</span>
              <div className={styles.rwTrack}><div className={styles.rwFill} style={{ width: '60%' }} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Wishlist / registry ── */}
      <section className={styles.wishlist}>
        <div className={styles.wishlistInner}>
          <div className={styles.wishlistText}>
            <div className={styles.eyebrowAmber}>Shareable wishlist</div>
            <h2 className={styles.sectionTitle}>Your registry, minus the guesswork.</h2>
            <p className={styles.sectionSub}>
              Instead of a list of things you might want, Sprigloop shows exactly what you&rsquo;re
              missing — by category, by size, by when you&rsquo;ll need it. Share the link. Family
              picks from real gaps.
            </p>
            <ul className={styles.wishlistBullets}>
              <li>No duplicate gifts</li>
              <li>No generic suggestions</li>
              <li>No registry account at a store you don&rsquo;t use</li>
            </ul>
            <button className={styles.sectionBtn} onClick={handleWishlistCta} disabled={starting}>
              {starting ? 'Starting…' : 'Try Sprigloop free'}
            </button>
            <p className={styles.findRegistryHint}>
              Looking for someone&rsquo;s registry?{' '}
              <button
                className={styles.findRegistryHintLink}
                onClick={() => {
                  track.ctaClicked('wishlist_section_find_registry')
                  navigate('/find-registry')
                }}
              >
                Find it here →
              </button>
            </p>
          </div>

          {/* Mock wishlist card */}
          <div className={styles.wishlistCard} aria-hidden="true">
            <div className={styles.wcEyebrow}>OLAH&rsquo;S WISHLIST</div>
            <div className={styles.wcTitle}>Baby Roo &mdash; 0&ndash;3M</div>
            <div className={styles.wcSub}>9 gaps &nbsp;·&nbsp; updated today</div>
            <div className={styles.wcItems}>
              <div className={styles.wcItem}>
                <span className={styles.wcName}>Sleep sacks (4)</span>
                <span className={styles.wcBadge}>Sleep</span>
              </div>
              <div className={styles.wcItem}>
                <span className={styles.wcName}>Bottle starter set</span>
                <span className={styles.wcBadge}>Feeding</span>
              </div>
              <div className={styles.wcItem}>
                <span className={styles.wcName}>Swaddles</span>
                <span className={styles.wcBadge}>Sleep</span>
              </div>
              <div className={`${styles.wcItem} ${styles.wcItemLast}`}>
                <span className={styles.wcName}>+6 more items</span>
                <span className={styles.wcBadge}>Various</span>
              </div>
            </div>
            <button className={styles.wcBtn} onClick={handleWishlistCta} disabled={starting}>
              {starting ? 'Starting…' : 'Claim an item'}
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. Countdown / age-aware ── */}
      <section className={styles.countdown}>
        <div className={styles.countdownInner}>
          <div className={styles.eyebrow}>Age-aware</div>
          <h2 className={styles.sectionTitle}>Gaps show up before they matter.</h2>
          <p className={styles.sectionSub}>
            Sprigloop tracks your baby&rsquo;s age and flags when the next size window is
            approaching. No scrambling when they suddenly outgrow the 0&ndash;3M pile.
          </p>
          <div className={styles.countdownCard}>
            <div className={styles.ccLeft}>
              <div className={styles.ccNum}>23</div>
              <div className={styles.ccUnit}>days until 3&ndash;6M</div>
            </div>
            <div className={styles.ccDivider} />
            <div className={styles.ccText}>
              Sprigloop flags your 3&ndash;6M gaps now, while there&rsquo;s still time to fill
              them from your wishlist or another Sprigloop family.
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Pass-along hub ── */}
      <section className={styles.hub} ref={hubRef}>
        <div className={styles.hubInner}>
          <div className={styles.eyebrowAmber}>Pass it on</div>
          <h2 className={styles.sectionTitle}>When they outgrow it, we take it from there.</h2>
          <p className={styles.sectionSub}>
            Request a bag. Fill it when you&rsquo;re ready. Sprigloop sends it where it does the most good.
          </p>
          <div className={styles.hubGrid}>
            <div className={styles.hubCard}>
              <div className={styles.hubIcon} style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15c0-2.5 1.8-4 4-4s4 1.5 4 4M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>Another Sprigloop family</div>
              <div className={styles.hubCardBody}>Outgrown by you, needed by someone else. The cycle keeps going.</div>
            </div>
            <div className={styles.hubCard}>
              <div className={styles.hubIcon} style={{ background: 'var(--purple-light)', color: 'var(--purple-dark)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 16c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>A friend or family member</div>
              <div className={styles.hubCardBody}>Fill a Sprigloop bag, write their address on it, drop it in any mailbox.</div>
            </div>
            <div className={styles.hubCard}>
              <div className={styles.hubIcon} style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3l2 4 4 .5-3 3 .8 4.2L9 12.8 5.2 14.7 6 10.5 3 7.5 7 7l2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>A charity</div>
              <div className={styles.hubCardBody}>Write the charity&rsquo;s address on the prepaid Sprigloop bag. Drop it in any mailbox.</div>
            </div>
          </div>
          <button className={styles.hubCta} onClick={handleHubCta} disabled={starting}>
            {starting ? 'Starting…' : 'Try Sprigloop free'}
          </button>
        </div>
      </section>

      {/* ── 5. New parent guides ── */}
      <section className={styles.guidesStrip}>
        <div className={styles.guidesStripInner}>
          <div className={styles.eyebrow}>Free guides</div>
          <h2 className={styles.guidesStripTitle}>New parent guides from Sprigloop</h2>
          <div className={styles.guidesStripGrid}>
            {FEATURED_GUIDES.map(guide => (
              <button
                key={guide.slug}
                className={styles.guidesPill}
                onClick={() => navigate(`/guides/${guide.slug}`)}
              >
                {guide.title}
              </button>
            ))}
            <button className={styles.guidesPillMore} onClick={() => navigate('/guides')}>
              All guides &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. Final CTA — dark card ── */}
      <section className={styles.finalSection}>
        <div className={styles.finalCard}>
          <h2 className={styles.finalTitle}>Start before baby arrives.</h2>
          <p className={styles.finalSub}>Use it through every size. Pass it on when you&rsquo;re done.</p>
          <button className={styles.finalBtn} onClick={handleFinalCta} disabled={starting}>
            {starting ? 'Starting…' : 'Try Sprigloop free'}
          </button>
          <div className={styles.finalNote}>No account needed to start</div>
        </div>
      </section>
    </div>
  )
}
