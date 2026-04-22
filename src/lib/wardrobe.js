// Wardrobe taxonomy + coverage computation.
//
// The Wish list tab shows a "recommended wardrobe" view: for each age range,
// a list of canonical *slots* (functional groupings — Pajamas, Bodysuits,
// Pants, Socks…), each with a recommended quantity, rendered as a progress
// bar against what's in Owned.
//
// This file is the source of truth for:
//   - the 6 age ranges we support (matches AddItem's SIZES)
//   - the 17 canonical slots + their metadata
//   - keyword rules that map free-text `item_type` from the DB onto a slot
//   - recommended quantities per (slot, age_range)
//   - pure compute helpers used by Inventory + SlotDetail
//
// Everything here is deliberately pure (no React, no supabase). Makes it easy
// to unit-test and to iterate on the recommendation numbers without touching
// UI code.

// ── Age ranges ─────────────────────────────────────────────────────────────
// Must match SIZES in AddItem.jsx. Kept in-order from youngest to oldest.
export const AGE_RANGES = ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M']

// Approximate month boundaries for each range — used to infer current age
// range from DOB and to estimate days until the next transition. These are
// intentionally simple (calendar-age, not growth-chart based); size_mode is
// captured during onboarding but we don't have weight/height data to use yet.
const AGE_RANGE_BOUNDS_MONTHS = {
  '0-3M':   { minMonths: 0,  maxMonths: 3 },
  '3-6M':   { minMonths: 3,  maxMonths: 6 },
  '6-9M':   { minMonths: 6,  maxMonths: 9 },
  '9-12M':  { minMonths: 9,  maxMonths: 12 },
  '12-18M': { minMonths: 12, maxMonths: 18 },
  '18-24M': { minMonths: 18, maxMonths: 24 },
}

// ── Category labels ────────────────────────────────────────────────────────
// Shared between Inventory (owned tab) and SlotDetail. Keeps the single source
// of truth for category copy here instead of duplicating the map.
export const CATEGORY_LABELS = {
  tops_and_bodysuits: 'Tops and bodysuits',
  one_pieces: 'One-pieces',
  bottoms: 'Bottoms',
  dresses_and_skirts: 'Dresses and skirts',
  outerwear: 'Outerwear',
  sleepwear: 'Sleepwear',
  footwear: 'Footwear',
  accessories: 'Accessories',
  swimwear: 'Swimwear',
}

