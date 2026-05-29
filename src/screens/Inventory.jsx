import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  AGE_RANGES,
  CATEGORY_LABELS,
  SLOT_BY_ID,
  inferAgeRange,
  shouldShowPredictionCard,
  computeCoverage,
  formatTransitionEta,
  pluralize,
} from '../lib/wardrobe'
import {
  CATEGORY_META,
  SUB_CATEGORY_LABELS,
  SUB_CATEGORIES_BY_CATEGORY,
  ITEM_BY_ID,
} from '../lib/categories'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import Eyebrow from '../components/Eyebrow'
import BottomNav from '../components/BottomNav'
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
  pass_along: 'In a bag',
  kept: 'Tucked away',
  donated: 'Donated',
  exchanged: 'Exchanged',
}

const CONDITION_LABEL = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  worn: 'Worn',
}

// Season values match the new warm/cold/all-season axis (migration 035,
// 2026-05-05). Old keys backfilled in the migration; this map only carries
// the three new keys.
const SEASON_LABEL = {
  warm_weather: 'Warm weather',
  cold_weather: 'Cold weather',
  all_season:   'All-season',
}

// Pick the most identifying primary label for a row + the supporting meta
// line. Falls through name → brand → slot label → 'Item' so unnamed rows
// don't all collapse into the same humanized item_type ("One pieces"
// repeated below "One-pieces" was the symptom). Meta picks up whatever
// other fields the user filled (brand if not already used, slot label
// if not already used, condition, season) so two same-type unnamed rows
// differ visually when any descriptor exists.
function buildItemDisplay(item) {
  const slot = item.item_type ? SLOT_BY_ID[item.item_type] : null
  // Individual-item context: prefer slot.singular ("One-piece") over the
  // category-level slot.label ("One-pieces"). Falls back to label for
  // any slots that don't define a singular, then to humanized item_type.
  const slotLabel = slot?.singular || slot?.label || humanizeItemType(item.item_type)

  let primary
  let primarySource // 'name' | 'brand' | 'slot' | 'fallback'
  if (item.name) {
    primary = item.name
    primarySource = 'name'
  } else if (item.brand) {
    primary = item.brand
    primarySource = 'brand'
  } else if (slotLabel) {
    primary = slotLabel
    primarySource = 'slot'
  } else {
    primary = 'Item'
    primarySource = 'fallback'
  }

  const metaParts = []
  if (primarySource !== 'brand' && item.brand) metaParts.push(item.brand)
  if (primarySource !== 'slot' && slotLabel) metaParts.push(slotLabel)
  if (item.condition) metaParts.push(CONDITION_LABEL[item.condition] || item.condition)
  if (item.season) metaParts.push(SEASON_LABEL[item.season] || item.season)

  // Cap at 3 parts so the meta line doesn't ellipsize away the more
  // identifying earlier fields on narrow screens.
  return { primary, meta: metaParts.slice(0, 3).join(' · ') }
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

const VALID_TOP_CATEGORIES = ['clothing', 'sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath']

export default function Inventory() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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

  const [error, setError] = useState(null)

  // Top-level category selection — decides which table's items to show and
  // which UI (clothing-specific age nav vs simple sub-category grouping).
  // Initialized from ?category= param so Home card taps land on the right tab.
  // The useEffect syncs it when the param changes without a remount (e.g.
  // navigating from Home while Inventory is already mounted in the shell).
  const [selectedTopCategory, setSelectedTopCategory] = useState(() => {
    const param = searchParams.get('category')
    return param && VALID_TOP_CATEGORIES.includes(param) ? param : 'clothing'
  })
  useEffect(() => {
    const param = searchParams.get('category')
    if (param && VALID_TOP_CATEGORIES.includes(param)) {
      setSelectedTopCategory(param)
    }
  }, [searchParams])
  const isClothing = selectedTopCategory === 'clothing'

  // ── Inline action handlers (Owned tab) ─────────────────────────────────
  // Two paths from each Owned row's inline chips:
  //   - Pass on   → flip status to 'pass_along', attach to a draft bag.
  //                 Toast offers View bag + Undo.
  //   - Tuck away → flip status to 'kept'. Toast offers Undo only.
  // Both use pendingHideIds to hide rows instantly while the DB roundtrip
  // resolves. The toast's `kind` field tells Undo what to revert to and
  // which secondary action to render. (Replaces the older outgrown→toast
  // →pass-it-on two-step path from 2026-04-27.)
  const [pendingHideIds, setPendingHideIds] = useState(() => new Set())
  const [actionToast, setActionToast] = useState(null)
    // { kind: 'pass_on' | 'tuck_away', id, name, batchId? } | null

  // Auto-dismiss the toast after 5s. Each new toast value replaces the
  // previous one; effect cleanup clears the in-flight timer so we don't
  // double-fire dismissals.
  useEffect(() => {
    if (!actionToast) return
    const t = setTimeout(() => setActionToast(null), 5000)
    return () => clearTimeout(t)
  }, [actionToast])

  // Once a fresh items list lands from the server, the optimistic pending
  // set is obsolete — the canonical list's inventory_status filters
  // already exclude hidden items. Clearing here prevents the set from
  // accumulating stale ids across many flips during a session.
  useEffect(() => {
    if (pendingHideIds.size > 0) setPendingHideIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Find-or-create the household's most recent draft bag. Shared by
  // handlePassOn and handleSectionChipTap. Returns
  // { batchId, createdNewBatch } or { error: string }. Reusing an
  // existing draft matches the parent's mental model of "I'm building
  // a pile to send" rather than spawning a fresh bag for every item.
  async function ensureDraftBatch() {
    if (!household?.id || !user?.id) {
      return { error: "Couldn't start a bag — household not loaded." }
    }

    const { data: existingDraft, error: findErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .select('id')
      .eq('household_id', household.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findErr) {
      return { error: `Couldn't find a draft bag: ${findErr.message}` }
    }

    if (existingDraft) {
      return { batchId: existingDraft.id, createdNewBatch: false }
    }

    const { data: newBatch, error: insErr } = await supabase
      .schema(currentSchema)
      .from('pass_along_batches')
      .insert({
        household_id: household.id,
        created_by: user.id,
        destination_type: 'family',
        // status defaults to 'draft', reference_code auto-generated
      })
      .select('id')
      .maybeSingle()

    if (insErr || !newBatch) {
      return { error: `Couldn't start a bag: ${insErr?.message ?? 'unknown'}` }
    }

    track.passAlongBatchCreated?.({ id: newBatch.id, from: 'inventory_inline' })
    return { batchId: newBatch.id, createdNewBatch: true }
  }

  async function handlePassOn(item, opts = {}) {
    if (!item || pendingHideIds.has(item.id)) return
    const { from = 'inventory_inline' } = opts

    // Optimistic hide.
    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })

    const ensured = await ensureDraftBatch()
    if (ensured.error) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      setError(ensured.error)
      return
    }

    const { batchId, createdNewBatch } = ensured

    // Save the item's current inventory_status into pre_bag_inventory_status
    // so removeItem in PassAlongBatch can restore to the right pile when
    // the user takes it back out (Owned vs Tucked away vs legacy outgrown).
    // Without this, every removal lands in 'owned' even for items that
    // came from the kept pile.
    const prevStatus = item.inventory_status
    const { error: attachErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        pass_along_batch_id: batchId,
        inventory_status: 'pass_along',
        pre_bag_inventory_status: prevStatus,
      })
      .eq('id', item.id)

    if (attachErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn't add ${name} to the bag: ${attachErr.message}`)
      return
    }

    track.passAlongItemAdded?.({
      from,
      batch_id: batchId,
      created_new_batch: createdNewBatch,
      count: 1,
    })

    setActionToast({
      kind: 'pass_on',
      id: item.id,
      name: item.name || humanizeItemType(item.item_type),
      batchId,
      prevStatus,
    })

    reloadItems()
  }

  async function handleTuckAway(item, opts = {}) {
    if (!item || pendingHideIds.has(item.id)) return
    const { from = 'inventory_inline' } = opts

    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })

    const prevStatus = item.inventory_status
    const itemTable = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(itemTable)
      .update({ inventory_status: 'kept' })
      .eq('id', item.id)

    if (updErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn't tuck away ${name}: ${updErr.message}`)
      return
    }

    track.itemTuckedAway?.({ id: item.id, from })

    setActionToast({
      kind: 'tuck_away',
      id: item.id,
      name: item.name || humanizeItemType(item.item_type),
      prevStatus,
      itemTable,
    })

    reloadItems()
  }

  // Undo the most recent toast action. Restores to actionToast.prevStatus
  // (the item's status BEFORE the just-completed action) so a kept-row
  // chip flip undoes back to kept, an Owned-row inline undoes to owned,
  // etc. If kind === 'pass_on', also detach from the bag and clear
  // pre_bag_inventory_status (the row is no longer associated with any
  // bag, and a future re-attach should record fresh origin).
  async function handleUndoToast() {
    if (!actionToast) return
    const { kind, id, name, prevStatus, itemTable = 'clothing_items' } = actionToast
    const restoreStatus = prevStatus || 'owned'

    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setActionToast(null)

    // Non-clothing items don't have pass_along_batch_id
    const update = kind === 'pass_on' && itemTable === 'clothing_items'
      ? {
          inventory_status: restoreStatus,
          pass_along_batch_id: null,
          pre_bag_inventory_status: null,
        }
      : { inventory_status: restoreStatus }

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(itemTable)
      .update(update)
      .eq('id', id)

    if (updErr) {
      setError(`Couldn't undo for ${name}: ${updErr.message}`)
      return
    }

    if (kind === 'pass_on') {
      // No tracker yet for "pass-on undone"; reuse the existing
      // outgrown-undone event to keep telemetry surface area small.
      track.itemMarkedOutgrownUndone?.({ id })
    } else {
      track.itemTuckedAwayUndone?.({ id })
    }

    reloadItems()
  }

  // Toast secondary action after Pass on. Just navigates; the toast
  // auto-dismisses on the route change.
  function handleViewBagFromToast() {
    if (!actionToast?.batchId) return
    const batchId = actionToast.batchId
    setActionToast(null)
    navigate(`/pass-along/${batchId}`)
  }

  // Section-row chip handlers (bottom-of-Owned "Outgrown" section).
  // The chip on each row is dual-purpose: it shows current intent, and
  // tapping it flips the item's status (or navigates if it's already in
  // a bag). handleSectionChipTap covers the Pass-on side; handleSectionTuckAway
  // covers the inverse on items currently in pass_along/outgrown.

  // Tap the "Pass on" chip on a kept/legacy-outgrown row, or tap the bag
  // icon next to a pass_along row to navigate to the bag it's in.
  async function handleSectionChipTap(item) {
    if (!item) return
    if (item.inventory_status === 'pass_along') {
      if (item.pass_along_batch_id) {
        navigate(`/pass-along/${item.pass_along_batch_id}`)
      }
      return
    }
    if (item.inventory_status === 'kept') {
      track.intentFlipped?.({
        from_status: 'kept',
        to_status: 'pass_along',
      })
    }
    await handlePassOn(item, { from: 'outgrown_section_chip' })
  }

  // Flip a pass_along/outgrown item back to 'kept' (detaches from bag).
  // Clears pre_bag_inventory_status since the item is no longer in a
  // bag and a future re-attach should record fresh origin.
  async function handleSectionTuckAway(item) {
    if (!item) return
    if (item.inventory_status === 'kept') return // already there
    if (pendingHideIds.has(item.id)) return

    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })

    const sectionItemTable = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    const sectionTuckUpdate = sectionItemTable === 'clothing_items'
      ? { inventory_status: 'kept', pass_along_batch_id: null, pre_bag_inventory_status: null }
      : { inventory_status: 'kept' }
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(sectionItemTable)
      .update(sectionTuckUpdate)
      .eq('id', item.id)

    if (updErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn't tuck away ${name}: ${updErr.message}`)
      return
    }

    track.intentFlipped?.({
      from_status: item.inventory_status,
      to_status: 'kept',
    })
    track.itemTuckedAway?.({ id: item.id, from: 'outgrown_section_chip' })
    reloadItems()
  }

  // Move-back-to-Owned restores an item from the Outgrown section back into
  // active rotation. Works for BOTH 'kept' (tucked away) and legacy 'outgrown'
  // statuses — anything sitting in the Outgrown section is a candidate. Mirrors
  // ItemDetail's handleReturnToOwned so the two paths behave identically.
  // Added 2026-05-01 in response to "we need a way to move an item out of
  // outgrown back into the owned section" — the existing affordance lived
  // only on ItemDetail, requiring a drill-in for what should be a one-tap
  // correction. Replaces the inline Tuck-away chip on the Outgrown section.
  async function handleSectionMoveBack(item) {
    if (!item) return
    if (item.inventory_status === 'owned') return // already there
    if (pendingHideIds.has(item.id)) return

    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.add(item.id)
      return next
    })

    const moveBackTable = item.top_category === 'clothing' ? 'clothing_items' : 'items'
    const moveBackUpdate = moveBackTable === 'clothing_items'
      ? { inventory_status: 'owned', pass_along_batch_id: null, pre_bag_inventory_status: null }
      : { inventory_status: 'owned' }
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from(moveBackTable)
      .update(moveBackUpdate)
      .eq('id', item.id)

    if (updErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn't move ${name} back to Owned: ${updErr.message}`)
      return
    }

    track.itemReturnedToOwned?.({ id: item.id, from: 'inventory_inline' })
    reloadItems()
  }

  // The currently selected age range on the Wish list tab. Initialized from
  // the baby's DOB once we've loaded it; falls back to '3-6M' as a reasonable
  // middle-of-the-road default if we have no baby data.
  const [selectedAgeRange, setSelectedAgeRange] = useState(null)

  // Owned starts ALL-EXPANDED; a layout-effect pass below measures the
  // fully-expanded page and collapses everything only if it would overflow
  // the viewport. Small inventories stay fully visible; large ones land on
  // a compact header stack. See the auto-fit effect below for the full contract.
  const [ownedCollapsed, setOwnedCollapsed] = useState(() => new Set())

  // Outgrown section (bottom of Owned tab). Default-collapsed: the
  // section's whole point is to stay out of the way of the active
  // inventory until the user opts in. Header surfaces the count so the
  // user knows there's stuff there even when the body is hidden.
  const [outgrownSectionCollapsed, setOutgrownSectionCollapsed] = useState(true)

  // Non-clothing sub-category collapse state (separate from clothing's
  // ownedCollapsed so switching categories doesn't share collapse memory).
  const [catCollapsed, setCatCollapsed] = useState(() => new Set())

  function toggleCatGroup(subCat) {
    setCatCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(subCat)) next.delete(subCat); else next.add(subCat)
      return next
    })
  }

  function toggleOwnedGroup(cat) {
    setOwnedCollapsed(prev => {
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
    () => items.filter(it =>
      matchesBabyFilter(it, selectedBabyId) &&
      it.top_category === selectedTopCategory
    ),
    [items, selectedBabyId, selectedTopCategory],
  )

  // Outgrown section pool — clothing-only. Items the household has moved out
  // of active rotation: 'kept', 'pass_along', or legacy 'outgrown'.
  // Non-clothing has its own catOutgrownItems below.
  const outgrownSectionItems = useMemo(
    () => isClothing
      ? babyFilteredItems.filter(i =>
          (i.inventory_status === 'kept' ||
            i.inventory_status === 'pass_along' ||
            i.inventory_status === 'outgrown') &&
          !pendingHideIds.has(i.id)
        )
      : [],
    [isClothing, babyFilteredItems, pendingHideIds],
  )

  // ── Non-clothing owned items, grouped by sub_category ──────────────────
  const catOwnedGrouped = useMemo(() => {
    if (isClothing) return []
    const filtered = babyFilteredItems.filter(i =>
      i.inventory_status === 'owned' &&
      !pendingHideIds.has(i.id)
    )
    const subCats = SUB_CATEGORIES_BY_CATEGORY[selectedTopCategory] || []
    const groups = Object.fromEntries(subCats.map(s => [s, []]))
    for (const it of filtered) {
      if (groups[it.sub_category] !== undefined) groups[it.sub_category].push(it)
    }
    return subCats
      .filter(s => groups[s].length > 0)
      .map(s => ({ subCat: s, items: groups[s] }))
  }, [isClothing, babyFilteredItems, selectedTopCategory, pendingHideIds])

  // Non-clothing tucked-away items (status='kept').
  const catOutgrownItems = useMemo(
    () => isClothing
      ? []
      : babyFilteredItems.filter(i =>
          i.inventory_status === 'kept' &&
          !pendingHideIds.has(i.id)
        ),
    [isClothing, babyFilteredItems, pendingHideIds],
  )

  // Group section items by category for the same .group/.GroupHeader
  // visual rhythm as the active Owned list, so the section's expanded
  // body looks like a quieter mirror of what's above.
  const outgrownSectionGrouped = useMemo(() => {
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const it of outgrownSectionItems) {
      if (groups[it.category]) groups[it.category].push(it)
    }
    return CATEGORY_ORDER
      .filter(c => groups[c].length > 0)
      .map(c => ({ category: c, items: groups[c] }))
  }, [outgrownSectionItems])

  // ── Owned tab: items grouped by category, filtered by selected age range ─
  // The Owned tab now has an age-range nav mirroring the Wish list. Users
  // plan ahead by adding clothes for future age bands — so filtering here
  // lets them see exactly what they have for a given size without wading
  // through newborn burp cloths when they're prepping for 12-18M.
  const ownedGrouped = useMemo(() => {
    const filtered = babyFilteredItems.filter(i =>
      i.inventory_status === 'owned' &&
      !pendingHideIds.has(i.id) &&
      (!selectedAgeRange || i.size_label === selectedAgeRange)
    )
    const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]))
    for (const it of filtered) {
      if (groups[it.category]) groups[it.category].push(it)
    }
    return CATEGORY_ORDER
      .filter(c => groups[c].length > 0)
      .map(c => ({ category: c, items: groups[c] }))
  }, [babyFilteredItems, selectedAgeRange, pendingHideIds])

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
    // Track width across resizes so we can ignore pure-height transitions.
    // Mobile Chrome and Safari both collapse/expand the URL bar as the user
    // scrolls, which fires window 'resize' events even though nothing the
    // user cares about changed. If we let those re-run the auto-fit
    // measurement, the user's manually-expanded category gets reset every
    // time the URL bar transitions (the effect resets ownedCollapsed →
    // measures → re-collapses everything), with a one-frame "everything
    // expanded" flash in between that reads as the UI shaking. Real layout
    // changes (orientation flip, desktop window drag) DO change width, so
    // gating on width preserves the auto-fit semantic for the cases that
    // actually need it.
    let lastWidth = typeof window !== 'undefined' ? window.innerWidth : 0
    function onResize() {
      const nextWidth = window.innerWidth
      if (nextWidth === lastWidth) return
      lastWidth = nextWidth
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
  }, [itemsLoading, selectedAgeRange, ownedGrouped, ownedCollapsed, resizeTick])

  // Total owned-item count for the whole household (across all age ranges)
  // for this baby — used to decide which empty state to show on the Owned
  // tab: "Start your inventory" when there's literally nothing, vs.
  // "Nothing in {range} yet" when other ranges have items.
  const totalOwnedCount = useMemo(
    () => babyFilteredItems.filter(i => i.inventory_status === 'owned').length,
    [babyFilteredItems],
  )

  // "All babies" view scales targets by baby count.
  const coverageBabyCount = selectedBabyId === 'all' ? Math.max(1, babies.length) : 1

  const ageInfo = useMemo(() => inferAgeRange(ageAnchor), [ageAnchor])

  // ── Prediction card state + data ───────────────────────────────────────
  // Persists open/collapsed across sessions. Defaults open so first-time
  // users see the full card without having to expand it.
  const [predictionOpen, setPredictionOpen] = useState(() => {
    try {
      const stored = localStorage.getItem('sprigloop_prediction_open')
      return stored === null ? true : stored === 'true'
    } catch {
      return true
    }
  })

  function togglePrediction() {
    setPredictionOpen(prev => {
      const next = !prev
      try { localStorage.setItem('sprigloop_prediction_open', String(next)) } catch {}
      return next
    })
  }

  const showPrediction = shouldShowPredictionCard(ageInfo)

  // Coverage for the prediction card's target size band:
  //   - Expecting babies:  0-3M (the first size they'll need)
  //   - Everyone else:     nextRange (the size they're growing into)
  // Only computed when the card will actually show.
  const predictionTargetRange = ageInfo.expecting ? AGE_RANGES[0] : ageInfo.nextRange
  const nextSizeCoverage = useMemo(() => {
    if (!showPrediction || !predictionTargetRange) return null
    const rows = computeCoverage(babyFilteredItems, predictionTargetRange, coverageBabyCount)
    let owned = 0
    let recommended = 0
    for (const row of rows) {
      owned += Math.min(row.ownedCount, row.recommended)
      recommended += row.recommended
    }
    return { owned, recommended }
  }, [showPrediction, predictionTargetRange, babyFilteredItems, coverageBabyCount])

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

  // Prediction card CTA — navigate to Plan filtered to the next size.
  function handlePredictionCta() {
    if (!ageInfo.nextRange) return
    track.gapAlertActioned?.({ from: ageInfo.currentRange, to: ageInfo.nextRange, source: 'prediction_card' })
    navigate(`/plan?size=${encodeURIComponent(ageInfo.nextRange)}`)
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {/* No back button — /inventory is the authed root; /home redirects
            here once the user has any items, and there's nowhere meaningful
            to navigate back to. Removed 2026-04-28 to give the title cell
            more breathing room on small phones (was wrapping to two lines
            at iPhone SE width because the back button + actions left only
            ~85px for the title). */}
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
            onClick={() => navigate('/add-item?autoScan=1')}
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

      {/* Prediction card removed — replaced by tracker widget on Home screen. */}
      {false && isClothing && showPrediction && (ageInfo.expecting || nextSizeCoverage) && (
        <div className={styles.predictionCard}>
          <button
            type="button"
            className={styles.predictionHeader}
            onClick={togglePrediction}
            aria-expanded={predictionOpen}
          >
            <Eyebrow color="teal">Coming up</Eyebrow>
            {!predictionOpen && (
              <span className={styles.predictionCollapsedSummary}>
                {ageInfo.expecting
                  ? `Due in ${formatTransitionEta(ageInfo.daysUntilDue)}`
                  : `${ageInfo.nextRange} in ${formatTransitionEta(ageInfo.daysToNextRange)}`
                }
              </span>
            )}
            <svg
              className={`${styles.predictionChevron} ${predictionOpen ? styles.predictionChevronOpen : ''}`}
              viewBox="0 0 12 12"
              width="12"
              height="12"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {predictionOpen && (
            <div className={styles.predictionBody}>
              {ageInfo.expecting ? (
                // ── Expecting countdown mode ──────────────────────────────
                <>
                  <p className={styles.predictionTitle}>
                    {ageAnchor?.name
                      ? `${ageAnchor.name} arrives in ${formatTransitionEta(ageInfo.daysUntilDue)}!`
                      : `Your baby arrives in ${formatTransitionEta(ageInfo.daysUntilDue)}!`
                    }
                  </p>
                  <p className={styles.predictionSub}>
                    {nextSizeCoverage && nextSizeCoverage.owned < nextSizeCoverage.recommended
                      ? `You have ${nextSizeCoverage.owned} of ${nextSizeCoverage.recommended} recommended 0–3M items — still time to fill the gaps.`
                      : `Your 0–3M wardrobe is looking good — ready for the big day!`
                    }
                  </p>
                  {nextSizeCoverage && nextSizeCoverage.recommended > 0 && (
                    <div className={styles.predictionProgressWrap} aria-label={`${nextSizeCoverage.owned} of ${nextSizeCoverage.recommended} items for 0-3M`}>
                      <div
                        className={styles.predictionProgressFill}
                        style={{ width: `${Math.min(100, Math.round((nextSizeCoverage.owned / nextSizeCoverage.recommended) * 100))}%` }}
                      />
                    </div>
                  )}
                  {nextSizeCoverage && nextSizeCoverage.owned < nextSizeCoverage.recommended && (
                    <button
                      type="button"
                      className={styles.predictionCta}
                      onClick={handlePredictionCta}
                    >
                      See what you still need
                    </button>
                  )}
                </>
              ) : (
                // ── Normal next-size prediction mode ─────────────────────
                <>
                  <p className={styles.predictionTitle}>
                    {ageAnchor?.name ? `${ageAnchor.name} will likely reach ${ageInfo.nextRange}` : `Next size: ${ageInfo.nextRange}`}
                    {' '}
                    <span className={styles.predictionEta}>
                      in {formatTransitionEta(ageInfo.daysToNextRange)}
                    </span>
                  </p>
                  <p className={styles.predictionSub}>
                    {nextSizeCoverage.owned === nextSizeCoverage.recommended
                      ? `You're all set for ${ageInfo.nextRange}.`
                      : `You have ${nextSizeCoverage.owned} of ${nextSizeCoverage.recommended} recommended items for that size.`
                    }
                  </p>

                  {nextSizeCoverage.recommended > 0 && (
                    <div className={styles.predictionProgressWrap} aria-label={`${nextSizeCoverage.owned} of ${nextSizeCoverage.recommended} items for ${ageInfo.nextRange}`}>
                      <div
                        className={styles.predictionProgressFill}
                        style={{ width: `${Math.min(100, Math.round((nextSizeCoverage.owned / nextSizeCoverage.recommended) * 100))}%` }}
                      />
                    </div>
                  )}

                  {nextSizeCoverage.owned < nextSizeCoverage.recommended && (
                    <button
                      type="button"
                      className={styles.predictionCta}
                      onClick={handlePredictionCta}
                    >
                      See what's missing
                    </button>
                  )}

                  {/* Nudge to record the real DOB once the due date has passed. */}
                  {ageInfo.usingDueDateAsFallback && (
                    <button
                      type="button"
                      className={styles.predictionDobNudge}
                      onClick={() => navigate('/profile')}
                    >
                      {ageAnchor?.name ? `${ageAnchor.name} here yet?` : 'Baby here yet?'} Update their birthday in Profile →
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Category selector — horizontal scroll row (mobile) */}
      <div className={styles.catRow}>
        {INVENTORY_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            className={`${styles.catChip} ${selectedTopCategory === cat.id ? styles.catChipActive : ''}`}
            onClick={() => setSelectedTopCategory(cat.id)}
            aria-label={cat.label}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Desktop two-column layout */}
      <div className={styles.desktopLayout}>
        {/* Left: persistent category sidebar (desktop only) */}
        <aside className={styles.catSidebar} aria-label="Category">
          <div className={styles.catSidebarLabel}>Category</div>
          {INVENTORY_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.catSidebarItem} ${selectedTopCategory === cat.id ? styles.catSidebarItemActive : ''}`}
              onClick={() => setSelectedTopCategory(cat.id)}
              aria-label={cat.label}
            >
              <span className={styles.catSidebarIcon}><cat.icon /></span>
              <span className={styles.catSidebarText}>{cat.label}</span>
            </button>
          ))}
        </aside>

      <main className={styles.body}>
        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && error && (
          <div className={styles.error}>
            Couldn't load your inventory: {error}
          </div>
        )}

        {/* ── Owned tab ─────────────────────────────────────────── */}
        {!loading && !error && (
          <>

            {isClothing && selectedAgeRange && (
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
                  navigate(`/add-item?autoScan=1&mode=owned&size=${encodeURIComponent(selectedAgeRange)}`)
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
                    <div className={styles.itemCardGrid} id={id}>
                      {group.items.map(it => (
                        <ItemCard
                          key={it.id}
                          item={it}
                          onClick={() => navigate(`/item/${it.id}`)}
                          onPassOn={handlePassOn}
                          onTuckAway={handleTuckAway}
                          working={pendingHideIds.has(it.id)}
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
                    navigate(`/add-item?autoScan=1&mode=owned&size=${encodeURIComponent(selectedAgeRange)}`)
                  }
                >
                  + Add item in {selectedAgeRange}
                </button>
              </>
            )}

            {/* ── Outgrown section ─────────────────────────────────────
                Bottom-of-Owned umbrella for items the household has moved
                out of active rotation. Renders 'kept', 'pass_along', and
                legacy 'outgrown' rows together; per-row chip indicates
                intent (Tuck away / Pass on / arrow into bag). Section
                header is a collapsible button — collapsed by default so
                the active inventory above it stays the focus, count
                visible so the user knows there's stuff to look at. */}
            {outgrownSectionItems.length > 0 && (
              <section
                className={`${styles.group} ${styles.outgrownSection}`}
                aria-label="Outgrown"
              >
                {/* No eyebrow above this section — the GroupHeader's
                    "Outgrown" title already carries the category label;
                    a pill that also said "Outgrown" was redundant
                    (removed 2026-05-01 same day it shipped). */}
                <GroupHeader
                  title="Outgrown"
                  meta={`${outgrownSectionItems.length} ${pluralize(outgrownSectionItems.length, 'item')}`}
                  collapsed={outgrownSectionCollapsed}
                  onToggle={() => setOutgrownSectionCollapsed(s => !s)}
                  contentId="outgrown-section"
                />
                {!outgrownSectionCollapsed && (
                  <div id="outgrown-section">
                    {outgrownSectionGrouped.map(group => (
                      <div className={styles.outgrownCategoryGroup} key={group.category}>
                        <div className={styles.outgrownCategoryLabel}>
                          {CATEGORY_LABELS[group.category] || group.category}
                          <span className={styles.outgrownCategoryCount}>
                            {group.items.length}
                          </span>
                        </div>
                        <div className={styles.outgrownCategoryCardGrid}>
                          {group.items.map(it => (
                            <SectionItemCard
                              key={it.id}
                              item={it}
                              onClick={() => navigate(`/item/${it.id}`)}
                              onPassOnChip={() => handleSectionChipTap(it)}
                              onMoveBackChip={() => handleSectionMoveBack(it)}
                              working={pendingHideIds.has(it.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
              </>
            )}

            {!isClothing && (
              <>
                {catOwnedGrouped.length === 0 && (
                  <div className={styles.empty}>
                    <div className={styles.emptyTitle}>Nothing here yet</div>
                    <div className={styles.emptyBody}>
                      Start by adding something you already have for this category.
                    </div>
                    <button
                      type="button"
                      className={styles.emptyCta}
                      onClick={() => navigate(`/add-item?category=${selectedTopCategory}`)}
                    >
                      Add first item
                    </button>
                  </div>
                )}
                {catOwnedGrouped.map(group => {
                  const catGroupCollapsed = catCollapsed.has(group.subCat)
                  const catGroupId = `cat-${group.subCat}`
                  return (
                    <section className={styles.group} key={group.subCat}>
                      <GroupHeader
                        title={SUB_CATEGORY_LABELS[group.subCat] || group.subCat}
                        meta={`${group.items.length} ${pluralize(group.items.length, 'item')}`}
                        collapsed={catGroupCollapsed}
                        onToggle={() => toggleCatGroup(group.subCat)}
                        contentId={catGroupId}
                      />
                      {!catGroupCollapsed && (
                        <div className={styles.itemCardGrid} id={catGroupId}>
                          {group.items.map(it => (
                            <CatItemCard
                              key={it.id}
                              item={it}
                              onClick={() => navigate(`/item/${it.id}`)}
                              onTuckAway={handleTuckAway}
                              working={pendingHideIds.has(it.id)}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
                {catOwnedGrouped.length > 0 && (
                  <button
                    type="button"
                    className={styles.addMoreBtn}
                    onClick={() => navigate(`/add-item?category=${selectedTopCategory}`)}
                  >
                    + Add item
                  </button>
                )}
                {catOutgrownItems.length > 0 && (
                  <section
                    className={`${styles.group} ${styles.outgrownSection}`}
                    aria-label="Tucked away"
                  >
                    <GroupHeader
                      title="Tucked away"
                      meta={`${catOutgrownItems.length} ${pluralize(catOutgrownItems.length, 'item')}`}
                      collapsed={outgrownSectionCollapsed}
                      onToggle={() => setOutgrownSectionCollapsed(s => !s)}
                      contentId="cat-outgrown-section"
                    />
                    {!outgrownSectionCollapsed && (
                      <div id="cat-outgrown-section" className={styles.itemCardGrid}>
                        {catOutgrownItems.map(it => (
                          <CatItemCard
                            key={it.id}
                            item={it}
                            onClick={() => navigate(`/item/${it.id}`)}
                            onMoveBack={handleSectionMoveBack}
                            working={pendingHideIds.has(it.id)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

      </main>
      </div>{/* end desktopLayout */}

      <BottomNav />

      {/* Action toast — fixed-positioned at the bottom of the viewport,
          auto-dismisses after 5s (handled by the effect on actionToast).
          Two flavors based on actionToast.kind:
            - 'pass_on'   → "Added to your bag" + "View bag" + Undo
            - 'tuck_away' → "Tucked away" + Undo
          The Undo button reverts the optimistic flip and fires a DB write
          to restore inventory_status='owned' (also detaches from the bag
          if the action was Pass on). Rendered at the page level so it
          stays put while the list scrolls underneath. */}
      {actionToast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastBody}>
            {actionToast.kind === 'pass_on' ? (
              <>Added <strong>{actionToast.name}</strong> to your bag</>
            ) : (
              <>Tucked <strong>{actionToast.name}</strong> away</>
            )}
          </span>
          {actionToast.kind === 'pass_on' && (
            <button
              type="button"
              className={styles.toastPrimary}
              onClick={handleViewBagFromToast}
            >
              View bag →
            </button>
          )}
          <button
            type="button"
            className={styles.toastUndo}
            onClick={handleUndoToast}
          >
            Undo
          </button>
        </div>
      )}
    </div>
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

// ── Item card (Owned tab) ──────────────────────────────────────────────────
// Photo-forward card replacing the old ItemRow. The card's square photo area
// shows the garment image when available, or a teal placeholder with the size
// label centered. Action chips (Pass on, Tuck away) sit in the footer row.
// Tap anywhere except the chips opens ItemDetail.
function ItemCard({ item, onClick, onPassOn, onTuckAway, working }) {
  const sizeLabel = item.size_label || ''
  const display = buildItemDisplay(item)

  return (
    <button
      type="button"
      className={styles.itemCard}
      onClick={onClick}
      aria-label={`Open ${display.primary}`}
    >
      <div className={styles.itemCardPhotoWrap} aria-hidden="true">
        {item.garment_signed_url ? (
          <>
            <img
              src={item.garment_signed_url}
              alt=""
              className={styles.itemCardPhoto}
              loading="lazy"
            />
            {sizeLabel && (
              <span className={styles.itemCardSizeBadge}>{sizeLabel}</span>
            )}
          </>
        ) : (
          <div className={styles.itemCardPlaceholder}>
            <span className={styles.itemCardSizeCentered}>
              {sizeLabel || '—'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.itemCardBody}>
        <div className={styles.itemCardName}>{display.primary}</div>
        {display.meta && (
          <div className={styles.itemCardMeta}>{display.meta}</div>
        )}
        <div className={styles.itemCardFooter}>
          {item.quantity > 1 && (
            <span className={styles.itemCardQty}>×{item.quantity}</span>
          )}
          {onPassOn && (
            <button
              type="button"
              className={styles.itemCardPassBtn}
              onClick={e => { e.stopPropagation(); onPassOn(item) }}
              disabled={working}
              aria-label={`Pass on ${display.primary}`}
            >
              Pass on
            </button>
          )}
          {onTuckAway && (
            <button
              type="button"
              className={styles.itemCardTuckBtn}
              onClick={e => { e.stopPropagation(); onTuckAway(item) }}
              disabled={working}
              aria-label={`Tuck away ${display.primary}`}
            >
              Tuck away
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Section item card (bottom-of-Owned Outgrown section) ──────────────────
// Card version of the outgrown section item. Same photo-forward layout as
// ItemCard; chips are Pass on + Move back (no Tuck away — kept in ItemDetail).
function SectionItemCard({ item, onClick, onPassOnChip, onMoveBackChip, working }) {
  const display = buildItemDisplay(item)
  const sizeLabel = item.size_label || ''
  const isInBag = item.inventory_status === 'pass_along'

  return (
    <button
      type="button"
      className={styles.itemCard}
      onClick={onClick}
      aria-label={`Open ${display.primary}`}
    >
      <div className={styles.itemCardPhotoWrap} aria-hidden="true">
        {item.garment_signed_url ? (
          <>
            <img
              src={item.garment_signed_url}
              alt=""
              className={styles.itemCardPhoto}
              loading="lazy"
            />
            {sizeLabel && (
              <span className={styles.itemCardSizeBadge}>{sizeLabel}</span>
            )}
          </>
        ) : (
          <div className={styles.itemCardPlaceholder}>
            <span className={styles.itemCardSizeCentered}>
              {sizeLabel || '—'}
            </span>
          </div>
        )}
      </div>

      <div className={styles.itemCardBody}>
        <div className={styles.itemCardName}>{display.primary}</div>
        {display.meta && (
          <div className={styles.itemCardMeta}>{display.meta}</div>
        )}
        <div className={styles.itemCardFooter}>
          {item.quantity > 1 && (
            <span className={styles.itemCardQty}>×{item.quantity}</span>
          )}
          <button
            type="button"
            className={styles.itemCardPassBtn}
            onClick={e => { e.stopPropagation(); onPassOnChip() }}
            disabled={working}
            aria-label={isInBag ? `View bag for ${display.primary}` : `Pass on ${display.primary}`}
          >
            {isInBag ? 'In bag →' : 'Pass on'}
          </button>
          <button
            type="button"
            className={styles.itemCardMoveBackBtn}
            onClick={e => { e.stopPropagation(); onMoveBackChip() }}
            disabled={working}
            aria-label={`Move ${display.primary} back to Owned`}
          >
            Move back
          </button>
        </div>
      </div>
    </button>
  )
}

function humanizeItemType(s) {
  if (!s) return 'Item'
  return s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

// ── Category nav icons ────────────────────────────────────────────────────
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

const INVENTORY_CATEGORIES = [
  { id: 'clothing',  label: 'Clothing',  icon: ClothingNavIcon },
  { id: 'sleep',     label: 'Sleep',     icon: SleepNavIcon },
  { id: 'feeding',   label: 'Feeding',   icon: FeedingNavIcon },
  { id: 'diapering', label: 'Diapering', icon: DiaperNavIcon },
  { id: 'travel',    label: 'Travel',    icon: TravelNavIcon },
  { id: 'play',      label: 'Play',      icon: PlayNavIcon },
  { id: 'health',    label: 'Health',    icon: HealthNavIcon },
  { id: 'bath',      label: 'Bath',      icon: BathNavIcon },
]

// ── Non-clothing item card ────────────────────────────────────────────────
// Simpler card for beta.items rows — no garment photo, no Pass on action
// (pass-along is clothing-only for now). Tuck away moves to 'kept'; Move
// back restores to 'owned' (used in the Tucked away section).
function CatItemCard({ item, onClick, onTuckAway, onMoveBack, working }) {
  const slot = ITEM_BY_ID[item.item_type]
  const primary = item.name || item.brand || slot?.singular || slot?.label || humanizeItemType(item.item_type)
  const metaParts = []
  if (item.name && item.brand) metaParts.push(item.brand)
  if (item.condition) metaParts.push(CONDITION_LABEL[item.condition] || item.condition)
  const meta = metaParts.slice(0, 2).join(' · ')

  return (
    <button
      type="button"
      className={styles.itemCard}
      onClick={onClick}
      aria-label={`Open ${primary}`}
    >
      <div className={styles.itemCardPhotoWrap} aria-hidden="true">
        <div className={styles.itemCardPlaceholder}>
          <span className={styles.itemCardSizeCentered}>
            {item.quantity > 1 ? `×${item.quantity}` : '—'}
          </span>
        </div>
      </div>
      <div className={styles.itemCardBody}>
        <div className={styles.itemCardName}>{primary}</div>
        {meta && <div className={styles.itemCardMeta}>{meta}</div>}
        <div className={styles.itemCardFooter}>
          {item.quantity > 1 && (
            <span className={styles.itemCardQty}>×{item.quantity}</span>
          )}
          {onTuckAway && (
            <button
              type="button"
              className={styles.itemCardTuckBtn}
              onClick={e => { e.stopPropagation(); onTuckAway(item) }}
              disabled={working}
              aria-label={`Tuck away ${primary}`}
            >
              Tuck away
            </button>
          )}
          {onMoveBack && (
            <button
              type="button"
              className={styles.itemCardMoveBackBtn}
              onClick={e => { e.stopPropagation(); onMoveBack(item) }}
              disabled={working}
              aria-label={`Move ${primary} back to Owned`}
            >
              Move back
            </button>
          )}
        </div>
      </div>
    </button>
  )
}
