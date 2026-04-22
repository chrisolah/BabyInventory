// ============================================================================
// scan-clothing-tag — Phase 1 photo-scan Edge Function
// ============================================================================
// Accepts a base64-encoded image of a clothing tag (or garment with tag in
// frame), asks Claude Haiku to extract inventory fields, returns them as a
// JSON payload for the client to drop into the AddItem form.
//
// Shape of request body:
//   {
//     "image_base64": "<raw base64, no data: URL prefix>",
//     "mime_type":    "image/jpeg" | "image/png" | "image/webp"
//   }
//
// Shape of success response (200):
//   {
//     "fields": {
//       "brand":      string | null,
//       "size_label": "0-3M" | "3-6M" | "6-9M" | "9-12M" | "12-18M" | "18-24M" | null,
//       "category":   <CATEGORY enum> | null,
//       "item_type":  <SLOT_ID enum>   | null
//     },
//     "raw": <the model's raw JSON, for debugging — may be dropped later>,
//     "quota": { "used": number, "limit": number }
//   }
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

const SLOT_IDS = [
  'bodysuits', 'day_tops',
  'one_pieces',
  'shorts', 'pants_leggings',
  'dresses',
  'sleep_sacks', 'pajamas',
  'rain_gear', 'jackets',
  'socks', 'shoes',
  'hats', 'mittens', 'bibs', 'burp_cloths',
  'swimwear',
] as const

// Prompt is tuned for a single image → JSON extraction task. We tell the
// model exactly which enums are valid and to pick 'null' over guessing.
// Everything we ask for is present on a typical baby-clothing hangtag or
// care label: brand, size, and enough visual context to infer category.
const SYSTEM_PROMPT = `You are extracting structured inventory fields from a photo of a baby clothing item or its tag.

Return ONLY a single JSON object with these keys:
- brand: the brand name as printed on the tag, or null if you cannot read one. Do not invent brands.
- size_label: one of ${SIZES.map(s => `"${s}"`).join(', ')}, mapped from what the tag says (e.g. "3M" or "3 months" → "0-3M"; "6M" or "6 months" → "3-6M"; "9M" or "9 months" → "6-9M"; "12M" or "12 months" → "9-12M"; "18M" → "12-18M"; "24M" or "2T" → "18-24M"). If the tag shows a range that spans two bands, pick the lower one. Use null if no size is readable.
- category: one of ${CATEGORIES.map(c => `"${c}"`).join(', ')}, inferred from the garment visible in the image. Use null if you can't tell.
- item_type: one of ${SLOT_IDS.map(s => `"${s}"`).join(', ')}, the most specific slot that fits. Must be consistent with the chosen category. Use null if unsure.

Do not include any prose, markdown, or code fences. Return the JSON object and nothing else. Prefer null over a low-confidence guess.`

type Fields = {
  brand: string | null
  size_label: string | null
  category: string | null
  item_type: string | null
}

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
  return { brand, size_label, category, item_type }
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
  let body: any
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  const imageB64 = typeof body?.image_base64 === 'string' ? body.image_base64 : ''
  const mime     = typeof body?.mime_type    === 'string' ? body.mime_type    : ''

  if (!imageB64) return json(400, { error: 'missing_image_base64' })
  if (!ALLOWED_MIME.has(mime)) return json(415, { error: 'unsupported_mime' })

  // base64 decoded size ≈ length * 3/4. Cheaper than actually decoding.
  const approxBytes = Math.floor(imageB64.length * 3 / 4)
  if (approxBytes > MAX_BYTES) return json(413, { error: 'image_too_large', bytes: approxBytes })

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
  const anthropicBody = {
    model: anthropicModel,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: imageB64 } },
          { type: 'text',  text: 'Extract the fields per the system instructions. Return JSON only.' },
        ],
      },
    ],
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
    return json(502, { error: 'anthropic_fetch_failed', detail: String(e) })
  }

  if (!anthropicResp.ok) {
    const txt = await anthropicResp.text().catch(() => '')
    return json(502, { error: 'anthropic_http_error', status: anthropicResp.status, detail: txt.slice(0, 500) })
  }

  const anthropicJson = await anthropicResp.json().catch(() => null)
  const text = anthropicJson?.content?.[0]?.text ?? ''
  const parsed = extractJson(text)
  if (!parsed) {
    return json(502, { error: 'anthropic_bad_json', raw: text.slice(0, 500) })
  }

  const fields = coerceFields(parsed)

  return json(200, {
    fields,
    raw: parsed,
    quota: { used, limit: DAILY_LIMIT },
  })
})
