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
  // Optional extra headers (List-Unsubscribe, etc.) — only set by templates
  // that need them. Transactional templates leave this undefined.
  headers?: Record<string, string>
}

// Renderers can short-circuit by returning a SkipResult. The dispatcher
// marks the outbox row status='skipped' with the reason as last_error
// (the email_outbox_error_when_failed constraint requires last_error for
// both 'failed' and 'skipped' statuses). Used by lifecycle templates with
// a "send only if condition" gate — d4 invite (skip if co-parent exists),
// d7 snapshot (skip if zero items), d14 re-engagement (skip if active
// recently).
interface SkipResult {
  skip: string
}
type RenderResult = RenderedEmail | SkipResult
function isSkip(r: RenderResult): r is SkipResult {
  return (r as SkipResult).skip !== undefined
}

// Marketing-style emails (lifecycle nudges, recurring digests) MUST set
// these headers per Gmail/Apple Mail bulk-sender requirements. The unsub
// mailto goes to a real address that Resend's automatic suppression list
// also picks up via the One-Click POST contract.
const UNSUB_MAILTO = 'mailto:customersupport@sprigloop.com?subject=Unsubscribe%20from%20Sprigloop'
const LIFECYCLE_HEADERS: Record<string, string> = {
  'List-Unsubscribe': `<${UNSUB_MAILTO}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
}

// Render context passed to async renderers that need DB access
// (lifecycle templates that render conditional content based on the
// recipient's live state). Pure renderers ignore everything except
// payload — see render_test_ping for the pattern.
interface RenderArgs {
  payload: Record<string, unknown>
  recipientUserId: string | null
  // deno-lint-ignore no-explicit-any
  supabase: any
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

// bag_on_the_way — Email #14. Fires when a Sprigloop bag is dispatched TO
// the user (their pass_along_batch enters status 'bag_in_transit'). Migrated
// from a standalone send-bag-on-the-way function 2026-05-04.
//
// Payload (built by beta.enqueue_bag_on_the_way trigger):
//   first_name        — user's first name, or null
//   item_count        — items in this batch
//   recipient_label   — pre-resolved (e.g. "another Sprigloop family", or
//                       the recipient name typed in for person/charity)
//   bag_url           — deep link into the app for this bag
//   batch_id          — pass_along_batches.id (for diagnostics only)
function render_bag_on_the_way(payload: Record<string, unknown>): RenderedEmail {
  const firstName = (payload.first_name as string | null) || null
  const itemCount = Number((payload.item_count as number | undefined) ?? 0)
  const recipientRaw = (payload.recipient_label as string | undefined) || 'the recipient'
  const bagUrl = (payload.bag_url as string | undefined) || `${APP_URL}/`
  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const itemNoun = itemCount === 1 ? 'item' : 'items'
  const recipient = esc(recipientRaw)
  return {
    subject: 'Your Sprigloop bag is on the way',
    html: shell({
      title: 'Your Sprigloop bag is on the way',
      bodyHtml: `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">Your bag is on the <em style="font-style:italic;color:#1D9E75;">way</em>.</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting} I just shipped you a Sprigloop bag for your ${itemCount} ${itemNoun}, headed to ${recipient}. Should arrive in the next few days.</p>
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
      <a href="${esc(bagUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Open this bag in Sprigloop</a>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">I'll let you know when it lands at ${recipient}.</p>
      <p style="margin:0;">— Chris</p>
    </div>`,
    }),
    text: [
      `Your Sprigloop bag is on the way.`,
      ``,
      `${firstName ? firstName + ',' : 'Hi,'} I just shipped you a Sprigloop bag for your ${itemCount} ${itemNoun}, headed to ${recipientRaw}. Should arrive in the next few days.`,
      ``,
      `When it gets here:`,
      `  1. Fill the bag with the items you flagged for pass-along.`,
      `  2. Write the address on the front of the bag — also visible in the app.`,
      `  3. Drop it in any mailbox. Postage is already on it.`,
      ``,
      `Open this bag: ${bagUrl}`,
      ``,
      `I'll let you know when it lands at ${recipientRaw}.`,
      `— Chris`,
      ``,
      `—`,
      `Sprigloop · Detroit, MI`,
      `${APP_URL}/about · ${APP_URL}/contact`,
    ].join('\n'),
  }
}

