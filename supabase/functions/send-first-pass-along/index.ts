// send-first-pass-along — celebration email when a household completes their
// FIRST fulfilled pass-along batch. Email #17 in the journey program.
//
// Triggered by a Supabase Database Webhook on UPDATE to beta.pass_along_batches
// where the `status` column transitions to 'fulfilled'. The function checks
// that this is the household's first fulfilled batch before sending — every
// subsequent fulfilled batch is silent. The email is a short founder note
// from Chris, intended as a one-time acknowledgment of the loop closing.
//
// Structurally mirrors send-bag-on-the-way:
//   - Secret-verified via `x-webhook-secret` against
//     FIRST_PASS_ALONG_WEBHOOK_SECRET
//   - Service-role Supabase client (no user JWT — webhook context)
//   - Resend POST from hello@sprigloop.com to the batch creator
//
// "First" detection: COUNT(*) of fulfilled batches in the same household.
// If exactly 1 (this very batch), it's the first → send. If >1, an earlier
// fulfilled batch exists → skip. At-least-once webhook semantics mean a
// rare duplicate fire could re-send, accepted per notify-bag-request
// precedent. Hardening against duplicates would need a sent_log column or
// table, deferred until it actually causes a complaint.
//
// Secrets needed (set via `supabase secrets set`):
//   FIRST_PASS_ALONG_WEBHOOK_SECRET — shared with the webhook config in Studio
//   RESEND_API_KEY                  — already set, shared across email funcs
//   SUPABASE_URL                    — auto-set by the platform
//   SUPABASE_SERVICE_ROLE_KEY       — auto-set by the platform
//   APP_URL                         — defaults to https://sprigloop.com

import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

const FROM_ADDRESS = 'Sprigloop <hello@sprigloop.com>'
const REPLY_TO = 'customersupport@sprigloop.com'
const APP_URL = Deno.env.get('APP_URL') || 'https://sprigloop.com'

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
  status: string
  fulfilled_at: string | null
  created_at: string
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ── Email rendering ──────────────────────────────────────────────────────
// Voice from the v2 mockup: short, founder-direct, not a manufactured
// celebration card. Item count personalizes the "you broke that loop for N
// items" line. No CTA — the email is a one-time acknowledgment, not a hook.
function renderHtml(opts: { firstName: string | null; itemCount: number }): string {
  const greeting = opts.firstName ? `${opts.firstName},` : 'Hi,'
  const itemNoun = opts.itemCount === 1 ? 'item' : 'items'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>First bundle out the door. That's huge.</title>
</head>
<body style="margin:0;padding:0;background:#EDECE5;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;">
  <div style="max-width:580px;margin:24px auto;background:#FFF;border-radius:12px;overflow:hidden;">
    <div style="padding:22px 28px 4px;">
      <span style="font-family:'Fraunces',Georgia,serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;">sprigloop</span>
    </div>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">First bundle out the <em style="font-style:italic;color:#1D9E75;">door</em>.</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 12px;">Most baby clothing exists for about three months and then sits in a bin in someone's basement for years. The math is brutal.</p>
      <p style="margin:0 0 12px;">You just broke that loop for ${opts.itemCount} ${itemNoun}. They're in active use again, in another Sprigloop family.</p>
      <p style="margin:0 0 12px;">That's the whole thing. That's what Sprigloop is for. Thanks for being one of the first parents to actually do it.</p>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0;">— Chris<br><span style="color:#888780;font-size:13px;">Founder, Sprigloop</span></p>
    </div>
    <div style="padding:22px 28px 24px;border-top:1px solid #F1EFE8;margin-top:18px;font-size:12px;color:#888780;line-height:1.55;">
      One-time note &middot; only sent on your first bundle<br>
      <a href="${APP_URL}/about" style="color:#888780;">About Sprigloop</a> &middot; <a href="${APP_URL}/contact" style="color:#888780;">Contact</a>
    </div>
  </div>
</body>
</html>`
}

function renderText(opts: { firstName: string | null; itemCount: number }): string {
  const greeting = opts.firstName ? `${opts.firstName},` : 'Hi,'
  const itemNoun = opts.itemCount === 1 ? 'item' : 'items'
  return [
    `First bundle out the door.`,
    ``,
    `${greeting}`,
    ``,
    `Most baby clothing exists for about three months and then sits in a bin in someone's basement for years. The math is brutal.`,
    ``,
    `You just broke that loop for ${opts.itemCount} ${itemNoun}. They're in active use again, in another Sprigloop family.`,
    ``,
    `That's the whole thing. That's what Sprigloop is for. Thanks for being one of the first parents to actually do it.`,
    ``,
    `— Chris`,
    `Founder, Sprigloop`,
    ``,
    `—`,
    `One-time note · only sent on your first bundle`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].join('\n')
}

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
  const expected = Deno.env.get('FIRST_PASS_ALONG_WEBHOOK_SECRET')
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
  // on beta.pass_along_batches with status='fulfilled', but we re-check.
  if (payload.type !== 'UPDATE' || payload.table !== 'pass_along_batches') {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'wrong_event' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const row = payload.record
  const old = payload.old_record
  if (!row || row.status !== 'fulfilled') {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'wrong_status' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  // Only on TRANSITION into fulfilled, not idempotent re-saves.
  if (old && old.status === 'fulfilled') {
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  // ── First-batch check ───────────────────────────────────────────────
  // Count fulfilled batches in this household. If exactly 1, the row that
  // just transitioned IS the first — send. If >1, an earlier fulfilled
  // batch exists, skip. Note: at this point the row has already been UPDATE'd
  // to 'fulfilled' so it's included in the count.
  const { count: fulfilledCount, error: countErr } = await supabase
    .schema('beta')
    .from('pass_along_batches')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', row.household_id)
    .eq('status', 'fulfilled')
  if (countErr) {
    return new Response(
      JSON.stringify({ error: 'first_check_failed', detail: countErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  if ((fulfilledCount ?? 0) !== 1) {
    return new Response(
      JSON.stringify({ ok: true, sent: false, reason: 'not_first_fulfilled', count: fulfilledCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ── Recipient + personalization ─────────────────────────────────────
  const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(row.created_by)
  if (userErr || !userRes?.user?.email) {
    return new Response(
      JSON.stringify({ error: 'user_lookup_failed', detail: userErr?.message ?? 'no_email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  const userEmail = userRes.user.email
  const firstName = (userRes.user.user_metadata?.name as string | undefined)?.split(' ')[0] ?? null

  const { count: itemCount, error: itemCountErr } = await supabase
    .schema('beta')
    .from('clothing_items')
    .select('id', { count: 'exact', head: true })
    .eq('pass_along_batch_id', row.id)
  if (itemCountErr) {
    return new Response(
      JSON.stringify({ error: 'item_count_failed', detail: itemCountErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const subject = "First bundle out the door. That's huge."
  const html = renderHtml({ firstName, itemCount: itemCount ?? 0 })
  const text = renderText({ firstName, itemCount: itemCount ?? 0 })

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
