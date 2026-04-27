import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
  // Household + babies + selection + items all come from context now. Items
  // used to be a local useState + per-mount fetch here, but that caused a
  // flicker on every navigation into /inventory (loading spinner → list).
  // The hoist into HouseholdContext keeps the list alive across navigation
  // and refreshes in place via reloadItems() after writes elsewhere.
  const {
    household,
    babies,
    selectedBabyId,
    currentBaby,
    loading: householdLoading,
    error: householdError,
    items,
    itemsLoading,
    itemsError,
    reloadItems,
  } = useHousehold()

  const [tab, setTab] = useState('owned') // 'owned' | 'wishlist'
  const [error, setError] = useState(null)

  // ── Inline outgrown action ──────────────────────────────────────────────
  // Optimistic flip from owned → outgrown without opening ItemDetail. The
  // pending set hides items from the rendered list as soon as the user
  // taps, before the DB roundtrip lands. The toast gives a 5s undo window
  // because outgrown items currently aren't viewable from any list (mistap
  // recovery is otherwise effectively impossible without a direct URL).
  //
  // Multi-tap behavior: each new flip replaces the toast (last-tap-wins).
  // Earlier flips are already committed to the DB and remain in the
  // optimistic-pending set until the next reloadItems lands the canonical
  // state. If a parent rapid-fires multiple Outgrown buttons, only the
  // most recent has an undo affordance — flag if this becomes a real
  // pattern (it shouldn't; outgrown is a thoughtful per-item decision).
  const [pendingOutgrownIds, setPendingOutgrownIds] = useState(() => new Set())
  const [outgrownToast, setOutgrownToast] = useState(null)
    // { id, name } | null

  // Auto-dismiss the toast after 5s. Each new toast value replaces the
  // previous one; effect cleanup clears the in-flight timer so we don't
  // double-fire dismissals.
  useEffect(() => {
    if (!outgrownToast) return
    const t = setTimeout(() => setOutgrownToast(null), 5000)
    return () => clearTimeout(t)
  }, [outgrownToast])

  // Once a fresh items list lands from the server, the optimistic pending
  // set is obsolete — the canonical list already excludes outgrown items
  // via the inventory_status filter. Clearing here prevents the set from
  // accumulating stale ids across many flips during a session.
  useEffect(() => {
    if (pendingOutgrownIds.size > 0) setPendingOutgrownIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  async function handleMarkOutgrown(item) {
    if (!item || pendingOutgrownIds.has(item.id)) return

    // Optimistic: hide instantly so the row doesn't sit there while the
    // network call resolves. Toast becomes the user's only handle to
    // undo, which is the correct UX hierarchy (instant feedback > slow
    // confirmation).
    setPendingOutgrownIds(prev => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })
    setOutgrownToast({
      id: item.id,
      name: item.name || humanizeItemType(item.item_type),
    })

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({ inventory_status: 'outgrown' })
      .eq('id', item.id)

    if (updErr) {
      // Roll back the optimistic state so the item snaps back into the
      // list and the error is visible. The toast disappears on the next
      // setOutgrownToast(null) so dismissing here keeps the surface tidy.
      setPendingOutgrownIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      setOutgrownToast(null)
      setError(`Couldn’t mark ${item.name || 'item'} outgrown: ${updErr.message}`)
      return
    }

    track.itemMarkedOutgrown?.({ id: item.id, from: 'inventory_inline' })
    reloadItems()
  }

  async function handleUndoOutgrown() {
    if (!outgrownToast) return
    const { id, name } = outgrownToast

    // Local state first: take the item out of pending so reloadItems'
    // refetch lands a canonical owned row that won't get filtered out.
    setPendingOutgrownIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setOutgrownToast(null)

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({ inventory_status: 'owned' })
      .eq('id', id)

    if (updErr) {
      setError(`Couldn’t undo outgrown for ${name}: ${updErr.message}`)
      return
    }

    track.itemMarkedOutgrownUndone?.({ id })
    reloadItems()
  }

  // The currently selected age range on the Wish list tab. Initialized from
  // the baby's DOB once we've loaded it; falls back to '3-6M' as a reasonable
  // middle-of-the-road default if we have no baby data.
  const [selectedAgeRange, setSelectedAgeRange] = useState(null)

  // Per-tab collapsed category state. Seeds differ by tab:
  //   - Owned starts ALL-EXPANDED; a layout-effect pass below measures the
  //     fully-expanded page and collapses everything only if it would
  //     overflow the viewport. Small inventories stay fully visible; large
  //     ones land on a compact header stack. See the auto-fit effect below
  //     for the full contract.
  //   - Wish list stays ALL-COLLAPSED by default — the recommended-wardrobe
  //     view is dense even with zero items (every slot shows a progress bar),
  //     so a compact stack of headers is the right starting point regardless
  //     of viewport size.
  // Tapping a header removes the category from the set (expands), tapping
  // again re-adds (collapses). Kept per-tab so expanding Sleepwear on Owned
  // doesn't also expand it on Wish list (different intent, same categories).
  // Categories not in CATEGORY_ORDER get filtered out upstream, so the
  // Wish-list seed is exhaustive.
  const [ownedCollapsed, setOwnedCollapsed] = useState(() => new Set())
  const [wishCollapsed, setWishCollapsed] = useState(() => new Set(CATEGORY_ORDER))

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

  // Surface household- or items-load errors — they're rare but should not be
  // silently swallowed (no household = pre-onboarding; caller gets redirected
  // by Home's gate anyway, so this only triggers on a genuine query failure).
  // Items themselves come from HouseholdContext now; see its items-loader
  // effect for the fetch + reloadItems() contract.
  useEffect(() => {
    if (householdError) setError(householdError)
    else if (itemsError) setError(itemsError)
  }, [householdError, itemsError])

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
  // inventory (outgrown clothes from family or friends, pre-arrival gifts) and semantically available
  // to any baby in the household. Every downstream view derives from this.
  const babyFilteredItems = useMemo(
    () => items.filter(it => matchesBabyFilter(it, selectedBabyId)),
    [items, selectedBabyId],
  )

  // ── Owned tab: items grouped by category, filtered by selected age range ─
  // The Owned tab now has an age-range nav mirroring the Wish list. Users
  // plan ahead by adding clothes for future age bands — so filtering here
  // lets them see exactly what they have for a given size without wading
  // through newborn burp cloths when they're prepping for 12-18M.
  const ownedGrouped = useMemo(() => {
    const filtered = babyFilteredItems.filter(i =>
      i.inventory_status === 'owned' &&
      !pendingOutgrownIds.has(i.id) &&
      (!selectedAgeRange || i.size_label === selectedAgeRange)
    )
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const it of filtered) {
      if (groups[it.category]) groups[it.category].push(it)
    }
    return CATEGORY_ORDER
      .filter(c => groups[c].length > 0)
      .map(c => ({ category: c, items: groups[c] }))
  }, [babyFilteredItems, selectedAgeRange, pendingOutgrownIds])

  // ── Owned tab: auto-collapse only when content overflows the viewport ────
  // The rule: Owned-tab groups should stay EXPANDED by default on small
  // inventories (nothing to hide), and COLLAPSE by default only when the
  // fully-expanded layout would extend past the bottom of the viewport. This
  // has to be viewport-driven rather than item-count-driven because the same
  // inventory fits on a desktop browser but not on a phone — the measurement
  // is the only honest answer.
  //
  // How it works:
  //   1. Render the Owned tab with ownedCollapsed=∅ (everything expanded).
  //   2. useLayoutEffect measures document.scrollHeight vs window.innerHeight
  //      AFTER the DOM commits but BEFORE paint, so any correction we make is
  //      invisible to the user (no flash).
  //   3. If overflow, set ownedCollapsed to the full CATEGORY_ORDER set.
  //   4. Remember the "key" we just measured for — subsequent renders with
  //      the same key (e.g. user tapped a header) skip the measurement, so
  //      manual toggles stick instead of getting overridden on every render.
  //
  // Key is selectedAgeRange — not item counts — so adding or removing an
  // item doesn't re-run the measurement. Re-mounting the screen after
  // /add-item already resets state from scratch, which is the right moment
  // to re-measure. Window resize clears the key via the resize handler, so
  // rotating a phone or resizing a desktop window re-applies the rule.
  const autoFitKeyRef = useRef(null)
  const [resizeTick, setResizeTick] = useState(0)

  useEffect(() => {
    let t = null
    function onResize() {
      // Debounce — resize events can fire many times per second on drag.
      clearTimeout(t)
      t = setTimeout(() => {
        autoFitKeyRef.current = null
        setResizeTick(x => x + 1)
      }, 150)
    }
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  useLayoutEffect(() => {
    if (tab !== 'owned') return
    if (itemsLoading) return
    if (!selectedAgeRange) return
    if (ownedGrouped.length === 0) return

    const key = selectedAgeRange
    if (autoFitKeyRef.current === key) return

    // The measurement has to run against the fully-expanded layout. If any
    // group is still collapsed (from a prior age-range's auto-collapse),
    // reset first; the effect re-fires on the next commit and takes the
    // measurement then. This two-pass dance happens synchronously inside a
    // single layout phase, so the user never sees the intermediate state.
    if (ownedCollapsed.size > 0) {
      setOwnedCollapsed(new Set())
      return
    }

    autoFitKeyRef.current = key
    const overflow = document.documentElement.scrollHeight > window.innerHeight
    if (overflow) {
      setOwnedCollapsed(new Set(CATEGORY_ORDER))
    }
    // ownedGrouped is a dep because item-load races mean we need to re-run
    // once the first batch of items lands (length goes 0 → N). resizeTick
    // lets the resize handler force a re-measure under a new viewport size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, itemsLoading, selectedAgeRange, ownedGrouped, ownedCollapsed, resizeTick])

  // Total owned-item count for the whole household (across all age ranges)
  // for this baby — used to decide which empty state to show on the Owned
  // tab: "Start your inventory" when there's literally nothing, vs.
  // "Nothing in {range} yet" when other ranges have items.
  const totalOwnedCount = useMemo(
    () => babyFilteredItems.filter(i => i.inventory_status === 'owned').length,
    [babyFilteredItems],
  )

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
          {/* Pass-along hub entry — soft-gray circle so it reads as a
              secondary action next to the solid-teal + button. Icon is
              a simple open-box glyph; aria-label carries the meaning for
              screen readers. */}
          <button
            type="button"
            className={styles.passBtn}
            onClick={() => navigate('/pass-along')}
            aria-label="Pass-along"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M2 5l6-3 6 3v6l-6 3-6-3V5z M2 5l6 3 6-3 M8 8v6"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
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
        {!loading && !error && tab === 'owned' && selectedAgeRange && (
          <>
            {/* Age-range chip navbar — mirrors the Wish list nav so users can
                stock forward (12-18M in April when baby is 3-6M) without
                switching tabs. The baby's current band gets a teal dot so
                you always see "where you are" even when browsing a future
                band. Past bands are dimmed to match the Wish list treatment. */}
            <AgeNav
              ageRange={selectedAgeRange}
              onAgeChange={setSelectedAgeRange}
              ageInfo={ageInfo}
            />

            {ownedGrouped.length === 0 && (
              <OwnedEmptyState
                ageRange={selectedAgeRange}
                totalOwnedCount={totalOwnedCount}
                onAdd={() =>
                  navigate(`/add-item?mode=owned&size=${encodeURIComponent(selectedAgeRange)}`)
                }
              />
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
                          onOutgrown={handleMarkOutgrown}
                          outgrowing={pendingOutgrownIds.has(it.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
            {/* Bottom-of-list CTA — only when there's already a list. The empty
                state has its own CTA, so we'd just be duplicating it here.
                Size param pre-fills AddItem so users can keep stocking the
                same age band without resetting the filter. */}
            {ownedGrouped.length > 0 && (
              <>
                <button
                  type="button"
                  className={styles.addMoreBtn}
                  onClick={() =>
                    navigate(`/add-item?mode=owned&size=${encodeURIComponent(selectedAgeRange)}`)
                  }
                >
                  + Add item in {selectedAgeRange}
                </button>
                {/* Surfaces batch-scan two screens before users can find it
                    on their own (Inventory → AddItem → scanner pill →
                    "Scan many" toggle). Kept to one quiet line so it doesn't
                    compete with the primary CTA above it. */}
                <div className={styles.addMoreHint}>
                  Adding a stack? Tap <strong>Scan a tag</strong> on the next
                  screen, then turn on <strong>Scan many</strong>.
                </div>
              </>
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

      {/* Outgrown-flip undo toast — fixed-positioned at the bottom of the
          viewport, auto-dismisses after 5s (handled by the effect on
          outgrownToast). The Undo button reverts the optimistic flip and
          fires a DB write to restore inventory_status='owned'. We render
          this at the page level rather than inside the list so it stays
          put while the list scrolls underneath. */}
      {outgrownToast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastBody}>
            Marked <strong>{outgrownToast.name}</strong> as outgrown
          </span>
          <button
            type="button"
            className={styles.toastUndo}
            onClick={handleUndoOutgrown}
          >
            Undo
          </button>
        </div>
      )}
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
      <AgeNav
        ageRange={ageRange}
        onAgeChange={onAgeChange}
        ageInfo={ageInfo}
      />

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

// ── Age-range chip navbar ──────────────────────────────────────────────────
// Shared between the Owned and Wish list tabs. The chip matching the baby's
// current (DOB- or override-derived) age band sprouts a tiny leaf out the
// bottom so the user never loses track of where the baby actually is while
// browsing future sizes. Past bands are dimmed (.ageChipPast) to signal
// "you probably don't need to shop here anymore" without hiding them —
// outgrown items still live there.
//
// The sprout is absolutely-positioned inside the ageNav's bottom padding,
// so the chip itself stays the same size as its siblings (no margin-bottom
// that would squeeze the flex row and offset the chip vertically).
function AgeNav({ ageRange, onAgeChange, ageInfo }) {
  return (
    <div className={styles.ageNav}>
      {AGE_RANGES.map(range => {
        const isSelected = range === ageRange
        const isCurrent =
          ageInfo.currentRange && range === ageInfo.currentRange
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

// ── Sprout marker ──────────────────────────────────────────────────────────
// Tiny two-leaf seedling that grows out of the bottom of the "current age
// band" chip. The <g> gets a gentle sway so it reads as alive; the wrapper
// handles the one-time grow-in on mount. Both animations are disabled for
// users who've opted out of motion (see Inventory.module.css).
function Sprout() {
  return (
    <span className={styles.sprout} aria-hidden="true">
      <svg viewBox="0 0 20 14" width="20" height="14">
        <g className={styles.sproutStem}>
          {/* Stem — a short vertical line emerging from the chip's bottom edge. */}
          <path
            d="M10 0 L10 12"
            stroke="currentColor"
            strokeWidth="1.25"
            fill="none"
            strokeLinecap="round"
          />
          {/* Left leaf. */}
          <path
            d="M10 7 Q3 5 2 10 Q7 11 10 9 Z"
            fill="currentColor"
          />
          {/* Right leaf — slightly higher + smaller so the pair feels organic. */}
          <path
            d="M10 5 Q16 3.5 17 7 Q13 8 10 6.5 Z"
            fill="currentColor"
          />
        </g>
      </svg>
    </span>
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
// Two flavors depending on whether the user has any items at all.
//  • totalOwnedCount === 0 → "Start your inventory" (whole-wardrobe empty)
//  • totalOwnedCount > 0   → "Nothing in {range} yet" (this age band only,
//                            common when stocking forward for a future size)
function OwnedEmptyState({ ageRange, totalOwnedCount, onAdd }) {
  if (totalOwnedCount === 0) {
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
  return (
    <div className={styles.empty}>
      <div className={styles.emptyTitle}>Nothing in {ageRange} yet</div>
      <div className={styles.emptyBody}>
        Stocking forward? Add pieces for this size so they&rsquo;re waiting when the
        baby grows into them.
      </div>
      <button type="button" className={styles.emptyCta} onClick={onAdd}>
        Add item in {ageRange}
      </button>
    </div>
  )
}

// ── Item row (Owned tab) ───────────────────────────────────────────────────
// Rendered as a <button> so tapping anywhere on the row opens the item
// detail page. `all: unset` on .itemRow in the stylesheet strips the
// default button chrome; we redeclare only the visual bits we want.
function ItemRow({ item, tab, onClick, onOutgrown, outgrowing }) {
  const displayName = item.name || humanizeItemType(item.item_type)

  // Owned tab: size lives in the chip (left), quantity + Outgrown action
  // live in the right cluster, brand carries the meta line solo. Wishlist
  // tab keeps the original badge (Must have / Nice to have / Needed) — the
  // priority signal there is meaningful, unlike "Owned" on the Owned tab
  // which was redundant with the tab itself.
  const isOwnedTab = tab === 'owned'
  const sizeLabel = item.size_label || '—'
  const sizeIsEmpty = !item.size_label
  const metaText = isOwnedTab
    ? (item.brand || '')
    : [item.size_label, item.brand, item.quantity > 1 ? `×${item.quantity}` : null]
        .filter(Boolean)
        .join(' · ')

  // Wishlist-only badge (priority). On Owned, the right-side cluster
  // replaces this entirely with quantity + the inline outgrown action.
  const wishBadge = !isOwnedTab
    ? (PRIORITY_LABEL[item.priority] ?? 'Needed')
    : null

  return (
    <button
      type="button"
      className={styles.itemRow}
      onClick={onClick}
      aria-label={`Open ${displayName}`}
    >
      <div
        className={`${styles.itemThumb} ${sizeIsEmpty ? styles.itemThumbEmpty : ''}`}
        aria-hidden="true"
      >
        {sizeLabel}
      </div>
      <div className={styles.itemBody}>
        <div className={styles.itemName}>{displayName}</div>
        {metaText && <div className={styles.itemMeta}>{metaText}</div>}
      </div>

      {isOwnedTab ? (
        <div className={styles.itemRight}>
          {item.quantity > 1 && (
            <span className={styles.itemQty}>×{item.quantity}</span>
          )}
          {/* Inline action — flip status owned → outgrown without opening
              the detail screen. The button's onClick stops propagation so
              tapping the action doesn't also fire the row's onClick (which
              would navigate to the detail screen mid-flip). */}
          {onOutgrown && (
            <button
              type="button"
              className={styles.itemOutgrownBtn}
              onClick={e => {
                e.stopPropagation()
                onOutgrown(item)
              }}
              disabled={outgrowing}
              aria-label={`Mark ${displayName} as outgrown`}
            >
              Outgrown
            </button>
          )}
        </div>
      ) : (
        <span className={styles.itemBadge}>{wishBadge}</span>
      )}
    </button>
  )
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}
