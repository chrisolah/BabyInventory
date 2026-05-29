// ============================================================================
// scan-item — visual item recognition Edge Function
// ============================================================================
// Accepts a single photo of a non-clothing baby item (or its box) and asks
// Claude to identify what it is. Complements scan-clothing-tag (which reads
// clothing hang-tags) for the non-clothing scan flow.
//
// Shape of request body:
//   {
//     "item": { "image_base64": "<base64>", "mime_type": "image/jpeg" },
//     "category_hint": "sleep" | "feeding" | ... | null  // optional
//   }
//
// Shape of success response (200):
//   {
//     "fields": {
//       "top_category": "sleep" | "feeding" | ... | null,
//       "sub_category": <SUB_CATEGORY_ID> | null,
//       "item_type":    <ITEM_ID> | null,
//       "brand":        string | null,
//       "condition":    "new" | "like_new" | "good" | "fair" | "worn" | null
//     },
//     "confidence": { per-field "high"|"medium"|"low"|null },
//     "raw": <model's raw JSON for debugging>,
//     "quota": { "used": number, "limit": number }
//   }
//
// Rate limit: shared with scan-clothing-tag via the same bump_scan_usage RPC.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const DAILY_LIMIT = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 50)
const MAX_BYTES   = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const TOP_CATEGORIES = ['sleep', 'feeding', 'diapering', 'travel', 'play', 'health', 'bath'] as const

const CONDITIONS = ['new', 'like_new', 'good', 'fair', 'worn'] as const

// Sub-categories per top-level category
const SUB_CATEGORIES: Record<string, string[]> = {
  sleep:     ['sleep_surfaces', 'sleep_bedding', 'sleep_environment', 'sleep_monitoring'],
  feeding:   ['breastfeeding', 'bottle_feeding', 'solids'],
  diapering: ['diapers', 'changing_station', 'diaper_bag'],
  travel:    ['strollers', 'car_seats', 'carriers', 'travel_gear'],
  play:      ['infant_play', 'mobile_play', 'books_learning', 'outdoor_play'],
  health:    ['health_monitoring', 'grooming', 'baby_safety'],
  bath:      ['bath_setup', 'bath_products'],
}

