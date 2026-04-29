import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Best-effort welcome-email trigger. Fires fire-and-forget against the
// `send-welcome-email` edge function any time we observe a signed-in user.
// The function is idempotent (it short-circuits on user_metadata.welcome_sent_at),
// so calling it multiple times across page loads / tabs / refreshes is
// safe — at most one email goes out per user.
//
// Why centralize here instead of calling from Signup.jsx and AcceptInvite.jsx
// directly:
//   • Email-confirmation flow: signUp() doesn't return a session, the user
//     clicks the confirmation link, and only then does a session exist —
//     and that landing might be /home, /invite/:token, or anywhere else
//     depending on emailRedirectTo. Listening here catches all of them.
//   • Magic-link signup: same story.
//   • Invite flow: signUp → confirm email → /invite/:token → accept_invite.
//     Firing here lets the welcome go out as soon as the session is live,
//     before the user even taps "Join the household".
//
// The per-user-id ref prevents re-firing when supabase emits redundant
// auth events in the same tab (TOKEN_REFRESHED, USER_UPDATED, etc.); the
// edge function's metadata check is the durable cross-session backstop.
const welcomeAttemptedFor = new Set()
function maybeFireWelcome(user) {
  if (!user?.id) return
  if (welcomeAttemptedFor.has(user.id)) return
  // Anonymous trial users (Supabase is_anonymous=true, no email) are
  // skipped — there's no inbox to deliver to. The welcome fires later
  // when they upgrade to a permanent account; that conversion produces
  // a USER_UPDATED event with is_anonymous=false and a real email,
  // which the same maybeFireWelcome call below picks up.
  if (user.is_anonymous) return
  // Already sent on a previous session — the metadata field is the source
  // of truth, so we can skip the network call entirely. New signups arrive
  // here without the field set.
  if (user.user_metadata?.welcome_sent_at) {
    welcomeAttemptedFor.add(user.id)
    return
  }
  welcomeAttemptedFor.add(user.id)
  // Fire-and-forget. We deliberately don't await or surface errors — the
  // welcome email is not on the critical path for any user-visible flow,
  // and Resend / network hiccups shouldn't block sign-in. The edge function
  // logs failures server-side.
  supabase.functions.invoke('send-welcome-email').catch(() => {
    // Drop the guard so a later auth event can retry (e.g. user signed in
    // before backend was up). Without this, a one-off failure permanently
    // suppresses the welcome for this tab session.
    welcomeAttemptedFor.delete(user.id)
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setLoading(false)
      maybeFireWelcome(u)
    })

    // Listen for auth changes. SIGNED_IN fires after a successful login,
    // signup-with-session, OR email-confirmation landing — exactly the set
    // of moments we want to consider for welcome. TOKEN_REFRESHED also
    // emits a SIGNED_IN-shaped event in some supabase-js versions; the
    // ref guard above makes the dup harmless.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      maybeFireWelcome(u)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Explicit sign-out. The onAuthStateChange listener above will also clear
  // `user` when supabase emits SIGNED_OUT, but we do it imperatively here so
  // the UI flips instantly instead of waiting a round-trip.
  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  // Pre-signup trial entry point. Creates an anonymous Supabase user — a real
  // auth.users row with is_anonymous=true — so the visitor can use the app
  // (RLS works because every policy is keyed on auth.uid()) without giving
  // up an email. The first save in the app surfaces a blocking modal that
  // calls upgradeToAccount to convert this row into a permanent account
  // without losing any data.
  //
  // Anonymous Sign-Ins must be enabled in the Supabase project: Authentication
  // → Providers → Anonymous Sign-Ins. Without that, this call returns an
  // error from the API.
  async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) return { error }
    // The onAuthStateChange listener will also pick this up and call setUser,
    // but doing it here too means the caller can navigate immediately after
    // await without racing the listener.
    if (data?.user) setUser(data.user)
    return { user: data?.user ?? null, error: null }
  }

  // Convert an anonymous account to a permanent one. Two-step flow that
  // mirrors the existing 6-digit OTP pattern used for signup + recovery:
  //
  //   1. requestEmailChange(email) — calls supabase.auth.updateUser({ email })
  //      which sets the pending_email on the anon auth.users row and emails
  //      a 6-digit confirmation code (Outlook Safe Links pre-fetch is
  //      neutered because there's no clickable link, only a code — same
  //      reasoning as project_otp_over_magic_link.md).
  //   2. confirmEmailChange(email, token) — calls verifyOtp({type:'email_change'})
  //      which finalizes the change. The auth.users row's email is set,
  //      is_anonymous flips to false, and onAuthStateChange fires
  //      USER_UPDATED. maybeFireWelcome above re-enters and (since it's
  //      no longer anon) sends the welcome email; welcome_log dedupes.
  //
  // The same auth.users.id is preserved across the conversion, which is
  // why every clothing_items / households / pass_along_batches row the
  // user wrote during the trial automatically belongs to their permanent
  // account post-conversion — no data migration required.
  async function requestEmailChange(email) {
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    return { error }
  }

  async function confirmEmailChange(email, token) {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email_change',
    })
    if (error) return { error }
    // Pull the freshly-updated user so the consumer state reflects
    // is_anonymous=false immediately, without waiting for the auth-state
    // listener to deliver the USER_UPDATED event.
    const { data } = await supabase.auth.getUser()
    if (data?.user) setUser(data.user)
    return { error: null }
  }

  // Convenience derived flag — true while the visitor is in trial mode.
  // Components that need to gate writes (AddItem, ScanCommit, BagCreate)
  // check this to decide whether to surface the upgrade modal.
  const isAnonymous = !!user?.is_anonymous

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAnonymous,
      signOut,
      signInAnonymously,
      requestEmailChange,
      confirmEmailChange,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
