import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import styles from './About.module.css'

// Public marketing page — the founder-trust layer of the brand. Most of the
// value parents get from About is "who is this person and why should I give
// them my kid's data," so the page is written in first person from Chris and
// leans toward authentic over polished. Voice rules from
// feedback_landing_copy_voice.md apply: no em dashes, no AI-rhythm tells.
// Pass-along framing rules from feedback_pass_along_framing.md apply: never
// "hand-me-downs," never "families in need."
//
// **Editable prose:** the opening paragraphs name specifics about Chris and
// his family. Update those first if anything has changed (due date, location,
// child's name) before reviewing line-by-line. The rest of the body is the
// brand stance and changes less often.
//
// IvyDecoration is mounted by LandingLayout (the parent route element), not
// here. Same continuity reason as HowItWorks.
export default function About() {
  const navigate = useNavigate()

  useEffect(() => {
    track.pageViewed({ page: 'about', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDescription = descMeta?.getAttribute('content')

    document.title = 'About Sprigloop: a baby clothes inventory built by one parent'
    descMeta?.setAttribute(
      'content',
      'Sprigloop is a baby clothes inventory and pass-along app built by Chris, a solo founder in Detroit. Read why it exists and how the business stays small and parent-aligned.',
    )

    return () => {
      document.title = prevTitle
      if (prevDescription !== undefined && prevDescription !== null) {
        descMeta?.setAttribute('content', prevDescription)
      }
    }
  }, [])

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
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      {/* Mobile-only horizontal vine, matches Landing + HowItWorks. */}
      <IvyBanner />

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>About</div>
          <h1 className={styles.h1}>
            One parent, one <em>frustration</em>, one app.
          </h1>
          <p className={styles.lede}>
            I'm Chris. I'm building Sprigloop in evenings and on weekends from
            Detroit, while my partner and I get ready for our first kid. A boy
            we're calling Roo.
          </p>
        </header>

        <section className={styles.section}>
          <p>
            Sprigloop started with a question I couldn't shake. My wife and I
            live in a small house, and I hate clutter and waste in equal
            measure. Where do baby clothes go when babies outgrow them?
          </p>
          <p>
            Most of them end up in landfill. The rest sit in bags in basements
            until the kid graduates from high school. A small share get passed
            on to another family who can use them. That third path is the best
            one. It keeps clothes out of the landfill, gets them to a family
            who can use them, and gives the parents on the sending side a
            closet that doesn't fill up faster than the kid grows. It's also
            the hardest one to actually do. So almost no one does.
          </p>
          <p>I built Sprigloop to fix that.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What Sprigloop actually is</h2>
          <p>
            The app starts as a baby clothes inventory. You add what you have,
            organize by size, see what fits and what's coming up. The
            pass-along part is the piece I care about most. When something
            doesn't fit anymore, Sprigloop sends you a prepaid bag. You fill
            it with the outgrown clothes, write a name on the bag, drop it in
            any mailbox.
          </p>
          <p>
            The bag goes to one of three places: a friend you choose, another
            Sprigloop family who's opted in to receive, or a charity partner.
            Your closet stays light. The clothes find their next life.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What I want to be clear about</h2>
          <p>
            <strong>I'm not selling your data.</strong> Not now, not later, not
            in any form that links back to your kid. The way Sprigloop will
            eventually pay for itself is through curation: recommending
            products parents actually need, sometimes with affiliate revenue.
            Not by selling household profiles to brokers. The longer version
            is in the <a href="/privacy" className={styles.inlineLink}>privacy policy</a>.
            The short version: your kid's name, age, and what they wear is
            yours.
          </p>
          <p>
            <strong>I'm doing this part-time.</strong> Sprigloop is
            bootstrapped and small. If you email me, you're emailing the
            founder, not a support team. I usually reply within a day or two.
          </p>
          <p>
            <strong>I'm not trying to save the planet.</strong> I'm trying to
            make one frustrating, wasteful part of new parenthood a little
            easier and a little more connected. If a few thousand families end
            up using Sprigloop, the keep-out-of-landfill math gets meaningful.
            If only a few do, it's still a tool I want for myself.
          </p>
        </section>

        <section className={styles.cta}>
          <p className={styles.ctaCopy}>
            If any of that lands, you can{' '}
            <button
              className={styles.ctaInlineLink}
              onClick={() => navigate('/')}
            >
              start an inventory
            </button>{' '}
            or{' '}
            <button
              className={styles.ctaInlineLink}
              onClick={() => navigate('/contact')}
            >
              say hi
            </button>
            . Either's welcome.
          </p>
        </section>
      </article>
    </div>
  )
}
