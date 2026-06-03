// Guides registry — add new articles here.
// Each guide has metadata + a `sections` array rendered by GuideDetail.
//
// Section types:
//   { type: 'lede',  body }                  — intro paragraph (larger)
//   { type: 'note',  body }                  — callout box
//   { type: 'h2',    heading, body? }        — section heading + optional intro
//   { type: 'p',     body }                  — paragraph
//   { type: 'table', cols, rows }            — table with header row
//   { type: 'bullets', items }               — unordered list
//   { type: 'sources', items }               — source link list at bottom

export const GUIDES = [
  {
    slug: 'how-much-does-a-newborn-need',
    title: 'How Much Does a Newborn Actually Need?',
    subtitle: 'A category-by-category breakdown of real quantities — clothing, sleep, feeding, and more.',
    description: 'Real quantities by category for the 0–3 month window. Not aspirational numbers. Numbers that reflect how often a newborn actually goes through items and how fast they outgrow each size.',
    date: 'June 2026',
    readTime: '8 min',
    tags: ['Newborn', 'Planning', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance. Quantities and recommendations are drawn from pediatric sources, hospital checklists, and guidance from the American Academy of Pediatrics. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'One of the most common mistakes new parents make is buying too much of the wrong things — and not enough of the right ones. Newborn-size onesies that fit for three weeks. A stack of bibs nobody used because the baby wasn\'t eating solids yet. A single sleep sack that was in the wash every time you needed it. This guide gives you real numbers, by category, for the 0–3 month window.',
      },
      {
        type: 'note',
        body: 'Most babies outgrow "Newborn" size in 2–4 weeks. Babies born at 8 lbs or more often skip it entirely. The practical implication: buy fewer newborn-size items and more 0–3 month items. If your baby arrives on the larger side, you may not use newborn size at all.',
      },
      {
        type: 'h2',
        heading: 'Clothing',
        body: 'Expect 2–4 outfit changes per day in the newborn period. Diaper blowouts, spit-up, and milk dribbles are the main culprits. If your baby has reflux, plan for the higher end. These quantities assume laundry every 2–3 days.',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity'],
        rows: [
          ['Short-sleeve onesies / bodysuits', '6–8'],
          ['Long-sleeve onesies / bodysuits', '4–6'],
          ['Sleepers / footie pajamas', '5–7'],
          ['Zip-up sleep-and-plays', '4–6'],
          ['Soft pants or leggings', '3–4'],
          ['Hats (warmth, not sun)', '2–3'],
          ['Socks', '6–8 pairs'],
          ['Scratch mittens', '2–3 pairs'],
          ['Cardigan or light layer', '1–2'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Sleepers get dirty fast overnight — spit-up, diaper leaks, sweat. Having 5–7 means you\'re not doing laundry daily just to have clean ones.',
          'Zip closures beat snaps at 2am. This matters more than you think.',
          'Babies in the 0–3M window don\'t need "outfits." Comfortable layers and easy diaper access are what you actually want.',
          'If you wash laundry daily, cut quantities by about a third. If you wash once a week, double them.',
        ],
      },
      {
        type: 'h2',
        heading: 'Sleep',
        body: 'Sleep items are the category parents most often underbuy. You will use every single one.',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity'],
        rows: [
          ['Swaddle blankets / muslin wraps', '6–8'],
          ['Sleep sacks (wearable blankets)', '3–4'],
          ['Fitted crib or bassinet sheets', '3–4'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Most families use 2–4 swaddles per day — they get spit on, peed on, and used as burp cloths, nursing covers, and tummy time mats. 6–8 gives you breathing room between washes.',
          'The American Academy of Pediatrics recommends wearable blankets (sleep sacks) as the safe alternative to loose blankets in a newborn\'s sleep space. Avoid weighted sleep sacks — the AAP specifically advises against weighted sleep products for infants.',
          'Crib sheets get changed more than most parents expect. A diaper leak at 3am means changing the whole bed. Three to four sheets means you\'re never doing emergency laundry.',
        ],
      },
      {
        type: 'h2',
        heading: 'Feeding',
        body: 'Quantities here depend on whether you\'re breastfeeding, formula feeding, or both.',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity'],
        rows: [
          ['Burp cloths', '8–12'],
          ['Bibs (drool / feeding)', '4–6'],
          ['Bottles (if bottle feeding)', '6–10'],
          ['Extra bottle nipples', '4–6'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Burp cloths are the item most parents wish they had bought more of. A newborn who spits up frequently can go through 4–6 in a single day.',
          'If formula-feeding or pumping, newborns eat 8–12 times per day. Start with 4-oz bottles — a newborn\'s stomach holds about 1–3 oz per feeding in the first weeks, growing to 4–5 oz by 3 months.',
          'In the 0–3 month window, bibs are for drool and spit-up, not food. 4–6 is a reasonable starting point; add more if your baby is a heavy spitter.',
        ],
      },
      {
        type: 'h2',
        heading: 'Play',
        body: 'In the first 3 months, play is mostly lying on a soft surface, being held, looking at faces, and listening to sounds. Newborns can\'t grasp toys intentionally until around 3 months.',
      },
      {
        type: 'bullets',
        items: [
          '1–2 play mats or soft activity mats (useful for tummy time).',
          '1–2 soft rattles or sensory toys (for exposure, not sustained play).',
          'Skip the elaborate toy sets. Your face is the most interesting thing in the room at this stage.',
        ],
      },
      {
        type: 'h2',
        heading: 'Travel and gear',
        body: 'This category is less about quantity and more about having the right items before you leave the hospital.',
      },
      {
        type: 'bullets',
        items: [
          'Infant car seat — installed and inspected before the due date. Required to leave the hospital.',
          'Stroller or baby carrier — you need at least one, but not necessarily both from day one.',
          'Most big gear (high chairs, bouncers, play mats) gets used starting around 3–4 months, not from day one. Buying it before the baby arrives means it sits in your living room taking up space.',
        ],
      },
      {
        type: 'h2',
        heading: 'The laundry math',
        body: 'A single bad diaper blowout can generate: one onesie, one sleeper, one swaddle, one crib sheet, and two burp cloths — six items from a single incident. Have enough of each that one rough night doesn\'t leave you scrambling.',
      },
      {
        type: 'h2',
        heading: 'What to skip in newborn size',
      },
      {
        type: 'bullets',
        items: [
          'Shoes. Newborns don\'t walk. Socks do the same job.',
          'Jeans or structured pants. Hard waistbands on a baby who\'s lying down all day isn\'t comfortable for anyone.',
          'Outfits with lots of buttons. Adorable in photos. Miserable at 3am.',
          'Excessive "occasion" clothes. Newborns don\'t attend many occasions. One or two special outfits is plenty.',
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP Safe Sleep Guidelines', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'Babylist: How many baby clothes do I need?', url: 'https://www.babylist.com/hello-baby/how-many-baby-clothes-do-i-need' },
          { label: 'Huckleberry: How many baby clothes do you really need?', url: 'https://huckleberrycare.com/blog/how-many-baby-clothes-do-you-need' },
          { label: 'Consumer Reports: Swaddle and sleep sack safety', url: 'https://www.consumerreports.org/babies-kids/child-safety/swaddle-sleep-sack-safety-a9438047450/' },
          { label: 'The Bump: Baby feeding supplies checklist', url: 'https://www.thebump.com/a/checklist-babys-feeding-supplies' },
          { label: 'Little Hometown: How many swaddle blankets do you need?', url: 'https://littlehometown.com/blogs/little-blog-town/how-many-swaddle-blankets-do-new-parents-need' },
          { label: 'Mommy on Purpose: How many baby clothes do I need in each size?', url: 'https://mommyonpurpose.com/how-many-baby-clothes-do-i-need-in-each-size/' },
        ],
      },
    ],
  },
]

export function getGuide(slug) {
  return GUIDES.find(g => g.slug === slug) ?? null
}
