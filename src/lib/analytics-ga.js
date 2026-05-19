// Google Analytics 4 wiring.
//
// Gated on presence of VITE_GA_MEASUREMENT_ID. We set this env var only on
// Vercel for the production project (sprigloop-prod), so beta and local dev
// stay out of GA automatically without a separate env check. If the var is
// missing, init() is a no-op and no script tag is injected.
//
// We disable automatic page_view at config time and fire page_view manually
// from App.jsx's TrackPageViews component, because BrowserRouter does in-app
// navigations that gtag's auto-tracking can't see. This also lets us skip
// /admin (Chris's own dashboard) without polluting his marketing metrics.

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

let initialized = false

export function initGA() {
  if (initialized) return
  if (!MEASUREMENT_ID) return
  if (typeof window === 'undefined') return

  // Standard gtag bootstrap. dataLayer must exist before gtag.js loads,
  // because the inline `gtag()` calls below queue commands into it that the
  // script picks up when it executes.
  window.dataLayer = window.dataLayer || []
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag

  gtag('js', new Date())
  // send_page_view:false so we own page-view firing from TrackPageViews;
  // otherwise GA would record one initial page_view and then miss every
  // subsequent React Router navigation.
  gtag('config', MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)

  initialized = true
}

export function gaPageView(path) {
  if (!MEASUREMENT_ID) return
  if (typeof window === 'undefined' || !window.gtag) return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}
