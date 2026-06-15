import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import { SLOT_BY_ID, CATEGORY_LABELS } from '../lib/wardrobe'
import { ITEM_BY_ID, SUB_CATEGORY_LABELS, CATEGORY_META } from '../lib/categories'
import HeaderActions from '../components/HeaderActions'
import IvySprig from '../components/IvySprig'
import Eyebrow from '../components/Eyebrow'
import styles from './ItemDetail.module.css'

// Item detail — drill-down view for a single row in beta.clothing_items.
// Route: /item/:id
//
// Responsibilities:
//   - Load the item (RLS enforces household membership, so a bad/id from
//     another household returns an empty result and we render "not found").
//   - Show every field a parent entered, in a single scrollable body.
//   - Offer status-aware actions (post-2026-04-29 redesign):
//       1. Edit                → navigate to /item/:id/edit (reuses AddItem)
//       2. Pass on              → flip to 'pass_along' + attach to a draft
//                                 bag. Shown for owned, kept, and legacy
//                                 outgrown rows. Hidden when the item is
//                                 already in a bag.
//       3. Tuck away            → flip to 'kept'. Shown for owned + legacy
//                                 outgrown rows. Items the household is
//                                 keeping (sibling/keepsake) instead of
//                                 routing through pass-along.
//       4. Move back to Owned   → flip 'kept' back to 'owned'. Shown for
//                                 kept rows only. The reversal path for
//                                 "sibling is now wearing them."
//       5. Delete               → confirm-then-hard-delete. There's no
//                                 undo anywhere else in the app yet, and
//                                 soft-delete would leak into queries that
//                                 don't filter on it.

const STATUS_LABEL = {
  owned: 'Owned',
  needed: 'On wish list',
  outgrown: 'Outgrown',
  pass_along: 'In a bag',
  kept: 'Tucked away',
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

// Season values match the new warm/cold/all-season axis (migration 035,
// 2026-05-05). Old spring/summer/fall/winter values were backfilled to
// warm_weather or cold_weather; this map only needs the three keys now.
const SEASON_LABEL = {
  warm_weather: 'Warm weather',
  cold_weather: 'Cold weather',
  all_season:   'All-season',
}

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
}

