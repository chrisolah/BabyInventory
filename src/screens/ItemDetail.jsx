import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import { SLOT_BY_ID, CATEGORY_LABELS } from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import styles from './ItemDetail.module.css'

// Item detail — drill-down view for a single row in beta.clothing_items.
// Route: /item/:id
//
// Responsibilities:
//   - Load the item (RLS enforces household membership, so a bad/id from
//     another household returns an empty result and we render "not found").
//   - Show every field a parent entered, in a single scrollable body.
//   - Offer three actions:
//       1. Edit            → navigate to /item/:id/edit (reuses AddItem)
//       2. Mark as outgrown → UPDATE inventory_status='outgrown' and bounce
//                             back. Hides from Owned + wish-list coverage
//                             views without deleting history. Reserved as
//                             the trigger for the future exchange flow.
//       3. Delete           → confirm-then-hard-delete. There's no undo
//                             anywhere else in the app yet, and soft-delete
//                             would leak into queries that don't filter on
//                             it. A one-step confirm on a destructive action
//                             is the lighter-weight guard.
//
// "Mark as outgrown" is only shown when the item is currently owned or
// needed — already-outgrown rows don't need to be re-outgrown, and for
// needed items the action doesn't really make sense (you're wishing for it,
// you haven't worn it).

const STATUS_LABEL = {
  owned: 'Owned',
  needed: 'On wish list',
  outgrown: 'Outgrown',
  pass_along: 'In pass-along batch',
  donated: 'Donated',
  exchanged: 'Exchanged',
}

const CONDITION_LABEL = {
  new: 'New (with tags)',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
}

const SEASON_LABEL = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
  all_season: 'All-season',
}

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
}

