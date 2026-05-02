import { Link } from 'react-router-dom'
import styles from './MarketingFooter.module.css'

// Footer for the public marketing/SEO pages — Landing, HowItWorks, About,
// Contact. Mounted in LandingLayout (the parent route element) so it appears
// on every page in that group automatically; updating it once updates all
// four. NOT used on authed surfaces (Home, Inventory, Profile, etc.) — those
// have their own chrome and a footer would compete with their layout.
//
// Scope is intentionally minimal: wordmark, two nav links (About + Contact),
// copyright. Added 2026-05-02 to give /about and /contact discoverable
// surfaces — the routes shipped a day earlier with no inbound nav anywhere,
// effectively invisible. Privacy + Terms links land here later, in the same
// PR that builds those pages, to avoid 404 footer links in the meantime.
export default function MarketingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.wordmark}>sprigloop</div>
        <nav className={styles.nav} aria-label="Footer navigation">
          <Link to="/about" className={styles.link}>About</Link>
          <Link to="/contact" className={styles.link}>Contact</Link>
        </nav>
        <div className={styles.copyright}>© {year} Sprigloop</div>
      </div>
    </footer>
  )
}
