import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { track } from '../lib/analytics'
import styles from './AcceptInvite.module.css'

// Landing page for the link in the household-invite email (/invite/:token).
//
// Flow:
//  1. On mount, peek_invite(token) — anon-callable RPC that returns
//     household_name, inviter_label, invited_email, role, expires_at, status.
//     If the token doesn't exist, peek_invite returns no rows → 'not-found'.
//  2. Render based on status:
//       'active'    → action UI (sign in / sign up / accept depending on auth)
//       'accepted'  → "this invite was already accepted" with a link to /home
//       'revoked'   → "the inviter cancelled this invite"
//       'expired'   → "ask for a new invite — this one expired" + ttl context
//       'not-found' → "this link is broken or never existed"
//  3. If signed in AND email matches: button calls accept_invite(token) →
//     navigates to /home on success.
//  4. If signed in but email doesn't match: explain mismatch and offer
//     sign-out + sign-in-as-the-invited-address.
//  5. If not signed in: show Sign in / Sign up buttons that preserve the
//     invite token via ?next=/invite/:token, so the user lands back here
//     after auth and can accept in one click.
//
// Routing: this screen is intentionally NOT inside ProtectedLayout (unauthed
// recipients need to see the preview) and NOT inside PublicRoute (signed-in
// users with the wrong email shouldn't be bounced to /home — they need to
// see the mismatch). It's wired as a top-level route in App.jsx.
//
// The peek RPC uses security definer + grants execute to anon, so we can
// call it without an auth header. A token guess is infeasible (122-bit uuid)
// and the response only carries non-sensitive metadata; if you have the
// token you were sent it.
export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading, signOut } = useAuth()

  const [invite, setInvite] = useState(null)         // rendered metadata from peek_invite
  const [status, setStatus] = useState('loading')    // 'loading' | 'active' | 'accepted' | 'revoked' | 'expired' | 'not-found' | 'fetch-error'
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState(null)
  const [done, setDone] = useState(false)            // true after a successful accept; used for the success splash before redirect

  // Fire a view event once per mount so we can measure invite-link CTR
  // distinct from the general engagement tracking already in place.
  useEffect(() => {
    track.householdInviteAcceptOpened()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Peek as soon as we have a token. We re-peek if the token in the URL
  // changes (effectively never within a session, but cheap insurance).
  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!token) {
        setStatus('not-found')
        return
      }

      setStatus('loading')
      // .schema(currentSchema) is required because the supabase client default
      // schema is set via headers, but RPCs need the explicit schema to route
      // to beta.peek_invite rather than public.peek_invite (which doesn't exist).
      const { data, error } = await supabase
        .schema(currentSchema)
        .rpc('peek_invite', { p_token: token })

      if (cancelled) return

      if (error) {
        setStatus('fetch-error')
        return
      }

      // peek_invite returns table — supabase-js gives us an array. Empty array
      // means the token didn't match any row (or was malformed and the SQL
      // function silently returned nothing).
      const row = Array.isArray(data) ? data[0] : null
      if (!row) {
        setStatus('not-found')
        return
      }

      setInvite(row)
      setStatus(row.status || 'active')
    }

    load()
    return () => { cancelled = true }
  }, [token])

  // Whether the currently-signed-in user matches the address the invite was
  // sent to. citext on the DB side; lower-case both sides on the client to
  // match before we present the "Accept" button.
  const emailMatches = useMemo(() => {
    if (!user || !invite?.invited_email) return false
    return (user.email || '').toLowerCase() === invite.invited_email.toLowerCase()
  }, [user, invite?.invited_email])

  async function handleAccept() {
    if (!token) return
    setAccepting(true)
    setAcceptError(null)

    const { error } = await supabase
      .schema(currentSchema)
      .rpc('accept_invite', { p_token: token })

    if (error) {
      setAccepting(false)
      // Backend exception messages are user-facing on purpose — they describe
      // the specific failure ("invite has expired", "sent to a different
      // email address"). Surface as-is rather than swallowing into a generic.
      setAcceptError(error.message || 'Something went wrong accepting this invite.')
      track.householdInviteAcceptFailed({ reason: error.message })
      return
    }

    track.householdInviteAcceptCompleted()
    setAccepting(false)
    setDone(true)

    // Brief success splash, then send them to /home. The HouseholdProvider
    // re-mounts when entering ProtectedLayout and will pick up the new
    // membership on its first query — no manual refresh needed.
    setTimeout(() => navigate('/home', { replace: true }), 1100)
  }

  async function handleSignOutAndRetry() {
    // Sign out the current (mismatched) account, then send them to /login
    // with ?next= preserving the invite link so they bounce back here after
    // logging in as the invited address.
    await signOut()
    navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  }

  function goSignIn() {
    navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  }

  function goSignUp() {
    // Pre-fill the invited email so the recipient doesn't have to re-type it
    // and (more importantly) so the address they sign up with matches what
    // accept_invite() will check on submission.
    const params = new URLSearchParams({
      next: `/invite/${token}`,
      email: invite?.invited_email || '',
    })
    navigate(`/signup?${params.toString()}`)
  }

  // ── Sprig — 56×56 standalone version of the IvyDecoration vine, anchored
  //    to the brand. Rendered inline so the screen has a visual mark before
  //    any action is taken. Same color tokens as the Landing component.
  const sprig = (
    <svg
      className={styles.sprig}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M 40 75 Q 55 60 40 45 Q 25 30 45 18 Q 60 8 50 2"
        stroke="#085041"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M 40 45 Q 56 41 60 30 Q 60 22 50 24 Q 42 30 40 40 Z"
            fill="#1D9E75" fillOpacity="0.6" />
      <path d="M 45 18 Q 28 14 22 22 Q 18 30 30 32 Q 42 30 46 22 Z"
            fill="#2BA883" fillOpacity="0.6" />
      <path d="M 50 2 Q 65 6 66 18 Q 64 26 54 22 Q 48 14 50 4 Z"
            fill="#1D9E75" fillOpacity="0.65" />
    </svg>
  )

  // ── Render branches ──

  if (authLoading || status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <div className={styles.loadingState}>Checking your invite…</div>
        </div>
      </div>
    )
  }

  if (status === 'fetch-error') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>We couldn't load this invite</h1>
          <p className={styles.sub}>
            Something on our end blocked the request. Refresh the page in a moment, or open the link from your email again.
          </p>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={() => window.location.reload()}>
              Try again
            </button>
            <button className={styles.secondaryBtn} onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>This invite link isn't valid</h1>
          <p className={styles.sub}>
            We don't have a record of this invite. The link may have been mistyped, or the inviter may have cancelled it. Ask them to send a new one.
          </p>
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <div className={styles.notice + ' ' + styles.noticeInfo}>
            This invite has already been accepted.
          </div>
          <p className={styles.sub}>
            If that wasn't you, ask the household owner to send a fresh invite.
          </p>
          <div className={styles.actions}>
            {user ? (
              <button className={styles.primaryBtn} onClick={() => navigate('/home')}>
                Go to your home
              </button>
            ) : (
              <button className={styles.primaryBtn} onClick={() => navigate('/login')}>
                Log in
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'revoked') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <div className={styles.notice + ' ' + styles.noticeWarn}>
            The household owner cancelled this invite.
          </div>
          <p className={styles.sub}>
            If you were expecting to join {invite?.household_name ? <strong>{invite.household_name}</strong> : 'a household'} on Sprigloop, ask them to send a new one.
          </p>
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.logo}>sprigloop</div>
          <div className={styles.notice + ' ' + styles.noticeWarn}>
            This invite expired.
          </div>
          <p className={styles.sub}>
            Invites are good for 7 days. Ask the household owner to send a new one and you'll be back on track.
          </p>
          <div className={styles.actions}>
            <button className={styles.secondaryBtn} onClick={() => navigate('/')}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.successIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className={styles.logo}>sprigloop</div>
          <h1 className={styles.title}>You're in</h1>
          <p className={styles.sub}>
            Welcome to {invite?.household_name ? <em className={styles.titleAccent}>{invite.household_name}</em> : 'the household'}. Taking you to your home now…
          </p>
        </div>
      </div>
    )
  }

  // status === 'active' — the main path. UI varies by auth state.
  const householdName = invite?.household_name || 'a household'
  const inviterLabel = invite?.inviter_label || 'A Sprigloop user'
  const expires = invite?.expires_at ? new Date(invite.expires_at) : null
  const expiresLabel = expires
    ? expires.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.logo}>sprigloop</div>

        <div className={styles.sprigRow}>
          {sprig}
          <div>
            <div className={styles.eyebrow}>Household invite</div>
            <h1 className={styles.title}>
              You're invited to{' '}
              <span className={styles.titleAccent}>{householdName}</span>
            </h1>
          </div>
        </div>

        <p className={styles.sub}>
          {inviterLabel} added you to their household on Sprigloop so you can both keep their kid's wardrobe in sync — what fits, what's outgrown, what's coming up next.
        </p>

        <div className={styles.card}>
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Household</span>
            <span className={styles.cardValue}>{householdName}</span>
          </div>
          <div className={styles.cardRow}>
            <span className={styles.cardLabel}>Sent to</span>
            <span className={styles.cardValue}>{invite?.invited_email}</span>
          </div>
          {expiresLabel && (
            <div className={styles.cardRow}>
              <span className={styles.cardLabel}>Expires</span>
              <span className={styles.cardValue}>{expiresLabel}</span>
            </div>
          )}
        </div>

        {/* Three branches:
            (a) signed in & email matches      → Accept
            (b) signed in but email mismatch   → explain + sign-out-and-retry
            (c) signed out                     → Sign in / Sign up (with ?next=) */}
        {user && emailMatches && (
          <>
            {acceptError && <div className={styles.error}>{acceptError}</div>}
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? 'Joining…' : `Join ${householdName}`}
              </button>
            </div>
            <div className={styles.footer}>
              Signed in as <strong>{user.email}</strong>.
            </div>
          </>
        )}

        {user && !emailMatches && (
          <>
            <div className={styles.notice + ' ' + styles.noticeWarn}>
              You're signed in as <strong>{user.email}</strong>, but this invite was sent to <strong>{invite?.invited_email}</strong>. To accept, sign in with the invited address.
            </div>
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={handleSignOutAndRetry}>
                Sign out and switch accounts
              </button>
            </div>
          </>
        )}

        {!user && (
          <>
            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={goSignUp}>
                Create my account
              </button>
              <button className={styles.secondaryBtn} onClick={goSignIn}>
                I already have an account
              </button>
            </div>
            <div className={styles.footer}>
              Make sure you sign up with <strong>{invite?.invited_email}</strong>.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
