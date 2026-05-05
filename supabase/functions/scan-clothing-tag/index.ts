// ============================================================================
// scan-clothing-tag — Phase 1 photo-scan Edge Function
// ============================================================================
// Accepts up to two base64-encoded images per item — a hangtag close-up
// (best source for brand + size) and a wider garment shot (best source for
// category + item_type). Either may be missing; at least one is required.
// Asks Claude Haiku to extract inventory fields and returns them as a JSON
// payload for the client to drop into the AddItem form.
//
// Shape of request body (current, two-photo):
//   {
//     "tag":     { "image_base64": "<base64>", "mime_type": "image/jpeg" } | null,
//     "garment": { "image_base64": "<base64>", "mime_type": "image/jpeg" } | null
//   }
//
// Legacy shape still accepted for back-compat (any cached client tab still
// in flight when the new edge bundle deploys):
//   {
//     "image_base64": "<base64>",
//     "mime_type":    "image/jpeg"
//   }
// Treated as a tag-only payload — the legacy single image had a tag-shaped
// guide and was tag-focused, so this preserves the prior calibration.
//
// Shape of success response (200):
//   {
//     "fields": {
//       "brand":      string | null,
//       "size_label": "0-3M" | "3-6M" | "6-9M" | "9-12M" | "12-18M" | "18-24M" | null,
//       "category":   <CATEGORY enum> | null,
//       "item_type":  <SLOT_ID enum>   | null,
//       "season":     "warm_weather" | "cold_weather" | "all_season" | null
//     },
//     "confidence": {
//       "brand":      "high" | "medium" | "low" | null,
//       "size_label": "high" | "medium" | "low" | null,
//       "category":   "high" | "medium" | "low" | null,
//       "item_type":  "high" | "medium" | "low" | null,
//       "season":     "high" | "medium" | "low" | null
//     },
//     "raw": <the model's raw JSON, for debugging — may be dropped later>,
//     "quota": { "used": number, "limit": number }
//   }
//   (confidence for a given field is null iff its field value is null.)
//
// Failure codes:
//   401 missing/invalid JWT
//   413 image too large (>2 MB decoded)
//   415 unsupported mime type
//   429 rate limit exceeded for today
//   500 upstream model error / config error
//
// The key security invariants:
//   - ANTHROPIC_API_KEY is read from Deno.env (set via `supabase secrets set`)
//     and never reaches the client.
//   - Rate-limit bump uses service_role. The Edge Function is the only caller.
//   - JWT is verified by constructing a Supabase client with the user's bearer
//     token and asking it for the user; if that fails the request is rejected
//     before any paid API call.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const DAILY_LIMIT = Number(Deno.env.get('SCAN_DAILY_LIMIT') ?? 50)
const MAX_BYTES   = 2 * 1024 * 1024 // 2 MB decoded cap
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

// These enums must stay in sync with src/screens/AddItem.jsx (CATEGORIES,
// SIZES) and src/lib/wardrobe.js (SLOTS). Duplicated here rather than
// imported because Edge Functions can't pull from the Vite src tree.
const CATEGORIES = [
  'tops_and_bodysuits',
  'one_pieces',
  'bottoms',
  'dresses_and_skirts',
  'outerwear',
  'sleepwear',
  'footwear',
  'accessories',
  'swimwear',
] as const

const SIZES = ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'] as const

// Season axis matches the frontend post-migration-035: warm/cold/all,
// not the original spring/summer/fall/winter four-seasons. The garment
// photo (when present) is the right signal for this — sleeve length,
// fabric weight, exposure to weather. We deliberately keep this
// short-list small so the model isn't picking between "early fall" and
// "late fall" type distinctions that don't matter for parenting.
const SEASONS = ['warm_weather', 'cold_weather', 'all_season'] as const

