import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useHousehold, matchesBabyFilter } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import {
  AGE_RANGES,
  CATEGORY_LABELS,
  SLOT_BY_ID,
  computeCoverage,
  otherWishes,
  inferAgeRange,
  shouldShowOutgrowBanner,
  pluralize,
} from '../lib/wardrobe'
import ProfileMenu from '../components/ProfileMenu'
import IvySprig from '../components/IvySprig'
import BabySwitcher from '../components/BabySwitcher'
import Eyebrow from '../components/Eyebrow'
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

const PRIORITY_LABEL = {
  must_have: 'Must have',
  nice_to_have: 'Nice to have',
  low_priority: 'Low priority',
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
      return { error: 'Couldn’t start a bag — household not loaded.' }
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
      return { error: `Couldn’t find a draft bag: ${findErr.message}` }
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
      return { error: `Couldn’t start a bag: ${insErr?.message ?? 'unknown'}` }
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
      setError(`Couldn’t add ${name} to the bag: ${attachErr.message}`)
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
    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({ inventory_status: 'kept' })
      .eq('id', item.id)

    if (updErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn’t tuck away ${name}: ${updErr.message}`)
      return
    }

    track.itemTuckedAway?.({ id: item.id, from })

    setActionToast({
      kind: 'tuck_away',
      id: item.id,
      name: item.name || humanizeItemType(item.item_type),
      prevStatus,
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
    const { kind, id, name, prevStatus } = actionToast
    const restoreStatus = prevStatus || 'owned'

    setPendingHideIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setActionToast(null)

    const update = kind === 'pass_on'
      ? {
          inventory_status: restoreStatus,
          pass_along_batch_id: null,
          pre_bag_inventory_status: null,
        }
      : { inventory_status: restoreStatus }

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update(update)
      .eq('id', id)

    if (updErr) {
      setError(`Couldn’t undo for ${name}: ${updErr.message}`)
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

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        inventory_status: 'kept',
        pass_along_batch_id: null,
        pre_bag_inventory_status: null,
      })
      .eq('id', item.id)

    if (updErr) {
      setPendingHideIds(prev => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      const name = item.name || humanizeItemType(item.item_type)
      setError(`Couldn’t tuck away ${name}: ${updErr.message}`)
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

    const { error: updErr } = await supabase
      .schema(currentSchema)
      .from('clothing_items')
      .update({
        inventory_status: 'owned',
        pass_along_batch_id: null,
        pre_bag_inventory_status: null,
      })
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

  // Outgrown section (bottom of Owned tab). Default-collapsed: the
  // section's whole point is to stay out of the way of the active
  // inventory until the user opts in. Header surfaces the count so the
  // user knows there's stuff there even when the body is hidden.
  const [outgrownSectionCollapsed, setOutgrownSectionCollapsed] = useState(true)

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

  // Outgrown section pool — items the household has moved out of active
  // rotation, regardless of intent: 'kept' (tucked away), 'pass_along'
  // (in a bag), or legacy 'outgrown' (pre-redesign transient state).
  // Filtered through the baby selector so the section header count
  // reflects what the user is currently scoping to. Excludes items in
  // pendingHideIds so an optimistic flip doesn't briefly show the same
  // row in both Owned and the Outgrown section while the DB resolves.
  const outgrownSectionItems = useMemo(
    () => babyFilteredItems.filter(i =>
      (i.inventory_status === 'kept' ||
        i.inventory_status === 'pass_along' ||
        i.inventory_status === 'outgrown') &&
      !pendingHideIds.has(i.id)
    ),
    [babyFilteredItems, pendingHideIds],
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
  // "All babies" view scales targets by baby count — each baby will pass
  // through the size band, so 2 babies need 2x bodysuits etc. Single-baby
  // views (or households with one baby) leave it at 1x.
  const coverageBabyCount = selectedBabyId === 'all' ? Math.max(1, babies.length) : 1

  const coverage = useMemo(() => {
    if (!selectedAgeRange) return []
    return computeCoverage(babyFilteredItems, selectedAgeRange, coverageBabyCount)
  }, [babyFilteredItems, selectedAgeRange, coverageBabyCount])

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
                    navigate(`/add-item?mode=owned&size=${encodeURIComponent(selectedAgeRange)}`)
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

      {/* Coverage summary header — eyebrow pill replaces the DM Sans title
          to mirror the section-opener motif from the landing (added
          2026-05-01). */}
      <div className={styles.sectionHead}>
        <Eyebrow color="teal">Recommended wardrobe</Eyebrow>
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
              <div className={styles.slotCardGrid} id={id}>
                {group.rows.map(row => (
                  <SlotCard
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

// ── Slot card (Wishlist tab) ───────────────────────────────────────────────
// Photo-forward card counterpart to SlotRow. Renders inside a .slotCardGrid
// so the Wishlist tab mirrors the card-grid look of the Owned tab.
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
