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
        body: 'Sprigloop\'s wishlist works differently from a traditional registry. Instead of manually curating a list of products, it shows family and friends your actual gaps — what you\'re missing by category and size — so they can fill something real. No store account required on their end, no duplicates, no generic suggestions.',
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
        body: 'The problem with traditional registries is that you\'re guessing what you need before you know your baby. Sprigloop flips this: once you\'ve added what you already have, the Plan tab shows your actual gaps by category and size. You can share that as a wishlist link — family sees exactly what\'s missing, not a curated list of products you added pre-birth. It\'s the difference between "I think I might need sleep sacks" and "I have 1 sleep sack in 0-3M and need 3 more."',
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
]

export function getGuide(slug) {
  return GUIDES.find(g => g.slug === slug) ?? null
}
