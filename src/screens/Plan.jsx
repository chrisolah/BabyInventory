import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  AGE_RANGES,
  CATEGORY_LABELS,
  SLOTS,
  recommendedQty,
  computeCoverage,
  otherWishes,
  inferAgeRange,
  shouldShowOutgrowBanner,
  pluralize,
  isSlotHiddenForBabies,
} from '../lib/wardrobe'
import {
  SUB_CATEGORY_LABELS,
  SUB_CATEGORIES_BY_CATEGORY,
  computeCategorycoverage,
  getCategorySummary,
  ITEMS_BY_CATEGORY,
} from '../lib/categories'
import BabySwitcher from '../components/BabySwitcher'
import Eyebrow from '../components/Eyebrow'
import BottomNav from '../components/BottomNav'
import HeaderActions from '../components/HeaderActions'
import ShareRegistryModal from '../components/ShareWishlistModal'
import CoverageSummaryCard from '../components/CoverageSummaryCard'
import {
  CategoryChipRow,
  CategorySidebar,
  ClothingNavIcon,
  SleepNavIcon,
  FeedingNavIcon,
  DiaperNavIcon,
  TravelNavIcon,
  PlayNavIcon,
  HealthNavIcon,
  BathNavIcon,
  BookmarkNavIcon,
} from '../components/CategoryNav'
import styles from './Plan.module.css'

// Plan — the "wish list + guide" hub. Route: /plan
//
// Clothing: real coverage data from wardrobe.js taxonomy, per age range,
// with slot-level drill-in to /inventory/slot/:ageRange/:slotId.
// Other categories: placeholder cards — data model coming soon.

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
}

// Category selector shown at the top. "clothing" is live; others are
// coming soon and show a disabled/greyed treatment when tapped.
// Maps each plan category to its relevant guide slug.
// Used to surface a soft "Read our guide" link below each coverage summary card.
const CATEGORY_GUIDE_SLUGS = {
  clothing:  'baby-clothing-guide',
  sleep:     'newborn-safe-sleep-setup',
  feeding:   'bottle-feeding-newborn-what-you-need',
  diapering: 'cloth-vs-disposable-diapers',
  travel:    'choosing-a-car-seat',
  play:      'baby-toys-first-year-by-age',
  health:    'newborn-health-kit-what-to-have',
  bath:      'how-to-bathe-a-newborn',
}

const PLAN_CATEGORIES = [
  { id: 'clothing',  label: 'Clothing',  live: true, icon: ClothingNavIcon, color: 'teal'   },
  { id: 'sleep',     label: 'Sleep',     live: true, icon: SleepNavIcon,    color: 'blue'   },
  { id: 'feeding',   label: 'Feeding',   live: true, icon: FeedingNavIcon,  color: 'amber'  },
  { id: 'diapering', label: 'Diapering', live: true, icon: DiaperNavIcon,   color: 'gray'   },
  { id: 'travel',    label: 'Travel',    live: true, icon: TravelNavIcon,   color: 'purple' },
  { id: 'play',      label: 'Play',      live: true, icon: PlayNavIcon,     color: 'coral'  },
  { id: 'health',    label: 'Health',    live: true, icon: HealthNavIcon,   color: 'red'    },
  { id: 'bath',      label: 'Bath',      live: true, icon: BathNavIcon,     color: 'green'  },
  { id: 'registry',  label: 'Registry',  live: true, icon: BookmarkNavIcon, color: 'teal'   },
]

const CATEGORY_ORDER = [
  'tops_and_bodysuits',
  'one_pieces',
  'bottoms',
  'dresses_and_skirts',
  'outerwear',
  'sleepwear',
  'footwear',
  'accessories',
  'swimwear',
]

