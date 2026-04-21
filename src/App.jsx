import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
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
import IvyDecoration from './components/IvyDecoration'

// React Router v6 doesn't auto-scroll to the top on route change, so
// scroll position carries between pages. Most noticeable on mobile:
// after scrolling down the Login form to tap submit, you'd land on
// /home with the page already scrolled past the sticky header, making
// it look like the header was missing. This effect resets scroll to
// the top every time pathname changes.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // `instant` avoids a smooth-scroll animation on page-to-page jumps,
    // which feels laggy when you've just tapped Log in and expect the
    // next page to start at the top.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div />
  if (!user) return <Navigate to="/" replace />
  // IvyDecoration is fixed-positioned with pointer-events:none, so it lives
  // alongside children without wrapping them in a layout container. Hidden
  // on narrow viewports via its own CSS.
  return <>{children}<IvyDecoration /></>
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