export default function ItemDetail() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { reloadItems } = useHousehold()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState(null)
  const [itemTable, setItemTable] = useState('clothing_items') // 'clothing_items' | 'items'
  const [error, setError] = useState(null)

  // Destructive-action state. `pendingAction` drives the confirm modal
  // copy + primary-button handler. Currently only 'delete' uses the modal;
  // Tuck away and Move back to Owned are non-destructive and skip the
  // confirm step (they're reversible from the bottom-of-Owned section).
  const [pendingAction, setPendingAction] = useState(null) // 'delete' | null
  const [working, setWorking] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Pass-along batch metadata. When the item is currently packed in a
  // batch (inventory_status='pass_along' + pass_along_batch_id set), we
  // fetch the batch's reference_code so the UI can show the user which
  // batch the item is in and let them jump to it. Separate fetch rather
  // than a join because the batches table has its own RLS policy and
  // PostgREST would need an explicit relationship setup for an embed.
  const [batchInfo, setBatchInfo] = useState(null) // { id, reference_code } | null

  // Garment photo signed URL. Resolved alongside the item load when
  // garment_photo_path is set. URL expires after 1 hour; users who keep
  // ItemDetail open longer would see a broken image until refresh —
  // acceptable for v1. Falls back to null when no photo exists or the
  // signing call fails (UI hides the photo block in either case).
  const [garmentSignedUrl, setGarmentSignedUrl] = useState(null)

  // ── Load the item ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return
    let cancelled = false

    async function load() {
      setLoading(true)

      // Try clothing_items first; if no row, fall back to beta.items.
      // This keeps the load path simple — we don't need to know up front
      // which table the id belongs to, and both tables use the same UUID
      // namespace so there's no collision risk.
      let data = null
      let table = 'clothing_items'

      const { data: clothingRow, error: clothingErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return
      if (clothingErr) {
        setError(clothingErr.message)
        setLoading(false)
        return
      }

      if (clothingRow) {
        data = clothingRow
      } else {
        // Not in clothing_items — try the general items table.
        const { data: catRow, error: catErr } = await supabase
          .schema(currentSchema)
          .from('items')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (cancelled) return
        if (catErr) {
          setError(catErr.message)
          setLoading(false)
          return
        }
        data = catRow
        table = 'items'
      }

      setItem(data || null)
      setItemTable(table)

      // Resolve the garment photo signed URL when the column is set.
      // Single signing call per item — fast enough that we don't bother
      // batching with the next fetch. Errors degrade silently to no
      // photo block (logged so a flaky bucket issue is debuggable).
      const photoPath = data?.garment_photo_path ?? data?.item_photo_path ?? null
      if (photoPath) {
        const { data: signed, error: signErr } = await supabase.storage
          .from('garment-photos')
          .createSignedUrl(photoPath, 60 * 60)
        if (cancelled) return
        if (signErr) {
          // eslint-disable-next-line no-console
          console.warn('garment signed URL failed', signErr)
          setGarmentSignedUrl(null)
        } else {
          setGarmentSignedUrl(signed?.signedUrl || null)
        }
      } else {
        setGarmentSignedUrl(null)
      }

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

  const isClothing = itemTable === 'clothing_items'

  // ── Derived labels ─────────────────────────────────────────────────────
  // Clothing: look up from wardrobe.js slot taxonomy.
  // Non-clothing: look up from categories.js item taxonomy.
  const slot = isClothing && item?.item_type ? SLOT_BY_ID[item.item_type] : null
  const catSlot = !isClothing && item?.item_type ? ITEM_BY_ID[item.item_type] : null

  // Individual-item context: prefer singular ("One-piece") over label ("One-pieces").
  const typeLabel = slot?.singular || slot?.label
    || catSlot?.singular || catSlot?.label
    || humanizeItemType(item?.item_type)

  // Clothing uses the clothing category label; non-clothing uses CATEGORY_META.
  const categoryLabel = isClothing
    ? (CATEGORY_LABELS[item?.category] || humanizeItemType(item?.category))
    : (CATEGORY_META[item?.top_category]?.label || humanizeItemType(item?.top_category))

  const subCategoryLabel = !isClothing && item?.sub_category
    ? (SUB_CATEGORY_LABELS[item.sub_category] || humanizeItemType(item.sub_category))
    : null

  // Tuck-away is the alternative path for items the family is keeping for
  // sibling/keepsake/etc. — it flips inventory_status to 'kept'. Available
  // from owned and legacy outgrown rows. Hidden for wish-list / pass_along
  // / donated / exchanged / already-kept rows.
  const canTuckAway =
    item?.inventory_status === 'owned' ||
    item?.inventory_status === 'outgrown'

  // Return-to-Owned is the inverse path off the kept state — sibling is
  // wearing them now, or the parent decided to use them after all. Only
  // shown for kept rows.
  const canReturnToOwned = item?.inventory_status === 'kept'

  // "Send this on" is available for items you still have (owned), have
  // already outgrown but haven't disposed of, or are keeping (since kept
  // rows can always be reclassified to pass-along — that's the locked
  // 2026-04-29 design constraint). Hidden for wish-list, pass_along (the
  // item already lives on the bag page), and donated/exchanged.
  const canSendOn =
    item?.inventory_status === 'owned' ||
    item?.inventory_status === 'outgrown' ||
    item?.inventory_status === 'kept'
  const inBatch = !!item?.pass_along_batch_id

  // ── Actions ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!item || working) return
    setWorking(true)
    setActionError(null)

    // Cascade-delete the garment photo from storage if one exists.
    // Best-effort: a failure to remove the object doesn't block the
    // row delete (we'd rather honor the user's "delete this" intent
    // than refuse because of a storage hiccup), but logged so any
    // bucket-level issue is debuggable. Done BEFORE the row delete
    // so we still have the path on hand and the user's session
    // matches the path's household for the RLS check.
    const deletePhotoPath = item.garment_photo_path ?? item.item_photo_path ?? null
    if (deletePhotoPath) {
      try {
        const { error: storageErr } = await supabase.storage
          .from('garment-photos')
          .remove([deletePhotoPath])
        if (storageErr) {
          // eslint-disable-next-line no-console
          console.warn('garment photo delete failed', storageErr)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('garment photo delete threw', e)
      }
    }

    const { error: delErr } = await supabase
      .schema(currentSchema)
      .from(itemTable)
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
    // Kick the shared items list so Inventory/Home reflect the deletion
    // without waiting for the next mount-driven fetch.
    reloadItems()
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
          destination_type: 'family',
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
    //    pre_bag_inventory_status remembers the item's origin so removeItem
    //    in PassAlongBatch can restore it correctly (Owned vs Tucked away
    //    vs legacy outgrown) instead of forcing every removal to 'owned'.
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        pass_along_batch_id: batchId,
        inventory_status: 'pass_along',
        pre_bag_inventory_status: item.inventory_status,
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
    // Status flipped to pass_along — refresh the shared list so Inventory
    // stops showing this row as Owned when the user backs out.
    reloadItems()
    navigate(`/pass-along/${batchId}`)
  }

  // Tuck away — flip the item to 'kept' status. No confirm modal: kept is
  // a non-destructive state (the item stays in the household) and it's
  // fully reversible from this same screen via Move back to Owned, or
  // from the bottom-of-Owned section's chip toggle.
  async function handleTuckAway() {
    if (!item || working) return
    setWorking(true)
    setActionError(null)

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(itemTable)
      .update({ inventory_status: 'kept' })
      .eq('id', item.id)

    setWorking(false)
    if (updErr) {
      setActionError(updErr.message)
      return
    }

    track.itemTuckedAway?.({ id: item.id, from: 'item_detail' })
    reloadItems()
    navigate('/inventory')
  }

  // Move back to Owned — flip a kept item back to 'owned'. Mirror inverse
  // of Tuck away. No confirm modal: also non-destructive and reversible.
  async function handleReturnToOwned() {
    if (!item || working) return
    setWorking(true)
    setActionError(null)

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(itemTable)
      .update({ inventory_status: 'owned' })
      .eq('id', item.id)

    setWorking(false)
    if (updErr) {
      setActionError(updErr.message)
      return
    }

    track.itemReturnedToOwned?.({ id: item.id, from: 'item_detail' })
    reloadItems()
    navigate('/inventory')
  }

  function confirmLabel() {
    if (pendingAction === 'delete') return 'Delete item'
    return ''
  }

  function confirmBody() {
    if (pendingAction === 'delete') {
      return 'This removes the item permanently. You can\u2019t undo this.'
    }
    return ''
  }

  function runPendingAction() {
    if (pendingAction === 'delete') return handleDelete()
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
          <HeaderActions />
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
              {isClothing
                ? [item.size_label, categoryLabel].filter(Boolean).join(' · ')
                : [categoryLabel, subCategoryLabel].filter(Boolean).join(' · ')
              }
            </div>
          )}
          {/* Mobile-only sprig beneath the subtitle. Hidden on desktop. */}
          <IvySprig />
        </div>
        <HeaderActions />
      </header>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && item && (
          <>
            {/* Status card — biggest at-a-glance chunk: big name + status
                pill, then a compact grid of every other field. */}
            <section className={styles.summary}>
              <div className={styles.summaryTop}>
                {/* Thumb slot. When the row has a stored garment photo
                    we render it as the visual identity for the item;
                    otherwise the slot stays as the empty placeholder
                    block (which is what shipped pre-Phase-2). */}
                {garmentSignedUrl ? (
                  <img
                    src={garmentSignedUrl}
                    alt=""
                    className={`${styles.itemThumb} ${styles.itemThumbPhoto}`}
                    aria-hidden="true"
                  />
                ) : (
                  <div className={styles.itemThumb} aria-hidden="true">
                    {isClothing
                      ? item.size_label && (
                          <span className={styles.itemThumbSize}>{item.size_label}</span>
                        )
                      : <span className={styles.itemThumbSize}>{categoryLabel?.[0] || '—'}</span>
                    }
                  </div>
                )}
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
                so a minimally-filled item doesn't look empty.
                Eyebrow pill replaces the small uppercase DM Sans title
                (added 2026-05-01) to mirror the section-opener motif from
                the landing. Teal because Details is the primary content
                section on this surface. */}
            <section className={styles.section}>
              <Eyebrow color="teal">Details</Eyebrow>
              <dl className={styles.detailList}>
                <DetailRow label="Category" value={categoryLabel} />
                {!isClothing && subCategoryLabel && (
                  <DetailRow label="Subcategory" value={subCategoryLabel} />
                )}
                <DetailRow label="Type" value={typeLabel} />
                {isClothing && (
                  <DetailRow label="Size" value={item.size_label} />
                )}
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
                {isClothing && item.season && (
                  <DetailRow
                    label="Season"
                    value={SEASON_LABEL[item.season] || item.season}
                  />
                )}
                {!isClothing && item.age_relevance && (
                  <DetailRow label="Age range" value={item.age_relevance} />
                )}
              </dl>
            </section>

            {item.notes && (
              <section className={styles.section}>
                <Eyebrow color="gray">Notes</Eyebrow>
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
                <Eyebrow color="purple">Pass-along</Eyebrow>
                <button
                  type="button"
                  className={styles.batchLink}
                  onClick={() =>
                    navigate(`/pass-along/${item.pass_along_batch_id}`)
                  }
                >
                  <div>
                    <div className={styles.batchLinkTop}>
                      In a bag
                    </div>
                    <div className={styles.batchLinkRef}>
                      {batchInfo?.reference_code || 'Open bag'}
                    </div>
                  </div>
                  <span className={styles.batchLinkChevron} aria-hidden="true">›</span>
                </button>
              </section>
            )}

            {/* Action stack — edit first (most common), then the path-forward
                affordances based on current status (Pass on / Tuck away for
                owned + legacy outgrown rows; Pass on / Move back to Owned
                for kept rows; nothing extra for pass_along since the item
                already lives on a bag page), delete last in destructive
                styling. */}
            <section className={styles.actions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => navigate(`/item/${item.id}/edit`)}
              >
                Edit item
              </button>

              {isClothing && canSendOn && !inBatch && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleSendOn}
                  disabled={working}
                >
                  {working ? 'Working…' : 'Pass on'}
                </button>
              )}

              {canTuckAway && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleTuckAway}
                  disabled={working}
                >
                  {working ? 'Working…' : 'Tuck away'}
                </button>
              )}

              {canReturnToOwned && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleReturnToOwned}
                  disabled={working}
                >
                  {working ? 'Working…' : 'Move back to Owned'}
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
