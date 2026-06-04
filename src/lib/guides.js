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
            url: 'https://www.amazon.com/dp/B0BMLT3M13/?tag=spriglooop-20',
          },
          {
            emoji: '🌙',
            name: 'Ecolino Organic Cotton Sleep Sack (6–18M)',
            note: '100% GOTS certified cotton, bottom-zip for quick night changes',
            url: 'https://www.amazon.com/dp/B06XJ35W1H/?tag=spriglooop-20',
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
            url: "https://www.amazon.com/s?k=burt%27s+bees+baby+organic+bodysuits&tag=spriglooop-20",
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
