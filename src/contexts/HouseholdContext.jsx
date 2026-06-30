import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// HouseholdContext is the single source of truth for:
//   - which household the user is acting in
//   - the babies that belong to it
//   - which baby (if any) is currently "in focus" — the chip switcher state
//
// Before this existed, Home / Inventory / SlotDetail / AddItem each re-ran
// the same household_members → households → babies query on mount. That
// was fine with one baby, but multi-baby introduces a shared selection —
// the user picks "Roo" in Inventory and expects AddItem to default to Roo
// when they hit +. Pushing that into a context means we load babies once
// and the selection survives navigation without a round-trip.
//
// The selection is persisted to localStorage under `sl_baby_id_<household_id>`
// so it also survives a full page reload. If the stored id doesn't match a
// baby in the current list (baby removed on another device, household
// swapped) we fall back to 'all'. (Pre-2026-05-05 the prefix was `ll_baby_id_`;
// renamed for the Sprigloop brand. Existing values under the old prefix get
// abandoned and the user defaults to 'all' on first visit post-deploy.)
//
// Semantics of selectedBabyId:
//   'all'    — no baby filter; show everything in the household.
//   '<uuid>' — filter to this baby OR any item with null baby_id (shared
//              items, outgrown clothes from family or friends, pre-arrival
//              items). Rationale lives next to the filter call sites.
//
// With exactly one baby we force selectedBabyId to that baby's id regardless
// of what's in localStorage — the switcher UI doesn't render in that case,
// so exposing 'all' would just be a silent footgun for downstream filters.

const HouseholdContext = createContext(null)

const STORAGE_PREFIX = 'sl_baby_id_'

function storageKey(householdId) {
  return `${STORAGE_PREFIX}${householdId}`
}

function readStored(householdId) {
  if (!householdId) return null
  try {
    return window.localStorage.getItem(storageKey(householdId))
  } catch {
    // SSR, private mode, quota — any of these should degrade silently to
    // an unselected state rather than crash the provider.
    return null
  }
}

function writeStored(householdId, value) {
  if (!householdId) return
  try {
    window.localStorage.setItem(storageKey(householdId), value)
  } catch {
    // Same reasoning as readStored — selection persistence is nice-to-have,
    // not load-bearing.
  }
}

