// ============================================================================
// send-household-invite — Edge Function
// ============================================================================
// Creates a pending invite row and sends a branded HTML email via Resend.
//
// Request body:
//   {
//     "household_id":  "<uuid of household the caller owns>",
//     "invited_email": "person@example.com",
//     "role":          "member" | "owner"   // optional, defaults to "member"
//   }
//
// Success (200):
//   { "ok": true, "invite_id": "<uuid>" }
//
// Failure codes:
//   400  bad input (missing/invalid email, missing household_id)
//   401  no JWT or invalid session
//   403  caller is not an owner of the household
//   409  there's already an active invite to this address for this household
//   429  inviter exceeded the per-hour rate limit
//   500  unexpected error (DB write or Resend send failed)
//
// Security invariants:
//   - All writes go through the service-role client. The user's JWT is only
//     used to identify them; we re-check ownership ourselves.
//   - RESEND_API_KEY lives in Supabase secrets, never reaches the client.
//   - The recipient address is normalized to lowercase before insertion so the
//     unique-active-invite constraint catches case variants.
// ============================================================================

// deno-lint-ignore-file no-explicit-any
import { createClient } from '@supabase/supabase-js'
import { corsHeaders } from '../_shared/cors.ts'

// How many invites a single user can create per rolling hour. Conservative
// for now — almost no real user would invite more than 2-3 people in a sitting,
// so 10/hr leaves headroom for "I mistyped, let me try again" flows without
// letting a compromised account spam.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX       = 10

// From / Reply-To / unsubscribe addresses.
//
// FROM uses chris@ for warmth — recipients see "Sprigloop <chris@sprigloop.com>"
// in their inbox. Reply-To routes any responses to customersupport@ so that
// scales beyond Chris reading every reply.
//
// List-Unsubscribe is the email-client-honored header that lets Gmail / Apple
// Mail show a one-click "unsubscribe" link in the UI even though invite emails
// are technically transactional. Pointing at customersupport@ with a clear
// subject line gives recipients a reliable escape hatch.
const FROM_ADDRESS    = 'Sprigloop <chris@sprigloop.com>'
const REPLY_TO        = 'customersupport@sprigloop.com'
const UNSUB_MAILTO    = 'mailto:customersupport@sprigloop.com?subject=Unsubscribe%20from%20Sprigloop%20invites'

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

    // ─── Parse + validate body ─────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'invalid_body' }, 400)

    const household_id  = String(body.household_id ?? '').trim()
    const invited_email = String(body.invited_email ?? '').trim().toLowerCase()
    const role          = (body.role ?? 'member') as string

    if (!household_id) return json({ error: 'missing_household_id' }, 400)
    if (!invited_email || !isValidEmail(invited_email)) {
      return json({ error: 'invalid_email' }, 400)
    }
    if (!['owner', 'member'].includes(role)) {
      return json({ error: 'invalid_role' }, 400)
    }
    if (invited_email === (user.email ?? '').toLowerCase()) {
      return json({ error: 'cannot_invite_self' }, 400)
    }

    // ─── Service-role client for the actual writes ─────────────────────────
    // Targets the `beta` schema — both projects use this name (see the
    // dev/prod two-project memory note).
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { db: { schema: 'beta' } }
    )

    // Caller must be an owner of the target household. We do this check in
    // the function rather than relying on RLS because the insert itself runs
    // as service role.
    const { data: membership, error: memErr } = await adminClient
      .from('household_members')
      .select('role')
      .eq('household_id', household_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memErr) return json({ error: 'membership_check_failed', detail: memErr.message }, 500)
    if (!membership || membership.role !== 'owner') {
      return json({ error: 'not_household_owner' }, 403)
    }

    // ─── Rate limit ────────────────────────────────────────────────────────
    const sinceWindow = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
    const { count, error: countErr } = await adminClient
      .from('pending_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invited_by', user.id)
      .gte('created_at', sinceWindow)

    if (countErr) return json({ error: 'rate_check_failed', detail: countErr.message }, 500)
    if ((count ?? 0) >= RATE_LIMIT_MAX) {
      return json({ error: 'rate_limited', limit: RATE_LIMIT_MAX, window_minutes: 60 }, 429)
    }

    // ─── Upsert the invite row ─────────────────────────────────────────────
    // Idempotent: if there's already an active invite to this address for
    // this household, re-use its row (and re-send the email with the same
    // token). Without this, the inviter sees an "already_invited" error
    // when they re-send — but from their perspective, hitting Send again
    // should just send the email again. Common cases: the recipient lost
    // the original email, the inviter wanted to nudge, or they hit Send
    // twice while the page was loading.
    //
    // We also bump expires_at to a fresh 7 days on resend, so a recipient
    // clicking through a re-sent email isn't stuck with whatever was left
    // of the original window. The token (the row's id) stays the same, so
    // the original email link is still valid until the new expiry too —
    // no broken links.
    let invite: { id: string; expires_at: string }
    let resent = false

    const { data: existing, error: existingErr } = await adminClient
      .from('pending_invites')
      .select('id')
      .eq('household_id', household_id)
      .eq('invited_email', invited_email)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .maybeSingle()

    if (existingErr) {
      return json({ error: 'invite_lookup_failed', detail: existingErr.message }, 500)
    }

    if (existing) {
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: updated, error: updErr } = await adminClient
        .from('pending_invites')
        .update({ expires_at: newExpiry, invited_by: user.id, role })
        .eq('id', existing.id)
        .select('id, expires_at')
        .single()

      if (updErr || !updated) {
        return json({ error: 'invite_update_failed', detail: updErr?.message ?? 'no row' }, 500)
      }
      invite = updated
      resent = true
    } else {
      const { data: inserted, error: insErr } = await adminClient
        .from('pending_invites')
        .insert({
          household_id,
          invited_email,
          invited_by: user.id,
          role,
        })
        .select('id, expires_at')
        .single()

      if (insErr || !inserted) {
        // 23505 here would mean a race with a concurrent send (two parents
        // hitting Send at the same time, both passing the existing-row
        // check). Surface as already_invited so the UI can suggest a
        // refresh; in practice this is vanishingly rare.
        if ((insErr as any)?.code === '23505') {
          return json({ error: 'already_invited' }, 409)
        }
        return json({ error: 'invite_create_failed', detail: insErr?.message ?? 'no row' }, 500)
      }
      invite = inserted
    }

    // ─── Gather context for the email ──────────────────────────────────────
    const { data: household } = await adminClient
      .from('households')
      .select('name')
      .eq('id', household_id)
      .single()

    const inviterName    = String(user.user_metadata?.name ?? '').trim() || (user.email ?? 'A Sprigloop family')
    const householdName  = household?.name?.trim() || `${inviterName}'s household`
    const appUrl         = Deno.env.get('APP_URL') ?? 'https://sprigloop.com'
    const acceptUrl      = `${appUrl.replace(/\/+$/, '')}/invite/${invite.id}`
    const expiresAtLabel = formatDate(invite.expires_at)

    const subject = `${inviterName} invited you to a Sprigloop household`
    const html    = renderInviteEmail({
      inviterName,
      householdName,
      acceptUrl,
      invitedEmail: invited_email,
      expiresAtLabel,
    })
    const text    = renderInviteEmailText({
      inviterName,
      householdName,
      acceptUrl,
      invitedEmail: invited_email,
      expiresAtLabel,
    })

    // ─── Send via Resend ───────────────────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      // Roll back the invite so it doesn't sit there orphaned — but only
      // if we just created it. On a resend we'd be deleting a previously-
      // valid invite (and breaking the original email link) for no reason.
      if (!resent) {
        await adminClient.from('pending_invites').delete().eq('id', invite.id)
      }
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
        to:       [invited_email],
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
      // Roll back the new row so the inviter can retry without bumping the
      // unique index. On a resend we leave the original row alone — the
      // first email's link is still valid, so deleting would actively
      // make things worse.
      if (!resent) {
        await adminClient.from('pending_invites').delete().eq('id', invite.id)
      }
      return json({
        error:  'email_send_failed',
        status: resendRes.status,
        detail: errBody.slice(0, 500),
      }, 500)
    }

    return json({ ok: true, invite_id: invite.id, resent })

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

