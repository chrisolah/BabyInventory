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
    lastmod: '2026-06-03',
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
        type: 'products',
        items: [
          {
            emoji: '🛌',
            name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack (0–6M)',
            note: 'GOTS certified, 2-way zipper, 0.5 TOG — best value for the newborn window',
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20',
          },
          {
            emoji: '🤍',
            name: 'Muslin Swaddle Blankets (4-pack)',
            note: 'Large enough to actually swaddle, gets softer with every wash',
            url: 'https://www.amazon.com/s?k=muslin+swaddle+blankets+newborn+4+pack&tag=sprigloop-20',
          },
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
        type: 'products',
        items: [
          {
            emoji: '🧻',
            name: 'Baby Burp Cloths — Large Cotton (10-pack)',
            note: 'Thicker cloth diaper style outlasts the thin printed kind — buy in bulk',
            url: 'https://www.amazon.com/s?k=baby+burp+cloths+large+cotton+10+pack&tag=sprigloop-20',
          },
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

  // ── Guide 2 ──────────────────────────────────────────────────────────────
  {
    slug: 'when-does-baby-outgrow-each-size',
    title: 'When Will My Baby Outgrow Each Size?',
    subtitle: 'A realistic timeline for every size from newborn through 18 months — plus what to have ready before each transition.',
    description: 'Most size guides tell you what fits. This one tells you how long it actually lasts — and what you need to have ready before the next size arrives.',
    date: 'June 2026',
    lastmod: '2026-06-03',
    readTime: '6 min',
    tags: ['Planning', 'Sizing', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from pediatric growth data, brand sizing charts, and parenting guidance. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Baby clothing sizes are one of the most misleading things in parenting. The labels say "3 months" but the clothes might fit at 6 weeks or not until 4 months depending on your baby. This guide gives you a realistic timeline for each size — based on weight, not just age — and tells you what to have ready before each transition so you\'re never caught with an empty drawer.',
      },
      {
        type: 'note',
        body: 'Weight is a better guide than age. Two babies born the same week can wear completely different sizes. Always check weight and length against brand sizing charts rather than going strictly by the age label.',
      },
      {
        type: 'h2',
        heading: 'The size timeline',
        body: 'These are averages based on typical growth curves. Your baby may move faster or slower through any of these windows.',
      },
      {
        type: 'table',
        cols: ['Size', 'Weight range', 'Typical duration', 'When to buy next size'],
        rows: [
          ['Newborn (NB)', '5–8 lbs', '2–4 weeks', 'Before baby arrives — buy only 4–6 items'],
          ['0–3 months', '8–12 lbs', '6–10 weeks', 'Around 4–6 weeks after birth'],
          ['3–6 months', '12–16 lbs', '8–10 weeks', 'Around 3 months'],
          ['6–9 months', '16–19 lbs', '6–8 weeks', 'Around 5 months'],
          ['9–12 months', '19–22 lbs', '8–10 weeks', 'Around 7–8 months'],
          ['12–18 months', '22–27 lbs', '3–4 months', 'Around 10–11 months'],
          ['18–24 months', '27–30 lbs', '3–5 months', 'Around 14 months'],
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🏷️',
            name: 'Baby Closet Dividers by Size (NB–24M)',
            note: 'Keeps each size section separate so you can find next-size items instantly',
            url: 'https://www.amazon.com/s?k=baby+closet+dividers+by+size+newborn+24+months&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'Newborn (NB): buy almost nothing',
        body: 'Most parents overbuy newborn size. Babies born at 8 lbs or more often skip it entirely, and even smaller babies are usually out of it within a month. Stick to 4–6 items maximum. If they fit longer, you can always add more — but you can\'t return the stack of outfits already washed and worn once.',
      },
      {
        type: 'h2',
        heading: '0–3 months: your main investment',
        body: 'This is the size your baby will spend the most time in during the first stretch. It\'s worth having a full set here — 6–8 onesies, 5–7 sleepers, 6–8 swaddles. The 0–3M window typically lasts 6–10 weeks, though fast-growing babies can push through it in 4.',
      },
      {
        type: 'h2',
        heading: '3–6 months: where gaps catch parents off guard',
        body: 'Many parents are so focused on the newborn phase that they underprepare for 3–6M. Then suddenly the 0–3M clothes stop fitting, and there\'s nothing clean in the next size. Start buying 3–6M items by about 4–6 weeks after birth, while you still have time to wash and organize before you need them.',
      },
      {
        type: 'h2',
        heading: '6 months and beyond: slow down',
        body: 'Growth slows slightly after 6 months. Sizes start lasting longer — 6–9M typically runs 6–8 weeks, and by 12–18 months you\'re getting 3–4 months out of a size. You have more lead time, and secondhand options become much more available as babies this age have worn each item less.',
      },
      {
        type: 'h2',
        heading: 'Signs your baby is ready to size up',
        body: 'Don\'t wait for the size label to tell you — watch the baby.',
      },
      {
        type: 'bullets',
        items: [
          'Snaps at the crotch are straining or won\'t close flat.',
          'Feet are curled up inside footie pajamas.',
          'Necklines are tight or hard to get over the head.',
          'Diaper changes are getting cramped inside onesies.',
          'Sleeves or legs are visibly short.',
        ],
      },
      {
        type: 'h2',
        heading: 'A note on seasonal timing',
        body: 'If your baby will be in 3–6M during winter, you need warmer layers in that size. If they\'ll be in 6–9M during summer, light onesies are what you need. Work out the season your baby will be in each size before you buy — it changes the items significantly. A winter 3–6M drawer looks completely different from a summer one.',
      },
      {
        type: 'sources',
        items: [
          { label: 'Dreft: Newborn and baby clothes sizes', url: 'https://www.dreft.com/en-us/parenting-tips/after-baby-arrives/newborn-and-baby-clothes-sizes' },
          { label: 'Care.com: Baby clothes sizes explained', url: 'https://www.care.com/c/baby-clothes-sizes-explained/' },
          { label: 'Little Hometown: Preemie to toddler sizing guide', url: 'https://littlehometown.com/blogs/little-blog-town/preemie-to-toddler-sizing-guide-for-every-stage-of-baby-growth' },
          { label: 'Babylist: Baby gear timeline', url: 'https://www.babylist.com/hello-baby/babys-first-year-basics' },
        ],
      },
    ],
  },

  // ── Guide 3 ──────────────────────────────────────────────────────────────
  {
    slug: 'what-to-do-with-outgrown-baby-clothes',
    title: 'What to Do With Outgrown Baby Clothes',
    subtitle: 'Your options — from passing them on to another family to donating, selling, and storing — and how to decide which makes sense.',
    description: 'Babies outgrow clothes faster than almost anything else you own. Here\'s a practical breakdown of every option for what to do with them, and how to decide.',
    date: 'June 2026',
    lastmod: '2026-06-03',
    readTime: '5 min',
    tags: ['Pass Along', 'Sustainability', 'Decluttering'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from parenting guides, sustainability data, and textile waste research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'A newborn goes through up to six sizes in their first year. Each size window lasts 6–10 weeks. That means by the time your baby turns one, you\'ve accumulated — and outgrown — six rounds of clothes. What you do with them matters, both for your space and for the clothes themselves.',
      },
      {
        type: 'note',
        body: 'Only 15% of used clothing in the US gets recycled or donated — the rest goes to landfill. Baby clothes are especially wasteful because they\'re often in near-perfect condition when outgrown. Every item that finds a second use is one less manufactured new.',
      },
      {
        type: 'h2',
        heading: 'Option 1: Pass them to another family',
        body: 'The most direct option. A friend, sibling, or coworker with a baby in the next size down gets clothes that have already been washed, worn, and proven. You know the quality because you bought them. They get a full set of real items instead of guessing from a registry.',
      },
      {
        type: 'bullets',
        items: [
          'Best for: clothes in good condition you genuinely want to see used again.',
          'Works best when: you know someone whose baby is 2–4 sizes behind yours.',
          'The friction: coordinating pickup, drop-off, or shipping. Most parents mean to do this and then the bag sits in a corner for months.',
        ],
      },
      {
        type: 'h2',
        heading: 'Option 2: Pass them to a Sprigloop family',
        body: 'If you don\'t have someone specific in mind, Sprigloop matches outgrown clothes to families who\'ve opted in to receive them. You request a prepaid bag, fill it when you\'re ready, and drop it in any mailbox. Sprigloop routes it to a matched household. No coordination needed on either end.',
      },
      {
        type: 'h2',
        heading: 'Option 3: Donate',
        body: 'Charities, shelters, and local organizations accept gently used baby clothes and distribute them to families who need them. The logistics are simple — most have drop-off locations or will schedule a pickup.',
      },
      {
        type: 'bullets',
        items: [
          'Goodwill and Salvation Army accept most baby clothing with no appointment.',
          'Local shelters and baby banks often need specific sizes — calling ahead to ask what\'s most needed gets your donation where it helps most.',
          'Churches frequently distribute donated baby items directly to families in the congregation or community.',
          'What not to donate: stained or heavily worn items, recalled gear, expired car seats.',
        ],
      },
      {
        type: 'h2',
        heading: 'Option 4: Sell',
        body: 'Baby clothes resell well because they\'re worn so briefly. You can recoup 20–40% of retail price for common brands, and significantly more for premium brands in good condition.',
      },
      {
        type: 'bullets',
        items: [
          'Facebook Marketplace and local buy/sell/trade groups are the fastest options with no shipping.',
          'Poshmark and ThredUp work well for higher-end brands but take a commission.',
          'Consignment shops give you cash or store credit on the spot for accepted items.',
          'Selling works best in batches — listing individual onesies isn\'t worth the time. Bundle by size and sell as a lot.',
        ],
      },
      {
        type: 'h2',
        heading: 'Option 5: Store for a future sibling',
        body: 'Worth doing for items in excellent condition if you\'re planning another child within a few years. Storage gets impractical fast though — most parents end up with far more than they\'ll realistically use again.',
      },
      {
        type: 'bullets',
        items: [
          'Store in airtight bins labeled by size to avoid the chaos of a mystery bag of mixed clothes.',
          'Be selective: 10–15 items per size is plenty. More than that and nothing is ever actually organized when you need it.',
          'Items stored more than 2–3 years may have elastic degradation or fabric discoloration even in good conditions.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '📦',
            name: 'Clear Storage Bins with Lids — Set of 6',
            note: 'Label each bin by size. Clear sides let you see contents without opening',
            url: 'https://www.amazon.com/s?k=clear+storage+bins+with+lids+baby+clothes&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'The one thing that stops most parents from doing any of this',
        body: 'It\'s not sentiment. It\'s friction. The bag of outgrown clothes sits by the door for three months because passing them on requires coordination, driving somewhere, or figuring out shipping. The path of least resistance is to leave them in the closet until they go in the next purge — which is usually a landfill-bound donation run to whoever is convenient. Having a system before the clothes outgrow makes all the difference.',
      },
      {
        type: 'sources',
        items: [
          { label: 'Happiest Baby: What to do with old clothes, toys, and baby gear', url: 'https://www.happiestbaby.com/blogs/parents/outgrown-baby-clothes-toys' },
          { label: 'Motherly: 7 places to donate baby clothes', url: 'https://www.mother.ly/baby/where-to-donate-baby-clothes/' },
          { label: 'Earth.org: Textile waste statistics', url: 'https://earth.org/statistics-about-fast-fashion-waste/' },
          { label: 'UpChoose: What to do with old baby clothes', url: 'https://www.upchoose.com/blog/what-to-do-with-old-baby-clothes' },
        ],
      },
    ],
  },

  // ── Guide 4 ──────────────────────────────────────────────────────────────
  {
    slug: 'baby-registry-what-you-actually-need',
    title: 'Baby Registry: What You Actually Need',
    subtitle: 'A no-nonsense breakdown of what to register for, what to skip, and how to build a list that helps people actually help you.',
    description: 'Most first-time parents don\'t struggle because they forgot something important. They struggle because they registered for too many things they don\'t need. Here\'s what actually matters.',
    date: 'June 2026',
    lastmod: '2026-06-03',
    readTime: '7 min',
    tags: ['Registry', 'Planning', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from parenting guides, pediatric recommendations, and registry advice from experienced parents and doulas. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'A well-planned registry can save a family $3,000–$5,000 through gifts, completion discounts, and — most importantly — not buying things you don\'t need. Most first-time parents don\'t struggle because they forgot something important. They struggle because they bought too many things that sounded essential and weren\'t. This guide cuts through that.',
      },
      {
        type: 'note',
        body: 'Newborn life is simple: sleep, feed, change, repeat. Most of what you need in the first month fits in one room. The gear for months 3–6 (bouncers, play mats, high chairs) can wait — you\'ll have a much better sense of your baby\'s preferences by then anyway.',
      },
      {
        type: 'h2',
        heading: 'The essentials: what you genuinely need before birth',
      },
      {
        type: 'table',
        cols: ['Category', 'What to register for', 'Quantity'],
        rows: [
          ['Sleep', 'Bassinet or crib with firm mattress', '1'],
          ['Sleep', 'Fitted crib/bassinet sheets', '3–4'],
          ['Sleep', 'Sleep sacks (wearable blankets)', '3–4'],
          ['Sleep', 'Swaddle blankets', '6–8'],
          ['Feeding', 'Burp cloths', '8–12'],
          ['Feeding', 'Bottles + nipples (if bottle feeding)', '6–10'],
          ['Feeding', 'Nursing pillow (if breastfeeding)', '1'],
          ['Diapering', 'Changing pad + covers', '1 + 2–3 covers'],
          ['Diapering', 'Diapers, wipes, rash cream', 'Stock up'],
          ['Clothing', 'Onesies, sleepers (0–3M)', '6–8 of each'],
          ['Travel', 'Infant car seat', '1 (required)'],
          ['Travel', 'Stroller or baby carrier', '1'],
          ['Bath', 'Baby tub, washcloths, gentle wash', '1 tub'],
          ['Health', 'Thermometer, nail file, nasal aspirator', '1 each'],
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🛌',
            name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack',
            note: 'GOTS certified, 2-way zipper — the single most-used item in the first year',
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20',
          },
          {
            emoji: '🧻',
            name: 'Baby Burp Cloths — Large Cotton (10-pack)',
            note: 'Buy more than you think you need. These are the item parents wish they had doubled up on.',
            url: 'https://www.amazon.com/s?k=baby+burp+cloths+large+cotton+10+pack&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'What can wait until after birth',
        body: 'These items are useful — but not before you\'ve met your baby. Register for them if you want, but don\'t stress if they\'re not arrived before the due date.',
      },
      {
        type: 'bullets',
        items: [
          'Baby carrier or wrap — fit and comfort vary so much by body type that many parents try multiple before finding one that works. Some hospitals have lending libraries.',
          'Bouncer or swing — some babies love them, others ignore them entirely. Hard to know until they\'re here.',
          'High chair — not needed until 4–6 months when solids start.',
          'Play mat and activity gym — useful from about 8 weeks for tummy time, but not day one.',
          'Baby monitor — only necessary once baby is sleeping in a separate room.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to skip entirely',
      },
      {
        type: 'bullets',
        items: [
          'Wipe warmer — sounds luxurious, dries out wipes and creates bacteria-friendly warmth.',
          'Bottle sterilizer — dishwasher or boiling water does the same job and takes no counter space.',
          'Diaper pail with proprietary refills — a regular trash can with a lid and frequent emptying works fine.',
          'Shoes — newborns don\'t walk. Socks are sufficient until they\'re standing.',
          'Baby food maker — a blender you already own does exactly the same thing.',
          'Changing table as a separate piece of furniture — a changing pad on a dresser you already own is identical and takes less space.',
          'Newborn-specific items in large quantities — wash basins for newborn baths, "newborn" pacifiers, NB-only size accessories. All outgrown within weeks.',
        ],
      },
      {
        type: 'h2',
        heading: 'The problem with most registries',
        body: 'Most registry tools are built by stores that benefit from you adding more items. The result is a 200-item list where your family doesn\'t know what\'s actually needed versus what\'s aspirational. The more useful approach: register for things you\'ve specifically researched and decided on, with clear quantities, organized by category. When someone buys from a targeted list, they\'re filling a real gap — not guessing.',
      },
      {
        type: 'h2',
        heading: 'A better kind of registry',
        body: 'Sprigloop\'s registry works differently from a traditional registry. Instead of manually curating a list of products, it shows family and friends your actual gaps — what you\'re missing by category and size — so they can fill something real. No store account required on their end, no duplicates, no generic suggestions.',
      },
      {
        type: 'sources',
        items: [
          { label: 'Babylist: Baby registry checklist', url: 'https://www.babylist.com/baby-registry-checklist' },
          { label: 'Safe in the Seat: Must-have registry items', url: 'https://www.safeintheseat.com/post/must-have-baby-registry-items' },
          { label: 'Western CT Doula: Avoid registry overwhelm', url: 'https://www.westernctdoula.com/avoid-baby-registry-overwhelm-what-you-actually-need-and-what-you-can-skip' },
          { label: 'Worthy Pause: Minimalist baby registry', url: 'https://www.worthypause.com/blog/simple-minimalist-baby-registry-for-parents-who-kind-of-hate-baby-stuff' },
        ],
      },
    ],
  },

  // ── Guide 5 ──────────────────────────────────────────────────────────────
  {
    slug: 'how-to-organize-baby-clothes-by-size',
    title: 'How to Organize Baby Clothes by Size',
    subtitle: 'A practical system for keeping track of what fits now, what\'s coming up, and what\'s been outgrown — without losing your mind.',
    description: 'Baby clothes come in fast and outgrow faster. Here\'s a simple, practical system for organizing by size so you always know what you have and what you need.',
    date: 'June 2026',
    lastmod: '2026-06-03',
    readTime: '5 min',
    tags: ['Organization', 'Planning', 'Inventory'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from nursery organization guides and parenting advice. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'The organization problem with baby clothes isn\'t having too few storage options. It\'s that sizes rotate every 6–10 weeks. What\'s in active use changes constantly, what\'s coming next needs to be ready, and what\'s outgrown needs to leave before it takes over. A good system handles all three simultaneously.',
      },
      {
        type: 'h2',
        heading: 'The core principle: three zones',
        body: 'Everything in your baby\'s clothes situation falls into one of three zones. Design your storage around them.',
      },
      {
        type: 'table',
        cols: ['Zone', 'What belongs here', 'Where to keep it'],
        rows: [
          ['Active', 'Current size — what fits right now', 'Dresser drawers, within easy reach'],
          ['Incoming', 'Next 1–2 sizes — washed and ready', 'Top shelf of closet or labeled bin'],
          ['Outgrown', 'Doesn\'t fit anymore', 'Separate labeled bin — move out regularly'],
        ],
      },
      {
        type: 'h2',
        heading: 'Setting up the active drawer',
        body: 'The active drawer should be organized so you can grab what you need at 3am without thinking. That means grouping by type, not by brand or color.',
      },
      {
        type: 'bullets',
        items: [
          'Top drawer: daily essentials — onesies, sleepers, bibs. These get used multiple times a day.',
          'Second drawer: layers, pants, socks, mittens.',
          'Third drawer: special occasion items, seasonal pieces, extras.',
          'Drawer dividers help enormously. Without them, everything collapses into a single pile within a week.',
          'File-folding (standing clothes upright like files) lets you see everything at once without pulling out the whole drawer.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🗂️',
            name: 'Baby Dresser Drawer Organizers',
            note: 'Keeps onesies, sleepers, and pants separated in the same drawer',
            url: 'https://www.amazon.com/s?k=baby+dresser+drawer+organizer+dividers&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'The incoming bin: always be one size ahead',
        body: 'The most common organization failure is being unprepared for size transitions. Your baby fits 0–3M on Monday and by Friday none of it closes. If the 3–6M bin isn\'t washed and ready, you\'re doing emergency laundry in the middle of the night.',
      },
      {
        type: 'bullets',
        items: [
          'Keep the next size washed, folded, and in a labeled bin on the closet shelf.',
          'Check the bin 2–3 weeks before you expect to need it — confirm you have enough of each type.',
          'Pre-washing is important: new clothes often have residual dye and sizing chemicals that can irritate baby skin.',
        ],
      },
      {
        type: 'h2',
        heading: 'The outgrown bin: get it out of the active zone',
        body: 'Outgrown clothes in the active drawer create confusion — you pull something out, realize it doesn\'t fit, put it back. Having a dedicated outgrown bin next to the dresser makes the decision easy: if it\'s too small, it goes in the bin, not back in the drawer. Once the bin is full, that\'s your pass-along or donation batch.',
      },
      {
        type: 'h2',
        heading: 'Labeling',
        body: 'Label everything by size, not by age. "3–6M" is more accurate than "3 months" because your baby\'s actual age when wearing each size will vary. A label maker is useful but not necessary — masking tape and a marker works fine for bins.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '📦',
            name: 'Clear Storage Bins with Lids — Set of 6',
            note: 'One bin per size range. Clear sides so you can see what\'s inside without opening.',
            url: 'https://www.amazon.com/s?k=clear+storage+bins+lids+set+baby+clothes&tag=sprigloop-20',
          },
          {
            emoji: '🏷️',
            name: 'Baby Closet Dividers by Size (NB–24M)',
            note: 'Keeps the closet sorted so hand-me-downs land in the right section immediately',
            url: 'https://www.amazon.com/s?k=baby+closet+dividers+by+size&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'The digital layer',
        body: 'Physical organization handles the drawer. The harder problem is knowing what you actually have across all three zones — what\'s in the incoming bin, what\'s been set aside for pass-along, what you\'re missing before the next size arrives. Most parents track this in their head, which works until it doesn\'t.',
      },
      {
        type: 'bullets',
        items: [
          'Sprigloop\'s Inventory tab lets you log what you have by size and category — so you can check from anywhere without digging through bins.',
          'The Plan tab shows gaps in upcoming sizes before you need them, so there\'s no surprise when the size transition hits.',
          'When something gets outgrown, marking it in the app keeps your inventory accurate and triggers the pass-along flow when you\'re ready.',
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Newton Baby: How to organize baby clothes', url: 'https://www.newtonbaby.com/blogs/nursery/how-to-organize-baby-clothes' },
          { label: 'One Sweet Nursery: How to organize baby clothes by size', url: 'https://www.onesweetnursery.com/how-to-organize-baby-clothes-by-size/' },
          { label: 'The Every Mom: How to organize baby\'s dresser', url: 'https://theeverymom.com/how-to-organize-your-babys-dresser/' },
          { label: 'Extra Space Storage: How to organize baby clothes', url: 'https://www.extraspace.com/blog/home-organization/how-to-organize-baby-clothes/' },
        ],
      },
    ],
  },
  // ── Guide 7a: Splurge vs Save ────────────────────────────────────────────
  {
    slug: 'baby-gear-splurge-vs-save',
    title: 'Where to Spend Top Dollar on Baby Gear — and Where Not To',
    subtitle: 'A no-nonsense guide to what actually justifies the premium and what you\'re just paying for marketing.',
    description: 'Not all expensive baby gear is worth it. And some things you should definitely not cheap out on. Here\'s the real breakdown by category.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '7 min',
    tags: ['Buying', 'Registry', 'Planning'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from parenting guides, consumer safety research, and verified parent reviews. It contains affiliate links to Amazon.',
    planCategory: 'clothing',
    sections: [
      {
        type: 'lede',
        body: 'Registry culture has a way of making everything feel essential. The $1,800 smart bassinet. The $70 wipe warmer. The $500 nursing chair that looks stunning in a showroom. Some of these things genuinely improve your life with a newborn. Most of them don\'t. This guide tells you which is which.',
      },
      {
        type: 'callout',
        body: 'The rule: spend top dollar on things you use daily for safety or survival. Save aggressively on things that are single-purpose, short-lived, or just aesthetically driven.',
      },
      {
        type: 'h2',
        heading: 'Spend top dollar on: the stroller',
        body: 'This is the one luxury purchase parents almost universally don\'t regret. You will use a stroller almost every day for 2–3 years. A quality stroller — $400 to $900 — pushes easier, folds faster, handles rougher terrain, holds its resale value, and lasts through a second child. The difference between a $150 stroller and a $600 stroller is immediately obvious the first time you try to push the cheap one over a sidewalk crack while holding a coffee.',
      },
      {
        type: 'bullets',
        items: [
          'One-hand fold is not a luxury — it\'s what you need when you\'re holding a baby.',
          'Suspension matters if you live anywhere with uneven pavement, trails, or winter conditions.',
          'High-end brands (UPPAbaby, Bugaboo, Nuna) hold 40–60% resale value. A $700 stroller you sell for $350 cost you $350 over 3 years.',
          'Skip: stroller accessories marketed as must-haves (cup holders, footmuffs, snack trays). Most are overpriced add-ons.',
        ],
      },
      {
        type: 'h2',
        heading: 'Save on: the car seat',
        body: 'Every car seat sold in the US passes the same federal crash safety standards. A $90 car seat and a $500 car seat offer the same legal crash protection. The premium price buys you ease of installation, nicer fabric, and brand recognition — not measurably better safety. Look for high ease-of-use ratings from NHTSA (they measure installation accuracy, which actually does matter for safety) rather than premium price.',
      },
      {
        type: 'bullets',
        items: [
          'The Chicco KeyFit 35 consistently ranks at the top of Consumer Reports and costs $200–$250.',
          'Never buy a used car seat — no way to verify accident history.',
          'Get your installation checked for free at any NHTSA-certified inspection station.',
        ],
      },
      {
        type: 'h2',
        heading: 'Spend top dollar on: the nursing chair',
        body: 'You will sit in this chair for 8–12 hours a day in the first weeks. A cheap glider with poor lumbar support will leave you in real pain during one of the most exhausting periods of your life. A good nursing chair — $400 to $700 — with proper back support, a smooth glide mechanism, and an ottoman to rest your feet is one of the few items parents consistently say they wish they\'d spent more on.',
      },
      {
        type: 'h2',
        heading: 'Save on: the SNOO (or any smart bassinet)',
        body: 'The SNOO costs $1,695 new and has a devoted fan base and an equally devoted group of people who returned theirs after two weeks. It works very well for some babies and makes essentially no difference for others — and there\'s no way to know which kind of baby you have until they arrive. Babies outgrow it at 6 months, or sooner if they start rolling. Rental ($159/month) is the right move if you\'re curious. If you do buy, buy secondhand.',
      },
      {
        type: 'h2',
        heading: 'Spend top dollar on: a quality breast pump (if breastfeeding)',
        body: 'Check your insurance first — most US insurance plans cover a breast pump at 100% under the ACA. If yours doesn\'t, or if you want an upgrade, a hospital-grade or wearable pump ($200–$500) is worth it. You will use this multiple times a day for potentially a year. The Spectra S2 is the gold standard recommendation from lactation consultants and is far more effective than entry-level pumps.',
      },
      {
        type: 'h2',
        heading: 'Save on: the baby monitor',
        body: 'The $300 Nanit with AI-powered sleep tracking and breathing monitoring is a compelling product, but for most families the HelloBaby ($67) does the core job — video, audio, temperature display — without a subscription or WiFi dependency. Baby monitors do not need to be connected to the internet. Non-WiFi monitors also can\'t be hacked.',
      },
      {
        type: 'h2',
        heading: 'Spend top dollar on: the baby carrier',
        body: 'A good structured carrier ($120–$180) that fits your body correctly is worth every dollar. You\'ll use it for walks, errands, fussy periods, and anything requiring your hands. A cheap carrier that digs into your shoulders or doesn\'t position the baby\'s hips correctly becomes unusable fast. The Ergobaby Omni 360 and Lillebaby Complete are the two most consistently recommended carriers by people who\'ve used them past the 3-month mark.',
      },
      {
        type: 'h2',
        heading: 'Skip entirely: the wipe warmer',
        body: 'Wipe warmers are on nearly every "don\'t buy this" list from experienced parents. They dry out wipes, can overheat, and are barely noticed by babies who are used to room-temperature wipes from day one. The $30 saves you counter space and decision fatigue.',
      },
      {
        type: 'h2',
        heading: 'Skip entirely: the Diaper Genie (or any proprietary diaper pail)',
        body: 'Any trash can with a tight-fitting lid does the same job as a $50 diaper pail that requires $8 refill bags you have to order every month forever. The math on proprietary refill systems is almost always bad.',
      },
      {
        type: 'h2',
        heading: 'Save on: baby clothes',
        body: 'Babies grow out of sizes every 6–10 weeks in the first year. Unless you have a specific reason to buy new (gifting, certified organic for sensitive skin), almost all baby clothing is available secondhand in near-perfect condition. Parents overbuy newborn size constantly — you\'ll find it at every consignment sale.',
      },
      {
        type: 'table',
        cols: ['Item', 'Verdict', 'Why'],
        rows: [
          ['Stroller', 'Spend', 'Daily use for 2+ years, resale value holds'],
          ['Car seat', 'Save', 'All meet the same safety standard'],
          ['Nursing chair', 'Spend', 'Daily use, posture matters a lot'],
          ['SNOO / smart bassinet', 'Rent or buy used', 'Only 6 months of use, baby-dependent results'],
          ['Breast pump', 'Check insurance first', 'Often free — then upgrade if needed'],
          ['Baby monitor', 'Save', 'Basic video/audio is all you need'],
          ['Baby carrier', 'Spend', 'Daily use, fit matters for your back'],
          ['Wipe warmer', 'Skip', 'Dries out wipes, barely noticed by babies'],
          ['Diaper pail', 'Save', 'Any sealed trash can works'],
          ['Baby clothes', 'Save/secondhand', 'Outgrown in 6-10 weeks'],
        ],
      },
      {
        type: 'products',
        items: [
          { emoji: '🛻', name: 'UPPAbaby Vista V2 Stroller', note: 'Top-rated full-size stroller, holds resale value well, expands for a second child', url: 'https://www.amazon.com/s?k=UPPAbaby+Vista+V2+stroller&tag=sprigloop-20' },
          { emoji: '🪑', name: 'Chicco KeyFit 35 Infant Car Seat', note: 'Consistently top-rated by Consumer Reports, excellent ease-of-use, load-leg base', url: 'https://www.amazon.com/s?k=Chicco+KeyFit+35+infant+car+seat&tag=sprigloop-20' },
          { emoji: '🤱', name: 'Ergobaby Omni 360 Baby Carrier', note: 'Newborn-ready without insert, 4 carry positions, exceptional lumbar support', url: 'https://www.amazon.com/s?k=Ergobaby+Omni+360+baby+carrier&tag=sprigloop-20' },
          { emoji: '🔊', name: 'LectroFan Classic White Noise Machine', note: 'Non-looping fan and white noise, consistently recommended by sleep consultants', url: 'https://www.amazon.com/s?k=LectroFan+white+noise+machine&tag=sprigloop-20' },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Today\'s Parent — Save or Splurge on Baby Gear', url: 'https://www.todaysparent.com/pregnancy/baby-registry/save-or-splurge-where-to-spend-your-money-on-baby-gear/' },
          { label: 'Consumer Reports — Best Infant Car Seats', url: 'https://www.consumerreports.org/babies-kids/car-seats/best-infant-car-seats-of-the-year-a7088444370/' },
          { label: 'Fortune — SNOO Bassinet Review', url: 'https://fortune.com/2024/08/22/snoo-sleeper-bassinet-added-monthly-subscription-parents-mad/' },
          { label: 'NHTSA — Car Seat Safety Ratings', url: 'https://www.nhtsa.gov/equipment/car-seats-and-booster-seats' },
        ],
      },
    ],
  },

  // ── Guide 7b: How to Build Your Registry ─────────────────────────────────
  {
    slug: 'how-to-build-your-baby-registry',
    title: 'How to Build a Baby Registry That Actually Helps',
    subtitle: 'What belongs on it, what doesn\'t, how many of each, and how to organize it so people can actually use it.',
    description: 'A registry built from your real gaps is worth 10x more than a store-generated list. Here\'s how to build one that gets you what you actually need.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '8 min',
    tags: ['Registry', 'Planning', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from parenting guides, consumer research, and registry best practice guidance. It contains affiliate links to Amazon.',
    planCategory: 'clothing',
    sections: [
      {
        type: 'lede',
        body: 'Most baby registries are built by walking through a store with a scanner, pointing it at things that look useful, and ending up with 200 items and no clear sense of what you actually need. Then guests buy the fun stuff and skip the practical stuff, and you end up with 8 receiving blankets and no waterproof mattress cover. This guide is the alternative.',
      },
      {
        type: 'h2',
        heading: 'Start with the daily loop',
        body: 'Before you add a single item, map the first week: sleep → feed → diaper → soothe → leave the house. That\'s the loop that repeats every 2–3 hours. Everything on your registry should support one of those five things. If it doesn\'t fit the loop, it goes lower priority or off entirely.',
      },
      {
        type: 'h2',
        heading: 'The honest registry: what actually belongs',
        body: 'These are the items that experienced parents consistently say they needed and used from day one.',
      },
      {
        type: 'table',
        cols: ['Category', 'Item', 'Quantity', 'Notes'],
        rows: [
          ['Sleep', 'Bassinet or crib', '1', 'Start with a bassinet for room-sharing (AAP recommends 6 months)'],
          ['Sleep', 'Firm crib mattress', '1', 'GREENGUARD Gold, no chemical flame retardants'],
          ['Sleep', 'Fitted crib/bassinet sheets', '3–4', 'You\'ll change these at 3am — extras matter'],
          ['Sleep', 'Sleep sacks (wearable blankets)', '3–4', 'GOTS certified, no loose blankets in the sleep space'],
          ['Sleep', 'Swaddle blankets', '6–8', 'Used constantly — way more than you think'],
          ['Sleep', 'White noise machine', '1', 'Non-negotiable if you live anywhere with noise'],
          ['Feeding', 'Nursing pillow', '1', 'Boppy or My Brest Friend'],
          ['Feeding', 'Burp cloths', '10–12', 'More than you think. Always.'],
          ['Feeding', 'Bottles + slow-flow nipples', '6–8', 'Even if breastfeeding — useful from the start'],
          ['Feeding', 'Bottle brush', '1', 'More important than a sterilizer'],
          ['Diapering', 'Changing pad + 2–3 covers', '1 + covers', 'Covers get wet — extras are necessary'],
          ['Diapering', 'Diaper rash cream', '1', 'Aquaphor or zinc-oxide based'],
          ['Diapering', 'Diaper bag', '1', 'Backpack style, wipe-clean interior'],
          ['Health', 'Digital rectal thermometer', '1', 'Only accurate method for newborns under 3 months'],
          ['Health', 'Nasal aspirator (NoseFrida)', '1', 'More effective than a bulb syringe'],
          ['Health', 'Nail file or scissors', '1', 'Newborn nails are sharp and grow fast'],
          ['Travel', 'Infant car seat', '1', 'Required to leave the hospital'],
          ['Travel', 'Stroller', '1', 'Match to your lifestyle'],
          ['Travel', 'Baby carrier', '1', 'Structured or wrap — try before committing'],
          ['Bath', 'Baby tub with sling', '1', 'Supports baby while your hands are free'],
          ['Bath', 'Fragrance-free baby wash', '1', 'Fragrance is the #1 skin irritant for newborns'],
          ['Bath', 'Soft washcloths', '4–6', 'Dedicated baby cloths are gentler than adult ones'],
        ],
      },
      {
        type: 'h2',
        heading: 'What doesn\'t belong on the registry',
        body: 'These are the things stores push hard because they\'re high-margin, not because you need them.',
      },
      {
        type: 'bullets',
        items: [
          'Wipe warmer — dries out wipes, not noticed by babies raised without one.',
          'Baby food maker — a blender does the same thing. Skip for 6 months minimum.',
          'Bottle sterilizer — hot soapy water or a dishwasher is sufficient for healthy full-term babies per the CDC.',
          'Baby bathrobe — a regular towel wrapped around them is identical.',
          'Shoe-anything for newborns — they don\'t walk. Socks do the same job.',
          'Swing and bouncer both — try one first. Many babies have a strong preference, and you don\'t know which until they\'re here.',
          'Excessive newborn-size anything — most babies outgrow newborn in 2–3 weeks. Buy 4–6 items max.',
          'Matching nursery sets — fitted sheet, bumper, comforter, dust ruffle, decorative pillows. The bumper and comforter are unsafe. The dust ruffle collects dust. The matching sheet is fine but the set is priced at a 3x premium for the coordination factor.',
        ],
      },
      {
        type: 'h2',
        heading: 'Registry strategy: make it easy to gift from',
        body: 'A registry that\'s hard to gift from gets ignored. Here\'s how to make yours actually work.',
      },
      {
        type: 'bullets',
        items: [
          'Include a range of price points. $20–$40 items (burp cloths, diaper cream, washcloths) get bought. A registry of only $200+ items sits unclaimed.',
          'Group items by category or by who it\'s for. A guest who wants to buy for feeding needs to be able to find feeding items quickly.',
          'Mark priority items. Guests use this signal — they\'d rather buy something you specifically need.',
          'Add the mundane. Batteries, diaper pail liners, storage bags. Nobody buys these at a shower and they\'re immediately needed.',
          'Keep it under 75 items. A 200-item registry is overwhelming and guests skim past it.',
        ],
      },
      {
        type: 'h2',
        heading: 'The Sprigloop approach: register from real gaps',
        body: 'The problem with traditional registries is that you\'re guessing what you need before you know your baby. Sprigloop flips this: once you\'ve added what you already have, the Plan tab shows your actual gaps by category and size. You can share that as a registry link — family sees exactly what\'s missing, not a curated list of products you added pre-birth. It\'s the difference between "I think I might need sleep sacks" and "I have 1 sleep sack in 0-3M and need 3 more."',
      },
      {
        type: 'h2',
        heading: 'When to start your registry',
        body: 'Start around week 12–16 of pregnancy — early enough to research properly, late enough that you\'ve had your anatomy scan and have a better sense of what\'s coming. Give guests at least 6 weeks before your shower date to browse and order. Items from smaller brands can take longer to ship.',
      },
      {
        type: 'products',
        items: [
          { emoji: '🛌', name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack', note: 'GOTS certified, 2-way zipper, 0.5 TOG — the most-needed registry item parents forget', url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20' },
          { emoji: '🧻', name: 'Baby Burp Cloths Large Cotton 10-Pack', note: 'The item most parents wish they had more of. Register for more than you think.', url: 'https://www.amazon.com/s?k=baby+burp+cloths+large+cotton+10+pack&tag=sprigloop-20' },
          { emoji: '🍼', name: "Dr. Brown's Natural Flow Newborn Bottle Set", note: 'Slow-flow Level 1 nipples included, widely recommended by pediatricians', url: "https://www.amazon.com/s?k=dr+browns+natural+flow+newborn+bottle+set&tag=sprigloop-20" },
          { emoji: '👃', name: 'FridaBaby NoseFrida Nasal Aspirator', note: 'The one health item parents consistently wish they had from day one', url: 'https://www.amazon.com/s?k=fridababy+nosefrida+nasal+aspirator&tag=sprigloop-20' },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Babylist — Baby Registry Must-Haves', url: 'https://www.babylist.com/hello-baby/baby-registry-must-haves' },
          { label: 'The Bump — Registry 101', url: 'https://www.thebump.com/a/registry-101' },
          { label: 'CDC — Infant Formula and Bottle Sterilization', url: 'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/preparation-and-storage.html' },
          { label: 'AAP — Safe Sleep Guidelines', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
        ],
      },
    ],
  },

  // ── Guide 7: Clothing ────────────────────────────────────────────────────
  {
    slug: 'baby-clothing-guide',
    title: 'How to Build a Baby Clothing Plan Without Overbuying',
    subtitle: 'Quantities by size, seasonal timing, what to buy ahead vs. just-in-time, and what to skip entirely.',
    description: 'A practical clothing guide for the first year — how many items per size, how season timing changes what you need, and the categories most parents overbuy.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '7 min',
    tags: ['Clothing', 'Planning', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from pediatric sizing guidance, parenting research, and consumer advice. It contains affiliate links to Amazon.',
    planCategory: 'clothing',
    sections: [
      {
        type: 'lede',
        body: 'Baby clothing is the category where parents most consistently overbuy the wrong things and underprepare for the right ones. Too many newborn-size onesies that fit for two weeks. Seventeen holiday outfits and zero plain bodysuits. A whole size window\'s worth of summer clothes arriving just as the weather turns cold. This guide gives you a framework for buying less and having exactly what you need.',
      },
      {
        type: 'h2',
        heading: 'The first rule: think in size windows, not age',
        body: 'Baby clothing labels say "3 months" but what they mean is "fits babies around 12–13 lbs." Your baby\'s actual age when they wear each size depends on their weight — and that varies a lot. A 9-pound newborn and a 7-pound newborn will be in different sizes within weeks of each other. Always check the weight range on the label, not the age.',
      },
      {
        type: 'table',
        cols: ['Size', 'Weight range', 'Typical duration'],
        rows: [
          ['Newborn', '5–8 lbs', '2–4 weeks (skip if baby ≥ 8 lbs)'],
          ['0–3M', '8–12 lbs', '6–10 weeks'],
          ['3–6M', '12–16 lbs', '8–10 weeks'],
          ['6–9M', '16–19 lbs', '6–8 weeks'],
          ['9–12M', '19–22 lbs', '8–10 weeks'],
          ['12–18M', '22–27 lbs', '3–4 months'],
        ],
      },
      {
        type: 'h2',
        heading: 'How many items per size',
        body: 'These quantities assume laundry every 2–3 days and that you\'re not trying to dress a baby in coordinated outfits. Babies in the first year live in bodysuits and sleepers. That\'s what you need more of.',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity per size'],
        rows: [
          ['Short-sleeve bodysuits / onesies', '5–7'],
          ['Long-sleeve bodysuits', '4–6'],
          ['Sleepers / zip-up pajamas', '5–7'],
          ['Soft pants or leggings', '3–4'],
          ['Socks', '6–8 pairs'],
          ['Hats (warmth)', '2'],
          ['Cardigan or light layer', '1–2'],
          ['Outerwear (season-dependent)', '1'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Zip closures beat snaps at 3am. Buy zip sleepers whenever you can find them.',
          'Long-sleeve bodysuits are the foundation of layering in cooler weather — they go under everything.',
          'If you wash daily, cut quantities roughly in half. If you go longer between washes, add 30–50%.',
          'Skip structured "outfits" with matching pieces in the first six months. They\'re harder to put on and come off faster than you expect.',
        ],
      },
      {
        type: 'h2',
        heading: 'The seasonal timing problem',
        body: 'This is where most parents get caught off guard. Your baby\'s due date determines what season they\'ll be in for each size window. If you buy for the size, not the season, you end up with fleece sleepers your baby outgrows before winter arrives.',
      },
      {
        type: 'callout',
        body: 'The rule: figure out what month your baby will be in each size, then buy for that season. A baby born in October will be in 3–6M around January — they need warm layers in that size. A baby born in April will be in 3–6M around July — they need lightweight cotton.',
      },
      {
        type: 'table',
        cols: ['Born in', '0–3M season', '3–6M season', '6–9M season'],
        rows: [
          ['January', 'Winter', 'Spring', 'Summer'],
          ['April', 'Spring', 'Summer', 'Fall'],
          ['July', 'Summer', 'Fall', 'Winter'],
          ['October', 'Fall/Winter', 'Winter/Spring', 'Spring'],
        ],
      },
      {
        type: 'h2',
        heading: 'What to buy ahead vs. just-in-time',
        body: 'The temptation is to stock up on everything before the baby arrives. The problem is you don\'t know your baby\'s growth rate, and sizes stack up fast in a way that\'s hard to predict from outside.',
      },
      {
        type: 'bullets',
        items: [
          'Buy ahead: 0–3M basics (bodysuits, sleepers) — you\'ll need these immediately and won\'t have time to shop.',
          'Buy just-in-time: 3–6M and beyond — you\'ll know the season, the growth rate, and the actual gaps by then.',
          'Never bulk-buy a size you haven\'t reached yet. Babies grow differently. Your 0–3M stash is your guide for how to stock 3–6M.',
          'Secondhand clothing from families whose babies are one size ahead of yours is the most efficient way to fill gaps just-in-time.',
        ],
      },
      {
        type: 'h2',
        heading: 'Layering: the only framework you need',
        body: 'Dressing a baby for temperature is simple once you understand the layers. Add one layer more than you\'d wear yourself at the same temperature.',
      },
      {
        type: 'table',
        cols: ['Temperature', 'What baby wears'],
        rows: [
          ['75°F+ (warm indoors)', 'Short-sleeve bodysuit only'],
          ['68–75°F (comfortable)', 'Long-sleeve bodysuit or light sleeper'],
          ['60–68°F (cool)', 'Long-sleeve bodysuit + pants or heavier sleeper'],
          ['Below 60°F (cold)', 'Long-sleeve bodysuit + warmer sleeper + cardigan or sleep sack'],
        ],
      },
      {
        type: 'h2',
        heading: 'What to skip',
      },
      {
        type: 'bullets',
        items: [
          'Shoes before walking — socks or soft booties are warmer and easier to get on.',
          'Jeans and structured pants — hard waistbands on a baby who lies flat all day is uncomfortable for everyone.',
          'Dry-clean-only or hand-wash items — you will not do this.',
          'Matching sets and "outfits" in the first 6 months — you\'ll dress the baby in whatever is clean.',
          'Excessive newborn size — buy 4–6 items max. Most babies outgrow it in 2–3 weeks.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '👕',
            name: "Burt's Bees Baby Organic Bodysuits (5-pack)",
            note: 'GOTS certified organic cotton — the foundation of every size window',
            url: "https://www.amazon.com/s?k=burt%27s+bees+baby+organic+bodysuits+5+pack&tag=sprigloop-20",
          },
          {
            emoji: '🌙',
            name: 'Carter\'s Zip-Up Fleece Sleepers (2-pack)',
            note: 'Two-way zip for quick night changes — the most-used item in the first year',
            url: 'https://www.amazon.com/s?k=carters+zip+up+fleece+sleeper+baby+2+pack&tag=sprigloop-20',
          },
          {
            emoji: '🧺',
            name: 'Baby Clothing Closet Dividers by Size',
            note: 'Keep each size window separated so incoming clothes land in the right section',
            url: 'https://www.amazon.com/s?k=baby+closet+dividers+by+size&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Babylist — How many baby clothes do I need?', url: 'https://www.babylist.com/hello-baby/how-many-baby-clothes-do-i-need' },
          { label: 'Mommy on Purpose — How many baby clothes in each size?', url: 'https://mommyonpurpose.com/how-many-baby-clothes-do-i-need-in-each-size/' },
          { label: 'Little Hometown — Best baby clothes by season', url: 'https://littlehometown.com/blogs/little-blog-town/best-baby-clothes-by-season' },
          { label: 'PatPat — Seasonal baby wardrobe guide by due date', url: 'https://www.patpat.com/blogs/pregnancy/seasonal-baby-wardrobe-due-date-guide' },
        ],
      },
    ],
  },

  // ── Guide 8: Sleep ───────────────────────────────────────────────────────
  {
    slug: 'newborn-safe-sleep-setup',
    title: 'How to Set Up a Safe Sleep Space for a Newborn',
    subtitle: 'What the AAP actually recommends, what to skip, and the one purchase that matters most.',
    description: 'Safe sleep guidelines made simple. What goes in the crib, what stays out, and how to set up a sleep space your baby can safely use from day one.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '6 min',
    tags: ['Sleep', 'Safety', 'Newborn'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP safe sleep guidelines, HealthyChildren.org, and pediatric hospital guidance. It contains affiliate links to Amazon. Sources are linked throughout.',
    planCategory: 'sleep',
    sections: [
      { type: 'lede', body: 'Safe sleep is one of those topics where the stakes are real and the advice is surprisingly simple. The American Academy of Pediatrics has published clear guidelines for infant sleep since 1992. What they recommend hasn\'t changed in the core: back, alone, firm flat surface. What has changed is the marketing around it — and the number of products positioned as "must-haves" that the AAP specifically says to skip.' },
      { type: 'h2', heading: 'The ABC rule', body: 'The AAP distills safe sleep into three letters: Alone, on their Back, in a Crib (or bassinet or play yard with a firm flat mattress). Everything else flows from this.' },
      { type: 'bullets', items: [
        'Always place baby on their back. Stomach sleeping increases SIDS risk significantly and is not recommended for the first year.',
        'Alone means no co-sleeping in the same bed. Room-sharing (your baby in their own sleep surface in your room) is recommended for the first 6–12 months and is different from bed-sharing.',
        'Firm, flat surface only. The mattress should not indent when your baby lies on it. No soft toppers, no inclined surfaces.',
      ]},
      { type: 'h2', heading: 'What goes in the sleep space', body: 'The list is short: baby, fitted sheet, and a sleep sack if temperature requires. That\'s it.' },
      { type: 'table', cols: ['Item', 'Include?', 'Notes'], rows: [
        ['Firm crib/bassinet mattress', 'Yes', 'Required — no soft toppers'],
        ['Fitted sheet (1–2 extras)', 'Yes', 'Leaks happen at 3am'],
        ['Sleep sack / wearable blanket', 'Yes', 'Replaces loose blankets safely'],
        ['White noise machine', 'Optional', 'Not required but genuinely helpful'],
        ['Loose blankets', 'No', 'Suffocation risk — use sleep sack instead'],
        ['Pillows or positioners', 'No', 'Not safe for infants'],
        ['Bumper pads', 'No', 'AAP explicitly advises against them'],
        ['Weighted sleep sacks', 'No', 'AAP advises against weighted products for infants'],
        ['Stuffed animals', 'No', 'Keep out of sleep space until age 1+'],
      ]},
      { type: 'callout', body: 'Weighted sleep sacks are marketed as helping babies sleep longer. The AAP specifically recommends against them. There is no safe weighted sleep product for infants — the weight can restrict breathing.' },
      { type: 'h2', heading: 'Crib vs. bassinet vs. play yard', body: 'All three are safe options if they meet CPSC safety standards. The practical difference is size and portability. A bassinet is easier to have in your bedroom for the first few months (room-sharing is recommended). A crib lasts longer. A portable play yard is useful for travel. You don\'t need all three — pick one that fits your space and budget.' },
      { type: 'h2', heading: 'Sleep sacks: the most important purchase', body: 'Because loose blankets aren\'t safe, sleep sacks are non-negotiable from day one. You need 3–4 so you always have a clean one. Match the TOG rating to the room temperature: 0.5 TOG for warm rooms or summer, 2.5 TOG for winter. Zip-up styles are far easier than pull-on at 3am.' },
      { type: 'products', items: [
        { emoji: '🛌', name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack (0–6M)', note: 'GOTS certified, 0.5 TOG, 2-way zipper — covers the warm weather newborn window', url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20' },
        { emoji: '🌙', name: 'Ecolino Organic Cotton Sleep Sack (6–18M)', note: 'GOTS certified, bottom-zip for quick night changes', url: 'https://www.amazon.com/dp/B06XJ35W1H/?tag=sprigloop-20' },
        { emoji: '🔊', name: 'White Noise Machine for Baby', note: 'Consistent sound mask helps babies sleep through normal household noise', url: 'https://www.amazon.com/s?k=white+noise+machine+baby+sleep&tag=sprigloop-20' },
      ]},
      { type: 'h2', heading: 'Room temperature', body: 'The AAP recommends keeping the room between 68–72°F (20–22°C). Overheating is a SIDS risk factor. A good rule of thumb: dress your baby in one more layer than you\'d be comfortable sleeping in yourself.' },
      { type: 'sources', items: [
        { label: 'AAP Safe Sleep Guidelines — HealthyChildren.org', url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx' },
        { label: 'AAP Safe Sleep — Official Policy', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
        { label: 'Safe Sleep — Johns Hopkins Medicine', url: 'https://www.hopkinsmedicine.org/health/wellness-and-prevention/infant-safe-sleep' },
      ]},
    ],
  },

  // ── Guide 8: Feeding ─────────────────────────────────────────────────────
  {
    slug: 'bottle-feeding-newborn-what-you-need',
    title: 'Bottle Feeding a Newborn: What You Actually Need',
    subtitle: 'How many bottles, which nipple flow, how to prep formula, and what you can skip.',
    description: 'A practical guide to bottle feeding — quantities, nipple flow rates by age, formula prep safety, and what the expensive accessories actually do.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '5 min',
    tags: ['Feeding', 'Newborn', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from CDC infant feeding guidelines, pediatric hospital guidance, and parenting research. It contains affiliate links to Amazon.',
    planCategory: 'feeding',
    sections: [
      { type: 'lede', body: 'Bottle feeding looks simple until you\'re standing in a store with 40 different bottle options, three nipple flow rates, a sterilizer you didn\'t know you needed, and a baby due in six weeks. Here\'s the short version: most of it doesn\'t matter as much as the marketing suggests. Here\'s what actually does.' },
      { type: 'h2', heading: 'How many bottles', body: 'Newborns eat 8–12 times a day. If you\'re exclusively bottle feeding, you need enough bottles to get through a day without running the dishwasher twice.' },
      { type: 'table', cols: ['Feeding approach', 'Bottles needed', 'Notes'], rows: [
        ['Exclusively bottle feeding', '6–10', 'Start with 4oz size — newborns eat 2–3oz per feed'],
        ['Combo feeding (breast + bottle)', '4–6', 'Fewer feeds go through bottles'],
        ['Pumping and storing', '8–12+', 'Need extras for storage in addition to feeding'],
      ]},
      { type: 'h2', heading: 'Nipple flow rates', body: 'This is the detail most parents don\'t know about until they have a problem. Nipple flow rates control how fast milk comes out. Wrong rate = frustrated baby, overfeeding, or choking.' },
      { type: 'table', cols: ['Age', 'Flow rate', 'Why'], rows: [
        ['0–3 months', 'Slow (Level 1)', 'Newborns need to work a little — too fast causes choking and overfeeding'],
        ['3–6 months', 'Medium (Level 2)', 'Baby gets more efficient, slow flow becomes frustrating'],
        ['6+ months', 'Fast (Level 3)', 'Older babies need higher flow to match their intake speed'],
      ]},
      { type: 'callout', body: 'Signs you need a faster nipple: baby is taking much longer than 20 minutes per feed and seems frustrated. Signs you need a slower nipple: baby is gulping, pulling off frequently, or spitting up a lot immediately after feeds.' },
      { type: 'h2', heading: 'Formula prep: the rules that matter', body: 'Formula prep has two rules that are actually important. The rest is convenience.' },
      { type: 'bullets', items: [
        'Follow the water-to-powder ratio exactly. Too much water dilutes nutrients. Too little water concentrates them dangerously. Always follow the label.',
        'Use prepared formula within 2 hours at room temperature, or within 24 hours if refrigerated. After that, throw it out.',
        'You don\'t need a bottle warmer. A bowl of warm water works identically and costs nothing.',
        'You don\'t need a sterilizer. The CDC says washing bottles in hot soapy water or a dishwasher is sufficient for healthy, full-term babies. Sterilization daily is only recommended for premature infants or immunocompromised babies.',
      ]},
      { type: 'h2', heading: 'What to skip', body: 'The bottle aisle is full of accessories designed to feel necessary.' },
      { type: 'bullets', items: [
        'Bottle sterilizer — dishwasher or hot soapy water is sufficient per the CDC for healthy babies.',
        'Bottle warmer — a bowl of warm water works the same way.',
        'Formula dispenser "robots" — useful if you\'re making bottles at 3am half-asleep, but not necessary.',
        'Specialty anti-colic bottles — try a standard bottle first. Most gas and fussiness is not bottle-related.',
      ]},
      { type: 'products', items: [
        { emoji: '🍼', name: 'Dr. Brown\'s Natural Flow Baby Bottles Newborn Set', note: 'Slow-flow Level 1 nipples included, widely recommended by pediatricians', url: 'https://www.amazon.com/s?k=dr+browns+natural+flow+newborn+bottles+set&tag=sprigloop-20' },
        { emoji: '🧴', name: 'Baby Bottle Brush Cleaning Set', note: 'A good bottle brush matters more than a sterilizer', url: 'https://www.amazon.com/s?k=baby+bottle+brush+cleaning+set&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'CDC — Infant Formula Preparation and Storage', url: 'https://www.cdc.gov/infant-toddler-nutrition/formula-feeding/preparation-and-storage.html' },
        { label: 'Taking Cara Babies — Bottle Feeding 101', url: 'https://www.takingcarababies.com/blogs/feeding/bottle-feeding-101-how-to-choose-and-prepare-bottles' },
        { label: 'Tommee Tippee — Guide to Bottle Nipple Sizes', url: 'https://www.tommeetippee.com/en-us/parent-library/newborn-baby/feeding/bottle-feeding/parents-guide-to-baby-bottle-nipples' },
      ]},
    ],
  },

  // ── Guide 9: Diapering ───────────────────────────────────────────────────
  {
    slug: 'cloth-vs-disposable-diapers',
    title: 'Cloth vs. Disposable Diapers: A Practical Guide',
    subtitle: 'The real cost difference, the time trade-off, and how to decide without the guilt.',
    description: 'An honest comparison of cloth and disposable diapers — actual costs over two years, time investment, environmental impact, and the hybrid approach most families land on.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '6 min',
    tags: ['Diapering', 'Planning', 'Sustainability'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from cost analyses, environmental studies, and parenting guidance. It contains affiliate links to Amazon.',
    planCategory: 'diapering',
    sections: [
      { type: 'lede', body: 'The cloth vs. disposable debate generates a lot of strong opinions and not a lot of honest numbers. Here\'s the actual math, the real time cost, and a framework for deciding what works for your family — without the ideology.' },
      { type: 'h2', heading: 'The cost comparison', body: 'Disposables cost more. The question is how much more, and whether the savings justify the work.' },
      { type: 'table', cols: ['', 'Cloth', 'Disposable'], rows: [
        ['Startup cost', '$300–$1,000', '$0'],
        ['Ongoing cost/year', '$150–$250 (laundry)', '$800–$1,200'],
        ['Total (one child)', '$900–$1,550', '$2,200–$3,000'],
        ['Total (two children)', '$1,100–$1,800', '$4,400–$6,000'],
        ['Savings (two kids)', '$2,600–$4,200', '—'],
      ]},
      { type: 'callout', body: 'The financial case for cloth is strongest if you have more than one child. The startup cost is already paid for child #1 — child #2 costs only laundry. Two kids in cloth saves $2,600–$4,200 over disposables.' },
      { type: 'h2', heading: 'The real time cost', body: 'Cloth diapers add 3–4 hours of laundry per month. At $20/hour, that\'s $60–$80/month in time cost, or roughly $1,800–$2,400 over two and a half years. This almost entirely eliminates the financial advantage for one child.' },
      { type: 'h2', heading: 'What cloth does better', body: 'This surprises most people: properly fitted cloth diapers leak less than disposables. The elastic leg and back openings contain blowouts better. If your baby is having frequent blowouts in disposables, cloth is worth trying for that reason alone.' },
      { type: 'h2', heading: 'The hybrid approach', body: 'Most families who try cloth end up using cloth at home and disposables when traveling, at daycare, or in the newborn phase. This is a legitimate approach — you capture most of the environmental benefit and some of the cost savings without the full commitment.' },
      { type: 'h2', heading: 'What you actually need to diaper', body: 'Whether you go cloth or disposable, there are items that matter regardless.' },
      { type: 'table', cols: ['Item', 'Quantity', 'Notes'], rows: [
        ['Diapers', 'Continuous', 'Don\'t stockpile — sizes change fast in the first months'],
        ['Wipes', 'Continuous', 'Unscented for sensitive skin'],
        ['Changing pad + 2–3 covers', '1 pad', 'Covers get wet — extras matter'],
        ['Diaper rash cream', '1', 'Zinc oxide is the standard — apply at any sign of redness'],
        ['Diaper bag', '1', 'Any bag with a wipe pocket works'],
      ]},
      { type: 'products', items: [
        { emoji: '🧴', name: 'Aquaphor Baby Healing Ointment', note: 'Most-recommended diaper rash barrier by pediatricians', url: 'https://www.amazon.com/s?k=aquaphor+baby+healing+ointment+diaper+rash&tag=sprigloop-20' },
        { emoji: '🔄', name: 'Changing Pad Covers (3-pack)', note: 'Waterproof covers — you need extras for middle-of-night changes', url: 'https://www.amazon.com/s?k=waterproof+changing+pad+cover+3+pack&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'Jillian\'s Drawers — Cloth vs. Disposable Cost Comparison', url: 'https://jilliansdrawers.com/pages/cost-comparison-cloth-diapers-vs-disposables' },
        { label: 'Lil Helper — Cloth vs. Disposable: Cost, Time & Sustainability', url: 'https://lilhelperusa.com/blogs/press/cloth-vs-disposable-diapers-the-truth-about-cost-time-sustainability' },
      ]},
    ],
  },

  // ── Guide 10: Travel ─────────────────────────────────────────────────────
  {
    slug: 'choosing-a-car-seat',
    title: 'How to Choose a Car Seat (and What Else You Actually Need)',
    subtitle: 'What NHTSA ratings mean, infant-only vs. convertible, and the installation mistake 46% of parents make.',
    description: 'Car seat safety explained without the jargon. What the ratings mean, how to choose between infant-only and convertible, and why installation matters more than the seat itself.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '6 min',
    tags: ['Travel', 'Safety', 'Gear'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from NHTSA guidelines, Consumer Reports testing, and pediatric safety research. It contains affiliate links to Amazon.',
    planCategory: 'travel',
    sections: [
      { type: 'lede', body: 'A car seat is the one piece of baby gear where the stakes are unambiguous. You need one before you can leave the hospital. It needs to be the right one, installed correctly, every single time. Here\'s how to make a good decision without getting lost in the marketing.' },
      { type: 'callout', body: '46% of car seats are installed incorrectly. Improper installation is a bigger safety risk than the differences in crash test performance between most seats. Buy a seat that fits your car, learn to install it correctly, and get it checked.' },
      { type: 'h2', heading: 'Infant-only vs. convertible', body: 'This is the first decision most parents face. Both are safe options.' },
      { type: 'table', cols: ['', 'Infant-only', 'Convertible'], rows: [
        ['Use period', 'Birth to ~12–18 months', 'Birth through toddler years'],
        ['Weight limit (rear-facing)', 'Typically 35 lbs', 'Typically 40–50 lbs'],
        ['Portability', 'Detaches as a carrier', 'Stays in the car'],
        ['Cost (typical)', '$100–$300', '$200–$400'],
        ['Second child value', 'Lower (re-purchase)', 'Higher (works for both)'],
      ]},
      { type: 'bullets', items: [
        'Infant seats are easier in the newborn phase because you can carry the sleeping baby without waking them.',
        'Convertible seats save money long-term because you don\'t need to buy a second seat when your child outgrows the infant seat.',
        'The AAP recommends keeping children rear-facing as long as possible within the seat\'s limits — not flipping forward-facing at age 2 as a milestone.',
      ]},
      { type: 'h2', heading: 'What NHTSA ratings actually mean', body: 'All car seats sold in the US must meet federal safety standards — so every seat you buy is already baseline safe. NHTSA\'s 5-star rating is an Ease of Use score, not a crash safety score. It measures how easy the seat is to install and use correctly. A 5-star seat that\'s installed wrong is more dangerous than a 3-star seat installed right.' },
      { type: 'h2', heading: 'The load leg advantage', body: 'Some infant seats come with a "load leg" — a metal leg that extends from the seat base to the vehicle floor. Research shows load legs reduce the forces a baby experiences in a frontal crash by up to 40%. If two seats are otherwise equal, the one with a load leg is safer.' },
      { type: 'h2', heading: 'Get your installation checked', body: 'Every major hospital and many fire stations offer free car seat inspection by certified technicians (CPSTs). This is the most important thing you can do after buying the seat. NHTSA has a locator at nhtsa.gov/campaign/right-seat.' },
      { type: 'h2', heading: 'What else you need for travel', body: '' },
      { type: 'table', cols: ['Item', 'Priority', 'Notes'], rows: [
        ['Car seat', 'Required', 'Must have before hospital discharge'],
        ['Stroller', 'High', 'Match to your lifestyle — umbrella for city, jogging for outdoors'],
        ['Baby carrier/wrap', 'Medium', 'Try before committing — fit varies a lot by body type'],
        ['Diaper bag', 'High', 'Any bag with enough pockets works'],
      ]},
      { type: 'products', items: [
        { emoji: '🪑', name: 'Chicco KeyFit 35 Infant Car Seat', note: 'Consistently high-rated by Consumer Reports, easy to install, load-leg base', url: 'https://www.amazon.com/s?k=chicco+keyfit+35+infant+car+seat&tag=sprigloop-20' },
        { emoji: '🎒', name: 'Baby Diaper Bag Backpack', note: 'Backpack style keeps hands free — look for insulated pockets and waterproof lining', url: 'https://www.amazon.com/s?k=baby+diaper+bag+backpack+waterproof&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'NHTSA — Car Seat Finder Tool', url: 'https://www.nhtsa.gov/campaign/right-seat' },
        { label: 'Consumer Reports — Best Infant Car Seats', url: 'https://www.consumerreports.org/babies-kids/car-seats/best-infant-car-seats-of-the-year-a7088444370/' },
        { label: 'Safe in the Seat — Car Seat Crash Testing Explained', url: 'https://www.safeintheseat.com/post/car-seat-crash-testing-to-the-regulations-and-beyond' },
      ]},
    ],
  },

  // ── Guide 11: Play ───────────────────────────────────────────────────────
  {
    slug: 'baby-toys-first-year-by-age',
    title: 'What Toys Does a Baby Actually Need in the First Year?',
    subtitle: 'A stage-by-stage breakdown of what supports development — and what just takes up space.',
    description: 'Most parents overbuy toys. This guide covers what babies actually engage with at 0–3M, 3–6M, and 6–12M, what to skip, and what to keep accessible vs. rotate.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '5 min',
    tags: ['Play', 'Development', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from NAEYC guidance, Seattle Children\'s Hospital, and pediatric developmental research. It contains affiliate links to Amazon.',
    planCategory: 'play',
    sections: [
      { type: 'lede', body: 'The toy industry is very good at making parents feel like every developmental window requires a specific product. Most of it is marketing. Here\'s what developmental research actually says babies need at each stage — and the honest truth that before 6 months, you are the best toy they own.' },
      { type: 'h2', heading: '0–3 months: high contrast and faces', body: 'Newborns can only focus about 8–12 inches away — roughly the distance to your face while feeding. Their visual system is calibrated to detect high-contrast edges. They cannot intentionally grasp toys yet.' },
      { type: 'bullets', items: [
        'High-contrast black-and-white cards or books — genuinely useful, inexpensive, and developmentally appropriate.',
        'A soft rattle placed in their hand — they won\'t grasp it intentionally but will feel and hear it.',
        'An activity gym with a hanging element — useful for tummy time and visual tracking from about 6–8 weeks.',
        'Your face, your voice, and skin contact — the research is unambiguous that this is the most important "play" in this window.',
      ]},
      { type: 'h2', heading: '3–6 months: grasping and cause-and-effect', body: 'By 4 months, babies actively reach for and grasp objects. By 5–6 months, they understand that their action caused something to happen — shake a rattle, hear a sound. This is the beginning of purposeful play.' },
      { type: 'bullets', items: [
        'Soft rattles and teething rings — they\'ll put everything in their mouth, so washable and non-toxic is important.',
        'Crinkle toys — the sound of crinkling gets a strong reaction at this age.',
        'Activity gym with varied textures — babies now actively reach for hanging elements.',
        'Board books with faces and simple images — good for language and social development.',
      ]},
      { type: 'h2', heading: '6–12 months: object permanence and movement', body: 'By 8–9 months most babies are crawling and pulling to stand. They understand that objects exist even when hidden — this is object permanence, and it\'s why peek-a-boo becomes genuinely exciting at this age.' },
      { type: 'bullets', items: [
        'Stacking cups or soft blocks — building and knocking down is endlessly repeatable.',
        'Shape sorters (simple ones) — cause-and-effect plus fine motor.',
        'Push toys for when they start standing (9–12 months).',
        'Board books — babies this age will flip pages and point at things.',
        'Balls of different sizes and textures.',
      ]},
      { type: 'callout', body: 'Keep 3–5 toys accessible and rotate the rest weekly. Babies re-engage with "new" toys much more than with toys that are always out. Toy rotation reduces overwhelm and keeps things interesting without buying more.' },
      { type: 'h2', heading: 'What to skip in the first year', body: '' },
      { type: 'bullets', items: [
        'Electronic learning tablets — screens are not recommended for babies under 18–24 months per AAP.',
        'Large toy sets — babies don\'t need 40 toys. They need a few good ones.',
        'Age-targeted "educational" toys with big price tags — a wooden spoon and a plastic bowl teaches the same cause-and-effect as most $40 rattles.',
      ]},
      { type: 'products', items: [
        { emoji: '🎯', name: 'Skip Hop Explore & More Activity Gym', note: 'Good activity gym for the 0–6M window — folds flat and has multiple hanging elements', url: 'https://www.amazon.com/s?k=baby+activity+gym+tummy+time+mat+newborn&tag=sprigloop-20' },
        { emoji: '📚', name: 'High-Contrast Black & White Baby Books (0–6M)', note: 'Developmentally appropriate for newborns — one of the few things that genuinely matters this early', url: 'https://www.amazon.com/s?k=high+contrast+black+white+baby+books+newborn&tag=sprigloop-20' },
        { emoji: '🧱', name: 'Soft Stacking Blocks (6M+)', note: 'Build and knock down — endlessly repeatable at this stage', url: 'https://www.amazon.com/s?k=soft+baby+stacking+blocks+6+months&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'NAEYC — Good Toys for Young Children by Age and Stage', url: 'https://www.naeyc.org/resources/topics/play/toys' },
        { label: 'Seattle Children\'s Hospital — Toys and Play: Birth to 12 Months', url: 'https://www.seattlechildrens.org/health-safety/parenting/toys-and-play-birth-to-12-months/' },
      ]},
    ],
  },

  // ── Guide 12: Health ─────────────────────────────────────────────────────
  {
    slug: 'newborn-health-kit-what-to-have',
    title: 'Newborn Health Kit: What to Have Before You Need It',
    subtitle: 'The thermometer that actually works, the nasal aspirator worth buying, and what your pediatrician will ask.',
    description: 'A practical baby health kit checklist — what to stock before the baby arrives, which thermometer type is actually accurate, and what most parents wish they had on hand.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '5 min',
    tags: ['Health', 'Newborn', 'Checklist'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from pediatric hospital guidance, Children\'s Hospital Colorado, and Kids Central Pediatrics. It contains affiliate links to Amazon.',
    planCategory: 'health',
    sections: [
      { type: 'lede', body: 'The middle of the night is not the time to discover you don\'t own a thermometer. Most health kit items are inexpensive and straightforward — the important thing is having them before you need them, and knowing which ones actually work.' },
      { type: 'h2', heading: 'The thermometer question', body: 'Parents often ask which thermometer is best. The answer depends on age.' },
      { type: 'table', cols: ['Thermometer type', 'Accurate for newborns?', 'Notes'], rows: [
        ['Rectal digital', 'Yes — most accurate', 'AAP gold standard for babies under 3 months'],
        ['Armpit (axillary)', 'Yes — acceptable', 'Slightly less accurate, easier to use'],
        ['Ear (tympanic)', 'Not for under 6 months', 'Ear canal too small for accurate reading'],
        ['Forehead (temporal)', 'Not for under 3 months', 'Accurate for older babies, not newborns'],
      ]},
      { type: 'callout', body: 'When you call your pediatrician about a fever, the first question they will ask is: how did you take the temperature? A rectal reading under 3 months is the most reliable. A digital rectal thermometer is the one item worth buying specifically.' },
      { type: 'h2', heading: 'The nasal aspirator — one upgrade worth it', body: 'Newborns breathe through their nose. When they\'re congested, they can\'t feed well and can\'t sleep well. The standard bulb syringe that hospitals send home works for mild congestion. For a baby with a real cold, the Frida NoseFrida (a suction device you use with your mouth, with a filter) provides significantly stronger and more controlled suction. This is the one health kit upgrade most parents say they wish they\'d bought sooner.' },
      { type: 'h2', heading: 'What to stock before baby arrives', body: '' },
      { type: 'table', cols: ['Item', 'Priority', 'Notes'], rows: [
        ['Digital rectal thermometer', 'Essential', 'Only accurate option under 3 months'],
        ['Nasal aspirator', 'Essential', 'Bulb syringe minimum, NoseFrida recommended'],
        ['Nail file or soft nail scissors', 'Essential', 'Newborn nails are sharp and grow fast'],
        ['Medicine dropper', 'Essential', 'For infant acetaminophen when fever comes'],
        ['Saline nasal drops', 'Essential', 'Loosens congestion before aspiration'],
        ['Petroleum jelly', 'Useful', 'For rectal thermometer, diaper rash backup'],
        ['Infant Tylenol (acetaminophen)', 'Wait', 'Don\'t use until after first 2-month visit without doctor guidance'],
      ]},
      { type: 'products', items: [
        { emoji: '🌡️', name: 'FridaBaby 3-in-1 Digital Rectal Thermometer', note: 'Rectal, armpit, and oral — the right tool for newborns', url: 'https://www.amazon.com/s?k=frida+baby+digital+rectal+thermometer+newborn&tag=sprigloop-20' },
        { emoji: '👃', name: 'Frida Baby NoseFrida Nasal Aspirator', note: 'More effective than a bulb syringe — the one health upgrade most parents recommend', url: 'https://www.amazon.com/s?k=fridababy+nosefrida+nasal+aspirator&tag=sprigloop-20' },
        { emoji: '💊', name: 'Saline Nasal Drops for Babies', note: 'Use before aspiration to loosen congestion', url: 'https://www.amazon.com/s?k=saline+nasal+drops+baby+infant&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'Children\'s Hospital Colorado — Baby First-Aid Kit', url: 'https://www.childrenscolorado.org/just-ask-childrens/articles/baby-first-aid-kit/' },
        { label: 'Kids Central Pediatrics — Newborn Medicine Cabinet Checklist', url: 'https://kidscentralpediatrics.com/newborn-medicine-cabinet-checklist/' },
        { label: 'The Bump — Making a First Aid Kit for Baby', url: 'https://www.thebump.com/a/making-a-first-aid-kit-for-baby' },
      ]},
    ],
  },

  // ── Guide 13: Bath ───────────────────────────────────────────────────────
  {
    slug: 'how-to-bathe-a-newborn',
    title: 'How to Bathe a Newborn Safely',
    subtitle: 'Sponge baths until the cord falls off, water temperature, how often, and what products are actually necessary.',
    description: 'A practical guide to bathing a newborn — when to start, sponge bath technique, safe water temperature, how often to bathe, and which products matter.',
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '5 min',
    tags: ['Bath', 'Newborn', 'Safety'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from Mayo Clinic, AAD, HealthyChildren.org, and Nemours KidsHealth. It contains affiliate links to Amazon.',
    planCategory: 'bath',
    sections: [
      { type: 'lede', body: 'Bathing a newborn is one of those things that sounds intimidating before you\'ve done it and then turns out to be simple. There are a few rules that actually matter for safety, and a lot of products that are mostly optional.' },
      { type: 'h2', heading: 'Sponge baths first', body: 'Until the umbilical cord stump falls off — typically 1–3 weeks after birth — your baby should only have sponge baths. Submerging the cord stump delays healing and risks infection.' },
      { type: 'bullets', items: [
        'Lay baby on a soft towel on a flat surface. Keep them covered except for the part you\'re washing.',
        'Use a damp warm washcloth and a tiny drop of fragrance-free baby wash.',
        'Work from cleanest to dirtiest — face first, diaper area last.',
        'Keep the cord stump dry. If it gets wet, gently pat dry with a soft cloth.',
      ]},
      { type: 'h2', heading: 'Once the cord falls off: tub baths', body: 'After the stump is gone and the area is healed, you can transition to baby tub baths. The technique is simple but a few safety rules matter.' },
      { type: 'table', cols: ['Rule', 'Detail'], rows: [
        ['Water temperature', '100°F (38°C) — test with your wrist or elbow, not your hand'],
        ['Water depth', '2–3 inches maximum'],
        ['Never leave', 'Not for one second — drowning can happen in seconds in any depth'],
        ['Grip', 'Support the head and neck the entire time'],
        ['Set water heater', 'Below 120°F to prevent accidental scalding'],
      ]},
      { type: 'h2', heading: 'How often to bathe', body: 'The AAD recommends bathing newborns no more than 3 times a week. Daily bathing dries out their skin and isn\'t necessary. Between baths, clean the diaper area at every change and wipe the face and neck folds where milk collects.' },
      { type: 'h2', heading: 'Products: what actually matters', body: '' },
      { type: 'table', cols: ['Product', 'Needed?', 'Notes'], rows: [
        ['Baby tub', 'Yes', 'Keeps baby at a safe angle with support'],
        ['Soft washcloths (3–4)', 'Yes', 'Dedicated baby cloths are gentler'],
        ['Fragrance-free baby wash', 'Yes', 'Fragrance irritates newborn skin'],
        ['Fragrance-free baby lotion', 'Sometimes', 'Only if skin is dry — most newborns don\'t need it'],
        ['Baby shampoo', 'Sometimes', 'Use sparingly — newborns don\'t produce much oil'],
        ['Bath thermometer', 'Optional', 'Your wrist is a reliable alternative'],
        ['Baby bathrobe', 'Not necessary', 'A regular towel works identically'],
      ]},
      { type: 'callout', body: 'Skip bath products with fragrance, "calming" essential oils, or anything marketed as a lavender blend. Fragrance is the most common skin irritant for newborns — unscented is always the right choice.' },
      { type: 'products', items: [
        { emoji: '🛁', name: 'Angelcare Soft Touch Baby Bath Support', note: 'Keeps baby safely supported while your hands are free to wash', url: 'https://www.amazon.com/s?k=baby+bath+seat+support+newborn+infant+tub&tag=sprigloop-20' },
        { emoji: '🧼', name: 'Mustela Gentle Cleansing Gel (Fragrance-Free)', note: 'Fragrance-free, dermatologist tested, safe from birth', url: 'https://www.amazon.com/s?k=mustela+gentle+cleansing+gel+fragrance+free&tag=sprigloop-20' },
        { emoji: '🏊', name: 'Soft Hooded Baby Towels (2-pack)', note: 'Hooded towels keep the head warm immediately after the bath', url: 'https://www.amazon.com/s?k=soft+hooded+baby+towel+newborn&tag=sprigloop-20' },
      ]},
      { type: 'sources', items: [
        { label: 'Mayo Clinic — Baby Bath Basics', url: 'https://www.mayoclinic.org/healthy-lifestyle/infant-and-toddler-health/in-depth/healthy-baby/art-20044438' },
        { label: 'AAD — How to Bathe Your Newborn', url: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/newborn-bathing' },
        { label: 'HealthyChildren.org — Bathing Your Baby', url: 'https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Bathing-Your-Newborn.aspx' },
      ]},
    ],
  },

  // ── Guide 6 ──────────────────────────────────────────────────────────────
  {
    slug: 'certified-vs-generic-baby-products',
    title: "What's Actually Worth Buying Certified — and What Isn't",
    subtitle: "A no-nonsense breakdown of when GOTS, OEKO-TEX, and GREENGUARD Gold actually matter, and when you're just paying for a label.",
    description: "The word \"certified\" costs more money. The question is whether it changes anything for your baby — or whether a generic would have given you the same result. Here's how to tell the difference.",
    date: 'June 2026',
    lastmod: '2026-06-04',
    readTime: '8 min',
    tags: ['Safety', 'Buying', 'Certified'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from published safety research, pediatric guidance, and certification body standards. It contains affiliate links to Amazon. If you buy through them, Sprigloop earns a small commission at no cost to you.',
    sections: [
      {
        type: 'lede',
        body: "The word \"certified\" on a baby product does two things: it means something specific about how that product was made, and it costs you more money. The question worth asking before every purchase is whether the certification actually changes anything for your baby — or whether you're paying for peace of mind that a $12 generic would have given you anyway.",
      },
      {
        type: 'lede',
        body: "After going through the research, the answer isn't \"buy everything certified.\" There are specific categories where certification genuinely reduces your baby's chemical exposure, and others where it makes almost no practical difference. Here's how to tell the difference.",
      },
      {
        type: 'h2',
        heading: 'What the certifications actually mean',
        body: 'GOTS (Global Organic Textile Standard) is the most rigorous — it requires organically grown fibers AND that no harmful chemicals were used in processing. OEKO-TEX Standard 100 tests the finished product for harmful substances but doesn\'t require organic fibers. GREENGUARD Gold is for hard goods like mattresses and furniture, testing for chemical emissions into the air.',
      },
      {
        type: 'callout',
        body: 'The key distinction: "Natural," "non-toxic," "eco-friendly," and "clean" are marketing terms with no regulatory definition. Anyone can put them on any product. GOTS, OEKO-TEX, and GREENGUARD Gold require third-party testing and ongoing audits. Everything else is just copy.',
      },
      {
        type: 'h2',
        heading: 'Worth buying certified',
      },
      {
        type: 'h2',
        heading: 'Sleep sacks and swaddles',
        body: "Your baby spends 10–14 hours a day in a sleep sack. Conventional fabrics can carry flame retardant chemicals linked to developmental issues, formaldehyde-based wrinkle finishes, and synthetic dyes with heavy metals. GOTS cotton and wool are naturally flame-resistant without added chemicals. For an item worn during every sleep for the first two years, the premium is justified.",
      },
      {
        type: 'verdict',
        positive: true,
        body: 'Worth the certified premium',
      },
      {
        type: 'bullets',
        items: [
          'Look for GOTS certification specifically — not just "organic cotton" marketing language.',
          'Two-way zipper is a must. 0.5 TOG for warm rooms, 2.5 TOG for winter.',
          'Avoid weighted sleep sacks — the AAP recommends against them regardless of certification.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🛌',
            name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack (0–6M)',
            note: 'GOTS certified, 2-way zipper, 0.5 TOG — best value for the newborn window',
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20',
          },
          {
            emoji: '🌙',
            name: 'Ecolino Organic Cotton Sleep Sack (6–18M)',
            note: '100% GOTS certified cotton, bottom-zip for quick night changes',
            url: 'https://www.amazon.com/dp/B06XJ35W1H/?tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'Sleepwear and bodysuits',
        body: "A baby's skin is up to 30% thinner than an adult's. Studies have found formaldehyde-based finishes in 8% of conventional baby garments. Synthetic dyes can contain heavy metals that absorb through skin with repeated wear. For items worn closest to skin for the longest time, GOTS or OEKO-TEX certification meaningfully reduces exposure.",
      },
      {
        type: 'verdict',
        positive: true,
        body: 'Worth the certified premium',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '👕',
            name: "Burt's Bees Baby Organic Bodysuits",
            note: 'GOTS certified, widely available in multipacks, reasonably priced for organic',
            url: "https://www.amazon.com/s?k=burt%27s+bees+baby+organic+bodysuits&tag=sprigloop-20",
          },
        ],
      },
      {
        type: 'h2',
        heading: 'Swaddle blankets',
        body: "Used constantly in the newborn phase and multitasked constantly. Full GOTS is ideal but OEKO-TEX Standard 100 is a reasonable middle ground — it verifies the finished product is free of harmful substances at a similar price to conventional options.",
      },
      {
        type: 'verdict',
        positive: true,
        body: 'Worth it — OEKO-TEX is enough',
      },
      {
        type: 'h2',
        heading: 'Save your money — generic is fine',
      },
      {
        type: 'h2',
        heading: 'Burp cloths and bibs',
        body: "You need 8–12 burp cloths and will go through 4–6 a day. The chemical concern with textiles is cumulative skin exposure — burp cloths rest on your shoulder, not against baby's skin for extended periods. Buy cheap cotton ones in bulk and wash them before first use.",
      },
      {
        type: 'verdict',
        positive: false,
        body: 'Generic is fine',
      },
      {
        type: 'h2',
        heading: 'Bottles',
        body: "The main safety concern with bottles is BPA, a plasticizer linked to hormonal disruption. But BPA was removed from baby bottles in the US in 2012 — any bottle sold today is BPA-free by law. The \"BPA-free\" label isn't a premium, it's compliance. A $6 generic and a $25 glass bottle have the same BPA exposure: zero.",
      },
      {
        type: 'verdict',
        positive: false,
        body: 'Generic is fine — with one rule',
      },
      {
        type: 'h2',
        heading: 'Strollers and car seats',
        body: "Strollers aren't against baby's skin for 12 hours a day. The fabric content matters less than fit, weight, and ease of use. For car seats, the relevant certification is NHTSA compliance and crash test ratings — not GOTS. Never buy a used car seat. Consumer Reports ratings are the right research here.",
      },
      {
        type: 'verdict',
        positive: false,
        body: 'Certification not the priority',
      },
      {
        type: 'table',
        cols: ['Item', 'Buy certified?', 'What to look for'],
        rows: [
          ['Sleep sacks', 'Yes', 'GOTS certified cotton or wool'],
          ['Sleepwear / bodysuits', 'Yes', 'GOTS or OEKO-TEX'],
          ['Swaddle blankets', 'Yes', 'OEKO-TEX minimum'],
          ['Crib mattress', 'Yes', 'GREENGUARD Gold + no flame retardants'],
          ['Burp cloths & bibs', 'Not necessary', 'Wash before first use'],
          ['Bottles', 'Not necessary', 'BPA-free already required by law'],
          ['Stroller & carrier', 'Low priority', 'Buy for fit and function'],
          ['Car seat', 'Not applicable', 'Crash test ratings only, never buy used'],
        ],
      },
      {
        type: 'callout',
        body: 'The rule of thumb: the longer something touches your baby\'s skin, and the more hours a day they wear it, the more certification matters. Sleepwear and the items underneath are worth the premium. Everything else is diminishing returns.',
      },
      {
        type: 'sources',
        items: [
          { label: 'US Right to Know — Toxic chemicals in baby clothes', url: 'https://usrtk.org/healthwire/toxic-chemicals-in-baby-clothes/' },
          { label: 'Is GOTS-Certified Cotton Really Safer for Baby\'s Skin?', url: 'https://shopikimono.com/blogs/news/is-gots-certified-cotton-really-safer-for-my-babys-skin' },
          { label: 'American Academy of Pediatrics — Safe Sleep Guidelines', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'A Parent\'s Guide to Baby Product Safety Labels', url: 'https://pfwbs.org/decode-safety-certifications-like-a-pro-a-parents-ultimate-guide-to-baby-product-labels-that-matter/' },
          { label: 'Consumer Reports — Best Crib Mattresses', url: 'https://www.consumerreports.org/babies-kids/crib-mattresses/best-crib-mattresses-a9683309833/' },
        ],
      },
    ],
  },
  {
    slug: 'what-you-need-before-baby-arrives',
    title: 'What You Actually Need Before Baby Arrives',
    description: 'A research-backed, tier-by-tier breakdown — car seat first, then sleep, feeding, and health. What to buy, what to borrow, and what to skip.',
    date: 'June 2026',
    lastmod: '2026-06-06',
    readTime: '8 min',
    tags: ['Checklist', 'Planning', 'Newborn'],
    subtitle: 'A research-backed, tier-by-tier breakdown of what to have ready — and what can wait. Sourced from AAP guidelines, Consumer Reports, and pediatricians.',
    category: 'prep',
    sections: [
      {
        type: 'lede',
        body: 'Most baby checklists are written by stores that want you to buy more. This one is different. We broke it down by when you actually need things — what has to be ready before you leave the hospital, what matters in the first week, and what can genuinely wait. The honest answer is that babies need less than the industry wants you to think.',
      },
      {
        type: 'heading',
        body: 'The one thing hospitals check before discharge',
      },
      {
        type: 'body',
        body: 'An infant car seat, properly installed. That\'s it. Hospital staff will inspect it before you leave. No seat, no discharge. This is the single item to get right first — have it installed and checked at a certified inspection station before your due date. The NHTSA has a free car seat check locator.',
      },
      {
        type: 'callout',
        body: 'New federal safety standard FMVSS 213a took effect June 2025, requiring all car seats for children under 40 lbs to meet stricter side-impact standards. When buying, verify the seat was manufactured after this date.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🚗',
            name: 'Chicco KeyFit 35 Infant Car Seat',
            note: 'Consistently top-rated by Consumer Reports. Easy install, extended rear-facing, fits most vehicles.',
            url: 'https://www.amazon.com/s?k=Chicco+KeyFit+35+infant+car+seat&tag=sprigloop-20',
          },
          {
            emoji: '🚗',
            name: 'Cybex Cloud T Infant Car Seat',
            note: 'One of Consumer Reports\' highest scorers. Anti-rebound base with load leg reduces crash forces.',
            url: 'https://www.amazon.com/s?k=Cybex+Cloud+T+infant+car+seat&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'heading',
        body: 'Tier 1: Before you leave the hospital',
      },
      {
        type: 'body',
        body: 'Beyond the car seat, have these ready at home for day one. You won\'t know your baby\'s exact size until birth, so buy a small amount in newborn and put most of your investment in 0–3M.',
      },
      {
        type: 'body',
        body: 'CLOTHING (0–3M): Expect 3–4 outfit changes per day — spit-up and diaper leaks are relentless. You need 7–10 bodysuits, 4–6 one-pieces or footed pajamas, and at least 3–4 warm hats. Newborns lose heat rapidly through their heads; a hat is non-negotiable. Look for envelope necklines (makes undressing a blowout much easier) and two-way zippers for nighttime changes. Burp cloths: have at least 8–10. They work triple duty as spit-up catchers, nursing covers, and changing pad liners.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '👕',
            name: 'Simple Joys by Carter\'s Bodysuits 10-Pack (0–3M)',
            note: 'Snap closures, 100% cotton, envelope necklines. The standard for a reason — durable, soft, affordable.',
            url: 'https://www.amazon.com/s?k=Simple+Joys+Carters+bodysuits+10+pack+0-3+months&tag=sprigloop-20',
          },
          {
            emoji: '🐣',
            name: 'Carter\'s Footed Pajamas 4-Pack',
            note: 'Two-way zippers for nighttime diaper changes without fully undressing baby. Machine washable.',
            url: 'https://www.amazon.com/s?k=Carters+footed+pajamas+4+pack+newborn+zipper&tag=sprigloop-20',
          },
          {
            emoji: '🤍',
            name: 'aden + anais Muslin Burp Cloths 6-Pack',
            note: 'Large, absorbent, gets softer with every wash. Muslin dries faster than terry.',
            url: 'https://www.amazon.com/s?k=aden+anais+muslin+burp+cloths+6+pack&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'body',
        body: 'SLEEP: The AAP recommends babies sleep in the same room as parents for at least the first six months — which makes a bassinet far more practical than a crib for the newborn period. You need a firm, flat sleep surface with a tight-fitting sheet. Nothing else in the sleep space: no pillows, no loose blankets, no positioners. A sleep sack (wearable blanket) replaces loose blankets safely. Choose TOG 1.0–1.5 for 68–72°F rooms; TOG 0.5 for warmer climates.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🛏',
            name: 'HALO BassiNest Swivel Sleeper',
            note: 'Bedside design lets you reach baby without getting up. Swivels 360°, adjusts to bed height. Widely recommended by postpartum nurses.',
            url: 'https://www.amazon.com/s?k=HALO+BassiNest+swivel+sleeper&tag=sprigloop-20',
          },
          {
            emoji: '🛌',
            name: 'HALO SleepSack Swaddle — TOG 1.5, Newborn',
            note: 'Endorsed by hospitals nationwide. Three-way adjustable swaddle transitions to arms-out as baby grows.',
            url: 'https://www.amazon.com/dp/B001PB8G04/?tag=sprigloop-20',
          },
          {
            emoji: '🛌',
            name: 'Yoofoss Organic Cotton Sleep Sack 3-Pack',
            note: 'GOTS certified, two-way zipper, 0.5 TOG — best value for the newborn window.',
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'body',
        body: 'DIAPERING: A changing pad and wipes are the only diapering items you need on day one. The hospital will send you home with a small supply of newborn diapers. A changing pad cover matters more than people think — it\'s what your baby actually touches, and you\'ll be washing it constantly.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🩹',
            name: 'Keekaroo Peanut Changer',
            note: 'Waterproof, wipes clean in seconds, no cover needed. Worth every penny at 3am.',
            url: 'https://www.amazon.com/s?k=Keekaroo+Peanut+Changer&tag=sprigloop-20',
          },
          {
            emoji: '🧻',
            name: 'WaterWipes Sensitive Baby Wipes',
            note: '99.9% water, recommended for newborn skin. No fragrance, no preservatives.',
            url: 'https://www.amazon.com/s?k=WaterWipes+sensitive+baby+wipes&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'body',
        body: 'HEALTH: Hospitals typically send you home with a bulb nasal aspirator — but the Frida NoseFrida is significantly more effective and worth having. A rectal thermometer is the most accurate for newborns; axillary (armpit) and ear readings aren\'t reliable under 3 months.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🤧',
            name: 'Frida Baby NoseFrida Nasal Aspirator',
            note: 'More effective than the bulb syringe the hospital gives you. Parents who have it swear by it.',
            url: 'https://www.amazon.com/s?k=FridaBaby+NoseFrida+nasal+aspirator&tag=sprigloop-20',
          },
          {
            emoji: '🌡',
            name: 'Frida Baby 3-in-1 Ear, Forehead + Rectal Thermometer',
            note: 'Most accurate for newborns is rectal. This covers all three in one device.',
            url: 'https://www.amazon.com/s?k=Frida+Baby+3+in+1+thermometer&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'heading',
        body: 'Tier 2: First week home',
      },
      {
        type: 'body',
        body: 'These items matter in the first week but aren\'t needed before you leave the hospital. Get them in place before your due date.',
      },
      {
        type: 'body',
        body: 'FEEDING: Bottles and a nursing pillow are feeding-method-dependent — not every family needs them immediately. If you plan to breastfeed, a nursing pillow makes positioning easier and reduces back strain. Bottles are essential if formula-feeding or combo-feeding. If breastfeeding, hold off on buying a pump until after birth — many insurance plans cover one, and your hospital\'s lactation consultant can advise on what\'s right for your supply situation.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🍼',
            name: 'Dr. Brown\'s Anti-Colic Bottles Newborn Starter Set',
            note: 'Internal vent system reduces colic, spit-up, and gas. Widely recommended by pediatricians.',
            url: 'https://www.amazon.com/s?k=Dr+Browns+anti-colic+bottles+newborn+starter+set&tag=sprigloop-20',
          },
          {
            emoji: '🤱',
            name: 'Boppy Original Nursing Pillow',
            note: 'Doubles as a support pillow for tummy time. Washable cover. The most widely used nursing pillow.',
            url: 'https://www.amazon.com/s?k=Boppy+original+nursing+pillow&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'body',
        body: 'BATH: Sponge baths only until the umbilical cord falls off — typically around two weeks. You don\'t need a baby bathtub for the first few weeks, but have one ready. Hooded towels are genuinely worth it; they keep baby warm instantly after a bath.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🛁',
            name: 'Frida Baby 4-in-1 Grow-with-Me Bathtub',
            note: 'Works from newborn through toddler. Mesh sling for newborns, converts as baby grows.',
            url: 'https://www.amazon.com/s?k=Frida+Baby+4+in+1+bathtub&tag=sprigloop-20',
          },
          {
            emoji: '🏊',
            name: 'Baby Hooded Towels 3-Pack',
            note: 'Bamboo-cotton blend. Absorbs fast, stays soft. Sized for newborn through 2 years.',
            url: 'https://www.amazon.com/s?k=baby+hooded+towel+bamboo+newborn+3+pack&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'body',
        body: 'SLEEP (continued): A white noise machine is close to essential for the first weeks — newborns were used to the constant sound of the womb and silence is actually unfamiliar. A baby monitor matters once baby is sleeping in a separate room; most families don\'t use one for the first few weeks while baby is in the bassinet by the bed.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🔊',
            name: 'LectroFan Classic White Noise Machine',
            note: '10 fan sounds, 10 ambient noise variations. No looping, no tinny speaker. Runs all night.',
            url: 'https://www.amazon.com/s?k=LectroFan+Classic+white+noise+machine&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'heading',
        body: 'What you definitely don\'t need on day one',
      },
      {
        type: 'body',
        body: 'High chair: not until 4–6 months when baby can sit upright. Baby food maker: not until starting solids at 6 months. Diaper pail: a regular trash can with a lid works fine to start — buy the pail when you\'re ready to stop walking to the garbage. Jumper or bouncer: nice to have, not urgent. Wipe warmer: genuinely unnecessary (your hands work). Baby monitor: not needed if baby is sleeping in your room, which the AAP recommends for the first six months.',
      },
      {
        type: 'callout',
        body: 'The most common mistake first-time parents make is buying everything before the baby arrives. Babies develop preferences fast — the bouncer one baby loves, another hates. Buy the essentials, then let your actual baby tell you what else they need.',
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP Safe Sleep Guidelines 2025', url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/a-parents-guide-to-safe-sleep.aspx' },
          { label: 'Consumer Reports — Best Infant Car Seats 2026', url: 'https://www.consumerreports.org/babies-kids/car-seats/best-infant-car-seats-of-the-year-a7088444370/' },
          { label: 'The Bump — Best Infant Car Seats', url: 'https://www.thebump.com/a/best-infant-car-seats' },
          { label: 'Newton Baby — Minimalist Baby Registry Checklist', url: 'https://www.newtonbaby.com/blogs/parenting-kids/minimalist-baby-registry-checklist' },
          { label: 'Cuddle Sprouts — How Many Bodysuits Does a Baby Need', url: 'https://cuddlesprouts.com/blogs/news/how-many-bodysuits-does-a-baby-need-a-realistic-checklist-by-age-laundry-schedule' },
        ],
      },
    ],
  },
  {
    slug: "how-much-does-a-baby-cost-first-year",
    title: "How Much Does a Baby Actually Cost in the First Year?",
    description: "Real numbers broken down by category — childcare, feeding, diapers, gear, healthcare, and clothing — with honest budget, mid-range, and premium ranges.",
    date: "June 2026",
    lastmod: '2026-06-06',
    readTime: "7 min",
    tags: ["Budgeting", "Planning", "First Year"],
    subtitle: "Real numbers, broken down by category — with honest ranges for budget, mid-range, and premium. No fluff.",
    category: "prep",
    sections: [
      {
        type: "lede",
        body: "The figure you see most often is around $20,000 for the first year. That number is real, but it hides a massive range. A family that breastfeeds, uses daycare subsidies, and buys secondhand gear might spend $8,000. A family with formula, a full-time nanny, and a SNOO might spend $50,000. The number that matters is yours — so here is every category broken down honestly.",
      },
      {
        type: "heading",
        body: "The big one: childcare",
      },
      {
        type: "body",
        body: "Childcare is almost always the largest first-year expense for working parents — often larger than all other categories combined. Infant daycare runs $650–$1,500 per month nationally, but averages over $2,000 per month in high-cost cities like San Francisco, New York, or Boston. A full-time nanny costs $1,500–$4,300 per month depending on location. If one parent stays home, this category is $0 — which is why first-year cost estimates vary so wildly. Budget $8,000–$24,000 for daycare, or $18,000–$50,000+ for a nanny.",
      },
      {
        type: "callout",
        body: "If both parents are working, childcare alone will likely be your largest monthly expense — bigger than your mortgage or rent in many cities. Build this into your budget before anything else.",
      },
      {
        type: "heading",
        body: "Feeding: $0–$3,600 depending on method",
      },
      {
        type: "body",
        body: "Breastfeeding: the cost of nursing supplies, a pump (often covered by insurance under the ACA), and lactation support runs $300–$800 for the year. Many families pay much less. Formula: store-brand formula runs $70–$100 per month ($840–$1,200/year). Name-brand formula runs $120–$200 per month ($1,440–$2,400/year). Specialty or hypoallergenic formula runs $200–$300 per month ($2,400–$3,600/year). Combo-feeding lands somewhere in between. You likely will not know which category you fall into until after birth.",
      },
      {
        type: "heading",
        body: "Diapers and wipes: $1,000–$1,500",
      },
      {
        type: "body",
        body: "Disposable diapers cost $840–$1,200 for the first year, averaging $70–$100 per month. Add $150–$300 for wipes. Cloth diapers require a larger upfront investment ($300–$600 for a full set) but dramatically lower ongoing costs. Most families spend $1,000–$1,500 total on diapers and wipes in year one.",
      },
      {
        type: "products",
        items: [
          {
            emoji: "👶",
            name: "Pampers Swaddlers Newborn Gift Set",
            note: "Most hospital-recommended diaper. Wetness indicator for newborns. Start here and switch brands if you want to save.",
            url: "https://www.amazon.com/s?k=Pampers+Swaddlers+newborn+gift+set&tag=sprigloop-20",
          },
          {
            emoji: "🧻",
            name: "WaterWipes Sensitive Baby Wipes 720-Count",
            note: "99.9% water, no fragrance. The standard for newborn skin. Buying in bulk cuts the per-wipe cost significantly.",
            url: "https://www.amazon.com/s?k=WaterWipes+sensitive+baby+wipes+720&tag=sprigloop-20",
          },
        ],
      },
      {
        type: "heading",
        body: "Healthcare: $500–$3,500",
      },
      {
        type: "body",
        body: "Babies have at least seven well-child visits in their first year — at birth, 1 month, 2 months, 4 months, 6 months, 9 months, and 12 months. With good insurance, your out-of-pocket is often $0 for these visits since preventive care is covered under the ACA. Without insurance, expect $85–$150 per visit ($600–$1,000 for the year). Vaccinations add $620+ if not covered by insurance — most plans cover them fully, and the CDC Vaccines for Children program covers them for eligible families at no cost. Budget $500–$1,500 with insurance, $2,000–$3,500 without.",
      },
      {
        type: "heading",
        body: "Gear and one-time purchases: $1,200–$4,500",
      },
      {
        type: "body",
        body: "This is where most first-time parents overspend — buying everything new and at full price. The reality: babies outgrow most gear quickly, and secondhand is safe for almost everything except car seats and crib mattresses. Budget ranges: Car seat: $150–$500 (buy new). Bassinet or crib: $100–$900. Stroller: $200–$1,200. Baby monitor: $30–$350. Swing or bouncer: $60–$200. Baby carrier: $40–$180. Breast pump: $0–$400 (check insurance first). Total gear budget: $1,200–$4,500 depending on how much you buy new vs. secondhand.",
      },
      {
        type: "callout",
        body: "The two items experts unanimously say to buy new: infant car seat (safety ratings degrade over time, recalls matter) and crib mattress (firmness standards and off-gassing). Everything else can safely be bought secondhand.",
      },
      {
        type: "heading",
        body: "Clothing: $300–$600",
      },
      {
        type: "body",
        body: "Babies outgrow sizes every 6–10 weeks in the first year. A common mistake is buying too much in any single size — especially newborn, which many babies skip entirely. Budget $50–$80 per size window, and plan on 5–8 size windows in the first year. Total: $300–$600. Gifts and hand-me-downs can dramatically reduce this number. If you are using Sprigloop to track what you have and receive as gifts, you will know exactly where your gaps are at each size.",
      },
      {
        type: "heading",
        body: "The full picture: what to expect",
      },
      {
        type: "body",
        body: "Without childcare — $8,000–$15,000 for the year. Budget families who breastfeed, buy secondhand, and receive gifts can get to the lower end. With daycare — $18,000–$35,000. With a nanny — $30,000–$55,000. The USDA puts the average at $20,384, which assumes a middle-income family with some childcare and no major medical costs.",
      },
      {
        type: "callout",
        body: "The most common financial mistake: not accounting for the income lost during parental leave, especially unpaid leave. The gear costs are the visible part of the budget — the leave period is often where the real financial pressure comes from.",
      },
      {
        type: "sources",
        items: [
          { label: "BabyCenter — First Year Baby Costs 2025", url: "https://blog.americanheritagecu.org/what-a-baby-costs-in-their-first-year-in-2025" },
          { label: "USDA — Expenditures on Children by Families", url: "https://www.usda.gov/about-usda/news/blog/cost-raising-child" },
          { label: "New York Life — Monthly Baby Expenses Breakdown", url: "https://www.newyorklife.com/articles/breakdown-of-biggest-expenses-for-your-child" },
          { label: "CDC — Vaccines for Children Program", url: "https://www.cdc.gov/vaccines-for-children/vfc-information-for-parents/index.html" },
          { label: "Healthline — Budgeting for Baby First Year", url: "https://www.healthline.com/health/parenting/how-much-does-it-cost-to-raise-a-baby-and-what-you-can-do-to-prepare" },
        ],
      },
    ],
  },
  {
    slug: "how-much-to-save-before-baby-arrives",
    title: "How Much to Save Before Baby Arrives",
    description: "A realistic savings target for the gear and supplies you need before day one, with budget vs mid-range vs premium breakdowns and a month-by-month savings plan.",
    date: "June 2026",
    lastmod: '2026-06-06',
    readTime: "6 min",
    tags: ["Budgeting", "Planning", "Checklist"],
    subtitle: "A realistic savings target for the gear and supplies you need before day one — broken down so you know exactly what you are building toward.",
    category: "prep",
    sections: [
      {
        type: "lede",
        body: "Most financial advice tells you to save three to six months of expenses and calls it a day. That is useful for the long run, but it does not answer the more immediate question: how much do I need in the bank before this baby arrives? Here is the honest breakdown for the pre-arrival gear window specifically.",
      },
      {
        type: "heading",
        body: "The arrival gear budget: $1,500–$4,000",
      },
      {
        type: "body",
        body: "This is the amount most families spend on gear before the baby comes home — the one-time purchases that need to be in place on day one. It does not include ongoing costs like diapers, formula, or childcare, which begin after birth. A realistic pre-arrival gear budget looks like this: Car seat ($150–$500), bassinet or bedside sleeper ($100–$900), stroller ($200–$1,200), changing pad and cover ($50–$150), clothing for 0–3M ($100–$200 before gifts arrive), newborn health kit — thermometer, nasal aspirator, nail clippers ($40–$80), white noise machine ($30–$80), baby monitor ($30–$350). Total: $700–$3,460 for the essentials. Add a swing or bouncer ($60–$200) and a breast pump ($0–$400 depending on insurance) and you reach $1,500–$4,000.",
      },
      {
        type: "callout",
        body: "Buy the car seat and bassinet first. Everything else can be ordered in the final weeks or after birth. Do not let the full list paralyze you into buying nothing — the car seat and a safe sleep surface are the two non-negotiables before discharge.",
      },
      {
        type: "heading",
        body: "Budget vs. mid-range vs. premium",
      },
      {
        type: "body",
        body: "BUDGET ($700–$1,200): Graco infant car seat, Graco Pack n Play as sleep surface, umbrella stroller, basic monitor, Carter brand clothing in bulk. Safe, functional, no frills. MID-RANGE ($1,500–$2,500): Chicco KeyFit car seat, HALO BassiNest, UPPAbaby or similar stroller, Nanit or Infant Optics monitor, mix of mid-range clothing brands. PREMIUM ($3,000–$5,000+): Cybex Cloud T, SNOO smart bassinet, high-end stroller system, Owlet monitor. The gear does not determine the outcome. A Graco car seat is just as safe as a Cybex — the difference is convenience features and aesthetics.",
      },
      {
        type: "products",
        items: [
          {
            emoji: "💰",
            name: "Graco SnugRide 35 Lite LX — Budget Pick",
            note: "Consistently top-rated by Consumer Reports in the budget category. Lightweight, easy install, widely compatible with strollers.",
            url: "https://www.amazon.com/s?k=Graco+SnugRide+35+Lite+LX+infant+car+seat&tag=sprigloop-20",
          },
          {
            emoji: "🏆",
            name: "Chicco KeyFit 35 — Mid-Range Pick",
            note: "Top-rated by Consumer Reports for several years. Easy install, superior base, extended rear-facing weight limit.",
            url: "https://www.amazon.com/s?k=Chicco+KeyFit+35+infant+car+seat&tag=sprigloop-20",
          },
          {
            emoji: "💰",
            name: "HALO BassiNest Glide — Budget Bassinet Pick",
            note: "Bedside design, swivels for easy access, adjustable height. Much more affordable than the SNOO with similar positioning.",
            url: "https://www.amazon.com/s?k=HALO+BassiNest+Glide+Sleeper&tag=sprigloop-20",
          },
          {
            emoji: "🏆",
            name: "SNOO Smart Bassinet — Premium Pick",
            note: "Automatically responds to baby cries with motion and sound. Backed by clinical sleep research. Expensive but available to rent ($200/month) if the purchase price is a barrier.",
            url: "https://www.amazon.com/s?k=SNOO+smart+bassinet&tag=sprigloop-20",
          },
        ],
      },
      {
        type: "heading",
        body: "What you can safely wait on",
      },
      {
        type: "body",
        body: "High chair: not until 4–6 months. Buy after birth when you can see what fits your space. Baby bathtub: sponge baths only for the first 2 weeks (until the umbilical cord falls off). You have time. Crib: a bassinet or Pack n Play handles the first 3–6 months while you figure out the nursery. Baby food maker, sippy cups, plates: not until 6 months when solids start. Swing or bouncer: many babies love these, many ignore them. Buy one, test it, then decide if you need another. Nursery decor and furniture: nice, but has no bearing on safety or readiness.",
      },
      {
        type: "heading",
        body: "The savings target: how to think about the number",
      },
      {
        type: "body",
        body: "Most financial advisors recommend having 3–6 months of living expenses saved before baby arrives. That is good advice for the long run. But specifically for the pre-arrival gear window: save $2,000–$3,000 before your due date to cover gear without stress, knowing that registry gifts will cover some of it. Then separately, build a buffer for the income gap during parental leave — typically 6–12 weeks of your monthly take-home if your employer does not offer paid leave. That buffer is often more important than the gear budget.",
      },
      {
        type: "callout",
        body: "The registry is your most underused financial tool. A well-structured registry — one that shows real gaps rather than a manually curated wish list — can reduce your out-of-pocket gear spending by $500–$1,500. Star your most critical items so family and friends know where to focus.",
      },
      {
        type: "heading",
        body: "Month-by-month savings plan",
      },
      {
        type: "body",
        body: "If you have 9 months until your due date and want to save $3,000 for gear: $333/month gets you there. If you have 6 months: $500/month. If you have 3 months: $1,000/month — focus on the essentials list only and let the registry cover the rest. Practical starting point: open a dedicated savings account the day you find out you are pregnant, name it something specific (Baby Gear Fund), and automate a transfer the day after your paycheck lands. The name matters — it makes the money feel earmarked and discourages spending it on other things.",
      },
      {
        type: "sources",
        items: [
          { label: "BECU — Year 1 Baby Costs", url: "https://www.becu.org/blog/year-1-baby-costs-its-more-than-you-think" },
          { label: "Omega Pediatrics — New Mom Guide to Budgeting", url: "https://www.omegapediatrics.com/new-moms-guide-to-budgeting/" },
          { label: "PatPat — First Year Baby Costs Calculator", url: "https://www.patpat.com/blogs/parenting/first-year-baby-costs-calculator-guide" },
          { label: "WealthKeel — First Year Baby Budget", url: "https://wealthkeel.com/blog/first-year-baby-budget/" },
          { label: "Consumer Reports — Best Infant Car Seats 2026", url: "https://www.consumerreports.org/babies-kids/car-seats/best-infant-car-seats-of-the-year-a7088444370/" },
        ],
      },
    ],
  },
  {
    slug: 'how-to-choose-a-baby-stroller',
    title: 'How to Choose a Baby Stroller',
    subtitle: 'What parents actually need to know — from newborn safety to flying to whether you really need two.',
    category: ['Travel', 'Planning'],
    tags: ['Travel', 'Stroller', 'Gear', 'Planning'],
    date: 'June 2026',
    lastmod: '2026-06-07',
    readTime: '9 min',
    description: 'A research-backed guide to the questions parents actually ask when buying a stroller — and honest answers to all of them.',
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from Consumer Reports testing, Safe in the Seat, Fathercraft, BabyGearLab, and parenting community research. It contains affiliate links to Amazon.',
    sections: [
      {
        type: 'body',
        body: 'A stroller is one of the most personal purchases in baby gear. The right one depends almost entirely on your actual daily life — where you live, how you get around, whether you travel, and how long you plan to use it. This guide answers the questions parents ask most, in the order they tend to matter.',
      },
      {
        type: 'h2',
        heading: 'Can I use it from day one?',
        body: 'Not automatically. Whether a newborn can go in a stroller depends on how the seat reclines. Newborns need to lie nearly flat — a semi-upright position causes their heavy heads to slump forward, which can compress their airway.',
      },
      {
        type: 'bullets',
        items: [
          'From birth to about 4 months, babies need a fully reclined or flat sleeping position. Look for a stroller that either reclines flat, accepts a bassinet attachment, or is compatible with an infant car seat so the baby travels in their own safe shell.',
          'Babies can typically sit in a slightly reclined (30–45 degree) stroller seat around 3–6 months as they develop head control. A fully upright seat is generally safe around 6 months when they can hold their head steady on their own.',
          'If you want one stroller from day one, choose either a travel system (stroller + compatible infant car seat) or a stroller with a true bassinet mode or flat recline. Many strollers advertised as "newborn ready" have a recline that isn\'t flat enough — check the specs.',
          'Travel systems are the most popular first stroller for a reason. The infant car seat snaps directly onto the stroller base, meaning you don\'t wake a sleeping baby to transfer them. Most families outgrow the infant seat around 12 months but continue using the stroller frame for years.',
        ],
      },
      {
        type: 'h2',
        heading: 'What type of stroller do you actually need?',
        body: 'The stroller market has ballooned into half a dozen categories that blend into each other. Here\'s what the categories actually mean in plain terms.',
      },
      {
        type: 'bullets',
        items: [
          'Full-size strollers (like the UPPAbaby Vista or Nuna MIXX) are the most versatile everyday option. Larger basket, better suspension, more accessories, more comfortable for long days out. They\'re heavier — typically 20–28 lbs — which matters more for some lifestyles than others.',
          'Travel systems bundle a stroller frame with an infant car seat. If you\'re buying your first stroller, this is usually the right starting point. The Chicco Bravo and Graco Modes are popular mid-range options. The UPPAbaby Vista with MESA car seat is the premium pick.',
          'Lightweight and compact strollers (like the Baby Jogger City Mini GT2 or Bugaboo Butterfly) weigh 15–20 lbs and fold smaller. Less storage and suspension than full-size, but genuinely easier to manage solo. Good everyday choice for city parents or anyone who loads a stroller in and out of a car frequently.',
          'Travel strollers (like the UPPAbaby MINU V3 or Joolz Aer) are under 14 lbs, fold very small, and are designed to go places. They can work as an everyday stroller if you\'re willing to trade basket size and ride quality. Good choice if you travel frequently or live somewhere that demands a small fold.',
          'Jogging strollers have a fixed front wheel for stability at running speed, three large air-filled tires, and serious suspension. Get one only if you actually run — they\'re too wide and rigid for everyday errands and crowded spaces. The BOB Revolution is the standard recommendation.',
        ],
      },
      {
        type: 'h2',
        heading: 'How much should you spend?',
        body: 'Strollers range from $80 to $1,500+. The jumps in quality are real at the lower end and diminishing at the top.',
      },
      {
        type: 'bullets',
        items: [
          'Under $200: Graco and Chicco make serviceable strollers in this range that are safe and functional. Expect a smaller basket, fewer adjustment points, and lower resale value. Fine for occasional use or if budget is the constraint.',
          '$200–$400: The sweet spot for most families. Baby Jogger City Mini GT2, Chicco Bravo travel system, Nuna TRIV. You get a better fold, a bigger basket, more comfortable seat, and decent durability.',
          '$400–$700: Premium everyday territory. UPPAbaby Cruz V2, Bugaboo Butterfly, Nuna MIXX Next. Noticeably better build quality, smoother ride, and significantly better resale value — these hold 40–60% of their original value.',
          'Over $700: UPPAbaby Vista V3, Bugaboo Fox 5, Stokke Xplory. Justified if you plan to use it for multiple children (the Vista converts to a double), want the best ride quality, or prioritize resale. Premium brands consistently return 50–65% on the secondhand market.',
          'The resale math matters: a $900 UPPAbaby Vista that sells for $500 used has an effective cost of $400. A $250 Graco that sells for $50 costs $200. The gap is smaller than the sticker price suggests — if you\'ll have more than one child or plan to resell.',
        ],
      },
      {
        type: 'h2',
        heading: 'What features actually matter?',
        body: 'Showrooms are full of features that sound essential and turn out not to matter. Here\'s what parents consistently say makes a real daily difference.',
      },
      {
        type: 'bullets',
        items: [
          'Fold. This is the single most important feature to test in person. You will fold and unfold your stroller multiple times a day, often with one hand while holding the baby. A one-hand fold isn\'t a luxury. Try it in the store — if it takes more than 5 seconds, you\'ll resent it.',
          'Basket size. Small baskets are a daily annoyance. Try putting a diaper bag in it in the store. If it barely fits, add a grocery bag in your head — can it hold both? Most parents discover the basket matters more than they expected.',
          'Handlebar height. If either parent is over 6 feet, test whether you\'re bending your back to push. Some strollers have fixed-height handlebars that are genuinely uncomfortable for tall people. Telescoping or adjustable handlebars fix this.',
          'Canopy coverage. A large canopy with a UPF rating and a peekaboo window is more useful than it sounds. You\'ll use the peekaboo window constantly to check on a sleeping baby without stopping to pull the canopy back.',
          'Seat recline depth. More important for younger babies. A seat that reclines fully flat means you can use the stroller from birth without accessories. A partial recline means you need a bassinet insert or car seat adapter for newborns.',
          'Suspension and wheel quality. Push the stroller over a doorstep or a curb in the store. A stroller with poor suspension bounces a sleeping baby awake on every sidewalk crack. Foam-filled or air-filled tires handle rough terrain better than hard plastic wheels.',
        ],
      },
      {
        type: 'h2',
        heading: 'Features that sound important and usually aren\'t',
      },
      {
        type: 'bullets',
        items: [
          'Reversible seat direction: sounds useful for bonding with a newborn who faces you, then flipping forward when they want to see the world. In practice most parents use it once and leave it in one position.',
          'Cup holders: come standard or cost $15 as an add-on. Not a reason to choose one stroller over another.',
          'Color and fabric: you\'re going to spill on it, wipe it down, and eventually sell it. Choose a color you don\'t hate. Don\'t pay a $200 premium for a color option.',
          'Number of accessories: a large accessory ecosystem is a sign of a popular product and a profit center for the manufacturer — not evidence that the stroller is better.',
        ],
      },
      {
        type: 'h2',
        heading: 'How much does weight matter?',
        body: 'Almost entirely depends on how you get around.',
      },
      {
        type: 'bullets',
        items: [
          'City and transit parents: weight matters a lot. If you\'re lifting a stroller onto buses, up subway stairs, in and out of cabs, or navigating a building with no elevator — you feel every pound, multiple times a day. For this lifestyle, aim for under 15 lbs. Anything over 20 lbs will frustrate you inside a month.',
          'Suburban and car-dependent parents: weight matters much less than stroller marketing suggests. You load the stroller into a trunk once or twice a day. The difference between 18 lbs and 26 lbs is one manageable lift. Most parents in this category over-weight weight in their decision-making and end up sacrificing basket size and ride quality for a number that barely affects their day.',
          'Stairs in your home: if you carry the stroller up steps to get inside, weight matters even in a car-dependent life. A 26-lb stroller up a flight of stairs several times a day adds up.',
          'Consumer Reports draws the line at 17 lbs for "lightweight." Under 15 lbs is genuinely easy to carry one-handed. Over 25 lbs is considered heavy by most standards.',
        ],
      },
      {
        type: 'h2',
        heading: 'Will it fit your life? Car, trunk, and stairs.',
        body: 'Parents consistently report this as something they didn\'t think carefully enough about before buying.',
      },
      {
        type: 'bullets',
        items: [
          'Before buying, open your trunk and visualize: will this stroller fit with a diaper bag and groceries? Many full-size strollers take up the entire trunk when folded. If you drive a small car, measure the trunk opening and compare it to the stroller\'s folded dimensions.',
          'Can you get it in and out solo? If your partner travels for work or you\'ll often be alone with the baby, practice folding and loading the stroller in the store by yourself. Some strollers require two hands, a specific sequence of steps, and muscle memory to fold gracefully.',
          'Will you navigate doorways and store aisles? Most standard strollers are 24–26 inches wide. Many older buildings, boutique shops, and restaurant bathrooms are tighter than that. Compact strollers are typically 20–22 inches wide.',
          'Does your building have an elevator? If not and you\'re on an upper floor, a lighter stroller or one with a very compact fold becomes significantly more important.',
        ],
      },
      {
        type: 'h2',
        heading: 'Do you need two strollers?',
        body: 'Probably not — but the answer depends on how you travel.',
      },
      {
        type: 'bullets',
        items: [
          'Most families convince themselves they need an everyday stroller and a lightweight travel stroller. In reality, the majority of families would be better served by one stroller chosen thoughtfully for their actual life.',
          'If you fly 4 or more times a year AND your everyday stroller is a heavy full-size model (20+ lbs), a second lightweight stroller starts to make practical sense. Otherwise you\'re storing a piece of gear you\'ll use a handful of times.',
          'The smarter play: buy one stroller that fits your daily life first. After 6–12 months, you\'ll know exactly what you wish it did better. That\'s when a second stroller — if you still want one — becomes an informed purchase instead of a guess.',
          'If you want to buy one stroller that handles both daily life and travel, the UPPAbaby MINU V3 and Joolz Aer are the best options. Both are under 14 lbs, fold compactly enough for most overhead bins, and are good enough for everyday use. The trade-off is a smaller basket and less suspension than a full-size stroller.',
        ],
      },
      {
        type: 'h2',
        heading: 'What about flying? Gate-check vs. overhead bin.',
        body: 'This question gets more attention than it deserves. Here\'s the actual situation.',
      },
      {
        type: 'bullets',
        items: [
          'Every major US airline — American, Delta, United, Southwest, JetBlue, Alaska, Hawaiian — lets you gate-check a stroller for free. You push it to the jet bridge, hand it over, and it\'s waiting for you at the gate when you land. No fee, no hassle beyond a 30-second handoff.',
          'The exceptions are Frontier and Spirit, which do not gate-check strollers for free. If those are your primary airlines, overhead-bin compatibility is worth paying for.',
          'Most strollers marketed as "airline friendly" still have to be gate-checked. Strollers that genuinely fit overhead bins — the Stokke YOYO3, Joolz Aer, a handful of others — fold to roughly 20" × 17" × 7". That\'s a very small club.',
          'Overhead-bin strollers cost $400–$700+. If the main reason you\'re considering one is overhead-bin storage, you\'re paying hundreds of dollars to avoid a 30-second gate-check on a free stroller.',
          'The overhead-bin feature is genuinely useful in two scenarios: you fly Frontier or Spirit frequently, or you\'re doing international travel with connecting flights where gate-checking is less reliable. For most domestic US travel, gate-checking is faster and easier than finding overhead bin space.',
        ],
      },
      {
        type: 'h2',
        heading: 'How long will you use it?',
        body: 'Longer than most parents expect, which changes the math on how much to spend.',
      },
      {
        type: 'bullets',
        items: [
          'Most children use a stroller regularly until age 3–4. For busy city families, long travel days, or theme parks, many kids use them until 4–5. Consumer Reports found parents using convertible strollers for an average of 5.7 years compared to 3.2 years for single-function strollers.',
          'If you plan to have a second child, a stroller that converts to a double (like the UPPAbaby Vista or Nuna DEMI Grow) dramatically changes the value calculation. You\'re not buying two strollers — you\'re buying one that handles both.',
          'Premium strollers hold their value well. UPPAbaby, Bugaboo, and Nuna consistently sell at 40–60% of their original price on the secondhand market. A $900 Vista that sells for $500 after 5 years of use is a very different purchase than it appears.',
          'Budget strollers depreciate quickly and are harder to sell. A $250 Graco that sells for $30 used is effectively a disposable product — which is fine if that\'s what you need, but worth understanding upfront.',
        ],
      },
      {
        type: 'products',
        items: [
          { emoji: '🏆', name: 'UPPAbaby Vista V3 — Best Full-Size', note: 'Converts single to double for a second child. Best resale value on the market. The long-term investment pick.', url: 'https://www.amazon.com/s?k=UPPAbaby+Vista+V3+stroller&tag=sprigloop-20' },
          { emoji: '⭐', name: 'Baby Jogger City Mini GT2 — Best Mid-Range', note: 'One-hand fold, all-terrain wheels, works from birth with adapter. Around $350 and punches well above its price.', url: 'https://www.amazon.com/s?k=Baby+Jogger+City+Mini+GT2+stroller&tag=sprigloop-20' },
          { emoji: '✈️', name: 'UPPAbaby MINU V3 — Best Travel / Lightweight', note: 'Best ride quality in its class. Overhead-bin sized. Good enough to be your only stroller if you travel frequently.', url: 'https://www.amazon.com/s?k=UPPAbaby+MINU+V3+stroller&tag=sprigloop-20' },
          { emoji: '🌿', name: 'Joolz Aer 2 — Lightest Travel Stroller', note: 'Lightest of the premium travel strollers. Easy one-hand fold, fits most overhead bins, reasonable basket.', url: 'https://www.amazon.com/s?k=Joolz+Aer+2+stroller&tag=sprigloop-20' },
          { emoji: '💰', name: 'Graco Modes Pramette — Best Budget', note: 'Pram mode from birth through toddler years. Accepts most infant car seats. Under $200.', url: 'https://www.amazon.com/s?k=Graco+Modes+Pramette+stroller&tag=sprigloop-20' },
          { emoji: '🏃', name: 'BOB Revolution Flex 3.0 — Best Jogging', note: 'The standard jogging stroller recommendation. Fixed front wheel for running, real suspension. Buy only if you actually run.', url: 'https://www.amazon.com/s?k=BOB+Revolution+Flex+3.0+jogging+stroller&tag=sprigloop-20' },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Consumer Reports — Best Strollers of the Year', url: 'https://www.consumerreports.org/babies-kids/strollers/best-strollers-of-the-year-a5254350204/' },
          { label: 'Consumer Reports — Best Lightweight Strollers', url: 'https://www.consumerreports.org/babies-kids/strollers/best-lightweight-strollers-of-the-year-a9537130151/' },
          { label: 'Safe in the Seat — When Can Babies Sit in a Stroller?', url: 'https://www.safeintheseat.com/post/when-can-babies-sit-in-a-stroller' },
          { label: 'Safe in the Seat — Can You Take a Stroller on a Plane?', url: 'https://www.safeintheseat.com/post/can-you-take-a-stroller-on-a-plane' },
          { label: 'Fathercraft — Best Travel Strollers 2026', url: 'https://fathercraft.com/best-travel-strollers/' },
          { label: 'Strolleria — When to Stop Using a Stroller', url: 'https://strolleria.com/blogs/news/when-to-stop-using-a-stroller-age-stage-guide-for-parents' },
          { label: 'MAMAZING — Full-Size vs Travel Stroller', url: 'https://www.mamazing.com/blogs/guides/lightweight-vs-full-feature-a-comprehensive-travel-stroller-comparison' },
        ],
      },
    ],
  },
  {
    slug: 'introducing-solid-foods-what-you-need',
    title: 'Introducing Solid Foods: What You Actually Need',
    subtitle: 'The gear, quantities, and timing — without the overpriced gadgets.',
    description: 'A practical guide to introducing solid foods: when to start, what equipment you actually need, and which eco-friendly products are worth buying.',
    date: 'June 2026',
    lastmod: '2026-06-10',
    readTime: '8 min',
    tags: ['Feeding', 'Solids', 'Gear', 'Planning'],
    aiDisclosure: 'This article was researched and written with AI assistance. Timing and safety guidance follows recommendations from the American Academy of Pediatrics and World Health Organization. It contains affiliate links to Amazon.',
    sections: [
      {
        type: 'lede',
        body: 'Solid food introduction is one of the most marketed milestones in babyhood. Baby food makers, puree kits, freezer trays, suction plates, silicone bibs — the gear list can feel endless. Most of it is optional. This guide covers what you actually need, when you need it, and what to skip.',
      },
      {
        type: 'h2',
        heading: 'When to start',
        body: 'The American Academy of Pediatrics recommends introducing solid foods around 6 months — not before 4 months, and ideally not much later than 6–7 months. The signs of readiness matter more than the exact date.',
      },
      {
        type: 'bullets',
        items: [
          'Your baby can sit up with minimal support and hold their head steady. This is a hard requirement — a baby who can\'t hold their head upright can\'t eat safely.',
          'They\'ve lost the tongue-thrust reflex. Younger babies automatically push food out of their mouths with their tongues. When this fades, they can actually move food toward the back of their mouth.',
          'They show interest in food — watching you eat, reaching for what\'s on your plate, opening their mouth when food approaches.',
          'They\'ve doubled their birth weight and weigh at least 13 pounds.',
          'Starting before 4 months is associated with increased risk of obesity, food allergies, and digestive issues. The WHO recommends waiting until 6 months. If your baby seems hungry before 4 months, speak to your pediatrician — the answer is almost always more breast milk or formula, not food.',
        ],
      },
      {
        type: 'h2',
        heading: 'The two approaches: purees vs. baby-led weaning',
        body: 'Both are safe and supported by research. Most families end up doing a combination.',
      },
      {
        type: 'bullets',
        items: [
          'Purees (spoon-feeding): You offer thin, smooth purees and gradually thicken the texture over weeks. Traditional approach, well-understood by pediatricians. Gives you more control over exactly what and how much the baby eats in the early stages.',
          'Baby-led weaning (BLW): You skip purees entirely and offer soft, appropriately-sized pieces of real food from the start. Baby feeds themselves. Promotes self-regulation, reduces picky eating in some studies, and eliminates the prep step of making purees. Requires more confidence around choking (gagging is normal and different from choking) and a tolerance for mess.',
          'Combined approach: Start with thin purees, add soft finger foods alongside them as motor skills develop around 7–8 months. This is what most families actually do, and it works well.',
          'What both approaches have in common: start with single ingredients, wait 3–5 days before adding another new food so you can identify reactions, avoid honey before 12 months (botulism risk), avoid cow\'s milk as a main drink before 12 months, and skip added salt and sugar entirely in the first year.',
        ],
      },
      {
        type: 'note',
        body: 'Early allergen introduction is now recommended by the AAP — particularly peanuts, eggs, tree nuts, fish, and wheat. Research (the LEAP study and others) shows that introducing allergenic foods early (around 6 months, not waiting) significantly reduces the risk of developing allergies. Talk to your pediatrician about how to introduce these safely.',
      },
      {
        type: 'h2',
        heading: 'What you actually need',
        body: 'The gear list for solid food introduction is much shorter than the baby product industry would have you believe.',
      },
      {
        type: 'table',
        cols: ['Item', 'Do you need it?', 'Notes'],
        rows: [
          ['High chair', 'Yes', 'Non-negotiable. Baby needs to be upright and supported.'],
          ['Silicone bib with pocket', 'Yes — 2–3', 'Catches food, wipes clean, lasts years'],
          ['Soft-tip spoons', 'Yes — 2–4', 'For purees and self-feeding attempts'],
          ['Suction bowl or plate', 'Yes — 1–2', 'Prevents plate-flipping, which is a daily occurrence'],
          ['Baby food maker / blender', 'Optional', 'A regular blender works. Dedicated ones just take up space.'],
          ['Freezer trays', 'Optional', 'Useful if batch-cooking purees. An ice cube tray works identically.'],
          ['Mesh feeder', 'Optional', 'Useful for teething, letting baby gnaw frozen fruit. Not essential.'],
          ['Squeeze pouches', 'Avoid as primary', 'Fine for travel, but teach pouch-sucking not real eating texture'],
        ],
      },
      {
        type: 'h2',
        heading: 'Choosing a high chair',
        body: 'This is the one piece of gear worth spending real money on. You\'ll use it every day for 2–3 years. Cheap high chairs are wobbly, hard to clean, and fall apart. Look for these things:',
      },
      {
        type: 'bullets',
        items: [
          'Easy to clean: No fabric inserts that trap food and mold. Hard plastic or wood with a removable tray is what you actually want. Every crevice is a place for pureed sweet potato to fossilize.',
          'Foot support: A footrest isn\'t a luxury — it gives babies a stable base to push against while learning to eat. This matters more than most parents expect.',
          'Adjustability: A chair that grows with the child (adjustable seat height and foot rest) gets years more use than a fixed model.',
          'The Stokke Tripp Trapp is the gold standard for longevity — made from sustainable beech wood, adjustable for newborns to adults, and used by families for a decade or more. It\'s expensive but the cost-per-year math is favorable. The IKEA ANTILOP is the budget recommendation: $25, BPA-free plastic, dishwasher-safe tray, beloved by parents worldwide for being unglamorous and bulletproof.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to look for in feeding gear',
        body: 'For everything that contacts food, prioritize materials that are safe and durable:',
      },
      {
        type: 'bullets',
        items: [
          'Silicone over plastic wherever possible. 100% food-grade silicone is free of BPA, phthalates, and PVC, doesn\'t leach under heat, and can go in the dishwasher. Look for LFGB or FDA-grade certification on the label.',
          'Stainless steel for longer-term use. Stainless bowls and cups are durable, non-reactive, and don\'t harbor bacteria the way some plastics do.',
          'Avoid painted or decorated wooden utensils for young babies — they go in the mouth constantly and you can\'t verify paint composition.',
          'Bibs: waterproof silicone bibs with a food-catcher pocket are the most practical for this stage. They wipe clean in seconds and handle full-bowl-dump incidents with grace. Cloth bibs need rinsing, soaking, and more laundry.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🌳',
            name: 'Stokke Tripp Trapp High Chair',
            note: 'Sustainable beech wood, grows from infant to adult. Best long-term value. Add the infant insert for use from birth.',
            url: 'https://www.amazon.com/s?k=Stokke+Tripp+Trapp+high+chair&tag=sprigloop-20',
          },
          {
            emoji: '🟢',
            name: 'EZPZ Mini Mat — 100% Silicone Suction Plate',
            note: 'Made in the USA, 100% silicone, no plastic. Suctions to the table, not a tray — harder for babies to flip. The standard recommendation.',
            url: 'https://www.amazon.com/s?k=ezpz+mini+mat+silicone&tag=sprigloop-20',
          },
          {
            emoji: '🥄',
            name: 'Grabease Self-Feeding Utensil Set',
            note: 'Short, choke-resistant handles designed for baby fists. BPA-free, dishwasher safe. Good for both spoon-feeding and early self-feeding.',
            url: 'https://www.amazon.com/s?k=grabease+self+feeding+utensils+baby&tag=sprigloop-20',
          },
          {
            emoji: '🧼',
            name: 'Bumkins Waterproof Silicone Bib (3-pack)',
            note: 'Soft silicone with a deep food-catcher pocket. Wipes clean in seconds. Replaces dozens of cloth bibs in the solid food stage.',
            url: 'https://www.amazon.com/s?k=bumkins+silicone+bib+baby&tag=sprigloop-20',
          },
          {
            emoji: '🍽️',
            name: 'WeeSprout Glass Baby Food Containers',
            note: 'Glass storage with leak-proof lids — safe for freezing, reheating, and no plastic touching food. Better than plastic baby food containers for batch cooking.',
            url: 'https://www.amazon.com/s?k=weesprout+glass+baby+food+containers&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'h2',
        heading: 'First foods to try',
        body: 'There\'s no required order. Focus on single ingredients, iron-rich options, and variety early.',
      },
      {
        type: 'bullets',
        items: [
          'Iron-rich foods first: Iron from breast milk decreases around 6 months just as the baby\'s stores from birth begin to deplete. Prioritize iron-rich first foods: pureed meat (chicken, beef, lamb), iron-fortified single-grain cereal, or pureed legumes.',
          'Good early purees: pea, sweet potato, butternut squash, pear, banana, avocado, carrot. All mash or blend easily and most babies accept them readily.',
          'Early finger foods (for BLW or combined feeding from 6–7 months): steamed broccoli florets large enough to hold, ripe banana spears, avocado slices, soft-cooked carrot sticks. Always soft enough to squish between your fingers.',
          'What to avoid in year one: honey (botulism), added sugar and salt, cow\'s milk as a main drink (small amounts in cooking are fine), unpasteurized cheese, raw or undercooked eggs, large pieces of anything that could be a choking hazard, whole grapes, whole nuts, and raw carrots.',
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Starting Solid Foods', url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Starting-Solid-Foods.aspx' },
          { label: 'AAP — Baby-Led Weaning', url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Baby-Led-Weaning.aspx' },
          { label: 'WHO — Complementary Feeding', url: 'https://www.who.int/health-topics/complementary-feeding' },
          { label: 'LEAP Study — Early Peanut Introduction', url: 'https://www.leapstudy.co.uk/' },
          { label: 'AAP — Choking Prevention', url: 'https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx' },
        ],
      },
    ],
  },

  {
    slug: 'breastfeeding-supplies-checklist',
    title: 'Breastfeeding Supplies Checklist',
    subtitle: 'What to have ready before baby arrives — and what you can skip.',
    description: 'A practical checklist of breastfeeding supplies — what you actually need, what to buy only after baby arrives, and what the industry oversells.',
    date: 'June 2026',
    lastmod: '2026-06-10',
    readTime: '7 min',
    tags: ['Feeding', 'Breastfeeding', 'Checklist', 'Planning'],
    aiDisclosure: 'This article was researched and written with AI assistance. Clinical guidance draws from the American Academy of Pediatrics, La Leche League International, and CDC recommendations. It contains affiliate links to Amazon.',
    sections: [
      {
        type: 'lede',
        body: 'Breastfeeding has a short but specific gear list. Some items are genuinely useful from day one — a pump, nursing pads, nipple cream. Others are things the market sells aggressively but most parents never use. This guide sorts the two.',
      },
      {
        type: 'note',
        body: 'Under the ACA, most insurance plans are required to cover a breast pump and lactation counseling at no cost to you. Call your insurer before buying a pump — you may be entitled to one for free. This applies to most employer-sponsored plans and Medicaid. Exceptions exist for grandfathered plans.',
      },
      {
        type: 'h2',
        heading: 'The short list: buy before baby arrives',
        body: 'These items are practical to have ready from day one — either because you\'ll use them immediately, or because you\'ll be too exhausted postpartum to shop.',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity', 'Notes'],
        rows: [
          ['Breast pump', '1', 'Check insurance first — may be covered'],
          ['Nursing bras', '3–4', 'Buy 1–2 before birth; bodies change postpartum'],
          ['Reusable nursing pads', '8–10 pairs', 'For leaking between feeds, especially first 6 weeks'],
          ['Nipple cream / balm', '1–2 tubes', 'Lanolin or lanolin-free organic options'],
          ['Haakaa or silicone pump', '1', 'Catches letdown from the opposite breast while nursing'],
          ['Nursing pillow', '1', 'Boppy or Brest Friend — reduces arm strain significantly'],
          ['Breast milk storage bags', '50–100', 'If you plan to pump and store'],
        ],
      },
      {
        type: 'h2',
        heading: 'Choosing a pump',
        body: 'Insurance-covered pumps are typically hospital-grade double electric pumps — the most effective option for establishing supply. If your plan covers only basic pumps, you can often pay an upgrade fee for a better model. Here\'s what the categories mean:',
      },
      {
        type: 'bullets',
        items: [
          'Double electric pumps: Both sides simultaneously, most efficient for maintaining supply. Medela Pump In Style and Spectra S2 are the most recommended by lactation consultants. Medela has decades of clinical research behind it. Spectra is quieter and hospital-grade at a consumer price.',
          'Wearable pumps: Elvie and Willow are hands-free and worn inside a bra. Genuinely useful for pumping while working or multitasking. Less efficient per session than a double electric — most lactation consultants recommend using a traditional pump to establish supply first, then supplementing with a wearable.',
          'Manual pumps: Medela Harmony is the standard recommendation. Useful as a backup, for travel, or for the occasional missed feed. Not practical as a primary pump for anyone feeding frequently.',
          'The Haakaa silicone collector is not technically a pump — it attaches via suction and catches letdown passively while you nurse on the other side. It\'s cheap, works with no effort, and many parents collect 1–3 oz per session that would otherwise be lost. Highly recommended regardless of which pump you have.',
        ],
      },
      {
        type: 'h2',
        heading: 'Nursing bras and pads',
        body: 'Your body will change significantly in the weeks after birth as milk comes in. Buy 1–2 nursing bras before the baby arrives and wait to buy the rest until your supply regulates at 4–6 weeks.',
      },
      {
        type: 'bullets',
        items: [
          'What to look for: drop-down or slide-aside cups, comfortable elastic that doesn\'t dig in, enough support for a fuller-than-usual chest, and breathable fabric. Underwire is generally not recommended while breastfeeding — it can restrict flow and contribute to plugged ducts.',
          'Sleep bras: Many nursing parents find a soft, wireless sleep bra with nursing access helpful overnight — something to hold pads in place and provide light support without a traditional bra clasp.',
          'Nursing pads for leaking: Reusable organic cotton or bamboo pads are the eco-friendly choice. Disposables work in a pinch but generate significant waste when you\'re going through 4–6 pairs a day. Bamboobies are the most popular reusable brand. Wash them in a lingerie bag on warm.',
          'How long do you need pads: Most parents leak heavily for the first 4–8 weeks while supply is establishing. After that it tapers significantly, and many parents stop needing pads entirely once feeding is well-established.',
        ],
      },
      {
        type: 'h2',
        heading: 'Nipple care',
        body: 'Soreness in the first 1–2 weeks is extremely common as you and your baby establish a latch. It should not be sharp or toe-curling pain — that signals a latch problem worth addressing with a lactation consultant. For everyday initial soreness:',
      },
      {
        type: 'bullets',
        items: [
          'Lanolin cream: A small amount applied after feeding creates a moist healing environment and is safe for baby to ingest — no need to wipe off before nursing. Lansinoh is the most widely recommended brand.',
          'Organic lanolin-free options: Earth Mama Organics Nipple Butter uses organic herbs and shea butter. Safer for parents who prefer to avoid animal byproducts.',
          'Hydrogel pads: Cooling gel pads used between feeds for severe soreness. More useful if you\'re dealing with cracked or damaged nipples rather than standard initial tenderness.',
          'What actually fixes nipple pain: A correct latch. A lactation consultant can assess this in person and it\'s the highest-ROI intervention for breastfeeding difficulty. Most hospitals offer in-patient support; La Leche League offers free community support.',
        ],
      },
      {
        type: 'h2',
        heading: 'Milk storage',
        body: 'If you plan to pump and store milk, you\'ll need storage bags and a system.',
      },
      {
        type: 'bullets',
        items: [
          'Breast milk storage bags: Pre-sterilized, lay flat to freeze (more efficient storage), and most have a pour spout for transferring to a bottle. Lansinoh and Medela are the standard brands. Label every bag with date and volume — freezer milk is FIFO (use oldest first).',
          'How long does milk last: At room temperature 4 hours, in the fridge 4 days, in a standard freezer 6 months, in a deep freezer 12 months. The CDC publishes a safe storage guide worth bookmarking.',
          'Reusable silicone bags: Prefix and Junobie make reusable silicone breast milk storage bags. More expensive upfront, significantly less waste over months of pumping. Wash carefully — dried milk residue in silicone requires thorough cleaning.',
          'You do not need a bottle warmer: A bowl of warm water works identically and has one fewer gadget to clean. If you want one anyway, choose one with a temperature control rather than a timer-only model.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to skip or buy only if you need it',
        body: 'These are frequently marketed to nursing parents but rarely necessary:',
      },
      {
        type: 'bullets',
        items: [
          'Nursing cover: If you want one, one is useful. Many parents find a light muslin blanket works identically and has more uses.',
          'Nursing teas and supplements: Most have no clinical evidence of increasing supply. The things that reliably support supply are frequent feeds or pumping sessions, adequate hydration, and enough calories. Talk to your lactation consultant before spending money on supplements.',
          'Milk storage trays: A standard ice cube tray with a lid works the same as a specialty breast milk tray.',
          'Nursing necklaces: Designed to give baby something to fidget with during feeds. May help. A bead necklace from any shop does the same.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🤍',
            name: 'Haakaa Silicone Breast Pump',
            note: 'Attaches via suction, catches letdown hands-free while you nurse on the other side. 100% food-grade silicone. One of the most-recommended breastfeeding buys.',
            url: 'https://www.amazon.com/s?k=haakaa+silicone+breast+pump&tag=sprigloop-20',
          },
          {
            emoji: '🌿',
            name: 'Bamboobies Reusable Nursing Pads (8-pack)',
            note: 'Organic bamboo and cotton. Washable, contoured, stay in place. Far less waste than disposables over weeks of leaking.',
            url: 'https://www.amazon.com/s?k=bamboobies+reusable+nursing+pads&tag=sprigloop-20',
          },
          {
            emoji: '💚',
            name: 'Earth Mama Organic Nipple Butter',
            note: 'Certified organic, lanolin-free, no need to wipe off before nursing. Good option if you prefer plant-based ingredients.',
            url: 'https://www.amazon.com/s?k=earth+mama+organic+nipple+butter&tag=sprigloop-20',
          },
          {
            emoji: '🍼',
            name: 'Spectra S2 Plus Double Electric Breast Pump',
            note: 'Hospital-grade, whisper-quiet, closed system (no milk can enter the pump). The top lactation consultant recommendation alongside Medela.',
            url: 'https://www.amazon.com/s?k=spectra+s2+plus+breast+pump&tag=sprigloop-20',
          },
          {
            emoji: '🧊',
            name: 'Junobie Reusable Silicone Breast Milk Storage Bags',
            note: 'Food-grade silicone, reusable, dishwasher safe. Replaces hundreds of disposable storage bags. Better for the environment and cost-effective over time.',
            url: 'https://www.amazon.com/s?k=junobie+reusable+silicone+breast+milk+bags&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'CDC — How to Keep Your Breast Pump Clean', url: 'https://www.cdc.gov/hygiene/personal-hygiene/breast-pump.html' },
          { label: 'CDC — Proper Storage and Preparation of Breast Milk', url: 'https://www.cdc.gov/breastfeeding/recommendations/handling_breastmilk.htm' },
          { label: 'AAP — Breastfeeding and the Use of Human Milk', url: 'https://publications.aap.org/pediatrics/article/150/1/e2022057988/188347' },
          { label: 'La Leche League International — Finding a Local Leader', url: 'https://www.llli.org/get-help/' },
          { label: 'Healthcare.gov — Breastfeeding Benefits', url: 'https://www.healthcare.gov/coverage/birth-family-planning-benefits/' },
        ],
      },
    ],
  },

  {
    slug: 'how-many-diapers-does-a-baby-go-through',
    title: 'How Many Diapers Does a Baby Go Through?',
    subtitle: 'Month-by-month numbers — so you know how much to buy and when to size up.',
    description: 'Real diaper usage numbers by age and size, plus guidance on eco-friendly diaper options, sizing, and how to avoid overstocking.',
    date: 'June 2026',
    lastmod: '2026-06-10',
    readTime: '6 min',
    tags: ['Diapering', 'Planning', 'Quantities'],
    aiDisclosure: 'This article was researched and written with AI assistance. Diaper usage ranges are drawn from pediatric nursing guidance, AAP feeding frequency data, and parent-reported data. It contains affiliate links to Amazon.',
    sections: [
      {
        type: 'lede',
        body: 'New parents consistently overbuy newborn diapers and underbuy size 2 and 3. The math is straightforward once you know the numbers — and knowing them saves you from a closet full of diapers your baby outgrew before you opened them.',
      },
      {
        type: 'h2',
        heading: 'Usage by age and size',
        body: 'Diaper frequency decreases as babies get older. Newborns pee and poop many times per day. By toddlerhood, a child is down to 4–6 changes per day.',
      },
      {
        type: 'table',
        cols: ['Age', 'Typical Size', 'Diapers per Day', 'Per Month'],
        rows: [
          ['Newborn (0–4 weeks)', 'Newborn / NB', '10–12', '310–370'],
          ['1–2 months', 'Size 1', '8–10', '250–310'],
          ['2–4 months', 'Size 2', '8–10', '250–310'],
          ['4–7 months', 'Size 3', '6–8', '185–250'],
          ['7–12 months', 'Size 3–4', '6–8', '185–250'],
          ['12–18 months', 'Size 4', '5–7', '155–215'],
          ['18–24 months', 'Size 5', '4–6', '125–185'],
          ['2–3 years', 'Size 5–6', '4–5 (or potty training)', '125–155'],
        ],
      },
      {
        type: 'note',
        body: 'Skip newborn size if your baby is likely to be larger. Babies born at 9 lbs or more often skip newborn size entirely — they arrive already fitting into size 1. If you want to be safe, buy only 1–2 packs of newborns and wait to see. You can always buy more.',
      },
      {
        type: 'h2',
        heading: 'When to size up',
        body: 'Size is based on weight, not age. Move up when:',
      },
      {
        type: 'bullets',
        items: [
          'Your baby is at the top of the weight range listed on the package.',
          'You\'re seeing frequent leaks or blowouts, especially around the legs or back.',
          'The diaper leaves red marks on the baby\'s skin after removal.',
          'You\'re struggling to fasten the tabs without stretching them.',
          'When in doubt, go up a size. A slightly too-large diaper rarely causes problems. A too-small one causes leaks and discomfort.',
        ],
      },
      {
        type: 'h2',
        heading: 'Eco-friendly diaper options',
        body: 'Conventional disposable diapers are one of the most common items in landfills — an estimated 20 billion diapers per year in the US alone. If this matters to you, there are better options.',
      },
      {
        type: 'bullets',
        items: [
          'Plant-based disposables: Made with bamboo or plant-derived materials instead of petroleum-based SAP (super-absorbent polymer). Brands like Dyper, Eco by Naty, Andy Pandy, and Bambo Nature use bamboo viscose and are free from chlorine bleaching, fragrances, latex, and TBT. They perform comparably to conventional diapers and are certified by Oeko-Tex or similar.',
          'Cloth diapers: The most environmentally friendly option when considering lifetime impact. Modern cloth systems (GroVia, Thirsties, Esembly) use waterproof covers with absorbent inserts. Require upfront investment ($300–$500 for a full stash) and more laundry, but generate almost no ongoing waste and save significant money over 2–3 years of diapering.',
          'Hybrid systems: Brands like GroVia offer reusable covers with both cloth inserts (for home) and disposable inserts (for travel or daycare). Good middle ground if full cloth feels like too much.',
          'Biodegradable disposables: Some brands market compostable diapers, but home composting of soiled diapers is not safe or practical. Commercial composting facilities that accept them are very limited. "Biodegradable" in landfill conditions often doesn\'t mean much. The benefit is mainly the absence of harsh chemicals rather than end-of-life decomposition.',
        ],
      },
      {
        type: 'h2',
        heading: 'How much to stock before baby arrives',
        body: 'Resist the urge to build a massive stockpile before birth. Babies grow faster than you expect and sizes change quickly.',
      },
      {
        type: 'bullets',
        items: [
          'Newborn: 1–2 packs (or zero, if baby will likely be large). Even if needed, the newborn stage lasts only 2–4 weeks.',
          'Size 1: 1–2 packs to start. You can order more within a day when you know baby\'s weight.',
          'Size 2: Once your baby is clearly past newborn, buy a larger supply of size 2 — this is the highest-usage size for the first 3 months after the newborn stage.',
          'Never buy more than a 2-month supply of any one size. Babies have growth spurts and can jump a size faster than you\'d expect.',
          'Buying in bulk saves money only within a size range you\'re sure about. If you have a 6-month supply of size 3 and your baby sizes up in 2 months, you\'ve wasted money.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to look for in a diaper',
        body: 'Not all diapers fit the same. Fit is the biggest factor in leak prevention.',
      },
      {
        type: 'bullets',
        items: [
          'Stretchy tabs: Give you more adjustment range and are gentler on sensitive skin.',
          'Umbilical cord notch (newborn only): Many newborn diapers have a cutout so the diaper sits below the healing cord stump. Useful in the first 1–3 weeks.',
          'Wetness indicator: A colored line on the front of the diaper changes color when wet. Very useful in the newborn stage when you\'re not sure if the diaper is actually wet. Less necessary as you develop a sense of your baby\'s feeding and elimination patterns.',
          'Fragrance-free: Choose unscented diapers wherever possible. Fragrances are a common irritant on newborn skin and can contribute to diaper rash.',
          'Fit over absorbency: A diaper that fits well and leaks occasionally is better than a super-absorbent diaper that blows out due to poor fit around the legs.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🌿',
            name: 'Dyper Bamboo Diapers',
            note: 'Plant-based bamboo viscose, free of chlorine, fragrance, latex, and TBT. Oeko-Tex certified. Subscription available. Best eco pick for parents who prefer disposable convenience.',
            url: 'https://www.amazon.com/s?k=dyper+bamboo+diapers&tag=sprigloop-20',
          },
          {
            emoji: '🍃',
            name: 'Eco by Naty Diapers',
            note: 'European standard for plant-based disposables. FSC-certified, EU Ecolabel, free from chlorine and fragrances. Good fit through the early sizes.',
            url: 'https://www.amazon.com/s?k=eco+by+naty+diapers&tag=sprigloop-20',
          },
          {
            emoji: '🌱',
            name: 'GroVia Hybrid Cloth Diaper System',
            note: 'Reusable waterproof shell with choice of cloth or compostable disposable inserts. Good starter kit for cloth-curious parents. Well-made, leak-resistant.',
            url: 'https://www.amazon.com/s?k=grovia+hybrid+cloth+diaper&tag=sprigloop-20',
          },
          {
            emoji: '🧺',
            name: 'Esembly Cloth Diaper Starter Kit',
            note: 'GOTS-certified organic cotton inners, OEKO-TEX certified outers. Designed as a complete system — includes everything needed to start cloth diapering.',
            url: 'https://www.amazon.com/s?k=esembly+cloth+diaper+starter+kit&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Diapering Your Baby', url: 'https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diapering-Your-Baby.aspx' },
          { label: 'EPA — Diapers: Environmental Impacts', url: 'https://www.epa.gov/sites/default/files/2017-12/documents/fullreport_-_an_examination_of_disposable_and_reusable_diapers.pdf' },
          { label: 'Oeko-Tex — Certified Safe Products', url: 'https://www.oeko-tex.com/en/our-standards/oeko-tex-standard-100' },
        ],
      },
    ],
  },

  {
    slug: 'what-to-pack-in-a-diaper-bag',
    title: 'What to Pack in a Diaper Bag',
    subtitle: 'The complete list — plus what experienced parents say they wish they\'d left out.',
    description: 'A practical packing list for a baby diaper bag, organized by age and outing length, with guidance on choosing an eco-friendly bag and avoiding common overpacking mistakes.',
    date: 'June 2026',
    lastmod: '2026-06-10',
    readTime: '6 min',
    tags: ['Travel', 'Diapering', 'Planning', 'Gear'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from pediatric safety guidelines and parent community research. It contains affiliate links to Amazon.',
    sections: [
      {
        type: 'lede',
        body: 'New parents pack too much. The diaper bag becomes a rolling supply depot that weighs 15 pounds and contains three items you\'ll actually use. This guide gives you the real list — organized by age and outing length — and the things experienced parents say they eventually left at home.',
      },
      {
        type: 'h2',
        heading: 'The core list (0–6 months)',
        body: 'For a typical outing with a newborn or young infant, these are the items you\'ll actually use:',
      },
      {
        type: 'table',
        cols: ['Item', 'Quantity', 'Notes'],
        rows: [
          ['Diapers', '1 per hour out + 2 extra', 'Minimum. Always round up.'],
          ['Fragrance-free wipes', '20–30 wipes', 'One travel pack or refill pouch'],
          ['Changing pad', '1', 'Foldable, waterproof. Most bags include one.'],
          ['Diaper cream', 'Small tube', 'Only if baby has active rash'],
          ['Spare onesie', '1–2', 'For blowouts. Pack one more than you think you need.'],
          ['Spare pants or sleep sack', '1', 'Bottom half gets hit most in a blowout'],
          ['Burp cloth', '2–3', 'Doubles as a bib, shade cloth, surface cleaner'],
          ['Feeding supplies', 'Depends', 'See section below'],
          ['Wet bag or waterproof pouch', '1', 'For soiled clothes — a sealed plastic bag works too'],
          ['Hand sanitizer', '1 small bottle', 'For diaper changes away from a sink'],
          ['Pacifier + case', '1–2 if used', 'Case keeps it clean in the bag'],
        ],
      },
      {
        type: 'h2',
        heading: 'Feeding supplies by method',
        body: 'What you pack for feeding depends entirely on how your baby eats:',
      },
      {
        type: 'bullets',
        items: [
          'Breastfeeding: Nursing cover if you use one (or a muslin blanket), nipple pads if you\'re still leaking, and a small tube of nipple balm for longer outings. That\'s it.',
          'Bottle feeding (pumped milk or formula): A pre-filled bottle or insulated bottle bag to keep milk cold, plus a formula dispenser if formula-feeding so you can mix on the go without carrying an open container of powder.',
          'Combo feeding: Pack for both scenarios on longer outings. On short trips, you can usually manage with whichever is the primary method.',
          'Starting solids (6+ months): Add a silicone bib, a pouch of baby food or small soft pieces in a container, a spoon, and a small water cup. The bag gets heavier at this stage but the diaper frequency decreases.',
        ],
      },
      {
        type: 'h2',
        heading: 'Scale by outing length',
        body: 'One of the most common overpacking triggers is packing for every scenario on every trip. Calibrate to the outing:',
      },
      {
        type: 'bullets',
        items: [
          'Under 2 hours (coffee run, quick errand): 2–3 diapers, wipes, one spare outfit, pacifier. That\'s a small pouch, not a full bag.',
          'Half day (pediatrician, park, lunch out): Full core list above. One feeding session worth of supplies.',
          'Full day: Double the diapers, two spare outfits, two feeding sessions worth of supplies, small first aid kit.',
          'Overnight or travel: Treat as two full-day outings. Pack a dedicated overnight bag in addition to your day bag — trying to combine them leads to chaos.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to leave out',
        body: 'Items parents consistently pack and then stop packing after the first month:',
      },
      {
        type: 'bullets',
        items: [
          'Full-size items of anything. The point of a diaper bag is portability. Decant everything into travel sizes.',
          'Toys for young babies. A newborn is not bored at the pediatrician. A 3-month-old does not need five toys in the bag. One small crinkle toy or teether is enough.',
          'Multiple changes of clothes for you. One spare shirt (in your own bag or tucked in the diaper bag pocket) is sufficient. Blowouts rarely get on the adult holding the baby.',
          'Baby lotion on every outing. Unless your baby has a skin condition that requires it, lotion is not a diaper-bag necessity.',
          'A full first aid kit. A few bandages and infant Tylenol for full-day outings. Everything else stays home.',
          'Snacks for a baby under 6 months. Breast milk and formula are the entire diet. Nothing else goes in the bag for feeding.',
        ],
      },
      {
        type: 'h2',
        heading: 'Choosing a diaper bag',
        body: 'The diaper bag you choose matters less than how you pack it. That said, a few features make a genuine daily difference:',
      },
      {
        type: 'bullets',
        items: [
          'Wipe-clean lining: Essential. You will get things on the inside of this bag. A water-resistant or wipeable interior saves significant cleanup time.',
          'A dedicated wet pocket: Waterproof, zippered, sized for soiled clothes. If your bag doesn\'t have one, a reusable wet bag solves the problem.',
          'Stroller straps: If you use a stroller, the ability to hang the bag from the handles keeps your hands free. Stroller hooks also work.',
          'Weight: An empty diaper bag that weighs 2+ lbs is a burden before you\'ve put anything in it. Lightweight bags matter more than they seem when you\'re also carrying an infant.',
          'Insulated pocket: Useful if you bottle-feed — keeps bottles at temperature without a separate insulated bag.',
          'Eco-friendly bags: Look for bags made from recycled materials (rPET) or GOTS-certified organic fabrics. Avoid bags with PVC linings — they\'re harder to recycle and contain additives you\'d rather not have around food and baby items.',
        ],
      },
      {
        type: 'h2',
        heading: 'When to restock',
        body: 'The most common diaper bag failure is running out of something because nobody restocked it. Build one habit:',
      },
      {
        type: 'bullets',
        items: [
          'After every outing, spend 90 seconds restocking whatever you used. Check diapers, wipes, and spare clothes. This is easier than doing a full inventory before the next outing when you\'re already trying to get out the door.',
          'Keep a small reserve at home staged near the bag: a few diapers, a travel pack of wipes, and an extra onesie that you swap in immediately after using one.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '♻️',
            name: 'Itzy Ritzy Boss Diaper Bag Backpack',
            note: 'Made from recycled materials, insulated bottle pocket, stroller straps included. Lightweight for its size. One of the most recommended eco-conscious diaper bags.',
            url: 'https://www.amazon.com/s?k=itzy+ritzy+boss+plus+diaper+bag+backpack&tag=sprigloop-20',
          },
          {
            emoji: '🧴',
            name: 'ALVABABY Reusable Wet Bags (3-pack)',
            note: 'Waterproof PUL fabric, double zipper, machine washable. Use one for soiled clothes, one for wet swimwear or wipes, one as backup. Far better than single-use plastic bags.',
            url: 'https://www.amazon.com/s?k=alvababy+reusable+wet+bag+baby&tag=sprigloop-20',
          },
          {
            emoji: '🧻',
            name: 'Water Wipes Original — Fragrance-Free Baby Wipes',
            note: '99.9% water and a drop of fruit extract. The most minimal ingredients of any wipe. Recommended by dermatologists for newborn skin. Biodegradable.',
            url: 'https://www.amazon.com/s?k=waterwipes+original+baby+wipes&tag=sprigloop-20',
          },
          {
            emoji: '🗂️',
            name: 'OXO Tot Diaper Bag Organizer Insert',
            note: 'If you use a regular tote or backpack as a diaper bag, this insert adds pockets and structure. Lets you turn any bag into a diaper bag without buying a dedicated one.',
            url: 'https://www.amazon.com/s?k=oxo+tot+diaper+bag+organizer+insert&tag=sprigloop-20',
          },
          {
            emoji: '🧽',
            name: 'Portable Changing Pad — Foldable Waterproof',
            note: 'Folds to the size of a wallet, wipes clean, includes a small strap to roll it up. Better than a changing pad built into a bag (it\'s thicker and more cushioned).',
            url: 'https://www.amazon.com/s?k=portable+foldable+waterproof+changing+pad+baby&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Diapering Your Baby', url: 'https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diapering-Your-Baby.aspx' },
          { label: 'AAP — Car Safety Seats: Information for Families', url: 'https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Car-Safety-Seats-Information-for-Families.aspx' },
        ],
      },
    ],
  },

  // ── How-To Guide 1: How to Swaddle ──────────────────────────────────────
  {
    slug: 'how-to-swaddle-a-baby',
    title: 'How to Swaddle a Baby',
    subtitle: 'Step-by-step technique, when to stop, hip safety, and which products make it easier.',
    description: 'Swaddling reduces crying and improves sleep in the newborn period — but only when done correctly. Here is the safe technique, the safety rules, and when to stop.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '6 min',
    tags: ['How To', 'Newborn', 'Sleep'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP guidelines, pediatric sleep research, and International Hip Dysplasia Institute guidance. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Swaddling mimics the snug environment of the womb and triggers a calming reflex in newborns. When done correctly, it reduces crying, extends sleep, and prevents the startle reflex from waking a sleeping baby. When done incorrectly, it can restrict hip development or increase suffocation risk. This guide gives you the safe technique and the research behind it.',
      },
      {
        type: 'note',
        body: 'The AAP recommends stopping swaddling as soon as your baby shows any signs of rolling — typically around 2 months, sometimes earlier. A swaddled baby who rolls to their stomach cannot push up to free their airway.',
      },
      {
        type: 'h2',
        heading: 'The science behind swaddling',
        body: 'A 2002 study in Pediatrics found that swaddled infants cried significantly less and had longer periods of quiet sleep than unswaddled infants. The mechanism is the Moro (startle) reflex: newborns have an involuntary response to perceived falling that causes them to fling their arms outward, which frequently wakes them from sleep. Swaddling suppresses this reflex. Research also shows swaddled newborns have lower cortisol (stress hormone) levels and more stable heart rates during painful procedures like heel sticks.',
      },
      {
        type: 'h2',
        heading: 'What you need',
        body: 'A square muslin or cotton blanket, at least 40x40 inches. Smaller blankets come unwrapped. Stretchy jersey knit works for smaller babies but loses effectiveness faster as babies grow stronger.',
      },
      {
        type: 'h2',
        heading: 'How to swaddle: the diamond technique',
      },
      {
        type: 'bullets',
        items: [
          'Lay the blanket flat in a diamond shape. Fold the top corner down about 6 inches to create a straight edge at the top.',
          'Place baby on their back with their neck on that folded edge and shoulders just below it. Their head should be above the blanket.',
          'Hold baby\'s right arm gently against their body. Pull the left side of the blanket across their chest and tuck it snugly under their left side and back.',
          'Fold the bottom corner up over baby\'s feet and tuck it into the top of the wrap across their chest.',
          'Hold baby\'s left arm against their body. Pull the right side of the blanket across their chest and tuck the remaining fabric underneath them.',
          'The fit should be snug enough that the blanket stays in place but loose enough that you can slip two fingers between the blanket and baby\'s chest.',
        ],
      },
      {
        type: 'h2',
        heading: 'Hip safety: the critical rule',
        body: 'Swaddling with straight, extended legs can cause or worsen hip dysplasia — a condition where the ball of the hip joint does not fit properly in the socket. The International Hip Dysplasia Institute estimates that improper swaddling may be a contributing factor in hip dysplasia cases.',
      },
      {
        type: 'note',
        body: 'Always swaddle with hips loose. Baby\'s legs should be able to bend up and out at the hips (the "frog" position) inside the swaddle. The upper body should be snug; the lower body should have room to move. Never wrap legs straight and tight.',
      },
      {
        type: 'h2',
        heading: 'When to stop swaddling',
      },
      {
        type: 'bullets',
        items: [
          'Stop immediately when baby shows any sign of rolling — attempting to roll, rolling to their side, or pushing up during tummy time with more strength. The AAP advises transition as soon as these signs appear, which is typically 2 months but can be earlier.',
          'Most babies transition between 2–4 months. By 4 months, the Moro reflex has naturally diminished and swaddling is less necessary.',
          'Transition to a sleep sack (wearable blanket) with arms free. Many families use a transitional product like the Love to Dream Swaddle UP that allows one arm out, then both out.',
        ],
      },
      {
        type: 'h2',
        heading: 'Velcro and zip swaddles vs. blankets',
        body: 'Pre-made swaddles with velcro or zipper closures (Halo SleepSack Swaddle, Love to Dream, Ollie Swaddle) are significantly easier to use in the dark at 3am and come undone less easily. The tradeoff is cost — they run $25–$45 each. Most parents end up with a combination: blanket swaddles for the first weeks, a structured swaddle for nights.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🤍',
            name: 'aden + anais Classic Muslin Swaddle Blankets (4-pack)',
            note: 'Large enough (47x47") to actually stay wrapped; gets softer with every wash',
            url: 'https://www.amazon.com/s?k=aden+anais+muslin+swaddle+blankets+4+pack&tag=sprigloop-20',
          },
          {
            emoji: '🌙',
            name: 'Halo SleepSack Swaddle (Newborn)',
            note: 'Velcro wings keep the swaddle secure; hip-healthy certified by the IHDI',
            url: 'https://www.amazon.com/s?k=halo+sleepsack+swaddle+newborn&tag=sprigloop-20',
          },
          {
            emoji: '💛',
            name: 'Love to Dream Swaddle UP (Stage 1)',
            note: 'Arms-up position reduces startle reflex; great for transition when one wing comes off',
            url: 'https://www.amazon.com/s?k=love+to+dream+swaddle+up+stage+1&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Swaddling: Is It Safe?', url: 'https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Swaddling-Is-it-Safe.aspx' },
          { label: 'Pediatrics (2002) — Calming Effect of Swaddling', url: 'https://publications.aap.org/pediatrics/article-abstract/110/5/e68/62568' },
          { label: 'International Hip Dysplasia Institute — Hip-Healthy Swaddling', url: 'https://hipdysplasia.org/developmental-dysplasia-of-the-hip/hip-healthy-swaddling/' },
          { label: 'AAP — Safe Sleep Recommendations', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'Journal of Pediatrics — Swaddling and Hip Dysplasia', url: 'https://www.jpeds.com/article/S0022-3476(14)00601-0/fulltext' },
        ],
      },
    ],
  },

  // ── How-To Guide 2: Tummy Time ───────────────────────────────────────────
  {
    slug: 'how-to-do-tummy-time',
    title: 'How to Do Tummy Time (and Why It Matters)',
    subtitle: 'When to start, how long, what to do if your baby hates it, and the developmental research behind it.',
    description: 'Tummy time is the foundation of motor development in infancy. Here is when to start, how to build up to 30 minutes a day, and how to make it work for a baby who resists it.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '6 min',
    tags: ['How To', 'Newborn', 'Development'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP guidance, CDC developmental milestones research, and peer-reviewed pediatric occupational therapy literature. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Since the AAP launched the "Back to Sleep" campaign in 1994 — which reduced SIDS deaths by more than 50% — babies spend far more time on their backs than previous generations did. The tradeoff is that they now need intentional tummy time to build the neck, shoulder, and core strength that back-sleeping doesn\'t develop. The AAP now recommends tummy time starting from the first day home from the hospital.',
      },
      {
        type: 'h2',
        heading: 'Why tummy time matters',
      },
      {
        type: 'bullets',
        items: [
          'Strengthens neck and shoulder muscles needed to hold the head up, roll over, sit, crawl, and eventually walk.',
          'Prevents positional plagiocephaly (flat head syndrome), which has increased significantly since the Back to Sleep campaign. The AAP reports that 1 in 5 babies now have some degree of skull flattening — tummy time is the primary prevention.',
          'Develops proprioception (body awareness) and the sensory processing skills needed for later coordination.',
          'A 2020 study in Physical & Occupational Therapy in Pediatrics found that babies who received more tummy time reached motor milestones — rolling, sitting, crawling — significantly earlier than those who had less.',
        ],
      },
      {
        type: 'h2',
        heading: 'When to start',
        body: 'From day one at home, according to the AAP — as long as your baby\'s umbilical cord stump has not caused skin irritation. Even 2–3 minutes of tummy time per session in the first weeks is beneficial. Many parents wait until the cord falls off (1–3 weeks), which is also fine.',
      },
      {
        type: 'h2',
        heading: 'How much tummy time by age',
      },
      {
        type: 'table',
        cols: ['Age', 'Daily goal', 'Session length'],
        rows: [
          ['0–1 month', '5–10 minutes total', '2–3 minutes, several times a day'],
          ['1–2 months', '10–20 minutes total', '3–5 minutes per session'],
          ['2–3 months', '20–30 minutes total', '5–10 minutes per session'],
          ['3–4 months', '30+ minutes total', 'Baby should tolerate longer stretches'],
          ['4+ months', 'As much as possible', 'Baby is usually rolling and moving freely'],
        ],
      },
      {
        type: 'note',
        body: 'Tummy time only counts when baby is awake and supervised. Never leave a baby on their tummy unsupervised or for sleep. The safe sleep position is always on their back.',
      },
      {
        type: 'h2',
        heading: 'How to do it: positions and techniques',
      },
      {
        type: 'bullets',
        items: [
          'Classic floor tummy time: Place baby chest-down on a firm, flat surface. Get down at their eye level with a high-contrast toy or your face to give them something to look at and lift toward.',
          'Chest-to-chest: Recline in a chair at about 45 degrees and place baby tummy-down on your chest. This is the easiest starting position for very young babies and still counts as tummy time.',
          'Lap tummy time: Drape baby face-down across your lap with their head just past your knees. One hand on their back for support. Great for short sessions and easy diaper changes.',
          'Tummy time on a rolled towel or Boppy: Place a tightly rolled towel or a nursing pillow under baby\'s chest and upper arms. This elevates their upper body and makes it easier to lift their head.',
        ],
      },
      {
        type: 'h2',
        heading: 'What to do if your baby hates tummy time',
        body: 'Most newborns dislike tummy time at first. This is normal and not a reason to skip it — it means the muscles are weak and need the work. Strategies that help:',
      },
      {
        type: 'bullets',
        items: [
          'Start with chest-to-chest tummy time on a parent\'s chest rather than the floor. Most babies tolerate this more easily.',
          'Do it after a diaper change, not after feeding (tummy time on a full stomach causes spit-up).',
          'Keep sessions short and frequent. Two minutes five times a day is better than ten minutes once.',
          'Get on the floor at their eye level. A face to look at is more motivating than the carpet.',
          'Place a small mirror in front of them — babies are drawn to faces, including their own reflection.',
          'Tolerance typically improves rapidly. A baby who screams after 30 seconds at 2 weeks will usually manage 5 minutes comfortably by 6 weeks if you keep at it daily.',
        ],
      },
      {
        type: 'h2',
        heading: 'Milestones tummy time supports',
      },
      {
        type: 'table',
        cols: ['Milestone', 'Typical age', 'Tummy time role'],
        rows: [
          ['Lifts head briefly', '1 month', 'Direct result of neck strengthening'],
          ['Holds head at 45 degrees', '2 months', 'Sustained neck and shoulder strength'],
          ['Holds head at 90 degrees', '3–4 months', 'Full neck control, precursor to rolling'],
          ['Rolls front to back', '3–5 months', 'Core and shoulder strength required'],
          ['Rolls back to front', '4–6 months', 'Full body coordination'],
          ['Sits independently', '6–8 months', 'Core strength built through months of tummy time'],
          ['Crawling', '7–10 months', 'Arm, shoulder, and core strength from tummy time'],
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🌈',
            name: 'Infantino Twist and Fold Activity Gym and Play Mat',
            note: 'High-contrast patterns on the mat give babies visual targets to lift toward during tummy time',
            url: 'https://www.amazon.com/s?k=infantino+twist+fold+activity+gym+play+mat&tag=sprigloop-20',
          },
          {
            emoji: '🪞',
            name: 'Sassy Tummy Time Floor Mirror',
            note: 'Babies are motivated by faces — including their own. Keeps them engaged long enough to build tolerance.',
            url: 'https://www.amazon.com/s?k=sassy+tummy+time+floor+mirror&tag=sprigloop-20',
          },
          {
            emoji: '🤱',
            name: 'Boppy Original Nursing Pillow',
            note: 'Doubles as a tummy time prop — place under chest and arms to elevate baby and reduce strain',
            url: 'https://www.amazon.com/s?k=boppy+original+nursing+pillow&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Back to Sleep, Tummy to Play', url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/The-Importance-of-Tummy-Time.aspx' },
          { label: 'CDC — Important Milestones: Your Baby By Two Months', url: 'https://www.cdc.gov/ncbddd/actearly/milestones/milestones-2mo.html' },
          { label: 'Physical & Occupational Therapy in Pediatrics (2020) — Tummy time and motor development', url: 'https://www.tandfonline.com/doi/abs/10.1080/01942638.2019.1616589' },
          { label: 'AAP — Positional Skull Deformities and Tummy Time', url: 'https://publications.aap.org/pediatrics/article/135/1/e26/33685' },
          { label: 'CHOP — Tummy Time: Why It Matters', url: 'https://www.chop.edu/news/health-tip/tummy-time-why-it-matters' },
        ],
      },
    ],
  },

  // ── How-To Guide 3: Baby Carrier Safety ─────────────────────────────────
  {
    slug: 'how-to-use-a-baby-carrier-safely',
    title: 'How to Use a Baby Carrier Safely',
    subtitle: 'TICKS guidelines, hip positioning, carrier types by age, and the forward-facing question answered.',
    description: 'Babywearing keeps babies calmer and frees your hands — but position matters for airway safety and hip development. Here is the research and the right technique.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '7 min',
    tags: ['How To', 'Gear', 'Newborn'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from CPSC safety guidelines, International Hip Dysplasia Institute recommendations, and peer-reviewed babywearing research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Babywearing — carrying a baby in a carrier or sling — has been practiced across cultures for thousands of years, and the research supports it. Studies show that babies who are carried more cry less, have better physiological regulation, and show stronger attachment outcomes. But position matters: an incorrectly worn carrier can restrict airway or cause hip dysplasia. The TICKS guidelines, developed by the UK Sling Safety Campaign, give you everything you need to know in five checkpoints.',
      },
      {
        type: 'h2',
        heading: 'The TICKS safety checklist',
        body: 'Run through this every time you put your baby in a carrier, especially in the newborn period when babies have limited head control.',
      },
      {
        type: 'table',
        cols: ['Letter', 'What it means', 'How to check'],
        rows: [
          ['T — Tight', 'Carrier is snug, no sagging', 'Baby should not be able to slump; fabric should support them fully'],
          ['I — In view', 'Baby\'s face is always visible', 'You should see baby\'s face without moving fabric or leaning forward'],
          ['C — Close enough to kiss', 'Baby\'s head is close to your chin', 'Tilt your head down — you should be able to kiss the top of their head'],
          ['K — Keep chin off chest', 'Baby\'s chin is not compressed to chest', 'Two fingers should fit between chin and chest; chin-to-chest blocks airway'],
          ['S — Supported back', 'Baby\'s back is supported in natural curve', 'Back should be straight or in gentle C-curve; no slumping forward'],
        ],
      },
      {
        type: 'h2',
        heading: 'Hip positioning: the M position',
        body: 'The International Hip Dysplasia Institute recommends the "M position" (also called the frog position or seat-in position) for all baby carriers. In this position, baby\'s thighs are spread around the carrier with knees higher than the bottom, forming an M shape when viewed from the front.',
      },
      {
        type: 'bullets',
        items: [
          'The carrier seat should extend from knee to knee — not just supporting the bottom but the full thigh. A narrow carrier that only supports the bottom allows legs to dangle and puts strain on hip joints.',
          'Knees should be at or above bottom level. If knees are lower than the bottom, the carrier is not providing proper hip support.',
          'The IHDI has certified specific carriers as "hip-healthy" — structured carriers from Ergobaby, Tula, Lillebaby, and others with wide bases consistently appear on this list.',
          'Carriers that are not hip-healthy for newborns: bag-style slings, cradle carries, and narrow-based carriers designed as budget options.',
        ],
      },
      {
        type: 'h2',
        heading: 'Carrier types and when to use them',
      },
      {
        type: 'table',
        cols: ['Carrier type', 'Best for', 'Learning curve', 'Notes'],
        rows: [
          ['Structured SSC (soft structured carrier)', 'Newborn through toddler', 'Low', 'Most versatile; requires correct insert for newborns under ~11 lbs'],
          ['Ring sling', 'Newborn through toddler', 'Medium', 'Quick on/off; one-shoulder so not ideal for long carries'],
          ['Stretchy wrap', 'Newborn through 15–20 lbs', 'Medium-high', 'Very snug for newborns; too stretchy for heavier babies'],
          ['Woven wrap', 'All ages', 'High', 'Most supportive and adjustable; significant learning curve'],
          ['Meh dai (Asian-inspired carrier)', 'Newborn through toddler', 'Medium', 'Cross between wrap and SSC; adjustable without clips'],
        ],
      },
      {
        type: 'h2',
        heading: 'The forward-facing question',
        body: 'Forward-facing carrying (baby facing outward) is popular but has meaningful drawbacks supported by research. In a forward-facing carry, baby\'s back is against the carrier, legs dangle without hip support, and there is no support for the natural spinal curve. A 2013 study found elevated cortisol levels in forward-facing carried babies compared to in-facing carried babies in the same carriers.',
      },
      {
        type: 'bullets',
        items: [
          'Most major babywearing organizations and the IHDI advise limiting forward-facing carries and preferring inward-facing for young babies.',
          'If you do use a forward-facing position, use a carrier specifically designed for it (like the Ergobaby 360 or Lillebaby Complete) that maintains hip positioning, and limit the duration.',
          'A hip carry or back carry is a better option for an older baby who wants to see the world — both maintain proper positioning.',
        ],
      },
      {
        type: 'h2',
        heading: 'The research on babywearing',
      },
      {
        type: 'bullets',
        items: [
          'A 1986 randomized controlled trial in Pediatrics found that babies who were carried in soft carriers for at least 3 additional hours per day cried 43% less overall and 54% less during evening hours.',
          'Research on kangaroo mother care (skin-to-skin carrying in hospital) shows improved temperature regulation, heart rate stability, weight gain, and reduced mortality in premature infants.',
          'A 2012 study in Pediatrics found secure attachment — a predictor of emotional health and social development — was associated with more frequent physical contact including carrying.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🦘',
            name: 'Ergobaby Omni 360 All-Position Baby Carrier',
            note: 'Newborn-ready without insert, IHDI hip-healthy certified, 4 carry positions including back carry',
            url: 'https://www.amazon.com/s?k=ergobaby+omni+360+baby+carrier&tag=sprigloop-20',
          },
          {
            emoji: '💚',
            name: 'LILLEbaby Complete All Seasons Carrier',
            note: 'Six carry positions, lumbar support panel, IHDI certified — frequently recommended for plus-size parents',
            url: 'https://www.amazon.com/s?k=lillebaby+complete+all+seasons+carrier&tag=sprigloop-20',
          },
          {
            emoji: '🤍',
            name: 'Solly Baby Wrap (Stretchy Wrap)',
            note: 'Lightweight TENCEL fabric — cooler than cotton wraps; great for the newborn period',
            url: 'https://www.amazon.com/s?k=solly+baby+wrap+carrier&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'UK Sling Safety Campaign — TICKS Guidelines', url: 'https://babyslingsafety.co.uk/' },
          { label: 'International Hip Dysplasia Institute — Baby Carriers', url: 'https://hipdysplasia.org/developmental-dysplasia-of-the-hip/prevention/baby-carriers-seats-and-other-equipment/' },
          { label: 'Pediatrics (1986) — Effect of Carrying on Infant Crying', url: 'https://publications.aap.org/pediatrics/article-abstract/77/5/641/57138' },
          { label: 'Hunziker & Barr (1986) — Increased Carrying Reduces Infant Crying', url: 'https://pubmed.ncbi.nlm.nih.gov/3517799/' },
          { label: 'Pediatrics (2012) — Attachment and Physical Contact', url: 'https://publications.aap.org/pediatrics/article-abstract/130/5/e1065/30437' },
          { label: 'CPSC — Baby Sling Safety Guidelines', url: 'https://www.cpsc.gov/content/cpsc-urges-parents-to-use-caution-when-using-baby-slings' },
        ],
      },
    ],
  },

  // ── How-To Guide 4: Car Seat Installation ───────────────────────────────
  {
    slug: 'how-to-install-a-car-seat',
    title: 'How to Install a Car Seat Correctly',
    subtitle: 'LATCH vs. seat belt installation, rear-facing rules, the 1-inch test, and how to get it inspected for free.',
    description: 'NHTSA data shows that 59% of car seats are installed incorrectly. Here is the correct installation method, the rear-facing guidelines, and where to get your installation verified.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '7 min',
    tags: ['How To', 'Gear', 'Safety'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from NHTSA guidelines, AAP car seat recommendations, and Consumer Reports car seat safety research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Car crashes are the leading cause of injury death for children ages 1–13 in the United States. A correctly installed and used car seat reduces the risk of death in a crash by 71% for infants and 54% for toddlers compared to seat belts alone. NHTSA data shows that nearly 59% of car seats are used incorrectly in some way — mostly installation errors. This guide walks through the correct installation and the most common mistakes.',
      },
      {
        type: 'note',
        body: 'Every infant should ride rear-facing from birth. The AAP recommends keeping children rear-facing until they reach the maximum height or weight limit of their rear-facing car seat — not until age 2, as older guidance stated. Rear-facing is safer at every age because it distributes crash forces across the whole body rather than concentrating them on the neck and spine.',
      },
      {
        type: 'h2',
        heading: 'LATCH vs. seat belt installation',
        body: 'Most car seats can be installed two ways: using the LATCH system (Lower Anchors and Tethers for Children) built into your vehicle, or using the vehicle seat belt. Both methods, when done correctly, are equally safe according to NHTSA testing.',
      },
      {
        type: 'table',
        cols: ['Method', 'When to use', 'Weight limit'],
        rows: [
          ['LATCH (lower anchors)', 'When lower anchors are accessible and not hidden under upholstery', 'Lower anchor limit is on the vehicle door jamb sticker — often 65 lbs combined (seat + child)'],
          ['Seat belt', 'When LATCH weight limit is exceeded, or lower anchors are hard to access', 'No combined weight limit'],
          ['Top tether', 'Always use when forward-facing — attaches to anchor behind rear seat', 'Required for all forward-facing installations'],
        ],
      },
      {
        type: 'h2',
        heading: 'Rear-facing installation: step by step',
      },
      {
        type: 'bullets',
        items: [
          'Read your car seat manual and your vehicle owner\'s manual. Installation steps vary by seat and vehicle.',
          'Position the seat at the correct angle. Most infant seats have an angle indicator — a bubble level or line that confirms proper recline. Newborns need a more reclined angle (approximately 45 degrees) to keep the airway open. As babies grow and gain head control, the angle can be more upright.',
          'Thread LATCH connectors through the correct belt path (marked on the seat) and click into lower anchors in your vehicle. Pull the strap tight.',
          'Or thread the seat belt through the correct belt path and buckle it. Then lock the seat belt using your vehicle\'s locking mechanism — often pressing the belt all the way out and letting it retract, or using a locking clip if provided.',
          'Perform the 1-inch test: grab the seat at the belt path and try to move it side to side and front to back. If it moves more than 1 inch in any direction, it is not installed correctly. Tighten until it passes.',
          'Harness straps should come from at or below baby\'s shoulders when rear-facing. Pinch the strap at the shoulder — if you can pinch any slack, the harness is too loose.',
          'Chest clip should be positioned at armpit level, not on the stomach or neck.',
        ],
      },
      {
        type: 'h2',
        heading: 'The most common installation mistakes',
      },
      {
        type: 'table',
        cols: ['Mistake', 'Why it matters', 'How to fix'],
        rows: [
          ['Harness too loose', 'Allows baby to move forward in a crash', 'Pinch test at shoulder — no slack'],
          ['Chest clip in wrong position', 'Stomach position can cause abdominal injury; neck position can cause asphyxiation', 'Clip should sit at armpit level'],
          ['Seat moves more than 1 inch', 'Seat shifts in crash instead of staying in position', 'Tighten LATCH or lock seat belt'],
          ['Wrong recline angle', 'Too upright compresses airway in newborns; too flat can cause forward pitch', 'Use built-in angle indicator'],
          ['Aftermarket accessories', 'Pads, mirrors, and strap covers not tested with the seat can affect crash performance', 'Use only accessories included with the seat'],
          ['Exceeding weight/height limits', 'Seat design is only tested within its limits', 'Transition to next seat type when limits are reached'],
        ],
      },
      {
        type: 'h2',
        heading: 'Get your installation inspected — for free',
        body: 'NHTSA operates a national network of certified Child Passenger Safety Technicians (CPSTs) who will inspect your installation for free, no appointment needed at most locations. This is one of the most valuable free resources available to new parents.',
      },
      {
        type: 'bullets',
        items: [
          'Find a free inspection station at nhtsa.gov/child-safety/car-seats or call 1-888-327-4236.',
          'Fire stations, police stations, hospitals, and dedicated inspection events are common locations.',
          'Bring the car seat manual, your vehicle, and the seat installed as you normally use it — technicians will show you exactly what to correct.',
          'Schedule before your due date. Inspection events book up, and you cannot leave the hospital without a properly installed infant seat.',
        ],
      },
      {
        type: 'h2',
        heading: 'When to transition car seats',
      },
      {
        type: 'bullets',
        items: [
          'Infant seat to convertible: when baby reaches the rear-facing weight or height limit of the infant seat (typically 30–35 lbs or when head is within 1 inch of the top). Keep rear-facing in the convertible seat.',
          'Rear-facing to forward-facing: only when baby has outgrown the rear-facing weight or height limit of the convertible seat — not at a specific age.',
          'Forward-facing to booster: when child outgrows the forward-facing weight or height limit (typically 65 lbs or when ears reach the top of the seat).',
          'Booster to seat belt only: when seat belt fits correctly without a booster — lap belt across upper thighs, shoulder belt across chest and shoulder. This is typically around 4\'9" tall, usually between ages 8–12.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🚗',
            name: 'Chicco KeyFit 35 Infant Car Seat',
            note: 'Consistently top-rated by Consumer Reports; SuperCinch LATCH system and level indicator make installation straightforward',
            url: 'https://www.amazon.com/s?k=chicco+keyfit+35+infant+car+seat&tag=sprigloop-20',
          },
          {
            emoji: '🔄',
            name: 'Graco Extend2Fit Convertible Car Seat',
            note: 'Extended rear-facing to 50 lbs; 4-position extension panel adds 5 inches of legroom so babies can stay rear-facing longer',
            url: 'https://www.amazon.com/s?k=graco+extend2fit+convertible+car+seat&tag=sprigloop-20',
          },
          {
            emoji: '🔧',
            name: 'Locking Clip for Car Seat Belt Installation',
            note: 'Required for vehicles with non-locking seat belts; check your vehicle manual to see if needed',
            url: 'https://www.amazon.com/s?k=car+seat+locking+clip+installation&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'NHTSA — Car Seats and Booster Seats', url: 'https://www.nhtsa.gov/equipment/car-seats-and-booster-seats' },
          { label: 'AAP — Car Seats: Information for Families', url: 'https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Car-Safety-Seats-Information-for-Families.aspx' },
          { label: 'NHTSA — Child Restraint Use Survey (59% misuse statistic)', url: 'https://www.nhtsa.gov/sites/nhtsa.gov/files/documents/cr-misuse-study-report.pdf' },
          { label: 'NHTSA — Find a Car Seat Inspection Station', url: 'https://www.nhtsa.gov/child-safety/car-seats' },
          { label: 'Consumer Reports — Best Infant Car Seats', url: 'https://www.consumerreports.org/babies-kids/car-seats/best-infant-car-seats-of-the-year-a7088444370/' },
          { label: 'AAP — Rear-Facing Car Seats for Infants and Toddlers', url: 'https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Rear-Facing-Car-Seats-for-Infants-Toddlers.aspx' },
        ],
      },
    ],
  },

  // ── How-To Guide 5: Introducing a Bottle ────────────────────────────────
  {
    slug: 'how-to-introduce-a-bottle',
    title: 'How to Introduce a Bottle to a Breastfed Baby',
    subtitle: 'When to start, paced feeding technique, how to handle bottle refusal, and what the research says about nipple confusion.',
    description: 'Most breastfeeding parents will eventually need their baby to take a bottle. Here is the timing, the technique, and what to do when a baby refuses.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '6 min',
    tags: ['How To', 'Feeding'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP breastfeeding guidelines, lactation consultant literature, and peer-reviewed infant feeding research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Most breastfeeding families reach a point where they need their baby to take a bottle — returning to work, a medical procedure, needing a break, or building a freezer supply. The transition is easy for some babies and genuinely difficult for others. Timing, technique, and the right equipment matter more than most parents realize, and starting with the right approach avoids weeks of frustration.',
      },
      {
        type: 'h2',
        heading: 'When to introduce a bottle',
        body: 'Lactation consultants and the AAP generally recommend waiting until breastfeeding is well-established — typically 3–4 weeks — before introducing a bottle. Introducing too early can interfere with establishing milk supply, which depends on consistent demand. Waiting too long (past 6–8 weeks) increases the likelihood of bottle refusal as babies become more opinionated about feeding method.',
      },
      {
        type: 'note',
        body: 'If you need to bottle-feed before 3 weeks for medical or practical reasons, use paced bottle feeding (described below) to minimize any effect on breastfeeding. The evidence on "nipple confusion" is mixed — some babies transition easily at any age, others show preference early. The 3–4 week window is a guideline, not a hard rule.',
      },
      {
        type: 'h2',
        heading: 'Paced bottle feeding: the technique that protects breastfeeding',
        body: 'Standard bottle feeding allows milk to flow freely with gravity, which can cause a baby to take in more milk than they need and faster than they would at the breast. Paced bottle feeding mimics the breast more closely and prevents overfeeding.',
      },
      {
        type: 'bullets',
        items: [
          'Hold baby in a more upright position (30–45 degrees), not lying flat. This slows the flow and requires active sucking.',
          'Use a slow-flow (Level 1) nipple, even as baby grows. Slow flow requires the same effort as breastfeeding. Fast-flow nipples deliver milk with minimal work — babies quickly learn to prefer the easier option.',
          'Hold the bottle horizontal (parallel to the floor), not tilted up. Baby has to work to get the milk flowing, just as they do at the breast.',
          'Allow baby to draw the nipple into their mouth rather than pushing the bottle in. Touch the nipple to their lips and wait.',
          'Pause every few minutes by tilting the bottle down so the nipple empties. This mimics the natural pauses at the breast and prevents the overfeeding that comes from constant flow.',
          'Watch for satiety cues — turning away, slowing sucks, releasing the nipple — and stop when they appear, even if there is milk left in the bottle.',
        ],
      },
      {
        type: 'h2',
        heading: 'Which bottle to use',
        body: 'There is no single bottle that works for every baby. The shape, nipple design, and flow rate all affect whether a breastfed baby will accept it. Commonly recommended options:',
      },
      {
        type: 'bullets',
        items: [
          'Comotomo: wide, soft silicone base that baby can hold like a breast; wide nipple requires a similar latch to breastfeeding.',
          'Dr. Brown\'s Natural Flow: vented design prevents air ingestion, reducing gas and colic symptoms; Level 1 nipple is genuinely slow.',
          'Nanobebe: breast-shaped design that maintains milk temperature more evenly during feeding.',
          'Phillips Avent Natural: wide base, soft nipple; many parents report good acceptance.',
          'Try one bottle at a time rather than buying a set of each — acceptance is highly individual.',
        ],
      },
      {
        type: 'h2',
        heading: 'How to handle bottle refusal',
        body: 'Bottle refusal is common, especially when introduced after 6–8 weeks. It is frustrating but manageable with consistent approach.',
      },
      {
        type: 'bullets',
        items: [
          'Have someone other than the breastfeeding parent offer the bottle. Babies can smell their parent and know the breast is available — they\'ll hold out.',
          'Try when baby is not very hungry (30–45 minutes after a feeding) so they are willing to experiment rather than frustrated and demanding.',
          'Warm the nipple in warm water before offering — room temperature silicone feels different from a breast.',
          'Try different bottle positions: some babies accept a bottle while facing outward toward a window; others accept it while being walked.',
          'Be patient. Most bottle-refusing babies accept a bottle within a few days to a week of consistent daily attempts. Offering the bottle once, having it refused, and not trying again the next day is the most common way families get stuck.',
          'If refusal persists past 2 weeks of daily attempts, consult a lactation consultant who specializes in feeding aversion.',
        ],
      },
      {
        type: 'h2',
        heading: 'How much breast milk to put in the bottle',
        body: 'Breastfed babies regulate their intake differently than formula-fed babies. Research by Dr. Kent et al. (2006) found that breastfed babies take an average of 3–4 oz per feeding after the first month, and this amount stays relatively stable from 1–6 months — unlike formula-fed babies whose volumes increase. This means you don\'t need to keep increasing bottle size as baby grows.',
      },
      {
        type: 'note',
        body: 'Start with 2–3 oz per bottle session when practicing. Offering less prevents waste and pressure to finish. You can always prepare more.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🍼',
            name: 'Comotomo Natural Feel Baby Bottle (2-pack)',
            note: 'Wide silicone base mimics breast shape; best-reviewed bottle for breastfed baby acceptance',
            url: 'https://www.amazon.com/s?k=comotomo+natural+feel+baby+bottle+2+pack&tag=sprigloop-20',
          },
          {
            emoji: '🍼',
            name: "Dr. Brown's Natural Flow Anti-Colic Bottle Newborn Set",
            note: 'Vented design reduces gas; Level 1 nipple is genuinely slow-flow; includes bottle brush',
            url: "https://www.amazon.com/s?k=dr+browns+natural+flow+anti-colic+bottle+newborn+set&tag=sprigloop-20",
          },
          {
            emoji: '❄️',
            name: 'Lansinoh Breastmilk Storage Bags (100-count)',
            note: 'Pre-sterilized, double-sealed; lay flat to freeze so bags stack efficiently',
            url: 'https://www.amazon.com/s?k=lansinoh+breastmilk+storage+bags+100+count&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Breastfeeding and the Use of Human Milk', url: 'https://publications.aap.org/pediatrics/article/129/3/e827/31785' },
          { label: 'Kent et al. (2006) — Volume and Frequency of Breastfeedings', url: 'https://pubmed.ncbi.nlm.nih.gov/16831893/' },
          { label: 'La Leche League — Returning to Work and Bottle Introduction', url: 'https://llli.org/breastfeeding-info/pumping-and-bottle-feeding/' },
          { label: 'Journal of Human Lactation — Paced Bottle Feeding', url: 'https://journals.sagepub.com/doi/10.1177/0890334417695451' },
          { label: 'UNICEF UK — Introducing Bottles', url: 'https://www.unicef.org.uk/babyfriendly/introducing-bottles/' },
        ],
      },
    ],
  },

  // ── How-To Guide 6: Breast Pump ─────────────────────────────────────────
  {
    slug: 'how-to-use-a-breast-pump',
    title: 'How to Use a Breast Pump',
    subtitle: 'Flange sizing, settings, when to pump, how to build supply, and milk storage guidelines.',
    description: 'The most underknown fact about breast pumping is that flange size determines everything. Here is the correct fit, the right technique, and the storage rules that keep expressed milk safe.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '8 min',
    tags: ['How To', 'Feeding'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from CDC breast milk storage guidelines, Academy of Breastfeeding Medicine protocols, and peer-reviewed lactation research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Most parents who struggle with pumping are dealing with a problem that has a simple root cause: the wrong flange size. A flange (the funnel-shaped piece that goes against the breast) that fits incorrectly causes pain, reduces output, and can contribute to clogged ducts. Getting the fit right is the single highest-leverage change most parents can make to their pumping experience.',
      },
      {
        type: 'h2',
        heading: 'Flange sizing: the most important thing nobody told you',
        body: 'The flange should fit the nipple, not the breast. The inside diameter of the flange tunnel should be large enough that your nipple moves freely without friction, but not so large that significant areola tissue is pulled in.',
      },
      {
        type: 'bullets',
        items: [
          'Your nipple should move freely inside the tunnel with minimal friction. If you see friction marks, redness, or feel pain, the flange is too small.',
          'Significant areola tissue should not be pulled into the tunnel — just the nipple and a small amount of base tissue. If most of your areola disappears into the tunnel, the flange is too large.',
          'Most pumps ship with 24mm and 27mm flanges. Many lactation consultants report that these sizes fit only a minority of parents — 13mm, 15mm, 17mm, 19mm, and 21mm are all commonly needed.',
          'Measure your nipple diameter in millimeters (a ruler or nipple ruler works), then add 2–3mm for the correct flange size. Example: 18mm nipple diameter → 20–21mm flange.',
          'Nipples can change size during the breastfeeding journey — recheck your fit if pumping comfort or output changes.',
        ],
      },
      {
        type: 'h2',
        heading: 'Understanding pump settings',
        body: 'Most hospital-grade and consumer double electric pumps have two settings: suction strength (vacuum) and cycle speed (how many sucks per minute). They also have two modes: stimulation (letdown) and expression.',
      },
      {
        type: 'table',
        cols: ['Mode', 'Cycle speed', 'Suction', 'Purpose'],
        rows: [
          ['Stimulation / letdown', 'Fast (80–120 cycles/min)', 'Low', 'Triggers the letdown reflex; use for first 2 minutes of session'],
          ['Expression', 'Slow (40–60 cycles/min)', 'Higher', 'Extracts milk after letdown; use for remainder of session'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Start every session in stimulation mode for 1–2 minutes until letdown occurs (you\'ll feel tingling or see milk flowing).',
          'Switch to expression mode and increase suction to the highest comfortable level — not the highest possible level. Pain reduces letdown and output.',
          'Sessions should last 15–20 minutes when building supply, or 10–15 minutes once supply is established and you are pumping to maintain it.',
        ],
      },
      {
        type: 'h2',
        heading: 'When to pump and how often',
      },
      {
        type: 'table',
        cols: ['Situation', 'When to pump', 'Frequency'],
        rows: [
          ['Exclusively breastfeeding, returning to work', 'Start 2–4 weeks before return; pump after one morning feeding daily to build freezer stash', '1x/day to build stash'],
          ['Exclusively pumping', 'Every 2–3 hours, including once overnight, for first 3 months', '8–12x/day initially'],
          ['Supplementing breastfeeding', 'After or instead of feedings baby does not latch for', 'Match feeding frequency'],
          ['Back at work, baby at home', 'Pump at work whenever baby would normally feed — approximately every 3 hours', '2–4x during work hours'],
          ['Increasing low supply', 'Power pumping: 20 min on, 10 min off, 10 min on, 10 min off, 10 min on — once daily for a week', '1x/day power pump + regular feeds'],
        ],
      },
      {
        type: 'h2',
        heading: 'Breast milk storage guidelines (CDC)',
        body: 'The CDC publishes specific guidelines for safe breast milk storage. These are the current recommendations as of 2022.',
      },
      {
        type: 'table',
        cols: ['Location', 'Temperature', 'Maximum storage time'],
        rows: [
          ['Room temperature', 'Up to 77°F (25°C)', '4 hours (ideal); up to 6 hours if very clean conditions'],
          ['Refrigerator', '40°F (4°C) or colder', '4 days (ideal); up to 6 days in clean conditions'],
          ['Freezer (self-contained)', '0°F (-18°C)', '6 months (ideal); up to 12 months acceptable'],
          ['Deep freezer', '-4°F (-20°C)', '12 months'],
          ['Previously frozen, thawed in fridge', 'Refrigerator temp', '24 hours; do not refreeze'],
        ],
      },
      {
        type: 'bullets',
        items: [
          'Store milk in 2–4 oz portions to minimize waste from thawing. You can always thaw more.',
          'Label every bag with the date expressed. Use oldest milk first (FIFO — first in, first out).',
          'Freeze bags flat to save space. Once frozen, they stack like files.',
          'Thaw frozen milk in the refrigerator overnight or by holding the bag under warm running water. Never use a microwave — it creates hot spots and destroys antibodies.',
          'Freshly expressed milk can be added to already-refrigerated milk, but cool it first — do not add warm milk to cold.',
        ],
      },
      {
        type: 'h2',
        heading: 'Pumping parts cleaning',
        body: 'The CDC and AAP provide specific guidance on cleaning pump parts that many parents do not know about.',
      },
      {
        type: 'bullets',
        items: [
          'Wash pump parts that come into contact with breast milk (flanges, bottles, valves, membranes) after every use in hot soapy water or the dishwasher top rack.',
          'Rinse well — soap residue can affect milk flavor.',
          'Air dry on a clean paper towel or drying rack — not a dish towel, which can transfer bacteria.',
          'Sanitize (sterilize) once daily for babies under 3 months, premature babies, or immunocompromised babies. Sanitizing is optional for healthy term babies over 3 months.',
          'Tubing that connects to the motor should not need cleaning unless milk enters it. If it does, replace tubing — it cannot be sterilized effectively.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🫙',
            name: 'Spectra S2 Plus Hospital-Grade Breast Pump',
            note: 'Most recommended pump by lactation consultants; closed system prevents milk contamination; quiet motor',
            url: 'https://www.amazon.com/s?k=spectra+s2+plus+breast+pump&tag=sprigloop-20',
          },
          {
            emoji: '📏',
            name: 'Maymom Nipple Ruler for Flange Sizing',
            note: 'Measures nipple diameter accurately so you can order the correct flange size',
            url: 'https://www.amazon.com/s?k=nipple+ruler+flange+sizing+breast+pump&tag=sprigloop-20',
          },
          {
            emoji: '❄️',
            name: 'Lansinoh Breastmilk Storage Bags (100-count)',
            note: 'Pre-sterilized, double-sealed, lay flat to freeze — the most-used storage bag brand',
            url: 'https://www.amazon.com/s?k=lansinoh+breastmilk+storage+bags+100+count&tag=sprigloop-20',
          },
          {
            emoji: '🧴',
            name: 'Medela Quick Clean Breast Pump Wipes',
            note: 'Useful for cleaning pump parts at work when a sink is not nearby',
            url: 'https://www.amazon.com/s?k=medela+quick+clean+breast+pump+wipes&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'CDC — Breast Milk Storage and Preparation', url: 'https://www.cdc.gov/breastfeeding/recommendations/handling_breastmilk.htm' },
          { label: 'Academy of Breastfeeding Medicine — Clinical Protocol #8: Pumping', url: 'https://www.bfmed.org/abm-protocol-8' },
          { label: 'CDC — How to Keep Your Breast Pump Kit Clean', url: 'https://www.cdc.gov/breastfeeding/recommendations/pump_toolkit/breast-pump-toolkit.html' },
          { label: 'La Leche League International — Expressing and Storing Breast Milk', url: 'https://llli.org/breastfeeding-info/pumping-and-bottle-feeding/' },
          { label: 'Powe et al. (2011) — Optimal Vacuum for Breast Pumping', url: 'https://pubmed.ncbi.nlm.nih.gov/21746745/' },
        ],
      },
    ],
  },

  // ── How-To Guide 7: Sleep Cues and Wake Windows ─────────────────────────
  {
    slug: 'baby-sleep-cues-and-wake-windows',
    title: "How to Read Your Baby's Sleep Cues and Wake Windows",
    subtitle: 'Early vs. late cues, wake windows by age, why overtiredness makes sleep harder, and what the research says.',
    description: "Reading a baby's sleep cues before they get overtired is one of the most effective ways to improve infant sleep. Here is what to watch for and the wake window science behind it.",
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '7 min',
    tags: ['How To', 'Sleep', 'Newborn'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from peer-reviewed infant sleep research, AAP sleep guidelines, and pediatric sleep medicine literature. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'One of the most counterintuitive things about infant sleep is that an overtired baby is harder to get to sleep — not easier. When babies miss their sleep window, cortisol and adrenaline release as the body fights fatigue. The result is a wired, fussy baby who cries more, takes longer to settle, and sleeps less deeply. Reading early sleep cues and understanding how long your baby can comfortably stay awake is the foundation of everything else in infant sleep.',
      },
      {
        type: 'h2',
        heading: 'Early sleep cues (act on these)',
        body: 'These appear when your baby is getting tired but before the overtired window. This is the time to start a wind-down routine.',
      },
      {
        type: 'bullets',
        items: [
          'Decreased activity — baby slows down, movements become less vigorous',
          'Quieting — less vocalizing, calmer demeanor',
          'Looking away or losing interest in toys or faces',
          'Staring blankly or glazed look',
          'Yawning (one of the most reliable early cues)',
          'Rubbing eyes or ears',
          'Facial grimacing or eyebrow raising',
        ],
      },
      {
        type: 'h2',
        heading: 'Late sleep cues (you have missed the window)',
        body: 'These appear when baby has already entered the overtired state. Getting them to sleep now is possible but harder.',
      },
      {
        type: 'bullets',
        items: [
          'Fussiness that escalates to crying',
          'Arching the back',
          'Clenching fists',
          'Hyper-alert or "second wind" behavior — suddenly looks bright-eyed and active after clear tiredness signs',
          'Inconsolable crying that cannot be soothed by normal means',
        ],
      },
      {
        type: 'note',
        body: 'The goal is to catch early cues and begin the sleep routine before late cues appear. Over time, you will learn your specific baby\'s particular early signals — they vary. Some babies rub ears; others stare. The pattern is consistent once you know it.',
      },
      {
        type: 'h2',
        heading: 'Wake windows: the research behind them',
        body: 'A "wake window" is the amount of time a baby can comfortably stay awake between sleep periods before becoming overtired. The concept is grounded in research on infant sleep pressure (homeostatic sleep drive) and circadian rhythm development. Newborns have very short windows because their sleep pressure builds quickly and their circadian system is not yet developed. As babies age, their wake windows lengthen as the circadian system matures and naps consolidate.',
      },
      {
        type: 'table',
        cols: ['Age', 'Wake window', 'Naps per day', 'Notes'],
        rows: [
          ['0–4 weeks', '45–60 minutes', '4–6', 'Very short windows; newborns may only be awake for feeding + diaper change before next sleep'],
          ['1–2 months', '60–90 minutes', '4–5', 'Wake windows starting to lengthen; watch carefully for early cues'],
          ['2–3 months', '60–90 minutes', '4–5', 'Windows vary; some babies show first longer stretches of nighttime sleep'],
          ['3–4 months', '90 minutes–2 hours', '3–4', 'Sleep regression common around 4 months as circadian rhythm develops'],
          ['4–6 months', '1.5–2.5 hours', '3', 'Nap consolidation begins; 3-nap schedule emerging'],
          ['6–8 months', '2–3 hours', '2–3', 'Transition from 3 to 2 naps often occurs here'],
          ['8–12 months', '2.5–3.5 hours', '2', 'Most babies on 2-nap schedule; wake window before bed slightly longer'],
          ['12–18 months', '4–6 hours', '1–2', 'Transition to 1 nap often occurs between 14–18 months'],
        ],
      },
      {
        type: 'h2',
        heading: 'The 4-month sleep regression',
        body: 'Around 3.5–4 months, almost all babies go through a significant sleep change. This is not a regression — it is a developmental progression. Baby\'s sleep architecture permanently changes from two sleep stages (active and quiet) to four stages mirroring adult sleep cycles. The transition between sleep cycles (every 45 minutes) becomes more noticeable and many babies begin waking between cycles who previously slept through them. Understanding that this is permanent and developmental — not a phase that passes back to the newborn pattern — helps parents respond appropriately.',
      },
      {
        type: 'h2',
        heading: 'Wind-down routines and sleep associations',
        body: 'Research on infant sleep consistently shows that predictable pre-sleep routines improve sleep onset and duration. A 2009 study in the journal Sleep found that a consistent bedtime routine reduced night wakings and improved sleep duration in infants and toddlers. The routine does not need to be long — 10–15 minutes is sufficient.',
      },
      {
        type: 'bullets',
        items: [
          'Keep the routine consistent: same steps, same order, same environment cues (dim lights, white noise on, sleep sack on).',
          'Feed should come at the beginning of the routine, not at the very end if possible — this avoids a feed-to-sleep association that makes it harder for babies to resettle overnight without feeding.',
          'Common effective routines: feed → diaper change → dim lights → book or song → sleep sack → into sleep space.',
          'White noise at 65–70 dB (the level of a running shower) masks household sounds and extends sleep. A 1990 study found that 80% of newborns fell asleep within 5 minutes of white noise being introduced versus 25% in the control group.',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🔊',
            name: 'LectroFan Classic White Noise Machine',
            note: 'Non-looping fan and white noise options; consistently recommended by pediatric sleep consultants',
            url: 'https://www.amazon.com/s?k=lectrofan+classic+white+noise+machine&tag=sprigloop-20',
          },
          {
            emoji: '🌙',
            name: 'Hatch Rest Baby Sound Machine and Night Light',
            note: 'Combines white noise, nightlight, and time-to-rise clock; app controlled so you can dim or adjust without entering the room',
            url: 'https://www.amazon.com/s?k=hatch+rest+baby+sound+machine+night+light&tag=sprigloop-20',
          },
          {
            emoji: '🛌',
            name: 'Yoofoss Organic Cotton Sleep Sack (0.5 TOG)',
            note: 'Sleep sack as a sleep-onset cue — the same one every time signals sleep is coming',
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'Sleep (2009) — Effect of Bedtime Routine on Infant Sleep', url: 'https://academic.oup.com/sleep/article/32/5/599/2454' },
          { label: 'Archives of Disease in Childhood (1990) — White Noise and Newborn Sleep', url: 'https://adc.bmj.com/content/65/8/888' },
          { label: 'AAP — Healthy Sleep Habits: How Many Hours Does Your Child Need?', url: 'https://www.healthychildren.org/English/healthy-living/sleep/Pages/healthy-sleep-habits-how-many-hours-does-your-child-need.aspx' },
          { label: 'Mindell et al. (2015) — Bedtime Routines for Young Children', url: 'https://pubmed.ncbi.nlm.nih.gov/25835243/' },
          { label: 'Sadeh et al. (2009) — Sleep and the Family', url: 'https://pubmed.ncbi.nlm.nih.gov/19445782/' },
          { label: 'Johnson et al. (2018) — Infant Sleep and Cortisol', url: 'https://pubmed.ncbi.nlm.nih.gov/29609119/' },
        ],
      },
    ],
  },

  // ── How-To Guide 8: Diaper Care Products ────────────────────────────────
  {
    slug: 'how-to-use-diaper-care-products',
    title: 'How and When to Use Diaper Care Products',
    subtitle: 'Diaper rash cream, wipes, baby powder, and barrier treatments — what the research says about each.',
    description: 'Most parents have several products in the diaper bag they are not completely sure how to use. Here is the evidence on what works, what to avoid, and when each product is actually needed.',
    date: 'June 2026',
    lastmod: '2026-06-15',
    readTime: '6 min',
    tags: ['How To', 'Diapering', 'Newborn'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP guidance, American Academy of Dermatology recommendations, and peer-reviewed pediatric dermatology research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: 'Diaper rash affects up to 35% of infants at any given time, making it one of the most common conditions in the first two years of life. Most cases are preventable and treatable with the right products used correctly. The challenge is that the diaper care aisle has grown into a confusing array of creams, powders, sprays, and wipes — many marketed aggressively but backed by minimal evidence. This guide gives you what the research actually supports.',
      },
      {
        type: 'h2',
        heading: 'Understanding diaper rash',
        body: 'Most diaper rash (irritant contact dermatitis) is caused by prolonged skin contact with urine and stool, which breaks down the skin\'s natural barrier. Moisture softens the skin; friction damages it; the enzymes and bacteria in stool cause further irritation. Secondary yeast infection (Candida) is common — recognizable by its bright red color with satellite spots extending beyond the main rash area — and requires antifungal treatment rather than standard barrier cream.',
      },
      {
        type: 'h2',
        heading: 'Diaper rash cream: what to use and when',
        body: 'The AAP and American Academy of Dermatology both recommend zinc oxide as the first-line treatment and prevention for diaper rash. Zinc oxide creates a physical barrier between skin and moisture, promotes healing, and has antimicrobial properties.',
      },
      {
        type: 'bullets',
        items: [
          'Apply a thick layer at every diaper change when rash is present — you should not be able to see skin through it. Thin application provides little barrier effect.',
          'For prevention, apply a thin layer at each change if your baby is prone to rash, particularly during illness (loose stools dramatically increase rash risk) or antibiotic use.',
          'Do not wipe zinc oxide cream off completely at every change — if the area is not soiled, simply add a fresh layer on top. Aggressive wiping to remove cream damages already-irritated skin.',
          'Aquaphor Baby Healing Ointment (petrolatum-based) is an effective alternative for mild rash prevention — creates a barrier without zinc oxide.',
          'For a rash that is not improving after 3–4 days of zinc oxide treatment, or that has satellite spots, consult your pediatrician — a yeast infection requires an antifungal treatment (clotrimazole or miconazole).',
        ],
      },
      {
        type: 'table',
        cols: ['Product type', 'Active ingredient', 'Best for', 'When to use'],
        rows: [
          ['Zinc oxide cream (thick)', 'Zinc oxide 10–40%', 'Active rash treatment', 'Every change until rash resolves; thick layer'],
          ['Petrolatum barrier (Aquaphor)', 'Petrolatum', 'Prevention and mild rash', 'Every change for sensitive skin; good for newborns'],
          ['Antifungal cream', 'Clotrimazole or miconazole', 'Yeast-caused rash', 'With pediatrician guidance; 3x/day'],
          ['Corn starch powder', 'Corn starch', 'Reducing friction and moisture in skin folds', 'Use sparingly; keep away from face'],
        ],
      },
      {
        type: 'h2',
        heading: 'Baby powder: what the research says',
        body: 'The AAP advises against using talcum powder (talc-based baby powder) on infants. Talc can be inhaled — baby powder clouds release fine particles that can cause respiratory distress and, with repeated exposure, lung damage. The International Agency for Research on Cancer classifies talc used in the genital area as possibly carcinogenic. Johnson & Johnson settled billions of dollars in litigation related to talc-based products and has discontinued talc-based baby powder in most markets.',
      },
      {
        type: 'note',
        body: 'If you want to use a powder to reduce friction and moisture in skin folds (a legitimate use), corn starch is safer than talc. Apply by shaking a small amount into your hand first, never directly onto baby, and keep away from baby\'s face and airway.',
      },
      {
        type: 'h2',
        heading: 'Wipes: what to look for and avoid',
        body: 'Baby wipes vary significantly in formulation. The most common irritants in wipes are fragrance, alcohol, and preservatives (particularly methylisothiazolinone and bronopol, which are common sensitizers in diaper wipes according to the Contact Dermatitis journal).',
      },
      {
        type: 'bullets',
        items: [
          'Choose fragrance-free wipes. Fragrance is the single most common contact allergen in baby skincare products according to the American Academy of Dermatology.',
          'Avoid alcohol-containing wipes — alcohol dries and irritates skin, especially during active rash.',
          'Water wipes (99%+ water with minimal other ingredients) are the gentlest option and recommended by most pediatric dermatologists for newborns and babies with sensitive skin or active rash.',
          'For newborns in the first weeks, plain warm water on a soft cloth is the most gentle option and what the AAP recommends.',
          'Pre-moistened wipes are more convenient than cloth + water for most parents, and research does not show a meaningful difference in rash rates between them when fragrance-free wipes are used.',
        ],
      },
      {
        type: 'h2',
        heading: 'How to change a diaper to minimize rash risk',
      },
      {
        type: 'bullets',
        items: [
          'Change diapers frequently — every 2–3 hours for newborns, and immediately after any stool. Prolonged contact with stool is the primary cause of rash.',
          'Pat dry rather than rubbing — friction on wet skin contributes to irritation.',
          'Allow skin to air dry for 1–2 minutes before applying cream and closing the diaper. Even brief air exposure helps.',
          'If using cloth diapers, extra-absorbent inserts and washing with fragrance-free detergent reduce rash risk significantly.',
          'Blow-drying on the lowest setting from 6+ inches away is a faster alternative to air drying for active rash — used by many pediatric dermatologists.',
        ],
      },
      {
        type: 'h2',
        heading: 'When to see a doctor',
      },
      {
        type: 'bullets',
        items: [
          'Rash is not improving after 4–7 days of zinc oxide treatment.',
          'Bright red rash with satellite spots beyond the main area (yeast infection).',
          'Rash has blisters, open sores, or pustules.',
          'Baby has a fever alongside the rash.',
          'Rash extends into skin folds (intertrigo — common and sometimes harder to treat).',
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🧴',
            name: 'Desitin Maximum Strength Diaper Rash Cream (40% Zinc Oxide)',
            note: '40% zinc oxide — highest concentration available over the counter; the standard recommendation for active rash',
            url: 'https://www.amazon.com/s?k=desitin+maximum+strength+diaper+rash+cream+40+percent+zinc+oxide&tag=sprigloop-20',
          },
          {
            emoji: '💛',
            name: 'Aquaphor Baby Healing Ointment (14 oz)',
            note: 'Petrolatum barrier; excellent for prevention and sensitive newborn skin; fragrance-free',
            url: 'https://www.amazon.com/s?k=aquaphor+baby+healing+ointment+14+oz&tag=sprigloop-20',
          },
          {
            emoji: '🌊',
            name: 'WaterWipes Baby Wipes (540 count)',
            note: '99.9% water; recommended by pediatric dermatologists for newborns and babies with sensitive skin or active rash',
            url: 'https://www.amazon.com/s?k=waterwipes+baby+wipes+540+count&tag=sprigloop-20',
          },
          {
            emoji: '🍃',
            name: 'Pampers Sensitive Fragrance-Free Baby Wipes',
            note: 'Fragrance-free, alcohol-free; good everyday wipe for babies without active rash',
            url: 'https://www.amazon.com/s?k=pampers+sensitive+fragrance+free+baby+wipes&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Diaper Rash', url: 'https://www.healthychildren.org/English/ages-stages/baby/diapers-clothing/Pages/Diaper-Rash.aspx' },
          { label: 'American Academy of Dermatology — Diaper Rash: Diagnosis and Treatment', url: 'https://www.aad.org/public/diseases/a-z/diaper-rash-treatment' },
          { label: 'Pediatric Dermatology (2018) — Treatment of Diaper Dermatitis', url: 'https://onlinelibrary.wiley.com/doi/10.1111/pde.13504' },
          { label: 'Contact Dermatitis — Preservatives as Contact Allergens in Baby Wipes', url: 'https://onlinelibrary.wiley.com/doi/10.1111/cod.12045' },
          { label: 'AAP — Baby Powder Warning', url: 'https://www.healthychildren.org/English/ages-stages/baby/bathing-skin-care/Pages/Baby-Powder-A-Potentially-Dangerous-Product.aspx' },
          { label: 'IARC — Talc Classification', url: 'https://monographs.iarc.who.int/list-of-classifications' },
          { label: 'Blume-Peytavi et al. (2016) — Skin Care Practices for Newborns and Infants', url: 'https://pubmed.ncbi.nlm.nih.gov/26886100/' },
        ],
      },
    ],
  },

  // ── Guide 23: Baby Mattress Worth the Splurge? ──────────────────────────
  {
    slug: 'is-a-baby-mattress-worth-the-splurge',
    title: 'Is a Baby Mattress Worth Breaking the Bank For?',
    subtitle: 'What actually matters for safe sleep — and where expensive marketing ends and real safety begins.',
    description: 'Firmness, certifications, and the press test: what you need to know before buying a crib mattress — and why price alone is not a proxy for safety.',
    date: 'June 2026',
    lastmod: '2026-06-24',
    readTime: '6 min',
    tags: ['Sleep', 'Safety', 'Gear'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP safe sleep guidelines, CPSC crib mattress requirements, GREENGUARD Gold certification standards, and Consumer Reports testing. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: "Baby mattress marketing wants you to believe that $300 is the price of safe sleep. It isn't. A $100 crib mattress can be just as safe — or safer — than a $400 one. The things that actually protect your baby cost far less than the premium branding suggests. Here's what matters, what doesn't, and how to pick confidently without overspending.",
      },
      {
        type: 'h2',
        heading: 'The one thing that matters most: firmness',
        body: "The American Academy of Pediatrics is clear: babies should sleep on a firm, flat surface. Soft mattresses — ones that conform to a baby's face or body — are a significant SIDS and suffocation risk. This is the single most safety-relevant characteristic of a crib mattress, and it has nothing to do with price.",
      },
      {
        type: 'note',
        body: "The press test: press firmly on the center and edge of the mattress with your palm. It should feel firm and spring back immediately. If it conforms to your hand and stays indented, it's too soft. Do this in the store — or at home before you finalize a purchase.",
      },
      {
        type: 'h2',
        heading: 'The crib fit matters as much as the mattress itself',
        body: "A mattress that doesn't fill the crib snugly creates a gap where a baby can become wedged. CPSC guidelines require that a properly fitting crib mattress leave no more than two fingers of space between the mattress edge and the crib rail. If you can fit more than two fingers, the mattress is too small for that crib — and it's a safety hazard regardless of how well-made it is.",
      },
      {
        type: 'h2',
        heading: 'Certifications worth looking for',
      },
      {
        type: 'table',
        cols: ['Certification', 'What it means', 'Worth it?'],
        rows: [
          ['GREENGUARD Gold', 'Low chemical emissions — the mattress off-gasses at safe levels for babies who breathe close to the surface for 12+ hours a day', 'Yes — meaningful for infant health'],
          ['CertiPUR-US', 'Foam made without ozone depleters, heavy metals, or prohibited flame retardants', 'Yes — relevant if foam is used'],
          ['GOTS (Global Organic Textile Standard)', 'Organic fibers in cover; regulated third-party certification', 'Nice to have, not essential'],
          ['GOLS (Global Organic Latex Standard)', 'Organic latex content verified', 'Relevant only if latex mattress'],
          ['"Organic" with no certification', 'Marketing claim; no third-party verification required', 'Meaningless — ignore it'],
          ['"Antimicrobial" or "antibacterial"', 'Chemical treatment; not safety-relevant and can be irritating', 'Skip — not a safety feature'],
        ],
      },
      {
        type: 'h2',
        heading: 'Dual-firmness: the feature that actually saves money',
        body: 'Many crib mattresses are two-sided: a firmer infant side and a slightly softer toddler side you flip to around 12 months. If you plan to use the crib through toddlerhood, this is a genuinely useful feature — you get two mattresses for one price. Look for it as a specific labeled feature, not just a thicker mattress.',
      },
      {
        type: 'h2',
        heading: 'What you do not need to pay for',
      },
      {
        type: 'bullets',
        items: [
          "Cooling gel or temperature-regulating foam. There's no evidence these improve sleep safety, and a fitted sheet covers most of these features anyway.",
          "Premium brand names. Sealy, Graco, and Moonlight Slumber mattresses test as well as Newton or Naturepedic at a fraction of the cost in Consumer Reports evaluations.",
          'Organic covers at $350+. A GREENGUARD Gold-certified mattress at $150 does more for air quality than a brand-name organic mattress with no third-party emission testing.',
          'Waterproofing claims on the mattress itself. Use a waterproof mattress protector — it does the job and you can wash it.',
        ],
      },
      {
        type: 'h2',
        heading: 'What a safe, good mattress actually costs',
        body: "You can find a firm, GREENGUARD Gold-certified, dual-sided crib mattress for $100–$180. That's the sweet spot. Under $80, quality control gets inconsistent. Over $200, you're mostly paying for branding. The Newton Wovenaire at $300+ has legitimate breathability research behind it, but for most families, a certified foam or coil mattress at $120–$150 is the sensible choice.",
      },
      {
        type: 'note',
        body: 'Never buy a used crib mattress. A mattress that has softened with use — or one whose history you don\'t know — poses a SIDS risk. This is one of the few baby items that should always be purchased new. For everything else, see our guide on what\'s worth buying secondhand.',
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🛏️',
            name: 'Graco Premium Foam Crib and Toddler Mattress',
            note: 'GREENGUARD Gold certified, dual-sided, firm infant side — best value pick under $120',
            url: 'https://www.amazon.com/s?k=graco+premium+foam+crib+toddler+mattress+greenguard&tag=sprigloop-20',
          },
          {
            emoji: '🌿',
            name: 'Naturepedic Lightweight Classic Crib Mattress',
            note: 'GOTS organic, GREENGUARD Gold, coil core — top pick if you want certified organic at a reasonable price',
            url: 'https://www.amazon.com/s?k=naturepedic+lightweight+classic+crib+mattress&tag=sprigloop-20',
          },
          {
            emoji: '🌊',
            name: 'Newton Baby Original Crib Mattress',
            note: 'Breathable Wovenaire core, 100% washable, GREENGUARD Gold — premium pick with breathability research',
            url: 'https://www.amazon.com/s?k=newton+baby+original+crib+mattress&tag=sprigloop-20',
          },
          {
            emoji: '🛡️',
            name: 'Waterproof Crib Mattress Protector (2-pack)',
            note: 'Buy two — one on, one in the wash. Changes the equation on a blowout at 2am.',
            url: 'https://www.amazon.com/s?k=waterproof+crib+mattress+protector+fitted+2+pack&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Safe Sleep Guidelines', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'CPSC — Crib Mattress Safety Requirements', url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Cribs' },
          { label: 'GREENGUARD Gold Certification', url: 'https://www.ul.com/resources/greenguard-certification' },
          { label: 'Consumer Reports — Best Crib Mattresses', url: 'https://www.consumerreports.org/babies-kids/crib-mattresses/best-crib-mattresses-of-the-year-a1055341816/' },
          { label: 'AAP — SIDS and Other Sleep-Related Infant Deaths', url: 'https://publications.aap.org/pediatrics/article/150/1/e2022057990/188304' },
          { label: 'Healthline — Newton Baby Mattress Review', url: 'https://www.healthline.com/health/baby/newton-baby-mattress-review' },
        ],
      },
    ],
  },

  // ── Guide 24: Do You Need a Baby Monitor? ───────────────────────────────
  {
    slug: 'do-you-need-a-baby-monitor',
    title: 'Do You Need a Baby Monitor — and Which Kind?',
    subtitle: 'Audio, video, and breathing monitors compared — what the research says, what parents actually use, and what you can skip.',
    description: "Baby monitor marketing has become an anxiety-driven arms race. Here's what different monitor types actually do, what the AAP recommends for healthy full-term babies, and how to choose without overspending.",
    date: 'June 2026',
    lastmod: '2026-06-24',
    readTime: '5 min',
    tags: ['Sleep', 'Safety', 'Gear'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from AAP safe sleep guidance, FDA device classifications, and published research on infant monitoring. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: "If your bedroom is next to the nursery, you may not need a monitor at all — newborns are loud. If you have a larger home or sleep heavily, a monitor gives real peace of mind. The question most parents skip: which kind? The answer depends on your living situation, sleep style, and risk tolerance — not on which monitor has the most five-star reviews.",
      },
      {
        type: 'h2',
        heading: 'The three types',
      },
      {
        type: 'table',
        cols: ['Type', 'What it does', 'Best for', 'Typical cost'],
        rows: [
          ['Audio only', 'Transmits sound when baby makes noise', 'Small homes, light sleepers, parents who want simple', '$25–$60'],
          ['Video', 'Audio + live video feed, usually with night vision and app', 'Most families — visual check without entering the room', '$80–$200'],
          ['Breathing / pulse ox (wearable)', 'Tracks breathing rate or oxygen levels, alerts if reading drops', 'NICU graduates, premature babies, specific medical advice', '$300+'],
        ],
      },
      {
        type: 'h2',
        heading: 'What the AAP actually says about breathing monitors',
        body: "The American Academy of Pediatrics does not recommend cardiorespiratory or pulse oximetry monitors for healthy, full-term babies as a way to reduce SIDS risk. The evidence shows no benefit for this population, and monitors can generate false alarms that cause significant parental anxiety without improving outcomes. The AAP's safe sleep environment guidelines — firm surface, no loose bedding, back to sleep, room-sharing without bed-sharing — are the evidence-backed SIDS reduction tools.",
      },
      {
        type: 'note',
        body: "If your baby was premature, had a NICU stay, or has a specific medical condition, your pediatrician may recommend a monitoring device as part of a care plan. That's a different conversation from general consumer monitor marketing.",
      },
      {
        type: 'h2',
        heading: 'The Owlet situation',
        body: "Owlet's Smart Sock 3 is marketed as a wellness device, not a medical one — the FDA sent a warning letter about earlier models making medical claims without clearance. Owlet later released the BabySat, which received FDA 510(k) clearance as a prescription pulse oximeter. The BabySat is a real medical device; the consumer Smart Sock is a wellness product that measures the same metrics but with wellness-only labeling. Neither is recommended by the AAP for healthy full-term babies, but they are meaningfully different products.",
      },
      {
        type: 'h2',
        heading: 'What most parents actually need',
      },
      {
        type: 'bullets',
        items: [
          "If your home is small or you're a light sleeper: audio monitor or nothing. You will hear your baby.",
          'If your home is larger or you want to visually check without going in: video monitor. The Infant Optics DXR-8 Pro and Nanit Pro are consistently top-rated; both use dedicated radio frequencies rather than WiFi streaming, which means no subscription and fewer connectivity issues.',
          'If you have strong anxiety about SIDS or your baby has medical risk factors: talk to your pediatrician before buying a breathing monitor. An informed conversation is more useful than a consumer device.',
          "Skip monitors that require a monthly subscription to access basic features — the core function of a monitor shouldn't be paywalled.",
        ],
      },
      {
        type: 'h2',
        heading: 'WiFi streaming vs dedicated frequency',
        body: 'Video monitors fall into two camps. WiFi-connected monitors stream to an app on your phone and often to a parent unit — convenient, but dependent on your internet connection and subject to app subscriptions (Nanit charges monthly for trend data). Dedicated DECT or FHSS frequency monitors (like Infant Optics) connect parent unit to camera directly — no WiFi, no subscription, no lag. Both work well; the choice is about ecosystem preference.',
      },
      {
        type: 'h2',
        heading: 'When you might not need one at all',
      },
      {
        type: 'bullets',
        items: [
          "Studio apartment or small home where you can hear clearly from anywhere: skip it.",
          "Newborn sleeping in your room per AAP room-sharing guidelines for the first 6 months: a monitor is redundant.",
          "If you're a light sleeper who wakes at every sound anyway: a monitor just gives you more sounds to wake at.",
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '📹',
            name: 'Infant Optics DXR-8 Pro Video Baby Monitor',
            note: 'Dedicated FHSS frequency, no WiFi required, no subscription — the most recommended video monitor by parents and Consumer Reports',
            url: 'https://www.amazon.com/s?k=infant+optics+dxr-8+pro+video+baby+monitor&tag=sprigloop-20',
          },
          {
            emoji: '🌙',
            name: 'Nanit Pro Smart Baby Monitor',
            note: 'WiFi-based with excellent app and breathing motion tracking (non-wearable, camera-based); subscription required for trend data',
            url: 'https://www.amazon.com/s?k=nanit+pro+smart+baby+monitor&tag=sprigloop-20',
          },
          {
            emoji: '🔊',
            name: 'VTech DM221 DECT 6.0 Audio Baby Monitor',
            note: "Best audio-only option — DECT 6.0, two-way talk, vibrating sound alert, no WiFi, under $30. If you don't need video, this is all you need.",
            url: 'https://www.amazon.com/s?k=vtech+dm221+audio+baby+monitor&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Safe Sleep Recommendations', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'AAP — Home Cardiorespiratory Monitor Use (Policy Statement)', url: 'https://publications.aap.org/pediatrics/article/122/1/232/70893' },
          { label: 'FDA — Warning Letter to Owlet Care', url: 'https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/owlet-care-inc-614931-10072021' },
          { label: 'Consumer Reports — Best Baby Monitors', url: 'https://www.consumerreports.org/babies-kids/baby-monitors/best-baby-monitors-of-the-year-a1239087270/' },
          { label: 'Pediatrics — SIDS and Other Sleep-Related Deaths (AAP Policy)', url: 'https://publications.aap.org/pediatrics/article/150/1/e2022057990/188304' },
        ],
      },
    ],
  },

  // ── Guide 25: Secondhand vs New ─────────────────────────────────────────
  {
    slug: 'what-to-buy-secondhand-vs-new',
    title: "What's Actually Worth Buying Secondhand vs. New",
    subtitle: "A clear breakdown of what's safe, smart, and worth it to buy used — and the short list of things that should always be new.",
    description: "Secondhand baby gear can save you thousands. But some items carry real safety risks when bought used. Here's the breakdown.",
    date: 'June 2026',
    lastmod: '2026-06-24',
    readTime: '6 min',
    tags: ['Planning', 'Safety'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from CPSC safety guidelines, AAP recommendations, and NHTSA car seat policy. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: "Baby gear is used for months, not years. A bouncer that a previous family used for four months is functionally new — and available for a fraction of the price. But some baby items carry real safety risks when bought used, and the short list of things that should always be new is worth knowing cold before you hit a Facebook Marketplace listing.",
      },
      {
        type: 'h2',
        heading: 'Always buy new',
      },
      {
        type: 'table',
        cols: ['Item', 'Why new only'],
        rows: [
          ['Car seat', "No way to verify crash history. A seat involved in a moderate or severe crash may have internal damage invisible to the eye. Expired seats (check the label — most expire 6–10 years from manufacture) should be destroyed, not resold. This is not a negotiable one."],
          ['Crib mattress', 'Soft, worn mattress surfaces are a SIDS risk. A used mattress may have degraded well past what\'s visible. Buy new — see our mattress guide for how to do it without overspending.'],
          ['Crib or bassinet (if older than 2012)', 'Pre-2012 cribs may not meet current CPSC safety standards. Drop-side cribs — banned in 2011 — are still circulating secondhand. Always check the CPSC recall database before accepting any used crib.'],
          ['Bike helmet or baby helmet', 'Same logic as car seats: invisible structural damage from a single impact means the helmet no longer protects properly.'],
          ['Breast pump (open system)', 'Open-system pumps — where milk can contact motor components — are single-user devices by FDA classification. Internal parts cannot be fully sterilized. Closed-system pumps can be safely shared with new parts; check the model before buying used.'],
        ],
      },
      {
        type: 'h2',
        heading: "Great to buy secondhand",
      },
      {
        type: 'bullets',
        items: [
          "Clothing — the single best secondhand category. Babies outgrow sizes in weeks. A 6-month onesie worn four times is indistinguishable from new after washing. Sprigloop families pass along outgrown clothing to families with younger babies — it's how the platform works.",
          "Bouncers and swings — check for recalls (CPSC database), ensure all parts are present and straps intact, and test the motion mechanism. A $15 Fisher-Price bouncer works identically to a new one.",
          'Baby carriers and wraps — inspect stitching and buckles carefully; avoid anything with fraying or signs of UV degradation. Ring slings and woven wraps hold up well over time.',
          'Strollers — no crash-history concern like car seats; verify the fold mechanism, brakes, and harness before buying. Check recalls.',
          'Play mats and activity gyms — wash covers before use; inspect any hanging toys for loose parts or broken attachment points.',
          'Bouncers, Boppys, and nursing pillows — wash all covers; inspect foam for compression or breakdown.',
          'High chairs — full cleaning required; check harness and tray mechanism. Avoid models with recalls.',
          'Swaddles, muslin blankets, and soft toys — machine washable, low risk, excellent secondhand value.',
        ],
      },
      {
        type: 'note',
        body: 'Before buying any used gear, check the CPSC recall database at cpsc.gov/recalls. Filter by product type. If a model appears, check whether the specific unit is affected. Many recalls offer free repair kits — worth checking even for items you already own.',
      },
      {
        type: 'h2',
        heading: 'Use your judgment on these',
      },
      {
        type: 'bullets',
        items: [
          "Baby bathtubs — fine secondhand if structurally intact and you can clean them thoroughly. Avoid if there's mold in crevices that can't be reached.",
          'Jumpers and exersaucers — check all joints and weight limits. If anything wobbles or a seat pivot feels loose, skip it.',
          'White noise machines and small electronics — test before paying. Check the cord for damage. Otherwise fine.',
          "Breast pumps (closed system) — Spectra S1/S2, Medela Pump in Style (with motor protection), and Elvie are closed-system pumps. Replace all parts that contact milk (flanges, tubing, valves, membranes) and you're using a new pump functionally.",
        ],
      },
      {
        type: 'h2',
        heading: 'Where to find secondhand baby gear',
        body: 'Facebook Marketplace and local buy-nothing groups are the best sources for large gear. ThredUp, Poshmark, and eBay work well for clothing. Sprigloop connects families with outgrown clothing from other local families — built specifically for the clothing pass-along cycle that makes the first two years more manageable.',
      },
      {
        type: 'sources',
        items: [
          { label: 'CPSC — Recalls Database', url: 'https://www.cpsc.gov/Recalls' },
          { label: 'NHTSA — Car Seat Replacement After a Crash', url: 'https://www.nhtsa.gov/sites/nhtsa.gov/files/documents/crashedreplacement_final.pdf' },
          { label: 'FDA — Breast Pump Classifications (Single vs Multi-User)', url: 'https://www.fda.gov/medical-devices/breast-pumps/single-use-vs-multiple-user-breast-pumps' },
          { label: 'CPSC — Crib Safety Standards (2011 rule)', url: 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Cribs' },
          { label: 'AAP — Car Seat Safety', url: 'https://www.healthychildren.org/English/safety-prevention/on-the-go/Pages/Car-Safety-Seats-Information-for-Families.aspx' },
          { label: 'Safe Kids Worldwide — When to Replace a Car Seat', url: 'https://www.safekids.org/tip/when-replace-car-seat' },
        ],
      },
    ],
  },

  // ── Guide 26: Baby Stuff You'll Never Use ───────────────────────────────
  {
    slug: 'baby-stuff-youll-never-use',
    title: "Baby Stuff You'll Buy and Never Use",
    subtitle: 'The items that fill up registries and collect dust — and what to do instead.',
    description: 'A candid look at the most commonly regretted baby purchases: what parents buy, why they rarely use it, and what actually works instead.',
    date: 'June 2026',
    lastmod: '2026-06-24',
    readTime: '6 min',
    tags: ['Planning', 'Gear'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from parenting surveys, pediatric guidance, and consumer research. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: "Every new parent ends up with a closet full of things that seemed essential before the baby arrived and gathered dust after. Some items are category misfires. Some are genuine safety problems dressed up as solutions. And some just get replaced by something free you already own. Here's the honest list.",
      },
      {
        type: 'h2',
        heading: 'Newborn shoes',
        body: "Newborns do not walk. They do not need shoes. Shoes fall off constantly, serve no protective function, and are hard to put on a squirming infant. Socks do everything a shoe does for a non-walking baby, better. The one exception: photo props. Buy them secondhand if you want the photo.",
      },
      {
        type: 'h2',
        heading: 'Crib bumpers',
        body: "Not just useless — actively dangerous. Crib bumpers have been linked to infant suffocation deaths, and the AAP has warned against them for years. As of 2022, the CPSC banned the sale of crib bumpers in the United States. They still appear secondhand. Do not use them.",
      },
      {
        type: 'h2',
        heading: 'Sleep positioners and infant loungers (for unsupervised sleep)',
        body: "Products like the Dock-a-Tot are sold as infant loungers and photographed with sleeping babies — but the AAP and CPSC are explicit: no soft bedding, positioning devices, or inclined sleepers in a baby's sleep space. Loungers are fine for supervised awake time. Using one as a sleep surface is a suffocation risk.",
      },
      {
        type: 'h2',
        heading: 'Wipe warmer',
        body: 'The idea: warm wipes so baby doesn\'t startle. The reality: wipes dry out faster in a warmer, the "warm" effect lasts about two seconds, and babies adapt to room-temperature wipes within days. The device costs $25–$40, takes up counter space, and most parents stop using it within a month. Your hand held over the wipe for five seconds does the same job.',
      },
      {
        type: 'h2',
        heading: 'Dedicated diaper pail',
        body: "The Diaper Genie and similar products market themselves as odor-containment systems. In practice, the effectiveness varies by diaper type and how often you empty it, the refill cartridges are an ongoing cost, and many parents conclude a regular trash can with a lid — emptied daily — works equally well. If you have a large home and carry diapers far to dispose of them, a pail near the changing area makes sense. Otherwise it's an added expense for marginal benefit.",
      },
      {
        type: 'h2',
        heading: 'Baby food maker',
        body: "A dedicated baby food processor — appliances that steam and blend in one unit — costs $50–$100 and does exactly what a regular blender does. The 'baby' label adds nothing functional. If you make homemade baby food, your existing blender handles it. If you don't plan to make homemade baby food, this item has a use-window of a few months and no second career.",
      },
      {
        type: 'h2',
        heading: 'UV bottle sterilizer',
        body: "UV sterilizers are fast and convenient, but the CDC and AAP both note that sterilizing baby bottles is not necessary for healthy full-term babies in homes with safe tap water. Washing thoroughly in hot soapy water — or running through the dishwasher — is sufficient. Sterilization is recommended when a baby is premature or immunocompromised, or during illness. For most families, the $50–$150 device solves a problem that doesn't exist.",
      },
      {
        type: 'h2',
        heading: 'Elaborate swaddle products with proprietary systems',
        body: "Velcro swaddle wraps and specialty swaddle blankets with built-in systems can be useful for parents who struggle to swaddle with a regular muslin blanket. But they solve a skill problem that most parents master in a few days, and babies outgrow swaddles by 2–3 months when they start rolling. Five muslin swaddle blankets at $20 for a 4-pack outlast and out-multipurpose any proprietary swaddle system.",
      },
      {
        type: 'h2',
        heading: 'Changing table (standalone furniture)',
        body: "A dedicated changing table is a large, single-purpose piece of furniture that becomes a storage shelf the moment your child is out of diapers. Most families find a changing pad ($25) on top of a dresser they already own works identically. You get storage underneath, the dresser keeps serving a purpose after potty training, and you save $100–$300.",
      },
      {
        type: 'h2',
        heading: 'Nursing cover',
        body: "Many breastfeeding parents buy nursing covers and use them twice. Babies dislike having their heads covered. Covers are hard to manage one-handed while latching. Most parents find a loose shirt or light muslin blanket draped over one shoulder works better. If you want coverage, a large muslin swaddle already in your stash does the job.",
      },
      {
        type: 'h2',
        heading: 'The pattern',
        body: "Most of these items share a structure: a problem that sounds real in marketing, a solution with a dedicated product, and a simpler free or low-cost alternative that works just as well. The exception is anything with a genuine safety concern — bumpers and sleep positioners — where the product causes harm rather than just being unnecessary.",
      },
      {
        type: 'note',
        body: 'Building your registry? Our guide on what a baby actually needs — by category, with real quantities — helps you focus on the items that genuinely matter for the first three months.',
      },
      {
        type: 'sources',
        items: [
          { label: 'AAP — Safe Sleep Environment', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
          { label: 'CPSC — Crib Bumper Ban (2022)', url: 'https://www.cpsc.gov/Newsroom/News-Releases/2022/CPSC-Bans-Crib-Bumpers' },
          { label: 'CDC — How to Clean, Sanitize, and Store Infant Feeding Items', url: 'https://www.cdc.gov/hygiene/personal-hygiene/infant-feeding-items.html' },
          { label: 'AAP — Sterilizing Bottles', url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Cleaning-Infant-Feeding-Items.aspx' },
          { label: 'Consumer Reports — Infant Lounger Safety Warning', url: 'https://www.consumerreports.org/babies-kids/infant-sleep/infant-lounger-safety-what-parents-need-to-know-a1200793419/' },
          { label: 'What to Expect — Baby Registry Must-Haves vs. Skips', url: 'https://www.whattoexpect.com/baby-products/baby-registry/registry-must-haves-or-not' },
        ],
      },
    ],
  },

  // ── Guide 27: Do You Need a Bottle Warmer? ──────────────────────────────
  {
    slug: 'do-you-need-a-bottle-warmer',
    title: 'Do You Need a Bottle Warmer? (And 5 Other Baby Gadgets, Honestly Evaluated)',
    subtitle: 'Six common baby gadgets — bottle warmer, wipe warmer, white noise machine, baby food maker, diaper pail, UV sterilizer — and a straight verdict on each.',
    description: 'A gadget-by-gadget breakdown of six common baby purchases: what they actually do, what works just as well for less, and the one that genuinely earns its place.',
    date: 'June 2026',
    lastmod: '2026-06-24',
    readTime: '7 min',
    tags: ['Gear', 'Planning'],
    aiDisclosure: 'This article was researched and written with AI assistance, drawing from pediatric guidance, CDC infant care recommendations, and consumer testing. Sources are linked throughout.',
    sections: [
      {
        type: 'lede',
        body: "The baby gear industry is very good at selling solutions to problems that already have solutions. Here are six gadgets you'll see on every registry guide, evaluated without the marketing language — with a verdict on each.",
      },
      {
        type: 'h2',
        heading: '1. Bottle warmer',
        body: "Bottle warmers heat refrigerated or frozen breast milk or formula to feeding temperature. Most use steam or water bath heating. They range from $25 to $70 and include models that claim to preserve nutrients (there's no meaningful difference at the temperatures used for warming).",
      },
      {
        type: 'bullets',
        items: [
          'The free alternative: a mug or bowl of hot tap water. Submerge the bottle for 2–5 minutes. Works identically and costs nothing.',
          'Microwaving is the one thing to avoid — it creates hot spots that can burn a baby\'s mouth even when the bottle feels fine from the outside.',
          'If you formula-feed and mix fresh, warming is optional — formula mixed with warm water skips the step entirely.',
          'The case for buying one: if you\'re pumping and refrigerating breast milk, and especially if you\'re managing nighttime feedings solo, a bottle warmer in the nursery beats walking to the kitchen. The Born Free Bottle Warmer and Kiinde Kozii are consistently well-reviewed for even heating.',
          'Verdict: skip it unless you anticipate high-volume nighttime bottle warming. A mug of hot water works.',
        ],
      },
      {
        type: 'h2',
        heading: '2. Wipe warmer',
        body: 'Wipe warmers keep a stack of diaper wipes at body temperature so baby doesn\'t startle during changes.',
      },
      {
        type: 'bullets',
        items: [
          'Wipes dry out faster in a warmer — most models include a sponge to compensate, which you have to keep wet.',
          'The effect is temporary: warm when it comes out, room temperature by the time it reaches the baby.',
          'Babies adapt to room-temperature wipes in days.',
          'The free alternative: hold the wipe in your fist for 10 seconds before use. Done.',
          'Verdict: skip. This is the gadget most parents mention regretting.',
        ],
      },
      {
        type: 'h2',
        heading: '3. White noise machine',
        body: "White noise machines play continuous sound — static, fan, rain, ocean — at a consistent volume. They're used for infant sleep and nap extension.",
      },
      {
        type: 'bullets',
        items: [
          'The research here is solid. A 1990 study in Archives of Disease in Childhood found white noise helped 80% of babies fall asleep within 5 minutes vs 25% in the control group. More recent research confirms the effect on sleep consolidation.',
          'The one caveat: volume matters. The AAP recommends keeping white noise machines at 50 dB or less and at least 7 feet from the baby. Placing a machine directly in the crib at high volume causes hearing concerns.',
          'The free alternative: a fan pointed away from baby, a phone app, or a smart speaker works. But a dedicated machine on a timer, positioned correctly, is genuinely useful and costs $30–$50.',
          "This is the one gadget on this list that earns its place. A good white noise machine extends naps, masks household noise, and creates a consistent sleep cue that travels with you.",
          'Verdict: worth it. The Hatch Rest and LectroFan are the most recommended models.',
        ],
      },
      {
        type: 'h2',
        heading: '4. Baby food maker',
        body: 'All-in-one devices that steam and blend baby food in the same container. Marketed as simplifying the transition to solids at 4–6 months.',
      },
      {
        type: 'bullets',
        items: [
          'A regular blender handles this identically. Steam vegetables in a pot, blend in a blender you already own, freeze in an ice cube tray.',
          'The use window is narrow — roughly 4 to 8 months, when purees transition to soft table food.',
          'Some parents prefer the convenience of an all-in-one; others use it twice and return it.',
          'Verdict: skip unless you know you plan to make large batches of homemade baby food and want a dedicated appliance. Your blender does this.',
        ],
      },
      {
        type: 'h2',
        heading: '5. Diaper pail',
        body: "Specialized diaper disposal systems (Diaper Genie, Ubbi, Munchkin STEP) promise odor containment with proprietary refill cartridges.",
      },
      {
        type: 'bullets',
        items: [
          'The Ubbi is the most recommended because it uses standard garbage bags instead of proprietary refills — the ongoing cost of cartridges is a real irritant with the Diaper Genie.',
          'Effectiveness varies: a lidded trash can emptied every 24–48 hours manages odor comparably for most families.',
          "The case for buying one: if your nursery is far from your kitchen trash, or you have a small apartment where odor management matters, a dedicated pail near the changing station is genuinely convenient.",
          'Verdict: marginal. A lidded trash can works fine for most families. If you want one, the Ubbi is the pick — no proprietary refills.',
        ],
      },
      {
        type: 'h2',
        heading: '6. UV bottle sterilizer',
        body: 'UV sterilizers use ultraviolet light to kill bacteria on bottles, nipples, and pump parts. Some also include a drying function.',
      },
      {
        type: 'bullets',
        items: [
          "The CDC is clear: for healthy full-term babies in homes with safe tap water, sterilization isn't necessary. Thorough washing in hot soapy water or in the dishwasher is sufficient.",
          'Sterilization is recommended for: premature or immunocompromised babies, during illness, when tap water quality is uncertain, or after a baby has been ill.',
          'If your pediatrician recommends sterilizing, boiling for 5 minutes works identically to a UV unit and costs nothing.',
          'Verdict: skip unless you have a specific medical reason to sterilize. The dishwasher does the job for most families.',
        ],
      },
      {
        type: 'h2',
        heading: 'The scorecard',
      },
      {
        type: 'table',
        cols: ['Gadget', 'Verdict', 'Free/cheap alternative'],
        rows: [
          ['Bottle warmer', 'Skip (unless high-volume overnight pumping)', 'Mug of hot water — 2–5 minutes'],
          ['Wipe warmer', 'Skip', 'Hold wipe in fist for 10 seconds'],
          ['White noise machine', 'Worth it', 'Fan or phone app works, but machine is better'],
          ['Baby food maker', 'Skip', 'Blender + ice cube tray'],
          ['Diaper pail', 'Marginal — your call', 'Lidded trash can, emptied daily'],
          ['UV sterilizer', 'Skip (most families)', 'Dishwasher or boiling'],
        ],
      },
      {
        type: 'products',
        items: [
          {
            emoji: '🔊',
            name: 'LectroFan Classic White Noise Machine',
            note: 'Non-looping fan and white noise sounds, precise volume control, compact — the most recommended standalone white noise machine',
            url: 'https://www.amazon.com/s?k=lectrofan+classic+white+noise+machine&tag=sprigloop-20',
          },
          {
            emoji: '🌙',
            name: 'Hatch Rest Baby Sound Machine',
            note: 'App-controlled, doubles as night light and ok-to-wake clock as baby grows — premium pick that scales past the infant stage',
            url: 'https://www.amazon.com/s?k=hatch+rest+baby+sound+machine&tag=sprigloop-20',
          },
          {
            emoji: '🍼',
            name: 'Kiinde Kozii Bottle Warmer',
            note: 'Water bath warming (gentler than steam), works with most bottle types including storage bags — best pick if you decide to buy a warmer',
            url: 'https://www.amazon.com/s?k=kiinde+kozii+bottle+warmer&tag=sprigloop-20',
          },
          {
            emoji: '🗑️',
            name: 'Ubbi Steel Odor Locking Diaper Pail',
            note: 'Uses standard garbage bags (no proprietary refills), powder-coated steel construction — best diaper pail if you want one',
            url: 'https://www.amazon.com/s?k=ubbi+steel+diaper+pail&tag=sprigloop-20',
          },
        ],
      },
      {
        type: 'sources',
        items: [
          { label: 'CDC — How to Clean, Sanitize, and Store Infant Feeding Items', url: 'https://www.cdc.gov/hygiene/personal-hygiene/infant-feeding-items.html' },
          { label: 'AAP — Sterilizing Baby Bottles', url: 'https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Cleaning-Infant-Feeding-Items.aspx' },
          { label: 'Spencer et al. (1990) — White Noise and Infant Sleep (Archives of Disease in Childhood)', url: 'https://adc.bmj.com/content/65/1/135' },
          { label: 'AAP — White Noise and Hearing Concerns', url: 'https://www.healthychildren.org/English/news/Pages/Infant-Sleep-Machines-and-Hearing-Loss.aspx' },
          { label: 'Consumer Reports — Bottle Warmers Buying Guide', url: 'https://www.consumerreports.org/babies-kids/bottle-warmers/buying-guide/' },
          { label: 'AAP — Safe Sleep Environment', url: 'https://www.aap.org/en/patient-care/safe-sleep/' },
        ],
      },
    ],
  },
]

export function getGuide(slug) {
  return GUIDES.find(g => g.slug === slug) ?? null
}