// Must stay in sync with SLOTS in src/lib/wardrobe.js. The Tier 1 + Tier 2
// taxonomy expansion (migration 036, 2026-05-05) split overloaded slots
// (pajamas → footed/2-piece/sleep_gowns; hats → warm/sun; jackets →
// light/winter/snowsuits) and added bottoms/footwear/accessories rows
// (sweaters, overalls, boots, hair_accessories).
const SLOT_IDS = [
  'bodysuits', 'day_tops', 'sweaters',
  'one_pieces',
  'shorts', 'pants_leggings', 'overalls',
  'dresses',
  'sleep_sacks', 'footed_pajamas', 'two_piece_pajamas', 'sleep_gowns',
  'rain_gear', 'light_jackets', 'winter_coats', 'snowsuits',
  'socks', 'shoes', 'boots',
  'warm_hats', 'sun_hats', 'mittens', 'bibs', 'burp_cloths', 'hair_accessories',
  'swimwear',
] as const

// Prompt is tuned for a 1-or-2 image → JSON extraction task. The user
// message will declare which images are present and which role each plays
// (a hangtag close-up vs. a wider garment shot), so this system prompt
// stays role-agnostic and focuses on the field rules + enums + null-over-
// guess discipline. Everything we ask for is present somewhere across the
// pair: brand and size live on the tag; category and item_type live on
// the visible garment.
const SYSTEM_PROMPT = `You are extracting structured inventory fields from one or two photos of a baby clothing item.

When two images are provided, the first is a close-up of the hangtag (use it as the primary source for brand and size_label) and the second is a wider shot of the whole garment (use it as the primary source for category and item_type). Either image may be missing; the user message will tell you which.

Return ONLY a single JSON object with these keys:
- brand: the brand name EXACTLY as printed on the tag, transcribed letter-by-letter from what you see in the image. CRITICAL: do not "correct" or "normalize" an unfamiliar brand name to a more common one. If the tag says "Pekkle", return "Pekkle" — not "Pampers" or any other similar-looking brand you may know. If the tag says "Gerber" return "Gerber". If you cannot confidently read the brand text from the image, return null. NEVER substitute a brand from your prior knowledge of common baby brands for what is actually printed. The user's small, indie, or store-label brands matter just as much as the big-name ones, and getting them wrong is worse than returning null.
- size_label: one of ${SIZES.map(s => `"${s}"`).join(', ')}, mapped from what the tag says (e.g. "3M" or "3 months" → "0-3M"; "6M" or "6 months" → "3-6M"; "9M" or "9 months" → "6-9M"; "12M" or "12 months" → "9-12M"; "18M" → "12-18M"; "24M" or "2T" → "18-24M"). If the tag shows a range that spans two bands, pick the lower one. Use null if no size is readable.
- category: one of ${CATEGORIES.map(c => `"${c}"`).join(', ')}, inferred from the garment visible in the image. Use null if you can't tell.
- item_type: one of ${SLOT_IDS.map(s => `"${s}"`).join(', ')}, the most specific slot that fits. Must be consistent with the chosen category. Use null if unsure.
- season: one of ${SEASONS.map(s => `"${s}"`).join(', ')}, inferred from the visible garment (sleeve length, fabric weight, lining, layering, exposure to weather). Use the wider garment shot for this if it's available; the close-up tag photo usually doesn't give enough garment context. Rules of thumb:
  - "warm_weather": short sleeves, thin lightweight cotton, shorts, sleeveless, summer hats, swim things, sandals.
  - "cold_weather": long sleeves with heavy fabric (fleece, sherpa, knit), padded jackets, snowsuits, winter hats and mittens, boots, lined sleepers.
  - "all_season": items genuinely worn year-round — basic socks, plain bibs, burp cloths, indoor sleep sacks, plain bodysuits worn under or alone depending on season.
  Use null when you only have a tag photo, when the fabric weight is ambiguous, or when the garment isn't clearly visible. Don't guess between warm and cold from light visual cues alone.

Descriptor hints for baby clothing terminology (these words are used colloquially in infant apparel, not literally):
- "ONESIE" or "BODYSUIT" → category "tops_and_bodysuits", item_type "bodysuits". A onesie in baby clothing is a snap-crotch short-sleeve top, not a full-body one-piece.
- "COVERALL" or "ROMPER" → category "one_pieces", item_type "one_pieces". A baby coverall is a romper-style one-piece garment, not adult workwear or rain-gear.
- "SLEEPER" → category "sleepwear", item_type "footed_pajamas". A sleeper is a one-piece zippered or snapped pajama with built-in feet.
- "PAJAMAS" → category "sleepwear". Pick the subtype: "footed_pajamas" if it's a one-piece with feet, "two_piece_pajamas" if you can see a separate top + bottom, "sleep_gowns" if the bottom is open (newborn nightgown). Default to "footed_pajamas" when the garment isn't visible enough to tell.
- "NIGHTGOWN" or "SLEEP GOWN" → category "sleepwear", item_type "sleep_gowns". Open at the bottom for diaper changes.
- "BOOTIES" → category "footwear", item_type "shoes". Soft-soled pre-walking footwear.
- "BOOT" or "RAIN BOOT" or "SNOW BOOT" → category "footwear", item_type "boots". Tall hard-soled.
- "SOCKS" → category "footwear", item_type "socks". Socks belong in footwear in this taxonomy, not accessories — accessories is reserved for hats, mittens, bibs, burp cloths, and hair accessories.
- "BEANIE" or "KNIT CAP" or "WINTER HAT" → category "accessories", item_type "warm_hats".
- "SUN HAT" or "BUCKET HAT" or "BASEBALL CAP" → category "accessories", item_type "sun_hats". Baseball caps belong here for babies — they're sun-protection, not fashion.
- "HEADBAND" or "BOW" or "HAIR CLIP" → category "accessories", item_type "hair_accessories".
- "JACKET" → category "outerwear". Pick the subtype: "light_jackets" for spring/fall (denim, fleece, windbreaker), "winter_coats" for heavy padded/parka/puffer, "rain_gear" for rain-specific, "snowsuits" for one-piece bunting. Default to "light_jackets" when fabric weight is ambiguous.
- "SNOWSUIT" or "BUNTING" → category "outerwear", item_type "snowsuits".
- "SWEATER" or "CARDIGAN" or "HOODIE" or "FLEECE PULLOVER" → category "tops_and_bodysuits", item_type "sweaters". Worn as indoor layers; outerwear-style fleece JACKETS go to "light_jackets".
- "OVERALLS" or "DUNGAREES" or "BIB PANTS" → category "bottoms", item_type "overalls". Functionally a bottom-with-bib (worn over a top), not a one-piece garment.

Alongside the four field keys, return a fifth key "confidence" — an object with a confidence level per field, used by the client to flag which values the parent should double-check before saving:
- "high" — clearly printed on the tag and unambiguous (e.g. brand logo visible; size explicitly written as "0-3M").
- "medium" — readable but required interpretation (e.g. "3M" mapped to "0-3M"; category inferred from the garment visible behind the tag rather than the tag itself).
- "low" — a best guess from limited information (partial text, blurry tag, inferring item_type from an unclear silhouette). If you used "low" for brand, you should probably have returned null instead — only use "low" for brand if the text is partially readable AND you transcribed the partial letters literally.
- If a field value is null, its confidence must also be null.

Example shape (values are placeholders to show the format — do NOT pattern-match to "ExampleBrand" or assume real responses look like this):
{"brand":"ExampleBrand","size_label":"0-3M","category":"tops_and_bodysuits","item_type":"bodysuits","season":"warm_weather","confidence":{"brand":"high","size_label":"medium","category":"high","item_type":"high","season":"medium"}}

Do not include any prose, markdown, or code fences. Return the JSON object and nothing else. Prefer null over a low-confidence guess. For brand specifically: prefer null over a guess at a similar-looking common brand.`

