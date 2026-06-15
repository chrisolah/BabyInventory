import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import { GUIDES } from '../lib/guides'
import IvyBanner from '../components/IvyBanner'
import styles from './Guides.module.css'

const TABS = [
  { label: 'All',        tag: null },
  { label: 'How-tos',   tag: 'How To' },
  { label: 'Planning',  tag: 'Planning' },
  { label: 'Sleep',     tag: 'Sleep' },
  { label: 'Feeding',   tag: 'Feeding' },
  { label: 'Gear',      tag: 'Gear' },
  { label: 'Clothing',  tag: 'Clothing' },
  { label: 'Diapering', tag: 'Diapering' },
]

const TYPE_CLASS = {
  'How to':      styles.typeHowTo,
  'Checklist':   styles.typeChecklist,
  'Buying guide': styles.typeBuyingGuide,
}

function guideType(guide) {
  if (guide.tags.includes('How To')) return 'How to'
  if (guide.tags.includes('Checklist')) return 'Checklist'
  return 'Buying guide'
}

function GuideCard({ guide, onClick }) {
  const type = guideType(guide)
  return (
    <button className={styles.card} onClick={onClick}>
      <span className={`${styles.typePill} ${TYPE_CLASS[type]}`}>{type}</span>
      <h2 className={styles.cardTitle}>{guide.title}</h2>
      <p className={styles.cardDesc}>{guide.description}</p>
      <div className={styles.cardMeta}>{guide.readTime} read &nbsp;&middot;&nbsp; {guide.date}</div>
    </button>
  )
}

export default function Guides() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(null)
  const [query, setQuery] = useState('')

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

  const filtered = useMemo(() => {
    let list = GUIDES
    if (activeTab) {
      list = list.filter(g => g.tags.includes(activeTab))
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(g =>
        g.title.toLowerCase().includes(q) ||
        (g.subtitle || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [activeTab, query])

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

        {/* Search */}
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search guides…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className={styles.tabRow}>
          {TABS.map(t => (
            <button
              key={t.label}
              className={`${styles.tab} ${activeTab === t.tag ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.tag)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Count */}
        <div className={styles.countLabel}>
          {filtered.length} {filtered.length === 1 ? 'guide' : 'guides'}
        </div>

        {/* Guide grid */}
        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map(guide => (
              <GuideCard
                key={guide.slug}
                guide={guide}
                onClick={() => navigate(`/guides/${guide.slug}`)}
              />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No guides match your search.</p>
        )}
      </article>
    </div>
  )
}