// first_pass_along — Email #17. One-time founder note when a household's
// FIRST pass-along batch reaches 'fulfilled'. Migrated from a standalone
// send-first-pass-along function 2026-05-04.
//
// Custom footer (one-time-note framing) means we don't use the standard
// shell() helper — HTML is inlined here.
//
// Payload (built by beta.enqueue_first_pass_along trigger):
//   first_name    — user's first name, or null
//   item_count    — items in this first fulfilled batch
//   household_id  — for diagnostics / dedup audit
//   batch_id      — for diagnostics
function render_first_pass_along(payload: Record<string, unknown>): RenderedEmail {
  const firstName = (payload.first_name as string | null) || null
  const itemCount = Number((payload.item_count as number | undefined) ?? 0)
  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const itemNoun = itemCount === 1 ? 'item' : 'items'
  return {
    subject: "First bundle out the door. That's huge.",
    html: `<!doctype html>
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
      <p style="margin:0 0 12px;">You just broke that loop for ${itemCount} ${itemNoun}. They're in active use again, in another Sprigloop family.</p>
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
</html>`,
    text: [
      `First bundle out the door.`,
      ``,
      `${firstName ? firstName + ',' : 'Hi,'}`,
      ``,
      `Most baby clothing exists for about three months and then sits in a bin in someone's basement for years. The math is brutal.`,
      ``,
      `You just broke that loop for ${itemCount} ${itemNoun}. They're in active use again, in another Sprigloop family.`,
      ``,
      `That's the whole thing. That's what Sprigloop is for. Thanks for being one of the first parents to actually do it.`,
      ``,
      `— Chris`,
      `Founder, Sprigloop`,
      ``,
      `—`,
      `One-time note · only sent on your first bundle`,
      `${APP_URL}/about · ${APP_URL}/contact`,
    ].join('\n'),
  }
}

