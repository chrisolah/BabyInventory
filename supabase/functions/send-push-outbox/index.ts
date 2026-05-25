// send-push-outbox — APNs push notification dispatcher
// Invoked by pg_cron every minute (same pattern as send-email-outbox).
//
// Required secrets (set via Supabase Dashboard > Edge Functions > Secrets):
//   APNS_KEY_ID       — 10-char key ID from Apple Developer portal
//   APNS_TEAM_ID      — 10-char team ID from Apple Developer portal
//   APNS_PRIVATE_KEY  — contents of the .p8 file (include the header/footer lines)
//   APNS_BUNDLE_ID    — com.sprigloop.app
//   APNS_ENV          — "production" or "sandbox" (use sandbox for TestFlight debug builds)
//
// The function claims up to 50 pending push_outbox rows, looks up the
// recipient's push tokens, and fires one APNs request per token.
// Rows with no registered tokens are silently marked sent (no device = no push).

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APNS_KEY_ID         = Deno.env.get('APNS_KEY_ID')!
const APNS_TEAM_ID        = Deno.env.get('APNS_TEAM_ID')!
const APNS_PRIVATE_KEY    = Deno.env.get('APNS_PRIVATE_KEY')!
const APNS_BUNDLE_ID      = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.sprigloop.app'
const APNS_ENV            = Deno.env.get('APNS_ENV') ?? 'production'

const APNS_HOST = APNS_ENV === 'sandbox'
  ? 'https://api.sandbox.push.apple.com'
  : 'https://api.push.apple.com'

// ── APNs JWT ──────────────────────────────────────────────────────────────
// Token-based auth: sign a JWT with the p8 key using ES256.
// Tokens are valid for up to 1 hour; we generate a fresh one per invocation.

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function buildApnsJwt(): Promise<string> {
  const header  = { alg: 'ES256', kid: APNS_KEY_ID }
  const payload = { iss: APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }

  const enc     = new TextEncoder()
  const hdr64   = base64url(enc.encode(JSON.stringify(header)))
  const pay64   = base64url(enc.encode(JSON.stringify(payload)))
  const sigInput = enc.encode(`${hdr64}.${pay64}`)

  // Strip PEM armor and decode the raw key bytes.
  const pemBody = APNS_PRIVATE_KEY
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    sigInput
  )

  return `${hdr64}.${pay64}.${base64url(sig)}`
}

// ── APNs send ─────────────────────────────────────────────────────────────
async function sendApns(
  jwt: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const url = `${APNS_HOST}/3/device/${token}`
  const apnsPayload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: 'default',
      'mutable-content': 0,
    },
    ...data,
  })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic':     APNS_BUNDLE_ID,
        'apns-push-type': 'alert',
        'apns-priority':  '10',
        'content-type':   'application/json',
      },
      body: apnsPayload,
    })

    if (res.status === 200) return { ok: true }

    // APNs returns a JSON body with a Reason field on failure.
    let reason = `HTTP ${res.status}`
    try {
      const json = await res.json() as { reason?: string }
      if (json.reason) reason = json.reason
    } catch { /* ignore */ }

    return { ok: false, error: reason }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ── Handler ───────────────────────────────────────────────────────────────
Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Claim a batch of pending rows.
  const { data: rows, error: claimErr } = await supabase
    .rpc('claim_push_outbox_batch', { _limit: 50 })

  if (claimErr) {
    console.error('claim_push_outbox_batch error:', claimErr)
    return new Response(JSON.stringify({ error: claimErr.message }), { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, skipped: 0 }), { status: 200 })
  }

  // Build APNs JWT once for the whole batch (valid 1 hour).
  let jwt: string
  try {
    jwt = await buildApnsJwt()
  } catch (err) {
    console.error('APNs JWT build failed:', err)
    return new Response(JSON.stringify({ error: 'JWT build failed' }), { status: 500 })
  }

  let sent = 0, skipped = 0, failed = 0

  for (const row of rows as {
    id: string
    recipient_user_id: string
    title: string
    body: string
    data: Record<string, unknown>
    attempts: number
  }[]) {
    // Look up tokens for this user.
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', row.recipient_user_id)
      .eq('platform', 'ios')

    if (!tokens || tokens.length === 0) {
      // No device registered — mark sent silently.
      await supabase.rpc('mark_push_sent', { _id: row.id })
      skipped++
      continue
    }

    // Send to every registered token (user may have multiple devices).
    let anyOk = false
    let lastError = ''
    for (const { token } of tokens) {
      const result = await sendApns(jwt, token, row.title, row.body, row.data)
      if (result.ok) {
        anyOk = true
      } else {
        lastError = result.error ?? 'unknown'
        console.warn(`APNs failed for token ${token.slice(-8)}: ${lastError}`)
      }
    }

    if (anyOk) {
      await supabase.rpc('mark_push_sent', { _id: row.id })
      sent++
    } else {
      await supabase.rpc('mark_push_failed', { _id: row.id, _error: lastError })
      failed++
    }
  }

  console.log(`push dispatch: sent=${sent} skipped=${skipped} failed=${failed}`)
  return new Response(JSON.stringify({ sent, skipped, failed }), { status: 200 })
})
