import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../contexts/HouseholdContext'
import { track } from '../lib/analytics'
import styles from './InviteMemberModal.module.css'

// Shared invite-member modal. Originally lived inside Home.jsx; promoted to
// a standalone component once a second caller (Profile → Household tab)
// needed the same UI.
//
// `from` tags the analytics event so we can compare conversion across entry
// points (home_header vs profile_household vs wherever else this pops up).
//
// Submission calls the `send-household-invite` edge function, which:
//   1. Verifies the caller's JWT.
//   2. Confirms they own this household (returns 403 otherwise).
//   3. Inserts a beta.pending_invites row.
//   4. Sends a branded HTML email via Resend with an /invite/:token link.
//
// We pull `household.id` from HouseholdContext rather than passing it as a
// prop so both call sites (Home, Profile) work without plumbing changes.
// Both callers render this modal inside ProtectedLayout, where the provider
// is guaranteed to be mounted.

// Map edge-function `error` codes to user-facing copy. Codes that come back
// in the JSON body of a non-2xx response — see send-household-invite/index.ts.
function messageFor(code) {
  switch (code) {
    case 'invalid_email':         return "That doesn't look like a valid email address."
    case 'cannot_invite_self':    return "You can't invite yourself — you're already a member."
    case 'not_household_owner':   return "Only household owners can send invites. Ask the owner to invite this person."
    case 'duplicate_active':
    case 'pending_exists':        return "There's already a pending invite to this address. Ask them to check their inbox (and spam) before sending another."
    case 'rate_limited':          return "You've hit the invite limit for this hour. Try again a bit later."
    case 'no_auth':
    case 'invalid_session':       return "Your session expired. Sign out and back in, then try again."
    case 'missing_household_id':  return "We couldn't find your household. Refresh the page and try again."
    case 'email_send_failed':     return "We saved the invite but the email didn't go out. We'll retry shortly — or you can resend in a minute."
    default:                      return "Something went wrong sending the invite. Try again, or message us if it keeps failing."
  }
}

// Pull the structured error code out of whatever supabase-js v2 threw.
// Mirrors the pattern used in TagScanner's extractFnErrorCode — supabase-js
// surfaces the raw Response on `err.context` for FunctionsHttpError, and
// our edge function returns `{ error: <code>, ... }` JSON for non-2xx.
async function extractErrorCode(fnErr) {
  const ctx = fnErr?.context
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const parsed = await ctx.clone().json()
      if (parsed?.error) return parsed.error
    } catch { /* not JSON, fall through */ }
    if (ctx.status === 401) return 'invalid_session'
    if (ctx.status === 403) return 'not_household_owner'
    if (ctx.status === 409) return 'duplicate_active'
    if (ctx.status === 429) return 'rate_limited'
    if (ctx.status === 404) return 'not_deployed'
  }
  return 'unknown'
}

export default function InviteMemberModal({ from, onClose }) {
  const { household } = useHousehold()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    if (!household?.id) {
      setError(messageFor('missing_household_id'))
      return
    }

    setSending(true)
    setError(null)
    track.householdInviteSubmitted({ from })

    const { data, error: fnErr } = await supabase.functions.invoke(
      'send-household-invite',
      {
        body: {
          household_id:  household.id,
          invited_email: trimmed,
          // Defaulting role to 'member' is intentional — see edge function
          // for the role validation. Owner-promotion isn't surfaced in this
          // modal yet; it'd be a separate flow with its own confirmations.
          role: 'member',
        },
      },
    )

    setSending(false)

    if (fnErr) {
      const code = await extractErrorCode(fnErr)
      setError(messageFor(code))
      // Tag the failure on the existing analytics event so we can sort out
      // 403s (owner-only gate hit) from 409s (duplicates) without a new event.
      track.householdInviteSubmitted({ from, status: 'failed', code })
      return
    }

    if (!data?.ok) {
      // Defensive fallback — function returned 2xx but body shape is wrong.
      // Shouldn't happen with the current implementation but worth surfacing
      // so silent failures don't confuse users.
      setError(messageFor('unknown'))
      track.householdInviteSubmitted({ from, status: 'failed', code: 'bad_response' })
      return
    }

    track.householdInviteSubmitted({ from, status: 'sent', invite_id: data.invite_id })
    setSent(true)
  }

  // Close on backdrop click but not on modal click.
  function onBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.overlay} onClick={onBackdropClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Invite a household member</div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.modalSub}>
          Co-parents, grandparents, anyone helping out. We&rsquo;ll send them
          an email with a one-click link to join your household.
        </p>

        {sent ? (
          <>
            <div className={styles.success}>
              Invite sent to {email.trim()}. They&rsquo;ll get an email from
              Sprigloop with a link to join. The link is good for 7 days.
            </div>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={onClose}
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email address</label>
              <input
                className={styles.input}
                type="email"
                placeholder="partner@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                disabled={sending}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={!email.trim() || sending}
            >
              {sending ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
