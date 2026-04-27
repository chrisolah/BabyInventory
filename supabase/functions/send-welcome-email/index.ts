// ============================================================================
// send-welcome-email — Edge Function
// ============================================================================
// Sends a one-time welcome/onboarding email to a freshly-signed-up user.
//
// Designed to be called fire-and-forget from the client (AuthProvider) on
// every auth state change where the user is signed in. Idempotency lives in
// the function itself: we check `user.user_metadata.welcome_sent_at` before
// doing any work and short-circuit if it's already set. That way:
//   • Duplicate calls (page refreshes, oauth re-emits, useEffect re-runs)
//     don't send duplicate emails.
//   • Existing pre-launch users who signed up before this function shipped
//     don't suddenly get welcomed mid-session — but if you want to backfill,
//     a one-off SQL job that NULLs out welcome_sent_at can do it.
//
// Request body: none (the JWT identifies the user).
//
// Success (200):
//   { "ok": true, "sent": true }   — email queued with Resend
//   { "ok": true, "sent": false, "reason": "already_sent" }
//   { "ok": true, "sent": false, "reason": "no_email" }   — magic-link user
//                                                           with no recorded
//                                                           email yet (rare)
//
// Failure codes:
//   401  no JWT or invalid session
//   500  Resend send failed or metadata update failed
//
// Security invariants:
//   - The user JWT is the only auth signal; we use it to identify the user.
//   - Metadata writes go through the service-role client (admin.updateUserById).
//   - RESEND_API_KEY lives in Supabase secrets, never reaches the client.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

// From / Reply-To addresses. Same conventions as send-household-invite —
// hello@ as the brand sender (system mail bucket), customersupport@ for
// replies that need handling, mailto unsubscribe so Gmail/Apple Mail surface
// a one-click escape hatch.
const FROM_ADDRESS = 'Sprigloop <hello@sprigloop.com>'
const REPLY_TO     = 'customersupport@sprigloop.com'
const UNSUB_MAILTO = 'mailto:customersupport@sprigloop.com?subject=Unsubscribe%20from%20Sprigloop'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── Auth: verify the caller via their JWT ─────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'no_auth' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'invalid_session' }, 401)

    // ─── Fast-path idempotency check ───────────────────────────────────────
    // welcome_sent_at on user_metadata is the cheap "we've already done this
    // user" signal — readable from the JWT response above with no DB round
    // trip. The actual race-free dedupe happens via the welcome_log insert
    // below (atomic at the DB level), so this is purely an optimization.
    if (user.user_metadata?.welcome_sent_at) {
      return json({ ok: true, sent: false, reason: 'already_sent' })
    }

    const recipientEmail = (user.email ?? '').trim()
    if (!recipientEmail) {
      // Edge case: phone-only auth or some other flow without a recorded
      // email. Nothing to send. Don't mark welcome_sent_at because if they
      // add an email later we still want to send.
      return json({ ok: true, sent: false, reason: 'no_email' })
    }

    // ─── Service-role client (used for both the lock and the metadata write) ─
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'beta' } },
    )

    // ─── Atomic dedupe lock ────────────────────────────────────────────────
    // Insert into beta.welcome_log; the PK on user_id makes any concurrent
    // duplicate fail with unique-violation (Postgres SQLSTATE 23505) before
    // either caller sends the email. The metadata check above is just a
    // fast path — this is the durable backstop that prevents two near-
    // simultaneous tabs (storage-event SIGNED_IN, etc.) from both sending.
    const { error: lockErr } = await adminClient
      .from('welcome_log')
      .insert({ user_id: user.id })

    if (lockErr) {
      // 23505 = unique_violation. Some other invocation got here first.
      // Treat as success-but-already-sent.
      if ((lockErr as any).code === '23505') {
        return json({ ok: true, sent: false, reason: 'already_sent' })
      }
      // Anything else (table missing, permission denied, etc.) is a real
      // failure — surface it so we can fix it rather than silently sending.
      return json({ error: 'lock_failed', detail: lockErr.message }, 500)
    }

    // ─── Render the email ──────────────────────────────────────────────────
    // First-name only for the greeting — feels warmer than "Welcome, Chris
    // Olah". If the user supplied "Sarah Johnson" we want "Welcome, Sarah".
    // If they only gave "sarah@example.com" we fall back to the local-part.
    const fullName = String(user.user_metadata?.name ?? '').trim()
    const firstName = fullName ? fullName.split(/\s+/)[0] : friendlyFromEmail(recipientEmail)

    const appUrl     = Deno.env.get('APP_URL') ?? 'https://sprigloop.com'
    const homeUrl    = `${appUrl.replace(/\/+$/, '')}/home`
    const subject    = 'Welcome to Sprigloop'
    const html       = renderWelcomeEmail({ firstName, homeUrl, recipientEmail })
    const text       = renderWelcomeEmailText({ firstName, homeUrl, recipientEmail })

    // ─── Send via Resend ───────────────────────────────────────────────────
    // If we hold the lock but the actual send fails for any reason, we
    // release the lock so a future retry can run. Otherwise the user would
    // be permanently locked out of ever receiving a welcome email.
    const releaseLock = async () => {
      await adminClient.from('welcome_log').delete().eq('user_id', user.id)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      await releaseLock()
      return json({ error: 'email_not_configured' }, 500)
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     FROM_ADDRESS,
        to:       [recipientEmail],
        reply_to: REPLY_TO,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe':      `<${UNSUB_MAILTO}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      await releaseLock()
      return json({
        error:  'email_send_failed',
        status: resendRes.status,
        detail: errBody.slice(0, 500),
      }, 500)
    }

    // ─── Mark as sent ──────────────────────────────────────────────────────
    // updateUserById merges user_metadata — Supabase shallow-merges, so we
    // pass through the existing keys to be safe rather than relying solely
    // on the merge semantics. Failure here is annoying (recipient might get
    // a duplicate welcome on next session) but not fatal — the email did
    // go out, so we still return 200.
    const mergedMeta = {
      ...(user.user_metadata ?? {}),
      welcome_sent_at: new Date().toISOString(),
    }
    const { error: metaErr } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: mergedMeta,
    })

    if (metaErr) {
      // Surface as a soft warning in the response — the welcome did send,
      // we just couldn't record it. Caller can ignore.
      return json({ ok: true, sent: true, warning: 'metadata_update_failed', detail: metaErr.message })
    }

    return json({ ok: true, sent: true })

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