// bag_request_notify — Operational mail to Chris when a user requests a
// Sprigloop bag (concierge_tasks INSERT, task_type='bag_request'). NOT
// user-facing — recipient is the operations alias. Migrated from the
// standalone notify-bag-request function 2026-05-04.
//
// Trades brand polish for at-a-glance scannability — destination + bag SKU
// up top, full address in a monospace block, task id for marking resolved.
//
// Payload (built by beta.enqueue_bag_request_notify trigger):
//   task_id           — concierge_tasks.id (used in subject + body)
//   destination_type  — 'family' | 'person' | 'charity'
//   reference_code    — pass_along_batches reference (e.g. BLUE-OAK-3471)
//   ship_to_address   — newline-joined full address (or empty)
//   requester_email   — best-effort, may be empty
//   requester_name    — best-effort, may be empty
//   household_name    — best-effort, may be empty
//   requested_at      — ISO timestamp (rendered with locale formatting)
//   related_batch_id  — pass_along_batches.id (for diagnostics; may be null)
function render_bag_request_notify(payload: Record<string, unknown>): RenderedEmail {
  const taskId = (payload.task_id as string | undefined) || ''
  const destType = (payload.destination_type as string | undefined) || 'unknown'
  const referenceCode = (payload.reference_code as string | undefined) || '—'
  const shipToAddress = (payload.ship_to_address as string | undefined) || ''
  const requesterEmail = (payload.requester_email as string | undefined) || ''
  const requesterName = (payload.requester_name as string | undefined) || ''
  const householdName = (payload.household_name as string | undefined) || ''
  const requestedAt = (payload.requested_at as string | undefined) || ''

  const bag = bagSkuFor(destType)
  const dest = destinationLabel(destType)
  const requester = requesterName || requesterEmail || 'Unknown user'
  const requesterEmailLine = requesterEmail
    ? `<a href="mailto:${esc(requesterEmail)}" style="color:#085041;">${esc(requesterEmail)}</a>`
    : '—'
  const householdLine = householdName ? esc(householdName) : '—'
  const addrBlock = shipToAddress
    ? esc(shipToAddress).replace(/\n/g, '<br>')
    : '—'
  const who = householdName || requesterName || requesterEmail || 'a user'
  const subject = `Bag request: ${bag.sku} for ${who} (${referenceCode})`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F9F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F9F9F7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:10px;border:1px solid #F1EFE8;">
          <tr>
            <td style="padding:20px 28px 4px 28px;">
              <span style="display:inline-block;font-size:11px;font-weight:600;background:#FFF4D6;color:#7A5A00;padding:3px 10px;border-radius:999px;text-transform:uppercase;letter-spacing:0.05em;">New bag request</span>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 28px 4px 28px;">
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;color:#2C2C2A;">${esc(bag.sku)}</h1>
              <p style="margin:4px 0 0 0;font-size:14px;color:#5F5E5A;">${esc(bag.description)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;line-height:1.55;">
                <tr><td style="padding:6px 0;color:#888780;width:130px;vertical-align:top;">Destination</td><td style="padding:6px 0;color:#2C2C2A;"><strong>${esc(dest)}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#888780;vertical-align:top;">Reference</td><td style="padding:6px 0;color:#2C2C2A;font-family:'SF Mono',Menlo,Consolas,monospace;">${esc(referenceCode)}</td></tr>
                <tr><td style="padding:6px 0;color:#888780;vertical-align:top;">Requested by</td><td style="padding:6px 0;color:#2C2C2A;">${esc(requester)}</td></tr>
                <tr><td style="padding:6px 0;color:#888780;vertical-align:top;">Email</td><td style="padding:6px 0;color:#2C2C2A;">${requesterEmailLine}</td></tr>
                <tr><td style="padding:6px 0;color:#888780;vertical-align:top;">Household</td><td style="padding:6px 0;color:#2C2C2A;">${householdLine}</td></tr>
                <tr><td style="padding:6px 0;color:#888780;vertical-align:top;">Requested at</td><td style="padding:6px 0;color:#2C2C2A;">${esc(formatDateTime(requestedAt))}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 0 28px;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;color:#888780;text-transform:uppercase;letter-spacing:0.05em;">Ship the bag to</p>
              <div style="background:#F9F9F7;border:1px solid #F1EFE8;border-radius:8px;padding:12px 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:14px;line-height:1.55;color:#2C2C2A;">${addrBlock}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 4px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.55;color:#5F5E5A;">Mark this resolved in the <strong>concierge_tasks</strong> table once the bag is in the mail. Task id: <span style="font-family:'SF Mono',Menlo,Consolas,monospace;color:#2C2C2A;">${esc(taskId)}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 22px 28px;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#888780;">Sent via the email outbox when a row was inserted into <code>beta.concierge_tasks</code> with <code>task_type='bag_request'</code>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const text = [
    `NEW BAG REQUEST`,
    ``,
    `${bag.sku}`,
    `${bag.description}`,
    ``,
    `Destination:    ${dest}`,
    `Reference:      ${referenceCode}`,
    `Requested by:   ${requester}`,
    `Email:          ${requesterEmail || '—'}`,
    `Household:      ${householdName || '—'}`,
    `Requested at:   ${formatDateTime(requestedAt)}`,
    ``,
    `Ship the bag to:`,
    shipToAddress || '—',
    ``,
    `Mark resolved in concierge_tasks once the bag is in the mail.`,
    `Task id: ${taskId}`,
    ``,
    `(Sent via outbox on INSERT into beta.concierge_tasks where task_type='bag_request'.)`,
  ].join('\n')

  return { subject, html, text }
}

// Helpers used by render_bag_request_notify. Lifted from the old
// notify-bag-request function so the bag-SKU mapping stays in source.
function bagSkuFor(destType: string): { sku: string; description: string } {
  switch (destType) {
    case 'family':
      return {
        sku: 'Prelabeled-HQ bag',
        description: 'Preprinted to Sprigloop HQ. Postage billed only when scanned at the post office.',
      }
    case 'person':
      return {
        sku: 'Blank-label flat-rate bag',
        description: 'USPS Priority Mail flat rate, postage prepaid. User writes the recipient address on the bag.',
      }
    case 'charity':
      return {
        sku: 'Blank-label flat-rate bag',
        description: 'USPS Priority Mail flat rate, postage prepaid. User writes the charity address on the bag.',
      }
    default:
      return { sku: 'Unknown SKU', description: `Destination type "${destType}" — verify before shipping.` }
  }
}

