import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import { SLOTS, SLOT_BY_ID } from '../lib/wardrobe'
import LogoutButton from '../components/LogoutButton'
import IvySprig from '../components/IvySprig'
import styles from './AddItem.module.css'

// Add item form — the minimum viable version. Fields match the check
// constraints on beta.clothing_items (migration 006):
//   - category, item_type, size_label, inventory_status: required
//   - condition: required when owning, optional otherwise (enforced here, not
//     in DB, so future flows like "marking as outgrown" can leave it null)
//   - priority: only relevant on wishlist items
//   - brand / season / notes / quantity: always optional (except qty defaults 1)
//
// The fuller prototype has photos, colors, weight ranges, fit notes, occasion,
// exchange toggles. Those come later — this form ships enough to close the
// inventory loop (add → see).
//
// Navigation: back button → /inventory (wherever they came from). On save →
// /inventory after logging the itemSaved analytics event.

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

  // Optional deep-link pre-fill. When the user jumped here from the slot
  // detail page ("Add one" CTA), the URL carries:
  //   mode=owned|needed, category=<category>, size=<size_label>, from_slot=<slot_id>
  // Ignore anything that doesn't match the whitelists so malformed URLs
  // don't put the form into a weird state.
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

  // Form state — pre-filled from the URL when possible, otherwise blank.
  // Whitelist the incoming params against CATEGORIES/SIZES so a stale or
  // typo'd URL doesn't silently lock the user into an invalid combination.
  const [mode, setMode] = useState(initialMode)
  const [category, setCategory] = useState(() =>
    CATEGORIES.some(c => c.value === initialCategoryParam) ? initialCategoryParam : ''
  )
  // Item type is now a slot id from the wardrobe taxonomy (e.g. 'bodysuits',
  // 'pajamas'). Old free-text item_types still work on read paths — the
  // getSlotForItem() keyword matcher handles them — but new rows are stored
  // as slot ids so the Wish list tab can route them straight back to a slot
  // without any guesswork.
  const [itemType, setItemType] = useState(() => {
    const slot = initialSlotParam ? SLOT_BY_ID[initialSlotParam] : null
    // Only accept the incoming slot if it actually lives under the incoming
    // category — otherwise we'd end up with a type that can't be picked from
    // the filtered dropdown, and canSubmit would fail silently.
    if (!slot) return ''
    if (slot.category !== initialCategoryParam) return ''
    return slot.id
  })
  const [sizeLabel, setSizeLabel] = useState(() =>
    SIZES.includes(initialSizeParam) ? initialSizeParam : ''
  )
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
      track.addItemStarted({ mode })
    }

    loadContext()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

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

    const row = {
      household_id: household.id,
      baby_id: baby?.id ?? null,
      category,
      // item_type is a slot id from the wardrobe taxonomy. Stored raw (no
      // casing / whitespace tricks) so it round-trips cleanly through
      // getSlotForItem on read.
      item_type: itemType,
      size_label: sizeLabel,
      inventory_status: mode,
      condition: mode === 'owned' ? condition : null,
      priority: mode === 'needed' && priority ? priority : null,
      brand: brand.trim() || null,
      season: season || null,
      quantity: Number(quantity) || 1,
      notes: notes.trim() || null,
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

  if (loadingContext) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

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
        <div className={styles.titleCell}>
          <div className={styles.title}>Add an item</div>
          {/* Mobile-only sprig beneath the title. Hidden on desktop. */}
          <IvySprig />
        </div>
        <LogoutButton />
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
            {saving ? 'Saving…' : 'Save item'}
          </button>
        </form>
      </main>
    </div>
  )
}
