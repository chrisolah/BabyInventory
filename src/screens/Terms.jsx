import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import styles from './Terms.module.css'

// Public legal page. Plain-English terms of service. Slightly more formal
// than Privacy.jsx because Terms need to be enforceable, but still written
// to be readable by an actual parent. Voice rules from
// feedback_landing_copy_voice.md still apply: no em dashes, no AI-rhythm
// tells, no "hate."
//
// What this page actually has to do:
//   1. Establish the agreement between the user and Sprigloop, and capture
//      consent at signup (the consent checkbox is wired separately on
//      Signup.jsx and the upgrade flow).
//   2. Cover the pass-along bag flow specifically: it's a manual,
//      best-effort, founder-run service today, and that needs to be on
//      the page so expectations are aligned.
//   3. Set out the basics every consumer ToS has: acceptable use,
//      content ownership, service availability, no-warranty, liability
//      cap, termination, governing law, changes, contact.
//
// **Editable prose:** the pass-along section reflects the live state of
// the operational flow. If bag fulfillment changes (for example, when
// it stops being manual), update §5 first.
//
// IvyDecoration is mounted by LandingLayout (the parent route element).
export default function Terms() {
  const navigate = useNavigate()

  useEffect(() => {
    track.pageViewed({ page: 'terms', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDescription = descMeta?.getAttribute('content')

    document.title = 'Sprigloop Terms of Service'
    descMeta?.setAttribute(
      'content',
      'The terms that govern your use of Sprigloop. Plain English, written by the founder, covering accounts, the pass-along bag service, and the basics.',
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
        <button className={styles.signupBtn} onClick={() => navigate('/signup')}>Join</button>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      <IvyBanner />

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Terms</div>
          <h1 className={styles.h1}>The <em>terms</em> of using Sprigloop.</h1>
          <p className={styles.lede}>
            These terms explain what you can expect from Sprigloop and what
            Sprigloop expects from you. Sprigloop is a small, founder-run
            app, so the terms are deliberately short and plain.
          </p>
          <p className={styles.updated}>Last updated May 5, 2026.</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.h2}>1. Agreement</h2>
          <p>
            By creating a Sprigloop account, or by using the app without
            creating one (the trial), you agree to these terms and to the{' '}
            <Link className={styles.inlineLink} to="/privacy">privacy policy</Link>.
            "Sprigloop," "we," and "us" refer to Sprigloop, operated by
            Chris Olah from the Detroit area. "You" refers to the person
            using the app.
          </p>
          <p>
            If you don't agree with any part of these terms, please don't
            use the app. If you've already created an account, email{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>{' '}
            and we'll close it.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>2. Who can use Sprigloop</h2>
          <p>
            You need to be 18 or older to create an account. The app is
            intended for parents, guardians, and other caregivers acting
            on behalf of a child or expected child. The child is not the
            user. If you're a co-parent, grandparent, or other family
            member who's been invited into a household, the same rules
            apply to you.
          </p>
          <p>
            You can use Sprigloop anywhere it's available, but the app is
            operated from the United States and the support hours follow
            US Eastern time.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>3. Your account</h2>
          <p>
            You're responsible for keeping your password and any sign-in
            codes private. If you suspect someone else has gotten into
            your account, change your password and let us know. You can
            invite other adults into your household, and when you do,
            they'll be able to see and edit the household's inventory and
            pass-along bags. Don't invite anyone you don't intend to share
            that information with.
          </p>
          <p>
            The information you put into the app, your name, your child's
            name and dates, the items you add, needs to be your own
            information to share. Don't enter another family's information
            without their consent.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>4. Acceptable use</h2>
          <p>
            Sprigloop is here for its intended purpose: keeping a baby
            clothing inventory and passing items along. While using it,
            please don't:
          </p>
          <ul className={styles.list}>
            <li>Use the app for anything illegal, abusive, or harmful to other people.</li>
            <li>Try to break, scrape, reverse-engineer, or overload the app.</li>
            <li>Use it to harass another household member or to share information about a child without the parent's consent.</li>
            <li>Send anything dangerous, hazardous, or counterfeit through the pass-along bag service.</li>
            <li>Impersonate someone else or create accounts on someone else's behalf.</li>
          </ul>
          <p>
            If you do any of these, we may suspend or close your account.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>5. The pass-along bag service</h2>
          <p>
            Sprigloop's pass-along feature lets you mail outgrown clothes
            to a friend, another Sprigloop family, or a charity partner
            using a prepaid bag we send you. A few things to know about
            how that part of the app works today.
          </p>

          <h3 className={styles.h3}>It's a small operation</h3>
          <p>
            Bags are fulfilled manually by Sprigloop right now. We try to
            ship a requested bag within a few business days, but there is
            no guaranteed turnaround time, and there will be slower
            stretches. If timing matters for you, email us before
            requesting and we'll let you know.
          </p>

          <h3 className={styles.h3}>What goes in the bag is your responsibility</h3>
          <p>
            You decide what to put in a Sprigloop bag and you confirm that
            it's yours to give away, in usable condition, and appropriate
            for a child to receive. Don't include anything stained beyond
            wearable use, anything broken or hazardous, anything that
            isn't children's clothing, or anything you're not authorized
            to send. Sprigloop may discard items that don't meet that bar
            and may pause the service for an account that repeatedly sends
            unsuitable items.
          </p>

          <h3 className={styles.h3}>Recipient routing</h3>
          <p>
            When you address a bag to a specific person, you're confirming
            that person has agreed to receive it, and the address you
            write on the bag is what determines where it goes. If a bag
            is undeliverable, we'll do our best to contact you. When you
            choose a charity destination, the specific charity partner is
            at our discretion and may change from bag to bag.
          </p>

          <h3 className={styles.h3}>Once a bag ships, the items are no longer yours</h3>
          <p>
            Items in a fulfilled pass-along bag transfer to the recipient
            with no expectation of return. Sprigloop doesn't track items
            after delivery and can't help you get them back if you change
            your mind.
          </p>

          <h3 className={styles.h3}>Cost</h3>
          <p>
            Sprigloop covers the cost of the bag and shipping today as
            part of running the service. That may change for future bags
            if the economics require it; we'll give you advance notice if
            so, and any change will only affect future bag requests, not
            ones already in progress.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>6. Your content</h2>
          <p>
            Anything you put into Sprigloop, your inventory, your notes,
            your household name, your child's information, stays yours.
            By using the app, you give Sprigloop the limited permission
            needed to store it, display it back to you and your household
            members, and use it to operate the features you've engaged
            with (for example, routing a pass-along bag). Sprigloop
            doesn't claim ownership of your information and doesn't share
            it outside of what's described in the{' '}
            <Link className={styles.inlineLink} to="/privacy">privacy policy</Link>.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>7. Service availability</h2>
          <p>
            Sprigloop is offered as-is. We try to keep it up and working,
            but the app will sometimes be down for maintenance or because
            of issues with the services it depends on. We may add, change,
            or remove features over time, and we may pause the pass-along
            bag service for short periods if we need to. None of this
            constitutes a breach of these terms.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>8. No warranty</h2>
          <p>
            Sprigloop is provided without warranties of any kind, either
            express or implied, including warranties of merchantability,
            fitness for a particular purpose, and non-infringement. We
            don't warrant that the app will be uninterrupted, error-free,
            or that any particular bag will arrive in any particular
            condition. To the maximum extent allowed by law, we disclaim
            every warranty other than those that cannot be disclaimed.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>9. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Sprigloop and its
            operator are not liable for indirect, incidental, special,
            consequential, or punitive damages arising out of or related
            to your use of the app. Our total liability to you for any
            claim arising out of these terms or your use of Sprigloop
            will not exceed one hundred US dollars (US $100), or the
            amount you've paid to Sprigloop in the twelve months before
            the claim, whichever is greater.
          </p>
          <p>
            Some jurisdictions don't allow these limitations, in which
            case they apply to the fullest extent allowed where you live.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold Sprigloop and its operator
            harmless from claims, losses, and expenses (including
            reasonable attorneys' fees) that arise out of your use of the
            app in a way that violates these terms, including from
            anything you send through the pass-along bag service that you
            were not authorized to send or that didn't meet the
            acceptable-use bar.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>11. Ending your use</h2>
          <p>
            You can stop using Sprigloop at any time and you can ask us
            to delete your account by emailing{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>
            . We may also suspend or close an account if it's being used
            in a way that breaks these terms, or if continuing to operate
            it would create a meaningful risk for Sprigloop or its other
            users. When an account is closed, the data is handled
            according to the privacy policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>12. Governing law</h2>
          <p>
            These terms are governed by the laws of the State of Michigan,
            without regard to its conflict of laws rules. Any dispute that
            can't be resolved by emailing each other will be heard in the
            state or federal courts located in Wayne County, Michigan, and
            both you and Sprigloop consent to that jurisdiction.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>13. Changes to these terms</h2>
          <p>
            If we change these terms in a material way, we'll update the
            "Last updated" date at the top of this page and send you a
            note at the email address on your account. If you keep using
            the app after the change takes effect, you've accepted the
            new terms. If you don't accept the new terms, email us and
            we'll close your account.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>14. Contact</h2>
          <p>
            Questions, requests, and complaints all go to{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>
            . Chris reads it.
          </p>
        </section>
      </article>
    </div>
  )
}
