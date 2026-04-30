// ============================================================================
// notify-bag-request — Edge Function
// ============================================================================
// Fires when a row is inserted into beta.concierge_tasks with
// task_type='bag_request'. Sends Chris a formatted email so he doesn't have
// to poll Supabase Studio to discover new bag dispatches.
//
// Trigger source: Supabase Database Webhook (configured per environment in
// the Studio dashboard) targeting INSERT on beta.concierge_tasks. The webhook
// is set to include only task_type='bag_request' rows (filter configured in
// Studio), but we re-check inside the function as a defensive belt.
//
// Auth model:
//   - The function is callable by anyone who knows the URL, so we gate it
//     on a shared secret in the `x-webhook-secret` header. That secret is
//     stored as a Supabase function secret (BAG_REQUEST_WEBHOOK_SECRET) and
//     pasted into the Studio webhook config as a custom header. No public
//     JWT involved.
//   - Reads from auth.users + beta.* go through the service-role client,
//     since this function isn't acting on behalf of any one user.
//
// Request body: Supabase Database Webhook payload, e.g.:
//   {
//     "type": "INSERT",
//     "table": "concierge_tasks",
//     "schema": "beta",
//     "record": {
//       "id": "...",
//       "task_type": "bag_request",
//       "household_id": "...",
//       "created_by": "...",
//       "related_batch_id": "...",
//       "payload": {
//         "reference_code": "BLUE-OAK-3471",
//         "destination_type": "family" | "person" | "charity",
//         "ship_to_address": "Jane Doe\n123 Main St\nDetroit MI 48201",
//         "ship_to_address_parts": { name, street, unit, city, state, zip }
//       },
//       "created_at": "..."
//     },
//     "old_record": null
//   }
//
// Success (200):
//   { "ok": true, "sent": true, "task_id": "..." }
//   { "ok": true, "sent": false, "reason": "<why>" }    — for skipped events
//
// Failure codes:
//   401  missing or wrong x-webhook-secret
//   400  malformed payload (no record, wrong event type, etc.)
//   500  unexpected error or Resend failure
//
// Idempotency note:
//   Database Webhooks have at-least-once semantics — Supabase may retry on
//   non-2xx. We don't currently dedupe per task_id; if a retry storm hits,
//   Chris would get a few duplicate emails (annoying, not dangerous). If
//   that ever bites, add a `notified_at` column on concierge_tasks and
//   short-circuit when set. Skipping for v1 to keep the surface area small.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

