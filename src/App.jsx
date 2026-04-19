import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import './styles/globals.css'

// Screens — to be built out
import Landing from './screens/Landing'
import Signup from './screens/Signup'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import Inventory from './screens/Inventory'

// Route guard — redirects unauthenticated users to landing
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen" />
  if (!user) return <Navigate to="/" replace />
  return children
}

// Route guard — redirects authenticated users away from auth screens
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen" />
  if (user) return <Navigate to="/home" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/onboarding/*" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
