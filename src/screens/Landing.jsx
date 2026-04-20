import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { track } from '../lib/analytics'
import styles from './Landing.module.css'

export default function Landing() {
  const navigate = useNavigate()
  const supplyRef = useRef(null)

  useEffect(() => {
    track.pageViewed({ page: 'landing', referrer: document.referrer })
  }, [])

  function handleGetStarted() {
    track.ctaClicked('get_started')
    navigate('/signup')
  }

  function handlePassOn() {
    track.ctaClicked('pass_on_clothes')
    supplyRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleJoinCommunity() {
    track.ctaClicked('join_community')
    navigate('/signup')
  }

  function handleCreateAccount() {
    track.ctaClicked('create_account_footer')
    navigate('/signup')
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>littleloop</div>
        <button className={styles.loginBtn} onClick={() => navigate('/signup')}>Log in</button>
      </nav>

      <section className={styles.hero}>
        <div className={styles.eyebrow}>Free for all families</div>
        <h1 className={styles.headline}>Baby clothes,<br /><em>organized</em> and shared.</h1>
        <p className={styles.sub}>Track every onesie, plan every size, and pass along what your little one has outgrown — to a family who needs it most.</p>
        <div className={styles.heroBtns}>
          <button className={styles.heroCta} onClick={handleGetStarted}>Get started free</button>
          <button className={styles.heroSecondaryCta} onClick={handlePassOn}>Have clothes to pass on?</button>
        </div>
      </section>

      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything in one place</h2>
        <p className={styles.sectionSub}>Whether you're expecting or already knee-deep in laundry.</p>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--purple-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="#534AB7"/><rect x="9" y="2" width="5" height="5" rx="1" fill="#534AB7"/><rect x="2" y="9" width="5" height="5" rx="1" fill="#534AB7"/><rect x="9" y="9" width="5" height="5" rx="1" fill="#AFA9EC"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Catalog what you own</div>
            <div className={styles.featureCardBody}>Log items by size, category, and season. Never wonder what you have again.</div>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--teal-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Plan ahead by size</div>
            <div className={styles.featureCardBody}>Know which sizes are coming up and what you still need before you need it.</div>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: 'var(--amber-light)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" fill="#EF9F27"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <div className={styles.featureCardTitle}>Share with your family</div>
            <div className={styles.featureCardBody}>Invite co-parents and grandparents. Everyone stays in sync on one wardrobe.</div>
          </div>
        </div>
      </section>

      <section className={styles.how}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: '6px' }}>Simple from day one</h2>
        <p className={styles.sectionSub} style={{ marginBottom: '1.5rem' }}>For parents building and managing a wardrobe.</p>
        {[
          { n: 1, title: 'Add your baby and your clothes', body: "Set up in minutes. Log what you have, or start planning what you'll need." },
          { n: 2, title: 'Stay on top of every size', body: "We track what's coming up and surface gaps before you need them." },
          { n: 3, title: 'Find what you need nearby', body: 'When you have a gap, browse the exchange. Families nearby are passing on exactly what you need.' },
        ].map(({ n, title, body }) => (
          <div className={styles.howStep} key={n}>
            <div className={styles.howNum}>{n}</div>
            <div><div className={styles.howTitle}>{title}</div><div className={styles.howBody}>{body}</div></div>
          </div>
        ))}
      </section>

      <section className={styles.supply} ref={supplyRef}>
        <div className={styles.supplyBand}>
          <div className={styles.supplyEyebrow}>Have outgrown clothes?</div>
          <h2 className={styles.supplyHeadline}>Your 0–3M pile has a<br />family nearby waiting for it.</h2>
          <p className={styles.supplyBody}>Babies grow fast. The clothes sitting in your closet are exactly what another family needs right now. Passing them on takes one tap — no selling, no shipping, no charity drop-off.</p>
          <div className={styles.supplySteps}>
            {[
              { n: 1, strong: 'List what you have.', rest: ' A few taps — size, category, condition. Done.' },
              { n: 2, strong: 'A family nearby claims it.', rest: ' We match by zip code. They reach out to arrange pickup.' },
              { n: 3, strong: 'It goes to someone who needs it.', rest: ' Free. Direct. Personal.' },
            ].map(({ n, strong, rest }) => (
              <div className={styles.supplyStep} key={n}>
                <div className={styles.supplyStepNum}>{n}</div>
                <div className={styles.supplyStepText}><strong>{strong}</strong>{rest}</div>
              </div>
            ))}
          </div>
          <button className={styles.supplyCta} onClick={handleGetStarted}>Pass on your outgrown clothes</button>
        </div>
      </section>

      <section className={styles.mission}>
        <div className={styles.missionBand}>
          <div className={styles.missionHeadline}>Every baby deserves a full wardrobe.</div>
          <p className={styles.missionBody}>Babies outgrow clothes in weeks. Thousands of families nearby need exactly what's sitting in your closet. Littleloop connects them — free, local, and direct.</p>
          <button className={styles.missionCta} onClick={handleJoinCommunity}>Join the community</button>
          <div className={styles.statRow}>
            <div><div className={styles.statNum}>0–24mo</div><div className={styles.statLabel}>Sizes covered</div></div>
            <div><div className={styles.statNum}>Free</div><div className={styles.statLabel}>Always, for all families</div></div>
            <div><div className={styles.statNum}>Local</div><div className={styles.statLabel}>Matched by zip code</div></div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalHeadline}>Ready to get started?</div>
        <p className={styles.finalSub}>Organize your wardrobe, find what you need, or pass on what you don't. Free for every family. Always.</p>
        <button className={styles.finalCtaBtn} onClick={handleCreateAccount}>Create your account</button>
      </section>
    </div>
  )
}
