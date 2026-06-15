import { useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { usePushNotifications } from './hooks/usePushNotifications'
import { HouseholdProvider } from './contexts/HouseholdContext'
import { UpgradeGateProvider } from './contexts/UpgradeGateContext'
import { track } from './lib/analytics'
import { gaPageView } from './lib/analytics-ga'
import './styles/globals.css'

import Landing from './screens/Landing'
import NativeWelcome from './screens/NativeWelcome'
import HowItWorks from './screens/HowItWorks'
import About from './screens/About'
import Contact from './screens/Contact'
import Privacy from './screens/Privacy'
import Terms from './screens/Terms'
import NotFound from './screens/NotFound'
import Signup from './screens/Signup'
import Login from './screens/Login'
import ResetPassword from './screens/ResetPassword'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Inventory from './screens/Inventory'
import SlotDetail from './screens/SlotDetail'
import AddItem from './screens/AddItem'
import ItemDetail from './screens/ItemDetail'
import PassAlongBatch from './screens/PassAlongBatch'
import PassAlongList from './screens/PassAlongList'
import Plan from './screens/Plan'
import Profile from './screens/Profile'
import AcceptInvite from './screens/AcceptInvite'
import WishlistPublic from './screens/WishlistPublic'
import FindRegistry from './screens/FindRegistry'
import Admin from './screens/Admin'
import IvyDecoration from './components/IvyDecoration'
import LandingLayout from './components/LandingLayout'
import TrialBanner from './components/TrialBanner'
import ErrorBoundary from './components/ErrorBoundary'
import AppSplash from './components/AppSplash'
import AppShell from './components/AppShell'

// Client-side admin allowlist — kept in sync with beta._admin_emails() in the
// migration. Server is the source of truth; this lives client-side only so the
// /admin route can gate without a roundtrip. If they drift, the route guard
// might let a non-admin in but the RPCs would still reject — fail-safe direction.
const ADMIN_EMAILS = new Set(['chris@sprigloop.com', 'chrisjolah@outlook.com'])

// React Router v6 doesn't auto-scroll to the top on route change, so
// scroll position carries between pages. Most noticeable on mobile:
// after scrolling down the Login form to tap submit, you'd land on
// /home with the page already scrolled past the sticky header, making
// it look like the header was missing. This component resets scroll to
// the top on every pathname change AND on initial load / bfcache restore.
//
// Why this is trickier than it looks on mobile Safari:
//   1. The browser's default `history.scrollRestoration` is 'auto', which
//      means after a back/forward or refresh, Safari restores the previous
//      scroll position AFTER React has mounted — racing (and winning)
//      against any useEffect-driven scroll reset. Setting it to 'manual'
//      hands scroll ownership to us.
//   2. `behavior: 'instant'` is silently unsupported on older iOS Safari;
//      the call becomes a no-op. Using the legacy two-arg form
//      `scrollTo(0, 0)` is universally supported and effectively instant.
//   3. iOS Safari's bfcache restores pages WITHOUT re-running effects, so
//      reopening a tab can land you exactly where you left off. We listen
//      for `pageshow` with `event.persisted` and reset scroll there too.
//   4. `useLayoutEffect` runs after DOM mutation but before paint, so the
//      user never sees a frame of the previous scroll position flashing
//      before the reset.
// Local helper — resets every plausible scroll-controlling element to top.
// Different browsers + iOS versions own scroll on different elements (window,
// documentElement, body), so we hit all three. Cheap and idempotent.
function resetScrollTop() {
  try { window.scrollTo(0, 0) } catch (_) { /* no-op */ }
  if (document.documentElement) document.documentElement.scrollTop = 0
  if (document.body) document.body.scrollTop = 0
}

function ScrollToTop() {
  const { pathname } = useLocation()

  // Defensive double-set: index.html already pins this before React loads,
  // but we redo it here in case a third-party library has flipped it back.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Three-pass reset on every pathname change:
  //   1. useLayoutEffect — sync, before paint, hits the common case
  //   2. useEffect       — post-paint, catches any sync re-layout that
  //                        scrolled before paint completed
  //   3. requestAnimationFrame — next frame, catches async content shifts
  //                              (lazy-loaded data, focus side effects,
  //                              measurements after first render)
  // One of the three lands even when the others miss. Cost is negligible.
  useLayoutEffect(() => {
    resetScrollTop()
  }, [pathname])

  useEffect(() => {
    resetScrollTop()
    const raf = requestAnimationFrame(resetScrollTop)
    return () => cancelAnimationFrame(raf)
  }, [pathname])

  // bfcache restore path — effects above don't re-run, so we hook pageshow.
  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) resetScrollTop()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  return null
}

