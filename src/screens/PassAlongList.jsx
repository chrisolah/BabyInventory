import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import styles from './PassAlongList.module.css'

// PassAlongList — top-level hub for community exchange on the sender side.
// Route: /pass-along
//
// Shows every batch the household has touched, grouped by lifecycle stage
// so the most actionable rows (drafts you haven't shipped yet) sit at the
// top. Tapping a card opens PassAlongBatch. A primary CTA starts a fresh
// draft with the default Sprigloop destination and navigates into it.
//
// This screen intentionally doesn't try to render item counts as a live
// sub-query per row — it reads a precomputed `item_count` via a two-step
// fetch (one batch select, one grouped clothing_items select) so the
// list stays cheap even with dozens of historical batches.

const DESTINATION_LABEL = {
  littleloop: 'Sprigloop',
  family: 'Another Sprigloop family',
  person: 'A friend or family member',
  charity: 'A charity',
}

const STATUS_LABEL = {
  draft: 'Draft',
  shipped: 'Shipped',
  received: 'Received at Sprigloop',
  fulfilled: 'Fulfilled',
  canceled: 'Canceled',
}

// Map a batch row into one of three lifecycle buckets. Drafts sit at the
// top because they're the only rows the user has unfinished business with.
// In-flight shows what's moving through the system. Closed is the history
// tail — collapsed below, but visible so users can look back.
function bucketFor(batch) {
  if (batch.status === 'draft') return 'drafts'
  if (batch.status === 'shipped' || batch.status === 'received') return 'inFlight'
  return 'closed' // fulfilled | canceled
}

const BUCKET_ORDER = ['drafts', 'inFlight', 'closed']
const BUCKET_LABEL = {
  drafts: 'Drafts',
  inFlight: 'In flight',
  closed: 'Closed',
}