function destinationLabel(destType: string): string {
  switch (destType) {
    case 'family':  return 'Another Sprigloop family'
    case 'person':  return 'A specific person (friend / family)'
    case 'charity': return 'A local charity'
    default:        return destType
  }
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month:   'short',
      day:     'numeric',
      hour:    'numeric',
      minute:  '2-digit',
      timeZoneName: 'short',
    })
  } catch {
    return iso
  }
}

// d2_nudge — Email #05. Sends 2 days after signup. Conditionally renders
// based on the user's item count at send time:
//   - <5 items: "Five tags is the magic number" — original onboarding nudge
//   - >=5 items: "Sprigloop's earning its keep" — softer acknowledgment +
//     soft pointer to the wardrobe
//
// Triggered by AFTER INSERT/UPDATE on auth.users (see migration
// enqueue_d2_nudge). Enqueued with scheduled_for = signup + 2 days, so the
// dispatcher picks it up automatically when the time comes — no separate
// daily cron needed.
//
// Payload (built by trigger):
//   first_name — snapshot at signup; null if no name metadata
async function render_d2_nudge(args: RenderArgs): Promise<RenderedEmail> {
  const firstName = (args.payload.first_name as string | null) || null

  // Live state lookup. The user_id always comes from the outbox row, not
  // payload — the trigger sets recipient_user_id when enqueuing. If no
  // user_id (shouldn't happen for this template), assume the encouragement
  // variant — better to under-engage than over-shame.
  let itemCount = 0
  if (args.recipientUserId) {
    const { data, error } = await args.supabase.schema('beta').rpc('_user_item_count', {
      _user_id: args.recipientUserId,
    })
    if (!error && typeof data === 'number') itemCount = data
  }

  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const homeUrl = `${APP_URL}/home`
  const engaged = itemCount >= 5

  const subject = engaged
    ? `Sprigloop's earning its keep.`
    : `Want to see Sprigloop click?`

  const headlinePlain = engaged
    ? `Five down.`
    : `Five tags is the magic number.`
  const headlineHtml = engaged
    ? `Five <em style="font-style:italic;color:#1D9E75;">down</em>.`
    : `Five tags is the magic <em style="font-style:italic;color:#1D9E75;">number</em>.`

  const bodyPlain = engaged
    ? [
        `${firstName ? firstName + ',' : 'Hi,'}`,
        ``,
        `Sprigloop becomes useful around here. Sizes start lining up, the next-up shelf becomes obvious, pass-along is a one-tap thing instead of a Saturday project.`,
        ``,
        `Keep snapping when something new comes in. The wardrobe stays current with about thirty seconds of tag photos a week.`,
      ].join('\n')
    : [
        `${firstName ? firstName + ',' : 'Hi,'}`,
        ``,
        `Sprigloop is one of those apps that feels pointless empty and useful the second it has a few items in it. Five is the threshold.`,
        ``,
        `Grab whatever's nearest. A onesie on the changing table, a sleeper in the wash basket. Take a picture of the tag. We do the rest.`,
        ``,
        `Once your wardrobe is in, the size shifts get easier, the duplicates get obvious, and pass-along becomes a one-tap thing instead of a Saturday project.`,
      ].join('\n')

  const bodyHtml = engaged
    ? `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">${headlineHtml}</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 12px;">Sprigloop becomes useful around here. Sizes start lining up, the next-up shelf becomes obvious, pass-along is a one-tap thing instead of a Saturday project.</p>
      <p style="margin:0 0 12px;">Keep snapping when something new comes in. The wardrobe stays current with about thirty seconds of tag photos a week.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${esc(homeUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Open the wardrobe</a>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0;">— Chris</p>
    </div>`
    : `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">${headlineHtml}</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 12px;">Sprigloop is one of those apps that feels pointless empty and useful the second it has a few items in it. Five is the threshold.</p>
      <p style="margin:0 0 12px;">Grab whatever's nearest. A onesie on the changing table, a sleeper in the wash basket. Take a picture of the tag. We do the rest.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${esc(homeUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Snap one now</a>
    </div>
    <p style="font-family:'Fraunces',Georgia,serif;font-size:14px;font-weight:500;color:#085041;letter-spacing:0.04em;text-transform:uppercase;padding:18px 28px 4px;margin:0;">Why we ask</p>
    <div style="padding:8px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">Once your wardrobe is in, the size shifts get easier, the duplicates get obvious, and pass-along becomes a one-tap thing instead of a Saturday project.</p>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0;">— Chris</p>
    </div>`

  const html = shell({
    title: headlinePlain,
    bodyHtml,
  })

  const text = [
    headlinePlain,
    ``,
    bodyPlain,
    ``,
    engaged ? `Open the wardrobe: ${homeUrl}` : `Snap one now: ${homeUrl}`,
    ``,
    `— Chris`,
    ``,
    `—`,
    `Onboarding nudge from Sprigloop. Reply with "stop" to pause these.`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].join('\n')

  return { subject, html, text, headers: LIFECYCLE_HEADERS }
}

