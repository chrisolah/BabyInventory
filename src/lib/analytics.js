import { supabase, currentSchema } from './supabase'

function getSessionId() {
  // Brand-prefixed storage key. Was `ll_session_id` (Littleloop legacy);
  // renamed 2026-05-05 ahead of soft launch. The rename costs existing
  // session continuity (any open tab on the old key gets a new sessionId
  // on next visit) — acceptable tradeoff post-prod-wipe with effectively
  // zero real users yet.
  let sessionId = sessionStorage.getItem('sl_session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('sl_session_id', sessionId)
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

  // Onboarding funnel (4-step flow as of 2026-06-25: household → baby → receiving → scan).
  // Step numbers reflect the current flow. Historical events from removed steps
  // (size_mode_selected removed 2026-04-25, invite_sent removed 2026-06-25) remain
  // in the DB and are visible in historical funnel windows but no longer emitted.
  onboardingStarted: () =>
    logEvent('onboarding_started', 'onboarding', {}, { id: 'onboarding', step: 1 }),
  householdNamed: () =>
    logEvent('household_named', 'onboarding', {}, { id: 'onboarding', step: 2 }),
  babyAdded: (props) =>
    logEvent('baby_added', 'onboarding', props, { id: 'onboarding', step: 3 }),
  babiesAddedOnboarding: (props) =>
    logEvent('babies_added_onboarding', 'onboarding', props),
  onboardingCompleted: () =>
    logEvent('onboarding_completed', 'onboarding', {}, { id: 'onboarding', step: 4 }),
  firstItemAdded: (props) =>
    logEvent('first_item_added', 'onboarding', props, { id: 'onboarding', step: 5 }),
  // Scan step is opt-in; track engagement vs skip separately.
  // `onboarding_scan_completed` covers both single-scan and batch paths — `mode` carries which one.
  onboardingScanSkipped: () =>
    logEvent('onboarding_scan_skipped', 'onboarding', {}),
  onboardingScanCompleted: (props) =>
    logEvent('onboarding_scan_completed', 'onboarding', props),

  addItemStarted: (props) =>
    logEvent('add_item_started', 'inventory', props, { id: 'add_item', step: 1 }),
  // Photo-scan add-item (Phase 1). `from` is 'home' | 'add_item' | 'onboarding'.
  // `filled` is the whitelisted field count returned by the model. `error` is
  // the Edge Function error code when the scan fails. Kept outside the
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
  // Recipient-side invite events. `accept_opened` fires once per /invite/:token
  // page view (regardless of status branch — measures CTR of the email link).
  // `accept_completed` fires only when accept_invite() returns success.
  // `accept_failed` carries the backend exception string so we can spot
  // expired-link / wrong-email patterns without a full event drilldown.
  householdInviteAcceptOpened: () =>
    logEvent('household_invite_accept_opened', 'engagement', {}),
  householdInviteAcceptCompleted: () =>
    logEvent('household_invite_accept_completed', 'engagement', {}),
  householdInviteAcceptFailed: (props) =>
    logEvent('household_invite_accept_failed', 'engagement', props),
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
  // ('family' | 'person' | 'charity') so we can compare which path parents
  // actually choose. (Legacy 'littleloop' was merged into 'family' in
  // migration 016.) Item counts let us learn what a
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

  // ── Anonymous-trial upgrade gate (Phase 2 of the anon-trial flow) ──
  // Fires whenever the upgrade modal blocks a write while the user is
  // still anonymous, plus key step transitions inside the modal. Lets
  // us answer two product questions:
  //   • Conversion rate: of users who hit the gate, what fraction
  //     actually finish the OTP verification? (gate_opened → completed)
  //   • Drop-off step: among dismissals, are users bailing before they
  //     enter their email or after seeing the OTP step?
  // The `step` prop on opened/dismissed carries 'email' | 'code' so the
  // funnel can be sliced by where the user was in the flow.
  upgradeModalOpened: (props) =>
    logEvent('upgrade_modal_opened', 'engagement', props),
  upgradeEmailRequested: (props) =>
    logEvent('upgrade_email_requested', 'engagement', props),
  upgradeCompleted: (props) =>
    logEvent('upgrade_completed', 'engagement', props),
  upgradeModalDismissed: (props) =>
    logEvent('upgrade_modal_dismissed', 'engagement', props),
  // TrialBanner tap — proactive upgrade trigger from the persistent
  // bottom banner (vs. reactive trigger when a save action hits the
  // gate). Splitting the events lets the funnel distinguish "visitor
  // upgraded because they wanted to lock in their data" from "visitor
  // upgraded because they bumped into the gate." Different intent
  // signals.
  trialBannerTapped: (props) =>
    logEvent('trial_banner_tapped', 'engagement', props),

  // ── Outgrown / kept transitions (added 2026-04-29 with the kept fork) ──
  // The new flow forks every outgrown moment into one of two paths:
  //   - Pass on  → directly into a draft bag (tracked via passAlongItemAdded
  //                with from='inventory_inline' or 'outgrown_section_chip')
  //   - Tuck away → flips inventory_status to 'kept' (itemTuckedAway below)
  // intentFlipped fires when a user reclassifies an item already in the
  // Outgrown section (e.g. tapping the Pass on chip on a kept row to send
  // it after all). Tells us how often the parent's first-tap intent gets
  // revised after-the-fact — informs whether the inline two-chip choice is
  // the right fork point or whether a chooser would land more decisions
  // correctly the first time.
  itemTuckedAway: (props) =>
    logEvent('item_tucked_away', 'engagement', props),
  itemTuckedAwayUndone: (props) =>
    logEvent('item_tucked_away_undone', 'engagement', props),
  itemReturnedToOwned: (props) =>
    logEvent('item_returned_to_owned', 'engagement', props),
  intentFlipped: (props) =>
    logEvent('intent_flipped', 'engagement', props),

  // ── Guides + affiliate ────────────────────────────────────────────────
  // guideRead fires when a guide detail page loads (supplement to page_viewed
  // — this carries the slug directly for easier guide-level queries).
  guideRead: (props) =>
    logEvent('guide_read', 'content', props),
  // affiliateLinkClicked fires whenever a product card in a guide is tapped.
  // `guide` is the slug, `product` is the product name, `url` is the dest.
  affiliateLinkClicked: (props) =>
    logEvent('affiliate_link_clicked', 'content', props),
  // guidePlanLinkClicked fires when the "Read our guide" link in the Plan tab
  // is tapped — tells us how often in-app guide surfacing drives reads.
  guidePlanLinkClicked: (props) =>
    logEvent('guide_plan_link_clicked', 'content', props),
}

export { getSessionId }