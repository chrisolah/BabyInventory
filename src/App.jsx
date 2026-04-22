import { useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { HouseholdProvider } from './contexts/HouseholdContext'
import './styles/globals.css'

import Landing from './screens/Landing'
import Signup from './screens/Signup'
import Login from './screens/Login'
import ResetPassword from './screens/ResetPassword'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Inventory from './screens/Inventory'
import SlotDetail from './screens/SlotDetail'
import AddItem from './screens/AddItem'
import ItemDetail from './screens/ItemDetail'
import Profile from './screens/Profile'
import IvyDecoration from './components/IvyDecoration'

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
function ScrollToTop() {
  const { pathname } = useLocation()

  // One-time: take scroll restoration out of the browser's hands.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // Fires on initial mount AND on every subsequent pathname change.
  useLayoutEffect(() => {
    // Legacy 2-arg form — works on every mobile browser we care about.
    window.scrollTo(0, 0)
    // Belt-and-suspenders for the cases where the scrolling element is
    // <html> or <body> directly (varies by iOS version + engine mode).
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [pathname])

  // bfcache restore path — effects above don't re-run, so we hook pageshow.
  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) {
        window.scrollTo(0, 0)
        if (document.documentElement) document.documentElement.scrollTop = 0
        if (document.body) document.body.scrollTop = 0
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  return null
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div />
  if (!user) return <Navigate to="/" replace />
  // HouseholdProvider wraps every authed route so household + babies load
  // once, and the baby-switcher selection survives navigation. Placed
  // inside the auth gate because the provider needs a valid user before it
  // can query household_members.
  //
  // IvyDecoration is fixed-positioned with pointer-events:none, so it lives
  // alongside children without wrapping them in a layout container. Hidden
  // on narrow viewports via its own CSS.
  return (
    <HouseholdProvider>
      {children}
      <IvyDecoration />
    </HouseholdProvider>
  )
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div />
  if (user) return <Navigate to="/home" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      {/* /reset-password is unguarded — it needs to render whether the user is signed in (recovery session) or not (expired link), and handles both cases itself. */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding/*" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/inventory/slot/:ageRange/:slotId" element={<ProtectedRoute><SlotDetail /></ProtectedRoute>} />
      <Route path="/add-item" element={<ProtectedRoute><AddItem /></ProtectedRoute>} />
      <Route path="/item/:id" element={<ProtectedRoute><ItemDetail /></ProtectedRoute>} />
      {/* /item/:id/edit reuses the AddItem form in edit mode. AddItem
          reads the :id path param to branch between INSERT and UPDATE. */}
      <Route path="/item/:id/edit" element={<ProtectedRoute><AddItem /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}