// Non-clothing category taxonomy + coverage computation.
//
// This file is the source of truth for all 7 non-clothing categories:
//   sleep, feeding, diapering, travel, play, health, bath
//
// Structure mirrors wardrobe.js (which handles clothing). Each ITEM is a
// "slot" — a functional item type that the wishlist and coverage system
// tracks. Items roll up free-text `item_type` values from beta.items via
// keyword matching.
//
// Key differences from wardrobe.js:
//   - No age-range axis for most items — a stroller is a stroller.
//   - `top_category` is the primary grouping (sleep, feeding, etc.).
//   - `sub_category` is the secondary grouping within a category.
//   - `priority` (must_have | nice_to_have | low_priority) drives wishlist
//     display priority. Clothing uses this too but only on the needs tab;
//     here it's always surfaced since categories like travel are highly
//     household-dependent.
//   - `recommended` is a simple flat count (1 stroller, 3 fitted sheets).
//     No perAge overrides needed for most items.
//
// Everything here is pure (no React, no Supabase). Safe to unit-test and
// to iterate on recommendations without touching UI code.

// ── Category metadata ─────────────────────────────────────────────────────────

export const CATEGORY_META = {
  sleep:     { label: 'Sleep',      color: 'blue'   },
  feeding:   { label: 'Feeding',    color: 'amber'  },
  diapering: { label: 'Diapering',  color: 'gray'   },
  travel:    { label: 'Travel',     color: 'purple' },
  play:      { label: 'Play',       color: 'coral'  },
  health:    { label: 'Health',     color: 'red'    },
  bath:      { label: 'Bath',       color: 'green'  },
}

// ── Sub-category labels ───────────────────────────────────────────────────────

export const SUB_CATEGORY_LABELS = {
  // sleep
  sleep_surfaces:     'Sleep surfaces',
  sleep_bedding:      'Bedding',
  sleep_environment:  'Environment',
  sleep_monitoring:   'Monitoring',
  // feeding
  breastfeeding:      'Breastfeeding',
  bottle_feeding:     'Bottle feeding',
  solids:             'Starting solids',
  // diapering
  diapers:            'Diapers',
  changing_station:   'Changing station',
  diaper_bag:         'Diaper bag',
  // travel
  strollers:          'Strollers',
  car_seats:          'Car seats',
  carriers:           'Carriers',
  travel_gear:        'Travel gear',
  // play
  infant_play:        'Infant play',
  mobile_play:        'Active play',
  books_learning:     'Books & learning',
  outdoor_play:       'Outdoor play',
  // health
  health_monitoring:  'Health monitoring',
  grooming:           'Grooming & care',
  baby_safety:        'Baby-proofing',
  // bath
  bath_setup:         'Bath setup',
  bath_products:      'Bath products',
}

// ── Item taxonomy ─────────────────────────────────────────────────────────────
// Each item is a functional slot. Schema:
//   id:           stable kebab-case identifier
//   label:        display name (plural where natural)
//   singular:     for individual item references
//   top_category: one of CATEGORY_META keys
//   sub_category: one of SUB_CATEGORY_LABELS keys
//   keywords:     substrings matched against item_type (lowercased); any match wins
//   priority:     'must_have' | 'nice_to_have' | 'low_priority'
//   recommended:  target quantity (how many households typically need)
//   hint:         short helper shown in wishlist UI (null = no hint)
//   fallback:     if true, catches unmatched items in its sub_category
//
// Ordering within each sub_category: must-haves first, then nice-to-haves.