export default function Plan() {
  const navigate = useNavigate()
  const {
    household,
    babies,
    selectedBabyId,
    currentBaby,
    items,
    itemsLoading,
    reloadItems,
  } = useHousehold()

  const [selectedCategory, setSelectedCategory] = useState('clothing')
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedAgeRange, setSelectedAgeRange] = useState(null)

  // ── Plan-only tracking prefs + count overrides ─────────────────────────
  // hiddenPrefs: slots the parent removed from Plan tracking. Keyed
  // "kind:slot_id" (kind = 'clothing' | 'item'). Completely separate from
  // the Registry share's skip_slots — hiding here never affects the
  // Registry, and vice versa.
  // qtyOverrides: the SAME registry_quantity_overrides table the Registry
  // edit screen uses, keyed "slot_id:size_label". Reusing it means a count
  // change made from Plan shows up on the Registry too, and vice versa —
  // one number, wherever you edit it.
  const [hiddenPrefs, setHiddenPrefs] = useState(new Set())
  const [qtyOverrides, setQtyOverrides] = useState({})
  const [manageTarget, setManageTarget] = useState(null)
  const [showHiddenClothing, setShowHiddenClothing] = useState(false)
  const [showHiddenCat, setShowHiddenCat] = useState(false)

  useEffect(() => {
    if (!household?.id) return
    let cancelled = false
    async function loadPrefs() {
      const [{ data: prefRows }, { data: overrideRows }] = await Promise.all([
        supabase.schema(currentSchema).from('plan_slot_prefs')
          .select('slot_id, kind, hidden').eq('household_id', household.id),
        supabase.schema(currentSchema).from('registry_quantity_overrides')
          .select('slot_id, size_label, desired_qty').eq('household_id', household.id),
      ])
      if (cancelled) return
      setHiddenPrefs(new Set((prefRows || []).filter(r => r.hidden).map(r => `${r.kind}:${r.slot_id}`)))
      const map = {}
      for (const o of overrideRows || []) map[`${o.slot_id}:${o.size_label || ''}`] = o.desired_qty
      setQtyOverrides(map)
    }
    loadPrefs()
    return () => { cancelled = true }
  }, [household?.id])

  const toggleSlotHidden = useCallback(async (kind, slotId, nextHidden) => {
    setHiddenPrefs(prev => {
      const next = new Set(prev)
      const key = `${kind}:${slotId}`
      if (nextHidden) next.add(key); else next.delete(key)
      return next
    })
    await supabase.schema(currentSchema).rpc('set_plan_slot_hidden', {
      p_slot_id: slotId, p_kind: kind, p_hidden: nextHidden,
    })
  }, [])

  const changeSlotQty = useCallback(async (slotId, sizeLabel, newQty) => {
    const key = `${slotId}:${sizeLabel || ''}`
    setQtyOverrides(prev => ({ ...prev, [key]: newQty }))
    await supabase.schema(currentSchema).rpc('upsert_registry_qty_override', {
      p_slot_id: slotId, p_size_label: sizeLabel || null, p_desired_qty: newQty,
    })
  }, [])

  const quickAddItem = useCallback(async (target, qty = 1) => {
    if (!household?.id) return
    const quantity = Math.max(1, Math.floor(qty) || 1)
    if (target.kind === 'clothing') {
      const babyId = (selectedBabyId !== 'all' && currentBaby?.id) ? currentBaby.id : (babies[0]?.id ?? null)
      await supabase.schema(currentSchema).from('clothing_items').insert({
        household_id: household.id,
        baby_id: babyId,
        slot_id: target.slotId,
        category: target.category,
        item_type: target.slotId,
        size_label: target.sizeLabel,
        inventory_status: 'owned',
        quantity,
        source: 'quick_add',
      })
    } else {
      await supabase.schema(currentSchema).from('items').insert({
        household_id: household.id,
        baby_id: null,
        top_category: target.topCategory,
        sub_category: target.subCategory,
        item_type: target.slotId,
        slot_id: target.slotId,
        inventory_status: 'owned',
        quantity,
        source: 'quick_add',
      })
    }
    track.itemSaved?.({ mode: 'quick_add', category: target.topCategory || 'clothing', size_label: target.sizeLabel || null, quantity })
    await reloadItems()
  }, [household?.id, selectedBabyId, currentBaby, babies, reloadItems])

  // Initialize age range from baby's DOB. Read ?size= query param to
  // support jump-in from the prediction card in Inventory.
  const ageAnchor = currentBaby ?? babies[0] ?? null
  const ageInfo = useMemo(() => inferAgeRange(ageAnchor), [ageAnchor])

  useEffect(() => {
    // Check for ?size= jump-in
    const params = new URLSearchParams(window.location.search)
    const sizeParam = params.get('size')
    if (sizeParam && AGE_RANGES.includes(sizeParam)) {
      setSelectedAgeRange(sizeParam)
    } else {
      setSelectedAgeRange(ageInfo.currentRange || '3-6M')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageAnchor?.id])

  // Baby-filtered clothing items
  const babyFilteredItems = useMemo(
    () => items.filter(it => matchesBabyFilter(it, selectedBabyId)),
    [items, selectedBabyId],
  )

  const coverageBabyCount = selectedBabyId === 'all' ? Math.max(1, babies.length) : 1

  // Whichever babies are relevant to the current view — used for gender
  // filtering. Only hides a slot when EVERY baby in scope is a boy.
  const babiesInScope = useMemo(() => {
    if (selectedBabyId === 'all') return babies
    return currentBaby ? [currentBaby] : babies
  }, [selectedBabyId, babies, currentBaby])

  // Applies a quantity override (if set) to a coverage row, recomputing
  // needed/status the same way computeCoverage itself does.
  function applyQtyOverride(row, overrideKey) {
    const override = qtyOverrides[overrideKey]
    if (override == null) return row
    const recommended = override
    const needed = Math.max(recommended - row.ownedCount, 0)
    let status = 'gap'
    if (row.ownedCount === 0) status = 'empty'
    else if (row.ownedCount >= recommended) status = 'complete'
    return { ...row, recommended, needed, status }
  }

  const coverage = useMemo(() => {
    if (!selectedAgeRange) return []
    const rows = computeCoverage(babyFilteredItems, selectedAgeRange, coverageBabyCount)
    return rows
      .filter(row => !hiddenPrefs.has(`clothing:${row.slot.id}`))
      .filter(row => !isSlotHiddenForBabies(row.slot, babiesInScope))
      .map(row => applyQtyOverride(row, `${row.slot.id}:${selectedAgeRange}`))
  }, [babyFilteredItems, selectedAgeRange, coverageBabyCount, hiddenPrefs, qtyOverrides, babiesInScope])

  // Clothing slots hidden from Plan for the current age range — surfaced as
  // a small "N hidden - show" affordance so they can be tracked again.
  const hiddenClothingSlots = useMemo(() => {
    if (!selectedAgeRange) return []
    return SLOTS
      .filter(s => hiddenPrefs.has(`clothing:${s.id}`))
      .filter(s => recommendedQty(s, selectedAgeRange, coverageBabyCount) > 0)
      .filter(s => !isSlotHiddenForBabies(s, babiesInScope))
  }, [selectedAgeRange, coverageBabyCount, hiddenPrefs, babiesInScope])

  const otherWishItems = useMemo(() => {
    if (!selectedAgeRange) return []
    return otherWishes(babyFilteredItems, selectedAgeRange)
  }, [babyFilteredItems, selectedAgeRange])

  const coverageSummary = useMemo(() => {
    let owned = 0
    let recommended = 0
    for (const row of coverage) {
      owned += Math.min(row.ownedCount, row.recommended)
      recommended += row.recommended
    }
    return { owned, recommended }
  }, [coverage])

  const coverageByCategory = useMemo(() => {
    const buckets = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const row of coverage) {
      const c = row.slot.category
      if (buckets[c]) buckets[c].push(row)
    }
    return CATEGORY_ORDER
      .filter(c => buckets[c].length > 0)
      .map(c => {
        let owned = 0
        let recommended = 0
        for (const row of buckets[c]) {
          owned += Math.min(row.ownedCount, row.recommended)
          recommended += row.recommended
        }
        return { category: c, rows: buckets[c], owned, recommended }
      })
  }, [coverage])

  // ── Non-clothing coverage ─────────────────────────────────────────────
  const isClothing = selectedCategory === 'clothing'

  const catCoverage = useMemo(() => {
    if (isClothing) return []
    const rows = computeCategorycoverage(
      babyFilteredItems.filter(it => it.top_category === selectedCategory),
      selectedCategory,
    )
    return rows
      .filter(row => !hiddenPrefs.has(`item:${row.slot.id}`))
      .map(row => applyQtyOverride(row, `${row.slot.id}:`))
  }, [isClothing, babyFilteredItems, selectedCategory, hiddenPrefs, qtyOverrides])

  // Non-clothing items hidden from Plan for the current category.
  const hiddenCatSlots = useMemo(() => {
    if (isClothing) return []
    return (ITEMS_BY_CATEGORY[selectedCategory] || [])
      .filter(s => hiddenPrefs.has(`item:${s.id}`))
  }, [isClothing, selectedCategory, hiddenPrefs])

  const catCoverageSummary = useMemo(() => {
    if (isClothing) return { owned: 0, recommended: 0 }
    return getCategorySummary(
      babyFilteredItems.filter(it => it.top_category === selectedCategory),
      selectedCategory,
    )
  }, [isClothing, babyFilteredItems, selectedCategory])

  // Group coverage rows by sub_category, preserving taxonomy order.
  const catCoverageBySubCat = useMemo(() => {
    if (isClothing) return []
    const subCats = SUB_CATEGORIES_BY_CATEGORY[selectedCategory] || []
    const buckets = Object.fromEntries(subCats.map(s => [s, []]))
    for (const row of catCoverage) {
      const s = row.slot.sub_category
      if (buckets[s]) buckets[s].push(row)
    }
    return subCats
      .filter(s => buckets[s].length > 0)
      .map(s => {
        let owned = 0
        let recommended = 0
        for (const r of buckets[s]) {
          owned += Math.min(r.ownedCount, r.recommended)
          recommended += r.recommended
        }
        return { subCat: s, rows: buckets[s], owned, recommended }
      })
  }, [isClothing, catCoverage, selectedCategory])

  // ── Gap row lookup maps ───────────────────────────────────────────────
  // Clothing: keyed by "slot_id:size_label" (size_label = age range)
  const clothingGapBySlotSize = useMemo(() => {
    const map = {}
    for (const item of babyFilteredItems) {
      if (item.inventory_status !== 'gap' || item.top_category !== 'clothing') continue
      if (item.slot_id && item.size_label) {
        map[`${item.slot_id}:${item.size_label}`] = item
      }
    }
    return map
  }, [babyFilteredItems])

  // Non-clothing: keyed by slot_id
  const itemGapBySlot = useMemo(() => {
    const map = {}
    for (const item of babyFilteredItems) {
      if (item.inventory_status !== 'gap' || item.top_category === 'clothing') continue
      if (item.slot_id) map[item.slot_id] = item
    }
    return map
  }, [babyFilteredItems])

  const toggleGapPriority = useCallback(async (gapRow) => {
    const table = gapRow.top_category === 'clothing' ? 'clothing_items' : 'items'
    await supabase
      .schema(currentSchema)
      .from(table)
      .update({ is_priority: !gapRow.is_priority })
      .eq('id', gapRow.id)
    reloadItems()
  }, [reloadItems])

  const showOutgrow = shouldShowOutgrowBanner(ageInfo)

  function handleOutgrowClick() {
    if (!ageInfo.nextRange) return
    track.gapAlertActioned({ from: ageInfo.currentRange, to: ageInfo.nextRange })
    setSelectedAgeRange(ageInfo.nextRange)
  }

  function handleCategorySelect(cat) {
    if (cat.id === 'registry') navigate('/registry/edit')
    else setSelectedCategory(cat.id)
  }

  function handleSlotTap(slotId) {
    track.recommendationClicked({ age_range: selectedAgeRange, slot: slotId })
    navigate(`/inventory/slot/${selectedAgeRange}/${slotId}`)
  }

  // Analytics: fire once per age-range visit on Plan screen
  useEffect(() => {
    if (!selectedAgeRange) return
    track.gapAlertViewed({
      age_range: selectedAgeRange,
      owned: coverageSummary.owned,
      recommended: coverageSummary.recommended,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgeRange])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft} />
        <div className={styles.titleCell}>
          <span className={styles.title}>Plan</span>
        </div>
        <div className={styles.headerRight}>
          <HeaderActions />
        </div>
      </header>

      <BabySwitcher from="plan" />

      {/* Category selector — horizontal scroll row (mobile) */}
      <CategoryChipRow
        categories={PLAN_CATEGORIES}
        activeId={selectedCategory}
        onSelect={handleCategorySelect}
      />

      {/* Desktop two-column layout */}
      <div className={styles.desktopLayout}>
        {/* Left: persistent category sidebar (desktop only) */}
        <CategorySidebar
          categories={PLAN_CATEGORIES}
          activeId={selectedCategory}
          onSelect={handleCategorySelect}
        />

        {/* Right: main content */}
      <main className={styles.body}>
        {/* Arrival checklist banner — pre-birth, inside body for correct width */}
        {ageInfo?.expecting && ageInfo?.daysUntilDue != null && ageInfo.daysUntilDue > 0 && (
          <button
            type="button"
            className={styles.arrivalBanner}
            onClick={() => navigate('/arrival-checklist')}
          >
            <span className={styles.arrivalBannerIcon}>🍼</span>
            <div className={styles.arrivalBannerText}>
              <span className={styles.arrivalBannerTitle}>Arrival checklist</span>
              <span className={styles.arrivalBannerSub}>
                {Math.ceil(ageInfo.daysUntilDue)} days to go — see what you need before day one
              </span>
            </div>
            <span className={styles.arrivalBannerArrow}>→</span>
          </button>
        )}

        {!itemsLoading && selectedAgeRange && selectedCategory === 'clothing' && (
          <>
            {/* Age-range chip navbar */}
            <AgeNav
              ageRange={selectedAgeRange}
              onAgeChange={setSelectedAgeRange}
              ageInfo={ageInfo}
            />

            {/* Outgrow banner */}
            {showOutgrow && (
              <button
                type="button"
                className={styles.banner}
                onClick={handleOutgrowClick}
              >
                <span className={styles.bannerIcon} aria-hidden="true">⏰</span>
                <span className={styles.bannerBody}>
                  <strong>
                    Rolling into {ageInfo.nextRange} in ~{Math.max(ageInfo.daysToNextRange, 1)}{' '}
                    {pluralize(Math.max(ageInfo.daysToNextRange, 1), 'day')}.
                  </strong>{' '}
                  Start planning ahead →
                </span>
              </button>
            )}

            {/* Coverage summary card */}
            <CoverageSummaryCard
              pct={Math.round((coverageSummary.owned / Math.max(1, coverageSummary.recommended)) * 100)}
              title="Clothing wardrobe"
              subtitle={`${coverageSummary.owned} of ${coverageSummary.recommended} items · ${selectedAgeRange}`}
            />
            <PlanGuideLink category="clothing" navigate={navigate} />

            {/* Category groups — flat, non-collapsible */}
            {coverageByCategory.map(group => (
              <section key={group.category}>
                <FlatGroupHeader
                  title={CATEGORY_LABELS[group.category] || group.category}
                  owned={group.owned}
                  recommended={group.recommended}
                  onAdd={() => navigate('/add-item')}
                />
                <div className={styles.slotCardGrid}>
                  {group.rows.map(row => (
                    <SlotCard
                      key={row.slot.id}
                      row={row}
                      onClick={() => handleSlotTap(row.slot.id)}
                      gapRow={clothingGapBySlotSize[`${row.slot.id}:${selectedAgeRange}`]}
                      onStarToggle={toggleGapPriority}
                      onManage={() => setManageTarget({
                        kind: 'clothing',
                        slotId: row.slot.id,
                        sizeLabel: selectedAgeRange,
                        category: row.slot.category,
                        label: row.slot.label,
                        hint: row.slot.hint,
                        recommended: row.recommended,
                      })}
                    />
                  ))}
                </div>
              </section>
            ))}

            {hiddenClothingSlots.length > 0 && (
              <HiddenSlotsPanel
                open={showHiddenClothing}
                onToggleOpen={() => setShowHiddenClothing(o => !o)}
                slots={hiddenClothingSlots}
                onTrackAgain={(slotId) => toggleSlotHidden('clothing', slotId, false)}
              />
            )}

          </>
        )}

        {!itemsLoading && selectedCategory === 'registry' && (
          <RegistryView
            items={babyFilteredItems.filter(it => it.inventory_status === 'needed')}
            onItemTap={(id) => navigate(`/item/${id}`)}
            onAddWish={() => navigate('/add-item?mode=needed')}
            onShare={() => { setShowShareModal(true); track.ctaClicked('plan_registry_share') }}
          />
        )}

        {!itemsLoading && !isClothing && selectedCategory !== 'registry' && (
          <>
            {/* Coverage summary card */}
            <CoverageSummaryCard
              pct={Math.round((catCoverageSummary.owned / Math.max(1, catCoverageSummary.recommended)) * 100)}
              title={`${PLAN_CATEGORIES.find(c => c.id === selectedCategory)?.label || ''} checklist`}
              subtitle={`${catCoverageSummary.owned} of ${catCoverageSummary.recommended} items`}
            />
            <PlanGuideLink category={selectedCategory} navigate={navigate} />

            {catCoverageBySubCat.length === 0 && (
              <div className={styles.comingSoonCard}>
                <div className={styles.comingSoonEmoji}>📋</div>
                <div className={styles.comingSoonTitle}>Nothing tracked yet</div>
                <p className={styles.comingSoonBody}>
                  Add items in this category to start tracking your coverage.
                </p>
              </div>
            )}

            {/* Sub-category groups — flat, non-collapsible */}
            {catCoverageBySubCat.map(group => (
              <section key={group.subCat}>
                <FlatGroupHeader
                  title={SUB_CATEGORY_LABELS[group.subCat] || group.subCat}
                  owned={group.owned}
                  recommended={group.recommended}
                  onAdd={() => navigate(`/add-item?category=${selectedCategory}`)}
                />
                <div className={styles.slotCardGrid}>
                  {group.rows.map(row => (
                    <SlotCard
                      key={row.slot.id}
                      row={row}
                      onClick={() => navigate(`/add-item?category=${selectedCategory}`)}
                      gapRow={itemGapBySlot[row.slot.id]}
                      onStarToggle={toggleGapPriority}
                      onManage={() => setManageTarget({
                        kind: 'item',
                        slotId: row.slot.id,
                        sizeLabel: null,
                        topCategory: selectedCategory,
                        subCategory: row.slot.sub_category,
                        label: row.slot.label,
                        hint: row.slot.hint,
                        recommended: row.recommended,
                      })}
                    />
                  ))}
                </div>
              </section>
            ))}

            {hiddenCatSlots.length > 0 && (
              <HiddenSlotsPanel
                open={showHiddenCat}
                onToggleOpen={() => setShowHiddenCat(o => !o)}
                slots={hiddenCatSlots}
                onTrackAgain={(slotId) => toggleSlotHidden('item', slotId, false)}
              />
            )}

            <button
              type="button"
              className={styles.addMoreBtn}
              onClick={() => navigate(`/add-item?category=${selectedCategory}`)}
            >
              + Add item
            </button>
          </>
        )}

        {itemsLoading && (
          <div className={styles.loading}>Loading…</div>
        )}
      </main>
      </div>

      <BottomNav />
      {showShareModal && <ShareRegistryModal onClose={() => setShowShareModal(false)} />}
      {manageTarget && (
        <SlotManageSheet
          target={manageTarget}
          currentQty={qtyOverrides[`${manageTarget.slotId}:${manageTarget.sizeLabel || ''}`] ?? manageTarget.recommended}
          onClose={() => setManageTarget(null)}
          onQtyChange={(qty) => changeSlotQty(manageTarget.slotId, manageTarget.sizeLabel, qty)}
          onStopTracking={() => { toggleSlotHidden(manageTarget.kind, manageTarget.slotId, true); setManageTarget(null) }}
          onQuickAdd={(qty) => quickAddItem(manageTarget, qty)}
        />
      )}

    </div>
  )
}

