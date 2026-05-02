// send-email-outbox — central dispatcher for queued user-facing emails.
//
// Triggered every minute by a pg_cron job (HTTP POST with shared secret).
// Reads pending rows from beta.email_outbox via the claim_outbox_batch RPC
// (FOR UPDATE SKIP LOCKED for safe concurrent dispatch), renders each email
// based on its template_id, sends via Resend, and marks each row sent or
// failed via mark_outbox_sent / mark_outbox_failed.
//
// Why a single dispatcher (vs one webhook+function per email type):
//   - One function deploy + one secret + one webhook config across the
//     whole email program. Adding a new email is just a new template
//     branch + a trigger or scheduled job that INSERTs into the outbox.
//   - Built-in retry via attempts/max_attempts.
//   - Built-in dedup via partial unique index on dedupe_key.
//   - Time-based scheduling falls out for free (lifecycle emails like D+2
//     just set scheduled_for to two days from now at enqueue time).
//
// Adding a new template:
//   1. Add a render_<id>(payload) function below
//   2. Add the case to the switch in renderTemplate()
//   3. Wherever the email should fire, INSERT into beta.email_outbox
//      (typically via beta.enqueue_email() in a trigger or cron job)
//
// Secrets needed:
//   OUTBOX_DISPATCH_SECRET     — shared with the pg_cron job's HTTP POST
//   RESEND_API_KEY             — Resend bearer
//   SUPABASE_URL               — auto-set by platform
//   SUPABASE_SERVICE_ROLE_KEY  — auto-set, bypasses RLS for outbox access
//   APP_URL                    — defaults to https://sprigloop.com

import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const FROM_ADDRESS = 'Sprigloop <hello@sprigloop.com>'
const REPLY_TO = 'customersupport@sprigloop.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://sprigloop.com'
const BATCH_LIMIT = 50

// ── Type definitions ─────────────────────────────────────────────────────
interface OutboxRow {
  id: string
  template_id: string
  recipient_user_id: string | null
  recipient_email: string
  payload: Record<string, unknown>
  attempts: number
}

interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// ── Constant-time secret comparison ──────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Shared layout helpers ────────────────────────────────────────────────
// Minimal HTML escape for any user-supplied strings interpolated into HTML
// templates (recipient names, item descriptions, etc.).
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Wrap body HTML in the standard Sprigloop email shell — header wordmark
// at top, optional H1 + body, brand footer with About/Contact links.
function shell(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#EDECE5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;">
  <div style="max-width:580px;margin:24px auto;background:#FFF;border-radius:12px;overflow:hidden;">
    <div style="padding:22px 28px 4px;">
      <span style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;">sprigloop</span>
    </div>
${opts.bodyHtml}
    <div style="padding:22px 28px 24px;border-top:1px solid #F1EFE8;margin-top:18px;font-size:12px;color:#888780;line-height:1.55;">
      Sprigloop &middot; Detroit, MI<br>
      <a href="${APP_URL}/about" style="color:#888780;">About Sprigloop</a> &middot; <a href="${APP_URL}/contact" style="color:#888780;">Contact</a>
    </div>
  </div>
</body>
</html>`
}

// ── Templates ────────────────────────────────────────────────────────────
// Each render_<id>(payload) returns { subject, html, text }. Add new
// templates here and route them in renderTemplate() below.

// test_ping — a no-op template used to validate the outbox plumbing
// end-to-end without depending on any other function or trigger.
function render_test_ping(payload: Record<string, unknown>): RenderedEmail {
  const note = (payload.note as string | undefined) || 'Outbox is alive.'
  return {
    subject: 'Sprigloop outbox test ping',
    html: shell({
      title: 'Sprigloop outbox test ping',
      bodyHtml: `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">Outbox test.</h1>
    <div style="padding:0 28px;margin-top:14px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${esc(note)}</p>
      <p style="margin:0;color:#888780;font-size:13px;">If you received this, the outbox + cron + dispatcher chain is working end to end.</p>
    </div>`,
    }),
    text: `Sprigloop outbox test\n\n${note}\n\nIf you received this, the outbox + cron + dispatcher chain is working end to end.`,
  }
}

// renderTemplate — central router. Throws on unknown template_id; the
// dispatcher catches and marks the row 'failed' with the error message.
function renderTemplate(template_id: string, payload: Record<string, unknown>): RenderedEmail {
  switch (template_id) {
    case 'test_ping':
      return render_test_ping(payload)
    // Future templates land here. Each is a render_<id> function above
    // plus a case here.
    default:
      throw new Error(`unknown template_id: ${template_id}`)
  }
}

// ── Send via Resend ──────────────────────────────────────────────────────
async function sendViaResend(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, error: 'resend_not_configured' }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [opts.to],
      reply_to: REPLY_TO,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })

  if (!resp.ok) {
    const detail = await resp.text()
    return { ok: false, error: `resend_${resp.status}: ${detail.slice(0, 500)}` }
  }
  return { ok: true }
}

// ── Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Secret check
  const expected = Deno.env.get('OUTBOX_DISPATCH_SECRET')
  const provided = req.headers.get('x-webhook-secret')
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // Atomically claim a batch
  const { data: claimed, error: claimErr } = await supabase
    .schema('beta')
    .rpc('claim_outbox_batch', { _limit: BATCH_LIMIT })

  if (claimErr) {
    return new Response(
      JSON.stringify({ error: 'claim_failed', detail: claimErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const rows = (claimed ?? []) as OutboxRow[]
  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, claimed: 0, sent: 0, failed: 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let sent = 0
  let failed = 0

  for (const row of rows) {
    let rendered: RenderedEmail
    try {
      rendered = renderTemplate(row.template_id, row.payload)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase.schema('beta').rpc('mark_outbox_failed', { _id: row.id, _error: `render: ${msg}` })
      failed += 1
      continue
    }

    const sendRes = await sendViaResend({
      to: row.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })

    if (!sendRes.ok) {
      await supabase.schema('beta').rpc('mark_outbox_failed', { _id: row.id, _error: sendRes.error })
      failed += 1
      continue
    }

    await supabase.schema('beta').rpc('mark_outbox_sent', { _id: row.id })
    sent += 1
  }

  return new Response(
    JSON.stringify({ ok: true, claimed: rows.length, sent, failed }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