// d4_invite — Email #06. D+4 onboarding nudge to invite a co-parent.
// Skips if the user's household already has a co-parent or pending invite,
// since the email's whole purpose is to suggest something they've already
// done.
//
// Conditional skip via beta._user_has_co_parent(user_id). Renderer
// returns SkipResult when condition met.
async function render_d4_invite(args: RenderArgs): Promise<RenderResult> {
  if (args.recipientUserId) {
    const { data, error } = await args.supabase.schema('beta').rpc('_user_has_co_parent', {
      _user_id: args.recipientUserId,
    })
    if (!error && data === true) {
      return { skip: 'already_has_co_parent' }
    }
  }

  const firstName = (args.payload.first_name as string | null) || null
  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const inviteUrl = `${APP_URL}/profile`

  const subject = `Who else is washing the onesies?`
  const html = shell({
    title: 'Add the other person',
    bodyHtml: `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">Add the other <em style="font-style:italic;color:#1D9E75;">person</em>.</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 12px;">Whoever else is doing laundry, putting the baby down, packing the diaper bag — they should see the same wardrobe you do.</p>
      <p style="margin:0 0 12px;">Inviting takes ten seconds. They get an email with a one-tap link. No new account, no app store, nothing else to set up.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${esc(inviteUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Invite a co-parent</a>
    </div>
    <p style="font-family:'Fraunces',Georgia,serif;font-size:14px;font-weight:500;color:#085041;letter-spacing:0.04em;text-transform:uppercase;padding:18px 28px 4px;margin:0;">Common cases</p>
    <div style="padding:8px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 6px;color:#2C2C2A;font-weight:500;">A partner.</p>
      <p style="margin:0 0 14px;">They can scan from their phone. Same household, one wardrobe.</p>
      <p style="margin:0 0 6px;color:#2C2C2A;font-weight:500;">A grandparent or babysitter.</p>
      <p style="margin:0 0 14px;">Read-only is fine. They see what fits without having to ask.</p>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0;">— Chris</p>
    </div>`,
  })

  const text = [
    `Add the other person.`,
    ``,
    `${firstName ? firstName + ',' : 'Hi,'}`,
    ``,
    `Whoever else is doing laundry, putting the baby down, packing the diaper bag — they should see the same wardrobe you do.`,
    ``,
    `Inviting takes ten seconds. They get an email with a one-tap link. No new account, no app store, nothing else to set up.`,
    ``,
    `Invite a co-parent: ${inviteUrl}`,
    ``,
    `Common cases:`,
    `  - A partner. They can scan from their phone. Same household, one wardrobe.`,
    `  - A grandparent or babysitter. Read-only is fine. They see what fits without having to ask.`,
    ``,
    `— Chris`,
    ``,
    `—`,
    `Onboarding nudge from Sprigloop. Reply with "stop" to pause these.`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].join('\n')

  return { subject, html, text, headers: LIFECYCLE_HEADERS }
}