export default function ItemDetail() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState(null)
  const [error, setError] = useState(null)

  // Destructive-action state. `pendingAction` drives the confirm modal copy
  // + primary-button handler so we can reuse one modal for both Delete and
  // Mark-as-outgrown (same layout, different verbs + consequences).
  const [pendingAction, setPendingAction] = useState(null) // 'delete' | 'outgrow' | null
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Pass-along batch metadata. When the item is currently packed in a
  // batch (inventory_status='pass_along' + pass_along_batch_id set), we
  // fetch the batch's reference_code so the UI can show the user which
  // batch the item is in and let them jump to it. Separate fetch rather
  // than a join because the batches table has its own RLS policy and
  // PostgREST would need an explicit relationship setup for an embed.
  const [batchInfo, setBatchInfo] = useState(null) // { id, reference_code } | null

  // ── Load the item ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error: loadErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return
      if (loadErr) {
        setError(loadErr.message)
        setLoading(false)
        return
      }
      setItem(data || null)

      // If the item is packed in a batch, grab the reference_code so the
      // UI can show it + link to the batch. If the batch has been deleted
      // since (FK set-null leaves pass_along_batch_id null anyway), this
      // just returns no row and we silently skip the chip.
      if (data?.pass_along_batch_id) {
        const { data: bRow } = await supabase
          .schema(currentSchema)
          .from('pass_along_batches')
          .select('id, reference_code')
          .eq('id', data.pass_along_batch_id)
          .maybeSingle()
        if (!cancelled) setBatchInfo(bRow || null)
      } else {
        setBatchInfo(null)
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user, id])

  // ── Derived labels ─────────────────────────────────────────────────────
  const slot = item?.item_type ? SLOT_BY_ID[item.item_type] : null
  const typeLabel = slot?.label || humanizeItemType(item?.item_type)
  const categoryLabel =
    CATEGORY_LABELS[item?.category] || humanizeItemType(item?.category)

  // Mark-as-outgrown only makes sense for items the family currently has
  // checked in as owned. For needed/outgrown/donated/exchanged rows we hide
  // the button rather than gate it with a disabled state — less visual
  // noise, and "outgrown" is a niche action in the first place.
  const canMarkOutgrown = item?.inventory_status === 'owned'

  // "Send this on" is available for items you still have (owned) or have
  // already outgrown but haven't disposed of. It's hidden for wish-list
  // rows (you don't own them), pass_along rows (already in a batch — we
  // show the batch chip instead), and donated/exchanged rows (the item is
  // already gone).
  const canSendOn =
    item?.inventory_status === 'owned' ||
    item?.inventory_status === 'outgrown'
  const inBatch = !!item?.pass_along_batch_id

  // ── Actions ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!item || working) return
    setWorking(true)
    setActionError(null)

    const { error: delErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .delete()
      .eq('id', item.id)

    setWorking(false)
    if (delErr) {
      setActionError(delErr.message)
      return
    }

    track.itemDeleted({
      category: item.category,
      size_label: item.size_label,
      inventory_status: item.inventory_status,
    })
    // navigate(-1) would try to return to wherever the user came from, but
    // that could be the Edit screen or an old slot detail whose data is now
    // stale. Going to /inventory is the predictable landing spot.
    navigate('/inventory')
  }

  // ── "Send this on" — add to a draft batch ─────────────────────────────
  // Flow: find the household's most recent draft batch; create one if there
  // isn't one; link the item (pass_along_batch_id + inventory_status =
  // 'pass_along'); navigate to the batch detail screen so the user sees
  // their item appear in context and can keep packing or ship.
  //
  // We deliberately don't make the user pick a batch in this flow — the
  // most common case is "I'm adding the first outgrown onesie, where does
  // it go," and surfacing the picker creates friction before there's any.
  // Power users who want a second draft going can start one from the list.
  async function handleSendOn() {
    if (!item || !user || working) return
    if (!canSendOn) return
    setWorking(true)
    setActionError(null)

    // 1. Find the most recent open draft for this household. RLS scopes the
    //    query automatically — no need to filter on household_id here
    //    because the batch row's RLS uses is_household_member. We still
    //    need the household_id for the INSERT branch below, so we derive
    //    it from the item (clothing_items.household_id always matches).
    const { data: drafts, error: findErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .select('id')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)

    if (findErr) {
      setWorking(false)
      setActionError(findErr.message)
      return
    }

    let batchId = drafts?.[0]?.id
    let createdNew = false

    if (!batchId) {
      const { data: newBatch, error: insErr } = await supabase
        .schema(currentSchema)
        .from('pass_along_batches')
        .insert({
          household_id: item.household_id,
          created_by: user.id,
          destination_type: 'littleloop',
        })
        .select('id')
        .maybeSingle()
      if (insErr || !newBatch) {
        setWorking(false)
        setActionError(insErr?.message || 'Couldn’t start a new batch.')
        return
      }
      batchId = newBatch.id
      createdNew = true
      track.passAlongBatchCreated({ id: batchId, from: 'item_detail' })
    }

    // 2. Link the item into the batch. inventory_status flip keeps the
    //    item out of Owned/Outgrown views while it's packed.
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        pass_along_batch_id: batchId,
        inventory_status: 'pass_along',
      })
      .eq('id', item.id)

    setWorking(false)
    if (updErr) {
      setActionError(updErr.message)
      return
    }

    track.passAlongItemAdded({
      from: 'item_detail',
      batch_id: batchId,
      created_new_batch: createdNew,
      category: item.category,
      size_label: item.size_label,
    })
    navigate(`/pass-along/${batchId}`)
  }

  async function handleMarkOutgrown() {
    if (!item || working) return
    setWorking(true)
    setActionError(null)

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({ inventory_status: 'outgrown' })
      .eq('id', item.id)

    setWorking(false)
    if (updErr) {
      setActionError(updErr.message)
      return
    }

    track.itemMarkedOutgrown({
      category: item.category,
      size_label: item.size_label,
    })
    navigate('/inventory')
  }

  function confirmLabel() {
    if (pendingAction === 'delete') return 'Delete item'
    if (pendingAction === 'outgrow') return 'Mark as outgrown'
    return ''
  }

  function confirmBody() {
    if (pendingAction === 'delete') {
      return 'This removes the item permanently. You can\u2019t undo this.'
    }
    if (pendingAction === 'outgrow') {
      return 'Moves this item out of your active wardrobe. You\u2019ll still be able to pass it on when the exchange launches.'
    }
    return ''
  }

  function runPendingAction() {
    if (pendingAction === 'delete') return handleDelete()
    if (pendingAction === 'outgrow') return handleMarkOutgrown()
  }

  // ── Not found / load error ─────────────────────────────────────────────
  if (!loading && (error || !item)) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/inventory')}
            aria-label="Back to inventory"
          >
            ←
          </button>
          <div className={styles.titleBlock}>
            <div className={styles.title}>Not found</div>
            <IvySprig />
          </div>
          <ProfileMenu />
        </header>
        <main className={styles.body}>
          <div className={styles.error}>
            {error
              ? `Couldn\u2019t load this item: ${error}`
              : 'This item isn\u2019t in your wardrobe anymore.'}{' '}
            <button
              className={styles.linkBtn}
              type="button"
              onClick={() => navigate('/inventory')}
            >
              Back to inventory
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────
  const displayName = item?.name || typeLabel
  const statusLabel = STATUS_LABEL[item?.inventory_status] || item?.inventory_status

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/inventory')}
          aria-label="Back to inventory"
        >
          ←
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.title}>{loading ? 'Item' : displayName}</div>
          {!loading && item && (
            <div className={styles.subtitle}>
              {[item.size_label, categoryLabel].filter(Boolean).join(' · ')}
            </div>
          )}
          {/* Mobile-only sprig beneath the subtitle. Hidden on desktop. */}
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && item && (
          <>
            {/* Status card — biggest at-a-glance chunk: big name + status
                pill, then a compact grid of every other field. */}
            <section className={styles.summary}>
              <div className={styles.summaryTop}>
                <div className={styles.itemThumb} aria-hidden="true" />
                <div className={styles.summaryText}>
                  <div className={styles.summaryName}>{displayName}</div>
                  <div className={styles.summaryMeta}>{typeLabel}</div>
                </div>
                <span
                  className={
                    `${styles.statusPill} ` +
                    (item.inventory_status === 'owned' ? styles.statusPillOwned :
                     item.inventory_status === 'needed' ? styles.statusPillWish :
                     styles.statusPillNeutral)
                  }
                >
                  {statusLabel}
                </span>
              </div>
            </section>

            {/* Details section — only renders fields that are actually set,
                so a minimally-filled item doesn't look empty. */}
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Details</div>
              <dl className={styles.detailList}>
                <DetailRow label="Category" value={categoryLabel} />
                <DetailRow label="Type" value={typeLabel} />
                <DetailRow label="Size" value={item.size_label} />
                {item.quantity > 1 && (
                  <DetailRow label="Quantity" value={`×${item.quantity}`} />
                )}
                {item.condition && (
                  <DetailRow
                    label="Condition"
                    value={CONDITION_LABEL[item.condition] || item.condition}
                  />
                )}
                {item.priority && (
                  <DetailRow
                    label="Priority"
                    value={PRIORITY_LABEL[item.priority] || item.priority}
                  />
                )}
                {item.brand && <DetailRow label="Brand" value={item.brand} />}
                {item.season && (
                  <DetailRow
                    label="Season"
                    value={SEASON_LABEL[item.season] || item.season}
                  />
                )}
              </dl>
            </section>

            {item.notes && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Notes</div>
                <div className={styles.notes}>{item.notes}</div>
              </section>
            )}

            {actionError && (
              <div className={styles.error}>
                Something went wrong: {actionError}
              </div>
            )}

            {/* "In pass-along batch" callout — shown when the item is
                already packed. Renders as a quiet info card with a link
                to the batch rather than an action button; the user's
                decision has been made, we just surface where the item went. */}
            {inBatch && (
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Pass-along</div>
                <button
                  type="button"
                  className={styles.batchLink}
                  onClick={() =>
                    navigate(`/pass-along/${item.pass_along_batch_id}`)
                  }
                >
                  <div>
                    <div className={styles.batchLinkTop}>
                      In pass-along batch
                    </div>
                    <div className={styles.batchLinkRef}>
                      {batchInfo?.reference_code || 'Open batch'}
                    </div>
                  </div>
                  <span className={styles.batchLinkChevron} aria-hidden="true">›</span>
                </button>
              </section>
            )}

            {/* Action stack — edit first (most common), then the pass-along
                + outgrow affordances (only when applicable), delete last
                in destructive styling. */}
            <section className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => navigate(`/item/${item.id}/edit`)}
              >
                Edit item
              </button>

              {canSendOn && !inBatch && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleSendOn}
                  disabled={working}
                >
                  {working ? 'Working…' : 'Send this on'}
                </button>
              )}

              {canMarkOutgrown && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setPendingAction('outgrow')}
                  disabled={working}
                >
                  Mark as outgrown
                </button>
              )}

              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => setPendingAction('delete')}
                disabled={working}
              >
                Delete item
              </button>
            </section>
          </>
        )}
      </main>

      {/* Confirm modal — blocks interaction while visible. Tapping the
          backdrop or Cancel dismisses without acting; only the primary
          button commits the action. */}
      {pendingAction && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !working && setPendingAction(null)}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-confirm-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="item-confirm-title" className={styles.modalTitle}>
              {confirmLabel()}?
            </div>
            <div className={styles.modalBody}>{confirmBody()}</div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setPendingAction(null)}
                disabled={working}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  pendingAction === 'delete'
                    ? styles.modalDanger
                    : styles.modalPrimary
                }
                onClick={runPendingAction}
                disabled={working}
              >
                {working ? 'Working…' : confirmLabel()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Small two-column row for the Details dl. Keeps the label column a fixed
// width so every row lines up, and lets the value column wrap naturally.
function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className={styles.detailRow}>
      <dt className={styles.detailLabel}>{label}</dt>
      <dd className={styles.detailValue}>{value}</dd>
    </div>
  )
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
