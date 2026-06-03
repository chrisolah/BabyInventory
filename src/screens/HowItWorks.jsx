import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import styles from './HowItWorks.module.css'

// IvyDecoration is mounted by LandingLayout (the parent route element),
// not here. That keeps the desktop ivy persistent across navigation
// between Landing and HowItWorks. IvyBanner stays inline because it
// sits between the nav and hero, which a parent layout can't position.

// Public SEO page — long-tail keyword targets:
//   "baby clothes inventory app" / "track baby clothes by size" /
//   "organize baby clothes by size" / "where to send outgrown baby clothes" /
//   "donate outgrown baby clothes" / "how to pass on baby clothes"
//
// Decisions:
// - Stays on "baby clothes" vocabulary; does NOT introduce "kids clothes"
//   (audience is 0-3, see project_seo_keyword_targeting.md).
// - Pass-along framing follows feedback_pass_along_framing.md — never
//   "families in need" / "hand-me-downs".
// - Voice follows feedback_landing_copy_voice.md — no em dashes,
//   no AI-rhythm tells.
// - JSON-LD: HowTo + FAQPage schemas injected via <script type="application/ld+json">.
// - Page-specific <title> and meta description set on mount, restored on unmount,
//   so SPA navigation surfaces the right tags to crawlers that re-render.

