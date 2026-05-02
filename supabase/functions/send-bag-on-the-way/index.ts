// send-bag-on-the-way — user-facing email that fires when a Sprigloop bag is
// dispatched TO the user. Mirrors notify-bag-request structurally:
//   - Triggered by a Supabase Database Webhook (configured in Studio per env)
//   - Webhook event filtered to UPDATE on beta.pass_along_batches where the
//     `status` column transitions to 'bag_in_transit'
//   - Secret-verified via `x-webhook-secret` header against
//     BAG_ON_THE_WAY_WEBHOOK_SECRET
//   - Service-role Supabase client (no user JWT — webhook context)
//   - At-least-once semantics; no per-row dedup. The status state machine
//     means each batch only enters bag_in_transit once via the auto-advance
//     trigger, so duplicate fires require the trigger to misbehave or a
//     manual UPDATE oscillation. Acceptable risk per notify-bag-request
//     precedent.
//
// What it sends:
//   Email #14 in the journey program. "Your Sprigloop bag is on the way."
//   Personalized with: user first name, item count in the batch, recipient
//   label (the name for person/charity destinations; "another Sprigloop
//   family" for the family destination — sender never sees other households'
//   names for privacy).
//
// Trigger source — `advance_batch_on_bag_dispatched()` in migration #019:
//   When Chris resolves a concierge_tasks row with task_type='bag_request',
//   the trigger updates pass_along_batches.status to 'bag_in_transit' and
//   stamps bag_dispatched_at. The Database Webhook on UPDATE catches that
//   transition and POSTs here.
//
// Secrets needed (set via `supabase secrets set`):
//   BAG_ON_THE_WAY_WEBHOOK_SECRET  — shared with the webhook config in Studio
//   RESEND_API_KEY                 — already set, shared across email funcs
//   SUPABASE_URL                   — auto-set by the platform
//   SUPABASE_SERVICE_ROLE_KEY      — auto-set by the platform
//   APP_URL                        — defaults to https://sprigloop.com

import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const FROM_ADDRESS = 'Sprigloop <hello@sprigloop.com>'
const REPLY_TO = 'customersupport@sprigloop.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://sprigloop.com'

// ── Webhook payload shape ────────────────────────────────────────────────
// Supabase Database Webhook sends this envelope on table UPDATE. We only
// look at the post-update record + verify the schema/table to be defensive.
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: BatchRow | null
  old_record: BatchRow | null
}

interface BatchRow {
  id: string
  household_id: string
  created_by: string | null
  reference_code: string
  destination_type: 'littleloop' | 'family' | 'person' | 'charity'
  recipient_name: string | null
  recipient_address: string | null
  status: string
  bag_dispatched_at: string | null
  created_at: string
}

// ── Constant-time secret comparison (mirrors notify-bag-request) ─────────
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Recipient label by destination type ──────────────────────────────────
// 'family' destinations never expose the receiving household's identity to
// the sender — privacy contract. person/charity destinations carry the name
// the user themselves typed in.
function recipientLabel(row: BatchRow): string {
  switch (row.destination_type) {
    case 'family':
    case 'littleloop':
      return 'another Sprigloop family'
    case 'person':
      return row.recipient_name || 'the recipient you chose'
    case 'charity':
      return row.recipient_name || 'the charity you chose'
    default:
      return 'the recipient'
  }
}

