import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../contexts/HouseholdContext'
import { useUpgradeGate } from '../contexts/UpgradeGateContext'
import { track } from '../lib/analytics'
import { SLOTS, SLOT_BY_ID, AGE_RANGES, getSlotForItem } from '../lib/wardrobe'
import {
  ITEMS_BY_SUB_CATEGORY,
  SUB_CATEGORIES_BY_CATEGORY,
  SUB_CATEGORY_LABELS,
  getItemSlot,
} from '../lib/categories'
import HeaderActions from '../components/HeaderActions'
import IvySprig from '../components/IvySprig'
import TagScanner from '../components/TagScanner'
import styles from './AddItem.module.css'

// Add / edit item form. Supports all 8 top-level categories:
//   Clothing → INSERT/UPDATE beta.clothing_items (unchanged)
//   All others → INSERT/UPDATE beta.items
//
// The top-category chip row at the top of the form decides which field set
// and which table to use. Clothing keeps its existing fields (sub-category,
// slot type, size, season). Non-clothing gets sub-category + item-type from
// the categories.js taxonomy + optional age-relevance.
//
// Edit mode: tries clothing_items first, falls back to items.

// ── Top-level category config ─────────────────────────────────────────────────
const TOP_CATEGORIES = [
  { value: 'clothing',  label: 'Clothing'  },
  { value: 'sleep',     label: 'Sleep'     },
  { value: 'feeding',   label: 'Feeding'   },
  { value: 'diapering', label: 'Diapering' },
  { value: 'travel',    label: 'Travel'    },
  { value: 'play',      label: 'Play'      },
  { value: 'health',    label: 'Health'    },
  { value: 'bath',      label: 'Bath'      },
]

// ── Clothing-specific constants (unchanged) ───────────────────────────────────
const CLOTHING_CATEGORIES = [
  { value: 'tops_and_bodysuits', label: 'Tops and bodysuits' },
  { value: 'one_pieces',         label: 'One-pieces' },
  { value: 'bottoms',            label: 'Bottoms' },
  { value: 'dresses_and_skirts', label: 'Dresses and skirts' },
  { value: 'outerwear',          label: 'Outerwear' },
  { value: 'sleepwear',          label: 'Sleepwear' },
  { value: 'footwear',           label: 'Footwear' },
  { value: 'accessories',        label: 'Accessories' },
  { value: 'swimwear',           label: 'Swimwear' },
]

const SIZES = ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M']

const CONDITIONS = [
  { value: 'new',      label: 'New (with tags)' },
  { value: 'like_new', label: 'Like new' },
  { value: 'good',     label: 'Good' },
  { value: 'fair',     label: 'Fair' },
  { value: 'worn',     label: 'Worn' },
]

const SEASONS = [
  { value: 'warm_weather', label: 'Warm weather' },
  { value: 'cold_weather', label: 'Cold weather' },
  { value: 'all_season',   label: 'All-season' },
]

const PRIORITIES = [
  { value: 'must_have',     label: 'Must have' },
  { value: 'nice_to_have',  label: 'Nice to have' },
  { value: 'low_priority',  label: 'Low priority' },
]

