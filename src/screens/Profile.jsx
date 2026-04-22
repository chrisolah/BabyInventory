import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import IvySprig from '../components/IvySprig'
import InviteMemberModal from '../components/InviteMemberModal'
import BabyFormModal from '../components/BabyFormModal'
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
// Members list, babies CRUD, household rename. RLS gotcha: hm_select only
// returns your own membership, so the "members" section will always be a
// one-row list (you) until we build a SECURITY DEFINER RPC that can expose
// other members' identities. That lands alongside real invite delivery;
// for now the invite modal just captures intent.
function HouseholdTab() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [household, setHousehold] = useState(null)
  const [myRole, setMyRole] = useState(null)       // 'owner' | 'member'
  const [babies, setBabies] = useState([])

  // Inline rename state for the household name. Saved on blur or Enter.
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [showInvite, setShowInvite] = useState(false)

  // babyModal is null (closed) or { mode: 'create'|'edit', baby? }.
  const [babyModal, setBabyModal] = useState(null)

  // Friendly name for the current user. Falls back to email, then "You".
  const myName = user?.user_metadata?.name || user?.email || 'You'
  const myEmail = user?.email || ''

  // Pulled out so the modal-saved handlers can refresh without hitting
  // the effect cleanup/mount cycle.
  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const { data: memberships, error: memErr } = await supabase
      .schema(currentSchema)
      .from('household_members')
      .select('role, joined_at, household_id, households(id, name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)

    if (memErr || !memberships?.[0]?.households) {
      setError(memErr?.message || 'No household found.')
      setLoading(false)
      return
    }

    const m = memberships[0]
    setHousehold(m.households)
    setMyRole(m.role)
    setNameDraft(m.households.name || '')

    const { data: babiesData, error: babiesErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .select('*')
      .eq('household_id', m.household_id)
      .order('created_at', { ascending: true })

    if (babiesErr) {
      setError(babiesErr.message)
      setLoading(false)
      return
    }

    setBabies(babiesData || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    let cancelled = false
    load().then(() => { if (cancelled) { /* noop */ } })
    return () => { cancelled = true }
  }, [load])

  // ── Household rename ────────────────────────────────────────────────
  async function saveHouseholdName() {
    const trimmed = nameDraft.trim()
    if (!trimmed || !household) {
      setRenaming(false)
      setNameDraft(household?.name || '')
      return
    }
    if (trimmed === (household.name || '')) {
      setRenaming(false)
      return
    }
    setSavingName(true)
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('households')
      .update({ name: trimmed })
      .eq('id', household.id)
    setSavingName(false)

    if (updErr) {
      // RLS will reject non-owners. Surface the error and revert the draft
      // so we don't leave a dirty input lying around.
      setError(updErr.message)
      setNameDraft(household.name || '')
      setRenaming(false)
      return
    }

    setHousehold({ ...household, name: trimmed })
    track.householdRenamed()
    setRenaming(false)
  }

  // ── Baby modal handlers ─────────────────────────────────────────────
  function openAddBaby() {
    setBabyModal({ mode: 'create' })
  }
  function openEditBaby(baby) {
    setBabyModal({ mode: 'edit', baby })
  }
  function closeBabyModal() {
    setBabyModal(null)
  }
  async function onBabySaved() {
    setBabyModal(null)
    await load()
  }

  // ── Render ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.tabPanel} role="tabpanel">
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  if (error && !household) {
    return (
      <div className={styles.tabPanel} role="tabpanel">
        <div className={styles.errorBox}>{error}</div>
      </div>
    )
  }

  const ownerOnly = myRole === 'owner'

  return (
    <div className={styles.tabPanel} role="tabpanel">
      {/* Non-fatal errors surface above the content so later sections
          still render — keeps the tab from going blank after a stray
          update failure (e.g. a non-owner trying to rename). */}
      {error && household && (
        <div className={styles.errorBox}>{error}</div>
      )}

      {/* ── Household name ─────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Household</div>
        {renaming ? (
          <div className={styles.renameRow}>
            <input
              className={styles.renameInput}
              type="text"
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveHouseholdName()
                if (e.key === 'Escape') {
                  setNameDraft(household?.name || '')
                  setRenaming(false)
                }
              }}
              autoFocus
              disabled={savingName}
            />
            <button
              type="button"
              className={styles.renameSave}
              onClick={saveHouseholdName}
              disabled={savingName || !nameDraft.trim()}
            >
              {savingName ? 'Saving…' : 'Save'}
            </button>
          </div>
        ) : (
          <div className={styles.namedRow}>
            <div className={styles.namedText}>
              {household?.name || 'Untitled household'}
            </div>
            {ownerOnly && (
              <button
                type="button"
                className={styles.editLink}
                onClick={() => setRenaming(true)}
              >
                Rename
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Members ────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>Members</div>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              track.householdInviteOpened('profile_household')
              setShowInvite(true)
            }}
          >
            + Invite
          </button>
        </div>

        <div className={styles.memberRow}>
          <div className={styles.memberAvatar} aria-hidden="true">
            {(myName[0] || '?').toUpperCase()}
          </div>
          <div className={styles.memberBody}>
            <div className={styles.memberName}>
              {myName} <span className={styles.memberSelfTag}>· You</span>
            </div>
            {myEmail && <div className={styles.memberEmail}>{myEmail}</div>}
          </div>
          <span className={styles.roleBadge}>
            {myRole === 'owner' ? 'Owner' : 'Member'}
          </span>
        </div>

        <div className={styles.memberHint}>
          Co-parents and helpers you invite will appear here once invites
          go live.
        </div>
      </section>

      {/* ── Babies ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionTitle}>
            {babies.length === 0
              ? 'Babies'
              : `Babies (${babies.length})`}
          </div>
        </div>

        {babies.length === 0 ? (
          <div className={styles.emptyNote}>
            No babies yet. Add one to start tracking their wardrobe.
          </div>
        ) : (
          <div className={styles.babyList}>
            {babies.map(baby => (
              <button
                key={baby.id}
                type="button"
                className={styles.babyRow}
                onClick={() => openEditBaby(baby)}
              >
                <div className={styles.babyAvatar} aria-hidden="true">
                  {babyInitial(baby)}
                </div>
                <div className={styles.babyBody}>
                  <div className={styles.babyName}>
                    {baby.name || (baby.due_date ? 'Expecting' : 'Baby')}
                  </div>
                  <div className={styles.babyMeta}>
                    {babyMetaLine(baby)}
                  </div>
                </div>
                <span className={styles.babyEditChevron} aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className={styles.addBabyBtn}
          onClick={openAddBaby}
        >
          + Add another baby
        </button>
        <p className={styles.addBabyHint}>
          Twins, triplets, a sibling on the way — bring &rsquo;em all.
        </p>
      </section>

      {showInvite && (
        <InviteMemberModal
          from="profile_household"
          onClose={() => setShowInvite(false)}
        />
      )}

      {babyModal && (
        <BabyFormModal
          mode={babyModal.mode}
          household={household}
          baby={babyModal.baby}
          onClose={closeBabyModal}
          onSaved={onBabySaved}
        />
      )}
    </div>
  )
}

// Quick one-letter avatar for baby rows. Uses name's first char, else 'B'.
function babyInitial(baby) {
  const n = (baby.name || '').trim()
  if (n) return n[0].toUpperCase()
  return baby.due_date ? '•' : 'B'
}

// Secondary line on a baby row: "Born DATE · Girl · By age" or
// "Due DATE · Expecting". Empty segments get filtered so missing gender,
// etc., just collapses out instead of leaving stray separators.
function babyMetaLine(baby) {
  const parts = []
  if (baby.date_of_birth) {
    parts.push(`Born ${formatDate(baby.date_of_birth)}`)
  } else if (baby.due_date) {
    parts.push(`Due ${formatDate(baby.due_date)}`)
  }
  if (baby.gender) {
    parts.push(capitalize(baby.gender))
  }
  return parts.join(' · ')
}

function formatDate(isoDate) {
  // Parse YYYY-MM-DD as a local-date (avoid the UTC-midnight-timezone-slip
  // that "new Date('2026-01-01')" triggers in west-of-GMT locales).
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function capitalize(s) {
  if (!s) return ''
  return s[0].toUpperCase() + s.slice(1)
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