// Full item taxonomy — id, label, top_category, sub_category.
// Must stay in sync with src/lib/categories.js ITEMS array.
const ITEMS = [
  // sleep / sleep_surfaces
  { id: 'crib',                 label: 'Crib',                   top: 'sleep',     sub: 'sleep_surfaces' },
  { id: 'bassinet',             label: 'Bassinet',               top: 'sleep',     sub: 'sleep_surfaces' },
  { id: 'pack_n_play',          label: 'Pack-n-play',            top: 'sleep',     sub: 'sleep_surfaces' },
  // sleep / sleep_bedding
  { id: 'crib_mattress',        label: 'Crib mattress',          top: 'sleep',     sub: 'sleep_bedding' },
  { id: 'mattress_protector',   label: 'Mattress protector',     top: 'sleep',     sub: 'sleep_bedding' },
  { id: 'fitted_sheets',        label: 'Fitted sheets',          top: 'sleep',     sub: 'sleep_bedding' },
  // sleep / sleep_environment
  { id: 'white_noise_machine',  label: 'White noise machine',    top: 'sleep',     sub: 'sleep_environment' },
  { id: 'blackout_curtains',    label: 'Blackout curtains',      top: 'sleep',     sub: 'sleep_environment' },
  { id: 'night_light',          label: 'Night light',            top: 'sleep',     sub: 'sleep_environment' },
  // sleep / sleep_monitoring
  { id: 'baby_monitor',         label: 'Baby monitor',           top: 'sleep',     sub: 'sleep_monitoring' },
  // feeding / breastfeeding
  { id: 'breast_pump',          label: 'Breast pump',            top: 'feeding',   sub: 'breastfeeding' },
  { id: 'nursing_pillow',       label: 'Nursing pillow',         top: 'feeding',   sub: 'breastfeeding' },
  { id: 'nursing_pads',         label: 'Nursing pads',           top: 'feeding',   sub: 'breastfeeding' },
  { id: 'nipple_cream',         label: 'Nipple cream',           top: 'feeding',   sub: 'breastfeeding' },
  { id: 'milk_storage',         label: 'Milk storage bags',      top: 'feeding',   sub: 'breastfeeding' },
  // feeding / bottle_feeding
  { id: 'bottles',              label: 'Baby bottles',           top: 'feeding',   sub: 'bottle_feeding' },
  { id: 'bottle_brush',         label: 'Bottle brush',           top: 'feeding',   sub: 'bottle_feeding' },
  { id: 'bottle_sterilizer',    label: 'Bottle sterilizer',      top: 'feeding',   sub: 'bottle_feeding' },
  { id: 'drying_rack',          label: 'Drying rack',            top: 'feeding',   sub: 'bottle_feeding' },
  // feeding / solids
  { id: 'high_chair',           label: 'High chair',             top: 'feeding',   sub: 'solids' },
  { id: 'baby_spoons',          label: 'Baby spoons',            top: 'feeding',   sub: 'solids' },
  { id: 'baby_bowls',           label: 'Baby bowls',             top: 'feeding',   sub: 'solids' },
  { id: 'sippy_cup',            label: 'Sippy cups',             top: 'feeding',   sub: 'solids' },
  { id: 'silicone_placemat',    label: 'Silicone placemat',      top: 'feeding',   sub: 'solids' },
  { id: 'baby_food_maker',      label: 'Baby food maker',        top: 'feeding',   sub: 'solids' },
  { id: 'mesh_feeder',          label: 'Mesh feeders',           top: 'feeding',   sub: 'solids' },
  // diapering / diapers
  { id: 'disposable_diapers',   label: 'Diapers',                top: 'diapering', sub: 'diapers' },
  { id: 'cloth_diapers',        label: 'Cloth diapers',          top: 'diapering', sub: 'diapers' },
  { id: 'swim_diapers',         label: 'Swim diapers',           top: 'diapering', sub: 'diapers' },
  { id: 'diaper_rash_cream',    label: 'Diaper rash cream',      top: 'diapering', sub: 'diapers' },
  // diapering / changing_station
  { id: 'changing_pad',         label: 'Changing pad',           top: 'diapering', sub: 'changing_station' },
  { id: 'changing_pad_covers',  label: 'Changing pad covers',    top: 'diapering', sub: 'changing_station' },
  { id: 'wipes',                label: 'Baby wipes',             top: 'diapering', sub: 'changing_station' },
  { id: 'diaper_pail',          label: 'Diaper pail',            top: 'diapering', sub: 'changing_station' },
  { id: 'wipe_warmer',          label: 'Wipe warmer',            top: 'diapering', sub: 'changing_station' },
  // diapering / diaper_bag
  { id: 'diaper_bag',           label: 'Diaper bag',             top: 'diapering', sub: 'diaper_bag' },
  { id: 'wet_bag',              label: 'Wet bags',               top: 'diapering', sub: 'diaper_bag' },
  // travel / strollers
  { id: 'stroller',             label: 'Stroller',               top: 'travel',    sub: 'strollers' },
  { id: 'stroller_organizer',   label: 'Stroller organizer',     top: 'travel',    sub: 'strollers' },
  { id: 'stroller_bassinet',    label: 'Stroller bassinet',      top: 'travel',    sub: 'strollers' },
  // travel / car_seats
  { id: 'infant_car_seat',      label: 'Infant car seat',        top: 'travel',    sub: 'car_seats' },
  { id: 'convertible_car_seat', label: 'Convertible car seat',   top: 'travel',    sub: 'car_seats' },
  { id: 'car_seat_mirror',      label: 'Car seat mirror',        top: 'travel',    sub: 'car_seats' },
  { id: 'car_seat_protector',   label: 'Car seat protector',     top: 'travel',    sub: 'car_seats' },
  // travel / carriers
  { id: 'structured_carrier',   label: 'Structured carrier',     top: 'travel',    sub: 'carriers' },
  { id: 'wrap_carrier',         label: 'Wrap carrier',           top: 'travel',    sub: 'carriers' },
  { id: 'ring_sling',           label: 'Ring sling',             top: 'travel',    sub: 'carriers' },
  // travel / travel_gear
  { id: 'portable_high_chair',  label: 'Portable high chair',    top: 'travel',    sub: 'travel_gear' },
  // play / infant_play
  { id: 'play_mat',             label: 'Play mat',               top: 'play',      sub: 'infant_play' },
  { id: 'baby_gym',             label: 'Baby gym',               top: 'play',      sub: 'infant_play' },
  { id: 'bouncer_swing',        label: 'Bouncer or swing',       top: 'play',      sub: 'infant_play' },
  { id: 'rattles_sensory',      label: 'Rattles & sensory toys', top: 'play',      sub: 'infant_play' },
  // play / mobile_play
  { id: 'jumper_exersaucer',    label: 'Jumper or exersaucer',   top: 'play',      sub: 'mobile_play' },
  { id: 'push_walker',          label: 'Push walker',            top: 'play',      sub: 'mobile_play' },
  { id: 'stacking_blocks',      label: 'Blocks',                 top: 'play',      sub: 'mobile_play' },
  { id: 'shape_sorter',         label: 'Shape sorters & puzzles',top: 'play',      sub: 'mobile_play' },
  // play / books_learning
  { id: 'board_books',          label: 'Board books',            top: 'play',      sub: 'books_learning' },
  { id: 'bath_books',           label: 'Bath books',             top: 'play',      sub: 'books_learning' },
  // play / outdoor_play
  { id: 'outdoor_blanket',      label: 'Outdoor blanket',        top: 'play',      sub: 'outdoor_play' },
  // health / health_monitoring
  { id: 'thermometer',          label: 'Thermometer',            top: 'health',    sub: 'health_monitoring' },
  { id: 'nasal_aspirator',      label: 'Nasal aspirator',        top: 'health',    sub: 'health_monitoring' },
  { id: 'humidifier',           label: 'Humidifier',             top: 'health',    sub: 'health_monitoring' },
  // health / grooming
  { id: 'nail_clippers',        label: 'Baby nail clippers',     top: 'health',    sub: 'grooming' },
  { id: 'baby_brush_comb',      label: 'Baby brush & comb',      top: 'health',    sub: 'grooming' },
  { id: 'medicine_dropper',     label: 'Medicine dropper',       top: 'health',    sub: 'grooming' },
  // health / baby_safety
  { id: 'outlet_covers',        label: 'Outlet covers',          top: 'health',    sub: 'baby_safety' },
  { id: 'cabinet_locks',        label: 'Cabinet locks',          top: 'health',    sub: 'baby_safety' },
  { id: 'baby_gate',            label: 'Baby gates',             top: 'health',    sub: 'baby_safety' },
  { id: 'corner_guards',        label: 'Corner guards',          top: 'health',    sub: 'baby_safety' },
  // bath / bath_setup
  { id: 'baby_bathtub',         label: 'Baby bathtub',           top: 'bath',      sub: 'bath_setup' },
  { id: 'hooded_towels',        label: 'Hooded towels',          top: 'bath',      sub: 'bath_setup' },
  { id: 'washcloths',           label: 'Washcloths',             top: 'bath',      sub: 'bath_setup' },
  { id: 'bath_mat',             label: 'Bath mat',               top: 'bath',      sub: 'bath_setup' },
  { id: 'bath_thermometer',     label: 'Bath thermometer',       top: 'bath',      sub: 'bath_setup' },
  { id: 'rinse_cup',            label: 'Rinse cup',              top: 'bath',      sub: 'bath_setup' },
  // bath / bath_products
  { id: 'baby_wash_shampoo',    label: 'Baby wash & shampoo',    top: 'bath',      sub: 'bath_products' },
  { id: 'baby_lotion',          label: 'Baby lotion',            top: 'bath',      sub: 'bath_products' },
] as const