export const ITEMS = [

  // ── SLEEP ─────────────────────────────────────────────────────────────────

  // Sleep surfaces
  {
    id: 'crib',
    label: 'Crib',
    singular: 'Crib',
    top_category: 'sleep',
    sub_category: 'sleep_surfaces',
    keywords: ['crib', 'full size crib', 'convertible crib'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Full-size or convertible',
  },
  {
    id: 'bassinet',
    label: 'Bassinet',
    singular: 'Bassinet',
    top_category: 'sleep',
    sub_category: 'sleep_surfaces',
    keywords: ['bassinet', 'bedside sleeper', 'co-sleeper', 'moses basket'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Great for first 4-6 months',
  },
  {
    id: 'pack_n_play',
    label: 'Pack-n-play',
    singular: 'Pack-n-play',
    top_category: 'sleep',
    sub_category: 'sleep_surfaces',
    keywords: ['pack n play', 'pack-n-play', 'packnplay', 'playard', 'play yard', 'travel crib'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Doubles as travel crib',
    fallback: true,
  },

  // Sleep bedding
  {
    id: 'crib_mattress',
    label: 'Crib mattress',
    singular: 'Crib mattress',
    top_category: 'sleep',
    sub_category: 'sleep_bedding',
    keywords: ['crib mattress', 'baby mattress'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Firm, flat, and snug-fitting',
  },
  {
    id: 'mattress_protector',
    label: 'Mattress protectors',
    singular: 'Mattress protector',
    top_category: 'sleep',
    sub_category: 'sleep_bedding',
    keywords: ['mattress protector', 'mattress pad', 'mattress cover', 'waterproof pad'],
    priority: 'must_have',
    recommended: 2,
    hint: 'Two — one on, one in the wash',
  },
  {
    id: 'fitted_sheets',
    label: 'Fitted sheets',
    singular: 'Fitted sheet',
    top_category: 'sleep',
    sub_category: 'sleep_bedding',
    keywords: ['fitted sheet', 'crib sheet', 'bassinet sheet'],
    priority: 'must_have',
    recommended: 4,
    hint: 'Stock up for middle-of-night changes',
    fallback: true,
  },

  // Sleep environment
  {
    id: 'white_noise_machine',
    label: 'White noise machine',
    singular: 'White noise machine',
    top_category: 'sleep',
    sub_category: 'sleep_environment',
    keywords: ['white noise', 'sound machine', 'noise machine'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: null,
  },
  {
    id: 'blackout_curtains',
    label: 'Blackout curtains',
    singular: 'Blackout curtain',
    top_category: 'sleep',
    sub_category: 'sleep_environment',
    keywords: ['blackout', 'blackout curtain', 'blackout shade', 'room darkening'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Big nap quality upgrade',
    fallback: true,
  },
  {
    id: 'night_light',
    label: 'Night light',
    singular: 'Night light',
    top_category: 'sleep',
    sub_category: 'sleep_environment',
    keywords: ['night light', 'nightlight', 'nursery light'],
    priority: 'low_priority',
    recommended: 1,
    hint: null,
  },

  // Sleep monitoring
  {
    id: 'baby_monitor',
    label: 'Baby monitor',
    singular: 'Baby monitor',
    top_category: 'sleep',
    sub_category: 'sleep_monitoring',
    keywords: ['baby monitor', 'video monitor', 'audio monitor', 'monitor camera'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Video or audio',
    fallback: true,
  },

  // ── FEEDING ───────────────────────────────────────────────────────────────

  // Breastfeeding
  {
    id: 'breast_pump',
    label: 'Breast pump',
    singular: 'Breast pump',
    top_category: 'feeding',
    sub_category: 'breastfeeding',
    keywords: ['breast pump', 'breastpump', 'pump', 'electric pump', 'manual pump', 'wearable pump'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Often covered by insurance',
  },
  {
    id: 'nursing_pillow',
    label: 'Nursing pillow',
    singular: 'Nursing pillow',
    top_category: 'feeding',
    sub_category: 'breastfeeding',
    keywords: ['nursing pillow', 'boppy', 'feeding pillow', 'breastfeeding pillow'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Also great for tummy time',
  },
  {
    id: 'nursing_pads',
    label: 'Nursing pads',
    singular: 'Nursing pads',
    top_category: 'feeding',
    sub_category: 'breastfeeding',
    keywords: ['nursing pad', 'breast pad', 'nipple pad', 'milk pad'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Disposable or reusable',
  },
  {
    id: 'nipple_cream',
    label: 'Nipple cream',
    singular: 'Nipple cream',
    top_category: 'feeding',
    sub_category: 'breastfeeding',
    keywords: ['nipple cream', 'lanolin', 'nipple butter', 'nipple balm'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
    fallback: true,
  },
  {
    id: 'milk_storage',
    label: 'Milk storage bags',
    singular: 'Milk storage bags',
    top_category: 'feeding',
    sub_category: 'breastfeeding',
    keywords: ['milk storage', 'breast milk bag', 'storage bag'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'If you plan to pump and store',
  },

  // Bottle feeding
  {
    id: 'bottles',
    label: 'Baby bottles',
    singular: 'Baby bottle',
    top_category: 'feeding',
    sub_category: 'bottle_feeding',
    keywords: ['bottle', 'baby bottle', 'feeding bottle'],
    priority: 'must_have',
    recommended: 6,
    hint: 'Start with a small set; babies can be picky',
    fallback: true,
  },
  {
    id: 'bottle_brush',
    label: 'Bottle brush',
    singular: 'Bottle brush',
    top_category: 'feeding',
    sub_category: 'bottle_feeding',
    keywords: ['bottle brush', 'bottle cleaner', 'nipple brush'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
  },
  {
    id: 'bottle_sterilizer',
    label: 'Bottle sterilizer',
    singular: 'Bottle sterilizer',
    top_category: 'feeding',
    sub_category: 'bottle_feeding',
    keywords: ['sterilizer', 'steam sterilizer', 'uv sterilizer', 'bottle sanitizer'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Or use boiling water',
  },
  {
    id: 'drying_rack',
    label: 'Drying rack',
    singular: 'Drying rack',
    top_category: 'feeding',
    sub_category: 'bottle_feeding',
    keywords: ['drying rack', 'bottle rack', 'dish rack'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: null,
  },

  // Starting solids
  {
    id: 'high_chair',
    label: 'High chair',
    singular: 'High chair',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['high chair', 'highchair', 'booster seat', 'feeding seat', 'hook-on chair'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Needed around 4-6 months',
    fallback: true,
  },
  {
    id: 'baby_spoons',
    label: 'Baby spoons',
    singular: 'Baby spoon',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['baby spoon', 'infant spoon', 'weaning spoon', 'silicone spoon'],
    priority: 'must_have',
    recommended: 6,
    hint: 'Soft-tip for first bites',
  },
  {
    id: 'baby_bowls',
    label: 'Baby bowls',
    singular: 'Baby bowl',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['baby bowl', 'suction bowl', 'infant bowl', 'silicone bowl'],
    priority: 'must_have',
    recommended: 4,
    hint: 'Suction base helps a lot',
  },
  {
    id: 'sippy_cup',
    label: 'Sippy cups',
    singular: 'Sippy cup',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['sippy cup', 'straw cup', 'transition cup', 'open cup', '360 cup'],
    priority: 'nice_to_have',
    recommended: 3,
    hint: 'Needed around 6 months',
  },
  {
    id: 'silicone_placemat',
    label: 'Silicone placemat',
    singular: 'Silicone placemat',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['placemat', 'silicone mat', 'suction mat', 'table mat'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: null,
  },
  {
    id: 'baby_food_maker',
    label: 'Baby food maker',
    singular: 'Baby food maker',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['baby food maker', 'baby blender', 'food processor', 'puree maker'],
    priority: 'low_priority',
    recommended: 1,
    hint: 'A regular blender works too',
  },
  {
    id: 'mesh_feeder',
    label: 'Mesh feeders',
    singular: 'Mesh feeder',
    top_category: 'feeding',
    sub_category: 'solids',
    keywords: ['mesh feeder', 'silicone feeder', 'self feeder', 'munchkin feeder'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: 'Great for teething too',
  },

  // ── DIAPERING ─────────────────────────────────────────────────────────────

  // Diapers
  {
    id: 'disposable_diapers',
    label: 'Diapers',
    singular: 'Diapers',
    top_category: 'diapering',
    sub_category: 'diapers',
    keywords: ['diaper', 'disposable diaper', 'newborn diaper', 'size 1', 'size 2'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Don\'t stockpile one size — babies grow fast',
    fallback: true,
  },
  {
    id: 'cloth_diapers',
    label: 'Cloth diapers',
    singular: 'Cloth diaper',
    top_category: 'diapering',
    sub_category: 'diapers',
    keywords: ['cloth diaper', 'reusable diaper', 'pocket diaper', 'diaper cover', 'prefold'],
    priority: 'nice_to_have',
    recommended: 24,
    hint: 'Need ~24 for full-time cloth',
  },
  {
    id: 'swim_diapers',
    label: 'Swim diapers',
    singular: 'Swim diaper',
    top_category: 'diapering',
    sub_category: 'diapers',
    keywords: ['swim diaper', 'reusable swim', 'pool diaper'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: 'Seasonal',
  },
  {
    id: 'diaper_rash_cream',
    label: 'Diaper rash cream',
    singular: 'Diaper rash cream',
    top_category: 'diapering',
    sub_category: 'diapers',
    keywords: ['diaper cream', 'rash cream', 'barrier cream', 'desitin', 'butt paste', 'boudreaux'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
  },

  // Changing station
  {
    id: 'changing_pad',
    label: 'Changing pad',
    singular: 'Changing pad',
    top_category: 'diapering',
    sub_category: 'changing_station',
    keywords: ['changing pad', 'changing mat', 'changing table', 'change pad'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Contoured pad keeps baby from rolling',
    fallback: true,
  },
  {
    id: 'changing_pad_covers',
    label: 'Changing pad covers',
    singular: 'Changing pad cover',
    top_category: 'diapering',
    sub_category: 'changing_station',
    keywords: ['changing pad cover', 'changing cover', 'changing table cover'],
    priority: 'must_have',
    recommended: 3,
    hint: 'Blowouts happen — keep extras handy',
  },
  {
    id: 'wipes',
    label: 'Baby wipes',
    singular: 'Baby wipes',
    top_category: 'diapering',
    sub_category: 'changing_station',
    keywords: ['wipe', 'baby wipe', 'diaper wipe', 'water wipe'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Buy in bulk',
  },
  {
    id: 'diaper_pail',
    label: 'Diaper pail',
    singular: 'Diaper pail',
    top_category: 'diapering',
    sub_category: 'changing_station',
    keywords: ['diaper pail', 'diaper bin', 'diaper genie', 'nappy bin'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Keeps the smell contained',
  },
  {
    id: 'wipe_warmer',
    label: 'Wipe warmer',
    singular: 'Wipe warmer',
    top_category: 'diapering',
    sub_category: 'changing_station',
    keywords: ['wipe warmer'],
    priority: 'low_priority',
    recommended: 1,
    hint: 'Prevents cold-wipe startles',
  },

  // Diaper bag
  {
    id: 'diaper_bag',
    label: 'Diaper bag',
    singular: 'Diaper bag',
    top_category: 'diapering',
    sub_category: 'diaper_bag',
    keywords: ['diaper bag', 'nappy bag', 'baby bag', 'backpack diaper'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
    fallback: true,
  },
  {
    id: 'wet_bag',
    label: 'Wet bags',
    singular: 'Wet bag',
    top_category: 'diapering',
    sub_category: 'diaper_bag',
    keywords: ['wet bag', 'waterproof bag', 'pul bag', 'soiled bag'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: 'For soiled clothes on the go',
  },

  // ── TRAVEL ────────────────────────────────────────────────────────────────

  // Strollers
  {
    id: 'stroller',
    label: 'Stroller',
    singular: 'Stroller',
    top_category: 'travel',
    sub_category: 'strollers',
    keywords: ['stroller', 'pram', 'pushchair', 'buggy', 'travel system', 'jogging stroller'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
    fallback: true,
  },
  {
    id: 'stroller_organizer',
    label: 'Stroller organizer',
    singular: 'Stroller organizer',
    top_category: 'travel',
    sub_category: 'strollers',
    keywords: ['stroller organizer', 'stroller caddy', 'stroller bag', 'stroller cup holder'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: null,
  },
  {
    id: 'stroller_bassinet',
    label: 'Stroller bassinet',
    singular: 'Stroller bassinet',
    top_category: 'travel',
    sub_category: 'strollers',
    keywords: ['stroller bassinet', 'pram bassinet', 'bassinet attachment', 'stroller carrycot'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'For flat-lay sleeping on the go',
  },

  // Car seats
  {
    id: 'infant_car_seat',
    label: 'Infant car seat',
    singular: 'Infant car seat',
    top_category: 'travel',
    sub_category: 'car_seats',
    keywords: ['infant car seat', 'infant seat', 'bucket seat', 'baby car seat', 'rear facing infant'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Required from day 1',
  },
  {
    id: 'convertible_car_seat',
    label: 'Convertible car seat',
    singular: 'Convertible car seat',
    top_category: 'travel',
    sub_category: 'car_seats',
    keywords: ['convertible car seat', 'convertible seat', 'all-in-one seat', 'extended rear facing'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Lasts from infancy through toddlerhood',
    fallback: true,
  },
  {
    id: 'car_seat_mirror',
    label: 'Car seat mirror',
    singular: 'Car seat mirror',
    top_category: 'travel',
    sub_category: 'car_seats',
    keywords: ['car seat mirror', 'backseat mirror', 'baby mirror', 'car mirror'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'See rear-facing baby without turning around',
  },
  {
    id: 'car_seat_protector',
    label: 'Car seat protector',
    singular: 'Car seat protector',
    top_category: 'travel',
    sub_category: 'car_seats',
    keywords: ['car seat protector', 'seat protector', 'under car seat mat'],
    priority: 'low_priority',
    recommended: 1,
    hint: 'Protects vehicle upholstery',
  },

  // Carriers
  {
    id: 'structured_carrier',
    label: 'Structured carrier',
    singular: 'Structured carrier',
    top_category: 'travel',
    sub_category: 'carriers',
    keywords: ['structured carrier', 'soft structured carrier', 'ssc', 'ergonomic carrier', 'ergobaby', 'lillebaby', 'baby bjorn'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Easiest for everyday use',
    fallback: true,
  },
  {
    id: 'wrap_carrier',
    label: 'Wrap carrier',
    singular: 'Wrap carrier',
    top_category: 'travel',
    sub_category: 'carriers',
    keywords: ['wrap carrier', 'stretchy wrap', 'woven wrap', 'moby wrap', 'baby wrap'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Great for newborns',
  },
  {
    id: 'ring_sling',
    label: 'Ring sling',
    singular: 'Ring sling',
    top_category: 'travel',
    sub_category: 'carriers',
    keywords: ['ring sling', 'sling'],
    priority: 'low_priority',
    recommended: 1,
    hint: 'Quick on/off once you learn it',
  },

  // Travel gear
  {
    id: 'portable_high_chair',
    label: 'Portable high chair',
    singular: 'Portable high chair',
    top_category: 'travel',
    sub_category: 'travel_gear',
    keywords: ['portable high chair', 'hook on chair', 'clip on chair', 'travel seat', 'booster travel'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Useful for restaurants and travel',
    fallback: true,
  },

  // ── PLAY ──────────────────────────────────────────────────────────────────

  // Infant play
  {
    id: 'play_mat',
    label: 'Play mat',
    singular: 'Play mat',
    top_category: 'play',
    sub_category: 'infant_play',
    keywords: ['play mat', 'activity mat', 'floor mat', 'foam mat', 'baby mat'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Essential for tummy time',
    fallback: true,
  },
  {
    id: 'baby_gym',
    label: 'Baby gym',
    singular: 'Baby gym',
    top_category: 'play',
    sub_category: 'infant_play',
    keywords: ['baby gym', 'activity gym', 'play gym', 'activity arch', 'baby arch'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Great for 0-6 months',
  },
  {
    id: 'bouncer_swing',
    label: 'Bouncer or swing',
    singular: 'Bouncer or swing',
    top_category: 'play',
    sub_category: 'infant_play',
    keywords: ['bouncer', 'swing', 'baby swing', 'baby bouncer', 'rocker', 'mamaroo', 'snoo'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Big sanity-saver in early months',
  },
  {
    id: 'rattles_sensory',
    label: 'Rattles & sensory toys',
    singular: 'Rattle or sensory toy',
    top_category: 'play',
    sub_category: 'infant_play',
    keywords: ['rattle', 'sensory', 'teether', 'crinkle', 'soft toy'],
    priority: 'nice_to_have',
    recommended: 4,
    hint: null,
  },

  // Active play
  {
    id: 'jumper_exersaucer',
    label: 'Jumper or exersaucer',
    singular: 'Jumper or exersaucer',
    top_category: 'play',
    sub_category: 'mobile_play',
    keywords: ['jumper', 'exersaucer', 'activity center', 'doorway jumper', 'jolly jumper'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Great for 4-10 months',
  },
  {
    id: 'push_walker',
    label: 'Push walker',
    singular: 'Push walker',
    top_category: 'play',
    sub_category: 'mobile_play',
    keywords: ['push walker', 'walking toy', 'push toy', 'baby walker'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Helps build confidence walking',
  },
  {
    id: 'stacking_blocks',
    label: 'Blocks',
    singular: 'Block set',
    top_category: 'play',
    sub_category: 'mobile_play',
    keywords: ['block', 'stacking', 'building block', 'soft block', 'wooden block'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: null,
  },
  {
    id: 'shape_sorter',
    label: 'Shape sorters & puzzles',
    singular: 'Shape sorter or puzzle',
    top_category: 'play',
    sub_category: 'mobile_play',
    keywords: ['shape sorter', 'puzzle', 'peg puzzle', 'knob puzzle'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: null,
    fallback: true,
  },

  // Books & learning
  {
    id: 'board_books',
    label: 'Board books',
    singular: 'Board book',
    top_category: 'play',
    sub_category: 'books_learning',
    keywords: ['board book', 'baby book', 'picture book', 'lift the flap'],
    priority: 'must_have',
    recommended: 6,
    hint: 'Start reading from day one',
    fallback: true,
  },
  {
    id: 'bath_books',
    label: 'Bath books',
    singular: 'Bath book',
    top_category: 'play',
    sub_category: 'books_learning',
    keywords: ['bath book', 'waterproof book', 'water book'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: 'Keeps bath time fun',
  },

  // Outdoor play
  {
    id: 'outdoor_blanket',
    label: 'Outdoor blanket',
    singular: 'Outdoor blanket',
    top_category: 'play',
    sub_category: 'outdoor_play',
    keywords: ['outdoor blanket', 'picnic mat', 'waterproof blanket', 'outdoor mat'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: null,
    fallback: true,
  },

  // ── HEALTH & SAFETY ───────────────────────────────────────────────────────

  // Health monitoring
  {
    id: 'thermometer',
    label: 'Thermometer',
    singular: 'Thermometer',
    top_category: 'health',
    sub_category: 'health_monitoring',
    keywords: ['thermometer', 'rectal thermometer', 'digital thermometer', 'temporal thermometer'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Rectal is most accurate for newborns',
    fallback: true,
  },
  {
    id: 'nasal_aspirator',
    label: 'Nasal aspirator',
    singular: 'Nasal aspirator',
    top_category: 'health',
    sub_category: 'health_monitoring',
    keywords: ['nasal aspirator', 'bulb syringe', 'nose frida', 'snot sucker', 'nasal suction'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Babies can\'t blow their noses',
  },
  {
    id: 'humidifier',
    label: 'Humidifier',
    singular: 'Humidifier',
    top_category: 'health',
    sub_category: 'health_monitoring',
    keywords: ['humidifier', 'cool mist', 'warm mist', 'ultrasonic humidifier'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Helps with congestion and dry air',
  },

  // Grooming
  {
    id: 'nail_clippers',
    label: 'Baby nail clippers',
    singular: 'Baby nail clippers',
    top_category: 'health',
    sub_category: 'grooming',
    keywords: ['nail clipper', 'nail file', 'baby nail', 'nail scissor'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Newborn nails are surprisingly sharp',
    fallback: true,
  },
  {
    id: 'baby_brush_comb',
    label: 'Baby brush & comb',
    singular: 'Baby brush and comb',
    top_category: 'health',
    sub_category: 'grooming',
    keywords: ['baby brush', 'baby comb', 'cradle cap brush', 'hair brush'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Also helps with cradle cap',
  },
  {
    id: 'medicine_dropper',
    label: 'Medicine dropper',
    singular: 'Medicine dropper',
    top_category: 'health',
    sub_category: 'grooming',
    keywords: ['medicine dropper', 'syringe', 'oral syringe', 'medicine syringe'],
    priority: 'must_have',
    recommended: 2,
    hint: 'Have one in the bathroom, one downstairs',
  },

  // Baby-proofing
  {
    id: 'outlet_covers',
    label: 'Outlet covers',
    singular: 'Outlet covers',
    top_category: 'health',
    sub_category: 'baby_safety',
    keywords: ['outlet cover', 'plug cover', 'socket cover', 'outlet protector'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Needed once baby is mobile (~6-9 months)',
    fallback: true,
  },
  {
    id: 'cabinet_locks',
    label: 'Cabinet locks',
    singular: 'Cabinet lock',
    top_category: 'health',
    sub_category: 'baby_safety',
    keywords: ['cabinet lock', 'drawer lock', 'magnetic lock', 'cabinet latch'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Kitchen and bathroom priority',
  },
  {
    id: 'baby_gate',
    label: 'Baby gates',
    singular: 'Baby gate',
    top_category: 'health',
    sub_category: 'baby_safety',
    keywords: ['baby gate', 'stair gate', 'safety gate', 'play gate', 'pressure gate'],
    priority: 'nice_to_have',
    recommended: 2,
    hint: 'Top and bottom of stairs',
  },
  {
    id: 'corner_guards',
    label: 'Corner guards',
    singular: 'Corner guards',
    top_category: 'health',
    sub_category: 'baby_safety',
    keywords: ['corner guard', 'edge guard', 'furniture protector', 'corner bumper'],
    priority: 'low_priority',
    recommended: 1,
    hint: 'For sharp furniture corners',
  },

  // ── BATH ──────────────────────────────────────────────────────────────────

  // Bath setup
  {
    id: 'baby_bathtub',
    label: 'Baby bathtub',
    singular: 'Baby bathtub',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['baby bathtub', 'baby tub', 'infant tub', 'bath tub', 'bath seat', 'bath ring', 'bath insert'],
    priority: 'must_have',
    recommended: 1,
    hint: null,
    fallback: true,
  },
  {
    id: 'hooded_towels',
    label: 'Hooded towels',
    singular: 'Hooded towel',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['hooded towel', 'baby towel', 'bath towel', 'hood towel'],
    priority: 'must_have',
    recommended: 3,
    hint: 'Softer and smaller than adult towels',
  },
  {
    id: 'washcloths',
    label: 'Washcloths',
    singular: 'Washcloth',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['washcloth', 'wash cloth', 'bath cloth', 'face cloth'],
    priority: 'must_have',
    recommended: 8,
    hint: 'Use for face and diaper area too',
  },
  {
    id: 'bath_mat',
    label: 'Bath mat',
    singular: 'Bath mat',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['bath mat', 'non-slip mat', 'bath rug', 'anti-slip mat'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Non-slip for inside the tub',
  },
  {
    id: 'bath_thermometer',
    label: 'Bath thermometer',
    singular: 'Bath thermometer',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['bath thermometer', 'water thermometer', 'bath temp'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Target 98-100°F',
  },
  {
    id: 'rinse_cup',
    label: 'Rinse cup',
    singular: 'Rinse cup',
    top_category: 'bath',
    sub_category: 'bath_setup',
    keywords: ['rinse cup', 'bath pitcher', 'pour cup', 'rinsing cup'],
    priority: 'low_priority',
    recommended: 1,
    hint: null,
  },

  // Bath products
  {
    id: 'baby_wash_shampoo',
    label: 'Baby wash & shampoo',
    singular: 'Baby wash or shampoo',
    top_category: 'bath',
    sub_category: 'bath_products',
    keywords: ['baby wash', 'baby shampoo', 'baby soap', 'tearless', 'gentle wash'],
    priority: 'must_have',
    recommended: 1,
    hint: 'Tearless formula',
    fallback: true,
  },
  {
    id: 'baby_lotion',
    label: 'Baby lotion',
    singular: 'Baby lotion',
    top_category: 'bath',
    sub_category: 'bath_products',
    keywords: ['baby lotion', 'baby cream', 'baby moisturizer', 'infant lotion'],
    priority: 'nice_to_have',
    recommended: 1,
    hint: 'Especially in dry climates',
  },
]

// ── Fast lookups ──────────────────────────────────────────────────────────────

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]))

// All items for a given top_category
export const ITEMS_BY_CATEGORY = ITEMS.reduce((acc, item) => {
  if (!acc[item.top_category]) acc[item.top_category] = []
  acc[item.top_category].push(item)
  return acc
}, {})

// All items for a given sub_category
export const ITEMS_BY_SUB_CATEGORY = ITEMS.reduce((acc, item) => {
  if (!acc[item.sub_category]) acc[item.sub_category] = []
  acc[item.sub_category].push(item)
  return acc
}, {})

// Ordered sub-categories per top_category (preserves insertion order above)
export const SUB_CATEGORIES_BY_CATEGORY = ITEMS.reduce((acc, item) => {
  if (!acc[item.top_category]) acc[item.top_category] = []
  if (!acc[item.top_category].includes(item.sub_category)) {
    acc[item.top_category].push(item.sub_category)
  }
  return acc
}, {})

// ── Item → slot mapping ────────────────────────────────────────────────────────
// Maps a beta.items row to its taxonomy slot. Matches on item_type keywords,
// with sub_category-scoped fallback for unmatched rows.
export function getItemSlot(item) {
  if (!item) return null
  const type = (item.item_type || '').toLowerCase().replace(/_/g, ' ')
  const topCat = item.top_category
  const subCat = item.sub_category
  if (!topCat || !subCat) return null

  // Pass 1: keyword match within same sub_category
  for (const slot of ITEMS) {
    if (slot.top_category !== topCat) continue
    if (slot.sub_category !== subCat) continue
    if (!slot.keywords || slot.keywords.length === 0) continue
    for (const kw of slot.keywords) {
      if (type.includes(kw.toLowerCase())) return slot
    }
  }

  // Pass 2: fallback slot for the sub_category
  const subSlots = ITEMS_BY_SUB_CATEGORY[subCat] || []
  return subSlots.find(s => s.fallback) || null
}

// ── Coverage computation ───────────────────────────────────────────────────────
// Returns one row per taxonomy slot for a given top_category, showing owned
// count vs recommended. Items in the items array are expected to already be
// filtered to the relevant household (done in HouseholdContext).
//
// Unlike clothing, there's no age-range axis for most items.
// Returns: [{ slot, ownedCount, recommended, needed, ownedItems, neededItems, status }]
export function computeCategorycoverage(items, topCategory) {
  const categoryItems = (items || []).filter(i => i.top_category === topCategory)
  const catSlots = ITEMS_BY_CATEGORY[topCategory] || []

  const bySlotOwned = {}
  const bySlotNeeded = {}

  for (const item of categoryItems) {
    const slot = getItemSlot(item)
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
  for (const slot of catSlots) {
    if ((slot.recommended || 0) <= 0) continue
    const ownedEntry = bySlotOwned[slot.id] || { count: 0, items: [] }
    const neededEntry = bySlotNeeded[slot.id] || { count: 0, items: [] }
    const ownedCount = ownedEntry.count
    const recommended = slot.recommended
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

// ── Summary coverage stats ─────────────────────────────────────────────────────
// Quick owned/recommended totals for a category — used in Home card subtitles
// and the category sidebar on Plan.
export function getCategorySummary(items, topCategory) {
  const rows = computeCategorycoverage(items, topCategory)
  let owned = 0
  let recommended = 0
  for (const row of rows) {
    owned += Math.min(row.ownedCount, row.recommended)
    recommended += row.recommended
  }
  return { owned, recommended: Math.max(recommended, 1) }
}

// ── Priority filter helpers ────────────────────────────────────────────────────
export const PRIORITY_LABEL = {
  must_have:     'Must have',
  nice_to_have:  'Nice to have',
  low_priority:  'Low priority',
}

export const PRIORITY_ORDER = ['must_have', 'nice_to_have', 'low_priority']
