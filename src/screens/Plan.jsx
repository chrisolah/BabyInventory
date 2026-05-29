import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
import BabySwitcher from '../components/BabySwitcher'
import Eyebrow from '../components/Eyebrow'
import BottomNav from '../components/BottomNav'
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
const PLAN_CATEGORIES = [
  { id: 'clothing',  label: 'Clothing',  live: true,  icon: ClothingNavIcon },
  { id: 'sleep',     label: 'Sleep',     live: false, icon: SleepNavIcon },
  { id: 'feeding',   label: 'Feeding',   live: false, icon: FeedingNavIcon },
  { id: 'diapering', label: 'Diapering', live: false, icon: DiaperNavIcon },
  { id: 'travel',    label: 'Travel',    live: false, icon: TravelNavIcon },
  { id: 'play',      label: 'Play',      live: false, icon: PlayNavIcon },
  { id: 'health',    label: 'Health',    live: false, icon: HealthNavIcon },
  { id: 'bath',      label: 'Bath',      live: false, icon: BathNavIcon },
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
    babies,
    selectedBabyId,
    currentBaby,
    items,
    itemsLoading,
  } = useHousehold()

  const [selectedCategory, setSelectedCategory] = useState('clothing')
  const [selectedAgeRange, setSelectedAgeRange] = useState(null)
  const [wishCollapsed, setWishCollapsed] = useState(() => new Set(CATEGORY_ORDER))

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

  function toggleWishGroup(cat) {
    setWishCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

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
        <div className={styles.titleCell}>
          <span className={styles.title}>Plan</span>
        </div>
      </header>

      <BabySwitcher from="plan" />

      {/* Category selector — horizontal scroll row (mobile) */}
      <div className={styles.catRow}>
        {PLAN_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.catChip} ${selectedCategory === cat.id ? styles.catChipActive : ''} ${!cat.live ? styles.catChipSoon : ''}`}
            onClick={() => {
              if (cat.live) setSelectedCategory(cat.id)
            }}
            aria-label={cat.live ? cat.label : `${cat.label} — coming soon`}
          >
            {cat.label}
            {!cat.live && <span className={styles.soonDot} aria-hidden="true" />}
          </button>
        ))}
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
              className={`${styles.catSidebarItem} ${selectedCategory === cat.id ? styles.catSidebarItemActive : ''} ${!cat.live ? styles.catSidebarItemSoon : ''}`}
              onClick={() => {
                if (cat.live) setSelectedCategory(cat.id)
              }}
              aria-label={cat.live ? cat.label : `${cat.label} — coming soon`}
            >
              <span className={styles.catSidebarIcon}><cat.icon /></span>
              <span className={styles.catSidebarText}>{cat.label}</span>
              {!cat.live && <span className={styles.catSidebarSoon}>soon</span>}
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

            {/* Coverage summary */}
            <div className={styles.sectionHead}>
              <Eyebrow color="teal">Clothing wardrobe</Eyebrow>
              <span className={styles.sectionMeta}>
                {coverageSummary.owned} of {coverageSummary.recommended}
              </span>
            </div>

            {/* Category groups */}
            {coverageByCategory.map(group => {
              const collapsed = wishCollapsed.has(group.category)
              const id = `plan-${group.category}`
              return (
                <section className={styles.group} key={group.category}>
                  <GroupHeader
                    title={CATEGORY_LABELS[group.category] || group.category}
                    meta={`${group.owned} of ${group.recommended}`}
                    collapsed={collapsed}
                    onToggle={() => toggleWishGroup(group.category)}
                    contentId={id}
                  />
                  {!collapsed && (
                    <div className={styles.slotCardGrid} id={id}>
                      {group.rows.map(row => (
                        <SlotCard
                          key={row.slot.id}
                          row={row}
                          onClick={() => handleSlotTap(row.slot.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}

            {/* Other wishes */}
            <OtherWishesSection
              items={otherWishItems}
              onItemTap={(id) => navigate(`/item/${id}`)}
              onAddWish={() => navigate('/add-item?autoScan=1&mode=needed')}
            />
          </>
        )}

        {!itemsLoading && selectedCategory !== 'clothing' && (
          <div className={styles.comingSoonCard}>
            <div className={styles.comingSoonEmoji}>🛠</div>
            <div className={styles.comingSoonTitle}>Coming soon</div>
            <p className={styles.comingSoonBody}>
              We're building out the {PLAN_CATEGORIES.find(c => c.id === selectedCategory)?.label.toLowerCase()} checklist.
              {' '}Clothing is fully live — tap it to plan your wardrobe.
            </p>
          </div>
        )}

        {itemsLoading && (
          <div className={styles.loading}>Loading…</div>
        )}
      </main>

      </main>
      </div>

      <BottomNav />
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

// ── Collapsible group header ──────────────────────────────────────────────────
function GroupHeader({ title, meta, collapsed, onToggle, contentId }) {
  return (
    <button
      type="button"
      className={styles.groupHeader}
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls={contentId}
    >
      <span className={styles.groupTitle}>{title}</span>
      <span className={styles.groupHeaderRight}>
        <span className={styles.groupCount}>{meta}</span>
        <svg
          className={`${styles.groupChev} ${collapsed ? styles.groupChevCollapsed : ''}`}
          viewBox="0 0 10 6" width="10" height="6" aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  )
}

// ── Slot card ─────────────────────────────────────────────────────────────────
function SlotCard({ row, onClick }) {
  const { slot, ownedCount, recommended, needed, status } = row
  const percent = recommended > 0
    ? Math.min(100, Math.round((ownedCount / recommended) * 100))
    : 0

  const countClass =
    status === 'complete' ? styles.slotCountComplete :
    status === 'empty'    ? styles.slotCountEmpty    :
                            styles.slotCountGap

  const barFillClass =
    status === 'complete' ? styles.slotCardBarComplete :
    status === 'empty'    ? styles.slotCardBarEmpty    :
                            ''

  const hintText =
    status === 'complete' ? 'Complete' :
    status === 'empty'    ? `need ${recommended}` :
                            `need ${needed} more`

  return (
    <button type="button" className={styles.slotCard} onClick={onClick}>
      <span className={styles.slotCardName}>{slot.label}</span>
      <div className={styles.slotCardBarTrack}>
        <div
          className={`${styles.slotCardBarFill} ${barFillClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className={styles.slotCardFooter}>
        <span className={`${styles.slotCardCount} ${countClass}`}>
          {ownedCount} of {recommended}
        </span>
        <span className={styles.slotCardHint}>{hintText}</span>
      </div>
    </button>
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