// All valid item type IDs
const ITEM_IDS = ITEMS.map(i => i.id)

// All valid sub-category IDs
const ALL_SUB_CATEGORIES = Object.values(SUB_CATEGORIES).flat()

// Build the taxonomy reference string for the prompt — one line per item
// grouped by category and sub-category so the model can reason about which
// bucket each ID belongs to without having to infer it.
function buildTaxonomyRef(hintCat?: string): string {
  const cats = hintCat ? [hintCat] : TOP_CATEGORIES
  const lines: string[] = []
  for (const cat of cats) {
    const subs = SUB_CATEGORIES[cat] || []
    for (const sub of subs) {
      const items = ITEMS.filter(i => i.top === cat && i.sub === sub)
      if (items.length === 0) continue
      lines.push(`${cat} / ${sub}: ${items.map(i => `${i.id} (${i.label})`).join(', ')}`)
    }
  }
  return lines.join('\n')
}

const BASE_SYSTEM_PROMPT = `You are identifying a baby product from a photograph. The photo may show the item itself, its packaging/box, or both. Your job is to match what you see to an item in the taxonomy below and return structured JSON.

TAXONOMY (format: top_category / sub_category: item_id (label), ...):
{TAXONOMY}

Return ONLY a single JSON object with these keys:
- top_category: one of ${TOP_CATEGORIES.map(c => `"${c}"`).join(', ')}, or null if you cannot tell.
- sub_category: the matching sub-category id from the taxonomy above, consistent with top_category. Null if unsure.
- item_type: the matching item id from the taxonomy above, consistent with top_category and sub_category. Null if nothing fits well.
- brand: brand name as it appears on the item or packaging, transcribed literally. Null if not visible or not readable. Do not substitute a common brand you know for something you can't actually read.
- condition: one of ${CONDITIONS.map(c => `"${c}"`).join(', ')}, estimated from the item's visible wear. Use null if you cannot tell from the photo (e.g. it is boxed). Guidelines: "new" = factory-sealed/unboxed-but-unused; "like_new" = minimal visible use; "good" = normal use, no damage; "fair" = visible wear/scuffs; "worn" = heavy wear or damage.

Also return a "confidence" key with per-field confidence: "high" (clearly visible and unambiguous), "medium" (reasonably confident with some inference), "low" (best guess from limited information). If a field value is null its confidence must also be null.

Do not include prose, markdown, or code fences. Return the JSON object and nothing else. Prefer null over a low-confidence guess.

Example shape (values are placeholders only — do NOT pattern-match to these):
{"top_category":"sleep","sub_category":"sleep_surfaces","item_type":"bassinet","brand":"SNOO","condition":"good","confidence":{"top_category":"high","sub_category":"high","item_type":"high","brand":"high","condition":"medium"}}`

