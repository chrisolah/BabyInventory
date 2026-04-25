import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import IvyDecoration from '../components/IvyDecoration'
import IvyBanner from '../components/IvyBanner'
import styles from './Landing.module.css'

// Landing page — aligned with V1.9 addendum (2026-04-23).
//
// Framing shift vs. the pre-V1.9 copy:
//   • The exchange is no longer pitched as a peer-to-peer, zip-code-matched
//     marketplace. It's pitched as a four-destination pass-along hub with
//     Sprig as the concierge in the middle — the user never has to
//     coordinate with another parent directly.
//   • Receiver opt-in gets its own section, with non-stigmatizing framing
//     ("Open to receiving hand-me-downs" / "Another Sprig family").
//     See feedback_pass_along_framing.md — we never say "families in need."
//   • How-it-works is reshaped so the "send it on" step references the four
//     destinations, not a nearby-family match.
//
// Preserved from the previous landing: Ivy decoration components, the free-
// for-all-families eyebrow, the features 3-up, and the quiet photo-scan
// mention above the final CTA.

export default function Landing() {
  const navigate = useNavigate()
  const hubRef = useRef(null)

  useEffect(() => {
    track.pageViewed({ page: 'landing', referrer: document.referrer })
  }, [])

  function handleGetStarted() {
    track.ctaClicked('get_started')
    navigate('/signup')
  }

  function handleSeeHub() {
    // Secondary hero CTA — scrolls to the pass-along hub section instead of
    // bouncing the user straight to signup. Curious parents browse; committed
    // ones click Get started.
    track.ctaClicked('see_pass_along_hub')
    hubRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleJoinCommunity() {
    track.ctaClicked('join_community')
    navigate('/signup')
  }

  function handleCreateAccount() {
    track.ctaClicked('create_account_footer')
    navigate('/signup')
  }

  return (
    <div className={styles.page}>
      {/* Decorative ivy in the left gutter. Fixed-position, pointer-events:none,
          hides itself below 960px viewport — can't affect layout. */}
      <IvyDecoration />
      <nav className={styles.nav}>
        <div className={styles.logo}>sprig</div>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>Log in</button>
      </nav>

      {/* Horizontal vine between the nav and the hero — mobile only.
          IvyBanner's own CSS hides itself ≥ 960px (where IvyDecoration
          handles the gutter). */}
      <IvyBanner />

      <section className={styles.hero}>
        <div className={styles.eyebrow}>Free for all families</div>
        <h1 className={styles.headline}>Baby clothes,<br /><em>organized</em> and shared.</h1>
        {/* Env hook above the fold. Sits between H1 and sub so the
            sustainability angle is visible before scroll. Names the audience
            ("parents who'd rather...") so it doubles as a self-selection
            line, and pairs anti-waste with pass-along in one breath. */}
        <p className={styles.heroEnv}>Built for parents who&rsquo;d rather pass it on than throw it out.</p>
        <p className={styles.sub}>Track every onesie, plan every size, and send outgrown clothes on to Sprig, another family, a friend or family member, or a charity — all from the same app.</p>
        <div className={styles.heroBtns}>
          <button className={styles.heroCta} onClick={handleGetStarted}>Get started free</button>
          <button className={styles.heroSecondaryCta} onClick={handleSeeHub}>See how pass-along works</button>
        </div>
      </section>

      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything in one place</h2>
        <p className={styles.sectionSub}>Whether you&rsquo;re expecting or already knee-deep in laundry.</p>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--purple-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="#534AB7"/><rect x="9" y="2" width="5" height="5" rx="1" fill="#534AB7"/><rect x="2" y="9" width="5" height="5" rx="1" fill="#534AB7"/><rect x="9" y="9" width="5" height="5" rx="1" fill="#AFA9EC"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Catalog what you own</div>
            <div className={styles.featureCardBody}>Log items by size, category, and season. Never wonder what you have again.</div>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--teal-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Plan ahead by size</div>
            <div className={styles.featureCardBody}>Know which sizes are coming up and what you still need before you need it.</div>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--amber-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" fill="#EF9F27"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Share with your family</div>
            <div className={styles.featureCardBody}>Invite co-parents and grandparents. Everyone stays in sync on one wardrobe.</div>
          </div>
        </div>
      </section>

      {/* ── Photo-scan spotlight ────────────────────────────────────────────
          Promoted from the old quiet `.scanNote` near the bottom. Sits
          between Features and How because by this point a reader knows
          what the app does and is ready to feel "this is fast." Mockup is
          pure inline SVG/CSS (phone frame, viewfinder corners, tag, three
          floating field chips) — no image asset, no library. Names
          "Scan many" explicitly so users see the batch affordance before
          they even sign up. */}
      <section className={styles.scanFeature}>
        <div className={styles.scanFeatureWrap}>
          <div className={styles.scanFeatureCopy}>
            <div className={styles.scanFeatureEyebrow}>Built for the laundry pile</div>
            <h2 className={styles.scanFeatureHeadline}>Snap a tag.<br />Skip the typing.</h2>
            <p className={styles.scanFeatureBody}>
              Point your phone at a clothing tag &mdash; Sprig reads the
              brand, size, and category in seconds. Got a stack? Tap{' '}
              <strong>Scan many</strong> and knock out the whole basket
              without putting it down.
            </p>
            <ul className={styles.scanFeatureBullets}>
              <li>Works on most baby-clothing brands and care labels.</li>
              <li>Edit anything before you save &mdash; we&rsquo;re a head start, not the final word.</li>
              <li>Your photos stay on your phone. Only the extracted text is used.</li>
            </ul>
          </div>
          <div className={styles.scanFeatureMock} aria-hidden="true">
            <div className={styles.phoneFrame}>
              <div className={styles.phoneNotch} />
              <div className={styles.phoneScreen}>
                <span className={`${styles.vfCorner} ${styles.vfTl}`} />
                <span className={`${styles.vfCorner} ${styles.vfTr}`} />
                <span className={`${styles.vfCorner} ${styles.vfBl}`} />
                <span className={`${styles.vfCorner} ${styles.vfBr}`} />
                <div className={styles.mockTag}>
                  <div className={styles.mockTagBrand}>carter&rsquo;s</div>
                  <div className={styles.mockTagSize}>6&ndash;9M</div>
                  <div className={styles.mockTagCare}>100% cotton &middot; machine wash</div>
                </div>
                <div className={styles.mockHint}>Got it&hellip;</div>
              </div>
            </div>
            <div className={`${styles.fieldChip} ${styles.chipBrand}`}>
              <span className={styles.chipLabel}>Brand</span>
              <span className={styles.chipValue}>Carter&rsquo;s</span>
            </div>
            <div className={`${styles.fieldChip} ${styles.chipSize}`}>
              <span className={styles.chipLabel}>Size</span>
              <span className={styles.chipValue}>6&ndash;9M</span>
            </div>
            <div className={`${styles.fieldChip} ${styles.chipCat}`}>
              <span className={styles.chipLabel}>Category</span>
              <span className={styles.chipValue}>One-pieces</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pass-along hub — the V1.9 centerpiece ───────────────────────────
          Four destinations, one flow, Sprig as the concierge in the
          middle. This replaces the old zip-code-matching "family nearby
          claims it" section. Per the addendum: senders and receivers never
          have to coordinate with each other — they only coordinate with us. */}
      <section className={styles.hub} ref={hubRef}>
        <div className={styles.hubBand}>
          <div className={styles.hubEyebrow}>When baby outgrows them</div>
          <h2 className={styles.hubHeadline}>Four places your outgrown<br />clothes can go.</h2>
          <p className={styles.hubBody}>Pick a destination and Sprig takes it from there. No selling, no drop-off logistics, no swapping addresses with strangers. Every batch is one less bag in the landfill &mdash; and one less new garment manufactured to take its place.</p>
          <div className={styles.hubGrid}>
            <div className={styles.hubCard}>
              <div className={styles.hubCardIcon} style={{ background: 'var(--teal-light)', color: 'var(--teal-dark)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 6l6-3 6 3v6l-6 3-6-3V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M3 6l6 3 6-3M9 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>Sprig</div>
              <div className={styles.hubCardBody}>Send your box to us. We inspect, match it to a family, or donate on your behalf.</div>
            </div>
            <div className={styles.hubCard}>
              <div className={styles.hubCardIcon} style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M2 15c0-2.5 1.8-4 4-4s4 1.5 4 4M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>Another Sprig family</div>
              <div className={styles.hubCardBody}>Happy to help another parent? We&rsquo;ll route it to a family who&rsquo;s opted in to receiving. Addresses stay private on both ends.</div>
            </div>
            <div className={styles.hubCard}>
              <div className={styles.hubCardIcon} style={{ background: 'var(--purple-light)', color: 'var(--purple-dark)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 16c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>A friend or family member</div>
              <div className={styles.hubCardBody}>Sister-in-law, best friend, coworker with a new baby. Give us a name and address — we&rsquo;ll generate the label and track the handoff.</div>
            </div>
            <div className={styles.hubCard}>
              <div className={styles.hubCardIcon} style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3l2 4 4 .5-3 3 .8 4.2L9 12.8 5.2 14.7 6 10.5 3 7.5 7 7l2-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              </div>
              <div className={styles.hubCardTitle}>A charity</div>
              <div className={styles.hubCardBody}>Local Goodwill, shelter, or nonprofit you already trust. Same label flow — we just ship where you tell us.</div>
            </div>
          </div>
          <button className={styles.hubCta} onClick={handleGetStarted}>Start a pass-along batch</button>
        </div>
      </section>

      {/* ── Receiver opt-in — neutral framing, no "in need" language ────────
          Per feedback_pass_along_framing: "Open to receiving hand-me-downs"
          is the canonical label. Never "families in need" anywhere. */}
      <section className={styles.optIn}>
        <div className={styles.optInEyebrow}>Open to receiving?</div>
        <h2 className={styles.optInHeadline}>Flip a switch in your profile.<br />Get a box when one&rsquo;s headed your way.</h2>
        <p className={styles.optInBody}>Any Sprig household can opt in to receiving hand-me-downs. Pick sizes, pick genders, pause whenever. No applications, no listings to browse — we match you to a sender when the fit is right, and mail it.</p>
        <div className={styles.optInRow}>
          <div className={styles.optInBullet}>
            <div className={styles.optInBulletNum}>01</div>
            <div className={styles.optInBulletText}><strong>Opt in once.</strong> A toggle in your profile. Set preferences, pause anytime.</div>
          </div>
          <div className={styles.optInBullet}>
            <div className={styles.optInBulletNum}>02</div>
            <div className={styles.optInBulletText}><strong>We do the matching.</strong> When a sender picks &ldquo;Another Sprig family,&rdquo; we route the box to one of you.</div>
          </div>
          <div className={styles.optInBullet}>
            <div className={styles.optInBulletNum}>03</div>
            <div className={styles.optInBulletText}><strong>It shows up.</strong> You get clothes your little one can actually use &mdash; no forms, no receipts, no follow-ups. And one less wardrobe ordered new.</div>
          </div>
        </div>
      </section>

      <section className={styles.mission}>
        <div className={styles.missionBand}>
          <div className={styles.missionHeadline}>Every baby deserves a full wardrobe. Every parent deserves an easier week.</div>
          <p className={styles.missionBody}>Babies outgrow clothes in weeks &mdash; most still have years of life left. Sprig keeps them moving: out of your house, into another baby&rsquo;s drawer, never into landfill. With as little friction for you as possible.</p>
          <button className={styles.missionCta} onClick={handleJoinCommunity}>Join Sprig</button>
          <div className={styles.statRow}>
            <div><div className={styles.statNum}>Four</div><div className={styles.statLabel}>Destinations per batch</div></div>
            <div><div className={styles.statNum}>Free</div><div className={styles.statLabel}>Always, for all families</div></div>
            <div><div className={styles.statNum}>Opt-in</div><div className={styles.statLabel}>Receive when you&rsquo;re ready</div></div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalHeadline}>Ready to get started?</div>
        <p className={styles.finalSub}>Organize your wardrobe, plan for what&rsquo;s next, and send outgrown clothes somewhere they&rsquo;ll be loved next, not landfilled. Free for every family. Always.</p>
        <button className={styles.finalCtaBtn} onClick={handleCreateAccount}>Create your account</button>
      </section>
    </div>
  )
}