export default function HowItWorks() {
  const navigate = useNavigate()
  const { signInAnonymously } = useAuth()
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    track.pageViewed({ page: 'how_it_works', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDescription = descMeta?.getAttribute('content')

    document.title = 'How Sprigloop works: track baby clothes and pass on what they outgrow'
    descMeta?.setAttribute(
      'content',
      'How Sprigloop works: a free baby clothes inventory app that tracks every item by size and helps you pass outgrown clothes on to another Sprigloop family.',
    )

    return () => {
      document.title = prevTitle
      if (prevDescription !== undefined && prevDescription !== null) {
        descMeta?.setAttribute('content', prevDescription)
      }
    }
  }, [])

  async function handleStart(ctaName) {
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

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button
          className={styles.logo}
          onClick={() => navigate('/')}
          aria-label="Back to Sprigloop home"
        >
          sprigloop
        </button>
        <button className={styles.navLink} onClick={() => navigate('/how-it-works')}>How it works</button>
        <button className={styles.navLink} onClick={() => navigate('/guides')}>Guides</button>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      {/* Mobile-only horizontal vine matching Landing. Hides itself ≥ 960px. */}
      <IvyBanner />

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Free for all families</div>
          <h1 className={styles.h1}>How Sprigloop <em>works</em>.</h1>
          <p className={styles.lede}>
            Sprigloop helps you track what your baby has, plan what&rsquo;s coming,
            share a wishlist with family, and pass on what they outgrow. Here&rsquo;s
            how each step works.
          </p>
        </header>

        <section className={styles.step}>
          <div className={styles.stepNum}>01</div>
          <h2 className={styles.h2}>Add everything your baby has</h2>
          <p>
            Point your phone at any tag or label and Sprigloop pulls out the brand, size,
            and category for you. Clothing, gear, feeding equipment — if it has a tag,
            you can scan it. Or type the details in by hand for anything that doesn&rsquo;t.
          </p>
          <p>
            You can build the whole list in one evening or chip away at it one item at a time.
            The photo-scan flow lets you stack scans before reviewing, so seeding a full
            pile of 40 items takes about five minutes.
          </p>
        </section>

        <section className={styles.step}>
          <div className={styles.stepNum}>02</div>
          <h2 className={styles.h2}>Plan ahead and share your wishlist</h2>
          <p>
            The Plan tab tracks your baby&rsquo;s age across 8 categories — clothing, sleep,
            feeding, travel, play, and more — and flags gaps before the next size window
            arrives. You&rsquo;ll see a countdown to the next size and exactly what&rsquo;s
            missing, so there&rsquo;s no last-minute scramble when they suddenly outgrow
            the 0&ndash;3M pile.
          </p>
          <p>
            From your Plan, you can generate a shareable wishlist in one tap. Family and
            friends get a link that shows real gaps — by category, by size — and can claim
            items without duplicating. No store account, no generic registry suggestions,
            no duplicate onesies. If more than one parent or caregiver uses the app,
            household sharing keeps everyone on the same page automatically.
          </p>
        </section>

        <section className={styles.step}>
          <div className={styles.stepNum}>03</div>
          <h2 className={styles.h2}>Pass on what they outgrow</h2>
          <p>
            When clothes don&rsquo;t fit anymore, Sprigloop sends you a prepaid bag. You
            fill it with the outgrown items, write a name on the bag, and drop it in any
            mailbox. Sprigloop handles the rest.
          </p>
          <p>
            The bag goes to one of three places, depending on what you choose: a friend
            you&rsquo;ve named, a family who&rsquo;s opted in to receive, or a donation
            partner. The clothes leave your house and find their next life. Your closet
            stays light.
          </p>
        </section>

        <section className={styles.destinations}>
          <div className={styles.destinationsBand}>
            <div className={styles.destinationsEyebrow}>Three destinations per bag</div>
            <h2 className={styles.destinationsHeadline}>
              Where outgrown baby clothes can go.
            </h2>
            <div className={styles.destinationsGrid}>
              <div className={styles.destinationCard}>
                <div
                  className={styles.destinationIcon}
                  style={{ background: 'var(--purple-light)', color: 'var(--purple-dark)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M3 16c0-3 2.7-5 6-5s6 2 6 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className={styles.destinationTitle}>Send to a friend</div>
                <div className={styles.destinationBody}>
                  Name a friend when you start your bag. Sprigloop ships the bag to you,
                  you write their address on it, and we route it to them. They get baby
                  clothes that have already proven themselves.
                </div>
              </div>

              <div className={styles.destinationCard}>
                <div
                  className={styles.destinationIcon}
                  style={{ background: 'var(--amber-light)', color: 'var(--amber-dark)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M2 15c0-2.5 1.8-4 4-4s4 1.5 4 4M8 15c0-2.5 1.8-4 4-4s4 1.5 4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className={styles.destinationTitle}>Send to a Sprigloop family</div>
                <div className={styles.destinationBody}>
                  Other Sprigloop households opt in to receive. We match a bag to them
                  when the fit is right. No listings, no applications, no awkward asks.
                </div>
              </div>

              <div className={styles.destinationCard}>
                <div
                  className={styles.destinationIcon}
                  style={{ background: 'var(--gray-100)', color: 'var(--gray-600)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M9 3l2 4 4 .5-3 3 .8 4.2L9 12.8 5.2 14.7 6 10.5 3 7.5 7 7l2-4z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className={styles.destinationTitle}>Donate outgrown baby clothes</div>
                <div className={styles.destinationBody}>
                  If a Sprigloop family isn&rsquo;t a match, your bag goes to a donation
                  partner. You can also pick this destination directly when you start the
                  bag.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.faq}>
          <h2 className={styles.h2}>Common questions</h2>

          <details className={styles.faqItem}>
            <summary>Is Sprigloop free to use?</summary>
            <p>
              Yes. Sprigloop is free for every family, with no paid tier. The pass-along
              bags are free too; you don&rsquo;t pay for shipping.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>How does Sprigloop track baby clothes by size?</summary>
            <p>
              Every item you add gets tagged with its size and age range. Sprigloop groups
              items into size buckets automatically (newborn, 0-3 months, 3-6 months, and
              so on through toddler) and lets you filter or browse by size at any time.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>Where can I send baby clothes my baby has outgrown?</summary>
            <p>
              Sprigloop gives you three places: a friend you name, a Sprigloop household
              that&rsquo;s opted in to receive, or a donation partner. You pick when you
              start the bag.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>Can I donate outgrown baby clothes through Sprigloop?</summary>
            <p>
              Yes. You can choose donation as the destination directly, or it&rsquo;s the
              fallback when no opted-in Sprigloop family is the right match for your bag.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>Can I share a wishlist with family?</summary>
            <p>
              Yes. From the Plan tab, you can generate a shareable link that shows your
              real gaps by category and size. Anyone with the link can see what&rsquo;s
              needed and claim items. No store account required on their end.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>Do I have to photograph every item?</summary>
            <p>
              No. The photo-scan flow speeds things up, but you can also type items in by
              hand. Most parents do a mix.
            </p>
          </details>

          <details className={styles.faqItem}>
            <summary>What ages does Sprigloop cover?</summary>
            <p>
              The size-matching features are built around the 0-24 month bands today.
              You can still track items in older sizes; they&rsquo;ll just sit outside
              the automatic age-band sorting. Expanding the supported sizes is on our
              roadmap as we add new features.
            </p>
          </details>
        </section>

        <section className={styles.finalCta}>
          <h2 className={styles.h2}>Start your inventory today.</h2>
          <p>Free for every family. No app to install. Sprigloop runs in your browser.</p>
          <button
            className={styles.ctaBtn}
            onClick={() => handleStart('how_it_works_final_cta')}
            disabled={starting}
          >
            {starting ? 'Starting…' : 'Try Sprigloop free'}
          </button>
        </section>
      </article>

      {/* Structured data: HowTo for the steps + FAQPage for the Q&A.
          Both are read by Google during indexing. HowTo rich results
          render on desktop; FAQPage is no longer surfaced as a rich
          result for non-government/non-medical sites but is still used
          for content understanding. Cost of including: zero. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: 'How Sprigloop works',
            description:
              'Track what your baby has, plan what is coming, share a wishlist with family, and pass on what they outgrow.',
            step: [
              {
                '@type': 'HowToStep',
                name: 'Add everything your baby has',
                text: 'Point your phone at any tag or label — clothing, gear, feeding equipment — and Sprigloop extracts the brand, size, and category. Or type the details in by hand.',
              },
              {
                '@type': 'HowToStep',
                name: 'Plan ahead and share your wishlist',
                text: 'The Plan tab tracks gaps across 8 categories and flags what is missing before the next size window hits. Share a wishlist link so family can claim real gaps without duplicating.',
              },
              {
                '@type': 'HowToStep',
                name: 'Pass on what they outgrow',
                text: 'Sprigloop ships you a prepaid bag. You fill it with outgrown clothes and drop it in any mailbox. The bag is routed to a friend, a Sprigloop family, or a donation partner.',
              },
            ],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Is Sprigloop free to use?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Sprigloop is free for every family, with no paid tier. The pass-along bags are free too.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does Sprigloop track baby clothes by size?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Every item gets tagged with its size and age range. Sprigloop groups items into size buckets (newborn, 0-3 months, 3-6 months, and so on through toddler).',
                },
              },
              {
                '@type': 'Question',
                name: 'Where can I send baby clothes my baby has outgrown?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Sprigloop offers three destinations: a friend you name, a Sprigloop household that has opted in to receive, or a donation partner.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I donate outgrown baby clothes through Sprigloop?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. You can choose donation as the destination directly, or it is the fallback if no opted-in Sprigloop family is a match.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I share a wishlist with family?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. From the Plan tab you can generate a shareable link that shows your real gaps by category and size. Anyone with the link can claim items without a store account.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do I have to photograph every item?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'No. The photo-scan flow speeds things up, but you can type items in by hand.',
                },
              },
              {
                '@type': 'Question',
                name: 'What ages does Sprigloop cover?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'The size-matching features are built around the 0-24 month bands today. You can still track items in older sizes; they will sit outside the automatic age-band sorting. Expanding the supported sizes is on our roadmap as we add new features.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  )
}
