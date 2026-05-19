import './styles/globals.css'
import React from 'react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initGA } from './lib/analytics-ga'

// Inject gtag.js once at boot. No-ops if VITE_GA_MEASUREMENT_ID is unset, so
// beta/local builds never load Google Analytics. Page_view events are fired
// from App.jsx's TrackPageViews so SPA navigations register.
initGA()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)