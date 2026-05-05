import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import MarketingFooter from '../components/MarketingFooter'
import styles from './NotFound.module.css'

// 404 page — replaces the previous catch-all <Navigate to="/"> which
// silently dropped users on the landing with no explanation. This page
// tells the user the URL doesn't exist, shows the actual broken URL so
// they can spot a typo, and offers smart recovery links based on their
// auth state.
//
// We deliberately don't lean on the LandingLayout wrapper — this is the
// same structural pattern as Login/Signup (own nav, own article,
// MarketingFooter is added by the parent LandingLayout when this is
// mounted there, but the NotFound entry stays standalone for predictable
// behavior on any URL).
//
// IvyDecoration is mounted by LandingLayout (the parent route element).
export default function NotFound() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  useEffect(() => {
    // Track the bad URL so the admin dashboard can spot patterns (typos,
    // dead links shared externally, anyone deep-linking against routes
    // that no longer exist). The actual path the user typed lives in
    // location.pathname; we capture referrer too in case it's a known
    // outbound link source.
    track.pageNotFound?.({ path: location.pathname, referrer: document.referrer })

    const prevTitle = document.title
    document.title = 'Page not found · Sprigloop'
    return () => { document.title = prevTitle }
  }, [location.pathname])

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
        {!user && (
          <button className={styles.loginBtn} onClick={() => navigate('/login')}>
            Log in
          </button>
        )}
      </nav>

      <IvyBanner />

      <article className={styles.article}>
        <div className={styles.eyebrow}>404</div>
        <h1 className={styles.h1}>
          We couldn't <em>find</em> that page.
        </h1>
        <p className={styles.lede}>
          The link you followed might be old, mistyped, or pointing somewhere we don't run.
        </p>
        {/* Show the URL the user actually hit. Helps them spot a typo and
            also gives them something concrete to paste into an email if
            they think it's our fault. */}
        <div className={styles.brokenUrl}>{location.pathname}</div>

        <div className={styles.actions}>
          {/* Primary action depends on auth state: signed-in users probably
              meant something inside the app, signed-out users probably
              meant the marketing site. Loading state defaults to home (/)
              to avoid flashing the wrong CTA during the initial auth
              resolution. */}
          {!loading && user ? (
            <Link to="/home" className={styles.primaryBtn}>
              Back to your home
            </Link>
          ) : (
            <Link to="/" className={styles.primaryBtn}>
              Back to the home page
            </Link>
          )}

          <div className={styles.secondaryLinks}>
            {/* Discoverability: offer the four most-likely intended
                destinations. For authed users we surface inventory + bag
                + profile; for unauthed we surface the marketing pages. */}
            {!loading && user ? (
              <>
                <Link to="/inventory" className={styles.secondaryLink}>Inventory</Link>
                <Link to="/pass-along" className={styles.secondaryLink}>Pass-along</Link>
                <Link to="/profile" className={styles.secondaryLink}>Profile</Link>
              </>
            ) : (
              <>
                <Link to="/how-it-works" className={styles.secondaryLink}>How it works</Link>
                <Link to="/about" className={styles.secondaryLink}>About</Link>
                <Link to="/contact" className={styles.secondaryLink}>Contact</Link>
              </>
            )}
          </div>
        </div>
      </article>
      {/* Footer mounted inline (NotFound sits outside LandingLayout because
          the catch-all route is a top-level route). Gives the user another
          recovery surface — if they ended up on a 404 from a stale email
          link, the footer's About/Contact/Privacy/Terms are right there. */}
      <MarketingFooter />
    </div>
  )
}
