// Wishlist affiliate product recommendations.
// Maps slot IDs (clothing) and item IDs (non-clothing) to a curated Amazon
// product link. All links use the sprigloop-20 associate tag.
//
// Curation criteria:
//   - 4+ star average on Amazon with substantial reviews
//   - Safe for infants (GOTS/OEKO-TEX for textiles, GREENGUARD Gold for gear)
//   - Widely recommended by pediatric sources and parent communities
//   - Something Sprigloop would be proud to associate with
//
// If no specific product fits, falls back to a targeted Amazon search.
// Links shown on wishlist cards (before claiming) and in the claim
// confirmation modal (after claiming).

const TAG = 'sprigloop-20'
const amz = (asin) => `https://www.amazon.com/dp/${asin}/?tag=${TAG}`
const search = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}&tag=${TAG}`

export const WISHLIST_PRODUCTS = {
  // ── Clothing slots ────────────────────────────────────────────────────────
  bodysuits: {
    name: "Burt's Bees Baby Organic Bodysuits",
    note: 'GOTS certified organic cotton, soft and chemical-free',
    url: search("burt's bees baby organic bodysuits"),
  },
  sleep_sacks: {
    name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack',
    note: 'GOTS certified, 2-way zipper, 0.5 TOG',
    url: amz('B0BMLT3M13'),
  },
  footed_pajamas: {
    name: "Carter's Zip-Up Footie Pajamas",
    note: 'Snag-free zipper, most-loved sleeper by parents',
    url: search("carter's zip up footie pajamas baby"),
  },
  two_piece_pajamas: {
    name: 'Simple Joys by Carter\'s 2-Piece Pajama Set',
    note: 'Snug fit, widely recommended, great value in multipacks',
    url: search("simple joys carter's baby 2 piece pajama set"),
  },
  sleep_gowns: {
    name: 'Burt\'s Bees Baby Sleep Gown',
    note: 'GOTS organic cotton, bottom-tie for quick night changes',
    url: search("burt's bees baby sleep gown organic"),
  },
  burp_cloths: {
    name: 'OXO Tot Burp Cloths (5-pack)',
    note: 'Extra absorbent, large coverage, washes well',
    url: search('baby burp cloths large absorbent 5 pack'),
  },
  bibs: {
    name: 'Bumkins Waterproof Sleeved Bib',
    note: 'Covers sleeves, catches everything, easy to wipe clean',
    url: search('bumkins waterproof sleeved bib baby'),
  },
  socks: {
    name: 'Simple Joys Baby Socks 20-Pack',
    note: 'Stay-on design, soft cotton, great value in bulk',
    url: search('simple joys baby socks 20 pack newborn'),
  },
  warm_hats: {
    name: 'Burt\'s Bees Baby Knit Hat',
    note: 'GOTS organic cotton, stays on, soft for sensitive skin',
    url: search("burt's bees baby knit hat organic"),
  },
  mittens: {
    name: 'VBVO No-Scratch Baby Mittens',
    note: 'Elastic wrist stays on, soft cotton, hospital-recommended',
    url: search('baby no scratch mittens newborn stay on'),
  },
  light_jackets: {
    name: 'Columbia Steens Mountain Baby Fleece',
    note: 'Lightweight, machine washable, excellent warmth-to-weight ratio',
    url: search('columbia steens mountain baby fleece jacket'),
  },
  winter_coats: {
    name: 'The North Face Baby Denali Jacket',
    note: 'Durable, warm, holds up through multiple seasons',
    url: search('north face baby winter jacket fleece'),
  },
  swimwear: {
    name: 'Simple Joys Baby Swimsuit with UPF 50+',
    note: 'UPF 50+ sun protection, comfortable fit',
    url: search('baby swimsuit UPF 50 sun protection infant'),
  },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  crib: {
    name: 'IKEA Sundvik Crib',
    note: 'Converts to toddler bed, clean design, GREENGUARD certified',
    url: search('IKEA sundvik crib convertible toddler'),
  },
  bassinet: {
    name: 'HALO Bassinest Swivel Sleeper',
    note: 'AAP-compliant, swivels for easy middle-of-night access',
    url: search('HALO bassinest swivel sleeper'),
  },
  pack_n_play: {
    name: 'Graco Pack n Play Playard',
    note: 'Most trusted portable crib brand, easy setup, folds flat',
    url: search('graco pack n play playard newborn'),
  },
  crib_mattress: {
    name: 'Newton Baby Crib Mattress',
    note: 'GREENGUARD Gold, 100% breathable, washable cover',
    url: search('newton baby crib mattress breathable GREENGUARD'),
  },
  fitted_sheets: {
    name: "Burt's Bees Baby Organic Fitted Crib Sheets (2-pack)",
    note: 'GOTS organic cotton, fitted stays on through night movements',
    url: search("burt's bees baby fitted crib sheet organic 2 pack"),
  },
  white_noise_machine: {
    name: 'LectroFan Classic White Noise Machine',
    note: 'Non-looping fan and white noise sounds, widely recommended by sleep consultants',
    url: search('LectroFan white noise machine baby sleep'),
  },
  baby_monitor: {
    name: 'HelloBaby HB6550 Video Monitor',
    note: 'No WiFi required, 30-hour battery, Amazon bestseller',
    url: search('HelloBaby HB6550 video baby monitor'),
  },

  // ── Feeding ───────────────────────────────────────────────────────────────
  breast_pump: {
    name: 'Spectra S2 Hospital Grade Breast Pump',
    note: 'Most recommended by lactation consultants — check insurance coverage first',
    url: search('Spectra S2 breast pump'),
  },
  nursing_pillow: {
    name: 'Boppy Original Nursing Pillow',
    note: 'Industry standard, doubles as tummy time support, machine washable',
    url: amz('B07VZSN584'),
  },
  nursing_pads: {
    name: 'Lansinoh Disposable Nursing Pads (100-count)',
    note: 'Contoured, stay-dry layer, most recommended by postpartum nurses',
    url: search('Lansinoh disposable nursing pads 100'),
  },
  nipple_cream: {
    name: 'Lansinoh HPA Lanolin Nipple Cream',
    note: 'Safe for baby, no need to wipe off before feeding, #1 recommended',
    url: search('Lansinoh HPA lanolin nipple cream'),
  },
  milk_storage: {
    name: 'Lansinoh Breastmilk Storage Bags (100-count)',
    note: 'Double-sealed, lays flat to freeze, most trusted brand',
    url: search('Lansinoh breast milk storage bags 100'),
  },
  bottles: {
    name: "Dr. Brown's Natural Flow Bottles (Newborn Set)",
    note: 'Slow-flow Level 1 nipples, widely recommended for reducing gas and colic',
    url: search("Dr Brown's natural flow bottles newborn set"),
  },
  bottle_brush: {
    name: 'Dr. Brown\'s Bottle Brush with Stand',
    note: 'Fits all Dr. Brown\'s bottles, soft on plastic',
    url: search("Dr Brown's bottle brush stand"),
  },

  // ── Diapering ─────────────────────────────────────────────────────────────
  diaper_rash_cream: {
    name: 'Aquaphor Baby Healing Ointment',
    note: 'Most recommended by pediatricians as a diaper rash barrier',
    url: search('Aquaphor baby healing ointment diaper rash'),
  },
  changing_pad: {
    name: 'Keekaroo Peanut Changing Pad',
    note: 'No cover needed, wipes clean in seconds, lifetime guarantee',
    url: search('keekaroo peanut changing pad wipe clean'),
  },
  changing_pad_covers: {
    name: 'Burt\'s Bees Baby Organic Changing Pad Cover (2-pack)',
    note: 'GOTS organic cotton, fitted, machine washable',
    url: search("burt's bees baby changing pad cover organic 2 pack"),
  },
  diaper_bag: {
    name: 'Freshly Picked Diaper Bag Backpack',
    note: 'Wipes clean, magnetic top closure, 12 pockets, built to last',
    url: search('freshly picked diaper bag backpack'),
  },

  // ── Travel ────────────────────────────────────────────────────────────────
  infant_car_seat: {
    name: 'Chicco KeyFit 35 Infant Car Seat',
    note: 'Consistently top-rated by Consumer Reports, load-leg base, easy to install',
    url: search('Chicco KeyFit 35 infant car seat'),
  },
  convertible_car_seat: {
    name: 'Graco Extend2Fit Convertible Car Seat',
    note: 'Extended rear-facing to 50 lbs, top safety ratings, great value',
    url: search('Graco Extend2Fit convertible car seat'),
  },
  structured_carrier: {
    name: 'Ergobaby Omni 360 Baby Carrier',
    note: 'Newborn-ready without insert, 4 carry positions, lumbar support',
    url: search('Ergobaby Omni 360 baby carrier all positions'),
  },
  wrap_carrier: {
    name: 'Solly Baby Wrap Carrier',
    note: 'TENCEL modal, lightweight, highly rated for newborn closeness',
    url: search('Solly Baby wrap carrier newborn'),
  },

  // ── Play ──────────────────────────────────────────────────────────────────
  play_mat: {
    name: 'Skip Hop Explore and More Activity Gym',
    note: 'Best activity gym for 0-6M, folds flat, multiple hanging elements',
    url: search('Skip Hop explore more activity gym tummy time'),
  },
  baby_gym: {
    name: 'Skip Hop Explore and More Activity Gym',
    note: 'Best activity gym for 0-6M, folds flat, multiple hanging elements',
    url: search('Skip Hop explore more activity gym tummy time'),
  },
  rattles_sensory: {
    name: 'Manhattan Toy Winkel Rattle',
    note: 'BPA-free, easy for newborns to grasp, classic for good reason',
    url: search('Manhattan Toy Winkel rattle newborn'),
  },
  board_books: {
    name: 'High Contrast Black & White Board Books for Newborns',
    note: 'Developmentally appropriate from birth, clinically shown to engage newborns',
    url: search('high contrast black white board books newborn'),
  },
  stacking_blocks: {
    name: 'Melissa & Doug Soft Stacking Blocks',
    note: 'Machine washable, safe for mouthing, 8 textures',
    url: search('Melissa Doug soft stacking blocks baby'),
  },

  // ── Health ────────────────────────────────────────────────────────────────
  thermometer: {
    name: 'FridaBaby 3-in-1 Digital Thermometer',
    note: 'Rectal, armpit, and oral — rectal is the only accurate method for newborns',
    url: search('FridaBaby 3-in-1 digital thermometer newborn rectal'),
  },
  nasal_aspirator: {
    name: 'FridaBaby NoseFrida Nasal Aspirator',
    note: 'Significantly more effective than a bulb syringe, recommended by pediatricians',
    url: search('FridaBaby NoseFrida nasal aspirator'),
  },

  // ── Bath ──────────────────────────────────────────────────────────────────
  baby_bath: {
    name: 'Summer Infant Fold n Store Tub',
    note: 'Grows with baby, folds flat for storage, non-slip',
    url: search('summer infant baby tub newborn sling'),
  },
  baby_wash: {
    name: "Mustela Gentle Cleansing Gel (Fragrance-Free)",
    note: 'Fragrance-free, dermatologist tested, safe from day one',
    url: search('Mustela gentle cleansing gel fragrance free baby'),
  },
  baby_lotion: {
    name: "Aveeno Baby Daily Moisture Lotion",
    note: 'Fragrance-free, oat-based, dermatologist recommended for sensitive skin',
    url: search('Aveeno baby daily moisture lotion fragrance free'),
  },
}

/**
 * Get the affiliate product recommendation for a given slot or item ID.
 * Returns null if no recommendation exists.
 */
export function getWishlistProduct(slotId) {
  return WISHLIST_PRODUCTS[slotId] ?? null
}
