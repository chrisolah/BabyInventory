import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
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
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import styles from './Inventory.module.css'

// Inventory has two tabs:
//   - Owned    → category-grouped list of items the user has
//   - Wish list → recommended-wardrobe view: an age-range navbar across the
//                 top, then one card per top-level category (Sleepwear,
//                 Footwear…) containing rows for each canonical slot
//                 (Pajamas, Sleep sacks…) with a progress bar showing owned
//                 count vs recommended.
//
// Category grouping on the Owned tab is unchanged. The Wish list mirrors it
// — same .group / .groupHeader treatment — so users see the same visual
// hierarchy on both tabs. See src/lib/wardrobe.js for the slot taxonomy and
// coverage math.

const STATUS_LABEL = {
  owned: 'Owned',
  needed: 'Needed',
  outgrown: 'Outgrown',
  donated: 'Donated',
  exchanged: 'Exchanged',
}

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
}

// Display order for the Owned tab (categories grouping).
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

export default function Inventory() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Household + babies + selection come from context now so the chip
  // switcher can drive what Inventory renders without a re-fetch.
  const {
    household,
    babies,
    selectedBabyId,
    currentBaby,
    loading: householdLoading,
    error: householdError,
  } = useHousehold()

  const [tab, setTab] = useState('owned') // 'owned' | 'wishlist'
  const [itemsLoading, setItemsLoading] = useState(true)
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)

  // The currently selected age range on the Wish list tab. Initialized from
  // the baby's DOB once we've loaded it; falls back to '3-6M' as a reasonable
  // middle-of-the-road default if we have no baby data.
  const [selectedAgeRange, setSelectedAgeRange] = useState(null)

  // Per-tab collapsed category state. Default is all-expanded; category keys
  // are added to the set when the user clicks a header to collapse it. Kept
  // per-tab so collapsing Sleepwear on Owned doesn't hide it on Wish list too
  // (different intent, same categories).
  const [ownedCollapsed, setOwnedCollapsed] = useState(() => new Set())
  const [wishCollapsed, setWishCollapsed] = useState(() => new Set())

  function toggleOwnedGroup(cat) {
    setOwnedCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }
  function toggleWishGroup(cat) {
    setWishCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  // ── Load items once household is known ──────────────────────────────────
  // Household + babies come from context; items are Inventory-specific so
  // they still live here. We fetch everything for the household and filter
  // by baby client-side — switching chips doesn't need a round trip.
  useEffect(() => {
    if (!user || !household) return
    let cancelled = false

    async function loadItems() {
      setItemsLoading(true)
      setError(null)

      const { data: itemsData, error: itemsErr } = await supabase
        .schema(currentSchema)
        .from('clothing_items')
        .select('*')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (itemsErr) {
        setError(itemsErr.message)
        setItemsLoading(false)
        return
      }

      setItems(itemsData || [])
      setItemsLoading(false)
    }

    loadItems()
    return () => { cancelled = true }
  }, [user, household])

  // Surface household-load errors too — they're rare but should not be
  // silently swallowed (no household = pre-onboarding; caller gets redirected
  // by Home's gate anyway, so this only triggers on a genuine query failure).
  useEffect(() => {
    if (householdError) setError(householdError)
  }, [householdError])

  // Anchor used for age-range inference + outgrow banner. When a specific
  // baby is selected we follow that baby; "All" falls back to the first
  // baby so multi-baby households still see a sensible default.
  const ageAnchor = currentBaby ?? babies[0] ?? null

  // When the anchor baby changes (chip switch or initial load), snap the
  // Wish list selector to that baby's current age range. Overwrites the
  // user's manual selection intentionally — a chip switch is a context
  // swap, not a back-nav, and each baby's "current age" is the most useful
  // starting point.
  useEffect(() => {
    const inferred = inferAgeRange(ageAnchor)
    setSelectedAgeRange(inferred.currentRange || '3-6M')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageAnchor?.id])

  const loading = householdLoading || itemsLoading

  // Client-side filter for the current baby selection. Null baby_id items
  // are intentionally visible under every specific baby — they're "shared"
  // inventory (hand-me-downs, pre-arrival gifts) and semantically available
  // to any baby in the household. Every downstream view derives from this.
  const babyFilteredItems = useMemo(
    () => items.filter(it => matchesBabyFilter(it, selectedBabyId)),
    [items, selectedBabyId],
  )

  // ── Owned tab: items grouped by category ────────────────────────────────
  const ownedGrouped = useMemo(() => {
    const filtered = babyFilteredItems.filter(i => i.inventory_status === 'owned')
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const it of filtered) {
      if (groups[it.category]) groups[it.category].push(it)
    }
    return CATEGORY_ORDER
      .filter(c => groups[c].length > 0)
      .map(c => ({ category: c, items: groups[c] }))
  }, [babyFilteredItems])

  // ── Wish list tab: slot coverage + other wishes for selected age range ──
  // Coverage math runs on the baby-filtered set, so switching to Roo shows
  // Roo's coverage (with shared items counted toward him) rather than the
  // whole household's aggregate.
  const coverage = useMemo(() => {
    if (!selectedAgeRange) return []
    return computeCoverage(babyFilteredItems, selectedAgeRange)
  }, [babyFilteredItems, selectedAgeRange])

  const otherWishItems = useMemo(() => {
    if (!selectedAgeRange) return []
    return otherWishes(babyFilteredItems, selectedAgeRange)
  }, [babyFilteredItems, selectedAgeRange])

  // Overall coverage summary for the section meta ("27 of 64"). Clamp each
  // slot's contribution to recommended so over-stocked slots don't push the
  // summary past 100%.
  const coverageSummary = useMemo(() => {
    let owned = 0
    let recommended = 0
    for (const row of coverage) {
      owned += Math.min(row.ownedCount, row.recommended)
      recommended += row.recommended
    }
    return { owned, recommended }
  }, [coverage])

  // Coverage rows grouped by top-level category, preserving CATEGORY_ORDER so
  // the Wish list tab stacks cards in the same order as the Owned tab. Each
  // group carries its own clamped owned/recommended totals so the group
  // header can show "X of Y" the same way the macro summary does.
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

  const ageInfo = useMemo(() => inferAgeRange(ageAnchor), [ageAnchor])
  const showOutgrow = shouldShowOutgrowBanner(ageInfo)

  // Title follows the selection. With a specific baby picked, use their
  // name. With 'All' on a multi-baby household, "Your wardrobes" reads more
  // naturally than "Everyone's wardrobe". Zero/single unnamed baby keeps
  // the existing singular fallback.
  const title = currentBaby?.name
    ? `${currentBaby.name}'s wardrobe`
    : babies.length > 1
      ? 'Your wardrobes'
      : babies[0]?.name
        ? `${babies[0].name}'s wardrobe`
        : 'Your wardrobe'

  // Fire analytics once per (tab, age range) visit — low-volume event that
  // tells us how often users actually engage with recommendations.
  useEffect(() => {
    if (tab !== 'wishlist' || !selectedAgeRange) return
    track.gapAlertViewed({
      age_range: selectedAgeRange,
      owned: coverageSummary.owned,
      recommended: coverageSummary.recommended,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedAgeRange])

  function handleSlotTap(slotId) {
    track.recommendationClicked({ age_range: selectedAgeRange, slot: slotId })
    navigate(`/inventory/slot/${selectedAgeRange}/${slotId}`)
  }

  function handleOutgrowClick() {
    if (!ageInfo.nextRange) return
    track.gapAlertActioned({ from: ageInfo.currentRange, to: ageInfo.nextRange })
    setSelectedAgeRange(ageInfo.nextRange)
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate('/home')}
          aria-label="Back"
        >
          ←
        </button>
        <div className={styles.titleCell}>
          <div className={styles.title}>{title}</div>
          {/* Tiny mobile-only vine under the wardrobe name. IvySprig hides
              itself on desktop (≥ 960px) where the gutter IvyDecoration
              carries the decoration instead. */}
          <IvySprig />
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => navigate('/add-item')}
            aria-label="Add item"
          >
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <ProfileMenu />
        </div>
      </header>

      {/* Multi-baby chip switcher — self-hides for 0/1 baby households,
          so the layout is unchanged in the common single-baby case. Sits
          between the sticky header and the tabs so it scrolls with the
          rest of the page (header stays fixed, switcher doesn't). */}
      <BabySwitcher from="inventory" />

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'owned' ? styles.tabActive : ''}`}
          onClick={() => setTab('owned')}
        >
          Owned
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'wishlist' ? styles.tabActive : ''}`}
          onClick={() => setTab('wishlist')}
        >
          Wish list
        </button>
      </div>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && error && (
          <div className={styles.error}>
            Couldn't load your inventory: {error}
          </div>
        )}

        {/* ── Owned tab ─────────────────────────────────────────── */}
        {!loading && !error && tab === 'owned' && (
          <>
            {ownedGrouped.length === 0 && (
              <OwnedEmptyState onAdd={() => navigate('/add-item')} />
            )}
            {ownedGrouped.map(group => {
              const collapsed = ownedCollapsed.has(group.category)
              const id = `owned-${group.category}`
              return (
                <section className={styles.group} key={group.category}>
                  <GroupHeader
                    title={CATEGORY_LABELS[group.category] || group.category}
                    meta={`${group.items.length} ${pluralize(group.items.length, 'item')}`}
                    collapsed={collapsed}
                    onToggle={() => toggleOwnedGroup(group.category)}
                    contentId={id}
                  />
                  {!collapsed && (
                    <div className={styles.groupItems} id={id}>
                      {group.items.map(it => (
                        <ItemRow
                          key={it.id}
                          item={it}
                          tab="owned"
                          onClick={() => navigate(`/item/${it.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {/* Bottom-of-list CTA — only when there's already a list. The empty
                state has its own CTA, so we'd just be duplicating it here. */}
            {ownedGrouped.length > 0 && (
              <button
                type="button"
                className={styles.addMoreBtn}
                onClick={() => navigate('/add-item')}
              >
                + Add item
              </button>
            )}
          </>
        )}

        {/* ── Wish list tab ─────────────────────────────────────── */}
        {!loading && !error && tab === 'wishlist' && selectedAgeRange && (
          <WishlistView
            ageRange={selectedAgeRange}
            onAgeChange={setSelectedAgeRange}
            coverageByCategory={coverageByCategory}
            coverageSummary={coverageSummary}
            otherWishItems={otherWishItems}
            ageInfo={ageInfo}
            showOutgrow={showOutgrow}
            onOutgrowClick={handleOutgrowClick}
            onSlotTap={handleSlotTap}
            onAddWish={() => navigate('/add-item?mode=needed')}
            onItemTap={(itemId) => navigate(`/item/${itemId}`)}
            collapsedCategories={wishCollapsed}
            onToggleCategory={toggleWishGroup}
          />
        )}
      </main>
    </div>
  )
}

// ── Wish list view ──────────────────────────────────────────────────────────
// Kept as a separate component so Inventory's main function stays scannable.
// Pure presentational — all state + callbacks come from the parent.
function WishlistView({
  ageRange,
  onAgeChange,
  coverageByCategory,
  coverageSummary,
  otherWishItems,
  ageInfo,
  showOutgrow,
  onOutgrowClick,
  onSlotTap,
  onAddWish,
  onItemTap,
  collapsedCategories,
  onToggleCategory,
}) {
  return (
    <>
      {/* Age-range chip navbar — horizontally scrollable on narrow screens */}
      <div className={styles.ageNav}>
        {AGE_RANGES.map(range => {
          const isSelected = range === ageRange
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
                (isPast ? styles.ageChipPast : '')
              }
              onClick={() => onAgeChange(range)}
            >
              {range}
            </button>
          )
        })}
      </div>

      {/* Outgrow banner — amber, only when baby is ~3 weeks from the next range */}
      {showOutgrow && (
        <button
          type="button"
          className={styles.banner}
          onClick={onOutgrowClick}
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

      {/* Coverage summary header */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Recommended wardrobe</span>
        <span className={styles.sectionMeta}>
          {coverageSummary.owned} of {coverageSummary.recommended}
        </span>
      </div>

      {/* Category-stacked slot groups — same .group card shape as the Owned
          tab, so the two tabs share a visual rhythm. Each group header shows
          category label + clamped X-of-Y for this category at this age and
          is clickable to collapse the slot rows below it. */}
      {coverageByCategory.map(group => {
        const collapsed = collapsedCategories.has(group.category)
        const id = `wish-${group.category}`
        return (
          <section className={styles.group} key={group.category}>
            <GroupHeader
              title={CATEGORY_LABELS[group.category] || group.category}
              meta={`${group.owned} of ${group.recommended}`}
              collapsed={collapsed}
              onToggle={() => onToggleCategory(group.category)}
              contentId={id}
            />
            {!collapsed && (
              <div className={styles.groupItems} id={id}>
                {group.rows.map(row => (
                  <SlotRow
                    key={row.slot.id}
                    row={row}
                    onClick={() => onSlotTap(row.slot.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}

      {/* Other wishes section (non-canonical wishlist entries) */}
      <div className={styles.sectionHead} style={{ marginTop: 18 }}>
        <span className={styles.sectionTitle}>Other wishes</span>
        <span className={styles.sectionMeta}>
          {otherWishItems.length} in {ageRange}
        </span>
      </div>
      <div className={styles.otherWishList}>
        {otherWishItems.length === 0 && (
          <div className={styles.otherEmpty}>
            Anything specific on your list? Add it here — it&rsquo;ll live alongside the
            recommended wardrobe.
          </div>
        )}
        {otherWishItems.map(item => (
          <button
            type="button"
            className={styles.wish}
            key={item.id}
            onClick={() => onItemTap(item.id)}
            aria-label={`Open ${item.name || humanizeItemType(item.item_type)}`}
          >
            <div className={styles.wishName}>
              {item.name || humanizeItemType(item.item_type)}
            </div>
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
        <button
          type="button"
          className={styles.wishAddBtn}
          onClick={onAddWish}
        >
          + Add wish
        </button>
      </div>
    </>
  )
}

// ── Collapsible group header ───────────────────────────────────────────────
// Shared between the Owned and Wish list tabs. Renders the card's title bar
// as a <button> so keyboard + assistive-tech users get proper semantics, and
// flips a chevron depending on collapsed state. The parent decides meta copy
// (e.g. "6 items" on Owned vs "4 of 9" on Wish list) so this stays dumb.
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
          viewBox="0 0 10 6"
          width="10"
          height="6"
          aria-hidden="true"
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}

// ── Slot row ────────────────────────────────────────────────────────────────
function SlotRow({ row, onClick }) {
  const { slot, ownedCount, recommended, needed, status } = row
  const percent = recommended > 0
    ? Math.min(100, Math.round((ownedCount / recommended) * 100))
    : 0

  let hintText = null
  let hintClass = null
  if (status === 'complete') {
    hintText = '✓ Complete'
    hintClass = styles.slotHintDone
  } else if (status === 'empty') {
    hintText = 'None yet'
    hintClass = styles.slotHintNeed
  } else {
    hintText = `Need ${needed} more`
    hintClass = styles.slotHintNeed
  }

  const countClass =
    status === 'complete' ? styles.slotCountComplete :
    status === 'empty'    ? styles.slotCountEmpty   :
                            styles.slotCountGap
  const barFillClass =
    status === 'complete' ? styles.barFillComplete :
    status === 'empty'    ? styles.barFillEmpty   :
                            ''

  return (
    <button type="button" className={styles.slot} onClick={onClick}>
      <div className={styles.slotRow1}>
        <span className={styles.slotName}>{slot.label}</span>
        <span className={styles.slotStatus}>
          <span className={`${styles.slotCount} ${countClass}`}>
            {ownedCount} of {recommended}
          </span>
          <span className={styles.slotChev} aria-hidden="true">›</span>
        </span>
      </div>
      <div className={styles.barTrack}>
        <div
          className={`${styles.barFill} ${barFillClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className={styles.slotHint}>
        <span className={hintClass}>{hintText}</span>
        {slot.hint && <span>{slot.hint}</span>}
      </div>
    </button>
  )
}

// ── Owned-tab empty state ──────────────────────────────────────────────────
function OwnedEmptyState({ onAdd }) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>Start your inventory</div>
      <div className={styles.emptyBody}>
        Let&rsquo;s start with something you already have — a onesie, a sleepsuit, anything.
      </div>
      <button type="button" className={styles.emptyCta} onClick={onAdd}>
        Add first item
      </button>
    </div>
  )
}

// ── Item row (Owned tab) ───────────────────────────────────────────────────
// Rendered as a <button> so tapping anywhere on the row opens the item
// detail page. `all: unset` on .itemRow in the stylesheet strips the
// default button chrome; we redeclare only the visual bits we want.
function ItemRow({ item, tab, onClick }) {
  const badge = tab === 'owned'
    ? (STATUS_LABEL[item.inventory_status] ?? item.inventory_status)
    : (PRIORITY_LABEL[item.priority] ?? 'Needed')

  const displayName = item.name || humanizeItemType(item.item_type)
  const metaParts = [item.size_label, item.brand, item.quantity > 1 ? `×${item.quantity}` : null]
    .filter(Boolean)

  return (
    <button
      type="button"
      className={styles.itemRow}
      onClick={onClick}
      aria-label={`Open ${displayName}`}
    >
      <div className={styles.itemThumb} aria-hidden="true" />
      <div className={styles.itemBody}>
        <div className={styles.itemName}>{displayName}</div>
        <div className={styles.itemMeta}>{metaParts.join(' · ')}</div>
      </div>
      <span className={styles.itemBadge}>{badge}</span>
    </button>
  )
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
