import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import { SLOTS, SLOT_BY_ID } from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import TagScanner from '../components/TagScanner'
import styles from './AddItem.module.css'

// Add / edit item form. Same component serves two routes:
//   - /add-item           → create mode. INSERT on submit, land on /inventory.
//   - /item/:id/edit      → edit mode. Loads the row, prefills state, UPDATE
//                           on submit, navigates back to the item detail page
//                           so the user sees the saved result.
//
// Fields match the check constraints on beta.clothing_items (migration 006):
//   - category, item_type, size_label, inventory_status: required
//   - condition: optional (even for owned items — a lot of real inventory
//     gets added without knowing the item's condition yet, and the photo
//     scan can't infer it. Keep null-able here and in the DB.)
//   - priority: only relevant on wishlist items
//   - brand / season / notes / quantity: always optional (except qty defaults 1)
//
// Required-field UX contract: canSubmit() reads from getMissingRequiredFields(),
// which returns a list of { label, domId } entries. The disabled-Save hint
// below the button reads the same list, so a new required field added to that
// function is automatically flagged to the user — we never want someone
// clicking a disabled Save with no explanation.
//
// The fuller prototype has photos, colors, weight ranges, fit notes, occasion,
// exchange toggles. Those come later — this form ships enough to close the
// inventory loop (add → see).

const CATEGORIES = [
  { value: 'tops_and_bodysuits', label: 'Tops and bodysuits' },
  { value: 'one_pieces', label: 'One-pieces' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses_and_skirts', label: 'Dresses and skirts' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'sleepwear', label: 'Sleepwear' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'swimwear', label: 'Swimwear' },
]

const SIZES = ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M']

const CONDITIONS = [
  { value: 'new', label: 'New (with tags)' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'worn', label: 'Worn' },
]

const SEASONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
  { value: 'all_season', label: 'All-season' },
]

const PRIORITIES = [
  { value: 'must_have', label: 'Must have' },
  { value: 'nice_to_have', label: 'Nice to have' },
  { value: 'low_priority', label: 'Low priority' },
]