// d7_snapshot — Email #07. D+7 weekly summary. Skips if zero items
// scanned (an empty wardrobe snapshot has nothing to say). Renders a
// live stat-card from beta._user_inventory_stats, which returns:
//   { total, owned, outgrown, top_brand }
// "Outgrown" here covers the union of statuses that mean the item is
// no longer in active use — outgrown, donated, exchanged, passed_along —
// matching the inventory-app definition.
async function render_d7_snapshot(args: RenderArgs): Promise<RenderResult> {
  if (!args.recipientUserId) return { skip: 'no_user_id' }

  const { data: stats, error } = await args.supabase.schema('beta').rpc('_user_inventory_stats', {
    _user_id: args.recipientUserId,
  })
  if (error) return { skip: `stats_lookup_failed: ${error.message}` }
  const total = Number((stats as Record<string, unknown> | null)?.total ?? 0)
  if (total < 1) return { skip: 'zero_items' }

  const owned = Number((stats as Record<string, unknown>).owned ?? 0)
  const outgrown = Number((stats as Record<string, unknown>).outgrown ?? 0)
  const topBrand = (stats as Record<string, unknown>).top_brand as string | null

  const firstName = (args.payload.first_name as string | null) || null
  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const homeUrl = `${APP_URL}/home`

  const statRow = (key: string, val: string) => `
        <tr>
          <td style="padding:6px 0;color:#888780;font-size:14px;">${esc(key)}</td>
          <td style="padding:6px 0;color:#2C2C2A;font-size:14px;text-align:right;font-variant-numeric:tabular-nums;">${esc(val)}</td>
        </tr>`

  const statRows = [
    statRow('Items scanned', String(total)),
    statRow('In active use', String(owned)),
    outgrown > 0 ? statRow('Outgrown', String(outgrown)) : '',
    topBrand ? statRow('Top brand', topBrand) : '',
  ].filter(Boolean).join('')

  const subject = `A week in. Here's what you've got.`
  const html = shell({
    title: 'A week in',
    bodyHtml: `
    <span style="display:inline-block;font-size:12px;font-weight:500;background:#E1F5EE;color:#085041;padding:4px 14px;border-radius:999px;margin:14px 28px 0;">Week one</span>
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">A week <em style="font-style:italic;color:#1D9E75;">in</em>.</h1>
    <p style="font-family:'Fraunces',Georgia,serif;font-size:17px;font-style:italic;color:#085041;line-height:1.4;padding:6px 28px 0;margin:0;">Here's what your wardrobe looks like so far.</p>
    <div style="padding:0 28px;margin-top:14px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
    </div>
    <div style="padding:0 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9F9F7;border:1px solid #F1EFE8;border-radius:8px;padding:14px 18px;">${statRows}
      </table>
    </div>
    <div style="padding:14px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">Not bad for a week. The more you scan, the easier the size shifts get and the more obvious the pass-along moments become.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${esc(homeUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Open the wardrobe</a>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0;">— Chris</p>
    </div>`,
  })

  const text = [
    `A week in.`,
    ``,
    `${firstName ? firstName + ',' : 'Hi,'}`,
    ``,
    `Here's what your wardrobe looks like so far.`,
    ``,
    `  Items scanned: ${total}`,
    `  In active use: ${owned}`,
    outgrown > 0 ? `  Outgrown:      ${outgrown}` : '',
    topBrand ? `  Top brand:     ${topBrand}` : '',
    ``,
    `Not bad for a week. The more you scan, the easier the size shifts get and the more obvious the pass-along moments become.`,
    ``,
    `Open the wardrobe: ${homeUrl}`,
    ``,
    `— Chris`,
    ``,
    `—`,
    `Weekly summary while you get settled. Reply with "stop" to pause these.`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].filter((l) => l !== '').join('\n')

  return { subject, html, text, headers: LIFECYCLE_HEADERS }
}

