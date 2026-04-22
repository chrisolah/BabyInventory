import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import IvySprig from '../components/IvySprig'
import styles from './Profile.module.css'

// Profile is the settings / account hub. Entry point is ProfileMenu's "Profile"
// item (which now lives on every authed screen). Route: /profile.
//
// We use section tabs rather than a long scrolling list because the sections
// have very different shapes (CRUD lists, form inputs, preferences) and tabs
// let each one own its own loading state without fighting for the user's
// attention. Deep-linking via ?tab= keeps "Manage members" in an email able
// to land on the right tab.
//
// Destructive actions (leave household, delete account) live tucked under
// Account, not in their own tab — "Danger zone" is engineer jargon, and
// nobody opens their profile intending to close the account; surfacing it
// as a peer tab would over-weight a rare action for a parent audience.
//
// Each tab is a self-contained function in this file for now. As #56–#59
// land they'll grow substantially; we'll promote them to their own files
// once any of them gets past ~150 lines.

const TABS = [
  { id: 'household',     label: 'Household'     },
  { id: 'account',       label: 'Account'       },
  { id: 'notifications', label: 'Notifications' },
]

const TAB_IDS = TABS.map(t => t.id)

export default function Profile() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // ?tab= drives the active tab. An unknown or missing value falls back
  // to the first tab rather than rendering nothing.
  const paramTab = searchParams.get('tab')
  const activeTab = TAB_IDS.includes(paramTab) ? paramTab : 'household'

  function selectTab(id) {
    // Replace (not push) — flipping tabs shouldn't clutter the back stack.
    // "Back" from anywhere in /profile should return you to the page you
    // came from, not the tab you were on a moment ago.
    setSearchParams({ tab: id }, { replace: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          ←
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Profile</div>
          {/* Mobile-only sprig beneath the title. Hidden on desktop. */}
          <IvySprig />
        </div>
        {/* Intentionally no ProfileMenu here — we're already *on* Profile.
            A spacer keeps the title centered in the 1fr auto 1fr grid. */}
        <div className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Profile sections">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={
              `${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`
            }
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className={styles.body}>
        {activeTab === 'household'     && <HouseholdTab />}
        {activeTab === 'account'       && <AccountTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </main>
    </div>
  )
}

// ── Household tab ──────────────────────────────────────────────────────
// Scaffold only — #56 fills this in with: members list, invite member,
// babies list with per-baby edit (name, DOB, gender, size_mode), add
// another baby, remove baby.
function HouseholdTab() {
  return (
    <div className={styles.tabPanel} role="tabpanel">
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Household members</div>
        <div className={styles.emptyNote}>
          Managing co-parents, grandparents, and other helpers lands here
          next. You&rsquo;ll be able to invite people by email and set who
          can edit the wardrobe.
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Babies</div>
        <div className={styles.emptyNote}>
          Add another baby (new pregnancy, twins, triplets — bring &rsquo;em
          all). Each baby gets its own inventory so sizes and gaps stay
          separate.
        </div>
      </section>
    </div>
  )
}

// ── Account tab ────────────────────────────────────────────────────────
// Scaffold only — #57 fills in the upper "Your account" section with: display
// name edit, email change (triggers confirm-both-addresses via Supabase),
// password change. #59 fills in the lower "Leaving Littleloop" section with
// leave-household + delete-account flows.
//
// The two groups are on the same tab intentionally. Destructive actions used
// to live in their own "Danger zone" tab, but that's engineer register —
// nobody opens their profile intending to delete the account, and surfacing
// it as a peer tab over-weights a rare, scary action. Tucking it at the
// bottom under a subdued heading follows Account-settings convention in
// consumer apps and keeps the tab bar tuned to things parents actually
// visit on purpose.
function AccountTab() {
  const { user } = useAuth()
  const name = user?.user_metadata?.name || ''
  const email = user?.email || ''

  return (
    <div className={styles.tabPanel} role="tabpanel">
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Your account</div>
        <dl className={styles.kv}>
          <div className={styles.kvRow}>
            <dt className={styles.kvLabel}>Name</dt>
            <dd className={styles.kvValue}>{name || '—'}</dd>
          </div>
          <div className={styles.kvRow}>
            <dt className={styles.kvLabel}>Email</dt>
            <dd className={styles.kvValue}>{email || '—'}</dd>
          </div>
        </dl>
        <div className={styles.emptyNote}>
          Editing name, email, and password lands here next.
        </div>
      </section>

      {/* Separator before the destructive group — the muted heading + extra
          top margin signal "you're leaving the safe part of the page" without
          shouting about it. */}
      <section className={`${styles.section} ${styles.sectionQuiet}`}>
        <div className={styles.sectionTitleQuiet}>Leaving Littleloop</div>

        <div className={styles.quietRow}>
          <div className={styles.quietRowBody}>
            <div className={styles.quietRowTitle}>Leave household</div>
            <div className={styles.quietRowSub}>
              Remove yourself from this household. Other members keep access.
            </div>
          </div>
          {/* Button styling lands with #59 — keep it as a disabled preview so
              the layout is stable when the real handler drops in. */}
          <button
            type="button"
            className={styles.quietBtn}
            disabled
            aria-disabled="true"
            title="Coming soon"
          >
            Leave
          </button>
        </div>

        <div className={styles.quietRow}>
          <div className={styles.quietRowBody}>
            <div className={styles.quietRowTitle}>Delete account</div>
            <div className={styles.quietRowSub}>
              Permanently delete your account and everything associated with
              it. During the beta we&rsquo;ll route this through support so
              we can confirm before anything irreversible happens.
            </div>
          </div>
          <button
            type="button"
            className={styles.quietBtn}
            disabled
            aria-disabled="true"
            title="Coming soon"
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  )
}

// ── Notifications tab ──────────────────────────────────────────────────
// Scaffold only — #58 fills this in with toggle rows persisted to
// auth.users.raw_user_meta_data.prefs.
function NotificationsTab() {
  return (
    <div className={styles.tabPanel} role="tabpanel">
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Notifications</div>
        <div className={styles.emptyNote}>
          Toggle row reminders, outgrow warnings, and exchange alerts when
          the preferences UI lands here.
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Exchange preferences</div>
        <div className={styles.emptyNote}>
          Let families nearby know what you&rsquo;re willing to pass on or
          receive. Coming once the exchange loop is live.
        </div>
      </section>
    </div>
  )
}