// ── Slot taxonomy ──────────────────────────────────────────────────────────
// Each slot is a *functional group* of clothing items. A slot rolls up one or
// more free-text `item_type` values by matching keywords against the
// normalized item_type string.
//
// Schema:
//   id:            stable identifier used in URLs and snapshots
//   label:         display name
//   category:      one of the 9 top-level categories (for filtering + routing)
//   keywords:      list of substrings; an item_type matches the slot if it
//                  contains ANY keyword (after lowercasing + underscore split)
//   fallback:      if true, this slot catches items of its category that didn't
//                  match any other slot's keywords (e.g. a generic "t-shirt"
//                  falls into Day tops)
//   hint:          short helper text shown under the row on Wish list
//   recommended:   flat default quantity, may be overridden per age below
//   perAge:        partial override { '0-3M': 10, '3-6M': 7, ... }
//
// Ordering matters: SLOTS is evaluated in order when mapping an item to a slot,
// so more-specific slots come before fallbacks in the same category.
export const SLOTS = [
  // ── Tops and bodysuits ────────────────────────────────────────────────
  {
    id: 'bodysuits',
    label: 'Bodysuits',
    category: 'tops_and_bodysuits',
    keywords: ['bodysuit', 'onesie'],
    hint: 'Short & long sleeve',
    recommended: 7,
    perAge: { '0-3M': 10, '3-6M': 7, '6-9M': 6, '9-12M': 5, '12-18M': 4, '18-24M': 4 },
  },
  {
    id: 'day_tops',
    label: 'Day tops',
    category: 'tops_and_bodysuits',
    keywords: ['t_shirt', 'tshirt', 'top', 'tee', 'shirt', 'sweater', 'cardigan', 'hoodie'],
    hint: null,
    recommended: 4,
    fallback: true, // anything in tops_and_bodysuits that isn't a bodysuit
  },

  // ── One-pieces ────────────────────────────────────────────────────────
  {
    id: 'one_pieces',
    label: 'One-pieces',
    category: 'one_pieces',
    keywords: ['coverall', 'romper', 'one_piece', 'onepiece', 'jumpsuit'],
    hint: 'Long-leg coveralls',
    recommended: 3,
    fallback: true,
  },

  // ── Bottoms ───────────────────────────────────────────────────────────
  {
    id: 'shorts',
    label: 'Shorts',
    category: 'bottoms',
    keywords: ['short'],
    hint: 'Seasonal',
    recommended: 2,
  },
  {
    id: 'pants_leggings',
    label: 'Pants & leggings',
    category: 'bottoms',
    keywords: ['pants', 'legging', 'jogger', 'trouser'],
    hint: null,
    recommended: 5,
    fallback: true,
  },

  // ── Dresses & skirts ──────────────────────────────────────────────────
  {
    id: 'dresses',
    label: 'Dresses',
    category: 'dresses_and_skirts',
    keywords: ['dress', 'skirt'],
    hint: null,
    recommended: 2,
    fallback: true,
  },

  // ── Sleepwear ─────────────────────────────────────────────────────────
  {
    id: 'sleep_sacks',
    label: 'Sleep sacks',
    category: 'sleepwear',
    keywords: ['sack', 'swaddle'],
    hint: null,
    recommended: 2,
    perAge: { '0-3M': 2, '3-6M': 2, '6-9M': 2, '9-12M': 2, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'pajamas',
    label: 'Pajamas',
    category: 'sleepwear',
    keywords: ['sleepsuit', 'sleeper', 'pajama', 'pyjama', 'pj', 'nightgown'],
    hint: 'Sleepsuits & 2-piece',
    recommended: 7,
    perAge: { '0-3M': 4, '3-6M': 7, '6-9M': 7, '9-12M': 7, '12-18M': 6, '18-24M': 5 },
    fallback: true,
  },

  // ── Outerwear ─────────────────────────────────────────────────────────
  {
    id: 'rain_gear',
    label: 'Rain gear',
    category: 'outerwear',
    keywords: ['rain', 'puddle'],
    hint: null,
    recommended: 1,
  },
  {
    id: 'jackets',
    label: 'Jackets',
    category: 'outerwear',
    keywords: ['jacket', 'coat', 'snowsuit', 'parka'],
    hint: null,
    recommended: 2,
    fallback: true,
  },

  // ── Footwear ──────────────────────────────────────────────────────────
  {
    id: 'socks',
    label: 'Socks',
    category: 'footwear',
    keywords: ['sock'],
    hint: 'They disappear.',
    recommended: 10,
    perAge: { '0-3M': 6, '3-6M': 10, '6-9M': 10, '9-12M': 10, '12-18M': 8, '18-24M': 8 },
  },
  {
    id: 'shoes',
    label: 'Shoes / booties',
    category: 'footwear',
    keywords: ['shoe', 'bootie', 'boot', 'sandal'],
    hint: null,
    recommended: 2,
    fallback: true,
  },

  // ── Accessories ───────────────────────────────────────────────────────
  {
    id: 'hats',
    label: 'Hats',
    category: 'accessories',
    keywords: ['hat', 'beanie', 'cap', 'bonnet'],
    hint: 'Sun + warm',
    recommended: 3,
  },
  {
    id: 'mittens',
    label: 'Mittens',
    category: 'accessories',
    keywords: ['mitten', 'glove'],
    hint: 'Scratch prevention',
    recommended: 2,
    perAge: { '0-3M': 2, '3-6M': 2, '6-9M': 1, '9-12M': 1, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'bibs',
    label: 'Bibs',
    category: 'accessories',
    keywords: ['bib'],
    hint: null,
    recommended: 5,
  },
  {
    id: 'burp_cloths',
    label: 'Burp cloths',
    category: 'accessories',
    keywords: ['burp', 'muslin'],
    hint: null,
    recommended: 6,
    perAge: { '0-3M': 6, '3-6M': 6, '6-9M': 5, '9-12M': 4, '12-18M': 2, '18-24M': 2 },
  },

  // ── Swimwear ──────────────────────────────────────────────────────────
  {
    id: 'swimwear',
    label: 'Swimwear',
    category: 'swimwear',
    keywords: ['swim'],
    hint: 'Seasonal',
    recommended: 1,
    fallback: true,
  },
]

// Fast lookup by id. Useful for the slot detail route where we only have the
// slot id from the URL.
export const SLOT_BY_ID = Object.fromEntries(SLOTS.map(s => [s.id, s]))

// Slots grouped by category — used to decide fallback mapping (if an item
// doesn't match any keyword, try the fallback slot for its category).
const SLOTS_BY_CATEGORY = SLOTS.reduce((acc, slot) => {
  if (!acc[slot.category]) acc[slot.category] = []
  acc[slot.category].push(slot)
  return acc
}, {})

// ── Item → slot mapping ────────────────────────────────────────────────────
// Maps a clothing_items row onto a slot. Returns the slot object, or null if
// the item doesn't fit any canonical slot (the caller decides how to treat
// unmapped items — typically they fall into "Other wishes" for needed items,
// or are hidden from the Wish list for owned items).
//
// Matching strategy:
//   1. Walk SLOTS in order. If item.item_type contains any of the slot's
//      keywords AND the slot's category matches the item's category, match.
//   2. If no keyword matches, fall back to the slot flagged `fallback: true`
//      for the item's category (day_tops for tops_and_bodysuits, etc.).
//   3. If neither matches, return null.
export function getSlotForItem(item) {
  if (!item) return null
  const type = (item.item_type || '').toLowerCase()
  const category = item.category
  if (!category) return null

  // Pass 1: keyword match within the item's category
  for (const slot of SLOTS) {
    if (slot.category !== category) continue
    if (!slot.keywords || slot.keywords.length === 0) continue
    for (const kw of slot.keywords) {
      if (type.includes(kw)) return slot
    }
  }

  // Pass 2: fallback slot for the category
  const categorySlots = SLOTS_BY_CATEGORY[category] || []
  const fallback = categorySlots.find(s => s.fallback)
  return fallback || null
}

// ── Recommended quantity lookup ────────────────────────────────────────────
// Returns the recommended count for a given slot at a given age range.
// Falls back to the slot's flat `recommended` if no perAge entry exists.
export function recommendedQty(slot, ageRange) {
  if (!slot) return 0
  if (slot.perAge && slot.perAge[ageRange] != null) return slot.perAge[ageRange]
  return slot.recommended ?? 0
}

// ── Coverage computation ───────────────────────────────────────────────────
// Given the full items list, returns rows for the Wish list tab for a given
// age range. Each row describes coverage of a single slot:
//
//   { slot, ownedCount, recommended, needed, ownedItems, neededItems, status }
//
// Where:
//   ownedCount:   sum of quantity across owned items in this slot + age range
//   recommended:  target count for this slot + age range
//   needed:       max(recommended - ownedCount, 0) — i.e. the gap
//   status:       'complete' | 'gap' | 'empty' (empty when ownedCount === 0)
//   ownedItems:   the raw item rows for this slot that are owned
//   neededItems:  the raw item rows for this slot that are on the wish list
//                 (inventory_status === 'needed'). These don't reduce the gap
//                 but are shown in slot detail.
//
// Returned in SLOTS order, one row per slot. Slots with recommended=0 are
// dropped (shouldn't happen today but keeps the API forgiving).
export function computeCoverage(items, ageRange) {
  const bySlotOwned = {}
  const bySlotNeeded = {}

  for (const item of items || []) {
    if (item.size_label !== ageRange) continue
    const slot = getSlotForItem(item)
    if (!slot) continue
    const qty = Number(item.quantity) || 1
    if (item.inventory_status === 'owned') {
      if (!bySlotOwned[slot.id]) bySlotOwned[slot.id] = { count: 0, items: [] }
      bySlotOwned[slot.id].count += qty
      bySlotOwned[slot.id].items.push(item)
    } else if (item.inventory_status === 'needed') {
      if (!bySlotNeeded[slot.id]) bySlotNeeded[slot.id] = { count: 0, items: [] }
      bySlotNeeded[slot.id].count += qty
      bySlotNeeded[slot.id].items.push(item)
    }
  }

  const rows = []
  for (const slot of SLOTS) {
    const recommended = recommendedQty(slot, ageRange)
    if (recommended <= 0) continue
    const ownedEntry = bySlotOwned[slot.id] || { count: 0, items: [] }
    const neededEntry = bySlotNeeded[slot.id] || { count: 0, items: [] }
    const ownedCount = ownedEntry.count
    const needed = Math.max(recommended - ownedCount, 0)
    let status = 'gap'
    if (ownedCount === 0) status = 'empty'
    else if (ownedCount >= recommended) status = 'complete'
    rows.push({
      slot,
      ownedCount,
      recommended,
      needed,
      ownedItems: ownedEntry.items,
      neededItems: neededEntry.items,
      status,
    })
  }
  return rows
}

// ── Other wishes ───────────────────────────────────────────────────────────
// Returns needed items at a given age range that DON'T map to any canonical
// slot — these are the free-form wishlist entries (things like "monthly photo
// onesie" that someone typed manually and don't fit a recommendation bucket).
export function otherWishes(items, ageRange) {
  return (items || []).filter(item => {
    if (item.inventory_status !== 'needed') return false
    if (item.size_label !== ageRange) return false
    return getSlotForItem(item) == null
  })
}

// ── Age inference from baby DOB ────────────────────────────────────────────
// Given a baby row (date_of_birth or due_date) and the current date, returns
// which age range the baby is currently in. Expecting babies (due_date only)
// are mapped to the earliest range so the Wish list tab defaults to "what
// you'll need when they're born."
//
// When baby.age_range_override is set, that value wins. The override exists
// for big-for-age / small-for-age babies whose clothing size doesn't track
// calendar age (95th-percentile 4-month-olds already wearing 6-9M, etc.).
// We still compute monthsOld for debugging, but daysToNextRange is nulled so
// the outgrow banner — which is a calendar-age signal — stays quiet.
//
// Returns: { currentRange, monthsOld, daysToNextRange, nextRange, overridden }
// - currentRange: one of AGE_RANGES or null if out of supported range (>24M)
// - monthsOld: decimal months since birth (negative for expecting)
// - daysToNextRange: days until the upper boundary of currentRange, or null
//   if already in the last range / not yet born / override in effect
// - nextRange: the age range after currentRange, or null if none
// - overridden: true when the currentRange came from age_range_override
export function inferAgeRange(baby, now = new Date()) {
  if (!baby) return { currentRange: null, monthsOld: null, daysToNextRange: null, nextRange: null, overridden: false }

  const dob = baby.date_of_birth ? new Date(baby.date_of_birth) : null
  const due = baby.due_date ? new Date(baby.due_date) : null
  const effective = dob || due
  if (!effective) return { currentRange: null, monthsOld: null, daysToNextRange: null, nextRange: null, overridden: false }

  const msPerDay = 1000 * 60 * 60 * 24
  const daysOld = (now - effective) / msPerDay
  // Use 30.4375 days/month (average Gregorian) so 24 months lands where parents expect.
  const monthsOld = daysOld / 30.4375

  // Manual override wins. We trust the parent over our calendar math; they
  // have a body in their arms and a pediatrician on speed-dial.
  const override = baby.age_range_override
  if (override && AGE_RANGES.includes(override)) {
    const idx = AGE_RANGES.indexOf(override)
    return {
      currentRange: override,
      monthsOld,
      daysToNextRange: null,
      nextRange: AGE_RANGES[idx + 1] ?? null,
      overridden: true,
    }
  }

  // Expecting: baby not yet born. Default to the first age range.
  if (!dob && due && now < due) {
    return {
      currentRange: AGE_RANGES[0],
      monthsOld,
      daysToNextRange: null,
      nextRange: AGE_RANGES[1] ?? null,
      overridden: false,
    }
  }

  // Find the first range whose maxMonths is greater than monthsOld.
  let currentRange = null
  let nextRange = null
  for (let i = 0; i < AGE_RANGES.length; i++) {
    const r = AGE_RANGES[i]
    const bounds = AGE_RANGE_BOUNDS_MONTHS[r]
    if (monthsOld < bounds.maxMonths) {
      currentRange = r
      nextRange = AGE_RANGES[i + 1] ?? null
      break
    }
  }

  let daysToNextRange = null
  if (currentRange) {
    const bounds = AGE_RANGE_BOUNDS_MONTHS[currentRange]
    const monthsToNext = Math.max(bounds.maxMonths - monthsOld, 0)
    daysToNextRange = Math.round(monthsToNext * 30.4375)
  }

  return { currentRange, monthsOld, daysToNextRange, nextRange, overridden: false }
}

// ── Outgrow banner trigger ─────────────────────────────────────────────────
// Returns true when the baby is close enough to aging into the next range
// that we want to surface a "plan ahead" banner. 21 days was picked so it
// lines up with the ~3-week lead time parents need to order clothes.
export const OUTGROW_WINDOW_DAYS = 21
export function shouldShowOutgrowBanner({ daysToNextRange, nextRange }) {
  if (!nextRange) return false
  if (daysToNextRange == null) return false
  return daysToNextRange <= OUTGROW_WINDOW_DAYS && daysToNextRange >= 0
}

// ── Pluralize helper for UI copy ───────────────────────────────────────────
// Tiny helper so UI code doesn't have to sprinkle ternaries everywhere.
export function pluralize(n, singular, plural) {
  return n === 1 ? singular : (plural || singular + 's')
}
