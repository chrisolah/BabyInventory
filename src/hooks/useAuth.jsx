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

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