// From / Reply-To: same conventions as the other functions. Mail goes to
// Chris (or whoever BAG_REQUEST_NOTIFY_TO points at — typically a team
// alias once there's more than one person fulfilling), so the visible
// "from" reads as the brand voice rather than a transactional robot.
const FROM_ADDRESS  = 'Sprigloop <hello@sprigloop.com>'
const REPLY_TO      = 'customersupport@sprigloop.com'
const DEFAULT_NOTIFY_TO = 'chris@sprigloop.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── Shared-secret gate ─────────────────────────────────────────────────
    // We trust the request only if it carries the secret we issued to the
    // Studio webhook. Constant-time comparison isn't strictly necessary at
    // this attack surface (the request is HTTPS-only and the comparison is a
    // few microseconds), but it's cheap.
    const expectedSecret = Deno.env.get('BAG_REQUEST_WEBHOOK_SECRET')
    if (!expectedSecret) {
      return json({ error: 'webhook_secret_not_configured' }, 500)
    }
    const providedSecret = req.headers.get('x-webhook-secret') ?? ''
    if (!safeEqual(providedSecret, expectedSecret)) {
      return json({ error: 'unauthorized' }, 401)
    }

    // ─── Parse payload ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json({ error: 'invalid_body' }, 400)
    }

    // Defensive filters in case the webhook config drifts. Studio lets you
    // configure event filters per webhook — this is a backstop.
    if (body.type !== 'INSERT') {
      return json({ ok: true, sent: false, reason: 'not_insert' })
    }
    const record = body.record
    if (!record || typeof record !== 'object') {
      return json({ error: 'no_record' }, 400)
    }
    if (record.task_type !== 'bag_request') {
      return json({ ok: true, sent: false, reason: 'wrong_task_type' })
    }

    // ─── Service-role client to enrich the email with context ──────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'beta' } },
    )

    // Requester: who hit "Request a Sprigloop bag." auth.admin.getUserById
    // gives us their email + display name in one call. Best-effort — if it
    // fails (deleted user, transient), we still send the email with placeholder
    // copy because the bag request itself is the urgent thing.
    let requesterEmail = ''
    let requesterName  = ''
    if (record.created_by) {
      try {
        const { data: requesterRes } = await adminClient.auth.admin.getUserById(record.created_by)
        const u = requesterRes?.user
        if (u) {
          requesterEmail = (u.email ?? '').trim()
          requesterName  = String(u.user_metadata?.name ?? '').trim()
        }
      } catch {
        // swallowed — email still sends with whatever info we have
      }
    }

    // Batch + household enrichment. The payload already has reference_code
    // and destination_type, but we pull the batch row for created_at + item
    // count so Chris knows how recent the request is and (eventually) how
    // big the bag needs to be.
    let batchCreatedAt = ''
    let householdName  = ''
    if (record.related_batch_id) {
      try {
        const { data: batch } = await adminClient
          .from('pass_along_batches')
          .select('created_at, household_id')
          .eq('id', record.related_batch_id)
          .maybeSingle()
        if (batch) {
          batchCreatedAt = batch.created_at ?? ''
          if (batch.household_id) {
            const { data: hh } = await adminClient
              .from('households')
              .select('name')
              .eq('id', batch.household_id)
              .maybeSingle()
            householdName = (hh?.name ?? '').trim()
          }
        }
      } catch {
        // swallowed
      }
    }

    // ─── Compose + send the email ──────────────────────────────────────────
    const payload = (record.payload ?? {}) as any
    const ctx: NotifyCtx = {
      taskId:           String(record.id ?? ''),
      destinationType:  String(payload.destination_type ?? 'unknown'),
      referenceCode:    String(payload.reference_code ?? '—'),
      shipToAddress:    String(payload.ship_to_address ?? ''),
      shipToParts:      payload.ship_to_address_parts ?? null,
      requesterEmail,
      requesterName,
      householdName,
      requestedAt:      String(record.created_at ?? ''),
      batchCreatedAt,
      relatedBatchId:   record.related_batch_id ? String(record.related_batch_id) : '',
    }

    const subject = composeSubject(ctx)
    const html    = renderEmailHtml(ctx)
    const text    = renderEmailText(ctx)

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return json({ error: 'email_not_configured' }, 500)
    }

    const notifyTo = (Deno.env.get('BAG_REQUEST_NOTIFY_TO') ?? DEFAULT_NOTIFY_TO).trim()

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       [notifyTo],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      return json({
        error:  'email_send_failed',
        status: resendRes.status,
        detail: errBody.slice(0, 500),
      }, 500)
    }

    return json({ ok: true, sent: true, task_id: ctx.taskId })

  } catch (err) {
    return json({ error: 'unexpected', detail: String((err as any)?.message ?? err) }, 500)
  }
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Length-aware constant-time-ish string compare. Deno's runtime doesn't expose
// crypto.timingSafeEqual on strings, so we hand-roll the byte loop.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

// Friendly bag-SKU label for the destination type, lifted from
// project_prelabeled_bags_concept.md so the email tells Chris which physical
// bag to grab without him having to recall the mapping.
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

// ─── Email composition ──────────────────────────────────────────────────────
// Operational mail to Chris, not user-facing. Trades brand polish for at-a-
// glance scannability — destination + bag SKU up top, full address in a
// monospace block, a quick link to the concierge_tasks row in Studio for
// when he's ready to mark it resolved.

interface NotifyCtx {
  taskId:           string
  destinationType:  string
  referenceCode:    string
  shipToAddress:    string
  shipToParts:      any
  requesterEmail:   string
  requesterName:    string
  householdName:    string
  requestedAt:      string
  batchCreatedAt:   string
  relatedBatchId:   string
}

