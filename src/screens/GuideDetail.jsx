import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { track } from '../lib/analytics'
import { useAuth } from '../hooks/useAuth'
import { getGuide } from '../lib/guides'
import IvyBanner from '../components/IvyBanner'
import styles from './GuideDetail.module.css'

const RELATED_GUIDES = {
  'how-much-does-a-newborn-need': ['how-to-track-your-babys-inventory', 'when-does-baby-outgrow-each-size', 'baby-clothing-guide'],
  'when-does-baby-outgrow-each-size': ['how-to-organize-baby-clothes-by-size', 'what-to-do-with-outgrown-baby-clothes', 'baby-clothing-guide'],
  'what-to-do-with-outgrown-baby-clothes': ['where-to-donate-baby-clothes', 'how-to-store-baby-clothes-by-size', 'when-does-baby-outgrow-each-size'],
  'baby-registry-what-you-actually-need': ['how-to-build-your-baby-registry', 'what-you-need-before-baby-arrives', 'how-much-does-a-newborn-need'],
  'how-to-organize-baby-clothes-by-size': ['how-to-store-baby-clothes-by-size', 'when-does-baby-outgrow-each-size', 'signs-baby-clothes-dont-fit'],
  'baby-gear-splurge-vs-save': ['what-to-buy-secondhand-vs-new', 'is-a-baby-mattress-worth-the-splurge', 'do-you-need-a-baby-monitor'],
  'how-to-build-your-baby-registry': ['baby-registry-what-you-actually-need', 'what-you-need-before-baby-arrives', 'how-much-does-a-baby-cost-first-year'],
  'baby-clothing-guide': ['when-does-baby-outgrow-each-size', 'how-to-organize-baby-clothes-by-size', 'how-much-does-a-newborn-need'],
  'newborn-safe-sleep-setup': ['baby-sleep-regressions-by-age', 'baby-sleep-cues-and-wake-windows', 'how-to-swaddle-a-baby'],
  'bottle-feeding-newborn-what-you-need': ['do-you-need-a-bottle-warmer', 'how-to-introduce-a-bottle', 'formula-feeding-how-much-how-often'],
  'cloth-vs-disposable-diapers': ['how-many-diapers-does-a-baby-go-through', 'what-to-pack-in-a-diaper-bag', 'how-to-use-diaper-care-products'],
  'choosing-a-car-seat': ['how-to-install-a-car-seat', 'certified-vs-generic-baby-products', 'how-to-check-if-baby-gear-recalled'],
  'baby-toys-first-year-by-age': ['how-to-do-tummy-time', 'how-to-use-a-baby-carrier-safely', 'baby-proofing-checklist'],
  'newborn-health-kit-what-to-have': ['newborn-fever-when-to-worry', 'baby-teething-symptoms-and-remedies', 'how-to-bathe-a-newborn'],
  'how-to-bathe-a-newborn': ['newborn-health-kit-what-to-have', 'baby-teething-symptoms-and-remedies', 'how-much-does-a-newborn-need'],
  'certified-vs-generic-baby-products': ['what-to-buy-secondhand-vs-new', 'choosing-a-car-seat', 'how-to-check-if-baby-gear-recalled'],
  'what-you-need-before-baby-arrives': ['how-much-does-a-newborn-need', 'baby-registry-what-you-actually-need', 'how-much-does-a-baby-cost-first-year'],
  'how-much-does-a-baby-cost-first-year': ['how-much-to-save-before-baby-arrives', 'what-you-need-before-baby-arrives', 'baby-gear-splurge-vs-save'],
  'how-much-to-save-before-baby-arrives': ['how-much-does-a-baby-cost-first-year', 'baby-gear-splurge-vs-save', 'what-you-need-before-baby-arrives'],
  'how-to-choose-a-baby-stroller': ['baby-gear-splurge-vs-save', 'certified-vs-generic-baby-products', 'how-to-use-a-baby-carrier-safely'],
  'introducing-solid-foods-what-you-need': ['breastfeeding-supplies-checklist', 'starting-solids-foods-to-avoid-choking-hazards', 'bottle-feeding-newborn-what-you-need'],
  'breastfeeding-supplies-checklist': ['how-to-use-a-breast-pump', 'bottle-feeding-newborn-what-you-need', 'introducing-solid-foods-what-you-need'],
  'how-many-diapers-does-a-baby-go-through': ['cloth-vs-disposable-diapers', 'what-to-pack-in-a-diaper-bag', 'how-to-use-diaper-care-products'],
  'what-to-pack-in-a-diaper-bag': ['how-many-diapers-does-a-baby-go-through', 'daycare-prep-what-to-pack-and-label', 'how-to-use-diaper-care-products'],
  'how-to-swaddle-a-baby': ['newborn-safe-sleep-setup', 'baby-sleep-cues-and-wake-windows', 'how-much-does-a-newborn-need'],
  'how-to-do-tummy-time': ['baby-toys-first-year-by-age', 'baby-proofing-checklist', 'how-to-use-a-baby-carrier-safely'],
  'how-to-use-a-baby-carrier-safely': ['baby-gear-splurge-vs-save', 'how-to-do-tummy-time', 'certified-vs-generic-baby-products'],
  'how-to-install-a-car-seat': ['choosing-a-car-seat', 'certified-vs-generic-baby-products', 'baby-gear-splurge-vs-save'],
  'how-to-introduce-a-bottle': ['bottle-feeding-newborn-what-you-need', 'formula-feeding-how-much-how-often', 'introducing-solid-foods-what-you-need'],
  'how-to-use-a-breast-pump': ['breastfeeding-supplies-checklist', 'how-to-introduce-a-bottle', 'bottle-feeding-newborn-what-you-need'],
  'baby-sleep-cues-and-wake-windows': ['newborn-safe-sleep-setup', 'how-to-swaddle-a-baby', 'baby-sleep-regressions-by-age'],
  'how-to-use-diaper-care-products': ['cloth-vs-disposable-diapers', 'how-many-diapers-does-a-baby-go-through', 'what-to-pack-in-a-diaper-bag'],
  'is-a-baby-mattress-worth-the-splurge': ['newborn-safe-sleep-setup', 'what-to-buy-secondhand-vs-new', 'baby-gear-splurge-vs-save'],
  'do-you-need-a-baby-monitor': ['newborn-safe-sleep-setup', 'baby-gear-splurge-vs-save', 'certified-vs-generic-baby-products'],
  'what-to-buy-secondhand-vs-new': ['what-baby-items-to-borrow-not-buy', 'is-a-baby-mattress-worth-the-splurge', 'baby-stuff-youll-never-use'],
  'baby-stuff-youll-never-use': ['what-to-buy-secondhand-vs-new', 'do-you-need-a-bottle-warmer', 'how-much-does-a-newborn-need'],
  'do-you-need-a-bottle-warmer': ['baby-stuff-youll-never-use', 'what-to-buy-secondhand-vs-new', 'bottle-feeding-newborn-what-you-need'],
  'how-to-store-baby-clothes-by-size': ['how-to-organize-baby-clothes-by-size', 'when-does-baby-outgrow-each-size', 'how-to-build-a-baby-capsule-wardrobe'],
  'how-to-build-a-baby-capsule-wardrobe': ['how-to-store-baby-clothes-by-size', 'how-much-does-a-newborn-need', 'what-to-buy-secondhand-vs-new'],
  'what-baby-items-to-borrow-not-buy': ['what-to-buy-secondhand-vs-new', 'baby-stuff-youll-never-use', 'how-much-does-a-newborn-need'],
  'baby-proofing-checklist': ['newborn-health-kit-what-to-have', 'baby-toys-first-year-by-age', 'how-to-do-tummy-time'],
  'baby-sleep-regressions-by-age': ['newborn-safe-sleep-setup', 'baby-sleep-cues-and-wake-windows', 'how-to-swaddle-a-baby'],
  'baby-teething-symptoms-and-remedies': ['newborn-fever-when-to-worry', 'newborn-health-kit-what-to-have', 'how-to-bathe-a-newborn'],
  'newborn-fever-when-to-worry': ['newborn-health-kit-what-to-have', 'baby-teething-symptoms-and-remedies', 'how-much-does-a-newborn-need'],
  'formula-feeding-how-much-how-often': ['bottle-feeding-newborn-what-you-need', 'how-to-introduce-a-bottle', 'do-you-need-a-bottle-warmer'],
  'how-to-track-your-babys-inventory': ['how-to-organize-baby-clothes-by-size', 'when-does-baby-outgrow-each-size', 'how-much-does-a-newborn-need'],
  'where-to-donate-baby-clothes': ['what-to-do-with-outgrown-baby-clothes', 'sustainable-circular-baby-gear-brands', 'how-to-check-if-baby-gear-recalled'],
  'sustainable-circular-baby-gear-brands': ['where-to-donate-baby-clothes', 'what-to-buy-secondhand-vs-new', 'how-to-check-if-baby-gear-recalled'],
  'seasonal-baby-clothing-guide': ['how-to-install-a-car-seat', 'baby-clothing-guide', 'how-much-does-a-newborn-need'],
  'signs-baby-clothes-dont-fit': ['when-does-baby-outgrow-each-size', 'how-to-organize-baby-clothes-by-size', 'how-to-store-baby-clothes-by-size'],
  'daycare-prep-what-to-pack-and-label': ['what-to-pack-in-a-diaper-bag', 'newborn-safe-sleep-setup', 'what-you-need-before-baby-arrives'],
  'starting-solids-foods-to-avoid-choking-hazards': ['introducing-solid-foods-what-you-need', 'how-to-introduce-a-bottle', 'baby-toys-first-year-by-age'],
  'how-to-check-if-baby-gear-recalled': ['certified-vs-generic-baby-products', 'choosing-a-car-seat', 'what-to-buy-secondhand-vs-new'],
}