export default function AddItem() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { requireRealAccount } = useUpgradeGate()
  const {
    household,
    babies,
    currentBaby,
    items: householdItems,
    loading: householdLoading,
    error: householdError,
    reloadItems,
  } = useHousehold()

  const { id: editId } = useParams()
  const isEditMode = Boolean(editId)

  const [searchParams] = useSearchParams()
  const initialMode        = searchParams.get('mode') === 'needed' ? 'needed' : 'owned'
  const initialTopParam    = searchParams.get('top_category')
  const initialCategoryParam = searchParams.get('category')
  const initialSizeParam   = searchParams.get('size')
  const initialSlotParam   = searchParams.get('from_slot')
  const initialBrandParam  = searchParams.get('brand')
  const autoScan = !isEditMode && searchParams.get('autoScan') === '1'
  const [manualMode, setManualMode] = useState(false)

  // ── Top category ──────────────────────────────────────────────────────────
  // Priority: ?top_category > ?category (when it's a top-level non-clothing value) > default
  const [topCategory, setTopCategoryState] = useState(() => {
    if (isEditMode) return 'clothing'  // overwritten when row loads
    if (initialTopParam && TOP_CATEGORIES.some(c => c.value === initialTopParam)) {
      return initialTopParam
    }
    // ?category=sleep (etc.) doubles as a top-category selector for non-clothing
    if (initialCategoryParam && TOP_CATEGORIES.some(c => c.value === initialCategoryParam && c.value !== 'clothing')) {
      return initialCategoryParam
    }
    return 'clothing'
  })
  const isClothing = topCategory === 'clothing'

  // ── Clothing fields ───────────────────────────────────────────────────────
  const [category, setCategory]   = useState(() => {
    if (isEditMode) return ''
    return CLOTHING_CATEGORIES.some(c => c.value === initialCategoryParam) ? initialCategoryParam : ''
  })
  const [itemType, setItemType]   = useState(() => {
    if (isEditMode) return ''
    const slot = initialSlotParam ? SLOT_BY_ID[initialSlotParam] : null
    if (!slot || slot.category !== initialCategoryParam) return ''
    return slot.id
  })
  const [sizeLabel, setSizeLabel] = useState(() => {
    if (isEditMode) return ''
    return SIZES.includes(initialSizeParam) ? initialSizeParam : ''
  })
  const [season, setSeason]       = useState('')

  // ── Non-clothing fields ───────────────────────────────────────────────────
  const [subCategory, setSubCategoryState]  = useState('')
  const [catItemType, setCatItemType]       = useState('')   // item slot id from categories.js
  const [ageRelevance, setAgeRelevance]     = useState('')   // optional

  // ── Shared fields ──────────────────────────────────────────────────────────
  const [mode, setMode]           = useState(isEditMode ? 'owned' : initialMode)
  const [condition, setCondition] = useState('')
  const [priority, setPriority]   = useState('')
  const [brand, setBrand]         = useState(() => {
    if (isEditMode) return ''
    if (typeof initialBrandParam !== 'string') return ''
    return initialBrandParam.trim().slice(0, 80)
  })
  const [quantity, setQuantity]   = useState(1)
  const [notes, setNotes]         = useState('')

  // ── Edit mode row ─────────────────────────────────────────────────────────
  const [existingItem, setExistingItem]     = useState(null)
  const [existingItemTable, setExistingItemTable] = useState('clothing_items')
  const [loadingItem, setLoadingItem]       = useState(isEditMode)

  // ── Scan / photo state ────────────────────────────────────────────────────
  const [saving, setSaving]                         = useState(false)
  const [error, setError]                           = useState(null)
  const [scanFilledCount, setScanFilledCount]       = useState(0)
  const [pendingGarmentDataUrl, setPendingGarmentDataUrl] = useState(null)
  const [lowConfFields, setLowConfFields]           = useState(() => new Set())

  const clearLowConfFlag = useCallback((fieldName) => {
    setLowConfFields((prev) => {
      if (!prev.has(fieldName)) return prev
      const next = new Set(prev)
      next.delete(fieldName)
      return next
    })
  }, [])

  // ── Derived lists for non-clothing ────────────────────────────────────────
  const subCategoryOptions = useMemo(() => {
    if (isClothing) return []
    return SUB_CATEGORIES_BY_CATEGORY[topCategory] || []
  }, [isClothing, topCategory])

  const catItemTypeOptions = useMemo(() => {
    if (isClothing || !subCategory) return []
    return ITEMS_BY_SUB_CATEGORY[subCategory] || []
  }, [isClothing, subCategory])

  // ── Clothing slot options ─────────────────────────────────────────────────
  const clothingTypeOptions = useMemo(
    () => (category ? SLOTS.filter(s => s.category === category) : []),
    [category],
  )

  // ── Analytics on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (isEditMode) return
    if (householdLoading) return
    if (!household) return
    track.addItemStarted({ mode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdLoading, household])

  useEffect(() => {
    if (householdError) {
      setError(householdError)
    } else if (!householdLoading && !household) {
      setError('No household found — finish onboarding first.')
    }
  }, [householdError, householdLoading, household])

  // ── Edit mode loader ───────────────────────────────────────────────────────
  // Tries clothing_items first; if not found, tries beta.items.
  // Sets existingItemTable so the submit handler knows which table to UPDATE.
  useEffect(() => {
    if (!user || !isEditMode || !editId) return
    let cancelled = false

    async function loadExisting() {
      setLoadingItem(true)

      // Try clothing_items first
      const { data: clothingData, error: clothingErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('id', editId)
        .maybeSingle()

      if (cancelled) return

      if (!clothingErr && clothingData) {
        setExistingItem(clothingData)
        setExistingItemTable('clothing_items')
        setTopCategoryState('clothing')
        setMode(clothingData.inventory_status === 'needed' ? 'needed' : 'owned')
        setCategory(clothingData.category || '')
        setItemType(clothingData.item_type || '')
        setSizeLabel(clothingData.size_label || '')
        setCondition(clothingData.condition || '')
        setPriority(clothingData.priority || '')
        setBrand(clothingData.brand || '')
        setSeason(clothingData.season || '')
        setQuantity(clothingData.quantity || 1)
        setNotes(clothingData.notes || '')
        setLoadingItem(false)
        return
      }

      // Fall back to beta.items
      const { data: catData, error: catErr } = await supabase
        .schema(currentSchema)
        .from('items')
        .select('*')
        .eq('id', editId)
        .maybeSingle()

      if (cancelled) return

      if (catErr || !catData) {
        setError(catErr?.message || "This item isn’t in your inventory anymore.")
        setLoadingItem(false)
        return
      }

      setExistingItem(catData)
      setExistingItemTable('items')
      setTopCategoryState(catData.top_category || 'sleep')
      setMode(catData.inventory_status === 'needed' ? 'needed' : 'owned')
      setSubCategoryState(catData.sub_category || '')
      setCatItemType(catData.item_type || '')
      setAgeRelevance(catData.age_relevance || '')
      setCondition(catData.condition || '')
      setPriority(catData.priority || '')
      setBrand(catData.brand || '')
      setQuantity(catData.quantity || 1)
      setNotes(catData.notes || '')
      setLoadingItem(false)
    }

    loadExisting()
    return () => { cancelled = true }
  }, [user, isEditMode, editId])

  // ── Top-category change handler ────────────────────────────────────────────
  function onTopCategoryChange(val) {
    setTopCategoryState(val)
    // Reset category-specific fields when switching
    setCategory('')
    setItemType('')
    setSizeLabel('')
    setSeason('')
    setSubCategoryState('')
    setCatItemType('')
    setAgeRelevance('')
  }

  // ── Clothing change handlers ───────────────────────────────────────────────
  function onCategoryChange(v) {
    setCategory(v)
    clearLowConfFlag('category')
    const currentSlot = itemType ? SLOT_BY_ID[itemType] : null
    if (!currentSlot || currentSlot.category !== v) {
      setItemType('')
      clearLowConfFlag('item_type')
    }
    if (v) track.itemCategorySelected(v)
  }

  function onTypeChange(v) {
    setItemType(v)
    clearLowConfFlag('item_type')
    if (v) track.itemCategorySelected(v)
  }

  function onSizeChange(v) {
    setSizeLabel(v)
    clearLowConfFlag('size_label')
    if (v) track.itemSizeSelected(v)
  }

  // ── Non-clothing change handlers ──────────────────────────────────────────
  function onSubCategoryChange(v) {
    setSubCategoryState(v)
    setCatItemType('')  // reset item type when sub-category changes
  }

  // ── Required fields validation ────────────────────────────────────────────
  function getMissingRequiredFields() {
    const missing = []
    if (isClothing) {
      if (!category)  missing.push({ label: 'Category', domId: 'ai-category' })
      if (!itemType)  missing.push({ label: 'Type',     domId: 'ai-type' })
      if (!sizeLabel) missing.push({ label: 'Size',     domId: 'ai-size' })
    } else {
      if (!subCategory) missing.push({ label: 'Sub-category', domId: 'ai-subcat' })
      if (!catItemType) missing.push({ label: 'Item type',    domId: 'ai-cattype' })
    }
    if (!(quantity >= 1)) missing.push({ label: 'Quantity', domId: 'ai-quantity' })
    return missing
  }

  function canSubmit() {
    if (!household) return false
    return getMissingRequiredFields().length === 0
  }

  // ── Scan result handler (clothing only) ───────────────────────────────────
  function onScanResult(fields, confidence, photos) {
    if (!fields) return
    let filled = 0
    const nextLowConf = new Set()
    const flagIfLow = (name, level) => { if (level === 'low') nextLowConf.add(name) }

    if (fields.category && CLOTHING_CATEGORIES.some(c => c.value === fields.category)) {
      setCategory(fields.category)
      filled += 1
      flagIfLow('category', confidence?.category)
      const slot = fields.item_type ? SLOT_BY_ID[fields.item_type] : null
      if (slot && slot.category === fields.category) {
        setItemType(slot.id)
        filled += 1
        flagIfLow('item_type', confidence?.item_type)
      } else {
        setItemType('')
      }
    }
    if (fields.size_label && SIZES.includes(fields.size_label)) {
      setSizeLabel(fields.size_label)
      filled += 1
      flagIfLow('size_label', confidence?.size_label)
    }
    if (fields.brand && typeof fields.brand === 'string') {
      setBrand(fields.brand.trim().slice(0, 80))
      filled += 1
      flagIfLow('brand', confidence?.brand)
    }
    if (fields.season && SEASONS.some(s => s.value === fields.season)) {
      setSeason(fields.season)
      filled += 1
      flagIfLow('season', confidence?.season)
    }
    setScanFilledCount(filled)
    setLowConfFields(nextLowConf)
    if (photos?.garmentDataUrl) {
      setPendingGarmentDataUrl(photos.garmentDataUrl)
    }
  }

  // ── Scan result handler (non-clothing) ───────────────────────────────────
  // Mirrors onScanResult but populates the non-clothing field set from the
  // scan-item edge function response. Also stores the photo as the
  // pending display image for upload on save.
  function onItemScanResult(fields, confidence, photos) {
    if (!fields) return
    let filled = 0
    const nextLowConf = new Set()
    const flagIfLow = (name, level) => { if (level === 'low') nextLowConf.add(name) }

    // If the model identified a different top category, reset sub-fields first
    if (fields.top_category && TOP_CATEGORIES.some(c => c.value === fields.top_category)) {
      if (fields.top_category !== topCategory) {
        onTopCategoryChange(fields.top_category)
      }
      filled += 1
      flagIfLow('top_category', confidence?.top_category)
    }
    if (fields.sub_category) {
      setSubCategoryState(fields.sub_category)
      filled += 1
    }
    if (fields.item_type) {
      setCatItemType(fields.item_type)
      filled += 1
      flagIfLow('item_type', confidence?.item_type)
    }
    if (fields.brand && typeof fields.brand === 'string') {
      setBrand(fields.brand.trim().slice(0, 80))
      filled += 1
      flagIfLow('brand', confidence?.brand)
    }
    if (fields.condition && CONDITIONS.some(c => c.value === fields.condition)) {
      setCondition(fields.condition)
      filled += 1
      flagIfLow('condition', confidence?.condition)
    }
    setScanFilledCount(filled)
    setLowConfFields(nextLowConf)
    if (photos?.itemDataUrl) {
      setPendingGarmentDataUrl(photos.itemDataUrl)
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault()
if (!canSubmit() || saving) return
    setSaving(true)
    setError(null)

    try {
      await requireRealAccount(async () => {

        if (isClothing) {
          // ── Clothing path (unchanged) ──────────────────────────────────
          const fields = {
            category,
            item_type: itemType,
            size_label: sizeLabel,
            condition: mode === 'owned' ? (condition || null) : null,
            priority: mode === 'needed' && priority ? priority : null,
            brand: brand.trim() || null,
            season: season || null,
            quantity: Number(quantity) || 1,
            notes: notes.trim() || null,
          }

          if (isEditMode && existingItem && existingItemTable === 'clothing_items') {
            const patch = { ...fields }
            if (mode !== existingItem.inventory_status && (mode === 'owned' || mode === 'needed')) {
              patch.inventory_status = mode
            }
            const { error: updErr } = await supabase
              .schema(currentSchema)
              .from('clothing_items')
              .update(patch)
              .eq('id', existingItem.id)
            if (updErr) throw new Error(updErr.message)
            track.itemEdited({ mode, category, size_label: sizeLabel })
            reloadItems()
            navigate(`/item/${existingItem.id}`)
            return
          }

          // Create: upload photo then insert
          const itemId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

          let garmentPath = null
          if (pendingGarmentDataUrl) {
            try {
              const blob = await fetch(pendingGarmentDataUrl).then(r => r.blob())
              const path = `${household.id}/${itemId}.jpg`
              const { error: upErr } = await supabase.storage
                .from('garment-photos')
                .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
              if (!upErr) garmentPath = path
            } catch { /* silent — item saves without photo */ }
          }

          const clothingSlot = getSlotForItem(fields)
          const { error: insertErr } = await supabase
            .schema(currentSchema)
            .from('clothing_items')
            .insert({
              id: itemId,
              household_id: household.id,
              baby_id: currentBaby?.id ?? null,
              slot_id: clothingSlot?.id || null,
              ...fields,
              inventory_status: mode,
              name: null,
              garment_photo_path: garmentPath,
            })
          if (insertErr) throw new Error(insertErr.message)
          track.itemSaved({ mode, category, size_label: sizeLabel })
          reloadItems()
          navigate('/inventory')

        } else {
          // ── Non-clothing path ──────────────────────────────────────────
          const fields = {
            top_category: topCategory,
            sub_category: subCategory,
            item_type: catItemType,
            age_relevance: ageRelevance || null,
            condition: mode === 'owned' ? (condition || null) : null,
            priority: mode === 'needed' && priority ? priority : null,
            brand: brand.trim() || null,
            quantity: Number(quantity) || 1,
            notes: notes.trim() || null,
          }

          if (isEditMode && existingItem && existingItemTable === 'items') {
            const patch = { ...fields }
            if (mode !== existingItem.inventory_status && (mode === 'owned' || mode === 'needed')) {
              patch.inventory_status = mode
            }
            const { error: updErr } = await supabase
              .schema(currentSchema)
              .from('items')
              .update(patch)
              .eq('id', existingItem.id)
            if (updErr) throw new Error(updErr.message)
            reloadItems()
            navigate(`/item/${existingItem.id}`)
            return
          }

          const itemId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

          let itemPhotoPath = null
          if (pendingGarmentDataUrl) {
            try {
              const blob = await fetch(pendingGarmentDataUrl).then(r => r.blob())
              const path = `${household.id}/${itemId}.jpg`
              const { error: upErr } = await supabase.storage
                .from('garment-photos')
                .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
              if (!upErr) itemPhotoPath = path
            } catch { /* silent — item saves without photo */ }
          }

          const matchedSlot = getItemSlot(fields)
          const { error: insertErr } = await supabase
            .schema(currentSchema)
            .from('items')
            .insert({
              id: itemId,
              household_id: household.id,
              baby_id: currentBaby?.id ?? null,
              slot_id: matchedSlot?.id || null,
              ...fields,
              inventory_status: mode,
              name: null,
              item_photo_path: itemPhotoPath,
            })
          if (insertErr) throw new Error(insertErr.message)
          track.itemSaved({ mode, category: fields.top_category, size_label: null })
          reloadItems()
          navigate('/inventory')
        }
      }, { skipGate: householdItems.length < 5 })
      setSaving(false)
    } catch (e) {
      setSaving(false)
      if (e?.cancelled) return
      setError(e.message || "Couldn't save the item.")
    }
  }

  // ── Loading gate ──────────────────────────────────────────────────────────
  if (householdLoading || loadingItem) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  const backDest = isEditMode && existingItem ? `/item/${existingItem.id}` : '/inventory'
  const backLabel = isEditMode ? 'Back to item' : 'Back to inventory'

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
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
          <IvySprig />
        </div>
        <HeaderActions />
      </header>

      <main className={styles.body}>

        {/* ── Top-category picker ───────────────────────────────────────── */}
        {!isEditMode && (
          <div className={styles.catPicker}>
            {TOP_CATEGORIES.map(tc => (
              <button
                key={tc.value}
                type="button"
                className={`${styles.catChip} ${topCategory === tc.value ? styles.catChipActive : ''}`}
                onClick={() => onTopCategoryChange(tc.value)}
              >
                {tc.label}
              </button>
            ))}
          </div>
        )}

        {/* ── TagScanner ───────────────────────────────────────────────── */}
        {!isEditMode && !manualMode && (
          <div className={styles.scanRow}>
            <TagScanner
              variant="inline"
              from="add_item"
              autoOpen={autoScan && isClothing}
              onManual={() => setManualMode(true)}
              mode={isClothing ? 'tag' : 'item'}
              topCategory={isClothing ? null : topCategory}
              onResult={isClothing ? onScanResult : onItemScanResult}
              onBatchSaved={(count) => {
                reloadItems()
                navigate('/inventory', {
                  state: { toast: `Added ${count} item${count === 1 ? '' : 's'}` },
                })
              }}
              disabled={saving}
            />
            {scanFilledCount > 0 ? (
              <div className={styles.scanHint}>
                Autofilled {scanFilledCount} field{scanFilledCount === 1 ? '' : 's'} from your photo. Review below and save.
              </div>
            ) : (
              <div className={styles.scanIntroHint}>
                {isClothing
                  ? <>Adding a stack? Turn on <strong>Scan many</strong> in the camera to add several items in a row.</>
                  : 'Snap a photo and we\'ll identify the item for you.'}
              </div>
            )}
          </div>
        )}

        <form onSubmit={submit} className={styles.form}>

          {/* ── Mode toggle ──────────────────────────────────────────────── */}
          <div className={styles.segToggle}>
            <button
              type="button"
              className={`${styles.segBtn} ${mode === 'owned'  ? styles.segActive : ''}`}
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

          {/* ── Clothing-specific fields ──────────────────────────────────── */}
          {isClothing && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-category">
                  Category
                  {lowConfFields.has('category') && <span className={styles.verifyBadge}>Verify</span>}
                </label>
                <select
                  id="ai-category"
                  className={`${styles.input} ${lowConfFields.has('category') ? styles.inputVerify : ''}`}
                  value={category}
                  onChange={e => onCategoryChange(e.target.value)}
                  required
                >
                  <option value="">Pick one…</option>
                  {CLOTHING_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-type">
                  Type
                  {lowConfFields.has('item_type') && <span className={styles.verifyBadge}>Verify</span>}
                </label>
                <select
                  id="ai-type"
                  className={`${styles.input} ${lowConfFields.has('item_type') ? styles.inputVerify : ''}`}
                  value={itemType}
                  onChange={e => onTypeChange(e.target.value)}
                  required
                  disabled={!category}
                >
                  <option value="">{category ? 'Pick one…' : 'Choose a category first'}</option>
                  {clothingTypeOptions.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-size">
                  Size
                  {lowConfFields.has('size_label') && <span className={styles.verifyBadge}>Verify</span>}
                </label>
                <select
                  id="ai-size"
                  className={`${styles.input} ${lowConfFields.has('size_label') ? styles.inputVerify : ''}`}
                  value={sizeLabel}
                  onChange={e => onSizeChange(e.target.value)}
                  required
                >
                  <option value="">Pick one…</option>
                  {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── Non-clothing fields ───────────────────────────────────────── */}
          {!isClothing && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-subcat">
                  Sub-category
                </label>
                <select
                  id="ai-subcat"
                  className={styles.input}
                  value={subCategory}
                  onChange={e => onSubCategoryChange(e.target.value)}
                  required
                >
                  <option value="">Pick one…</option>
                  {subCategoryOptions.map(sc => (
                    <option key={sc} value={sc}>{SUB_CATEGORY_LABELS[sc] || sc}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-cattype">
                  Item type
                </label>
                <select
                  id="ai-cattype"
                  className={styles.input}
                  value={catItemType}
                  onChange={e => setCatItemType(e.target.value)}
                  required
                  disabled={!subCategory}
                >
                  <option value="">{subCategory ? 'Pick one…' : 'Choose sub-category first'}</option>
                  {catItemTypeOptions.map(it => (
                    <option key={it.id} value={it.id}>{it.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-agerelevance">
                  Age range <span className={styles.optional}>(optional)</span>
                </label>
                <select
                  id="ai-agerelevance"
                  className={styles.input}
                  value={ageRelevance}
                  onChange={e => setAgeRelevance(e.target.value)}
                >
                  <option value="">All ages</option>
                  {AGE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── Shared optional fields ────────────────────────────────────── */}
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
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-quantity">Quantity</label>
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
                {lowConfFields.has('brand') && <span className={styles.verifyBadge}>Verify</span>}
              </label>
              <input
                id="ai-brand"
                className={`${styles.input} ${lowConfFields.has('brand') ? styles.inputVerify : ''}`}
                type="text"
                placeholder="Carter's, H&M, …"
                value={brand}
                onChange={e => { setBrand(e.target.value); clearLowConfFlag('brand') }}
              />
            </div>
          </div>

          {isClothing && (
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="ai-season">
                Season <span className={styles.optional}>(optional)</span>
                {lowConfFields.has('season') && <span className={styles.verifyBadge}>Verify</span>}
              </label>
              <select
                id="ai-season"
                className={`${styles.input} ${lowConfFields.has('season') ? styles.inputVerify : ''}`}
                value={season}
                onChange={e => { setSeason(e.target.value); clearLowConfFlag('season') }}
              >
                <option value="">Not set</option>
                {SEASONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="ai-notes">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="ai-notes"
              className={styles.textarea}
              placeholder="Anything worth remembering…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="3"
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {(() => {
            const missing = getMissingRequiredFields()
            const disabled = !canSubmit() || saving
            return (
              <>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={disabled}
                >
                  {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Save item'}
                </button>
                {disabled && !saving && household && missing.length > 0 && (
                  <div className={styles.saveHint} role="status">
                    Still needed to save:{' '}
                    {missing.map((m, i) => (
                      <span key={m.domId}>
                        <a
                          href={`#${m.domId}`}
                          onClick={e => {
                            e.preventDefault()
                            const el = document.getElementById(m.domId)
                            if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
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
