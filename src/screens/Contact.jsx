import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import styles from './Contact.module.css'

// Public marketing page — minimal by design. The job here is to give visitors
// a real address to reach Chris at, and to set honest expectations on
// response time so emails don't feel like they vanished into a void. Voice
// rules from feedback_landing_copy_voice.md apply: no em dashes, no
// AI-rhythm tells, drop the format if it's not landing after two drafts.
//
// IvyDecoration is mounted by LandingLayout (the parent route element).
export default function Contact() {
  const navigate = useNavigate()

  useEffect(() => {
    track.pageViewed({ page: 'contact', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDescription = descMeta?.getAttribute('content')

    document.title = 'Contact Sprigloop: email Chris directly'
    descMeta?.setAttribute(
      'content',
      'Send Sprigloop founder Chris a note. Ideas, improvements, and issues are all welcome.',
    )

    return () => {
      document.title = prevTitle
      if (prevDescription !== undefined && prevDescription !== null) {
        descMeta?.setAttribute('content', prevDescription)
      }
    }
  }, [])

  function handleEmailClick() {
    track.ctaClicked('contact_email')
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
        <button className={styles.signupBtn} onClick={() => navigate('/signup')}>Join Sprigloop</button>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      <IvyBanner />

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Contact</div>
          <h1 className={styles.h1}>Send Chris a <em>note</em>.</h1>
          <p className={styles.lede}>
            I'm building Sprigloop for myself, my wife, and you. I want to
            make this as useful as possible for every family using it. Send
            me a note with ideas, improvements, or issues. I'm here to help.
          </p>
        </header>

        <section className={styles.emailCard}>
          <div className={styles.emailLabel}>Email</div>
          <a
            className={styles.emailLink}
            href="mailto:chris@sprigloop.com"
            onClick={handleEmailClick}
          >
            chris@sprigloop.com
          </a>
          <div className={styles.emailHint}>
            I usually reply within a day or two.
          </div>
        </section>
      </article>
    </div>
  )
}