function renderSection(section, i, slug) {
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

    case 'verdict':
      return (
        <div key={i} className={`${styles.verdict} ${section.positive ? styles.verdictGood : styles.verdictNeutral}`}>
          <span className={styles.verdictIcon}>{section.positive ? '✓' : '—'}</span>
          {section.body}
        </div>
      )

    case 'callout':
      return (
        <div key={i} className={styles.callout}>
          {section.body}
        </div>
      )

    case 'products':
      return (
        <div key={i} id="picks" className={styles.productsBlock}>
          <div className={styles.productsLabel}>Sprigloop picks on Amazon</div>
          <div className={styles.productCards}>
            {section.items.map((product, pi) => (
              <a
                key={pi}
                href={product.url}
                className={styles.productCard}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => track.affiliateLinkClicked?.({ guide: slug, product: product.name, url: product.url })}
              >
                <div className={styles.productEmoji}>{product.emoji}</div>
                <div className={styles.productInfo}>
                  <div className={styles.productName}>{product.name}</div>
                  <div className={styles.productNote}>{product.note}</div>
                  <span className={styles.productAmazonTag}>Amazon affiliate link</span>
                </div>
                <span className={styles.productCta}>View →</span>
              </a>
            ))}
          </div>
        </div>
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

    case 'heading':
      return <h2 key={i} className={styles.h2}>{section.body}</h2>

    case 'body':
      return <p key={i} className={styles.p}>{section.body}</p>

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
    track.guideRead?.({ slug, title: guide.title })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDesc = descMeta?.getAttribute('content')

    const pageTitle = `${guide.title} — Sprigloop Guides`
    document.title = pageTitle
    descMeta?.setAttribute('content', guide.description)

    // Open Graph + Twitter tags are hardcoded once in index.html to the
    // homepage's title/description/url, and nothing updated them per-route —
    // so every guide, when pinned/shared, showed the generic homepage
    // preview instead of its own. Swap them in the same way document.title
    // and the description meta already do, and restore on unmount so
    // navigating away (or to another guide) doesn't leave stale tags behind.
    // og:image is intentionally left as the generic brand image — guides
    // don't have their own featured images yet.
    const guideUrl = `https://sprigloop.com/guides/${guide.slug}`
    const ogTagSelectors = {
      'og:title': pageTitle,
      'og:description': guide.description,
      'og:url': guideUrl,
      'twitter:title': pageTitle,
      'twitter:description': guide.description,
    }
    const prevOgValues = {}
    for (const [key, value] of Object.entries(ogTagSelectors)) {
      const selector = key.startsWith('og:')
        ? `meta[property="${key}"]`
        : `meta[name="${key}"]`
      const el = document.querySelector(selector)
      if (el) {
        prevOgValues[key] = el.getAttribute('content')
        el.setAttribute('content', value)
      }
    }

    const jsonLd = document.createElement('script')
    jsonLd.type = 'application/ld+json'
    jsonLd.id = 'guide-jsonld'
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.title,
      description: guide.description,
      datePublished: guide.lastmod,
      dateModified: guide.lastmod,
      author: { '@type': 'Organization', name: 'Sprigloop', url: 'https://sprigloop.com' },
      publisher: {
        '@type': 'Organization',
        name: 'Sprigloop',
        url: 'https://sprigloop.com',
        logo: { '@type': 'ImageObject', url: 'https://sprigloop.com/favicon.svg' },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://sprigloop.com/guides/${guide.slug}` },
    })
    document.head.appendChild(jsonLd)

    return () => {
      document.title = prevTitle
      if (prevDesc != null) descMeta?.setAttribute('content', prevDesc)
      for (const key of Object.keys(ogTagSelectors)) {
        if (prevOgValues[key] == null) continue
        const selector = key.startsWith('og:')
          ? `meta[property="${key}"]`
          : `meta[name="${key}"]`
        document.querySelector(selector)?.setAttribute('content', prevOgValues[key])
      }
      document.getElementById('guide-jsonld')?.remove()
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
            <button className={styles.signupBtn} onClick={() => navigate('/signup')}>Join</button>
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
          {guide.sections.some(s => s.type === 'products') && (
            <a href="#picks" className={styles.picksJump}>
              Sprigloop picks ↓
            </a>
          )}
        </header>

        <div className={styles.body}>
          {guide.sections.map((section, i) => renderSection(section, i, slug))}
        </div>

        {(() => {
          const relatedSlugs = RELATED_GUIDES[slug] || []
          const relatedGuides = relatedSlugs.map(s => getGuide(s)).filter(Boolean)
          if (!relatedGuides.length) return null
          return (
            <div className={styles.relatedSection}>
              <div className={styles.relatedLabel}>Related guides</div>
              <div className={styles.relatedList}>
                {relatedGuides.map(g => (
                  <button key={g.slug} className={styles.relatedCard} onClick={() => navigate(`/guides/${g.slug}`)}>
                    <div className={styles.relatedTags}>
                      {g.tags.slice(0, 2).map(t => <span key={t} className={styles.relatedTag}>{t}</span>)}
                    </div>
                    <div className={styles.relatedTitle}>{g.title}</div>
                    <div className={styles.relatedMeta}>{g.readTime} read</div>
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

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
