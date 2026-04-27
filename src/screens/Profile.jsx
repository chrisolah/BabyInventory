import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
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
// Members list, babies CRUD, household rename. The members list is hydrated
// via beta.list_household_members(household_id) — a SECURITY DEFINER RPC
// that joins household_members to auth.users (name + email) gated by
// is_household_member. Direct .from('household_members').select() returns
// only the caller's row because the hm_select RLS policy is scoped to
// auth.uid().
function HouseholdTab() {
  const { user } = useAuth()
  // Pull the context's refresh handle so baby edits here also update the
  // shared state that Inventory, SlotDetail, and AddItem read from. Without
  // this, saving (for example) a manual age-band override from Profile would
  // update Profile's local babies list but leave stale data in Inventory's
  // sprout / chip coverage logic until a hard reload.
  const { refresh: refreshHousehold } = useHousehold()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [household, setHousehold] = useState(null)
  const [myRole, setMyRole] = useState(null)       // 'owner' | 'member'
  const [babies, setBabies] = useState([])
  // All members of the household (caller + everyone else). Hydrated by the
  // list_household_members RPC after we know the household id.
  const [members, setMembers] = useState([])

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
      .select(
        'role, joined_at, household_id, households(' +
          'id, name, ' +
          // Receiving opt-in columns (migration 010). Pulled here so the
          // receiving section doesn't need its own round trip — we already
          // have the household id in hand.
          'accepts_hand_me_downs, accepts_sizes, accepts_genders, ' +
          'receiving_paused_until, receiving_notes' +
        ')',
      )
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

    // Members — hydrated via SECURITY DEFINER RPC so we get rows for every
    // member (not just the caller). If the RPC fails (e.g. migration not
    // applied in this env) we degrade gracefully to a self-only list so the
    // tab still renders.
    const { data: memberRows, error: memberRpcErr } = await supabase
      .schema(currentSchema)
      .rpc('list_household_members', { p_household_id: m.household_id })

    if (memberRpcErr) {
      // eslint-disable-next-line no-console
      console.warn('list_household_members failed —', memberRpcErr.message)
      setMembers([{
        user_id:      user.id,
        role:         m.role,
        joined_at:    m.joined_at,
        display_name: user.user_metadata?.name || user.email || 'You',
        email:        user.email || '',
      }])
    } else {
      setMembers(memberRows || [])
    }

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
    // Refresh Profile's local state AND the shared HouseholdContext so
    // anything keyed off babies (Inventory's current-band sprout, AddItem's
    // default baby, etc.) picks up the change without a reload.
    await Promise.all([load(), refreshHousehold()])
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

        {members.map(m => {
          const isSelf = m.user_id === user?.id
          const name   = m.display_name || m.email || 'Member'
          return (
            <div key={m.user_id} className={styles.memberRow}>
              <div className={styles.memberAvatar} aria-hidden="true">
                {(name[0] || '?').toUpperCase()}
              </div>
              <div className={styles.memberBody}>
                <div className={styles.memberName}>
                  {name}
                  {isSelf && (
                    <span className={styles.memberSelfTag}> · You</span>
                  )}
                </div>
                {m.email && <div className={styles.memberEmail}>{m.email}</div>}
              </div>
              <span className={styles.roleBadge}>
                {m.role === 'owner' ? 'Owner' : 'Member'}
              </span>
            </div>
          )
        })}
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

      {/* ── Receiving outgrown clothes ───────────────────────────────── */}
      {/* Household-level opt-in for the "Send to a Sprigloop family"
          destination on the sender-side pass-along hub. Flag lives on
          the households row (migration 010). Language is intentionally
          neutral — never "families in need"; this is a product-voice
          rule documented in the business plan addendum. */}
      <ReceivingSection
        household={household}
        onUpdated={(patch) => setHousehold(h => ({ ...h, ...patch }))}
      />

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

// ── Receiving outgrown clothes section ─────────────────────────────────
// Household-level opt-in for the "Send to a Sprigloop family" destination
// on the pass-along hub. Backed by migration 010 columns on households:
// accepts_hand_me_downs (legacy column name; data is the receiving opt-in
// flag), accepts_sizes[], accepts_genders[], receiving_paused_until,
// receiving_notes.
//
// Voice rule (not a style preference): never "families in need," never
// "charity." Canonical label is "Open to receiving from another Sprigloop
// family." A household that opts in may be environmentally-motivated,
// thrift-minded, community-minded, or in real financial need — the
// product treats all of those the same, and asks the receiver to self-
// identify as none of them.
//
// Save pattern:
//   • Main toggle saves immediately (optimistic, revert on error).
//   • Size/gender chips save immediately on click (same pattern).
//   • Pause-until date and notes save on blur (textarea + date fields
//     behave poorly with per-keystroke writes).
//
// When toggling OFF we preserve the sub-preferences — if the user flips
// back on they get their prior sizes/genders/notes back. The matching
// query checks accepts_hand_me_downs first, so stale prefs don't leak.

const ALL_SIZES   = ['0-3M','3-6M','6-9M','9-12M','12-18M','18-24M']
const ALL_GENDERS = [
  { id: 'boy',     label: 'Boy'     },
  { id: 'girl',    label: 'Girl'    },
  { id: 'neutral', label: 'Neutral' },
]

function ReceivingSection({ household, onUpdated }) {
  // HouseholdTab only renders us after `household` resolves (loading +
  // error branches return early), so we assume it's populated. An early
  // `if (!household) return null` here would sit *before* the hook
  // declarations below and change the hook count across renders, which
  // React rightly yells about.
  const accepts    = !!household.accepts_hand_me_downs
  const sizes      = household.accepts_sizes   || []
  const genders    = household.accepts_genders || []
  const pausedUntil = household.receiving_paused_until || ''
  const notes       = household.receiving_notes || ''

  // Local drafts for fields that save on blur. Kept in sync with props
  // when the household id changes (e.g. after a re-fetch from outside).
  const [pauseDraft, setPauseDraft] = useState(pausedUntil)
  const [notesDraft, setNotesDraft] = useState(notes)
  const [saving,     setSaving]     = useState(null)  // which field is in-flight
  const [error,      setError]      = useState(null)

  useEffect(() => {
    setPauseDraft(household.receiving_paused_until || '')
    setNotesDraft(household.receiving_notes || '')
    // Intentionally keyed on household.id — drafts should reset when we
    // swap to a different household (future multi-household flows), not
    // every time the parent happens to re-render with the same row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id])

  // Generic write-one-field helper. Pass { field, value, label, track? }.
  // Optimistically reflects in parent state via onUpdated; reverts on error.
  async function writeField(field, value, trackProps) {
    if (saving) return
    setSaving(field)
    setError(null)

    const prev = household[field]
    onUpdated({ [field]: value })  // optimistic

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('households')
      .update({ [field]: value })
      .eq('id', household.id)

    setSaving(null)
    if (updErr) {
      onUpdated({ [field]: prev })  // revert
      setError(updErr.message)
      return false
    }
    if (trackProps) {
      track.receivingPreferencesUpdated(trackProps)
    }
    return true
  }

  // ── Handlers ──────────────────────────────────────────────────────────
  async function toggleAccepts() {
    const next = !accepts
    const prev = accepts
    setSaving('accepts')
    setError(null)
    onUpdated({ accepts_hand_me_downs: next })

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('households')
      .update({ accepts_hand_me_downs: next })
      .eq('id', household.id)

    setSaving(null)
    if (updErr) {
      onUpdated({ accepts_hand_me_downs: prev })
      setError(updErr.message)
      return
    }
    track.receivingOptInToggled({ opted_in: next })
  }

  function toggleSize(size) {
    const next = sizes.includes(size)
      ? sizes.filter(s => s !== size)
      : [...sizes, size]
    // Empty array collapses to null so the DB matching query only needs
    // to handle "null = any size" rather than "null OR empty array = any."
    const value = next.length === 0 ? null : next
    writeField('accepts_sizes', value, { field: 'sizes' })
  }

  function toggleGender(gender) {
    const next = genders.includes(gender)
      ? genders.filter(g => g !== gender)
      : [...genders, gender]
    const value = next.length === 0 ? null : next
    writeField('accepts_genders', value, { field: 'genders' })
  }

  async function commitPause() {
    const trimmed = pauseDraft || null
    if ((trimmed || '') === (pausedUntil || '')) return  // no-op
    const ok = await writeField(
      'receiving_paused_until', trimmed, { field: 'paused_until' },
    )
    if (!ok) setPauseDraft(pausedUntil)
  }

  async function commitNotes() {
    const trimmed = notesDraft.trim() || null
    if ((trimmed || '') === (notes || '')) return  // no-op
    const ok = await writeField(
      'receiving_notes', trimmed, { field: 'notes', has_notes: !!trimmed },
    )
    if (!ok) setNotesDraft(notes)
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>Receiving outgrown clothes</div>

      {error && <div className={styles.fieldError}>{error}</div>}

      <div className={styles.prefRow}>
        <div className={styles.prefRowBody}>
          <div className={styles.prefRowTitle}>
            Open to receiving from another Sprigloop family
          </div>
          <div className={styles.prefRowSub}>
            {accepts
              ? 'A Sprigloop family\u2019s outgrown clothes may be routed to '
                + 'you. We\u2019ll always message you before shipping '
                + 'anything.'
              : 'Turn on to let Sprigloop route another family\u2019s '
                + 'outgrown clothes your way when there\u2019s a match.'}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={accepts}
          aria-label={`Open to receiving from another Sprigloop family — ${accepts ? 'on' : 'off'}`}
          className={
            `${styles.switch} ${accepts ? styles.switchOn : ''} ` +
            (saving === 'accepts' ? styles.switchBusy : '')
          }
          onClick={toggleAccepts}
          disabled={saving === 'accepts'}
        >
          <span className={styles.switchKnob} aria-hidden="true" />
        </button>
      </div>

      {/* Detail preferences — only meaningful when opted in. We render
          them inline (not in a modal) so the controls feel like part of
          the same decision, not a hidden second step. */}
      {accepts && (
        <div className={styles.receivingDetails}>
          {/* Sizes */}
          <div className={styles.receivingField}>
            <div className={styles.receivingFieldLabel}>
              Sizes you&rsquo;d welcome
            </div>
            <div className={styles.receivingFieldHint}>
              Leave all unselected to accept any size.
            </div>
            <div className={styles.chipGroup} role="group" aria-label="Sizes">
              {ALL_SIZES.map(size => {
                const on = sizes.includes(size)
                return (
                  <button
                    key={size}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleSize(size)}
                    disabled={saving === 'accepts_sizes'}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Genders */}
          <div className={styles.receivingField}>
            <div className={styles.receivingFieldLabel}>
              Clothing style
            </div>
            <div className={styles.receivingFieldHint}>
              Leave all unselected to accept anything.
            </div>
            <div className={styles.chipGroup} role="group" aria-label="Clothing style">
              {ALL_GENDERS.map(g => {
                const on = genders.includes(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                    aria-pressed={on}
                    onClick={() => toggleGender(g.id)}
                    disabled={saving === 'accepts_genders'}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pause until */}
          <div className={styles.receivingField}>
            <div className={styles.receivingFieldLabel}>
              Pause receiving until
            </div>
            <div className={styles.receivingFieldHint}>
              Going out of town, no storage space right now? Pick a date
              and we&rsquo;ll skip your household until then.
            </div>
            <div className={styles.receivingRow}>
              <input
                type="date"
                className={styles.receivingDate}
                value={pauseDraft}
                onChange={e => setPauseDraft(e.target.value)}
                onBlur={commitPause}
                disabled={saving === 'receiving_paused_until'}
              />
              {pauseDraft && (
                <button
                  type="button"
                  className={styles.editLink}
                  onClick={() => {
                    setPauseDraft('')
                    writeField('receiving_paused_until', null,
                               { field: 'paused_until' })
                  }}
                  disabled={saving === 'receiving_paused_until'}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className={styles.receivingField}>
            <div className={styles.receivingFieldLabel}>
              Notes for Sprigloop
            </div>
            <div className={styles.receivingFieldHint}>
              Anything we should know when matching batches to your
              household — sibling on the way, a preference, an allergy.
              Only Sprigloop sees this.
            </div>
            <textarea
              className={styles.receivingTextarea}
              rows={3}
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={commitNotes}
              disabled={saving === 'receiving_notes'}
              maxLength={500}
              placeholder="e.g. Baby #2 due in August, so sizes 6-12M would be extra helpful."
            />
          </div>
        </div>
      )}
    </section>
  )
}

// ── Account tab ────────────────────────────────────────────────────────
// Two stacked groups:
//
//   "Your account" — inline-editable display name, email change request, and
//   password update. Supabase owns the primitives: updateUser({ data: ... })
//   for metadata, updateUser({ email }) fires the double-opt-in flow where a
//   confirmation email goes to BOTH the old and new addresses, and
//   updateUser({ password }) sets the password on the active session.
//
//   "Leaving Littleloop" — leave household + delete account. Destructive
//   actions sit here intentionally rather than in their own "Danger zone"
//   tab — that's engineer register, and nobody opens their profile
//   planning to delete their account. Muted styling + a subdued heading
//   keep them findable without over-indexing on a rare, scary action.
//
// Delete-account specifically routes through support-mail rather than
// actually deleting auth.users. A client-side deletion would need a
// SECURITY DEFINER RPC and careful fanout over household_members, babies
// they own, clothing_items, etc. During the beta we'd rather confirm
// intent manually than ship an untested hard-delete pipeline.
function AccountTab() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Sign-out lives on Profile now that ProfileMenu is intentionally absent
  // here (you're already *on* Profile — the avatar dropdown would be
  // confusingly redundant). Plain flat button, not a danger action; we keep
  // it separate from "Leave household" / "Delete account" both visually and
  // semantically because signing out is the everyday action.
  const [signingOut, setSigningOut] = useState(false)
  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    await signOut()
    // Same treatment as ProfileMenu: navigate explicitly to / rather than
    // rely on PublicRoute's eventual redirect, to avoid a momentary flash
    // of a protected page while auth state propagates.
    navigate('/', { replace: true })
  }

  const currentName = user?.user_metadata?.name || ''
  const currentEmail = user?.email || ''

  // ── Name edit ───────────────────────────────────────────────────────
  // Same inline-edit pattern as the household rename (click Edit, save on
  // blur/Enter, Escape cancels). On success we also stash the new name in
  // an optimistic display state so the UI updates before Supabase fires
  // the auth state-change that would eventually refresh `user`.
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(currentName)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState(null)
  const [optimisticName, setOptimisticName] = useState(null)
  const displayName = optimisticName ?? currentName

  // ── Email change ────────────────────────────────────────────────────
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState(currentEmail)
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailError, setEmailError] = useState(null)
  // After requestEmailChange succeeds we store the pending address so the
  // "check your inbox" banner can name it back to the user.
  const [pendingEmail, setPendingEmail] = useState(null)

  // ── Password update ─────────────────────────────────────────────────
  const [pwModalOpen, setPwModalOpen] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  // ── Shipping address ────────────────────────────────────────────────
  // Where we ship pass-along bags TO the user. Same shape as the bag-request
  // form on PassAlongBatch — saved on every successful request, editable
  // here anytime. Source of truth: user.user_metadata.shipping_address.
  const savedShipping = user?.user_metadata?.shipping_address || {}
  const [editingShipping, setEditingShipping] = useState(false)
  const [shipName, setShipName]     = useState(savedShipping.name   || '')
  const [shipStreet, setShipStreet] = useState(savedShipping.street || '')
  const [shipUnit, setShipUnit]     = useState(savedShipping.unit   || '')
  const [shipCity, setShipCity]     = useState(savedShipping.city   || '')
  const [shipState, setShipState]   = useState(savedShipping.state  || '')
  const [shipZip, setShipZip]       = useState(savedShipping.zip    || '')
  const [savingShipping, setSavingShipping] = useState(false)
  const [shippingError, setShippingError]   = useState(null)
  const hasShipping =
    !!(savedShipping.name && savedShipping.street && savedShipping.city &&
       savedShipping.state && savedShipping.zip)

  // ── Danger zone modal state ─────────────────────────────────────────
  // Separate pending flags for the two destructive actions. Each owns its
  // own loading + error so a failed leave attempt doesn't poison the
  // delete-account modal and vice versa.
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSent, setDeleteSent] = useState(false)

  async function saveName() {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setEditingName(false)
      setNameDraft(currentName)
      return
    }
    if (trimmed === currentName) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    setNameError(null)
    const { error: updErr } = await supabase.auth.updateUser({
      data: { name: trimmed },
    })
    setSavingName(false)
    if (updErr) {
      setNameError(updErr.message)
      return
    }
    setOptimisticName(trimmed)
    setEditingName(false)
    track.profileNameUpdated()
  }

  async function saveEmail() {
    const trimmed = emailDraft.trim()
    if (!trimmed || trimmed === currentEmail) {
      setEditingEmail(false)
      setEmailDraft(currentEmail)
      return
    }
    // Minimal client-side shape check — Supabase will reject bad addresses
    // too, but we'd rather not burn a network round-trip on an obvious typo.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('That doesn\u2019t look like a valid email address.')
      return
    }
    setSavingEmail(true)
    setEmailError(null)
    const { error: updErr } = await supabase.auth.updateUser({ email: trimmed })
    setSavingEmail(false)
    if (updErr) {
      setEmailError(updErr.message)
      return
    }
    setPendingEmail(trimmed)
    setEditingEmail(false)
    track.profileEmailChangeRequested()
  }

  async function savePassword() {
    setPwError(null)
    if (newPw.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Passwords don\u2019t match.')
      return
    }
    setSavingPw(true)
    const { error: updErr } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (updErr) {
      setPwError(updErr.message)
      return
    }
    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    track.profilePasswordUpdated()
  }

  function closePwModal() {
    if (savingPw) return
    setPwModalOpen(false)
    setNewPw('')
    setConfirmPw('')
    setPwError(null)
    setPwSuccess(false)
  }

  // ── Save / cancel shipping-address edit ─────────────────────────────
  // Required fields: name, street, city, state, zip (unit is optional —
  // not every house has one and forcing a value would feel hostile).
  // Merge into existing user_metadata so we don't clobber name/prefs/
  // welcome_sent_at — Supabase's updateUser{data} is a shallow merge but
  // we belt-and-brace the merge in JS too for clarity.
  async function saveShippingAddress() {
    setShippingError(null)
    const name = shipName.trim()
    const street = shipStreet.trim()
    const unit = shipUnit.trim()
    const city = shipCity.trim()
    const stateVal = shipState.trim()
    const zip = shipZip.trim()
    if (!name || !street || !city || !stateVal || !zip) {
      setShippingError('Fill in name, street, city, state, and ZIP.')
      return
    }
    setSavingShipping(true)
    const existingMeta = user?.user_metadata || {}
    const { error: updErr } = await supabase.auth.updateUser({
      data: {
        ...existingMeta,
        shipping_address: {
          name,
          street,
          unit: unit || null,
          city,
          state: stateVal,
          zip,
        },
      },
    })
    setSavingShipping(false)
    if (updErr) {
      setShippingError(updErr.message)
      return
    }
    setEditingShipping(false)
    track.profileShippingAddressUpdated?.()
  }

  function cancelShippingEdit() {
    if (savingShipping) return
    // Reset back to whatever's saved so a subsequent Edit click starts
    // from the canonical state, not the in-flight buffer.
    setShipName(savedShipping.name     || '')
    setShipStreet(savedShipping.street || '')
    setShipUnit(savedShipping.unit     || '')
    setShipCity(savedShipping.city     || '')
    setShipState(savedShipping.state   || '')
    setShipZip(savedShipping.zip       || '')
    setShippingError(null)
    setEditingShipping(false)
  }

  // ── Leave household ─────────────────────────────────────────────────
  // Beta-scope policy:
  //   - Member (non-owner): can leave. Deletes their household_members row;
  //     RLS only lets them delete their own row so this is safe.
  //   - Owner with other members: blocked. "Transfer ownership first" — we
  //     don't ship that UI until post-beta, so blocking is the honest answer.
  //   - Sole owner (no other members): blocked with "contact support" copy.
  //     Letting them leave would orphan the household (and every baby +
  //     clothing_items under it) with nothing wired to clean it up yet.
  async function handleLeaveHousehold() {
    if (!user || leaving) return
    setLeaving(true)
    setLeaveError(null)

    // Re-read role + member count at action time so a stale cache can't
    // let the user past the block. A tiny extra query beats an orphaned
    // household caused by a race.
    const { data: myRow, error: myErr } = await supabase
      .schema(currentSchema)
      .from('household_members')
      .select('role, household_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (myErr || !myRow) {
      setLeaving(false)
      setLeaveError(myErr?.message || 'Couldn\u2019t look up your membership.')
      return
    }

    if (myRow.role === 'owner') {
      const { count, error: cntErr } = await supabase
        .schema(currentSchema)
        .from('household_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('household_id', myRow.household_id)

      if (cntErr) {
        setLeaving(false)
        setLeaveError(cntErr.message)
        return
      }

      if ((count ?? 1) <= 1) {
        setLeaving(false)
        setLeaveError(
          'You\u2019re the only one in this household, so leaving would ' +
          'orphan the wardrobe. Email support and we\u2019ll help you wind ' +
          'it down cleanly.',
        )
        track.householdLeaveBlocked({ reason: 'sole_owner' })
        return
      }

      setLeaving(false)
      setLeaveError(
        'You\u2019re the owner. Transfer ownership to another member first — ' +
        'that UI lands post-beta; ping support if you need to leave sooner.',
      )
      track.householdLeaveBlocked({ reason: 'owner_with_members' })
      return
    }

    const { error: delErr } = await supabase
      .schema(currentSchema)
      .from('household_members')
      .delete()
      .eq('user_id', user.id)

    if (delErr) {
      setLeaving(false)
      setLeaveError(delErr.message)
      return
    }

    track.householdLeft({ role: myRow.role })
    // Sign out so the next PublicRoute redirect lands on /. Leaving the
    // session open would send the user to Home, which would then try to
    // re-route to onboarding — but they don't have a household anymore,
    // so that flow would fail in a confusing way. A clean logout and
    // fresh start is kinder.
    await supabase.auth.signOut()
    navigate('/', { replace: true })
  }

  function handleDeleteAccount() {
    // Route through support. Compose a mailto with the user's identifying
    // info pre-filled so we can verify the request without a back-and-forth.
    const subject = encodeURIComponent('Delete my Sprigloop account')
    const body = encodeURIComponent(
      `Hi Sprigloop team,\n\n` +
      `Please delete my account.\n\n` +
      `Email on file: ${currentEmail}\n` +
      `User ID: ${user?.id ?? '(unknown)'}\n\n` +
      `Thanks.`,
    )
    track.accountDeletionRequested()
    window.location.href = `mailto:support@littleloop.app?subject=${subject}&body=${body}`
    setDeleteSent(true)
  }

  return (
    <div className={styles.tabPanel} role="tabpanel">
      {/* ── Your account ───────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Your account</div>

        {/* Name row */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldLabel}>Name</div>
          {editingName ? (
            <div className={styles.fieldEdit}>
              <input
                className={styles.fieldInput}
                type="text"
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') {
                    setNameDraft(currentName)
                    setEditingName(false)
                    setNameError(null)
                  }
                }}
                autoFocus
                disabled={savingName}
                autoComplete="name"
              />
              <button
                type="button"
                className={styles.fieldSave}
                onClick={saveName}
                disabled={savingName || !nameDraft.trim()}
              >
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className={styles.fieldDisplay}>
              <div className={styles.fieldValue}>{displayName || '—'}</div>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => {
                  setNameDraft(displayName)
                  setEditingName(true)
                }}
              >
                Edit
              </button>
            </div>
          )}
          {nameError && <div className={styles.fieldError}>{nameError}</div>}
        </div>

        {/* Email row */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldLabel}>Email</div>
          {editingEmail ? (
            <div className={styles.fieldEdit}>
              <input
                className={styles.fieldInput}
                type="email"
                value={emailDraft}
                onChange={e => setEmailDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEmail()
                  if (e.key === 'Escape') {
                    setEmailDraft(currentEmail)
                    setEditingEmail(false)
                    setEmailError(null)
                  }
                }}
                autoFocus
                disabled={savingEmail}
                autoComplete="email"
              />
              <button
                type="button"
                className={styles.fieldSave}
                onClick={saveEmail}
                disabled={savingEmail || !emailDraft.trim()}
              >
                {savingEmail ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className={styles.fieldDisplay}>
              <div className={styles.fieldValue}>{currentEmail || '—'}</div>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => {
                  setEmailDraft(currentEmail)
                  setEditingEmail(true)
                }}
              >
                Change
              </button>
            </div>
          )}
          {emailError && <div className={styles.fieldError}>{emailError}</div>}
          {pendingEmail && (
            <div className={styles.fieldHint}>
              We sent confirmation links to <strong>{currentEmail}</strong> and{' '}
              <strong>{pendingEmail}</strong>. Click both to finish the change.
            </div>
          )}
        </div>

        {/* Password row */}
        <div className={styles.fieldRow}>
          <div className={styles.fieldLabel}>Password</div>
          <div className={styles.fieldDisplay}>
            <div className={styles.fieldValue}>••••••••</div>
            <button
              type="button"
              className={styles.editLink}
              onClick={() => setPwModalOpen(true)}
            >
              Change
            </button>
          </div>
        </div>
      </section>

      {/* ── Shipping address ─────────────────────────────────────────
          Where Sprigloop ships pass-along bags TO the user. Saved
          automatically on every successful bag request; this section
          exposes a manual edit path so the user can update it without
          starting a batch (e.g. they moved). Source of truth lives on
          user_metadata.shipping_address — same pattern as name/prefs.

          Display mode shows the assembled address (or "Not set" with an
          "Add" affordance). Edit mode reveals the stacked form inline.
          We don't use a modal here because the form is short enough to
          live in the page flow without crowding. */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Shipping address</div>
        <div className={styles.sectionSub}>
          Where we ship pass-along bags to you. We save this automatically when
          you request a bag — edit here if anything changes.
        </div>

        {!editingShipping ? (
          <div className={styles.fieldRow}>
            <div className={styles.fieldDisplay}>
              <div className={styles.fieldValue}>
                {hasShipping ? (
                  <>
                    {savedShipping.name}
                    <br />
                    {savedShipping.street}
                    {savedShipping.unit ? `, ${savedShipping.unit}` : ''}
                    <br />
                    {savedShipping.city}, {savedShipping.state} {savedShipping.zip}
                  </>
                ) : (
                  'Not set'
                )}
              </div>
              <button
                type="button"
                className={styles.editLink}
                onClick={() => {
                  // Re-seed from the canonical saved values so the form
                  // always opens reflecting truth (in case state has
                  // drifted since mount — e.g. another tab saved).
                  setShipName(savedShipping.name     || '')
                  setShipStreet(savedShipping.street || '')
                  setShipUnit(savedShipping.unit     || '')
                  setShipCity(savedShipping.city     || '')
                  setShipState(savedShipping.state   || '')
                  setShipZip(savedShipping.zip       || '')
                  setShippingError(null)
                  setEditingShipping(true)
                }}
              >
                {hasShipping ? 'Edit' : 'Add'}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.shippingForm}>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>Name</div>
              <input
                className={styles.fieldInput}
                type="text"
                value={shipName}
                onChange={e => setShipName(e.target.value)}
                placeholder="e.g. Jane Smith"
                autoComplete="name"
                disabled={savingShipping}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>Street</div>
              <input
                className={styles.fieldInput}
                type="text"
                value={shipStreet}
                onChange={e => setShipStreet(e.target.value)}
                placeholder="123 Main St"
                autoComplete="address-line1"
                disabled={savingShipping}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>Apt / Unit</div>
              <input
                className={styles.fieldInput}
                type="text"
                value={shipUnit}
                onChange={e => setShipUnit(e.target.value)}
                placeholder="Apt 4B (optional)"
                autoComplete="address-line2"
                disabled={savingShipping}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>City</div>
              <input
                className={styles.fieldInput}
                type="text"
                value={shipCity}
                onChange={e => setShipCity(e.target.value)}
                placeholder="Detroit"
                autoComplete="address-level2"
                disabled={savingShipping}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>State</div>
              <input
                className={styles.fieldInput}
                type="text"
                value={shipState}
                onChange={e =>
                  setShipState(e.target.value.toUpperCase().slice(0, 2))
                }
                placeholder="MI"
                maxLength={2}
                autoComplete="address-level1"
                disabled={savingShipping}
              />
            </div>
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>ZIP</div>
              <input
                className={styles.fieldInput}
                type="text"
                inputMode="numeric"
                value={shipZip}
                onChange={e =>
                  setShipZip(e.target.value.replace(/[^0-9-]/g, '').slice(0, 10))
                }
                placeholder="48201"
                autoComplete="postal-code"
                disabled={savingShipping}
              />
            </div>

            {shippingError && (
              <div className={styles.fieldError}>{shippingError}</div>
            )}

            <div className={styles.shippingFormActions}>
              <button
                type="button"
                className={styles.editLink}
                onClick={cancelShippingEdit}
                disabled={savingShipping}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.fieldSave}
                onClick={saveShippingAddress}
                disabled={savingShipping}
              >
                {savingShipping ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Sign out ───────────────────────────────────────────────
          Everyday action: signs this device out and bounces to the
          public landing. Separate from "Leaving Littleloop" because
          that section is destructive — losing your household or account
          is a completely different decision from closing the app. We
          reuse the quietRow layout from Leaving Littleloop (label on
          the left, action on the right) since the shape is the same,
          but this section keeps the default .section styling so it
          doesn't pick up the muted "danger zone" treatment. */}
      <section className={styles.section}>
        <div className={styles.quietRow}>
          <div className={styles.quietRowBody}>
            <div className={styles.quietRowTitle}>Sign out</div>
            <div className={styles.quietRowSub}>
              Sign out of Sprigloop on this device. Your data stays in
              your household.
            </div>
          </div>
          <button
            type="button"
            className={styles.quietBtn}
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </section>

      {/* ── Leaving Sprigloop ────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionQuiet}`}>
        <div className={styles.sectionTitleQuiet}>Leaving Sprigloop</div>

        <div className={styles.quietRow}>
          <div className={styles.quietRowBody}>
            <div className={styles.quietRowTitle}>Leave household</div>
            <div className={styles.quietRowSub}>
              Remove yourself from this household. Other members keep access.
            </div>
          </div>
          <button
            type="button"
            className={styles.quietBtn}
            onClick={() => {
              setLeaveError(null)
              setLeaveOpen(true)
            }}
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
            onClick={() => {
              setDeleteSent(false)
              setDeleteOpen(true)
            }}
          >
            Delete
          </button>
        </div>
      </section>

      {/* ── Password modal ─────────────────────────────────────────── */}
      {pwModalOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !savingPw && closePwModal()}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pw-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="pw-modal-title" className={styles.modalTitle}>
              Change password
            </div>
            {pwSuccess ? (
              <>
                <div className={styles.modalBody}>
                  Password updated. You&rsquo;re still signed in on this device.
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalPrimary}
                    onClick={closePwModal}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalBody}>
                  Pick a new password (at least 8 characters).
                </div>
                <label className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>New password</span>
                  <input
                    type="password"
                    className={styles.modalFieldInput}
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    autoFocus
                    disabled={savingPw}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                <label className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>
                    Confirm new password
                  </span>
                  <input
                    type="password"
                    className={styles.modalFieldInput}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    disabled={savingPw}
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
                {pwError && (
                  <div className={styles.modalError}>{pwError}</div>
                )}
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalCancel}
                    onClick={closePwModal}
                    disabled={savingPw}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.modalPrimary}
                    onClick={savePassword}
                    disabled={savingPw || !newPw || !confirmPw}
                  >
                    {savingPw ? 'Saving…' : 'Update password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Leave household modal ──────────────────────────────────── */}
      {leaveOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !leaving && setLeaveOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="leave-modal-title" className={styles.modalTitle}>
              Leave this household?
            </div>
            <div className={styles.modalBody}>
              You&rsquo;ll lose access to this household&rsquo;s wardrobe on
              this account. The other members keep everything they&rsquo;ve
              added. You can be invited back anytime.
            </div>
            {leaveError && (
              <div className={styles.modalError}>{leaveError}</div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setLeaveOpen(false)}
                disabled={leaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalDanger}
                onClick={handleLeaveHousehold}
                disabled={leaving}
              >
                {leaving ? 'Leaving…' : 'Leave household'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete account modal ───────────────────────────────────── */}
      {deleteOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setDeleteOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="delete-modal-title" className={styles.modalTitle}>
              Delete your account?
            </div>
            {deleteSent ? (
              <>
                <div className={styles.modalBody}>
                  We opened a pre-filled email to our support team. Send it
                  from {currentEmail || 'your email'} and we&rsquo;ll confirm
                  before deleting anything.
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalPrimary}
                    onClick={() => setDeleteOpen(false)}
                  >
                    Got it
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.modalBody}>
                  During the beta we confirm deletions by email so nothing
                  irreversible happens by accident. Tapping Continue opens a
                  pre-filled message to support — just hit send.
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.modalCancel}
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.modalDanger}
                    onClick={handleDeleteAccount}
                  >
                    Continue
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notifications tab ──────────────────────────────────────────────────
// Persisted placeholder: toggle rows DO save to auth.users.raw_user_meta_data.
// prefs, but we don't send any notifications yet. The banner at the top is
// the honest framing — parents can opt in now and their preferences survive
// until the notification + exchange loops ship, at which point we honor
// whatever they'd already set without a second setup pass.
//
// Keys live under a single `prefs` object so adding categories later
// doesn't collide with other future metadata. laundry_reminders / outgrow_
// warnings / exchange_alerts are the notification categories; pass_on /
// receive are the exchange preferences.
const PREF_DEFAULTS = {
  notify: {
    laundry_reminders: true,
    outgrow_warnings: true,
    exchange_alerts: true,
  },
  exchange: {
    pass_on: true,
    receive: true,
  },
}

function NotificationsTab() {
  const { user } = useAuth()

  // Seed from user_metadata so the toggles reflect whatever the user saved
  // on a prior visit. useState gets a lazy initializer to keep the
  // deep-merge out of every render.
  const [prefs, setPrefs] = useState(() => mergePrefs(user?.user_metadata?.prefs))
  const [saving, setSaving] = useState(null) // "notify.laundry_reminders" etc.
  const [error, setError] = useState(null)

  useEffect(() => {
    // Re-seed if the user object updates (e.g. the auth listener fires a
    // refresh after another device changed prefs). Only resets state we
    // haven't just modified — we gate on `saving` being null so an in-
    // flight toggle isn't clobbered by a stale re-seed.
    if (saving) return
    setPrefs(mergePrefs(user?.user_metadata?.prefs))
  }, [user, saving])

  async function toggle(group, key) {
    const next = {
      ...prefs,
      [group]: { ...prefs[group], [key]: !prefs[group][key] },
    }
    const path = `${group}.${key}`
    setPrefs(next)
    setSaving(path)
    setError(null)

    // Merge into existing user_metadata so we don't clobber `name` or any
    // other keys Auth stores alongside prefs.
    const existingMeta = user?.user_metadata || {}
    const { error: updErr } = await supabase.auth.updateUser({
      data: { ...existingMeta, prefs: next },
    })
    setSaving(null)
    if (updErr) {
      // Revert the toggle on failure so the UI doesn't lie about saved
      // state. The error message sits above the sections so it's visible
      // without needing to scroll.
      setPrefs(prefs)
      setError(updErr.message)
      return
    }
    track.prefsUpdated({ key: path, value: next[group][key] })
  }

  return (
    <div className={styles.tabPanel} role="tabpanel">
      {/* Top banner — expectation-setting. Parents who toggle things on
          tonight shouldn't be surprised that their phone stays quiet for
          weeks; this line tells them why. */}
      <div className={styles.prefsBanner}>
        Settings save now, but we&rsquo;ll only start sending anything once
        notifications and the exchange loop are live. Toggling early means
        you&rsquo;re opted in from day one.
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Notifications</div>

        <PrefToggle
          title="Laundry reminders"
          sub="A weekly nudge to rotate clean clothes back into the drawer."
          checked={prefs.notify.laundry_reminders}
          busy={saving === 'notify.laundry_reminders'}
          onToggle={() => toggle('notify', 'laundry_reminders')}
        />
        <PrefToggle
          title="Outgrow warnings"
          sub="Heads-up when a baby is close to sizing out of their current range."
          checked={prefs.notify.outgrow_warnings}
          busy={saving === 'notify.outgrow_warnings'}
          onToggle={() => toggle('notify', 'outgrow_warnings')}
        />
        <PrefToggle
          title="Exchange alerts"
          sub="Ping when a nearby family posts an item you&rsquo;re wishing for."
          checked={prefs.notify.exchange_alerts}
          busy={saving === 'notify.exchange_alerts'}
          onToggle={() => toggle('notify', 'exchange_alerts')}
        />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>Exchange preferences</div>

        <PrefToggle
          title="Pass on outgrown items"
          sub="Let other families claim things your babies have grown out of."
          checked={prefs.exchange.pass_on}
          busy={saving === 'exchange.pass_on'}
          onToggle={() => toggle('exchange', 'pass_on')}
        />
        <PrefToggle
          title="Receive from nearby families"
          sub="See passed-on clothes families within a few miles are offering."
          checked={prefs.exchange.receive}
          busy={saving === 'exchange.receive'}
          onToggle={() => toggle('exchange', 'receive')}
        />
      </section>
    </div>
  )
}

// Tiny toggle row used by NotificationsTab. The visible "switch" is really a
// styled button — pure CSS (no native <input>) so we can lay it out
// predictably across mobile + desktop. `busy` dims it while a save is in
// flight; the outer toggle() still short-circuits spam clicks, this is
// just the visual affordance.
function PrefToggle({ title, sub, checked, busy, onToggle }) {
  return (
    <div className={styles.prefRow}>
      <div className={styles.prefRowBody}>
        <div className={styles.prefRowTitle}>{title}</div>
        <div className={styles.prefRowSub}>{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title} — ${checked ? 'on' : 'off'}`}
        className={
          `${styles.switch} ${checked ? styles.switchOn : ''} ` +
          (busy ? styles.switchBusy : '')
        }
        onClick={onToggle}
        disabled={busy}
      >
        <span className={styles.switchKnob} aria-hidden="true" />
      </button>
    </div>
  )
}

// Merge saved prefs over the defaults so newly-added categories (added in
// code after a user's prefs were first written) still fall back cleanly
// instead of reading `undefined` and rendering a blank toggle.
function mergePrefs(saved) {
  const s = saved || {}
  return {
    notify: { ...PREF_DEFAULTS.notify, ...(s.notify || {}) },
    exchange: { ...PREF_DEFAULTS.exchange, ...(s.exchange || {}) },
  }
}

