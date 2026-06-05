import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { SLOTS, AGE_RANGES, recommendedQty } from '../lib/wardrobe'
import { ITEMS as ITEM_DEFS, CATEGORY_META } from '../lib/categories'
import BottomNav from '../components/BottomNav'
import styles from './WishlistEdit.module.css'

// Mirrors the lookup maps in WishlistPublic
const CLOTHING_SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]))
const ITEM_SLOT     = Object.fromEntries(ITEM_DEFS.map(i => [i.id, i]))
const NON_CLOTHING_ORDER = ['sleep','feeding','diapering','travel','play','health','bath']

function claimKey(slotType, slotId, sizeLabel) {
  return `${slotType}:${slotId}:${sizeLabel || ''}`
}

export default function WishlistEdit() {
  const navigate = useNavigate()
  const { household, babies, currentBaby } = useHousehold()

  const [loading, setLoading]   = useState(true)
  const [pageData, setPageData] = useState(null)
  const [shareId, setShareId]   = useState(null)
  const [token, setToken]       = useState(null)
  const [skipSlots, setSkipSlotsState]  = useState(new Set())
  const [skipCats, setSkipCatsState]    = useState(new Set())
  const [working, setWorking]   = useState(new Set())
  const [copyDone, setCopyDone] = useState(false)

  // Load or create the wishlist share, then fetch gap data
  useEffect(() => {
    if (!household?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)

      // Find or create a wishlist share for this household
      let { data: existing } = await supabase.schema(currentSchema)
        .from('wishlist_shares')
        .select('id, token, skip_slots, skip_categories, show_priority')
        .eq('household_id', household.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      let share = existing
      if (!share) {
        const { data: created } = await supabase.schema(currentSchema)
          .from('wishlist_shares')
          .insert({ household_id: household.id, is_active: true })
          .select('id, token, skip_slots, skip_categories, show_priority')
          .single()
        share = created
      }

      if (!share || cancelled) { setLoading(false); return }

      setShareId(share.id)
      setToken(share.token)
      setSkipSlotsState(new Set(share.skip_slots || []))
      setSkipCatsState(new Set((share.skip_categories || []).filter(c => c !== 'clothing')))

      // Fetch the gap data exactly as WishlistPublic does
      const { data, error } = await supabase.schema(currentSchema)
        .rpc('get_wishlist_for_share', { p_token: share.token })

      if (!cancelled) {
        if (!error && data && !data.error) setPageData(data)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [household?.id])

  // Reload gap data after edits
  const reloadGaps = useCallback(async () => {
    if (!token) return
    const { data, error } = await supabase.schema(currentSchema)
      .rpc('get_wishlist_for_share', { p_token: token })
    if (!error && data && !data.error) setPageData(data)
  }, [token])

  // Save skip_slots / skip_categories back to the share
  const saveSkips = useCallback(async (newSkipSlots, newSkipCats) => {
    if (!shareId) return
    await supabase.schema(currentSchema)
      .from('wishlist_shares')
      .update({
        skip_slots: newSkipSlots.size > 0 ? [...newSkipSlots] : null,
        skip_categories: newSkipCats.size > 0 ? [...newSkipCats] : null,
      })
      .eq('id', shareId)
  }, [shareId])

  // Toggle priority on a gap row
  const togglePriority = useCallback(async (row, slotType) => {
    const key = row.id
    setWorking(prev => new Set([...prev, key]))
    const table = slotType === 'clothing' ? 'clothing_items' : 'items'
    await supabase.schema(currentSchema)
      .from(table)
      .update({ is_priority: !row.is_priority })
      .eq('id', row.id)
    await reloadGaps()
    setWorking(prev => { const s = new Set(prev); s.delete(key); return s })
  }, [reloadGaps])

  // Hide/show a slot from the shared view
  const toggleSlotVisibility = useCallback(async (slotId) => {
    setSkipSlotsState(prev => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      saveSkips(next, skipCats)
      return next
    })
    // Reload so the view reflects the skip
    setTimeout(reloadGaps, 300)
  }, [skipCats, saveSkips, reloadGaps])

  // Share link
  const shareUrl = token ? `${window.location.origin}/wishlist/${token}` : null

  async function copyLink() {
    if (!shareUrl) return
    try { await navigator.clipboard.writeText(shareUrl) } catch {}
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingBar} />
      </div>
    )
  }

  if (!pageData) {
    return (
      <div className={styles.page}>
        <header className={styles.hero}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
        </header>
        <div className={styles.empty}>
          <p className={styles.emptyText}>Add items to your inventory first to generate your wishlist.</p>
          <button className={styles.emptyBtn} onClick={() => navigate('/inventory')}>Go to Inventory</button>
        </div>
        <BottomNav />
      </div>
    )
  }

  const { share, household: hh, babies: hBabies, clothing, items } = pageData

  const displayedClothing = (clothing || []).filter(r => !skipSlots.has(r.slot_id))
  const displayedItems    = (items || []).filter(r => !skipSlots.has(r.slot_id))

  const priorityClothing = displayedClothing.filter(r => r.is_priority)
  const priorityItems    = displayedItems.filter(r => r.is_priority)
  const hasPriority      = priorityClothing.length + priorityItems.length > 0

  // Clothing by size
  const bySize = {}
  for (const r of displayedClothing.filter(r => !r.is_priority)) {
    if (!bySize[r.size_label]) bySize[r.size_label] = []
    bySize[r.size_label].push(r)
  }
  const sizes = AGE_RANGES.filter(s => bySize[s]?.length > 0)

  // Non-clothing by category
  const byCat = {}
  for (const r of displayedItems.filter(r => !r.is_priority)) {
    if (!byCat[r.top_category]) byCat[r.top_category] = []
    byCat[r.top_category].push(r)
  }
  const usedCats = NON_CLOTHING_ORDER.filter(c => byCat[c]?.length > 0)

  const babyName = hBabies?.[0]?.name || null
  const householdName = hh?.name || 'Your'

  return (
    <div className={styles.page}>

      {/* Hero — identical to WishlistPublic */}
      <header className={styles.hero}>
        <div className={styles.heroTopbar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>←</button>
          <button className={styles.copyBtn} onClick={copyLink}>
            {copyDone ? 'Copied!' : 'Copy link'}
          </button>
        </div>
        <div className={styles.heroEyebrow}>Baby Wishlist</div>
        <h1 className={styles.heroTitle}>{householdName}&apos;s Wishlist</h1>
        {babyName && <div className={styles.heroBabyPill}>{babyName}</div>}
        <p className={styles.heroHint}>
          ★ marks an item as most needed &nbsp;·&nbsp; × hides it from family
        </p>
      </header>

      <div className={styles.body}>

        {/* Most needed */}
        {hasPriority && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className={styles.priorityStar}>★</span>
              <span className={styles.sectionTitle}>Most needed</span>
            </div>
            <div className={styles.cardGrid}>
              {priorityClothing.map(row => (
                <GapCard key={`c-${row.id}`} row={row} slotType="clothing"
                  hidden={false} working={working.has(row.id)}
                  onPriority={togglePriority} onToggleVisibility={toggleSlotVisibility} />
              ))}
              {priorityItems.map(row => (
                <GapCard key={`i-${row.id}`} row={row} slotType="item"
                  hidden={false} working={working.has(row.id)}
                  onPriority={togglePriority} onToggleVisibility={toggleSlotVisibility} />
              ))}
            </div>
          </section>
        )}

        {/* Clothing by size */}
        {displayedClothing.filter(r => !r.is_priority).length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionStaticHead}>Clothing</div>
            {sizes.map(size => (
              <div key={size}>
                <div className={styles.sizeChip}>{size}</div>
                <div className={styles.cardGrid}>
                  {bySize[size].map(row => (
                    <GapCard key={`c-${row.id}`} row={row} slotType="clothing"
                      hidden={skipSlots.has(row.slot_id)} working={working.has(row.id)}
                      onPriority={togglePriority} onToggleVisibility={toggleSlotVisibility} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Non-clothing by category */}
        {usedCats.map(cat => (
          <section key={cat} className={styles.section}>
            <div className={styles.sectionStaticHead}>
              {CATEGORY_META[cat]?.label || cat}
            </div>
            <div className={styles.cardGrid}>
              {byCat[cat].map(row => (
                <GapCard key={`i-${row.id}`} row={row} slotType="item"
                  hidden={skipSlots.has(row.slot_id)} working={working.has(row.id)}
                  onPriority={togglePriority} onToggleVisibility={toggleSlotVisibility} />
              ))}
            </div>
          </section>
        ))}

        {(displayedClothing.length === 0 && displayedItems.length === 0 && !hasPriority) && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>Add items to your inventory to generate wishlist gaps.</p>
            <button className={styles.emptyBtn} onClick={() => navigate('/inventory')}>
              Go to Inventory
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

// ── Gap card — matches WishlistPublic card style with edit overlays ──
function GapCard({ row, slotType, hidden, working, onPriority, onToggleVisibility }) {
  const isClothing = slotType === 'clothing'
  const slot  = isClothing ? CLOTHING_SLOT[row.slot_id] : ITEM_SLOT[row.slot_id]
  const label = slot?.label || row.slot_id

  const recommended = isClothing
    ? recommendedQty(slot, row.size_label)
    : (slot?.recommended ?? 1)
  const stillNeeded = Math.max(0, recommended - (row.owned_count || 0))

  return (
    <div className={`${styles.card} ${hidden ? styles.cardHidden : ''} ${working ? styles.cardWorking : ''}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardLabel}>{label}</span>
        {row.is_priority && !hidden && (
          <span className={styles.cardStar}>★</span>
        )}
      </div>

      {isClothing && row.size_label && (
        <span className={styles.cardSize}>{row.size_label}</span>
      )}

      {!hidden && (
        <div className={styles.cardNeed}>
          Need {stillNeeded} more
        </div>
      )}
      {hidden && (
        <div className={styles.cardHiddenLabel}>Hidden from family</div>
      )}

      {/* Edit controls */}
      <div className={styles.cardControls}>
        {!hidden && (
          <button
            className={`${styles.starBtn} ${row.is_priority ? styles.starBtnActive : ''}`}
            onClick={() => onPriority(row, slotType)}
            disabled={working}
            aria-label={row.is_priority ? 'Remove from most needed' : 'Mark as most needed'}
          >
            {row.is_priority ? '★' : '☆'}
          </button>
        )}
        <button
          className={`${styles.hideBtn} ${hidden ? styles.hideBtnActive : ''}`}
          onClick={() => onToggleVisibility(row.slot_id)}
          disabled={working}
          aria-label={hidden ? 'Show to family' : 'Hide from family'}
          title={hidden ? 'Show to family' : 'Hide from family'}
        >
          {hidden ? '👁' : '×'}
        </button>
      </div>
    </div>
  )
}