// "sarah@example.com" → "Sarah". Best-effort humanizing for users who never
// filled in a name field. Worst case we get "S.johnson" → "S.johnson" which
// is awkward but not broken.
function friendlyFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  if (!local) return 'there'
  // Strip + suffixes and trailing digits, replace separators with spaces,
  // then title-case the first token.
  const cleaned = local.split('+')[0].replace(/[._-]+/g, ' ').replace(/\d+$/, '').trim()
  if (!cleaned) return 'there'
  const first = cleaned.split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

// ─── Email template ─────────────────────────────────────────────────────────
// Mirrors the design Chris approved in the standalone HTML preview. Brand
// tokens match send-household-invite and the landing page (--teal #1D9E75,
// --teal-dark #085041, etc.). Same table-based, inline-styled layout that
// renders in Outlook / Gmail / Apple Mail without surprises.

interface WelcomeCtx {
  firstName:      string
  homeUrl:        string
  recipientEmail: string
}

function renderWelcomeEmail(c: WelcomeCtx): string {
  const name      = escapeHtml(c.firstName)
  const url       = escapeHtml(c.homeUrl)
  const recipient = escapeHtml(c.recipientEmail)

  // Sprig SVG: identical to the one in send-household-invite. Renders in
  // Apple Mail, Gmail web/iOS, Yahoo. Outlook Desktop falls back to white
  // space — wordmark carries the brand on its own there.
  const sprig = `
    <svg width="56" height="56" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 10 58 Q 28 46 18 32 Q 10 18 34 14 Q 52 10 56 4"
            stroke="#085041" stroke-opacity="0.55" stroke-width="1.5"
            stroke-linecap="round" fill="none"/>
      <g transform="translate(22 38)">
        <path d="M 0 0 Q 10 -2 14 -9 Q 16 -16 8 -17 Q 2 -12 0 -4 Z" fill="#1D9E75" fill-opacity="0.7"/>
      </g>
      <g transform="translate(22 22) scale(-1 1)">
        <path d="M 0 0 Q 11 -2 15 -9 Q 17 -16 9 -17 Q 2 -12 0 -4 Z" fill="#2BA883" fill-opacity="0.7"/>
      </g>
      <g transform="translate(50 10) rotate(-25)">
        <path d="M 0 0 Q 12 -2 16 -9 Q 18 -16 10 -18 Q 2 -13 0 -4 Z" fill="#1D9E75" fill-opacity="0.78"/>
      </g>
    </svg>`.trim()

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Sprigloop, ${name}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&amp;family=DM+Sans:wght@400;500&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#F9F9F7;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    A simple home for your baby's wardrobe. Here's what you can do first.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F9F9F7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="580" style="max-width:580px;width:100%;background-color:#FFFFFF;border-radius:12px;border:1px solid #F1EFE8;">

          <!-- Header: wordmark left, sprig right -->
          <tr>
            <td style="padding:24px 32px 4px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <span style="font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;color:#2C2C2A;letter-spacing:-0.01em;">sprigloop</span>
                  </td>
                  <td align="right" valign="middle">
                    ${sprig}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Eyebrow pill -->
          <tr>
            <td style="padding:12px 32px 0 32px;">
              <span style="display:inline-block;font-size:12px;font-weight:500;background:#E1F5EE;color:#085041;padding:4px 14px;border-radius:999px;">Welcome</span>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:500;color:#2C2C2A;">
                Welcome, <em style="font-style:italic;color:#1D9E75;">${name}</em>.
              </h1>
            </td>
          </tr>

          <!-- Tagline -->
          <tr>
            <td style="padding:10px 32px 0 32px;">
              <p style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;color:#085041;line-height:1.4;">
                A simple home for your baby's wardrobe.
              </p>
            </td>
          </tr>

          <!-- Intro body -->
          <tr>
            <td style="padding:18px 32px 4px 32px;">
              <p style="margin:0 0 14px 0;font-size:16px;line-height:1.65;color:#5F5E5A;">
                Thanks for joining. Baby clothes pile up fast. By month four you're staring at a bin of 3-6m onesies wondering if anyone you know has a newborn coming.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.65;color:#5F5E5A;">
                Sprigloop keeps all of it organized in one place. What fits today, what's coming up next, what's ready to pass along. So you stop buying duplicates, stop missing the right size window, and have a clean way to hand things off when they're outgrown.
              </p>
            </td>
          </tr>

          <!-- Section divider -->
          <tr>
            <td style="padding:22px 32px 4px 32px;">
              <p style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:18px;font-weight:500;color:#2C2C2A;">
                Here's what you can do first
              </p>
            </td>
          </tr>

          <!-- Feature 1 -->
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:500;color:#2C2C2A;">
                Track everything in seconds.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5F5E5A;">
                Snap a photo of the tag and we'll log the brand, size, and category for you. Check at a glance what's fitting now and what's coming up.
              </p>
            </td>
          </tr>

          <!-- Feature 2 -->
          <tr>
            <td style="padding:16px 32px 0 32px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:500;color:#2C2C2A;">
                Share with the family.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5F5E5A;">
                Co-parents, grandparents, anyone helping out. Invite them and you'll all see and update the same wardrobe from your own phones.
              </p>
            </td>
          </tr>

          <!-- Feature 3 -->
          <tr>
            <td style="padding:16px 32px 22px 32px;">
              <p style="margin:0 0 4px 0;font-size:15px;font-weight:500;color:#2C2C2A;">
                Pass it on without the friction.
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#5F5E5A;">
                When something's outgrown, send it to another Sprigloop family, a friend, or a local charity. Request a prepaid Sprigloop bag in the app, fill it, drop it in any mailbox. The good stuff stays out of a bin.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:4px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1D9E75" style="border-radius:10px;">
                    <a href="${url}"
                       style="display:inline-block;padding:13px 30px;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:500;color:#E1F5EE;text-decoration:none;border-radius:10px;background-color:#1D9E75;">
                      Open Sprigloop
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Plain URL fallback -->
          <tr>
            <td style="padding:6px 32px 22px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#888780;">
                Or paste this in your browser: <a href="${url}" style="color:#085041;">${url}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:0;border-top:1px solid #F1EFE8;margin:0;">
            </td>
          </tr>

          <!-- Footer / personal note -->
          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:#5F5E5A;">
                Anything we can help with, just reply to this email. We read every one.
              </p>
              <p style="margin:0 0 14px 0;font-size:13px;line-height:1.6;color:#5F5E5A;">
                &mdash; Chris<br>
                <span style="color:#888780;">Founder, Sprigloop</span>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#888780;">
                You're receiving this because you signed up at sprigloop.com as <strong>${recipient}</strong>. Don't want these? <a href="${UNSUB_MAILTO}" style="color:#888780;">Unsubscribe here</a>.
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

function renderWelcomeEmailText(c: WelcomeCtx): string {
  return [
    `Welcome to Sprigloop, ${c.firstName}.`,
    ``,
    `A simple home for your baby's wardrobe.`,
    ``,
    `Thanks for joining. Baby clothes pile up fast. By month four you're staring at a bin of 3-6m onesies wondering if anyone you know has a newborn coming.`,
    ``,
    `Sprigloop keeps all of it organized in one place. What fits today, what's coming up next, what's ready to pass along. So you stop buying duplicates, stop missing the right size window, and have a clean way to hand things off when they're outgrown.`,
    ``,
    `Here's what you can do first:`,
    ``,
    `  • Track everything in seconds. Snap a photo of the tag and we'll log the brand, size, and category for you.`,
    `  • Share with the family. Invite co-parents and grandparents to see and update the same wardrobe from their phones.`,
    `  • Pass it on without the friction. Send outgrown items to another Sprigloop family or a local charity.`,
    ``,
    `Open Sprigloop:`,
    c.homeUrl,
    ``,
    `Anything we can help with, just reply to this email. We read every one.`,
    ``,
    `— Chris`,
    `Founder, Sprigloop`,
    ``,
    `---`,
    `You're receiving this because you signed up at sprigloop.com as ${c.recipientEmail}.`,
    `Unsubscribe: ${UNSUB_MAILTO}`,
  ].join('\n')
}
