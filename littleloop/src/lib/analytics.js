import { supabase } from './supabase'

// Session ID persisted for the lifetime of the browser session.
// Used to stitch anonymous events to a user_id on signup.
function getSessionId() {
  let sessionId = sessionStorage.getItem('ll_session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('ll_session_id', sessionId)
  }
  return sessionId
}

function getDeviceType() {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'web'
}

// Queue for offline/failed events — flushed on next successful write
const eventQueue = []

async function flushQueue() {
  if (eventQueue.length === 0) return
  const batch = [...eventQueue]
  eventQueue.length = 0
  try {
    await supabase.from('events').insert(batch)
  } catch {
    // If flush fails, re-queue (up to 50 events max to avoid memory issues)
    if (eventQueue.length < 50) {
      eventQueue.push(...batch)
    }
  }
}

/**
 * Log an analytics event.
 * Fire-and-forget — never throws, never blocks the UI.
 *
 * @param {string} eventName   e.g. 'signup_completed'
 * @param {string} eventGroup  e.g. 'acquisition'
 * @param {object} properties  Any event-specific data
 * @param {object} funnel      Optional: { id: 'acquisition', step: 5 }
 */
export async function logEvent(eventName, eventGroup, properties = {}, funnel = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const event = {
      session_id: getSessionId(),
      device_type: getDeviceType(),
      event_name: eventName,
      event_group: eventGroup,
      properties,
      user_id: user?.id ?? null,
      funnel_id: funnel?.id ?? null,
      funnel_step: funnel?.step ?? null,
    }

    // Try direct insert first
    const { error } = await supabase.from('events').insert(event)

    if (error) {
      // Queue for retry
      eventQueue.push(event)
    } else {
      // Flush any queued events on a successful write
      flushQueue()
    }
  } catch {
    // Silently swallow all errors — analytics must never break the app
  }
}

// Convenience wrappers for each funnel
export const track = {
  // Acquisition funnel
  pageViewed: (props = {}) =>
    logEvent('page_viewed', 'acquisition', props, { id: 'acquisition', step: 1 }),
  ctaClicked: (cta) =>
    logEvent('cta_clicked', 'acquisition', { cta }, { id: 'acquisition', step: 2 }),
  signupPageViewed: () =>
    logEvent('signup_page_viewed', 'acquisition', {}, { id: 'acquisition', step: 3 }),
  signupStarted: () =>
    logEvent('signup_started', 'acquisition', {}, { id: 'acquisition', step: 4 }),
  signupCompleted: () =>
    logEvent('signup_completed', 'acquisition', { method: 'email' }, { id: 'acquisition', step: 5 }),

  // Onboarding funnel
  onboardingStarted: () =>
    logEvent('onboarding_started', 'onboarding', {}, { id: 'onboarding', step: 1 }),
  householdNamed: () =>
    logEvent('household_named', 'onboarding', {}, { id: 'onboarding', step: 2 }),
  babyAdded: (props) =>
    logEvent('baby_added', 'onboarding', props, { id: 'onboarding', step: 3 }),
  sizeModeSelected: (mode) =>
    logEvent('size_mode_selected', 'onboarding', { mode }, { id: 'onboarding', step: 4 }),
  inviteSent: (skipped) =>
    logEvent('invite_sent', 'onboarding', { skipped }, { id: 'onboarding', step: 5 }),
  onboardingCompleted: () =>
    logEvent('onboarding_completed', 'onboarding', {}, { id: 'onboarding', step: 6 }),
  firstItemAdded: (props) =>
    logEvent('first_item_added', 'onboarding', props, { id: 'onboarding', step: 7 }),

  // Inventory
  addItemStarted: (props) =>
    logEvent('add_item_started', 'inventory', props, { id: 'add_item', step: 1 }),
  itemCategorySelected: (category) =>
    logEvent('item_category_selected', 'inventory', { category }, { id: 'add_item', step: 2 }),
  itemSizeSelected: (size) =>
    logEvent('item_size_selected', 'inventory', { size }, { id: 'add_item', step: 3 }),
  itemQuantitySet: (props) =>
    logEvent('item_quantity_set', 'inventory', props, { id: 'add_item', step: 4 }),
  itemSaved: (props) =>
    logEvent('item_saved', 'inventory', props, { id: 'add_item', step: 5 }),
  itemMarkedOutgrown: (props) =>
    logEvent('item_marked_outgrown', 'inventory', props),
  gapAlertViewed: (props) =>
    logEvent('gap_alert_viewed', 'inventory', props),
  gapAlertActioned: (props) =>
    logEvent('gap_alert_actioned', 'inventory', props),

  // Engagement
  appOpened: (screen) =>
    logEvent('app_opened', 'engagement', { screen }),
  recommendationViewed: (props) =>
    logEvent('recommendation_viewed', 'engagement', props),
  recommendationClicked: (props) =>
    logEvent('recommendation_clicked', 'engagement', props),
}

// Export session ID so it can be passed to Supabase on signup
export { getSessionId }