// d14_reengage — Email #08. D+14 last-onboarding-nudge re-engagement.
// Skips if the user's been active recently (auth.users.last_sign_in_at
// within the last 7 days). Soft "no pressure" framing — explicitly the
// final onboarding nudge before the program goes silent.
async function render_d14_reengage(args: RenderArgs): Promise<RenderResult> {
  if (args.recipientUserId) {
    const { data, error } = await args.supabase.schema('beta').rpc('_user_active_within_days', {
      _user_id: args.recipientUserId,
      _days: 7,
    })
    if (!error && data === true) {
      return { skip: 'active_recently' }
    }
  }

  const firstName = (args.payload.first_name as string | null) || null
  const greeting = firstName ? `${esc(firstName)},` : 'Hi,'
  const homeUrl = `${APP_URL}/home`

  const subject = `It's still here when you're ready.`
  const html = shell({
    title: 'No pressure',
    bodyHtml: `
    <h1 style="font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:500;line-height:1.2;margin:14px 28px 0;color:#2C2C2A;">No <em style="font-style:italic;color:#1D9E75;">pressure</em>.</h1>
    <div style="padding:0 28px;margin-top:16px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">${greeting}</p>
      <p style="margin:0 0 12px;">You signed up two weeks ago and life probably got busy. That tracks. Babies are a lot.</p>
      <p style="margin:0 0 12px;">Sprigloop will be here when you have ten quiet minutes. The wardrobe you started will be exactly how you left it. Pick it up whenever.</p>
    </div>
    <div style="padding:14px 28px 4px;">
      <a href="${esc(homeUrl)}" style="display:inline-block;background:#1D9E75;color:#E1F5EE !important;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:500;">Open Sprigloop</a>
    </div>
    <div style="padding:18px 28px 4px;color:#5F5E5A;font-size:15px;line-height:1.65;">
      <p style="margin:0 0 12px;">If it's not the right time, no hard feelings. Reply and tell me what got in the way and I'll take notes.</p>
      <p style="margin:0;">— Chris</p>
    </div>`,
  })

  const text = [
    `No pressure.`,
    ``,
    `${firstName ? firstName + ',' : 'Hi,'}`,
    ``,
    `You signed up two weeks ago and life probably got busy. That tracks. Babies are a lot.`,
    ``,
    `Sprigloop will be here when you have ten quiet minutes. The wardrobe you started will be exactly how you left it. Pick it up whenever.`,
    ``,
    `Open Sprigloop: ${homeUrl}`,
    ``,
    `If it's not the right time, no hard feelings. Reply and tell me what got in the way and I'll take notes.`,
    ``,
    `— Chris`,
    ``,
    `—`,
    `Last onboarding nudge. After this, you'll only hear from us when something happens with your wardrobe.`,
    `${APP_URL}/about · ${APP_URL}/contact`,
  ].join('\n')

  return { subject, html, text, headers: LIFECYCLE_HEADERS }
}

// renderTemplate — central router. Throws on unknown template_id; the
// dispatcher catches and marks the row 'failed' with the error message.
// Returning a SkipResult is NOT an error — the dispatcher honors it by
// marking the row 'skipped' instead.
async function renderTemplate(template_id: string, args: RenderArgs): Promise<RenderResult> {
  switch (template_id) {
    case 'test_ping':
      return render_test_ping(args.payload)
    case 'bag_on_the_way':
      return render_bag_on_the_way(args.payload)
    case 'first_pass_along':
      return render_first_pass_along(args.payload)
    case 'bag_request_notify':
      return render_bag_request_notify(args.payload)
    case 'd2_nudge':
      return await render_d2_nudge(args)
    case 'd4_invite':
      return await render_d4_invite(args)
    case 'd7_snapshot':
      return await render_d7_snapshot(args)
    case 'd14_reengage':
      return await render_d14_reengage(args)
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
  headers?: Record<string, string>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, error: 'resend_not_configured' }

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to: [opts.to],
    reply_to: REPLY_TO,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  }
  if (opts.headers && Object.keys(opts.headers).length > 0) {
    body.headers = opts.headers
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
  let skipped = 0

  for (const row of rows) {
    let rendered: RenderResult
    try {
      rendered = await renderTemplate(row.template_id, {
        payload: row.payload,
        recipientUserId: row.recipient_user_id,
        supabase,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase.schema('beta').rpc('mark_outbox_failed', { _id: row.id, _error: `render: ${msg}` })
      failed += 1
      continue
    }

    if (isSkip(rendered)) {
      await supabase.schema('beta').rpc('mark_outbox_skipped', { _id: row.id, _reason: rendered.skip })
      skipped += 1
      continue
    }

    const sendRes = await sendViaResend({
      to: row.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: rendered.headers,
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
    JSON.stringify({ ok: true, claimed: rows.length, sent, failed, skipped }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
