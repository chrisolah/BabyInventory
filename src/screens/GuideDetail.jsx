import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import { getGuide } from '../lib/guides'
import IvyBanner from '../components/IvyBanner'
import styles from './GuideDetail.module.css'

function renderSection(section, i) {
  switch (section.type) {
    case 'lede':
      return <p key={i} className={styles.lede}>{section.body}</p>

    case 'note':
      return (
        <div key={i} className={styles.note}>
          <strong>Note: </strong>{section.body}
        </div>
      )

    case 'h2':
      return (
        <div key={i} className={styles.sectionBlock}>
          <h2 className={styles.h2}>{section.heading}</h2>
          {section.body && <p className={styles.p}>{section.body}</p>}
        </div>
      )

    case 'p':
      return <p key={i} className={styles.p}>{section.body}</p>

    case 'table':
      return (
        <div key={i} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {section.cols.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'bullets':
      return (
        <ul key={i} className={styles.bullets}>
          {section.items.map((item, ii) => <li key={ii}>{item}</li>)}
        </ul>
      )

    case 'sources':
      return (
        <div key={i} className={styles.sources}>
          <div className={styles.sourcesLabel}>Sources</div>
          <ul className={styles.sourcesList}>
            {section.items.map((src, si) => (
              <li key={si}>
                <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a>
              </li>
            ))}
          </ul>
        </div>
      )

    default:
      return null
  }
}

export default function GuideDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const guide = getGuide(slug)

  useEffect(() => {
    if (!guide) return
    track.pageViewed({ page: 'guide_detail', guide: slug, referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDesc = descMeta?.getAttribute('content')

    document.title = `${guide.title} — Sprigloop Guides`
    descMeta?.setAttribute('content', guide.description)

    return () => {
      document.title = prevTitle
      if (prevDesc != null) descMeta?.setAttribute('content', prevDesc)
    }
  }, [guide, slug])

  if (!guide) {
    return (
      <div className={styles.page}>
        <p style={{ padding: '3rem 1.5rem', color: 'var(--gray-500)' }}>Guide not found.</p>
      </div>
    )
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
            <button className={styles.navLink} onClick={() => navigate('/guides')}>Guides</button>
            <button className={styles.loginBtn} onClick={() => navigate('/login')}>Log in</button>
          </nav>
          <IvyBanner />
        </>
      )}

      <article className={styles.article}>
        <header className={styles.hero}>
          <button className={styles.backLink} onClick={() => navigate('/guides')}>
            &larr; All guides
          </button>
          <div className={styles.tags}>
            {guide.tags.map(t => <span key={t} className={styles.tag}>{t}</span>)}
          </div>
          <h1 className={styles.h1}>{guide.title}</h1>
          <p className={styles.subtitle}>{guide.subtitle}</p>
          <div className={styles.meta}>{guide.readTime} read &nbsp;&middot;&nbsp; {guide.date}</div>
          <div className={styles.aiDisclosure}>
            <strong>AI-assisted research: </strong>{guide.aiDisclosure}
          </div>
        </header>

        <div className={styles.body}>
          {guide.sections.map((section, i) => renderSection(section, i))}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerCta}>
            <div className={styles.footerCtaTitle}>Use Sprigloop to track what you have</div>
            <p className={styles.footerCtaBody}>
              The Plan tab shows your gaps by category and size — so you always know
              what you have, what&rsquo;s missing, and what&rsquo;s coming up next.
            </p>
            <button className={styles.footerCtaBtn} onClick={() => navigate(user ? '/plan' : '/signup')}>
              {user ? 'Open Plan tab' : 'Try Sprigloop free'}
            </button>
          </div>
          <button className={styles.backLinkBottom} onClick={() => navigate('/guides')}>
            &larr; Back to all guides
          </button>
        </div>
      </article>
    </div>
  )
}