type Fields = {
  brand: string | null
  size_label: string | null
  category: string | null
  item_type: string | null
  season: string | null
}

type Confidence = 'high' | 'medium' | 'low' | null

type ConfidenceMap = {
  brand:      Confidence
  size_label: Confidence
  category:   Confidence
  item_type:  Confidence
  season:     Confidence
}

const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low'])

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function coerceFields(raw: any): Fields {
  const brand      = typeof raw?.brand      === 'string' && raw.brand.trim()      ? raw.brand.trim().slice(0, 80) : null
  const size_label = typeof raw?.size_label === 'string' && (SIZES as readonly string[]).includes(raw.size_label) ? raw.size_label : null
  const category   = typeof raw?.category   === 'string' && (CATEGORIES as readonly string[]).includes(raw.category) ? raw.category : null
  const item_type  = typeof raw?.item_type  === 'string' && (SLOT_IDS as readonly string[]).includes(raw.item_type) ? raw.item_type : null
  const season     = typeof raw?.season     === 'string' && (SEASONS as readonly string[]).includes(raw.season) ? raw.season : null
  return { brand, size_label, category, item_type, season }
}

// Whitelist confidence values and force the "null value ⇒ null confidence"
// invariant regardless of what the model returned. If the model omits a
// confidence for a present field we default to "medium" (safer than
// optimistically calling it "high" and never flagging for review).
function coerceConfidence(rawConfidence: any, fields: Fields): ConfidenceMap {
  function pick(fieldValue: unknown, raw: unknown): Confidence {
    if (fieldValue === null || fieldValue === undefined || fieldValue === '') return null
    if (typeof raw === 'string' && CONFIDENCE_LEVELS.has(raw)) return raw as Confidence
    return 'medium'
  }
  const src = rawConfidence && typeof rawConfidence === 'object' ? rawConfidence : {}
  return {
    brand:      pick(fields.brand,      src.brand),
    size_label: pick(fields.size_label, src.size_label),
    category:   pick(fields.category,   src.category),
    item_type:  pick(fields.item_type,  src.item_type),
    season:     pick(fields.season,     src.season),
  }
}

