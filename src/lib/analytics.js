import { supabase, currentSchema } from './supabase'
console.log('Analytics schema:', currentSchema)
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

const eventQueue = []

async function flushQueue() {
  if (eventQueue.length === 0) return
  const batch = [...eventQueue]
  eventQueue.length = 0
  try {
    await supabase.schema(currentSchema).from('events').insert(batch)
  } catch {
    if (eventQueue.length < 50) {
      eventQueue.push(...batch)
    }
  }
}

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

    const { error } = await supabase.schema(currentSchema).from('events').insert(event)

    if (error) {
      eventQueue.push(event)
    } else {
      flushQueue()
    }
  } catch {
    // Silently swallow all errors — analytics must never break the app
  }
}

export const track = {
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

  onboardingStarted: () =>
    logEvent('onboarding_started', 'onboarding', {}, { id: 'onboarding', step: 1 }),
  householdNamed: () =>
    logEvent('household_named', 'onboarding', {}, { id: 'onboarding', step: 2 }),
  babyAdded: (props) =>
    logEvent('baby_added', 'onboarding', props, { id: 'onboarding', step: 3 }),
  babiesAddedOnboarding: (props) =>
    logEvent('babies_added_onboarding', 'onboarding', props),
  sizeModeSelected: (mode) =>
    logEvent('size_mode_selected', 'onboarding', { mode }, { id: 'onboarding', step: 4 }),
  inviteSent: (skipped) =>
    logEvent('invite_sent', 'onboarding', { skipped }, { id: 'onboarding', step: 5 }),
  onboardingCompleted: () =>
    logEvent('onboarding_completed', 'onboarding', {}, { id: 'onboarding', step: 6 }),
  firstItemAdded: (props) =>
    logEvent('first_item_added', 'onboarding', props, { id: 'onboarding', step: 7 }),

  addItemStarted: (props) =>
    logEvent('add_item_started', 'inventory', props, { id: 'add_item', step: 1 }),
  // Photo-scan add-item (Phase 1). `from` is 'home' | 'add_item'. `filled`
  // is the whitelisted field count returned by the model. `error` is the
  // Edge Function error code when the scan fails. Kept outside the
  // add_item funnel so scan-initiated adds and manual adds show up as
  // distinct paths in the funnel view.
  tagScanStarted: (props) =>
    logEvent('tag_scan_started', 'inventory', props),
  tagScanCompleted: (props) =>
    logEvent('tag_scan_completed', 'inventory', props),
  tagScanFailed: (props) =>
    logEvent('tag_scan_failed', 'inventory', props),
  itemCategorySelected: (category) =>
    logEvent('item_category_selected', 'inventory', { category }, { id: 'add_item', step: 2 }),
  itemSizeSelected: (size) =>
    logEvent('item_size_selected', 'inventory', { size }, { id: 'add_item', step: 3 }),
  itemQuantitySet: (props) =>
    logEvent('item_quantity_set', 'inventory', props, { id: 'add_item', step: 4 }),
  itemSaved: (props) =>
    logEvent('item_saved', 'inventory', props, { id: 'add_item', step: 5 }),
  itemEdited: (props) =>
    logEvent('item_edited', 'inventory', props),
  itemDeleted: (props) =>
    logEvent('item_deleted', 'inventory', props),
  itemMarkedOutgrown: (props) =>
    logEvent('item_marked_outgrown', 'inventory', props),
  gapAlertViewed: (props) =>
    logEvent('gap_alert_viewed', 'inventory', props),
  gapAlertActioned: (props) =>
    logEvent('gap_alert_actioned', 'inventory', props),

  loginPageViewed: () =>
    logEvent('login_page_viewed', 'engagement', {}, { id: 'login', step: 1 }),
  loginStarted: (method) =>
    logEvent('login_started', 'engagement', { method }, { id: 'login', step: 2 }),
  loginCompleted: (method) =>
    logEvent('login_completed', 'engagement', { method }, { id: 'login', step: 3 }),
  passwordResetRequested: () =>
    logEvent('password_reset_requested', 'engagement', {}),
  passwordResetCompleted: () =>
    logEvent('password_reset_completed', 'engagement', {}),

  appOpened: (screen) =>
    logEvent('app_opened', 'engagement', { screen }),
  householdInviteOpened: (from) =>
    logEvent('household_invite_opened', 'engagement', { from }),
  householdInviteSubmitted: (props) =>
    logEvent('household_invite_submitted', 'engagement', props),
  householdRenamed: () =>
    logEvent('household_renamed', 'engagement', {}),
  babyEdited: (props) =>
    logEvent('baby_edited', 'engagement', props),
  babyRemoved: (props) =>
    logEvent('baby_removed', 'engagement', props),
  babyRemovalBlocked: (props) =>
    logEvent('baby_removal_blocked', 'engagement', props),
  babySwitched: (props) =>
    logEvent('baby_switched', 'engagement', props),
  recommendationViewed: (props) =>
    logEvent('recommendation_viewed', 'engagement', props),
  recommendationClicked: (props) =>
    logEvent('recommendation_clicked', 'engagement', props),

  profileNameUpdated: () =>
    logEvent('profile_name_updated', 'engagement', {}),
  profileEmailChangeRequested: () =>
    logEvent('profile_email_change_requested', 'engagement', {}),
  profilePasswordUpdated: () =>
    logEvent('profile_password_updated', 'engagement', {}),
  prefsUpdated: (props) =>
    logEvent('prefs_updated', 'engagement', props),
  householdLeft: (props) =>
    logEvent('household_left', 'engagement', props),
  householdLeaveBlocked: (props) =>
    logEvent('household_leave_blocked', 'engagement', props),
  accountDeletionRequested: () =>
    logEvent('account_deletion_requested', 'engagement', {}),

  // Community exchange — receiver side (opt-in flag lives on the household,
  // matches land via Chris-as-concierge). Split into two events so product
  // analytics can answer two different questions cleanly:
  //   • receiving_opt_in_toggled — what share of households ever opt in,
  //     and how often do they flip back off?
  //   • receiving_preferences_updated — among opted-in households, how
  //     many narrow their preferences vs. stay wide-open?
  receivingOptInToggled: (props) =>
    logEvent('receiving_opt_in_toggled', 'engagement', props),
  receivingPreferencesUpdated: (props) =>
    logEvent('receiving_preferences_updated', 'engagement', props),

  // Community exchange — sender side. Each event carries the destination
  // ('littleloop' | 'family' | 'person' | 'charity') so we can compare
  // which path parents actually choose. Item counts let us learn what a
  // "typical" batch size looks like — informs packaging + concierge load.
  // List-level events: "did the user even enter the hub?" is the first
  // question; "where did the batch get created from?" the second. The
  // `from` prop on passAlongBatchCreated will also carry values like
  // 'inventory' and 'item_detail' once task #4 wires those entry points.
  passAlongListViewed: (props) =>
    logEvent('pass_along_list_viewed', 'engagement', props),
  passAlongBatchCreated: (props) =>
    logEvent('pass_along_batch_created', 'engagement', props),
  // Item-level add event — fired whenever a clothing_items row gets its
  // pass_along_batch_id set. `from` is the entry point ('item_detail',
  // 'inventory_bulk' eventually); `created_new_batch` tells us how often
  // the add auto-created a draft vs. joined an existing one.
  passAlongItemAdded: (props) =>
    logEvent('pass_along_item_added', 'engagement', props),
  passAlongBatchViewed: (props) =>
    logEvent('pass_along_batch_viewed', 'engagement', props),
  passAlongBatchDestinationChanged: (props) =>
    logEvent('pass_along_batch_destination_changed', 'engagement', props),
  passAlongBatchItemRemoved: (props) =>
    logEvent('pass_along_batch_item_removed', 'engagement', props),
  passAlongBatchShipped: (props) =>
    logEvent('pass_along_batch_shipped', 'engagement', props),
  passAlongBatchDeleted: (props) =>
    logEvent('pass_along_batch_deleted', 'engagement', props),
  // Label request is a signal of intent specifically to use Littleloop's
  // concierge path — tracked separately so we can measure the lift over
  // "ship it yourself" once concierge goes live.
  passAlongLabelRequested: (props) =>
    logEvent('pass_along_label_requested', 'engagement', props),
}

export { getSessionId }