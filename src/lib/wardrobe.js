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
// Each slot has both a `label` (plural — used for slot/category headers
// like "Bodysuits" on the Wish list and SlotDetail) and a `singular`
// (used when referring to an individual item, e.g. an Inventory row's
// fallback name when the user didn't enter one). Most singulars are the
// label minus a trailing 's'; pluralia tantum (Shorts, Pants & leggings,
// Pajamas) and uncountables (Rain gear, Swimwear) keep the same form.
export const SLOTS = [
  // ── Tops and bodysuits ────────────────────────────────────────────────
  {
    id: 'bodysuits',
    label: 'Bodysuits',
    singular: 'Bodysuit',
    category: 'tops_and_bodysuits',
    keywords: ['bodysuit', 'onesie'],
    hint: 'Short & long sleeve',
    recommended: 7,
    perAge: { '0-3M': 10, '3-6M': 7, '6-9M': 6, '9-12M': 5, '12-18M': 4, '18-24M': 4 },
  },
  {
    id: 'day_tops',
    label: 'Day tops',
    singular: 'Day top',
    category: 'tops_and_bodysuits',
    // 'sweater'/'cardigan'/'hoodie' moved to the new sweaters slot below.
    // day_tops keeps t-shirts, blouses, polos, and anything top-shaped that
    // isn't a knit layering piece. fallback for the category stays here so
    // free-text item_types that don't match elsewhere land sensibly.
    keywords: ['t_shirt', 'tshirt', 'top', 'tee', 'shirt', 'blouse', 'polo'],
    hint: null,
    // Newborns wear bodysuits more than separates; day tops ramp up as
    // bodysuits taper. Aligned with external checklists (Babylist, Mom
    // Money Map, mommylabornurse 2026 audit) suggesting 4-7 in older sizes.
    recommended: 5,
    perAge: { '0-3M': 3, '3-6M': 4, '6-9M': 5, '9-12M': 5, '12-18M': 6, '18-24M': 6 },
    fallback: true, // anything in tops_and_bodysuits that isn't a bodysuit/sweater
  },
  {
    id: 'sweaters',
    label: 'Sweaters',
    singular: 'Sweater',
    category: 'tops_and_bodysuits',
    keywords: ['sweater', 'cardigan', 'hoodie', 'pullover', 'fleece'],
    hint: 'Layering pieces',
    // Cold-weather skewed; recommended ramps slightly with age as toddlers
    // start needing more layering options. Newborns mostly use bodysuits +
    // sleep sacks for warmth, so 1 sweater there.
    recommended: 2,
    perAge: { '0-3M': 1, '3-6M': 2, '6-9M': 2, '9-12M': 3, '12-18M': 3, '18-24M': 3 },
  },

  // ── One-pieces ────────────────────────────────────────────────────────
  {
    id: 'one_pieces',
    label: 'One-pieces',
    singular: 'One-piece',
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
    singular: 'Shorts', // pluralia tantum
    category: 'bottoms',
    keywords: ['short'],
    hint: 'Seasonal',
    recommended: 2,
  },
  {
    id: 'pants_leggings',
    label: 'Pants & leggings',
    singular: 'Pants & leggings', // pluralia tantum
    category: 'bottoms',
    keywords: ['pants', 'legging', 'jogger', 'trouser'],
    hint: null,
    recommended: 5,
    fallback: true,
  },
  {
    id: 'overalls',
    label: 'Overalls',
    singular: 'Overalls', // pluralia tantum
    category: 'bottoms',
    keywords: ['overall', 'overalls', 'bib pant', 'dungaree'],
    hint: 'Bottoms with bib',
    // Overalls are functionally a bottom-with-bib (worn over a top), so
    // they live under bottoms — distinct from one_pieces which are
    // standalone garments. Newborns rarely wear them; toddlers do more.
    recommended: 1,
    perAge: { '0-3M': 0, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 2, '18-24M': 2 },
  },

  // ── Dresses & skirts ──────────────────────────────────────────────────
  {
    id: 'dresses',
    label: 'Dresses',
    singular: 'Dress',
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
    singular: 'Sleep sack',
    category: 'sleepwear',
    keywords: ['sack', 'swaddle'],
    hint: null,
    // Slot covers BOTH swaddles and sleep sacks. Newborn period needs the
    // most because of cycle-through from spit-up + diaper blowouts —
    // external checklists cluster around 4-6 swaddles for newborns. Tapers
    // as baby transitions out of swaddling around 4 months.
    recommended: 2,
    perAge: { '0-3M': 5, '3-6M': 3, '6-9M': 2, '9-12M': 2, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'footed_pajamas',
    label: 'Footed pajamas',
    singular: 'Footed pajamas', // pluralia tantum
    category: 'sleepwear',
    keywords: ['footed', 'sleeper', 'sleepsuit', 'footie', 'one piece pajama', 'one-piece pajama'],
    hint: 'One-piece zip or snap',
    // The dominant sleepwear slot for 0-12M. Counts mirror the previous
    // single 'pajamas' slot's curve since footed PJs are what most parents
    // were tracking under that label. Slight taper at 12-18M as 2-piece
    // sets enter rotation. Stays as the category fallback.
    recommended: 5,
    perAge: { '0-3M': 6, '3-6M': 6, '6-9M': 5, '9-12M': 5, '12-18M': 4, '18-24M': 3 },
    fallback: true,
  },
  {
    id: 'two_piece_pajamas',
    label: '2-piece pajamas',
    singular: '2-piece pajamas', // pluralia tantum
    category: 'sleepwear',
    keywords: ['two piece pajama', '2 piece', 'pj set', 'pajama set', 'pyjama set'],
    hint: 'Top + bottom set',
    // 2-piece sets enter rotation around 9-12M as kids start moving more
    // and footed PJs get tight. Ramp up through 18-24M.
    recommended: 2,
    perAge: { '0-3M': 0, '3-6M': 0, '6-9M': 1, '9-12M': 2, '12-18M': 3, '18-24M': 3 },
  },
  {
    id: 'sleep_gowns',
    label: 'Sleep gowns',
    singular: 'Sleep gown',
    category: 'sleepwear',
    keywords: ['sleep gown', 'nightgown', 'sleeper gown', 'baby gown'],
    hint: 'Newborn nightgown',
    // Newborn-only essentially — bottom-open gowns make diaper changes
    // easier in the first months. Drops to zero by 6M.
    recommended: 0,
    perAge: { '0-3M': 2, '3-6M': 1, '6-9M': 0, '9-12M': 0, '12-18M': 0, '18-24M': 0 },
  },

  // ── Outerwear ─────────────────────────────────────────────────────────
  {
    id: 'rain_gear',
    label: 'Rain gear',
    singular: 'Rain gear', // uncountable
    category: 'outerwear',
    keywords: ['rain', 'puddle'],
    hint: null,
    recommended: 1,
  },
  {
    id: 'light_jackets',
    label: 'Light jackets',
    singular: 'Light jacket',
    category: 'outerwear',
    keywords: ['jacket', 'fleece jacket', 'denim jacket', 'spring jacket', 'windbreaker'],
    hint: 'Spring/fall layers',
    // Replaced the catch-all 'jackets' slot with three more specific
    // outerwear slots (Tier 1 audit, 2026-05-05). Light jackets are the
    // most-owned of the three; one is enough for most ages, two for older
    // toddlers who go through more wear-and-tear.
    recommended: 1,
    perAge: { '0-3M': 1, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 2, '18-24M': 2 },
    fallback: true,
  },
  {
    id: 'winter_coats',
    label: 'Winter coats',
    singular: 'Winter coat',
    category: 'outerwear',
    keywords: ['parka', 'winter coat', 'puffer', 'puffy', 'down'],
    hint: 'Heavy outerwear',
    // Newborns mostly skip a true winter coat (snowsuits + car-seat covers
    // do the job); from 3M onward one is the standard recommendation.
    recommended: 1,
    perAge: { '0-3M': 0, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'snowsuits',
    label: 'Snowsuits',
    singular: 'Snowsuit',
    category: 'outerwear',
    keywords: ['snowsuit', 'bunting', 'snow suit'],
    hint: 'One-piece for snow',
    // Climate-dependent and household-dependent — many parents in mild
    // climates own zero. We default recommended=0 and let the perAge
    // express "1 is reasonable for cold-climate kids 3M+" without
    // pressuring everyone toward owning one.
    recommended: 0,
    perAge: { '0-3M': 0, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 1, '18-24M': 1 },
  },

  // ── Footwear ──────────────────────────────────────────────────────────
  {
    id: 'socks',
    label: 'Socks',
    singular: 'Sock',
    category: 'footwear',
    keywords: ['sock'],
    hint: 'They disappear.',
    recommended: 10,
    perAge: { '0-3M': 6, '3-6M': 10, '6-9M': 10, '9-12M': 10, '12-18M': 8, '18-24M': 8 },
  },
  {
    id: 'shoes',
    label: 'Shoes / booties',
    singular: 'Shoe / bootie',
    category: 'footwear',
    // 'boot' moved to the dedicated boots slot. Shoes covers everything
    // that isn't a boot or a sock — sneakers, sandals, mary janes, dress
    // shoes, soft-soled booties for pre-walkers.
    keywords: ['shoe', 'bootie', 'sandal', 'sneaker'],
    hint: null,
    // Pre-walking (typically pre-9 months), babies don't really need shoes;
    // a single pair of soft-soled booties for warmth covers it. Walking
    // typically starts 9-15 months — recommended count steps up there.
    recommended: 2,
    perAge: { '0-3M': 1, '3-6M': 1, '6-9M': 1, '9-12M': 2, '12-18M': 3, '18-24M': 3 },
    fallback: true,
  },
  {
    id: 'boots',
    label: 'Boots',
    singular: 'Boot',
    category: 'footwear',
    keywords: ['boot', 'snow boot', 'rain boot', 'winter boot'],
    hint: 'Rain & winter',
    // Boots come into rotation once kids walk regularly (~12M). Pre-
    // walking babies don't really need them. Two boots in 18-24M covers
    // separate rain + winter pairs.
    recommended: 1,
    perAge: { '0-3M': 0, '3-6M': 0, '6-9M': 0, '9-12M': 1, '12-18M': 1, '18-24M': 2 },
  },

  // ── Accessories ───────────────────────────────────────────────────────
  {
    id: 'warm_hats',
    label: 'Warm hats',
    singular: 'Warm hat',
    category: 'accessories',
    keywords: ['beanie', 'knit cap', 'winter hat', 'fleece hat', 'pom hat'],
    hint: 'Beanies & knit caps',
    // Replaces the catch-all 'hats' slot (Tier 1, 2026-05-05). Newborns
    // need extra warm hats because of head-cooling — one or two come home
    // from the hospital. Older babies are mostly down to one good beanie.
    recommended: 1,
    perAge: { '0-3M': 2, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'sun_hats',
    label: 'Sun hats',
    singular: 'Sun hat',
    category: 'accessories',
    keywords: ['sun hat', 'baseball cap', 'cap', 'bucket hat', 'brimmed', 'bonnet'],
    hint: 'Brimmed UV protection',
    // Includes baseball caps — they're functionally sun-protection on
    // babies, not a fashion item. One sun hat covers most households.
    recommended: 1,
  },
  {
    id: 'mittens',
    label: 'Mittens',
    singular: 'Mitten',
    category: 'accessories',
    keywords: ['mitten', 'glove'],
    hint: 'Scratch prevention',
    recommended: 2,
    perAge: { '0-3M': 2, '3-6M': 2, '6-9M': 1, '9-12M': 1, '12-18M': 1, '18-24M': 1 },
  },
  {
    id: 'bibs',
    label: 'Bibs',
    singular: 'Bib',
    category: 'accessories',
    keywords: ['bib'],
    hint: null,
    // Two distinct use cases drive the curve: drool/spit-up bibs in the
    // newborn period (4-6 work), then feeding bibs starting around 4-6
    // months when solids begin (consensus 7-8 needed for one per meal).
    // Tapers as feeding gets cleaner past 12 months.
    recommended: 5,
    perAge: { '0-3M': 4, '3-6M': 6, '6-9M': 7, '9-12M': 7, '12-18M': 5, '18-24M': 4 },
  },
  {
    id: 'burp_cloths',
    label: 'Burp cloths',
    singular: 'Burp cloth',
    category: 'accessories',
    keywords: ['burp', 'muslin'],
    hint: null,
    recommended: 6,
    perAge: { '0-3M': 6, '3-6M': 6, '6-9M': 5, '9-12M': 4, '12-18M': 2, '18-24M': 2 },
  },
  {
    id: 'hair_accessories',
    label: 'Hair accessories',
    singular: 'Hair accessory',
    category: 'accessories',
    keywords: ['headband', 'bow', 'hair tie', 'barrette', 'clip', 'hair clip'],
    hint: 'Headbands, bows, clips',
    // Girls-skewed; default recommended is low because boys' households
    // don't need this slot. Counts bump slightly with age as toddlers
    // accumulate variety.
    recommended: 1,
    perAge: { '0-3M': 1, '3-6M': 1, '6-9M': 1, '9-12M': 1, '12-18M': 2, '18-24M': 2 },
  },

  // ── Swimwear ──────────────────────────────────────────────────────────
  {
    id: 'swimwear',
    label: 'Swimwear',
    singular: 'Swimwear', // uncountable
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
// Returns the recommended count for a given slot at a given age range,
// multiplied by babyCount. Falls back to the slot's flat `recommended` if
// no perAge entry exists.
//
// babyCount > 1 reflects households viewing the "all babies" tab — each
// baby will pass through this size band, so the recommended quantity scales.
// Sequential babies hand items down so the practical need is lower than
// the linear multiplier suggests, but the wishlist is guidance not
// prescription (per the recommendation tooltip), so linear is fine for v1.
export function recommendedQty(slot, ageRange, babyCount = 1) {
  if (!slot) return 0
  const base = (slot.perAge && slot.perAge[ageRange] != null)
    ? slot.perAge[ageRange]
    : (slot.recommended ?? 0)
  const count = Math.max(1, Math.floor(babyCount) || 1)
  return base * count
}

// ── Coverage computation ───────────────────────────────────────────────────
// Given the full items list, returns rows for the Wish list tab for a given
// age range. Each row describes coverage of a single slot:
//
//   { slot, ownedCount, recommended, needed, ownedItems, neededItems, status }
//
// Where:
//   ownedCount:   sum of quantity across owned items in this slot + age range
//   recommended:  target count for this slot + age range × babyCount
//   needed:       max(recommended - ownedCount, 0) — i.e. the gap
//   status:       'complete' | 'gap' | 'empty' (empty when ownedCount === 0)
//   ownedItems:   the raw item rows for this slot that are owned
//   neededItems:  the raw item rows for this slot that are on the wish list
//                 (inventory_status === 'needed'). These don't reduce the gap
//                 but are shown in slot detail.
//
// babyCount scales the recommended target for "all babies" views — single-
// baby views pass 1 (or omit), all-babies views pass the household's
// baby count.
//
// Returned in SLOTS order, one row per slot. Slots with recommended=0 are
// dropped (shouldn't happen today but keeps the API forgiving).
export function computeCoverage(items, ageRange, babyCount = 1) {
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
    const recommended = recommendedQty(slot, ageRange, babyCount)
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

// ── Prediction card trigger ────────────────────────────────────────────────
// Returns true when the next size transition is far enough ahead to be worth
// planning for (but close enough to be actionable). Window is 16 weeks —
// roughly one season's worth of lead time for sourcing secondhand clothes.
// The lower bound is 0 so the card stays up until the actual transition
// (at which point the outgrow banner takes over and the next range becomes
// current, making nextRange point one further ahead).
export const PREDICTION_WINDOW_DAYS = 112  // 16 weeks
export function shouldShowPredictionCard({ daysToNextRange, nextRange, overridden }) {
  if (!nextRange) return false
  if (daysToNextRange == null) return false
  if (overridden) return false
  return daysToNextRange >= 0 && daysToNextRange <= PREDICTION_WINDOW_DAYS
}

// Given daysToNextRange, returns a human-readable "~N weeks" / "~N months"
// string for the prediction card header.
export function formatTransitionEta(daysToNextRange) {
  if (daysToNextRange == null) return null
  const weeks = Math.ceil(daysToNextRange / 7)
  if (weeks <= 1) return 'this week'
  if (weeks < 5) return `~${weeks} weeks`
  const months = Math.round(weeks / 4.33)
  return `~${months} month${months === 1 ? '' : 's'}`
}

// ── Pluralize helper for UI copy ───────────────────────────────────────────
// Tiny helper so UI code doesn't have to sprinkle ternaries everywhere.
export function pluralize(n, singular, plural) {
  return n === 1 ? singular : (plural || singular + 's')
}
