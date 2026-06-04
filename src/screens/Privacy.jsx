import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import IvyBanner from '../components/IvyBanner'
import styles from './Privacy.module.css'

// Public legal page. First-person Chris voice for the framing pieces (intro,
// promises, contact) and plain English everywhere else. Voice rules from
// feedback_landing_copy_voice.md apply: no em dashes, no AI-rhythm tells.
//
// What this page actually has to do:
//   1. Cover the legally-required ground (what's collected, why, who else
//      touches it, retention, user rights, child data, contact, changes).
//   2. Match the trust contract Chris makes on /about — "I'm not selling
//      your data" needs to be true here in detail, not just in spirit.
//   3. Stay readable. A parent skimming this on their phone before signup
//      should be able to find the answer to "what do you do with my kid's
//      name and DOB" inside ten seconds.
//
// **Editable prose:** the data-inventory list, the third-party list, and
// the "Last updated" line are the things most likely to need updates as
// the product changes. The framing paragraphs change less often.
//
// IvyDecoration is mounted by LandingLayout (the parent route element).
export default function Privacy() {
  const navigate = useNavigate()

  useEffect(() => {
    track.pageViewed({ page: 'privacy', referrer: document.referrer })

    const prevTitle = document.title
    const descMeta = document.querySelector('meta[name="description"]')
    const prevDescription = descMeta?.getAttribute('content')

    document.title = 'Sprigloop Privacy Policy'
    descMeta?.setAttribute(
      'content',
      'How Sprigloop handles the information you and your family share with the app. Plain English, no selling of household data, written by the founder.',
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
        <button className={styles.signupBtn} onClick={() => navigate('/signup')}>Join Sprigloop</button>
        <button className={styles.loginBtn} onClick={() => navigate('/login')}>
          Log in
        </button>
      </nav>

      <IvyBanner />

      <article className={styles.article}>
        <header className={styles.hero}>
          <div className={styles.eyebrow}>Privacy</div>
          <h1 className={styles.h1}>What I do with your <em>information</em>.</h1>
          <p className={styles.lede}>
            Sprigloop is a small, founder-run app. The short version is that
            your information stays with the app, and your kid's name, age,
            and what they wear are not for sale. The longer version is below.
          </p>
          <p className={styles.updated}>Last updated May 5, 2026.</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.h2}>Who runs Sprigloop</h2>
          <p>
            Sprigloop is built and operated by Chris Olah, a solo founder
            based in the Detroit area. There is no marketing team, no data
            science team, and no third party I haven't named on this page.
            If you have a question about anything here, you can email me at{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>{' '}
            and I'll answer.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What I collect</h2>
          <p>
            Sprigloop only collects information that the app actually uses to
            help you keep an inventory and pass clothes along. Nothing extra,
            and nothing tucked away for a future sale.
          </p>

          <h3 className={styles.h3}>Account information</h3>
          <ul className={styles.list}>
            <li>Your email address.</li>
            <li>A password you choose, stored as a hashed value (the plain text is never visible to me or anyone else).</li>
            <li>The name you enter at signup, used to greet you in the app and in emails.</li>
            <li>The date you signed up, when you last signed in, and a session identifier so the app can keep you logged in.</li>
          </ul>

          <h3 className={styles.h3}>Household information</h3>
          <ul className={styles.list}>
            <li>An optional household name (for example, "The Smith family").</li>
            <li>Who else has joined your household, if you invite a co-parent or grandparent.</li>
          </ul>

          <h3 className={styles.h3}>Information about your child or expected child</h3>
          <ul className={styles.list}>
            <li>The child's first name (optional, you can leave it blank).</li>
            <li>Date of birth, or due date if you're expecting.</li>
            <li>Gender, if you choose to enter one.</li>
            <li>Sizing preferences (how you want the app to track sizes).</li>
          </ul>

          <h3 className={styles.h3}>Inventory information</h3>
          <ul className={styles.list}>
            <li>The clothing items you add: brand, size, condition, notes, and similar fields.</li>
            <li>Status changes you make (kept, outgrown, packed in a pass-along bag).</li>
            <li>If you use the photo-scan feature, the close-up tag photo is sent to the scanning service to read the brand and size, and is not stored after that. The wider garment photo, if you take one, is saved alongside the item in your inventory so you can recognize it visually later. Garment photos live in a private bucket scoped to your household, are deleted when you delete the item, and can be removed any time by emailing me.</li>
          </ul>

          <h3 className={styles.h3}>Pass-along bag information</h3>
          <ul className={styles.list}>
            <li>The status of any pass-along bag you start (draft, requested, in transit, delivered, and so on).</li>
            <li>If you request a Sprigloop bag, the mailing address you give for the bag to be sent to.</li>
            <li>The recipient's name or charity choice for routing the bag, when you provide it.</li>
          </ul>

          <h3 className={styles.h3}>App usage</h3>
          <ul className={styles.list}>
            <li>Which screens you visit and which actions you take, recorded as anonymous events tied to a session ID. After you sign in, those events are linked to your account so I can see, for example, where new users tend to drop off in onboarding.</li>
            <li>Basic device type (web, iOS, Android) for the same purpose.</li>
            <li>If you arrived through a UTM-tagged link (for example, a marketing post), the source and medium are saved so I know which efforts are working.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>What I do with it</h2>
          <p>
            All of the above is used for one of three reasons:
          </p>
          <ul className={styles.list}>
            <li><strong>To run the app.</strong> Showing your inventory, sending pass-along bags to the right address, keeping your sessions logged in, sharing data with co-parents you've invited.</li>
            <li><strong>To send you emails about your account.</strong> Welcome, sign-in codes, password resets, bag status updates, and lifecycle nudges (for example, a heads-up two days after signup if you haven't added an item yet). You can reply to any of these or email me directly to opt out of the lifecycle ones.</li>
            <li><strong>To improve the app.</strong> I look at aggregate usage to find what's confusing, what's broken, and what's working. I don't read individual inventories to make product decisions.</li>
          </ul>
          <p>
            I do not sell your data. I do not share it with advertisers, data
            brokers, or insurance companies. I do not build advertising
            audiences from it. If Sprigloop ever earns revenue from
            recommending products to you, that revenue comes from affiliate
            links that pay Sprigloop when you choose to buy something. The
            recommendations themselves are based on your inventory and your
            child's age, and that targeting happens inside Sprigloop's
            systems. Your information is not handed to the brand on the
            other end.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Who else touches it</h2>
          <p>
            Sprigloop is built on top of a small set of services that handle
            specific jobs. These are the only parties with technical access
            to your information, and each of them only sees what they need.
          </p>
          <ul className={styles.list}>
            <li><strong>Supabase</strong> hosts the database, handles authentication, and runs the back-end functions. Your account, household, inventory, and pass-along data live there. Supabase is a US company; servers used by Sprigloop are in the United States.</li>
            <li><strong>Resend</strong> sends transactional and lifecycle emails (sign-in codes, welcome notes, bag updates). Resend sees your email address and the contents of those emails.</li>
            <li><strong>Cloudflare</strong> handles DNS for sprigloop.com and routes inbound mail sent to chris@sprigloop.com to my personal inbox.</li>
            <li><strong>Vercel</strong> hosts the website you're reading this on. Standard server logs (IP address, request path, timestamp) sit there briefly for operational reasons.</li>
          </ul>
          <p>
            These vendors are bound by their own terms and security
            practices. They cannot use your information for their own
            purposes. If I ever add a new service that touches your data,
            I'll add it here.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Information about children</h2>
          <p>
            Sprigloop is meant for adults, parents and other caregivers, who
            are managing things on behalf of a child. The app is not
            directed at kids and kids are not the users.
          </p>
          <p>
            When you add information about your child or expected child,
            you're providing it as the parent or guardian. I treat that
            information as among the most sensitive in the app. I don't
            market to children, I don't profile children for advertising,
            and I don't share their information with anyone outside the
            sub-processors named above.
          </p>
          <p>
            If you're under 18 and reading this, please don't sign up for
            Sprigloop, and if you've already signed up, email me at{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>{' '}
            and I'll close the account.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>How long I keep it</h2>
          <p>
            Your account information stays in the app while you have an
            account. If you ask me to delete it (see below), I delete the
            account, the household if you were the only member, the babies
            and inventory tied to it, and the pass-along records. Some
            information lives on for a short time for operational reasons:
          </p>
          <ul className={styles.list}>
            <li>Email logs at Resend, typically a few weeks, for delivery troubleshooting.</li>
            <li>Server logs at Vercel and Supabase, generally less than 30 days.</li>
            <li>Aggregate, anonymized usage counts that don't tie back to your account.</li>
          </ul>
          <p>
            If you stop using the app but don't ask me to delete the
            account, your information stays put until you do. There's no
            automatic purge.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Your choices</h2>
          <p>You can:</p>
          <ul className={styles.list}>
            <li><strong>See what's in your account.</strong> Most of it is visible inside the app on your inventory, profile, and pass-along screens. If you want a copy of everything, email me and I'll send it.</li>
            <li><strong>Correct or update anything.</strong> You can edit your profile, your household, your babies, and any inventory item directly in the app.</li>
            <li><strong>Delete your account.</strong> Email me at chris@sprigloop.com and I'll delete it within a week. If you want to do it yourself, an in-app delete button is on the roadmap.</li>
            <li><strong>Stop the lifecycle emails.</strong> Reply to any of them or email me. Account-critical emails (sign-in codes, password resets) keep working as long as the account is open.</li>
          </ul>
          <p>
            Depending on where you live, you may also have rights under
            laws like the GDPR (European Economic Area, UK) or the CCPA
            (California): the right to access your information, correct
            it, delete it, port it, or object to certain uses. Email me
            and I'll honor any of those requests.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Cookies and similar tracking</h2>
          <p>
            Sprigloop uses two kinds of browser storage. The first is
            standard authentication state, set by Supabase, that keeps you
            signed in between visits. The second is a session ID generated
            in your browser to tie together the events you fire in a single
            visit. There are no third-party advertising cookies, no
            cross-site trackers, and no fingerprinting scripts.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Information transfers</h2>
          <p>
            Sprigloop is operated from the United States and the
            sub-processors above store data in the United States. If
            you're using Sprigloop from outside the US, your information
            will travel to and be stored in the US. By using Sprigloop you
            understand that.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Changes to this policy</h2>
          <p>
            If I change anything material about how Sprigloop handles your
            information, I'll update the "Last updated" date at the top of
            this page and, for substantive changes, I'll send a note to
            the email on your account. Continued use of the app after a
            change means you're okay with the new version. If you're not,
            email me and we'll close the account.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Questions</h2>
          <p>
            Email{' '}
            <a className={styles.inlineLink} href="mailto:chris@sprigloop.com">
              chris@sprigloop.com
            </a>
            . I'm the person who'll read it. You can also see the terms of
            service at{' '}
            <Link className={styles.inlineLink} to="/terms">
              /terms
            </Link>
            .
          </p>
        </section>
      </article>
    </div>
  )
}
