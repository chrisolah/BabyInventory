// Arrival checklist — slot definitions for the pre-birth countdown screen.
// Three tiers ordered by urgency relative to day one.
// Clothing slots are always shown for 0-3M only.
//
// Research sources: AAP Safe Sleep Guidelines 2025, The Bump, Taking Cara Babies,
// Newton Baby minimalist checklist, Pampers, Omega Pediatrics.
// Key findings:
//   - Car seat is the ONE thing hospitals check before discharge
//   - Warm hat is day-1 essential — newborns lose heat through their heads
//   - Bassinet preferred over crib for first months (AAP recommends room-sharing 6 months)
//   - Crib mattress is week-1 (most newborns start in bassinet)
//   - Bottles/nursing pillow are feeding-method-dependent — week-1
//   - Burp cloths needed immediately regardless of feeding method — Tier 1
//   - Hospitals provide nasal aspirator bulb to take home — still essential
//   - AAP still recommends swaddling (not weighted); sleep sacks for safe sleep
//   - Baby monitor: useful but not critical for day 1 — week-1 is correct

export const ARRIVAL_TIERS = [
  {
    id: 'day1',
    label: 'Before you leave the hospital',
    sub: 'Car seat is checked before discharge — have everything else ready at home',
    color: '#2D8C6E',
    slots: [
      // Travel — hospitals check this before you can leave
      { type: 'item', id: 'infant_car_seat', category: 'travel' },
      // Clothing — 0-3M (pack both NB and 0-3M; size unknown until birth)
      { type: 'clothing', id: 'bodysuits',      size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'one_pieces',     size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'footed_pajamas', size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'warm_hats',      size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'sleep_sacks',    size: '0-3M', category: 'clothing' },
      // Sleep — bassinet for room-sharing (AAP first 6 months recommendation)
      { type: 'item', id: 'bassinet',      category: 'sleep' },
      { type: 'item', id: 'fitted_sheets', category: 'sleep' },
      // Feeding — burp cloths needed immediately regardless of method
      { type: 'clothing', id: 'burp_cloths', size: '0-3M', category: 'clothing' },
      // Diapering
      { type: 'item', id: 'changing_pad', category: 'diapering' },
      { type: 'item', id: 'wipes',        category: 'diapering' },
      // Health
      { type: 'item', id: 'thermometer',     category: 'health' },
      { type: 'item', id: 'nasal_aspirator', category: 'health' },
    ],
  },
  {
    id: 'week1',
    label: 'First week home',
    sub: 'Get these in place before or right after coming home',
    color: '#3aab87',
    slots: [
      // Clothing — 0-3M
      { type: 'clothing', id: 'pants_leggings', size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'day_tops',       size: '0-3M', category: 'clothing' },
      // Sleep
      { type: 'item', id: 'crib_mattress',       category: 'sleep' },
      { type: 'item', id: 'white_noise_machine', category: 'sleep' },
      { type: 'item', id: 'baby_monitor',        category: 'sleep' },
      // Feeding — method-dependent; have these ready but not day-1 critical
      { type: 'item', id: 'bottles',        category: 'feeding' },
      { type: 'item', id: 'nursing_pillow', category: 'feeding' },
      { type: 'item', id: 'breast_pump',    category: 'feeding' },
      // Diapering
      { type: 'item', id: 'diaper_bag', category: 'diapering' },
      // Bath — sponge baths only until umbilical cord falls off (~2 weeks)
      { type: 'item', id: 'baby_bathtub',   category: 'bath' },
      { type: 'item', id: 'hooded_towels',  category: 'bath' },
      // Health
      { type: 'item', id: 'nail_clippers', category: 'health' },
    ],
  },
  {
    id: 'noRush',
    label: 'No rush',
    sub: 'Baby won\'t need these for weeks or months — revisit later',
    color: '#9ca3af',
    slots: [
      { type: 'item', id: 'high_chair',        category: 'feeding' },
      { type: 'item', id: 'bouncer_swing',     category: 'play' },
      { type: 'item', id: 'baby_food_maker',   category: 'feeding' },
      { type: 'item', id: 'diaper_pail',       category: 'diapering' },
      { type: 'item', id: 'blackout_curtains', category: 'sleep' },
      { type: 'item', id: 'baby_bowls',        category: 'feeding' },
      { type: 'item', id: 'sippy_cup',         category: 'feeding' },
    ],
  },
]
