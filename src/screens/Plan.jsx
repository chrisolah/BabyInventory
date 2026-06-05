import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  AGE_RANGES,
  CATEGORY_LABELS,
  computeCoverage,
  otherWishes,
  inferAgeRange,
  shouldShowOutgrowBanner,
  pluralize,
} from '../lib/wardrobe'
import {
  SUB_CATEGORY_LABELS,
  SUB_CATEGORIES_BY_CATEGORY,
  computeCategorycoverage,
  getCategorySummary,
} from '../lib/categories'
import BabySwitcher from '../components/BabySwitcher'
import Eyebrow from '../components/Eyebrow'
import DonutChart from '../components/DonutChart'
import BottomNav from '../components/BottomNav'
import HeaderActions from '../components/HeaderActions'
import ShareWishlistModal from '../components/ShareWishlistModal'
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
  { id: 'wishlist',  label: 'Wishlist',  live: true, icon: WishlistNavIcon, color: 'teal'   },
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

  const coverage = useMemo(() => {
    if (!selectedAgeRange) return []
    return computeCoverage(babyFilteredItems, selectedAgeRange, coverageBabyCount)
  }, [babyFilteredItems, selectedAgeRange, coverageBabyCount])

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
    return computeCategorycoverage(
      babyFilteredItems.filter(it => it.top_category === selectedCategory),
      selectedCategory,
    )
  }, [isClothing, babyFilteredItems, selectedCategory])

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
      <div className={styles.catRow}>
        {PLAN_CATEGORIES.map(cat => {
          const active = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              className={`${styles.catChip} ${styles[`catChip_${cat.color}`]} ${active ? styles.catChipActive : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
              aria-label={cat.label}
              aria-pressed={active}
            >
              <div className={`${styles.catChipIcon} ${styles[`catChipIcon_${cat.color}`]}`}>
                <cat.icon />
              </div>
              <span className={styles.catChipLabel}>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Desktop two-column layout */}
      <div className={styles.desktopLayout}>
        {/* Left: persistent category sidebar (desktop only) */}
        <aside className={styles.catSidebar} aria-label="Category">
          <div className={styles.catSidebarLabel}>Category</div>
          {PLAN_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.catSidebarItem} ${selectedCategory === cat.id ? styles.catSidebarItemActive : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
              aria-label={cat.label}
            >
              <span className={styles.catSidebarIcon}><cat.icon /></span>
              <span className={styles.catSidebarText}>{cat.label}</span>
            </button>
          ))}
        </aside>

        {/* Right: main content */}
      <main className={styles.body}>
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
                />
                <div className={styles.slotCardGrid}>
                  {group.rows.map(row => (
                    <SlotCard
                      key={row.slot.id}
                      row={row}
                      onClick={() => handleSlotTap(row.slot.id)}
                      gapRow={clothingGapBySlotSize[`${row.slot.id}:${selectedAgeRange}`]}
                      onStarToggle={toggleGapPriority}
                    />
                  ))}
                </div>
              </section>
            ))}

          </>
        )}

        {!itemsLoading && selectedCategory === 'wishlist' && (
          <WishlistView
            items={babyFilteredItems.filter(it => it.inventory_status === 'needed')}
            onItemTap={(id) => navigate(`/item/${id}`)}
            onAddWish={() => navigate('/add-item?mode=needed')}
            onShare={() => { setShowShareModal(true); track.ctaClicked('plan_wishlist_share') }}
          />
        )}

        {!itemsLoading && !isClothing && selectedCategory !== 'wishlist' && (
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
                />
                <div className={styles.slotCardGrid}>
                  {group.rows.map(row => (
                    <SlotCard
                      key={row.slot.id}
                      row={row}
                      onClick={() => navigate(`/add-item?category=${selectedCategory}`)}
                      gapRow={itemGapBySlot[row.slot.id]}
                      onStarToggle={toggleGapPriority}
                    />
                  ))}
                </div>
              </section>
            ))}

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
      {showShareModal && <ShareWishlistModal onClose={() => setShowShareModal(false)} />}

    </div>
  )
}

// ── Category nav icons ────────────────────────────────────────────────────────
function ClothingNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M7 2L4 5l2.5 1.5V17h7V6.5L16 5l-3-3-2 2-2-2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function SleepNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 10.5A7.5 7.5 0 0013.5 3a7.5 7.5 0 100 15A7.5 7.5 0 003 10.5z"
        stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
function FeedingNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M8 2v3a4 4 0 004 4v9a1 1 0 01-2 0v-5H8v5a1 1 0 01-2 0V2h2z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function DiaperNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}
function TravelNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M2 14h16M5 14V9l5-4 5 4v5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="6" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="14" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  )
}
function PlayNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 7.5l5 2.5-5 2.5V7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function HealthNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M10 17S3 12.5 3 7.5A4 4 0 0110 5a4 4 0 017 2.5C17 12.5 10 17 10 17z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}
function BathNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 11h14v1.5a5 5 0 01-10 0" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 11V5.5A1.5 1.5 0 017.5 5a1.5 1.5 0 011.5 1.5V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function WishlistNavIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M5 3h10a1 1 0 011 1v12l-6-3-6 3V4a1 1 0 011-1z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

// ── Wishlist view — all needed items across every category ────────────────────
const WISHLIST_CATEGORY_ORDER = [
  'clothing', 'sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath',
]
const WISHLIST_CATEGORY_LABEL = {
  clothing: 'Clothing', sleep: 'Sleep', feeding: 'Feeding', diapering: 'Diapering',
  travel: 'Travel', play: 'Play', health: 'Health', bath: 'Bath',
}

function WishlistView({ items, onItemTap, onAddWish, onShare }) {
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
      {/* Share banner — always visible at top of wishlist view */}
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
          <div className={styles.comingSoonTitle}>Your wishlist is empty</div>
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
        + Add to wishlist
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

// ── Coverage summary card ─────────────────────────────────────────────────────
function CoverageSummaryCard({ pct, title, subtitle }) {
  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryLeft}>
        <div className={styles.summaryPct}>{pct}%</div>
        <div className={styles.summaryTitle}>{title}</div>
        <div className={styles.summarySub}>{subtitle}</div>
      </div>
      <div className={styles.summaryRight}>
        <DonutChart
          size={80}
          strokeWidth={8}
          pct={pct}
          color="rgba(255,255,255,0.9)"
          trackColor="rgba(255,255,255,0.18)"
          textColor="#fff"
        />
      </div>
    </div>
  )
}

// ── Flat group header ─────────────────────────────────────────────────────────
function FlatGroupHeader({ title, owned, recommended }) {
  return (
    <div className={styles.flatGroupHeader}>
      <span className={styles.flatGroupTitle}>{title}</span>
      <span className={styles.flatGroupCount}>{owned} of {recommended}</span>
    </div>
  )
}

// ── Slot card ─────────────────────────────────────────────────────────────────
function SlotCard({ row, onClick, gapRow, onStarToggle }) {
  const { slot, ownedCount, recommended, status } = row

  const countClass =
    status === 'complete' ? styles.slotCountComplete :
    status === 'empty'    ? styles.slotCountEmpty    :
                            styles.slotCountGap

  return (
    <div className={styles.slotCardWrapper}>
      <button type="button" className={styles.slotCard} onClick={onClick}>
        <span className={styles.slotCardName}>{slot.label}</span>
        <div className={styles.slotCardMeta}>
          <span className={`${styles.slotCardCount} ${countClass}`}>
            {ownedCount} of {recommended}
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
