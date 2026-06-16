import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUpgradeGate } from '../contexts/UpgradeGateContext'
import { SLOTS, SLOT_BY_ID, AGE_RANGES, CATEGORY_LABELS } from '../lib/wardrobe'
import { CATEGORY_META, SUB_CATEGORY_LABELS, ITEMS, getItemSlot } from '../lib/categories'
import { track } from '../lib/analytics'
import styles from './BatchReview.module.css'

// BatchReview — Phase 2.5 (2026-04-24).
//
// The review surface that appears when a parent taps "Review N" inside the
// camera after scanning several items in batch mode. Shows each scanned
// item as a compact row with inline-editable Category / Type / Size /
// Brand. Amber "Verify" pill + outline inherit from the Phase 2.4
// low-confidence UX so the same cue carries across.
//
// Scope deliberately excluded from the review surface:
//   - Condition, Season, Notes, Priority, Quantity. These aren't part of
//     the scan payload and forcing them into the batch flow re-introduces
//     the per-item friction that batch mode exists to kill. Fill them via
//     the item's detail page later if they matter.
//   - Baby assignment: every row inherits the household's currently
//     selected baby (same rule as single-item AddItem). Cross-baby
//     assignment is a Phase 3+ concern.
//
// Save semantics: sequential INSERTs, one row at a time, with live
// progress. First error halts the loop; rows already saved stay saved;
// the failed row is pinned with an error note so the parent can fix and
// retry the remainder. Rate limit (scan-side, 50/day) can't bite here —
// the scans already happened upstream.

// Build the list of category options once at module load. Order matches
// the Inventory UI and the single-item AddItem — muscle memory carries.
const CATEGORY_OPTIONS = [
  'tops_and_bodysuits',
  'one_pieces',
  'bottoms',
  'dresses_and_skirts',
  'outerwear',
  'sleepwear',
  'footwear',
  'accessories',
  'swimwear',
].map((v) => ({ value: v, label: CATEGORY_LABELS[v] || v }))

const SIZE_OPTIONS = AGE_RANGES

// Season options match the new warm/cold/all axis (post-migration-035).
// Five-row layout in the grid stays clean with these three values; their
// "(optional)" framing matches Brand below.
const SEASON_OPTIONS = [
  { value: 'warm_weather', label: 'Warm weather' },
  { value: 'cold_weather', label: 'Cold weather' },
  { value: 'all_season',   label: 'All-season' },
]

// What's missing on a given batch row? Returns labels in display order.
// Clothing (mode='tag'): category + item_type + size_label required.
// Item (mode='item'): top_category + item_type required.
function missingFieldsFor(fields) {
  const missing = []
  if (!fields.category)   missing.push('Category')
  if (!fields.item_type)  missing.push('Type')
  if (!fields.size_label) missing.push('Size')
  return missing
}
function missingItemFieldsFor(fields) {
  const missing = []
  if (!fields.top_category) missing.push('Category')
  if (!fields.item_type)    missing.push('Type')
  return missing
}
function getMissingFields(fields, mode) {
  return mode === 'item' ? missingItemFieldsFor(fields) : missingFieldsFor(fields)
}