// Global pageview listener — fires track.pageViewed({ path }) on every route
// change. The acquisition-funnel pageviews on Landing and HowItWorks already
// fire from those screens with funnel_id='acquisition' attached, so we skip
// them here to avoid double-counting (and to keep the funnel rollup unchanged).
// /admin is also skipped — Chris reading his own dashboard shouldn't pollute
// the page-visits count it's measuring.
function TrackPageViews() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Internal Supabase analytics: landing + /how-it-works fire their own
    // funnel events with funnel_id='acquisition', so we skip them here to
    // avoid double-counting. /admin is Chris's own dashboard.
    const skipInternal =
      pathname === '/' || pathname === '/how-it-works' || pathname.startsWith('/admin')
    if (!skipInternal) {
      track.pageViewed({ path: pathname })
    }

    // Google Analytics page_view: we DO want landing + how-it-works here
    // since those are the marketing surfaces GA is measuring. Still skip
    // /admin so Chris reading his own dashboard doesn't pollute the data.
    if (!pathname.startsWith('/admin')) {
      gaPageView(pathname)
    }
  }, [pathname])
  return null
}

// AdminGuard gates /admin on email allowlist membership. Lives outside
// ProtectedLayout so we don't drag in HouseholdProvider/UpgradeGateProvider —
// admin is a tools surface and doesn't need household state. Mirrors
// PublicRoute's loading-spinner pattern: render <div /> while auth is still
// resolving, redirect non-admins to /home.
function AdminGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div />
  if (!user) return <Navigate to="/" replace />
  const email = (user.email ?? '').toLowerCase()
  if (!ADMIN_EMAILS.has(email)) return <Navigate to="/home" replace />
  return children
}

// ProtectedLayout is the shared parent for every authed route. Written as a
// *layout route* (rendered via <Outlet />) rather than a wrapper component, so
// the HouseholdProvider mounts ONCE on first entry to a protected screen and
// stays mounted across /home ↔ /inventory ↔ /add-item ↔ … navigation.
//
// The prior shape — `<Route element={<ProtectedRoute><Home /></ProtectedRoute>} />`
// — put HouseholdProvider inside each route's element tree. Because Router
// unmounts the previous route's element on navigation, the provider unmounted
// and remounted on every route change, re-running memberships + babies queries
// every time. The context's "survives navigation" promise only holds when the
// provider itself isn't torn down, which requires the layout-route shape.
//
// HouseholdProvider needs a valid user before it can query household_members,
// so the auth gate stays here (above the provider). IvyDecoration is fixed-
// positioned with pointer-events:none, so it lives alongside <Outlet /> without
// a wrapping layout container. Hidden on narrow viewports via its own CSS.
function ProtectedLayout() {
  const { user, loading } = useAuth()
  usePushNotifications()
  if (loading) return <div />
  if (!user) return <Navigate to="/" replace />
  // UpgradeGateProvider sits inside ProtectedLayout so the gate is mounted
  // on every authed route (where writes that need a real account live)
  // but isn't loaded for unauth pages. The provider reads `isAnonymous`
  // from useAuth to decide whether to intercept actions; its modal lives
  // alongside the routed Outlet and overlays everything when triggered.
  return (
    <HouseholdProvider>
      <UpgradeGateProvider>
        <AppShell>
          <Outlet />
        </AppShell>
        <IvyDecoration />
        {/* TrialBanner self-gates on isAnonymous and renders nothing for
            permanent users. Mounted here (not per-screen) so the
            affordance is consistent across every authed surface. Sits
            inside UpgradeGateProvider so its tap handler can call
            triggerUpgrade. */}
        <TrialBanner />
      </UpgradeGateProvider>
    </HouseholdProvider>
  )

}

// PublicRoute redirects already-signed-in visitors away from /, /signup, and
// /login. By default that destination is /home. But when a ?next= query
// param is present (set by AcceptInvite when an unauthed visitor needs to
// sign up before accepting), we honour it so the user lands on the intended
// destination instead. Without this, the auth-state-flip race after signUp
// can beat Signup.jsx's imperative navigate(nextPath), dumping the brand-
// new invitee on /home — where the Home onboarding gate sees a step-0 user
// and bounces them into /onboarding. Same whitelist semantics as the
// safeNext() helpers in Login/Signup.
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div />
  if (user) {
    const raw = new URLSearchParams(location.search).get('next')
    const safe = raw && typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')
      ? raw
      : '/home'
    return <Navigate to={safe} replace />
  }
  return children
}

// RootIndex resolves what "/" renders. On the web that's the full marketing
// Landing page. In the native app the App Store listing already does the
// landing page's job, so logged-out users get the focused /welcome screen
// instead. Logged-in users never reach here — PublicRoute redirects them to
// /home first.
function RootIndex() {
  if (Capacitor.isNativePlatform()) {
    return <Navigate to="/welcome" replace />
  }
  return <Landing />
}