type Fields = {
  top_category: string | null
  sub_category: string | null
  item_type:    string | null
  brand:        string | null
  condition:    string | null
}

type Confidence = 'high' | 'medium' | 'low' | null

type ConfidenceMap = {
  top_category: Confidence
  sub_category: Confidence
  item_type:    Confidence
  brand:        Confidence
  condition:    Confidence
}

const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low'])

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function coerceFields(raw: any): Fields {
  const top_category = typeof raw?.top_category === 'string' && (TOP_CATEGORIES as readonly string[]).includes(raw.top_category) ? raw.top_category : null
  const sub_category = typeof raw?.sub_category === 'string' && ALL_SUB_CATEGORIES.includes(raw.sub_category) ? raw.sub_category : null
  const item_type    = typeof raw?.item_type    === 'string' && (ITEM_IDS as readonly string[]).includes(raw.item_type) ? raw.item_type : null
  const brand        = typeof raw?.brand        === 'string' && raw.brand.trim() ? raw.brand.trim().slice(0, 80) : null
  const condition    = typeof raw?.condition    === 'string' && (CONDITIONS as readonly string[]).includes(raw.condition) ? raw.condition : null
  return { top_category, sub_category, item_type, brand, condition }
}

function coerceConfidence(rawConf: any, fields: Fields): ConfidenceMap {
  function pick(fieldValue: unknown, raw: unknown): Confidence {
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') return null
    if (typeof raw === 'string' && CONFIDENCE_LEVELS.has(raw)) return raw as Confidence
    return 'medium'
  }
  const src = rawConf && typeof rawConf === 'object' ? rawConf : {}
  return {
    top_category: pick(fields.top_category, src.top_category),
    sub_category: pick(fields.sub_category, src.sub_category),
    item_type:    pick(fields.item_type,    src.item_type),
    brand:        pick(fields.brand,        src.brand),
    condition:    pick(fields.condition,    src.condition),
  }
}