function isValidEmail(s: string): boolean {
  // Deliberately lenient — email regex perfection is a fool's errand.
  // Resend will fail loudly on truly malformed addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month:   'long',
      day:     'numeric',
    })
  } catch {
    return iso
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

// ─── Email template ─────────────────────────────────────────────────────────
// Hand-rolled because we only have one template right now. When we add a
// second (welcome / digest / etc.) we can promote this to a shared module
// or pull in something like maizzle. Conventions followed:
//   - Table-based layout: still the most reliable across Outlook/Gmail/Apple Mail
//   - Inline styles only: no <style> block (Gmail strips them in some clients)
//   - Web-safe font stack: no @font-face
//   - 580px content width: standard for desktop and mobile-friendly stacking
//   - Single CTA button styled as a table cell (Outlook ignores button styles)

interface InviteCtx {
  inviterName:    string
  householdName:  string
  acceptUrl:      string
  invitedEmail:   string
  expiresAtLabel: string
}

function renderInviteEmail(c: InviteCtx): string {
  const inviter   = escapeHtml(c.inviterName)
  const household = escapeHtml(c.householdName)
  const recipient = escapeHtml(c.invitedEmail)
  const url       = escapeHtml(c.acceptUrl)
  const expires   = escapeHtml(c.expiresAtLabel)

  // Brand tokens lifted from src/styles/globals.css so the email matches the
  // landing page exactly. Keep these in sync if the brand palette shifts.
  //   --teal           #1D9E75   primary
  //   --teal-light     #E1F5EE   pill bg, button text
  //   --teal-dark      #085041   pill text, env-hook tagline, stem
  //   --gray-50        #F9F9F7   page background
  //   --gray-100       #F1EFE8   card border / divider
  //   --gray-600       #5F5E5A   body copy
  //   --gray-900       #2C2C2A   headline + wordmark
  //   --font-display   Fraunces  (serif fallback Georgia)
  //   --font-body      DM Sans   (sans fallback system)
  //
  // Inline SVG sprig sits in the header next to the wordmark. Modern email
  // clients render it (Apple Mail, Gmail web/iOS, Yahoo). Outlook Desktop
  // falls back to white space — acceptable since the brand carries on the
  // wordmark.
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

  // The italic headline accent + italic teal tagline mirror the landing hero
  // ("Baby clothes, /organized/ and shared." with the env-hook line below).
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${inviter} invited you to a Sprigloop household</title>
<!-- Web font import. Apple Mail, Gmail web/iOS, Yahoo all honor this. Outlook
     Desktop and Gmail Android fall back to the local stack — Georgia for the
     display face, system sans for body, both readable. -->
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;1,9..144,500&amp;family=DM+Sans:wght@400;500&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#F9F9F7;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2C2C2A;-webkit-font-smoothing:antialiased;">
  <!-- Preheader: shows in inbox preview, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${inviter} added you to ${household}. Built for parents who'd rather pass it on than throw it out.
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

          <!-- "You're invited" pill -->
          <tr>
            <td style="padding:12px 32px 0 32px;">
              <span style="display:inline-block;font-size:12px;font-weight:500;background:#E1F5EE;color:#085041;padding:4px 14px;border-radius:999px;">You're invited</span>
            </td>
          </tr>

          <!-- Headline (italic teal accent on the household name, mirroring landing) -->
          <tr>
            <td style="padding:14px 32px 0 32px;">
              <h1 style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:500;color:#2C2C2A;">
                ${inviter} invited you to <em style="font-style:italic;color:#1D9E75;">${household}</em>.
              </h1>
            </td>
          </tr>

          <!-- Env-hook tagline (italic teal-dark, lifted from landing hero) -->
          <tr>
            <td style="padding:10px 32px 0 32px;">
              <p style="margin:0;font-family:'Fraunces',Georgia,'Times New Roman',serif;font-size:17px;font-style:italic;color:#085041;line-height:1.4;">
                Built for parents who'd rather pass it on than throw it out.
              </p>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="padding:18px 32px 4px 32px;">
              <p style="margin:0 0 14px 0;font-size:16px;line-height:1.65;color:#5F5E5A;">
                Sprigloop helps families keep track of baby clothes. What fits today, what's been outgrown, what's ready to pass along.
              </p>
              <p style="margin:0;font-size:16px;line-height:1.65;color:#5F5E5A;">
                Joining ${household} means you'll see the same wardrobe ${inviter} sees, and you can both add or update from your own phone.
              </p>
            </td>
          </tr>

          <!-- CTA button (matches landing .heroCta: teal bg, teal-light text) -->
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1D9E75" style="border-radius:10px;">
                    <a href="${url}"
                       style="display:inline-block;padding:13px 30px;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:500;color:#E1F5EE;text-decoration:none;border-radius:10px;background-color:#1D9E75;">
                      Join the household
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Plain URL fallback -->
          <tr>
            <td style="padding:6px 32px 14px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#888780;">
                Or paste this link into your browser:<br>
                <a href="${url}" style="color:#085041;word-break:break-all;">${url}</a>
              </p>
            </td>
          </tr>

          <!-- Expiry -->
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#888780;">
                This invite expires on <strong style="color:#5F5E5A;">${expires}</strong>. After that, ${inviter} can send a fresh one.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:0;border-top:1px solid #F1EFE8;margin:0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:#888780;">
                You're receiving this because ${inviter} added <strong>${recipient}</strong> to their household at sprigloop.com. If you weren't expecting it, you can ignore this email and the invite will expire on its own.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#888780;">
                Questions? Reply to this email or write us at <a href="mailto:${REPLY_TO}" style="color:#5F5E5A;">${REPLY_TO}</a>.
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

function renderInviteEmailText(c: InviteCtx): string {
  // Plain-text fallback for clients that prefer it (and for spam-filter
  // signal: text-only-with-an-HTML-twin scores better than HTML alone).
  return [
    `${c.inviterName} invited you to ${c.householdName} on Sprigloop.`,
    ``,
    `Sprigloop helps families keep track of baby clothes. What fits today, what's been outgrown, what's ready to pass along.`,
    ``,
    `Joining ${c.householdName} means you'll see the same wardrobe ${c.inviterName} sees, and can add or update things from your own phone.`,
    ``,
    `Join the household:`,
    c.acceptUrl,
    ``,
    `This invite expires on ${c.expiresAtLabel}. After that, ${c.inviterName} can send a fresh one.`,
    ``,
    `---`,
    `You're receiving this because ${c.inviterName} added ${c.invitedEmail} to their household at sprigloop.com. If you weren't expecting it, you can ignore this email and the invite will expire on its own.`,
    `Questions? Reply or write us at ${REPLY_TO}.`,
  ].join('\n')
}
