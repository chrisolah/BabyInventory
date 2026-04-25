import { useCallback, useMemo, useState } from 'react'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS, SLOT_BY_ID, AGE_RANGES, CATEGORY_LABELS } from '../lib/wardrobe'
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

// What's missing on a given batch row? Category, Type, and Size are the
// three hard-required columns (mirrors AddItem.getMissingRequiredFields).
// Brand is optional. Returns labels in display order so the row caption
// reads naturally.
function missingFieldsFor(fields) {
  const missing = []
  if (!fields.category)   missing.push('Category')
  if (!fields.item_type)  missing.push('Type')
  if (!fields.size_label) missing.push('Size')
  return missing
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
}) {
  const { household, currentBaby, babies, reloadItems } = useHousehold()

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
      // If category changed, clear item_type if it no longer belongs to
      // the new category. Otherwise validation sees a "valid" type that
      // isn't in the visible dropdown.
      if (fieldName === 'category') {
        const slot = nextFields.item_type ? SLOT_BY_ID[nextFields.item_type] : null
        if (!slot || slot.category !== value) nextFields.item_type = ''
      }
      const nextConfidence = { ...(it.confidence || {}), [fieldName]: 'high' }
      return { ...it, fields: nextFields, confidence: nextConfidence }
    }))
  }, [setItems])

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
    () => confirmedItems.filter((it) => missingFieldsFor(it.fields).length > 0).length,
    [confirmedItems],
  )

  const canSave =
    !saving &&
    !isEmpty &&
    confirmedItems.length > 0 &&
    confirmedInvalidCount === 0 &&
    !!household

  async function doSave() {
    if (!canSave) return
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
      const row = {
        household_id: household.id,
        // Each row carries its own baby_id (set via the per-row chip).
        // If the user never touched the chip the field is undefined, in
        // which case we fall back to defaultBabyId (the active baby).
        baby_id: it.baby_id !== undefined ? it.baby_id : defaultBabyId,
        category:         it.fields.category,
        item_type:        it.fields.item_type,
        size_label:       it.fields.size_label,
        brand:            it.fields.brand ? String(it.fields.brand).trim().slice(0, 80) || null : null,
        condition:        null,
        priority:         null,
        season:           null,
        quantity:         1,
        notes:            null,
        inventory_status: 'owned',
        name:             null,
      }
      const { error: insertErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
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
        category: row.category,
        size_label: row.size_label,
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
            />
          ))}
        </ul>
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
}) {
  const { fields, confidence = {}, thumbnailDataUrl, insertError, confirmed } = item
  const missing = missingFieldsFor(fields)
  const isInvalid = missing.length > 0

  const typeOptions = useMemo(
    () => (fields.category ? SLOTS.filter((s) => s.category === fields.category) : []),
    [fields.category],
  )

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
        <img src={thumbnailDataUrl} alt="" className={styles.rowThumb} />
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
              {typeOptions.map((s) => (
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