function extractJson(text: string): any | null {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  const start = trimmed.indexOf('{')
  const end   = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(trimmed.slice(start, end + 1)) } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey   = Deno.env.get('ANTHROPIC_API_KEY')
  const anthropicModel = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

  if (!supabaseUrl || !serviceRoleKey || !anonKey) return json(500, { error: 'missing_supabase_env' })
  if (!anthropicKey) return json(500, { error: 'missing_anthropic_key' })

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) return json(401, { error: 'missing_bearer' })

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return json(401, { error: 'invalid_jwt' })
  const userId = userData.user.id

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: any
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  const itemPhoto = body?.item
  if (!itemPhoto || typeof itemPhoto.image_base64 !== 'string' || typeof itemPhoto.mime_type !== 'string') {
    return json(400, { error: 'missing_item_photo' })
  }
  if (!ALLOWED_MIME.has(itemPhoto.mime_type)) return json(415, { error: 'unsupported_mime' })
  const approxBytes = Math.floor(itemPhoto.image_base64.length * 3 / 4)
  if (approxBytes > MAX_BYTES) return json(413, { error: 'image_too_large', bytes: approxBytes })

  const categoryHint: string | undefined =
    typeof body?.category_hint === 'string' && (TOP_CATEGORIES as readonly string[]).includes(body.category_hint)
      ? body.category_hint
      : undefined

  // ── Rate limit ────────────────────────────────────────────────────────────
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    db:   { schema: 'beta' },
  })
  const { data: bumpData, error: bumpErr } = await adminClient.rpc('bump_scan_usage', { p_user_id: userId })
  if (bumpErr) return json(500, { error: 'rate_limit_bump_failed', detail: bumpErr.message })
  const used = Number(bumpData ?? 0)
  if (used > DAILY_LIMIT) return json(429, { error: 'rate_limited', quota: { used, limit: DAILY_LIMIT } })

  // ── Build prompt ──────────────────────────────────────────────────────────
  const taxonomy = buildTaxonomyRef(categoryHint)
  const systemPrompt = BASE_SYSTEM_PROMPT.replace('{TAXONOMY}', taxonomy)

  const hintLine = categoryHint
    ? `The user has indicated this is a "${categoryHint}" item — focus on that category unless the photo clearly shows something else.`
    : 'No category hint was provided — identify the category from the photo.'

  const content: Array<Record<string, unknown>> = [
    {
      type: 'image',
      source: { type: 'base64', media_type: itemPhoto.mime_type, data: itemPhoto.image_base64 },
    },
    {
      type: 'text',
      text: `${hintLine} Identify the item, brand, and condition from the photo. Return JSON only.`,
    },
  ]

  // ── Call Anthropic ────────────────────────────────────────────────────────
  let anthropicResp: Response
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      anthropicModel,
        max_tokens: 400,
        temperature: 0,
        system:     systemPrompt,
        messages:   [{ role: 'user', content }],
      }),
    })
  } catch (e) {
    console.error('scan-item anthropic_fetch_failed', String(e))
    return json(502, { error: 'anthropic_fetch_failed', detail: String(e) })
  }

  if (!anthropicResp.ok) {
    const txt = await anthropicResp.text().catch(() => '')
    console.error('scan-item anthropic_http_error', { status: anthropicResp.status, body: txt.slice(0, 800) })
    return json(502, { error: 'anthropic_http_error', status: anthropicResp.status, detail: txt.slice(0, 500) })
  }

  const anthropicJson = await anthropicResp.json().catch(() => null)
  const text = anthropicJson?.content?.[0]?.text ?? ''
  const parsed = extractJson(text)
  if (!parsed) {
    console.error('scan-item anthropic_bad_json', { raw: text.slice(0, 500) })
    return json(502, { error: 'anthropic_bad_json', raw: text.slice(0, 500) })
  }

  const fields     = coerceFields(parsed)
  const confidence = coerceConfidence(parsed?.confidence, fields)

  return json(200, {
    fields,
    confidence,
    raw: parsed,
    quota: { used, limit: DAILY_LIMIT },
  })
})
