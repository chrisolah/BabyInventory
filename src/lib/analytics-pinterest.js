// Pinterest conversion tag wiring.
//
// Gated on presence of VITE_PINTEREST_TAG_ID, same pattern as GA4
// (analytics-ga.js) — set only on Vercel for the production project
// (sprigloop-prod), so beta and local dev stay out of Pinterest tracking
// automatically. If the var is missing, init() is a no-op and no script
// tag is injected.
//
// Like GA, we fire the page view manually from App.jsx's TrackPageViews
// component rather than relying on any auto-tracking, since this is a
// single-page app and Pinterest's snippet has no notion of client-side
// route changes on its own — without this, Pinterest would only ever see
// the first page a visitor lands on.
//
// Deliberately NOT included: the `em` (hashed email) field on the load
// call, and the <noscript> pixel fallback from Pinterest's snippet. The em
// field is for "enhanced match" once a specific user's email is known —
// there's no signed-in user at initial page load, and passing a literal
// placeholder string would be worse than omitting it. The noscript pixel
// is meaningless here since the entire app is client-rendered — a visitor
// without JS sees nothing regardless, app or pixel.

const TAG_ID = import.meta.env.VITE_PINTEREST_TAG_ID

let initialized = false

export function initPinterestTag() {
  if (initialized) return
  if (!TAG_ID) return
  if (typeof window === 'undefined') return

  // Standard pintrk bootstrap (Pinterest's own snippet, adapted) — queues
  // calls into window.pintrk until core.js loads and drains the queue.
  window.pintrk = window.pintrk || function () {
    window.pintrk.queue.push(Array.prototype.slice.call(arguments))
  }
  window.pintrk.queue = window.pintrk.queue || []
  window.pintrk.version = '3.0'

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://s.pinimg.com/ct/core.js'
  const firstScript = document.getElementsByTagName('script')[0]
  firstScript.parentNode.insertBefore(script, firstScript)

  window.pintrk('load', TAG_ID)

  initialized = true
}

export function pinterestPageView() {
  if (!TAG_ID) return
  if (typeof window === 'undefined' || !window.pintrk) return
  window.pintrk('page')
}
