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

  // ── Clothing (additional) ─────────────────────────────────────────────────
  day_tops: {
    name: "Burt's Bees Baby Organic Short-Sleeve Tees",
    note: 'GOTS certified organic cotton, soft, no harsh dyes',
    url: search("burt's bees baby organic short sleeve tee tops"),
  },
  sweaters: {
    name: "Burt's Bees Baby Organic Cardigan",
    note: 'GOTS certified, soft layering piece, easy snap closures',
    url: search("burt's bees baby organic cardigan sweater"),
  },
  one_pieces: {
    name: "Burt's Bees Baby Organic Romper",
    note: 'GOTS certified organic cotton, snap-bottom for easy changes',
    url: search("burt's bees baby organic romper one piece"),
  },
  shorts: {
    name: "Simple Joys by Carter's Pull-On Shorts (3-pack)",
    note: 'Soft cotton blend, elastic waist, great value in multipacks',
    url: search("simple joys carter's baby pull-on shorts 3 pack"),
  },
  pants_leggings: {
    name: "Burt's Bees Baby Organic Pants (2-pack)",
    note: 'GOTS certified organic cotton, soft waistband, gender-neutral options',
    url: search("burt's bees baby organic pants leggings 2 pack"),
  },
  overalls: {
    name: "Carter's Baby Denim Overalls",
    note: 'Adjustable straps, easy snap closure, machine washable',
    url: search("carter's baby denim overalls snap closure"),
  },
  dresses: {
    name: "Burt's Bees Baby Organic Dress",
    note: 'GOTS certified, soft flutter sleeves, snap closure at bottom',
    url: search("burt's bees baby organic dress flutter sleeve"),
  },
  rain_gear: {
    name: 'Jan & Jul Toddler Rain Jacket',
    note: 'Waterproof, breathable, OEKO-TEX certified, folds into its own pocket',
    url: search('Jan Jul toddler rain jacket waterproof OEKO-TEX'),
  },
  snowsuits: {
    name: 'Columbia Baby Snuggly Bunny Bunting',
    note: 'Fully enclosed footies, water-resistant shell, machine washable',
    url: search('Columbia baby snuggly bunny bunting snowsuit'),
  },
  shoes: {
    name: 'Robeez Soft Sole Baby Shoes',
    note: 'Podiatrist recommended, flexible sole, stays on, safe for early walkers',
    url: search('Robeez soft sole baby shoes infant'),
  },
  boots: {
    name: 'Stonz Booties with Linerz',
    note: 'Stays on, waterproof shell, warm fleece liner, rated to -4°F',
    url: search('Stonz baby booties waterproof winter'),
  },
  sun_hats: {
    name: 'Jan & Jul Baby Sun Hat UPF 50+',
    note: 'UPF 50+, adjustable chin strap that actually stays on, wide brim',
    url: search('Jan Jul baby sun hat UPF 50 chin strap'),
  },
  hair_accessories: {
    name: 'Copper Pearl Baby Headband Set',
    note: 'Soft nylon, no-slip grip, gentle enough for newborns',
    url: search('copper pearl baby headband set newborn soft'),
  },

  // ── Sleep (additional) ────────────────────────────────────────────────────
  mattress_protector: {
    name: 'Naturepedic Waterproof Crib Mattress Pad',
    note: 'GOTS organic cotton top, waterproof, machine washable, chemical-free',
    url: search('Naturepedic waterproof crib mattress pad organic'),
  },
  blackout_curtains: {
    name: 'Deconovo Thermal Blackout Curtains',
    note: '99% blackout, machine washable, makes a real difference for naps',
    url: search('Deconovo blackout curtains nursery thermal'),
  },
  night_light: {
    name: 'Hatch Rest Baby Sound Machine and Night Light',
    note: 'App-controlled brightness and color, doubles as sound machine',
    url: search('Hatch Rest baby sound machine night light'),
  },

  // ── Feeding (additional) ──────────────────────────────────────────────────
  bottle_sterilizer: {
    name: 'Papablic Baby Bottle Electric Sterilizer and Dryer',
    note: 'Sterilizes and dries in one unit, fits most bottle brands',
    url: search('Papablic baby bottle electric sterilizer dryer'),
  },
  drying_rack: {
    name: 'OXO Tot Bottle Drying Rack',
    note: 'Grass-free design catches drips, dishwasher safe base, BPA-free',
    url: search('OXO Tot bottle drying rack'),
  },
  high_chair: {
    name: 'OXO Tot Sprout High Chair',
    note: 'GREENGUARD Gold certified, grows with child, wipes completely clean',
    url: search('OXO Tot Sprout high chair GREENGUARD'),
  },
  baby_spoons: {
    name: 'NumNum Pre-Spoon GOOtensils (2-pack)',
    note: 'Designed for self-feeding from first bites, BPA-free silicone',
    url: search('NumNum Pre-Spoon GOOtensils baby first spoon BPA free'),
  },
  baby_bowls: {
    name: 'Avanchy Bamboo Suction Baby Bowl with Lid',
    note: 'Bamboo and silicone, suction base that actually works, no BPA or BPS',
    url: search('Avanchy bamboo suction baby bowl lid'),
  },
  sippy_cup: {
    name: 'Munchkin Miracle 360 Trainer Cup',
    note: 'No-spill 360° rim, no spout or valve, teaches drinking like a real cup',
    url: search('Munchkin Miracle 360 trainer cup BPA free'),
  },
  silicone_placemat: {
    name: 'Bumkins Silicone Grip Mat',
    note: 'Food-grade silicone, suctions to most surfaces, dishwasher safe',
    url: search('Bumkins silicone grip mat placemat baby'),
  },
  baby_food_maker: {
    name: 'BEABA Babycook Neo Baby Food Maker',
    note: 'Steam + blend in one, glass bowl, no plastic contact with food or steam',
    url: search('BEABA Babycook Neo baby food maker steam blend'),
  },
  mesh_feeder: {
    name: 'Munchkin Fresh Food Feeder (2-pack)',
    note: 'BPA-free, easy to fill, great for frozen fruit during teething',
    url: search('Munchkin fresh food feeder mesh 2 pack BPA free'),
  },

  // ── Diapering (additional) ────────────────────────────────────────────────
  disposable_diapers: {
    name: 'Honest Company Clean Conscious Diapers',
    note: 'No chlorine, fragrances, or latex. Plant-based materials, hypoallergenic',
    url: search('Honest Company clean conscious diapers plant-based'),
  },
  cloth_diapers: {
    name: 'Thirsties Duo Wrap Cloth Diaper Cover',
    note: 'OEKO-TEX certified, adjustable snaps for long fit, highly rated',
    url: search('Thirsties Duo Wrap cloth diaper cover OEKO-TEX'),
  },
  swim_diapers: {
    name: 'iPlay Reusable Swim Diaper',
    note: 'UPF 50+, machine washable, eliminates single-use swim diaper waste',
    url: search('iPlay reusable swim diaper UPF 50'),
  },
  wipes: {
    name: 'WaterWipes Original Baby Wipes (9-pack)',
    note: '99.9% water, one natural ingredient, gentlest wipe available',
    url: search('WaterWipes original baby wipes 9 pack'),
  },
  diaper_pail: {
    name: 'Ubbi Steel Diaper Pail',
    note: 'Steel locks in odors (no special bags needed), works with any kitchen bag',
    url: search('Ubbi steel diaper pail odor locking'),
  },
  wipe_warmer: {
    name: 'Hiccapop Wipe Warmer',
    note: 'Keeps wipes moist, auto-off safety feature, fits most wipe brands',
    url: search('hiccapop wipe warmer baby changing'),
  },
  wet_bag: {
    name: 'Planet Wise Wet Bag (2-pack)',
    note: 'Waterproof, machine washable, OEKO-TEX certified, no plastic smell',
    url: search('Planet Wise wet bag 2 pack OEKO-TEX waterproof'),
  },

  // ── Travel (additional) ───────────────────────────────────────────────────
  stroller: {
    name: 'UPPAbaby Vista V3',
    note: 'Best full-size stroller. Converts single to double, best resale value.',
    url: search('UPPAbaby Vista V3 stroller'),
  },
  stroller_organizer: {
    name: 'J.L. Childress Cup & Stuff Stroller Organizer',
    note: 'Universal fit, two insulated cup holders, zip-front pocket',
    url: search('JL Childress cup stuff stroller organizer universal'),
  },
  stroller_bassinet: {
    name: 'UPPAbaby MINU Bassinet Accessory',
    note: 'Flat-lie bassinet for newborns, breathable mattress',
    url: search('stroller bassinet newborn flat lie breathable'),
  },
  car_seat_mirror: {
    name: 'Benbat Total Body Car Seat Mirror',
    note: 'Shatterproof, wide-angle view of rear-facing baby, easy to install',
    url: search('Benbat total body car seat mirror shatterproof rear facing'),
  },
  car_seat_protector: {
    name: 'JJ Cole Seat Saver Car Seat Protector',
    note: 'Non-slip, waterproof, won\'t void car seat warranty on most vehicles',
    url: search('JJ Cole seat saver car seat protector non-slip'),
  },
  ring_sling: {
    name: 'Sakura Bloom Scout Ring Sling',
    note: 'Linen and cotton blend, OEKO-TEX certified, beautiful and functional',
    url: search('Sakura Bloom Scout ring sling linen OEKO-TEX'),
  },
  portable_high_chair: {
    name: 'OXO Tot Perch Booster Seat with Straps',
    note: 'Folds flat, dishwasher-safe tray, straps to any chair',
    url: search('OXO Tot Perch booster seat with straps folds flat'),
  },

  // ── Play (additional) ─────────────────────────────────────────────────────
  bouncer_swing: {
    name: 'BABYBJÖRN Bouncer Bliss',
    note: 'OEKO-TEX certified cotton, no batteries needed, grows from newborn to 2 years',
    url: search('BABYBJORN Bouncer Bliss cotton OEKO-TEX'),
  },
  jumper_exersaucer: {
    name: 'Skip Hop Baby Activity Center',
    note: 'BPA-free, no batteries needed for core activities, wipeable seat pad',
    url: search('Skip Hop baby activity center exersaucer BPA free'),
  },
  push_walker: {
    name: 'Hape Wonder Walker',
    note: 'FSC-certified wood, adjustable resistance, no sharp edges, ASTM certified',
    url: search('Hape wonder walker wood push walker'),
  },
  shape_sorter: {
    name: 'Hape Shape Sorter',
    note: 'FSC-certified wood, water-based paint, no small parts below 18M recommendation',
    url: search('Hape shape sorter wooden FSC certified'),
  },
  bath_books: {
    name: 'Skip Hop Bath Soft Book Set',
    note: 'Mold-resistant design, squeaks, floats, develops sensory skills',
    url: search('Skip Hop baby bath books soft floating'),
  },
  outdoor_blanket: {
    name: 'ALDI/Amazon Waterproof Outdoor Picnic Blanket',
    note: 'Waterproof backing, machine washable, folds into compact carry bag',
    url: search('waterproof outdoor picnic blanket baby foldable machine washable'),
  },

  // ── Health (additional) ───────────────────────────────────────────────────
  humidifier: {
    name: 'Crane Drop Cool Mist Humidifier',
    note: 'BPA-free, 1-gallon tank, ultrasonic (no heated steam around baby)',
    url: search('Crane drop cool mist humidifier BPA free baby'),
  },
  nail_clippers: {
    name: 'FridaBaby NailFrida SnipperClipper Set',
    note: 'File and clips included, ergonomic for tiny nails, most recommended by parents',
    url: search('FridaBaby NailFrida SnipperClipper set baby nails'),
  },
  baby_brush_comb: {
    name: 'Frida Baby Head-to-Toe Care Kit',
    note: 'Includes brush, comb, and cradle cap tools — everything at once',
    url: search('FridaBaby head to toe care kit brush comb cradle cap'),
  },
  medicine_dropper: {
    name: 'FridaBaby MediFrida Pacifier Medicine Dispenser',
    note: 'Baby sucks medicine through a pacifier — no fighting or spitting',
    url: search('FridaBaby MediFrida PacifiDrip pacifier medicine dispenser'),
  },
  outlet_covers: {
    name: 'Safety 1st Outlet Plugs (36-pack)',
    note: 'Simple, inexpensive, tamper-resistant — covers every outlet in the house',
    url: search('Safety 1st outlet plugs 36 pack tamper resistant'),
  },
  cabinet_locks: {
    name: 'Safety 1st Magnetic Cabinet Locks (8-pack)',
    note: 'No-drill magnetic system, invisible from outside, works on most cabinets',
    url: search('Safety 1st magnetic cabinet locks no drill 8 pack'),
  },
  baby_gate: {
    name: 'Regalo Easy Step Walk Thru Baby Gate',
    note: 'Steel frame, pressure or wall-mount, one-touch open, fits 29–40 inch openings',
    url: search('Regalo easy step walk thru baby gate steel'),
  },
  corner_guards: {
    name: 'KidKusion Soft Corner Guard (8-pack)',
    note: 'Soft foam, strong adhesive, clear so it blends with any furniture',
    url: search('KidKusion soft corner guard foam clear furniture'),
  },

  // ── Bath ──────────────────────────────────────────────────────────────────
  baby_bathtub: {
    name: 'Summer Infant Fold n Store Tub',
    note: 'Newborn sling + toddler mode, folds flat for storage, non-slip',
    url: search('summer infant fold n store baby tub newborn sling'),
  },
  hooded_towels: {
    name: "Burt's Bees Baby Organic Hooded Towel (2-pack)",
    note: 'GOTS certified organic cotton, extra large, extra soft',
    url: search("burt's bees baby organic hooded towel 2 pack"),
  },
  washcloths: {
    name: "Burt's Bees Baby Organic Washcloths (6-pack)",
    note: 'GOTS certified organic cotton, gentle on newborn skin',
    url: search("burt's bees baby organic washcloths 6 pack"),
  },
  bath_mat: {
    name: 'Munchkin Sit & Soak Bath Mat',
    note: 'Anti-slip, fits standard tubs, color-change indicator shows when too hot',
    url: search('Munchkin sit soak baby bath mat non slip color change'),
  },
  bath_thermometer: {
    name: 'FridaBaby Quick-Read Digital Bath Thermometer',
    note: 'Reads in 3 seconds, floating design, alerts when water is too hot',
    url: search('FridaBaby quick read bath thermometer floating digital'),
  },
  rinse_cup: {
    name: 'Munchkin Rinse & Roll Rinse Cup',
    note: 'Soft silicone edge shields eyes, compact, BPA-free',
    url: search('Munchkin rinse roll rinse cup silicone baby'),
  },
  baby_wash_shampoo: {
    name: 'Mustela Gentle Cleansing Gel (Fragrance-Free)',
    note: 'Fragrance-free, dermatologist tested, safe for sensitive newborn skin',
    url: search('Mustela gentle cleansing gel fragrance free baby newborn'),
  },
  baby_lotion: {
    name: 'Aveeno Baby Daily Moisture Lotion (Fragrance-Free)',
    note: 'Oat-based, fragrance-free, clinically proven gentle for sensitive skin',
    url: search('Aveeno baby daily moisture lotion fragrance free sensitive'),
  },
}

/**
 * Get the affiliate product recommendation for a given slot or item ID.
 * Returns null if no recommendation exists.
 */
export function getWishlistProduct(slotId) {
  return WISHLIST_PRODUCTS[slotId] ?? null
}
