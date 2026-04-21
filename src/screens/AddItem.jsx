import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import { SLOTS, SLOT_BY_ID } from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import styles from './AddItem.module.css'

// Add / edit item form. Same component serves two routes:
//   - /add-item           → create mode. INSERT on submit, land on /inventory.
//   - /item/:id/edit      → edit mode. Loads the row, prefills state, UPDATE
//                           on submit, navigates back to the item detail page
//                           so the user sees the saved result.
//
// Fields match the check constraints on beta.clothing_items (migration 006):
//   - category, item_type, size_label, inventory_status: required
//   - condition: required when owning, optional otherwise (enforced here, not
//     in DB, so future flows like "marking as outgrown" can leave it null)
//   - priority: only relevant on wishlist items
//   - brand / season / notes / quantity: always optional (except qty defaults 1)
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

  // Edit vs create is decided by whether the route captured an :id. The
  // ItemDetail screen links to /item/:id/edit; the Home/Inventory CTAs
  // link to /add-item (no id). We can't rely on pathname matching here
  // because react-router handles the matching — we just check `id`.
  const { id: editId } = useParams()
  const isEditMode = Boolean(editId)

  // Optional deep-link pre-fill. When the user jumped here from the slot
  // detail page ("Add one" CTA), the URL carries:
  //   mode=owned|needed, category=<category>, size=<size_label>, from_slot=<slot_id>
  // Ignore anything that doesn't match the whitelists so malformed URLs
  // don't put the form into a weird state. Search params are ignored in
  // edit mode — the loaded row is the source of truth.
  const [searchParams] = useSearchParams()
  const initialMode = searchParams.get('mode') === 'needed' ? 'needed' : 'owned'
  const initialCategoryParam = searchParams.get('category')
  const initialSizeParam = searchParams.get('size')
  const initialSlotParam = searchParams.get('from_slot')

  // Figure out household + baby once, on mount. We need household_id to
  // insert; baby_id is soft-nullable but we set it when we can so items tie
  // to the baby they were added for.
  const [household, setHousehold] = useState(null)
  const [baby, setBaby] = useState(null)
  const [loadingContext, setLoadingContext] = useState(true)

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
  const [brand, setBrand] = useState('')
  const [season, setSeason] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function loadContext() {
      const { data: memberships, error: memErr } = await supabase
        .schema(currentSchema)
        .from('household_members')
        .select('household_id, households(id, name)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)

      if (cancelled) return
      if (memErr || !memberships?.[0]?.households) {
        setError(memErr?.message || 'No household found — finish onboarding first.')
        setLoadingContext(false)
        return
      }
      const h = memberships[0].households

      const { data: babies } = await supabase
        .schema(currentSchema)
        .from('babies')
        .select('id, name')
        .eq('household_id', h.id)
        .limit(1)

      if (cancelled) return
      setHousehold(h)
      setBaby(babies?.[0] ?? null)
      setLoadingContext(false)
      // Only fire add_item_started in create mode — edit sessions are a
      // different funnel and shouldn't pollute the add-item conversion
      // numbers. Edit completion logs via itemEdited at submit time.
      if (!isEditMode) track.addItemStarted({ mode })
    }

    loadContext()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // In edit mode, load the existing row and hydrate every form field from
  // it. Runs in parallel with loadContext; both have to finish before the
  // form can render (see the combined loading gate below).
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

  function canSubmit() {
    if (!household) return false
    if (!category || !itemType || !sizeLabel) return false
    if (mode === 'owned' && !condition) return false
    if (!(quantity >= 1)) return false
    return true
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

    // Create path.
    const row = {
      household_id: household.id,
      baby_id: baby?.id ?? null,
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
  if (loadingContext || loadingItem) {
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
          {/* Mobile-only sprig beneath the title. Hidden on desktop. */}
          <IvySprig />
        </div>
        <ProfileMenu />
      </header>

      <main className={styles.body}>
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
              <label className={styles.label} htmlFor="ai-condition">Condition</label>
              <select
                id="ai-condition"
                className={styles.input}
                value={condition}
                onChange={e => setCondition(e.target.value)}
                required
              >
                <option value="">Pick one…</option>
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

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!canSubmit() || saving}
          >
            {saving
              ? 'Saving…'
              : isEditMode
                ? 'Save changes'
                : 'Save item'}
          </button>
        </form>
      </main>
    </div>
  )
}