// ── Email rendering ──────────────────────────────────────────────────────
function renderHtml(opts: {
  firstName: string | null
  itemCount: number
  recipient: string
  bagUrl: string
}): string {
  const greeting = opts.firstName ? `${opts.firstName},` : 'Hi,'
  const itemNoun = opts.itemCount === 1 ? 'item' : 'items'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Sprigloop bag is on the way</title>
</head>
<body style="margin:0;padding:0;background:#EDECE5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;">
  <div style="max-width:580px;margin:24px auto;background:#FFF;border-radius:12px;overflow:hidden;">
    <div style="padding:22px 28px 4px;">
      <span style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;">sprigloop</span>
    </div>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">Your bag is on the <em style="font-style:italic;color:#1D9E75;">way</em>.</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting} I just shipped you a Sprigloop bag for your ${opts.itemCount} ${itemNoun}, headed to ${escape(opts.recipient)}. Should arrive in the next few days.</p>
    </div>
    <p style="font-family:'Fraunces',Georgia,serif;font-size:14px;font-weight:500;color:#085041;letter-spacing:0.04em;text-transform:uppercase;padding:18px 28px 4px;margin:0;">When it gets here</p>
    <div style="padding:8px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 6px;color:#2C2C2A;font-weight:500;">1. Fill the bag.</p>
      <p style="margin:0 0 14px;">All the items you flagged for pass-along. The bag fits a stack — no need to fold tight.</p>
      <p style="margin:0 0 6px;color:#2C2C2A;font-weight:500;">2. Write the address on it.</p>
      <p style="margin:0 0 14px;">There's a space on the front of the bag for the recipient's address. You'll see it in the app too.</p>
      <p style="margin:0 0 6px;color:#2C2C2A;font-weight:500;">3. Drop it in any mailbox.</p>
      <p style="margin:0 0 14px;">Postage is already on the bag. Blue box, post office counter, mail carrier pickup — whatever's easiest.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${opts.bagUrl}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Open this bag in Sprigloop</a>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">I'll let you know when it lands at ${escape(opts.recipient)}.</p>
      <p style="margin:0;">— Chris</p>
    </div>
    <div style="padding:22px 28px 24px;border-top:1px solid #F1EFE8;margin-top:18px;font-size:12px;color:#888780;line-height:1.55;">
      Sprigloop &middot; Detroit, MI<br>
      <a href="${APP_URL}/about" style="color:#888780;">About Sprigloop</a> &middot; <a href="${APP_URL}/contact" style="color:#888780;">Contact</a>
    </div>
  </div>
</body>
</html>`
}

function renderText(opts: {
  firstName: string | null
  itemCount: number
  recipient: string
  bagUrl: string
}): string {
  const greeting = opts.firstName ? `${opts.firstName},` : 'Hi,'
  const itemNoun = opts.itemCount === 1 ? 'item' : 'items'
  return [
    `Your Sprigloop bag is on the way.`,
    ``,
    `${greeting} I just shipped you a Sprigloop bag for your ${opts.itemCount} ${itemNoun}, headed to ${opts.recipient}. Should arrive in the next few days.`,
    ``,
    `When it gets here:`,
    `  1. Fill the bag with the items you flagged for pass-along.`,
    `  2. Write the address on the front of the bag — also visible in the app.`,
    `  3. Drop it in any mailbox. Postage is already on it.`,
    ``,
    `Open this bag: ${opts.bagUrl}`,
    ``,
    `I'll let you know when it lands at ${opts.recipient}.`,
    `— Chris`,
    ``,
    `—`,
    `Sprigloop · Detroit, MI`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].join('\n')
}

// Minimal HTML escape for user-supplied recipient strings (person + charity
// names typed in by the user). Belt and suspenders against an injected
// recipient_name like `<script>` or `"`.
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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

  // Secret verification
  const expected = Deno.env.get('BAG_ON_THE_WAY_WEBHOOK_SECRET')
  const provided = req.headers.get('x-webhook-secret')
  if (!expected || !provided || !safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Defensive payload validation. Webhook is configured to filter to UPDATE
  // on beta.pass_along_batches where status changes to bag_in_transit, but
  // re-check here so a misconfigured webhook doesn't fire spurious emails.
  if (payload.type !== 'UPDATE' || payload.table !== 'pass_along_batches') {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'wrong_event' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const row = payload.record
  const old = payload.old_record
  if (!row || row.status !== 'bag_in_transit') {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'wrong_status' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  // Only fire on TRANSITION into bag_in_transit, not on every UPDATE while
  // the row is already in that state. Filters out idempotent re-saves.
  if (old && old.status === 'bag_in_transit') {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'no_transition' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  if (!row.created_by) {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'no_creator' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Service-role client for cross-schema reads (auth.users + beta.*)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // Resolve recipient (the user who created the batch — this is who we email)
  const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(row.created_by)
  if (userErr || !userRes?.user?.email) {
    return new Response(
      JSON.stringify({ error: 'user_lookup_failed', detail: userErr?.message ?? 'no_email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const userEmail = userRes.user.email
  const firstName = (userRes.user.user_metadata?.name as string | undefined)?.split(' ')[0] ?? null

  // Item count for this batch
  const { count: itemCount, error: countErr } = await supabase
    .schema('beta')
    .from('clothing_items')
    .select('id', { count: 'exact', head: true })
    .eq('pass_along_batch_id', row.id)
  if (countErr) {
    return new Response(
      JSON.stringify({ error: 'item_count_failed', detail: countErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const recipient = recipientLabel(row)
  const bagUrl = `${APP_URL}/pass-along/${row.id}`
  const subject = 'Your Sprigloop bag is on the way'
  const html = renderHtml({ firstName, itemCount: itemCount ?? 0, recipient, bagUrl })
  const text = renderText({ firstName, itemCount: itemCount ?? 0, recipient, bagUrl })

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(
      JSON.stringify({ error: 'resend_not_configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [userEmail],
      reply_to: REPLY_TO,
      subject,
      html,
      text,
    }),
  })

  if (!resendResp.ok) {
    const detail = await resendResp.text()
    return new Response(
      JSON.stringify({ error: 'resend_failed', status: resendResp.status, detail }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ ok: true, sent: true, batch_id: row.id, recipient_email: userEmail }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