export default function AddItem() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Household + currently-selected baby come from context. On create we
  // pre-attach selectedBabyId as baby_id so items "inherit" the Inventory
  // view the user was just looking at. On edit we leave baby_id alone —
  // re-assigning an item across babies is a separate flow (not built yet).
  const {
    household,
    babies,
    currentBaby,
    loading: householdLoading,
    error: householdError,
  } = useHousehold()

  // Edit vs create is decided by whether the route captured an :id. The
  // ItemDetail screen links to /item/:id/edit; the Home/Inventory CTAs
  // link to /add-item (no id). We can't rely on pathname matching here
  // because react-router handles the matching — we just check `id`.
  const { id: editId } = useParams()
  const isEditMode = Boolean(editId)

  // Optional deep-link pre-fill. Two entry points populate search params:
  //   1. Slot detail page ("Add one" CTA): mode, category, size, from_slot
  //   2. Home scan CTA (photo-scan landed here): mode=owned, category,
  //      size, from_slot (as item_type), brand — all best-effort from the
  //      model. Users still confirm before save.
  // Ignore anything that doesn't match the whitelists so malformed URLs
  // don't put the form into a weird state. Search params are ignored in
  // edit mode — the loaded row is the source of truth.
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'needed' ? 'needed' : 'owned'
  const initialCategoryParam = searchParams.get('category')
  const initialSizeParam = searchParams.get('size')
  const initialSlotParam = searchParams.get('from_slot')
  const initialBrandParam = searchParams.get('brand')

  // In edit mode, we also need the existing row's fields to prefill. We
  // load it alongside household context so the form isn't partially
  // hydrated. Holding the row itself (not just its fields) lets the submit
  // handler decide UPDATE vs INSERT without re-fetching.
  const [existingItem, setExistingItem] = useState(null)
  const [loadingItem, setLoadingItem] = useState(isEditMode)

  // Form state — pre-filled from the URL when possible, otherwise blank.
  // Whitelist the incoming params against CATEGORIES/SIZES so a stale or
  // typo'd URL doesn't silently lock the user into an invalid combination.
  // In edit mode these start blank and get hydrated by the effect below
  // once the row loads, to avoid a flash of create-mode defaults.
  const [mode, setMode] = useState(isEditMode ? 'owned' : initialMode)
  const [category, setCategory] = useState(() => {
    if (isEditMode) return ''
    return CATEGORIES.some(c => c.value === initialCategoryParam) ? initialCategoryParam : ''
  })
  // Item type is now a slot id from the wardrobe taxonomy (e.g. 'bodysuits',
  // 'pajamas'). Old free-text item_types still work on read paths — the
  // getSlotForItem() keyword matcher handles them — but new rows are stored
  // as slot ids so the Wish list tab can route them straight back to a slot
  // without any guesswork.
  const [itemType, setItemType] = useState(() => {
    if (isEditMode) return ''
    const slot = initialSlotParam ? SLOT_BY_ID[initialSlotParam] : null
    // Only accept the incoming slot if it actually lives under the incoming
    // category — otherwise we'd end up with a type that can't be picked from
    // the filtered dropdown, and canSubmit would fail silently.
    if (!slot) return ''
    if (slot.category !== initialCategoryParam) return ''
    return slot.id
  })
  const [sizeLabel, setSizeLabel] = useState(() => {
    if (isEditMode) return ''
    return SIZES.includes(initialSizeParam) ? initialSizeParam : ''
  })
  const [condition, setCondition] = useState('')
  const [priority, setPriority] = useState('')
  const [brand, setBrand] = useState(() => {
    if (isEditMode) return ''
    // Brand is free-text so we trim + length-cap rather than whitelist.
    // Matches the 80-char cap the Edge Function already applies, so a
    // handcrafted URL can't blow past what photo-scan would send.
    if (typeof initialBrandParam !== 'string') return ''
    return initialBrandParam.trim().slice(0, 80)
  })
  const [season, setSeason] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  // Count of fields the most recent scan just filled in. Drives the "we
  // filled in N fields — confirm below and save" banner so the user knows
  // why the form looks different. Reset on mount; not persisted.
  const [scanFilledCount, setScanFilledCount] = useState(0)

  // Fire add_item_started once per create session. Edit sessions belong to
  // a different funnel, so we gate it on !isEditMode. Waits on the context
  // so we don't double-fire if the component re-renders while household is
  // still loading.
  useEffect(() => {
    if (isEditMode) return
    if (householdLoading) return
    if (!household) return
    track.addItemStarted({ mode })
    // Fire once on mount per session. Mode changes after mount aren't
    // "starts" — suppressing exhaustive-deps keeps the single-fire contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdLoading, household])

  // Surface household-load errors inline. Rare — pre-onboarding users get
  // redirected before reaching /add-item — but a bad RLS read shouldn't
  // silently yield an "insert without household" crash later.
  useEffect(() => {
    if (householdError) {
      setError(householdError)
    } else if (!householdLoading && !household) {
      setError('No household found — finish onboarding first.')
    }
  }, [householdError, householdLoading, household])

  // In edit mode, load the existing row and hydrate every form field from
  // it. Runs in parallel with the household context load; both have to
  // finish before the form can render (see the combined loading gate below).
  useEffect(() => {
    if (!user || !isEditMode || !editId) return
    let cancelled = false

    async function loadExisting() {
      setLoadingItem(true)
      const { data, error: loadErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('id', editId)
        .maybeSingle()

      if (cancelled) return
      if (loadErr) {
        setError(loadErr.message)
        setLoadingItem(false)
        return
      }
      if (!data) {
        // Row doesn't exist (or RLS filtered it out — same thing from here).
        setError('This item isn\u2019t in your wardrobe anymore.')
        setLoadingItem(false)
        return
      }

      setExistingItem(data)
      // Prefill every field from the row. Fall back to sensible defaults
      // for null columns so the controlled inputs don't warn. The mode
      // toggle collapses outgrown/donated/exchanged rows back onto 'owned'
      // — editing the lifecycle status happens via the detail page's
      // dedicated actions, not by flipping this segmented control.
      setMode(data.inventory_status === 'needed' ? 'needed' : 'owned')
      setCategory(data.category || '')
      setItemType(data.item_type || '')
      setSizeLabel(data.size_label || '')
      setCondition(data.condition || '')
      setPriority(data.priority || '')
      setBrand(data.brand || '')
      setSeason(data.season || '')
      setQuantity(data.quantity || 1)
      setNotes(data.notes || '')

      setLoadingItem(false)
    }

    loadExisting()
    return () => { cancelled = true }
  }, [user, isEditMode, editId])

  // Slots available for the current category, in wardrobe.js order. Keeping
  // this memo-ed lets the <select> re-render without re-filtering on every
  // keystroke in unrelated fields.
  const typeOptions = useMemo(
    () => (category ? SLOTS.filter(s => s.category === category) : []),
    [category]
  )

  // Fire analytics when the user narrows down specific fields — helps spot
  // drop-off points in the funnel. Keep cheap: one event per terminal choice.
  function onCategoryChange(v) {
    setCategory(v)
    // Reset the type if it doesn't belong to the newly chosen category.
    // Otherwise a stale selection can sneak past canSubmit (value is set,
    // but not in the visible dropdown).
    const currentSlot = itemType ? SLOT_BY_ID[itemType] : null
    if (!currentSlot || currentSlot.category !== v) setItemType('')
    if (v) track.itemCategorySelected(v)
  }

  function onTypeChange(v) {
    setItemType(v)
    if (v) track.itemCategorySelected(v) // reuse: tracks refinement, not category
  }

  function onSizeChange(v) {
    setSizeLabel(v)
    if (v) track.itemSizeSelected(v)
  }

  // Which required fields are still empty, in the order they appear in the
  // form. Used in two places: canSubmit() gates the Save button off the
  // length of this list, and the disabled-Save hint below the button renders
  // the labels so the user never has to guess why Save is grey. Adding a
  // new required field? Push it into this function and both places update.
  function getMissingRequiredFields() {
    const missing = []
    if (!category)  missing.push({ label: 'Category', domId: 'ai-category' })
    if (!itemType)  missing.push({ label: 'Type',     domId: 'ai-type' })
    if (!sizeLabel) missing.push({ label: 'Size',     domId: 'ai-size' })
    if (!(quantity >= 1)) missing.push({ label: 'Quantity', domId: 'ai-quantity' })
    return missing
  }

  function canSubmit() {
    if (!household) return false
    return getMissingRequiredFields().length === 0
  }

  // Called by <TagScanner> after a successful scan. Prefills the form
  // fields we recognize; leaves untouched fields as-is so a second scan
  // can progressively refine earlier ones. Individual fields may be null
  // (low confidence or unreadable) — we skip those rather than blanking
  // out whatever the user already typed. Never auto-saves.
  function onScanResult(fields) {
    if (!fields) return
    let filled = 0

    if (fields.category && CATEGORIES.some(c => c.value === fields.category)) {
      setCategory(fields.category)
      filled += 1
      // If the incoming item_type is valid AND matches the scanned category,
      // accept it too; otherwise let the user pick from the now-filtered list.
      const slot = fields.item_type ? SLOT_BY_ID[fields.item_type] : null
      if (slot && slot.category === fields.category) {
        setItemType(slot.id)
        filled += 1
      } else {
        setItemType('')
      }
    }

    if (fields.size_label && SIZES.includes(fields.size_label)) {
      setSizeLabel(fields.size_label)
      filled += 1
    }

    if (fields.brand && typeof fields.brand === 'string') {
      setBrand(fields.brand.trim().slice(0, 80))
      filled += 1
    }

    setScanFilledCount(filled)
    track.tagScanCompleted({ filled, mode })
  }

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit() || saving) return

    setSaving(true)
    setError(null)

    // Common field payload. In edit mode we preserve household_id/baby_id
    // from the existing row (RLS will reject an attempt to move a row to
    // another household anyway, but it's cleaner not to try).
    const fields = {
      category,
      // item_type is a slot id from the wardrobe taxonomy. Stored raw (no
      // casing / whitespace tricks) so it round-trips cleanly through
      // getSlotForItem on read.
      item_type: itemType,
      size_label: sizeLabel,
      condition: mode === 'owned' ? condition : null,
      priority: mode === 'needed' && priority ? priority : null,
      brand: brand.trim() || null,
      season: season || null,
      quantity: Number(quantity) || 1,
      notes: notes.trim() || null,
    }

    if (isEditMode && existingItem) {
      // Edit path: UPDATE only the editable columns. Deliberately don't
      // touch inventory_status — the detail page's Mark-as-outgrown and
      // other lifecycle actions own that column. Flipping the owned/needed
      // toggle in edit mode *does* affect it (you're saying the item is
      // now wished-for instead of owned), so include that when it changes.
      const patch = { ...fields }
      if (mode !== existingItem.inventory_status && (mode === 'owned' || mode === 'needed')) {
        patch.inventory_status = mode
      }

      const { error: updErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .update(patch)
        .eq('id', existingItem.id)

      setSaving(false)

      if (updErr) {
        setError(updErr.message)
        return
      }

      track.itemEdited({ mode, category, size_label: sizeLabel })
      // Back to the detail page so the user sees the saved result (and
      // can dismiss/edit again without another navigation hop).
      navigate(`/item/${existingItem.id}`)
      return
    }

    // Create path. baby_id follows the chip switcher's current selection:
    //   - specific baby picked → attach their id, the item lives in their wardrobe
    //   - 'all' picked         → null, the item is shared across babies
    //   - single-baby household → context forces selectedBabyId to that baby,
    //                              so currentBaby is populated and we attach it
    // The "unassigned / shared" semantic is deliberate — it matches how we
    // filter (null baby_id shows under every specific baby) so there's a
    // single mental model for how null is treated.
    const row = {
      household_id: household.id,
      baby_id: currentBaby?.id ?? null,
      ...fields,
      inventory_status: mode,
      name: null, // Reserved for the parent-supplied nickname; not collected yet.
    }

    const { error: insertErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .insert(row)

    setSaving(false)

    if (insertErr) {
      setError(insertErr.message)
      return
    }

    track.itemSaved({ mode, category, size_label: sizeLabel })
    navigate('/inventory')
  }

  // In edit mode we need both the household context AND the existing row
  // before we can render meaningful inputs. Single gate keeps the form
  // from flashing create-mode defaults while the row is in flight.
  if (householdLoading || loadingItem) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  // Where Back should go: to the detail page if we're editing an existing
  // item (so Cancel = "discard my changes"), otherwise to the inventory
  // list where the + Add CTAs live.
  const backDest = isEditMode && existingItem ? `/item/${existingItem.id}` : '/inventory'
  const backLabel = isEditMode ? 'Back to item' : 'Back to inventory'

  // On a multi-baby household, show a subtle subtitle so the user knows who
  // this item will attach to. Single-baby households don't need the noise —
  // there's only one possible answer. 'All' selection means the item is
  // shared (baby_id null), which is worth surfacing since the user probably
  // switched to 'All' on purpose and wants to know what happens next.
  const subtitle = !isEditMode && babies.length > 1
    ? currentBaby?.name
      ? `For ${currentBaby.name}`
      : 'Shared across babies'
    : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(backDest)}
          aria-label={backLabel}
        >
          ←
        </button>
        <div className={styles.titleCell}>
          <div className={styles.title}>
            {isEditMode ? 'Edit item' : 'Add an item'}
          </div>
          {subtitle && (
            <div className={styles.subtitle}>{subtitle}</div>
          )}
          {/* Mobile-only sprig beneath the title. Hidden on desktop. */}
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      <main className={styles.body}>
        {/* Photo-scan entry point. Only surfaced on create — editing an
            existing row shouldn't invite a re-scan (the user is here to
            tweak, not reseed). The component handles its own loading and
            error states; we just get the fields back via onResult. */}
        {!isEditMode && (
          <div className={styles.scanRow}>
            <TagScanner variant="inline" onResult={onScanResult} disabled={saving} />
            {scanFilledCount > 0 && (
              <div className={styles.scanHint}>
                Autofilled {scanFilledCount} field{scanFilledCount === 1 ? '' : 's'} from your photo. Review below and save.
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>
          {/* Mode toggle — decides what status the item gets saved as. */}
          <div className={styles.segToggle}>
            <button
              type="button"
              className={`${styles.segBtn} ${mode === 'owned' ? styles.segActive : ''}`}
              onClick={() => setMode('owned')}
            >
              Own it
            </button>
            <button
              type="button"
              className={`${styles.segBtn} ${mode === 'needed' ? styles.segActive : ''}`}
              onClick={() => setMode('needed')}
            >
              Want it
            </button>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-category">Category</label>
            <select
              id="ai-category"
              className={styles.input}
              value={category}
              onChange={e => onCategoryChange(e.target.value)}
              required
            >
              <option value="">Pick one…</option>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-type">Type</label>
            <select
              id="ai-type"
              className={styles.input}
              value={itemType}
              onChange={e => onTypeChange(e.target.value)}
              required
              disabled={!category}
            >
              <option value="">
                {category ? 'Pick one…' : 'Choose a category first'}
              </option>
              {typeOptions.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-size">Size</label>
            <select
              id="ai-size"
              className={styles.input}
              value={sizeLabel}
              onChange={e => onSizeChange(e.target.value)}
              required
            >
              <option value="">Pick one…</option>
              {SIZES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {mode === 'owned' && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-condition">
                Condition <span className={styles.optional}>(optional)</span>
              </label>
              <select
                id="ai-condition"
                className={styles.input}
                value={condition}
                onChange={e => setCondition(e.target.value)}
              >
                <option value="">Not set</option>
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'needed' && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-priority">
                Priority <span className={styles.optional}>(optional)</span>
              </label>
              <select
                id="ai-priority"
                className={styles.input}
                value={priority}
                onChange={e => setPriority(e.target.value)}
              >
                <option value="">Not set</option>
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-quantity">
                Quantity
              </label>
              <input
                id="ai-quantity"
                className={styles.input}
                type="number"
                min="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-brand">
                Brand <span className={styles.optional}>(optional)</span>
              </label>
              <input
                id="ai-brand"
                className={styles.input}
                type="text"
                placeholder="Carter's, H&M, …"
                value={brand}
                onChange={e => setBrand(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-season">
              Season <span className={styles.optional}>(optional)</span>
            </label>
            <select
              id="ai-season"
              className={styles.input}
              value={season}
              onChange={e => setSeason(e.target.value)}
            >
              <option value="">Not set</option>
              {SEASONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-notes">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="ai-notes"
              className={styles.textarea}
              placeholder="Anything worth remembering — stain on hem, a gift from grandma, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="3"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {(() => {
            // Compute once per render — used both to disable Save and to
            // render the "what's missing?" hint below. We only surface the
            // hint when there's an actionable list (household loaded, not
            // mid-save); otherwise the button is disabled for a reason the
            // user can't fix by clicking fields.
            const missing = getMissingRequiredFields()
            const disabled = !canSubmit() || saving
            return (
              <>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={disabled}
                >
                  {saving
                    ? 'Saving…'
                    : isEditMode
                      ? 'Save changes'
                      : 'Save item'}
                </button>
                {disabled && !saving && household && missing.length > 0 && (
                  <div className={styles.saveHint} role="status">
                    Still needed to save:{' '}
                    {missing.map((m, i) => (
                      <span key={m.domId}>
                        <a
                          href={`#${m.domId}`}
                          onClick={e => {
                            // Smooth-focus the field so the user can act on
                            // the hint without hunting for it on long forms.
                            e.preventDefault()
                            const el = document.getElementById(m.domId)
                            if (el) {
                              el.focus()
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            }
                          }}
                        >
                          {m.label}
                        </a>
                        {i < missing.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )
          })()}
        </form>
      </main>
    </div>
  )
}
