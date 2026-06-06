// Arrival checklist — slot definitions for the pre-birth countdown screen.
// Three tiers ordered by urgency relative to day one.
// Clothing slots are always shown for 0-3M only.

export const ARRIVAL_TIERS = [
  {
    id: 'day1',
    label: 'Before you leave the hospital',
    sub: 'Need these on day one',
    color: '#2D8C6E',
    slots: [
      // Clothing — 0-3M only
      { type: 'clothing', id: 'bodysuits',      size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'one_pieces',     size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'footed_pajamas', size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'sleep_sacks',    size: '0-3M', category: 'clothing' },
      // Sleep
      { type: 'item', id: 'bassinet',       category: 'sleep' },
      { type: 'item', id: 'crib_mattress',  category: 'sleep' },
      { type: 'item', id: 'fitted_sheets',  category: 'sleep' },
      // Travel
      { type: 'item', id: 'infant_car_seat', category: 'travel' },
      // Feeding
      { type: 'item', id: 'bottles',        category: 'feeding' },
      { type: 'item', id: 'nursing_pillow', category: 'feeding' },
      // Diapering
      { type: 'item', id: 'changing_pad',   category: 'diapering' },
      { type: 'item', id: 'wipes',          category: 'diapering' },
      // Health
      { type: 'item', id: 'thermometer',    category: 'health' },
      { type: 'item', id: 'nasal_aspirator',category: 'health' },
    ],
  },
  {
    id: 'week1',
    label: 'First week home',
    sub: 'Get these before or shortly after arrival',
    color: '#3aab87',
    slots: [
      // Clothing — 0-3M
      { type: 'clothing', id: 'pants_leggings', size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'day_tops',       size: '0-3M', category: 'clothing' },
      { type: 'clothing', id: 'warm_hats',      size: '0-3M', category: 'clothing' },
      // Sleep
      { type: 'item', id: 'baby_monitor',        category: 'sleep' },
      { type: 'item', id: 'white_noise_machine', category: 'sleep' },
      // Feeding
      { type: 'item', id: 'breast_pump',         category: 'feeding' },
      { type: 'item', id: 'burp_cloths',         category: 'feeding' },
      // Diapering
      { type: 'item', id: 'diaper_bag',          category: 'diapering' },
      // Bath
      { type: 'item', id: 'baby_bathtub',        category: 'bath' },
      { type: 'item', id: 'hooded_towels',       category: 'bath' },
      // Health
      { type: 'item', id: 'nail_clippers',       category: 'health' },
    ],
  },
  {
    id: 'noRush',
    label: 'No rush',
    sub: 'Nice to have — baby won\'t need these for weeks or months',
    color: '#9ca3af',
    slots: [
      { type: 'item', id: 'high_chair',       category: 'feeding' },
      { type: 'item', id: 'bouncer_swing',    category: 'play' },
      { type: 'item', id: 'baby_food_maker',  category: 'feeding' },
      { type: 'item', id: 'diaper_pail',      category: 'diapering' },
      { type: 'item', id: 'blackout_curtains',category: 'sleep' },
    ],
  },
]