export function HouseholdProvider({ children }) {
  const { user } = useAuth()

  const [household, setHousehold] = useState(null)
  const [babies, setBabies] = useState([])
  // Selection is 'all' | <uuid>. Starts as null while we wait for babies
  // to load so consumers can distinguish "no selection yet" from "all".
  const [selectedBabyId, setSelectedBabyIdState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Items (clothing_items) ──────────────────────────────────────────────
  // Hoisted into the provider so navigating between Inventory and Home no
  // longer triggers a per-mount refetch flicker (previously Inventory.jsx
  // owned this and re-queried on every mount). Writes live where they
  // already do (AddItem, ItemDetail, PassAlongBatch); each write site calls
  // reloadItems() after a successful mutation to pull the fresh list back.
  //
  // itemsLoading is true only on the very first fetch for a given
  // household — subsequent refreshes keep the previous list visible while
  // the new data arrives, which is what kills the flicker. Error surfaces
  // separately from household error so consumers can distinguish the two.
  const [items, setItems] = useState([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState(null)
  const [itemsLoadedFor, setItemsLoadedFor] = useState(null) // household.id we last fetched for

  // ── Load household + babies ─────────────────────────────────────────────
  // Runs whenever the auth'd user changes. We intentionally do NOT re-run
  // on route change — the context's whole value prop is that it survives
  // navigation without refetching.
  const load = useCallback(async () => {
    if (!user) {
      setHousehold(null)
      setBabies([])
      setSelectedBabyIdState(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Most-recent household the user belongs to. Multi-household support
    // (a user belonging to, say, their own family and a co-parenting
    // household) is out of scope for MVP — we pick the most recent join.
    const { data: memberships, error: memErr } = await supabase
      .schema(currentSchema)
      .from('household_members')
      .select('household_id, households(id, name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1)

    if (memErr) {
      setError(memErr.message)
      setLoading(false)
      return
    }

    const h = memberships?.[0]?.households ?? null
    if (!h) {
      // Pre-onboarding user — no household yet. Consumers should render
      // their own loading/empty affordances rather than rely on this.
      setHousehold(null)
      setBabies([])
      setSelectedBabyIdState(null)
      setLoading(false)
      return
    }

    const { data: babyRows, error: babyErr } = await supabase
      .schema(currentSchema)
      .from('babies')
      .select('id, name, date_of_birth, due_date, size_mode, gender, household_id, age_range_override, created_at')
      .eq('household_id', h.id)
      .order('created_at', { ascending: true })

    if (babyErr) {
      setError(babyErr.message)
      setHousehold(h)
      setBabies([])
      setSelectedBabyIdState(null)
      setLoading(false)
      return
    }

    const rows = babyRows || []
    setHousehold(h)
    setBabies(rows)

    // Reconcile the stored selection with the current baby list.
    if (rows.length === 0) {
      setSelectedBabyIdState(null)
    } else if (rows.length === 1) {
      // Force single-baby households to the one baby. Even if localStorage
      // has 'all' from a pre-removal state, we want inserts to tie to the
      // remaining baby rather than silently go null.
      setSelectedBabyIdState(rows[0].id)
    } else {
      const stored = readStored(h.id)
      const isValid =
        stored === 'all' || rows.some(b => b.id === stored)
      setSelectedBabyIdState(isValid ? stored : 'all')
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  // ── Items loader ───────────────────────────────────────────────────────
  // Fetches BOTH clothing_items and beta.items for the household in parallel,
  // stamps top_category='clothing' on clothing rows, then merges into a single
  // items array sorted by created_at descending.
  //
  // Consumers use item.top_category to distinguish clothing from other
  // categories. All existing code that reads category/size_label/etc. still
  // works — those fields only exist on clothing rows, which is correct.
  //
  // Signed photo URLs are resolved for clothing items only (beta.items has no
  // photo column yet).
  const [refreshCounter, setRefreshCounter] = useState(0)

  useEffect(() => {
    if (!user || !household?.id) {
      setItems([])
      setItemsLoading(false)
      setItemsError(null)
      setItemsLoadedFor(null)
      return
    }
    let cancelled = false

    async function loadItems() {
      const isFirstFetch = itemsLoadedFor !== household.id
      if (isFirstFetch) setItemsLoading(true)
      setItemsError(null)

      // Fetch both tables in parallel
      const [clothingResult, categoryResult] = await Promise.all([
        supabase
          .schema(currentSchema)
          .from('clothing_items')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
        supabase
          .schema(currentSchema)
          .from('items')
          .select('*')
          .eq('household_id', household.id)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      if (clothingResult.error) {
        setItemsError(clothingResult.error.message)
        if (isFirstFetch) setItemsLoading(false)
        return
      }
      if (categoryResult.error) {
        setItemsError(categoryResult.error.message)
        if (isFirstFetch) setItemsLoading(false)
        return
      }

      // Resolve signed photo URLs for all items that have a photo path.
      // Both clothing_items (garment_photo_path) and beta.items (item_photo_path)
      // store paths in the same 'garment-photos' bucket. Batch all paths in one
      // createSignedUrls call to avoid two round-trips. URLs expire after 1 hour.
      const clothingRows = clothingResult.data || []
      const categoryRows = categoryResult.data || []

      const allPhotoPaths = [
        ...clothingRows.map(r => r.garment_photo_path),
        ...categoryRows.map(r => r.item_photo_path),
      ].filter(Boolean)

      let urlByPath = new Map()
      if (allPhotoPaths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('garment-photos')
          .createSignedUrls(allPhotoPaths, 60 * 60)
        if (Array.isArray(signed)) {
          for (const s of signed) {
            if (s?.path && s?.signedUrl && !s?.error) {
              urlByPath.set(s.path, s.signedUrl)
            }
          }
        }
      }

      // Stamp top_category='clothing' on all clothing rows so downstream
      // consumers can tell them apart from category items without table-name
      // knowledge. Also attach signed URLs where available.
      const clothingWithMeta = clothingRows.map(r => ({
        ...r,
        top_category: 'clothing',
        ...(r.garment_photo_path
          ? { garment_signed_url: urlByPath.get(r.garment_photo_path) || null }
          : {}),
      }))

      // Category items (beta.items) already have top_category set.
      // Attach signed URLs for any that have item_photo_path.
      const categoryWithMeta = categoryRows.map(r => ({
        ...r,
        ...(r.item_photo_path
          ? { item_photo_signed_url: urlByPath.get(r.item_photo_path) || null }
          : {}),
      }))

      // Merge and sort by created_at descending
      const merged = [...clothingWithMeta, ...categoryWithMeta].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      )

      if (cancelled) return
      setItems(merged)
      setItemsLoadedFor(household.id)
      if (isFirstFetch) setItemsLoading(false)
    }

    loadItems()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, household?.id, refreshCounter])

  const reloadItems = useCallback(() => {
    setRefreshCounter(c => c + 1)
  }, [])

  // Reload items when the app comes back to the foreground so changes made
  // by another household member on a different device show up immediately.
  // Two signals cover both web and native:
  //   - visibilitychange: fires when switching browser tabs or the iOS app
  //     goes background/foreground in a WKWebView.
  //   - Capacitor App 'appStateChange': fires on native iOS foreground
  //     transitions more reliably than visibilitychange in some WKWebView
  //     configurations (e.g. when the OS suspends the web view).
  useEffect(() => {
    if (!user || !household?.id) return

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setRefreshCounter(c => c + 1)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user, household?.id])

  // Public setter — also writes to localStorage so a reload restores the
  // selection. Swallows invalid ids (any uuid not in the current list)
  // rather than silently accepting them.
  const setSelectedBabyId = useCallback(
    (value) => {
      if (!household) return
      const isValid =
        value === 'all' ||
        (typeof value === 'string' && babies.some(b => b.id === value))
      if (!isValid) return
      setSelectedBabyIdState(value)
      writeStored(household.id, value)
    },
    [household, babies],
  )

  // Derived: the baby row corresponding to the current selection, or null
  // when 'all' / no babies. Callers that want a "display anchor" for things
  // like age-range inference should fall back to babies[0] themselves —
  // this stays strictly about the selection.
  const currentBaby = useMemo(() => {
    if (!selectedBabyId || selectedBabyId === 'all') return null
    return babies.find(b => b.id === selectedBabyId) ?? null
  }, [babies, selectedBabyId])

  const value = useMemo(
    () => ({
      household,
      babies,
      selectedBabyId,
      setSelectedBabyId,
      currentBaby,
      loading,
      error,
      refresh: load,
      // Items (hoisted — see the items-loader effect above for rationale)
      items,
      itemsLoading,
      itemsError,
      reloadItems,
    }),
    [
      household, babies, selectedBabyId, setSelectedBabyId, currentBaby,
      loading, error, load,
      items, itemsLoading, itemsError, reloadItems,
    ],
  )

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) {
    throw new Error('useHousehold must be used inside <HouseholdProvider>')
  }
  return ctx
}

// Helper for callers that need the "this baby OR shared/unassigned" filter.
// Kept here so every screen agrees on the shared-item semantic — items with
// null baby_id show under every specific baby because they're not yet
// assigned (outgrown clothes from a sibling, gifts for the next one on the way,
// etc.) and are available to wear for any of them.
export function matchesBabyFilter(item, selectedBabyId) {
  if (!selectedBabyId || selectedBabyId === 'all') return true
  return item.baby_id === selectedBabyId || item.baby_id == null
}