export default function BatchReview({
  items,
  setItems,
  onScanMore,
  onDiscardAll,
  onComplete,
  // Optional: called with the chunk size when a save run finishes but
  // unconfirmed rows remain. Lets the parent fire its "saved N" toast
  // without tearing down the review surface (which onComplete does).
  onPartialSave,
  // 'tag'  = clothing scan (default / existing behaviour)
  // 'item' = non-clothing visual item scan
  mode = 'tag',
}) {
  const { household, currentBaby, babies, reloadItems } = useHousehold()
  const { requireRealAccount } = useUpgradeGate()

  // The default baby_id for any row that hasn't been explicitly assigned
  // via the per-row chip. Mirrors AddItem's "inherit the chip switcher's
  // current selection" semantic. Centralised so doSave + BatchRow agree
  // on what the implicit default is.
  const defaultBabyId = currentBaby?.id ?? null

  // Hide the per-row chip on single-baby households (and the empty
  // pre-onboarding case) — there's only one possible answer, so the
  // affordance would be noise. The save still attaches defaultBabyId.
  const showBabyChip = (babies?.length ?? 0) > 1

  const [saving, setSaving]         = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [saveError, setSaveError]   = useState(null)

  // Block accidental browser refresh / tab-close while unsaved items exist.
  // On mobile web, pull-to-refresh triggers beforeunload and this prevents
  // losing the entire scanned batch. Capacitor's WKWebView doesn't fire
  // beforeunload on native refresh, so the CSS overscroll-behavior:none on
  // the overlay handles that side.
  useEffect(() => {
    const guard = (e) => {
      if (items.length > 0 && !saving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [items.length, saving])

  // Tracks confirmation dialog for trashing the whole batch from the
  // back-arrow / "Discard" link. Single-row trash happens inline without
  // a confirm — the batch has enough redundancy that yanking one row is
  // recoverable by rescanning.
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Field update writes back to the items array via the parent's setter.
  // Editing a field implicitly promotes its confidence to "high" — the
  // parent's eyes were on it, so we stop flagging it for review even if
  // they didn't actually change the value (just opening the dropdown and
  // reselecting the same item counts as confirmation).
  const updateField = useCallback((itemId, fieldName, value) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it
      const nextFields = { ...it.fields, [fieldName]: value }
      if (mode === 'item') {
        if (fieldName === 'top_category') {
          // Clear sub_category if it no longer belongs to this top_category
          if (nextFields.sub_category) {
            const validSubs = new Set(
              ITEMS.filter(i => i.top_category === value).map(i => i.sub_category)
            )
            if (!validSubs.has(nextFields.sub_category)) {
              nextFields.sub_category = ''
              nextFields.item_type = ''
            }
          }
          // Clear item_type if it doesn't belong to the new top_category
          if (nextFields.item_type && !ITEMS.some(i => i.id === nextFields.item_type && i.top_category === value)) {
            nextFields.item_type = ''
          }
        }
        if (fieldName === 'sub_category' && nextFields.item_type) {
          // Clear item_type if it doesn't belong to the new sub_category
          if (!ITEMS.some(i => i.id === nextFields.item_type && i.sub_category === value)) {
            nextFields.item_type = ''
          }
        }
      } else {
        // Clothing: if category changed, clear item_type if it no longer
        // belongs to the new category.
        if (fieldName === 'category') {
          const slot = nextFields.item_type ? SLOT_BY_ID[nextFields.item_type] : null
          if (!slot || slot.category !== value) nextFields.item_type = ''
        }
      }
      const nextConfidence = { ...(it.confidence || {}), [fieldName]: 'high' }
      return { ...it, fields: nextFields, confidence: nextConfidence }
    }))
  }, [setItems, mode])

  const removeRow = useCallback((itemId) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }, [setItems])

  // Per-row baby assignment. Stored on the item itself so it survives a
  // "Scan more" round-trip and so doSave doesn't need to recompute from
  // chip-state. Value is a uuid for a specific baby, or null for
  // "Shared across babies" (matches AddItem's null-baby semantic).
  const setBaby = useCallback((itemId, babyId) => {
    setItems((prev) => prev.map((it) => (
      it.id === itemId ? { ...it, baby_id: babyId } : it
    )))
  }, [setItems])

  // Per-row "I've reviewed this" confirmation. Stored on the item itself
  // (not in local state) so it survives a "Scan more" round-trip — the
  // user shouldn't have to re-confirm rows they already eyeballed just
  // because they popped back into the camera. Default is unchecked: the
  // affordance only earns its keep if the user makes a deliberate choice
  // per row.
  const toggleConfirm = useCallback((itemId) => {
    setItems((prev) => prev.map((it) => (
      it.id === itemId ? { ...it, confirmed: !it.confirmed } : it
    )))
  }, [setItems])

  // Bulk-confirm toggle. One tap flips every row to the same state — if
  // anything is currently unconfirmed, confirm them all; if every row is
  // already confirmed, unconfirm them all. The header checkbox reflects
  // tri-state visually (all/some/none) via aria-checked + the indeterminate
  // DOM property, but the click handler is binary because that's what
  // users want from a "select all" affordance.
  const toggleConfirmAll = useCallback(() => {
    setItems((prev) => {
      const allConfirmed = prev.length > 0 && prev.every((it) => it.confirmed)
      return prev.map((it) => ({ ...it, confirmed: !allConfirmed }))
    })
  }, [setItems])

  // If the user trashes every row inline, fall through to the "nothing
  // to review" empty state. The empty-state CTA is "Scan more" because
  // bouncing back to the camera is the obvious next move.
  const isEmpty = items.length === 0

  // The set of rows the user has explicitly confirmed via the per-row
  // checkbox. Save acts on this subset only; unconfirmed rows survive
  // the save and remain reviewable for a later pass.
  const confirmedItems = useMemo(
    () => items.filter((it) => it.confirmed),
    [items],
  )

  // Confirmed rows that still have a missing required field. We only
  // count among the confirmed set because nagging the user about a row
  // they've explicitly set aside (unconfirmed) is just noise.
  const confirmedInvalidCount = useMemo(
    () => confirmedItems.filter((it) => getMissingFields(it.fields, mode).length > 0).length,
    [confirmedItems, mode],
  )

  // Tri-state for the "Select all" header checkbox.
  //   - 'all'   → every row confirmed (toggle will unconfirm all)
  //   - 'none'  → no rows confirmed (toggle will confirm all)
  //   - 'some'  → mixed (toggle will confirm all)
  // Maps to aria-checked and the input's indeterminate DOM prop.
  const allConfirmedState = useMemo(() => {
    if (items.length === 0) return 'none'
    if (items.every((it) => it.confirmed)) return 'all'
    if (items.some((it) => it.confirmed)) return 'some'
    return 'none'
  }, [items])

  const canSave =
    !saving &&
    !isEmpty &&
    confirmedItems.length > 0 &&
    confirmedInvalidCount === 0 &&
    !!household

  async function doSave() {
    if (!canSave) return
    // Gate behind a real account first so an anonymous trial user gets
    // the upgrade modal before any of these inserts commit. After
    // successful upgrade, the body below runs against the (now permanent)
    // account. If the user dismisses, _runSave is never called and we
    // leave the review surface in its current state.
    try {
      await requireRealAccount(_runSave)
    } catch (e) {
      if (e?.cancelled) return
      // _runSave handles its own error captioning when the inserts fail;
      // anything that bubbles to here is unexpected and worth surfacing.
      setSaving(false)
      setSaveError(e.message || 'Couldn’t save the batch.')
    }
  }

  async function _runSave() {
    setSaving(true)
    setSaveError(null)
    setSavedCount(0)

    // Snapshot the confirmed rows at save-start so concurrent toggles
    // (in case the user manages to tap a checkbox mid-save before the
    // disable kicks in) don't change which set we're iterating.
    const toSave = confirmedItems.slice()
    const savedIds = []

    // Sequential inserts. Could parallelize, but a single row per call
    // keeps the UI progress deterministic and lets us halt on first
    // error without leaving a half-finished batch.
    for (let i = 0; i < toSave.length; i++) {
      const it = toSave[i]
      // Pre-generate the row id client-side so the garment photo can be
      // uploaded BEFORE the INSERT — the storage path is keyed on the
      // item id, and the INSERT writes that path back into garment_photo_path.
      // Doing it in this order means a row never appears with a path
      // that doesn't yet have an object behind it; the UI's signed-URL
      // generation either finds a real photo or finds null and renders
      // the legacy size-only thumb.
      const itemId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      // Upload the photo if we have one. Silent degradation: if upload
      // fails, the row still saves without a photo path.
      let photoPath = null
      const photoDataUrl = mode === 'item'
        ? (it.itemDataUrl || null)
        : (it.garmentThumbnailDataUrl || null)

      if (photoDataUrl) {
        try {
          const blob = await fetch(photoDataUrl).then(r => r.blob())
          const path = `${household.id}/${itemId}.jpg`
          const { error: upErr } = await supabase.storage
            .from('garment-photos')
            .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
          if (upErr) {
            // eslint-disable-next-line no-console
            console.warn('photo upload failed for batch row', { id: it.id, err: upErr })
          } else {
            photoPath = path
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('photo upload threw for batch row', { id: it.id, err: e })
        }
      }

      const babyId = it.baby_id !== undefined ? it.baby_id : defaultBabyId
      const brand  = it.fields.brand ? String(it.fields.brand).trim().slice(0, 80) || null : null

      let row, table
      if (mode === 'item') {
        table = 'items'
        const matchedSlot = getItemSlot(it.fields)
        row = {
          id:               itemId,
          household_id:     household.id,
          baby_id:          babyId,
          slot_id:          matchedSlot?.id || null,
          top_category:     it.fields.top_category,
          sub_category:     it.fields.sub_category || null,
          item_type:        it.fields.item_type,
          brand,
          condition:        it.fields.condition || null,
          priority:         null,
          quantity:         1,
          notes:            null,
          inventory_status: 'owned',
          name:             null,
          item_photo_path:  photoPath,
        }
      } else {
        table = 'clothing_items'
        row = {
          id:                 itemId,
          household_id:       household.id,
          baby_id:            babyId,
          category:           it.fields.category,
          item_type:          it.fields.item_type,
          size_label:         it.fields.size_label,
          brand,
          condition:          null,
          priority:           null,
          season:             it.fields.season || null,
          quantity:           1,
          notes:              null,
          inventory_status:   'owned',
          name:               null,
          garment_photo_path: photoPath,
        }
      }

      const { error: insertErr } = await supabase
        .schema(currentSchema)
        .from(table)
        .insert(row)

      if (insertErr) {
        // Pin the failing row with an error caption. Already-saved rows
        // stay saved; the user can retry by removing the bad row or
        // fixing its fields.
        setItems((prev) => prev.map((x) => (
          x.id === it.id ? { ...x, insertError: insertErr.message } : x
        )))
        setSaveError(`Saved ${i} of ${toSave.length}. Couldn’t save one — see the row below for the reason.`)
        setSaving(false)
        // Drop the already-saved rows from the list so retrying only
        // re-attempts the remaining (including the failed one and any
        // unconfirmed rows that weren't part of this run).
        const savedSet = new Set(savedIds)
        setItems((prev) => prev.filter((x) => !savedSet.has(x.id)))
        // Even on partial failure, refresh the cached items list so the
        // ones we DID save show up in Inventory immediately.
        if (savedIds.length > 0) reloadItems?.()
        return
      }
      savedIds.push(it.id)
      setSavedCount(i + 1)
      // Fire the same per-item analytic the single-item path fires so
      // funnel reports don't need a separate "batch vs single" branch
      // to count saved items.
      track.itemSaved({
        mode: 'owned',
        category: mode === 'item' ? row.top_category : row.category,
        size_label: mode === 'item' ? null : row.size_label,
        source: 'batch',
      })
    }

    setSaving(false)

    // Remove the rows we just saved. Anything unconfirmed survives.
    // Compute remaining off the current `items` snapshot so we can
    // branch on emptiness *outside* the setItems updater — calling
    // other setState/callbacks from inside an updater is fragile under
    // React 18 strict mode (updaters can run twice in dev).
    const savedSet = new Set(savedIds)
    const remaining = items.filter((x) => !savedSet.has(x.id))
    setItems(remaining)

    // Refresh the HouseholdContext items cache so Inventory shows the
    // newly-saved rows immediately. Without this, the rows are in the
    // database but invisible to the UI until the next full reload —
    // which looks identical to "save didn't work". Mirrors what AddItem
    // does after a successful single-item insert.
    reloadItems?.()

    // If the entire batch is now drained, hand off to the parent's
    // onComplete handler (which closes the review and fires the
    // grandparent toast). Otherwise stay on review and let the parent
    // know via onPartialSave so the toast still fires for the chunk
    // we did save.
    if (remaining.length === 0) {
      onComplete?.(savedIds.length)
    } else {
      onPartialSave?.(savedIds.length)
    }
  }

  // Confirm-discard dialog gets full-screen treatment because the
  // destructive action is irreversible and the batch may have taken
  // meaningful effort to scan. Kept visually separate from the main
  // review frame so there's no mistake about what "Discard" does.
  if (confirmDiscard) {
    return (
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="br-confirm-title">
        <div className={styles.confirmBox}>
          <h2 id="br-confirm-title" className={styles.confirmTitle}>
            Discard {items.length} scanned item{items.length === 1 ? '' : 's'}?
          </h2>
          <p className={styles.confirmBody}>
            We won’t keep anything. You’ll need to rescan if you change your mind.
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setConfirmDiscard(false)}
            >
              Keep reviewing
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={onDiscardAll}
            >
              Discard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="br-title">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => items.length > 0 ? setConfirmDiscard(true) : onDiscardAll?.()}
          aria-label="Back"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            <path d="M12.5 4.5 L6.5 10 L12.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 id="br-title" className={styles.title}>
          {isEmpty
            ? 'Batch empty'
            : confirmedItems.length > 0
              ? `${confirmedItems.length} of ${items.length} confirmed`
              : `Review ${items.length} item${items.length === 1 ? '' : 's'}`}
        </h1>
        <button
          type="button"
          className={styles.scanMoreLink}
          onClick={onScanMore}
          disabled={saving}
        >
          + Scan more
        </button>
      </header>

      {isEmpty ? (
        <div className={styles.empty}>
          <p>Nothing to review yet.</p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onScanMore}
          >
            Open camera
          </button>
        </div>
      ) : (
        <>
          {/* Bulk-confirm toggle bar. Single tap confirms or unconfirms
              every row in the batch — eliminates the "tap 35 checkboxes
              individually" pain point that surfaced during real catalog
              testing. Tri-state visual: checked when all rows are
              confirmed, indeterminate when some are, unchecked when
              none. The button click delegates to toggleConfirmAll which
              flips to "all on" unless everything is already confirmed,
              in which case it flips to "all off". */}
          <SelectAllBar
            state={allConfirmedState}
            count={items.length}
            confirmedCount={confirmedItems.length}
            onToggle={toggleConfirmAll}
            disabled={saving}
          />
          <ul className={styles.list}>
            {items.map((it) => (
              <BatchRow
                key={it.id}
                item={it}
                onChange={updateField}
                onRemove={removeRow}
                onConfirm={toggleConfirm}
                onBabyChange={setBaby}
                babies={babies}
                defaultBabyId={defaultBabyId}
                showBabyChip={showBabyChip}
                disabled={saving}
                mode={mode}
              />
            ))}
          </ul>
        </>
      )}

      {saveError && (
        <div className={styles.saveError} role="alert">{saveError}</div>
      )}

      {!isEmpty && (
        <footer className={styles.footer}>
          {saving ? (
            <div className={styles.progress} aria-live="polite">
              Saving {savedCount} of {confirmedItems.length}…
            </div>
          ) : (
            <>
              {confirmedItems.length === 0 ? (
                <div className={styles.invalidHint}>
                  Check the box on each item you’re ready to save.
                </div>
              ) : confirmedInvalidCount > 0 ? (
                <div className={styles.invalidHint}>
                  Fix {confirmedInvalidCount} confirmed row{confirmedInvalidCount === 1 ? '' : 's'} with missing fields before saving.
                </div>
              ) : null}
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={doSave}
                disabled={!canSave}
              >
                {confirmedItems.length === 0
                  ? 'Save'
                  : `Save ${confirmedItems.length} item${confirmedItems.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  )
}

// Bulk-confirm bar above the list. Tri-state checkbox (all/some/none)
// plus a label that summarises the current confirm count. The native
// <input type="checkbox" indeterminate> requires DOM manipulation since
// React doesn't expose `indeterminate` as a prop, hence the ref-driven
// useEffect. aria-checked carries 'mixed' for the partial state so
// assistive tech announces it correctly.
function SelectAllBar({ state, count, confirmedCount, onToggle, disabled }) {
  const checkboxRef = useRef(null)
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = state === 'some'
    }
  }, [state])

  const labelText =
    state === 'all'
      ? `All ${count} confirmed — tap to clear`
      : confirmedCount > 0
        ? `${confirmedCount} of ${count} confirmed — tap to confirm all`
        : `Confirm all ${count}`

  return (
    <label
      className={`${styles.selectAllBar} ${disabled ? styles.selectAllBarDisabled : ''}`}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        className={styles.selectAllCheckbox}
        checked={state === 'all'}
        aria-checked={state === 'some' ? 'mixed' : state === 'all' ? 'true' : 'false'}
        onChange={onToggle}
        disabled={disabled}
      />
      <span className={styles.selectAllBox} aria-hidden="true">
        {state === 'all' && (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M3.5 8.5 L6.5 11.5 L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {state === 'some' && (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M4 8 L12 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className={styles.selectAllLabel}>{labelText}</span>
    </label>
  )
}

// Single row in the review list. Compact by design: thumbnail on the
// left, the four scan-covered fields stacked on the right, trash on the
// far right. Fields inherit the Phase 2.4 amber-outline + Verify pill
// when their confidence came back "low" from the Edge Function. Editing
// any field promotes it to "high" (see updateField above).
function BatchRow({
  item,
  onChange,
  onRemove,
  onConfirm,
  onBabyChange,
  babies,
  defaultBabyId,
  showBabyChip,
  disabled,
  mode = 'tag',
}) {
  const {
    fields,
    confidence = {},
    thumbnailDataUrl,
    garmentThumbnailDataUrl,
    tagThumbnailDataUrl,
    itemDataUrl,
    insertError,
    confirmed,
  } = item

  // Resolve thumbnails. Item mode has a single photo (itemDataUrl).
  // Clothing mode has garment (primary) + optional tag (secondary).
  const primaryThumb = mode === 'item'
    ? (itemDataUrl || thumbnailDataUrl || null)
    : (garmentThumbnailDataUrl || tagThumbnailDataUrl || thumbnailDataUrl || null)
  const secondaryThumb = mode === 'item'
    ? null
    : (garmentThumbnailDataUrl && tagThumbnailDataUrl ? tagThumbnailDataUrl : null)

  const missing = getMissingFields(fields, mode)
  const isInvalid = missing.length > 0

  // Clothing mode: slot options filtered by clothing category
  const clothingTypeOptions = useMemo(
    () => (fields.category ? SLOTS.filter((s) => s.category === fields.category) : []),
    [fields.category],
  )
  // Item mode: top-category options
  const topCategoryOptions = useMemo(
    () => Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label })),
    [],
  )
  // Item mode: sub-category options filtered by top_category
  const subCategoryOptions = useMemo(() => {
    if (!fields.top_category) return []
    const subs = [...new Set(
      ITEMS.filter(i => i.top_category === fields.top_category).map(i => i.sub_category)
    )]
    return subs.map(v => ({ value: v, label: SUB_CATEGORY_LABELS[v] || v }))
  }, [fields.top_category])
  // Item mode: item-type options filtered by top_category (+sub_category if set)
  const itemTypeOptions = useMemo(() => {
    if (!fields.top_category) return []
    return ITEMS
      .filter(i =>
        i.top_category === fields.top_category &&
        (!fields.sub_category || i.sub_category === fields.sub_category)
      )
      .map(i => ({ value: i.id, label: i.singular || i.label }))
  }, [fields.top_category, fields.sub_category])

  function verifyClass(name) {
    return confidence?.[name] === 'low' ? styles.fieldVerify : ''
  }

  // The effective baby for this row: explicit assignment if set, else the
  // household-wide default. Stored as undefined (not null) when the user
  // hasn't touched the chip so we can distinguish "implicit default" from
  // "explicit shared". Both render the same in the chip.
  const effectiveBabyId = item.baby_id !== undefined ? item.baby_id : defaultBabyId
  const effectiveBabyName =
    effectiveBabyId == null
      ? 'Shared'
      : (babies?.find((b) => b.id === effectiveBabyId)?.name ?? 'Shared')

  return (
    <li className={`${styles.row} ${confirmed ? styles.rowConfirmed : ''} ${isInvalid ? styles.rowInvalid : ''} ${insertError ? styles.rowError : ''}`}>
      {/* Per-row confirm checkbox. Lives in its own column on the far
          left so it reads as a deliberate "yes, save this one" gesture
          rather than a visual artefact attached to the thumbnail. */}
      <label
        className={`${styles.rowConfirmWrap} ${disabled ? styles.rowConfirmWrapDisabled : ''}`}
        aria-label={confirmed ? 'Unconfirm this item' : 'Confirm this item'}
      >
        <input
          type="checkbox"
          className={styles.rowConfirmInput}
          checked={!!confirmed}
          onChange={() => onConfirm?.(item.id)}
          disabled={disabled}
        />
        <span className={styles.rowConfirmBox} aria-hidden="true">
          {confirmed && (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <path d="M3.5 8.5 L6.5 11.5 L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </label>
      <div className={styles.rowThumbWrap}>
        {primaryThumb && (
          <img src={primaryThumb} alt="" className={styles.rowThumb} />
        )}
        {secondaryThumb && (
          <img
            src={secondaryThumb}
            alt=""
            className={styles.rowThumbSecondary}
            aria-hidden="true"
          />
        )}
      </div>
      <div className={styles.rowFields}>
        {/* Per-row baby assignment chip. Renders only on multi-baby
            households (single-baby households implicitly attach to the
            sole baby — chip would be noise). Native select underneath
            so mobile gets a familiar bottom-sheet picker. */}
        {showBabyChip && (
          <label className={styles.rowBabyChip}>
            <span className={styles.rowBabyChipLabel}>For</span>
            <span className={styles.rowBabyChipValue}>
              {effectiveBabyName}
              <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
                <path d="M3 4.5 L6 7.5 L9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <select
              className={styles.rowBabyChipSelect}
              value={effectiveBabyId ?? ''}
              onChange={(e) => onBabyChange?.(item.id, e.target.value || null)}
              disabled={disabled}
              aria-label="Assign this item to a baby"
            >
              {babies?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="">Shared (all babies)</option>
            </select>
          </label>
        )}
        <div className={styles.rowGrid}>
          {mode === 'item' ? (
            // ── Item (non-clothing) field set ───────────────────────────
            <>
              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Category
                  {confidence?.top_category === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('top_category')}`}
                  value={fields.top_category || ''}
                  onChange={(e) => onChange(item.id, 'top_category', e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Pick one…</option>
                  {topCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>Sub-category</span>
                <select
                  className={styles.rowInput}
                  value={fields.sub_category || ''}
                  onChange={(e) => onChange(item.id, 'sub_category', e.target.value)}
                  disabled={disabled || !fields.top_category}
                >
                  <option value="">{fields.top_category ? 'All types' : 'Pick category first'}</option>
                  {subCategoryOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Type
                  {confidence?.item_type === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('item_type')}`}
                  value={fields.item_type || ''}
                  onChange={(e) => onChange(item.id, 'item_type', e.target.value)}
                  disabled={disabled || !fields.top_category}
                >
                  <option value="">{fields.top_category ? 'Pick one…' : 'Pick category first'}</option>
                  {itemTypeOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Brand
                  {confidence?.brand === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <input
                  type="text"
                  className={`${styles.rowInput} ${verifyClass('brand')}`}
                  value={fields.brand || ''}
                  placeholder="optional"
                  onChange={(e) => onChange(item.id, 'brand', e.target.value)}
                  disabled={disabled}
                />
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Condition
                  {confidence?.condition === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('condition')}`}
                  value={fields.condition || ''}
                  onChange={(e) => onChange(item.id, 'condition', e.target.value)}
                  disabled={disabled}
                >
                  <option value="">optional</option>
                  <option value="new">New</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </label>
            </>
          ) : (
            // ── Clothing field set (existing) ────────────────────────────
            <>
              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Category
                  {confidence?.category === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('category')}`}
                  value={fields.category || ''}
                  onChange={(e) => onChange(item.id, 'category', e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Pick one…</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Type
                  {confidence?.item_type === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('item_type')}`}
                  value={fields.item_type || ''}
                  onChange={(e) => onChange(item.id, 'item_type', e.target.value)}
                  disabled={disabled || !fields.category}
                >
                  <option value="">{fields.category ? 'Pick one…' : 'Pick category first'}</option>
                  {clothingTypeOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Size
                  {confidence?.size_label === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('size_label')}`}
                  value={fields.size_label || ''}
                  onChange={(e) => onChange(item.id, 'size_label', e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Pick one…</option>
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Brand
                  {confidence?.brand === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <input
                  type="text"
                  className={`${styles.rowInput} ${verifyClass('brand')}`}
                  value={fields.brand || ''}
                  placeholder="optional"
                  onChange={(e) => onChange(item.id, 'brand', e.target.value)}
                  disabled={disabled}
                />
              </label>

              <label className={styles.rowLabel}>
                <span className={styles.rowLabelText}>
                  Season
                  {confidence?.season === 'low' && <span className={styles.verifyBadge}>Verify</span>}
                </span>
                <select
                  className={`${styles.rowInput} ${verifyClass('season')}`}
                  value={fields.season || ''}
                  onChange={(e) => onChange(item.id, 'season', e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Pick one…</option>
                  {SEASON_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {isInvalid && (
          <div className={styles.missingHint}>
            Missing: {missing.join(', ')}
          </div>
        )}
        {insertError && (
          <div className={styles.rowErrorHint} role="alert">
            Couldn’t save: {insertError}
          </div>
        )}
      </div>
      <button
        type="button"
        className={styles.trashBtn}
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        aria-label="Remove this item from the batch"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
          <path d="M7 6 V15 M10 6 V15 M13 6 V15 M4 6 H16 M7.5 6 V4 H12.5 V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </li>
  )
}