// Category nav icons + CoverageSummaryCard now live in src/components/
// (CategoryNav.jsx, CoverageSummaryCard.jsx) — shared with Inventory as of
// 2026-07-07 so the two screens can't silently drift apart.

// ── Registry view — all needed items across every category ────────────────────
const WISHLIST_CATEGORY_ORDER = [
  'clothing', 'sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath',
]
const WISHLIST_CATEGORY_LABEL = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
  travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
}

function RegistryView({ items, onItemTap, onAddWish, onShare }) {
  // Group by top_category
  const grouped = {}
  for (const item of items) {
    const cat = item.top_category || 'clothing'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const usedCats = WISHLIST_CATEGORY_ORDER.filter(c => grouped[c]?.length > 0)

  return (
    <div>
      {/* Share banner — always visible at top of registry view */}
      <button type="button" className={styles.wishlistShareBanner} onClick={onShare}>
        <span className={styles.wishlistShareIcon}>🔗</span>
        <div className={styles.wishlistShareText}>
          <span className={styles.wishlistShareTitle}>Share with family &amp; friends</span>
          <span className={styles.wishlistShareSub}>They&rsquo;ll see exactly what you still need</span>
        </div>
        <span className={styles.wishlistShareArrow}>→</span>
      </button>

      {items.length === 0 && (
        <div className={styles.comingSoonCard}>
          <div className={styles.comingSoonEmoji}>📋</div>
          <div className={styles.comingSoonTitle}>Your registry is empty</div>
          <p className={styles.comingSoonBody}>Add items you still need to track them here.</p>
        </div>
      )}
      {usedCats.map(cat => (
        <section key={cat}>
          <FlatGroupHeader title={WISHLIST_CATEGORY_LABEL[cat]} owned={0} recommended={grouped[cat].length} />
          <div className={styles.otherWishList}>
            {grouped[cat].map(item => (
              <button
                type="button"
                className={styles.wish}
                key={item.id}
                onClick={() => onItemTap(item.id)}
                aria-label={`Open ${item.name || 'item'}`}
              >
                <div className={styles.wishName}>{item.name || item.brand || 'Item'}</div>
                {item.priority && (
                  <span className={`${styles.wishPriority} ${item.priority === 'nice_to_have' ? styles.wishPriorityAmber : ''}`}>
                    {PRIORITY_LABEL[item.priority]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      ))}
      <button type="button" className={styles.wishAddBtn} onClick={onAddWish}>
        + Add to registry
      </button>
    </div>
  )
}

// ── Age-range chip navbar ─────────────────────────────────────────────────────
function AgeNav({ ageRange, onAgeChange, ageInfo }) {
  return (
    <div className={styles.ageNav}>
      {AGE_RANGES.map(range => {
        const isSelected = range === ageRange
        const isCurrent = ageInfo.currentRange && range === ageInfo.currentRange
        const isPast =
          ageInfo.currentRange &&
          AGE_RANGES.indexOf(range) < AGE_RANGES.indexOf(ageInfo.currentRange)
        return (
          <button
            key={range}
            type="button"
            className={
              `${styles.ageChip} ` +
              (isSelected ? styles.ageChipSelected : '') + ' ' +
              (isCurrent ? styles.ageChipCurrent : '') + ' ' +
              (isPast ? styles.ageChipPast : '')
            }
            onClick={() => onAgeChange(range)}
            aria-label={isCurrent ? `${range} (current size band)` : range}
          >
            {range}
            {isCurrent && <Sprout />}
          </button>
        )
      })}
    </div>
  )
}

// ── Sprout marker ─────────────────────────────────────────────────────────────
function Sprout() {
  return (
    <span className={styles.sprout} aria-hidden="true">
      <svg viewBox="0 0 20 14" width="20" height="14">
        <g className={styles.sproutStem}>
          <path d="M10 0 L10 12" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinecap="round" />
          <path d="M10 7 Q3 5 2 10 Q7 11 10 9 Z" fill="currentColor" />
          <path d="M10 5 Q16 3.5 17 7 Q13 8 10 6.5 Z" fill="currentColor" />
        </g>
      </svg>
    </span>
  )
}

// ── Plan guide link — soft contextual guide surfacing ─────────────────────────
// Shown below each category's coverage summary card. Only renders when a
// relevant guide exists for the category. Intentionally subtle — teal text
// link, no card chrome, no visual weight that competes with the coverage data.
function PlanGuideLink({ category, navigate }) {
  const slug = CATEGORY_GUIDE_SLUGS[category]
  if (!slug) return null
  return (
    <button
      type="button"
      className={styles.planGuideLink}
      onClick={() => { track.guidePlanLinkClicked?.({ slug, category }); navigate(`/guides/${slug}`) }}
    >
      📖 Read our guide for this category →
    </button>
  )
}

// ── Flat group header ─────────────────────────────────────────────────────────
function FlatGroupHeader({ title, owned, recommended, onAdd }) {
  return (
    <div className={styles.flatGroupHeader}>
      <span className={styles.flatGroupTitle}>{title}</span>
      <div className={styles.flatGroupRight}>
        <span className={styles.flatGroupCount}>{owned} of {recommended}</span>
        {onAdd && (
          <button
            type="button"
            className={styles.groupAddBtn}
            onClick={onAdd}
            aria-label={`Add item to ${title}`}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" fill="none" aria-hidden="true">
              <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Slot card ─────────────────────────────────────────────────────────────────
function SlotCard({ row, onClick, gapRow, onStarToggle, onManage }) {
  const { slot, ownedCount, recommended, status } = row

  const countClass =
    status === 'complete' ? styles.slotCountComplete :
    status === 'empty'    ? styles.slotCountEmpty    :
                            styles.slotCountGap

  const cardBgClass =
    status === 'complete' ? styles.slotCardComplete :
    status === 'empty'    ? styles.slotCardEmpty    :
                            styles.slotCardPartial

  return (
    <div className={styles.slotCardWrapper}>
      <button type="button" className={`${styles.slotCard} ${cardBgClass}`} onClick={onClick}>
        <span className={styles.slotCardName}>{slot.label}</span>
        <div className={styles.slotCardMeta}>
          <span className={`${styles.slotCardCount} ${countClass}`}>
            {slot.consumable ? 'Keep stocked' : `${ownedCount} of ${recommended}`}{status === 'complete' && !slot.consumable && ' ✓'}
          </span>
          {slot.hint && (
            <span className={styles.slotCardHint}>{' · '}{slot.hint}</span>
          )}
        </div>
      </button>
      {gapRow && onStarToggle && (
        <button
          type="button"
          className={`${styles.starBtn} ${gapRow.is_priority ? styles.starBtnActive : ''}`}
          onClick={e => { e.stopPropagation(); onStarToggle(gapRow) }}
          aria-label={gapRow.is_priority ? 'Remove priority' : 'Mark as priority'}
        >
          <StarIcon filled={gapRow.is_priority} />
        </button>
      )}
      {onManage && (
        <button
          type="button"
          className={styles.manageBtn}
          onClick={e => { e.stopPropagation(); onManage() }}
          aria-label={`Edit ${slot.label} in Plan`}
        >
          <EditIcon />
        </button>
      )}
    </div>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path
        d="M11.1 2.1a1.2 1.2 0 011.7 0l1.1 1.1a1.2 1.2 0 010 1.7L5.6 13.2l-3.4.7.7-3.4L11.1 2.1z"
        stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round"
      />
      <path d="M9.7 3.5l2.8 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Hidden-from-Plan panel ─────────────────────────────────────────────────────
// Small collapsible list surfacing slots the parent stopped tracking, so
// there's always a way back — mirrors the Registry's own hide/show pattern.
function HiddenSlotsPanel({ open, onToggleOpen, slots, onTrackAgain }) {
  return (
    <div className={styles.hiddenPanel}>
      <button
        type="button"
        className={styles.hiddenPanelToggle}
        onClick={onToggleOpen}
        aria-expanded={open}
      >
        <span>{slots.length} hidden from Plan</span>
        <svg
          className={`${styles.groupChev} ${!open ? styles.groupChevCollapsed : ''}`}
          viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.hiddenPanelList}>
          {slots.map(slot => (
            <div key={slot.id} className={styles.hiddenPanelRow}>
              <span>{slot.label}</span>
              <button type="button" className={styles.hiddenPanelTrackBtn} onClick={() => onTrackAgain(slot.id)}>
                Track again
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Manage slot sheet ──────────────────────────────────────────────────────────
// Reachable via the edit button on any slot card. Lets a parent quick-add a
// batch straight to Inventory (no scan, no form — e.g. "I have 5 sleep gowns"
// all in one go), change the recommended count, or stop tracking the slot
// in Plan altogether.
function SlotManageSheet({ target, currentQty, onClose, onQtyChange, onStopTracking, onQuickAdd }) {
  const [targetQty, setTargetQty] = useState(currentQty)
  const [addQty, setAddQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(null)

  function adjustTarget(delta) {
    const next = Math.max(1, targetQty + delta)
    setTargetQty(next)
    onQtyChange(next)
  }

  function adjustAddQty(delta) {
    setAddQty(q => Math.max(1, q + delta))
  }

  async function handleQuickAdd() {
    setAdding(true)
    const qty = addQty
    await onQuickAdd(qty)
    setAdding(false)
    setJustAdded(qty)
    setTimeout(() => setJustAdded(null), 1800)
  }

  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.sheetOverlay} onClick={onBackdropClick}>
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.sheetHead}>
          <div>
            <div className={styles.sheetTitle}>{target.label}</div>
            {target.sizeLabel && <div className={styles.sheetSubtitle}>{target.sizeLabel}</div>}
          </div>
          <button type="button" className={styles.sheetX} onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className={styles.sheetField}>
          <label className={styles.sheetLabel}>How many do you already have?</label>
          <div className={styles.qtyControl}>
            <button type="button" className={styles.qtyBtn} onClick={() => adjustAddQty(-1)} disabled={addQty <= 1} aria-label="Decrease">−</button>
            <span className={styles.qtyValue}>{addQty}</span>
            <button type="button" className={styles.qtyBtn} onClick={() => adjustAddQty(1)} aria-label="Increase">+</button>
          </div>
        </div>

        <button type="button" className={styles.sheetQuickAddBtn} onClick={handleQuickAdd} disabled={adding}>
          {justAdded ? `✓ Added ${justAdded} to Inventory` : adding ? 'Adding…' : `+ Quick add ${addQty} to Inventory`}
        </button>
        <p className={styles.sheetHint}>Adds {addQty > 1 ? `${addQty} owned items` : 'one owned item'} straight to Inventory in one go, tagged &ldquo;Quick added&rdquo; — no scanning or details needed. Edit any time from Inventory.</p>

        <div className={styles.sheetField}>
          <label className={styles.sheetLabel}>Recommended count</label>
          <div className={styles.qtyControl}>
            <button type="button" className={styles.qtyBtn} onClick={() => adjustTarget(-1)} disabled={targetQty <= 1} aria-label="Decrease">−</button>
            <span className={styles.qtyValue}>{targetQty}</span>
            <button type="button" className={styles.qtyBtn} onClick={() => adjustTarget(1)} aria-label="Increase">+</button>
          </div>
          <p className={styles.sheetHint}>This updates the target everywhere — Plan and your Registry share the same number.</p>
        </div>

        <button type="button" className={styles.sheetStopBtn} onClick={onStopTracking}>
          Stop tracking in Plan
        </button>
      </div>
    </div>
  )
}

function StarIcon({ filled }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M8 1.5l1.75 3.55 3.92.57-2.84 2.77.67 3.91L8 10.35l-3.5 1.95.67-3.91L2.33 5.62l3.92-.57L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

// ── Other wishes section ──────────────────────────────────────────────────────
function OtherWishesSection({ items, onItemTap, onAddWish }) {
  const [open, setOpen] = useState(items.length > 0)

  return (
    <>
      <button
        type="button"
        className={styles.groupHeader}
        style={{ marginTop: 8, borderRadius: 12, border: '0.5px solid var(--gray-200)' }}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className={styles.groupTitle}>Other wishes</span>
        <span className={styles.groupHeaderRight}>
          <span className={styles.groupCount}>
            {items.length > 0 ? items.length : ''}
          </span>
          <svg
            className={`${styles.groupChev} ${!open ? styles.groupChevCollapsed : ''}`}
            viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className={styles.otherWishList}>
          {items.length === 0 && (
            <div className={styles.otherEmpty}>
              Anything specific on your list? Add it here.
            </div>
          )}
          {items.map(item => (
            <button
              type="button"
              className={styles.wish}
              key={item.id}
              onClick={() => onItemTap(item.id)}
              aria-label={`Open ${item.name || 'item'}`}
            >
              <div className={styles.wishName}>{item.name || 'Item'}</div>
              {item.priority && (
                <span
                  className={
                    `${styles.wishPriority} ` +
                    (item.priority === 'nice_to_have' ? styles.wishPriorityAmber : '')
                  }
                >
                  {PRIORITY_LABEL[item.priority]}
                </span>
              )}
            </button>
          ))}
          <button type="button" className={styles.wishAddBtn} onClick={onAddWish}>
            + Add wish
          </button>
        </div>
      )}
    </>
  )
}