export default function PassAlongList() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { household, loading: householdLoading, error: householdError } = useHousehold()

  // Starts false so the page doesn't show a stuck spinner when the
  // useEffect early-returns (e.g. no household yet, or no household at
  // all). Only flips to true once we actually start a fetch.
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [counts, setCounts] = useState({}) // batchId → item count
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !household?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data: batchRows, error: bErr } = await supabase
        .schema(currentSchema)
        .from('pass_along_batches')
        .select(
          'id, reference_code, destination_type, status, outcome, shipped_at, fulfilled_at, created_at, updated_at'
        )
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (bErr) {
        setError(bErr.message)
        setLoading(false)
        return
      }

      const rows = batchRows || []
      setBatches(rows)

      // Fetch item counts per batch in a single query. We only need the
      // pass_along_batch_id + id columns; grouping is done client-side.
      // This scales fine for the batch volumes we expect per household
      // (tens, not thousands).
      if (rows.length > 0) {
        const batchIds = rows.map(r => r.id)
        const { data: itemRows, error: iErr } = await supabase
          .schema(currentSchema)
          .from('clothing_items')
          .select('id, pass_along_batch_id')
          .in('pass_along_batch_id', batchIds)

        if (cancelled) return
        if (iErr) {
          // Not fatal — list still renders, items just show as "—"
          setError(iErr.message)
        } else {
          const c = {}
          for (const r of itemRows || []) {
            c[r.pass_along_batch_id] = (c[r.pass_along_batch_id] || 0) + 1
          }
          setCounts(c)
        }
      } else {
        setCounts({})
      }

      setLoading(false)
      track.passAlongListViewed({
        total: rows.length,
        drafts: rows.filter(r => r.status === 'draft').length,
        in_flight: rows.filter(r => r.status === 'shipped' || r.status === 'received').length,
        closed: rows.filter(r => r.status === 'fulfilled' || r.status === 'canceled').length,
      })
    }

    load()
    return () => { cancelled = true }
  }, [user, household?.id])

  // ── Group rows into buckets for rendering ──────────────────────────────
  const buckets = useMemo(() => {
    const b = { drafts: [], inFlight: [], closed: [] }
    for (const row of batches) {
      b[bucketFor(row)].push(row)
    }
    return b
  }, [batches])

  // ── Create a fresh draft batch ─────────────────────────────────────────
  // Default to Sprigloop destination — the most common/recommended path
  // per the product framing. The user can switch on the detail screen
  // before adding items or shipping.
  async function handleCreate() {
    if (!household?.id || !user?.id || creating) return
    setCreating(true)
    setCreateError(null)

    const { data, error: insErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .insert({
        household_id: household.id,
        created_by: user.id,
        destination_type: 'littleloop',
        // status defaults to 'draft', reference_code auto-generated
      })
      .select('id, reference_code')
      .maybeSingle()

    setCreating(false)
    if (insErr || !data) {
      setCreateError(insErr?.message || 'Couldn’t start a new batch.')
      return
    }

    track.passAlongBatchCreated({
      id: data.id,
      from: 'list',
    })
    navigate(`/pass-along/${data.id}`)
  }

  // ── Not-yet-ready states ───────────────────────────────────────────────
  const pageLoading = householdLoading || loading
  // Distinct from "loading" — context finished but came back with no
  // household. Surface this with copy instead of leaving the user
  // staring at an empty page (or, before the loading-init fix, a
  // permanent spinner).
  const noHousehold = !householdLoading && !householdError && !household

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/home')}
          aria-label="Back to home"
        >
          ←
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>Pass-along</div>
          <div className={styles.subtitle}>
            {batches.length > 0
              ? `${batches.length} batch${batches.length === 1 ? '' : 'es'}`
              : 'Community exchange'}
          </div>
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      <main className={styles.body}>
        {householdError && (
          <div className={styles.errorBanner}>
            Couldn’t load household: {householdError}
          </div>
        )}
        {error && !householdError && (
          <div className={styles.errorBanner}>
            Couldn’t load batches: {error}
          </div>
        )}

        {pageLoading && <div className={styles.loading}>Loading…</div>}

        {noHousehold && (
          <div className={styles.errorBanner}>
            No household yet — finish onboarding first to start passing
            clothes along.
          </div>
        )}

        {!pageLoading && !householdError && !noHousehold && (
          <>
            {/* Intro blurb — useful for first-time visitors and a gentle
                reminder for returning users of what the four destinations
                mean. Kept brief; the full explainer lives on the detail
                screen + landing page. */}
            <section className={styles.intro}>
              <div className={styles.introTitle}>Send clothes on to their next home</div>
              <div className={styles.introBody}>
                Bundle outgrown items into a batch and ship the box to
                Sprigloop, a charity, a friend or family member, or
                another Sprigloop family.
              </div>
            </section>

            {createError && (
              <div className={styles.errorBanner}>
                Couldn’t start a new batch: {createError}
              </div>
            )}

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Starting…' : 'Start a new batch'}
            </button>

            {batches.length === 0 ? (
              <div className={styles.emptyCard}>
                No batches yet. When you’ve got a pile of outgrown clothes,
                start one here — we’ll walk you through packing and shipping.
              </div>
            ) : (
              BUCKET_ORDER.map(key => {
                const rows = buckets[key]
                if (rows.length === 0) return null
                return (
                  <section key={key} className={styles.group}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupLabel}>
                        {BUCKET_LABEL[key]}
                      </span>
                      <span className={styles.groupCount}>
                        {rows.length}
                      </span>
                    </div>
                    <ul className={styles.cardList}>
                      {rows.map(row => (
                        <BatchCard
                          key={row.id}
                          batch={row}
                          itemCount={counts[row.id] || 0}
                          onClick={() => navigate(`/pass-along/${row.id}`)}
                        />
                      ))}
                    </ul>
                  </section>
                )
              })
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

// One batch in the list. Ref code in body font (monospace-adjacent via
// letter-spacing), destination as the secondary line, and a status pill
// on the right so the user can scan the list by state at a glance.
function BatchCard({ batch, itemCount, onClick }) {
  const destLabel = DESTINATION_LABEL[batch.destination_type] || batch.destination_type
  const statusLabel = STATUS_LABEL[batch.status] || batch.status

  // Show the most recent meaningful timestamp: fulfilled > shipped > created.
  // Gives the user a chronological anchor without needing three date rows.
  const date =
    batch.fulfilled_at ||
    batch.shipped_at ||
    batch.created_at
  const dateLabel = date ? new Date(date).toLocaleDateString() : ''

  const pillClass =
    batch.status === 'fulfilled' ? styles.pillFulfilled :
    batch.status === 'shipped' || batch.status === 'received' ? styles.pillActive :
    batch.status === 'canceled' ? styles.pillCanceled :
    styles.pillDraft

  return (
    <li>
      <button
        type="button"
        className={styles.card}
        onClick={onClick}
      >
        <div className={styles.cardBody}>
          <div className={styles.cardRef}>{batch.reference_code}</div>
          <div className={styles.cardMeta}>
            <span>{destLabel}</span>
            <span className={styles.cardDot} aria-hidden="true">·</span>
            <span>
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
            {dateLabel && (
              <>
                <span className={styles.cardDot} aria-hidden="true">·</span>
                <span>{dateLabel}</span>
              </>
            )}
          </div>
        </div>
        <span className={`${styles.pill} ${pillClass}`}>{statusLabel}</span>
        <span className={styles.cardChevron} aria-hidden="true">›</span>
      </button>
    </li>
  )
}