// Extract the first {...} block from model text. Haiku usually returns bare
// JSON per the prompt, but we defend against fences / surrounding whitespace
// so one bad response doesn't burn a quota slot AND surface as a 500.
function extractJson(text: string): any | null {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  const start = trimmed.indexOf('{')
  const end   = trimmed.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try { return JSON.parse(trimmed.slice(start, end + 1)) } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const supabaseUrl        = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey            = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicKey       = Deno.env.get('ANTHROPIC_API_KEY')
  const anthropicModel     = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001'

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(500, { error: 'missing_supabase_env' })
  }
  if (!anthropicKey) {
    return json(500, { error: 'missing_anthropic_key' })
  }

  // ── Auth: resolve the caller from the bearer token ────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return json(401, { error: 'missing_bearer' })
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return json(401, { error: 'invalid_jwt' })
  }
  const userId = userData.user.id

  // ── Body ──────────────────────────────────────────────────────────────
  // Two intake shapes are accepted (see header comment):
  //   1. Current: { tag?: {image_base64, mime_type}, garment?: {image_base64, mime_type} }
  //   2. Legacy:  { image_base64, mime_type }   → treated as tag-only
  // At least one image must be present. Each is validated independently
  // for mime + size; both are billed as one rate-limit slot since they
  // map to a single Anthropic call.
  let body: any
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  type Photo = { image_base64: string; mime_type: string }
  function readPhoto(raw: any): Photo | null {
    if (!raw || typeof raw !== 'object') return null
    const b64  = typeof raw.image_base64 === 'string' ? raw.image_base64 : ''
    const m    = typeof raw.mime_type    === 'string' ? raw.mime_type    : ''
    if (!b64 || !m) return null
    return { image_base64: b64, mime_type: m }
  }

  let tag     = readPhoto(body?.tag)
  let garment = readPhoto(body?.garment)

  // Legacy single-image shape — flatten it into the tag slot. The pre-
  // refactor camera UI was tag-focused, so this matches calibration.
  if (!tag && !garment && typeof body?.image_base64 === 'string' && typeof body?.mime_type === 'string') {
    tag = { image_base64: body.image_base64, mime_type: body.mime_type }
  }

  if (!tag && !garment) return json(400, { error: 'missing_image_base64' })

  // Validate every supplied photo independently. Surface the first
  // failure rather than batching — the client only needs one signal to
  // surface a fix-and-retry message, and the user took these photos
  // sequentially so they know which one they just shot.
  for (const [label, photo] of [['tag', tag], ['garment', garment]] as const) {
    if (!photo) continue
    if (!ALLOWED_MIME.has(photo.mime_type)) {
      return json(415, { error: 'unsupported_mime', which: label })
    }
    // base64 decoded size ≈ length * 3/4. Cheaper than actually decoding.
    const approxBytes = Math.floor(photo.image_base64.length * 3 / 4)
    if (approxBytes > MAX_BYTES) {
      return json(413, { error: 'image_too_large', which: label, bytes: approxBytes })
    }
  }

  // ── Rate limit (service_role) ─────────────────────────────────────────
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    db:   { schema: 'beta' },
  })

  const { data: bumpData, error: bumpErr } = await adminClient.rpc('bump_scan_usage', { p_user_id: userId })
  if (bumpErr) {
    return json(500, { error: 'rate_limit_bump_failed', detail: bumpErr.message })
  }
  const used = Number(bumpData ?? 0)
  if (used > DAILY_LIMIT) {
    return json(429, { error: 'rate_limited', quota: { used, limit: DAILY_LIMIT } })
  }

  // ── Call Anthropic ────────────────────────────────────────────────────
  // Temperature 0 for extraction. The default of 1.0 was causing the model
  // to "creatively" substitute unfamiliar brand names with similar-looking
  // common ones (a parent reported "Pekkle" coming back as "Pampers").
  // Extraction tasks should be deterministic — we want the same JSON for
  // the same image, every time.
  //
  // Build the user-message content array in role order: tag first if
  // present, garment second if present. The text instruction declares
  // which images are present so the model can lean on the right source
  // for each field. If only one is present we say so explicitly rather
  // than letting the model guess at roles.
  const content: Array<Record<string, unknown>> = []
  const presence: string[] = []
  if (tag) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: tag.mime_type, data: tag.image_base64 },
    })
    presence.push('a hangtag close-up (image 1) — primary source for brand and size_label')
  }
  if (garment) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: garment.mime_type, data: garment.image_base64 },
    })
    presence.push(
      `a wider garment shot (image ${tag ? 2 : 1}) — primary source for category and item_type`,
    )
  }
  const presenceLine = presence.length === 2
    ? `You have ${presence[0]} and ${presence[1]}.`
    : `You have only ${presence[0]}. Set fields you can't infer to null rather than guessing.`

  content.push({
    type: 'text',
    text:
      `${presenceLine} Extract the fields per the system instructions. Return JSON only. ` +
      `For the brand, transcribe what you see on the tag literally — do not substitute a ` +
      `more familiar brand name.`,
  })

  const anthropicBody = {
    model: anthropicModel,
    max_tokens: 400,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  }

  let anthropicResp: Response
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':      'application/json',
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })
  } catch (e) {
    console.error('scan-clothing-tag anthropic_fetch_failed', String(e))
    return json(502, { error: 'anthropic_fetch_failed', detail: String(e) })
  }

  if (!anthropicResp.ok) {
    const txt = await anthropicResp.text().catch(() => '')
    // Log before returning so the detail lands in Supabase's Logs pane too
    // (the HTTP response body already carries it, but logs give us a
    // persistent record when the tester can't paste the in-app detail).
    console.error('scan-clothing-tag anthropic_http_error', {
      status: anthropicResp.status,
      model: anthropicModel,
      body: txt.slice(0, 800),
    })
    return json(502, { error: 'anthropic_http_error', status: anthropicResp.status, detail: txt.slice(0, 500) })
  }

  const anthropicJson = await anthropicResp.json().catch(() => null)
  const text = anthropicJson?.content?.[0]?.text ?? ''
  const parsed = extractJson(text)
  if (!parsed) {
    console.error('scan-clothing-tag anthropic_bad_json', { raw: text.slice(0, 500) })
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