function AppRoutes() {
  return (
    <Routes>
      {/* LandingLayout wraps the two marketing/SEO routes so the IvyDecoration
          mounted inside the layout persists across navigation between them.
          Without this wrapper, the desktop ivy's 9-second grow animation
          restarted every time the user clicked "How it works" from the
          landing nav. Other public routes (Signup, Login, etc.) are
          intentionally left outside — they don't render ivy. */}
      <Route element={<LandingLayout />}>
        <Route path="/" element={<PublicRoute><RootIndex /></PublicRoute>} />
        {/* /how-it-works, /about, /contact are public marketing/SEO pages.
            Unguarded so authed and unauthed visitors both reach them;
            PublicRoute would bounce authed users to /home and break inbound
            search traffic + footer links from inside the app. */}
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        {/* /privacy and /terms are public legal pages. Same LandingLayout
            wrapper as /about + /contact so they get the marketing nav and
            footer (which links back to them, intentionally circular). */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* /find-registry — public registry search. Gift-givers can find a
            household's registry by parent name without needing the direct share link.
            Inside LandingLayout so it inherits marketing nav + footer. */}
        <Route path="/find-registry" element={<FindRegistry />} />
      </Route>
      {/* /welcome — the native app's entry for logged-out users: a focused
          get-started screen instead of the marketing Landing. Outside
          LandingLayout so it carries no marketing nav, footer, or ivy. */}
      <Route path="/welcome" element={<PublicRoute><NativeWelcome /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      {/* /reset-password is unguarded — it needs to render whether the user is signed in (recovery session) or not (expired link), and handles both cases itself. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* /invite/:token is also unguarded. Unauthed visitors see the invite
          preview and a Sign in / Sign up CTA (with ?next= to return here);
          signed-in visitors see Accept (or a mismatched-email warning). It
          must NOT live inside PublicRoute (would bounce signed-in recipients
          to /home before they could accept) or ProtectedLayout (would block
          unauthed recipients before they could see the preview). */}
      <Route path="/invite/:token" element={<AcceptInvite />} />
      {/* /wishlist/:token — public registry link, no auth required.
          Full recipient UI in task #15; WishlistPublic is currently a
          placeholder that confirms the link resolves correctly. */}
      <Route path="/wishlist/:token" element={<WishlistPublic />} />
      {/* All authed routes share ProtectedLayout so HouseholdProvider stays
          mounted across navigation. Adding a new authed screen? Add it as a
          child of this route, not as its own top-level <Route>. */}
      <Route element={<ProtectedLayout />}>
        <Route path="/onboarding/*" element={<Onboarding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/slot/:ageRange/:slotId" element={<SlotDetail />} />
        <Route path="/add-item" element={<AddItem />} />
        <Route path="/item/:id" element={<ItemDetail />} />
        {/* /item/:id/edit reuses the AddItem form in edit mode. AddItem
            reads the :id path param to branch between INSERT and UPDATE. */}
        <Route path="/item/:id/edit" element={<AddItem />} />
        {/* Community exchange — /pass-along is the hub (list of all the
            household's batches + "start a new batch" CTA). /pass-along/:id
            is the per-batch detail screen. Order matters: the :id route
            must come second so the bare /pass-along string matches the
            list, not a batch with id "/pass-along". */}
        <Route path="/pass-along" element={<PassAlongList />} />
        <Route path="/pass-along/:id" element={<PassAlongBatch />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      {/* /admin is gated by AdminGuard (email allowlist) and lives outside
          ProtectedLayout — it's a tools surface that doesn't need
          HouseholdProvider/UpgradeGateProvider/TrialBanner. The Admin screen
          handles its own internal tabbing for visits/funnel/households. */}
      <Route path="/admin/*" element={<AdminGuard><Admin /></AdminGuard>} />
      {/* Catch-all 404. Replaces the previous silent <Navigate to="/">
          which dropped users on the landing with no explanation. NotFound
          tracks the bad URL via analytics + offers smart recovery links
          based on auth state (authed users see /home/inventory/etc;
          unauthed users see marketing surfaces). */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  // ErrorBoundary wraps EVERYTHING — including AuthProvider — so a render
  // throw anywhere in the tree (auth listener side-effects, RouterProvider
  // internals, deep component bugs) gets caught and shown a graceful
  // fallback instead of a white page. The boundary uses inline styles +
  // window.location for navigation so it works even when CSS bundles or
  // react-router's runtime is what failed.
  return (
    <ErrorBoundary>
      <AppSplash />
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <TrackPageViews />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}