function composeSubject(c: NotifyCtx): string {
  const sku = bagSkuFor(c.destinationType).sku
  const who = c.householdName || c.requesterName || c.requesterEmail || 'a user'
  return `Bag request: ${sku} for ${who} (${c.referenceCode})`
}

function renderEmailHtml(c: NotifyCtx): string {
  const bag = bagSkuFor(c.destinationType)
  const dest = destinationLabel(c.destinationType)
  const requester = c.requesterName || c.requesterEmail || 'Unknown user'
  const requesterEmailLine = c.requesterEmail
    ? `<a href="mailto:${escapeHtml(c.requesterEmail)}" style="color:#085041;">${escapeHtml(c.requesterEmail)}</a>`
    : '—'
  const householdLine = c.householdName ? escapeHtml(c.householdName) : '—'

  // Single-line address block, prefer the multi-line ship_to_address blob.
  const addrBlock = c.shipToAddress
    ? escapeHtml(c.shipToAddress).replace(/\n/g, '<br>')
    : '—'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(composeSubject(c))}</title>
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
              <h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:600;color:#2C2C2A;">
                ${escapeHtml(bag.sku)}
              </h1>
              <p style="margin:4px 0 0 0;font-size:14px;color:#5F5E5A;">
                ${escapeHtml(bag.description)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;line-height:1.55;">
                <tr>
                  <td style="padding:6px 0;color:#888780;width:130px;vertical-align:top;">Destination</td>
                  <td style="padding:6px 0;color:#2C2C2A;"><strong>${escapeHtml(dest)}</strong></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#888780;vertical-align:top;">Reference</td>
                  <td style="padding:6px 0;color:#2C2C2A;font-family:'SF Mono',Menlo,Consolas,monospace;">${escapeHtml(c.referenceCode)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#888780;vertical-align:top;">Requested by</td>
                  <td style="padding:6px 0;color:#2C2C2A;">${escapeHtml(requester)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#888780;vertical-align:top;">Email</td>
                  <td style="padding:6px 0;color:#2C2C2A;">${requesterEmailLine}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#888780;vertical-align:top;">Household</td>
                  <td style="padding:6px 0;color:#2C2C2A;">${householdLine}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#888780;vertical-align:top;">Requested at</td>
                  <td style="padding:6px 0;color:#2C2C2A;">${escapeHtml(formatDateTime(c.requestedAt))}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 0 28px;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;color:#888780;text-transform:uppercase;letter-spacing:0.05em;">Ship the bag to</p>
              <div style="background:#F9F9F7;border:1px solid #F1EFE8;border-radius:8px;padding:12px 14px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:14px;line-height:1.55;color:#2C2C2A;">
                ${addrBlock}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 28px 4px 28px;">
              <p style="margin:0;font-size:13px;line-height:1.55;color:#5F5E5A;">
                Mark this resolved in the <strong>concierge_tasks</strong> table once the bag is in the mail.
                Task id: <span style="font-family:'SF Mono',Menlo,Consolas,monospace;color:#2C2C2A;">${escapeHtml(c.taskId)}</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 28px 22px 28px;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#888780;">
                Sent automatically when a row was inserted into <code>beta.concierge_tasks</code> with <code>task_type='bag_request'</code>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function renderEmailText(c: NotifyCtx): string {
  const bag = bagSkuFor(c.destinationType)
  const dest = destinationLabel(c.destinationType)
  const requester = c.requesterName || c.requesterEmail || 'Unknown user'

  return [
    `NEW BAG REQUEST`,
    ``,
    `${bag.sku}`,
    `${bag.description}`,
    ``,
    `Destination:    ${dest}`,
    `Reference:      ${c.referenceCode}`,
    `Requested by:   ${requester}`,
    `Email:          ${c.requesterEmail || '—'}`,
    `Household:      ${c.householdName || '—'}`,
    `Requested at:   ${formatDateTime(c.requestedAt)}`,
    ``,
    `Ship the bag to:`,
    c.shipToAddress || '—',
    ``,
    `Mark resolved in concierge_tasks once the bag is in the mail.`,
    `Task id: ${c.taskId}`,
    ``,
    `(Sent automatically on INSERT into beta.concierge_tasks where task_type='bag_request'.)`,
  ].join('\n')
}
