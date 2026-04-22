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
// The selection is persisted to localStorage under `ll_baby_id_<household_id>`
// so it also survives a full page reload. If the stored id doesn't match a
// baby in the current list (baby removed on another device, household
// swapped) we fall back to 'all'.
//
// Semantics of selectedBabyId:
//   'all'    — no baby filter; show everything in the household.
//   '<uuid>' — filter to this baby OR any item with null baby_id (shared /
//              hand-me-downs / pre-arrival items). Rationale lives next to
//              the filter call sites.
//
// With exactly one baby we force selectedBabyId to that baby's id regardless
// of what's in localStorage — the switcher UI doesn't render in that case,
// so exposing 'all' would just be a silent footgun for downstream filters.

const HouseholdContext = createContext(null)

const STORAGE_PREFIX = 'll_baby_id_'

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
    }),
    [household, babies, selectedBabyId, setSelectedBabyId, currentBaby, loading, error, load],
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
// assigned (hand-me-downs from a sibling, gifts for the next one on the way,
// etc.) and are available to wear for any of them.
export function matchesBabyFilter(item, selectedBabyId) {
  if (!selectedBabyId || selectedBabyId === 'all') return true
  return item.baby_id === selectedBabyId || item.baby_id == null
}
