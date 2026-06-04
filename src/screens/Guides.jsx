import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import { GUIDES } from '../lib/guides'
import IvyBanner from '../components/IvyBanner'
import styles from './Guides.module.css'

const PREP_SLUGS = [
  'how-much-does-a-newborn-need',
  'when-does-baby-outgrow-each-size',
  'baby-registry-what-you-actually-need',
  'how-to-organize-baby-clothes-by-size',
  'what-to-do-with-outgrown-baby-clothes',
  'certified-vs-generic-baby-products',
  'baby-clothing-guide',
]

const CATEGORY_SLUGS = [
  'newborn-safe-sleep-setup',
  'bottle-feeding-newborn-what-you-need',
  'cloth-vs-disposable-diapers',
  'choosing-a-car-seat',
  'baby-toys-first-year-by-age',
  'newborn-health-kit-what-to-have',
  'how-to-bathe-a-newborn',
]

const guidesBySlug = Object.fromEntries(GUIDES.map(g => [g.slug, g]))

const prepGuides      = PREP_SLUGS.map(s => guidesBySlug[s]).filter(Boolean)
const categoryGuides  = CATEGORY_SLUGS.map(s => guidesBySlug[s]).filter(Boolean)

function GuideCard({ guide, onClick }) {
  return (
    <button className={styles.card} onClick={onClick}>
      <div className={styles.cardTags}>
        {guide.tags.map(t => (
          <span key={t} className={styles.tag}>{t}</span>
        ))}
      </div>
      <h2 className={styles.cardTitle}>{guide.title}</h2>
      <p className={styles.cardDesc}>{guide.description}</p>
      <div className={styles.cardMeta}>{guide.readTime} read &nbsp;&middot;&nbsp; {guide.date}</div>
    </button>
  )
}

export default function Guides() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    track.pageViewed({ page: 'guides', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDesc = descMeta?.getAttribute('content')

    document.title = 'Baby Prep Guides — Sprigloop'
    descMeta?.setAttribute('content', 'Research-backed guides to help you prepare for your baby — how much to buy, what to skip, and how to plan ahead by size and category.')

    return () => {
      document.title = prevTitle
      if (prevDesc != null) descMeta?.setAttribute('content', prevDesc)
    }
  }, [])

  function goTo(slug) {
    navigate(`/guides/${slug}`)
  }

  return (
    <div className={styles.page}>
      {!user && (
        <>
          <nav className={styles.nav}>
            <button className={styles.logo} onClick={() => navigate('/')} aria-label="Sprigloop home">
              sprigloop
            </button>
            <button className={styles.navLink} onClick={() => navigate('/how-it-works')}>How it works</button>
            <button className={`${styles.navLink} ${styles.navLinkActive}`} onClick={() => navigate('/guides')}>Guides</button>
            <button className={styles.signupBtn} onClick={() => navigate('/signup')}>Join</button>
            <button className={styles.loginBtn} onClick={() => navigate('/login')}>Log in</button>
          </nav>
          <IvyBanner />
        </>
      )}

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Resources</div>
          <h1 className={styles.h1}>Baby prep <em>guides</em>.</h1>
          <p className={styles.lede}>
            Research-backed articles to help you figure out what you actually need —
            how much to buy, what to skip, and how to plan ahead before each size arrives.
          </p>
          <p className={styles.aiNote}>
            These guides are researched and written with AI assistance, drawing from
            pediatric sources, consumer research, and guidance from organizations
            including the American Academy of Pediatrics. Sources are linked in each article.
          </p>
        </header>

        {/* Group 1 — Prep & Planning */}
        <div className={styles.groupLabel}>Prep &amp; Planning</div>
        <section className={styles.grid}>
          {prepGuides.map(guide => (
            <GuideCard key={guide.slug} guide={guide} onClick={() => goTo(guide.slug)} />
          ))}
        </section>

        {/* Group 2 — By Category */}
        <div className={styles.groupLabel} style={{ marginTop: '2.5rem' }}>By Category</div>
        <section className={styles.categoryGrid}>
          {categoryGuides.map(guide => (
            <GuideCard key={guide.slug} guide={guide} onClick={() => goTo(guide.slug)} />
          ))}
        </section>
      </article>
    </div>
  )
}
