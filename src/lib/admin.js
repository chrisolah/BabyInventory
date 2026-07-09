// Thin client wrapper around the admin SECURITY DEFINER RPCs declared in
// migration 20260501120000_admin_views.sql. Each call gates server-side on
// beta.is_admin() — a non-admin caller will get an "admin only" error. The
// AdminGuard route guard provides the matching client-side gate.

import { supabase, currentSchema } from './supabase'

/**
 * Daily visits roll-up.
 * @param {{ sinceDays?: number, excludeAdmins?: boolean }} opts
 * @returns {Promise<{ day: string, sessions: number, users: number, events: number }[]>}
 */
export async function getDailyVisits({ sinceDays = 7, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_daily_visits', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Funnel step roll-up. funnelId must match a value used in analytics.js
 * (currently: 'acquisition', 'onboarding', 'add_item', 'login').
 * @param {string} funnelId
 * @param {{ sinceDays?: number, excludeAdmins?: boolean }} opts
 * @returns {Promise<{ step: number, event_name: string, sessions: number, users: number }[]>}
 */
export async function getFunnelRollup(funnelId, { sinceDays = 7, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_funnel_rollup', {
      _funnel_id: funnelId,
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Per-household roll-up — one row per household with member emails, baby
 * names, item count, and last_event_at. Sorted by most-recent-activity.
 * @param {{ excludeAdmins?: boolean }} opts
 * @returns {Promise<Array<{
 *   household_id: string, household_name: string|null,
 *   member_count: number, member_emails: string[],
 *   baby_count: number, baby_names: string[],
 *   item_count: number,
 *   last_event_at: string|null, created_at: string
 * }>>}
 */
export async function getHouseholdSummary({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_household_summary', {
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

// Funnels available in the dashboard. Order = display order. Labels are
// what shows in the dropdown; ids match the funnel_id column in beta.events.
export const FUNNELS = [
  { id: 'acquisition', label: 'Acquisition' },
  { id: 'onboarding',  label: 'Onboarding'  },
  { id: 'add_item',    label: 'Add Item'    },
  { id: 'login',       label: 'Login'       },
]

/**
 * Page-level traffic breakdown — unique sessions + users per page.
 */
export async function getPageBreakdown({ sinceDays = 7, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_page_breakdown', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Daily guide read counts for the Guides tab chart.
 * Returns: { day: string, reads: number, unique_readers: number }[]
 */
export async function getGuideReadsByDay({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_guide_reads_daily', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Per-guide reads and affiliate clicks.
 */
export async function getGuideBreakdown({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_guide_breakdown', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

// ── Growth metrics ────────────────────────────────────────────────────────────

export async function getActivationFunnel({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_activation_funnel', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getTimeToFirstItem({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_time_to_first_item', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data?.[0] ?? null
}

export async function getAnonConversion() {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_anon_conversion')
  if (error) throw error
  return data?.[0] ?? null
}

export async function getRegistryShareRate({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_share_rate', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data?.[0] ?? null
}

export async function getRetention({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_retention', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getCategoryDepth({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_category_depth', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getPassAlongFunnel({ excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_pass_along_funnel', { _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getReferrerBreakdown({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_referrer_breakdown', { _since_days: sinceDays, _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

/**
 * Overall auth split — logged-in vs anonymous sessions/users/page_views.
 * Returns two rows: { auth_state: 'logged_in' | 'anonymous', sessions, users, page_views, events_total }
 */
export async function getAuthSplit({ sinceDays = 7, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_auth_split', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Per-page auth split — logged-in vs anonymous sessions per page.
 * Returns: { page, logged_in_sessions, anon_sessions, total_sessions }[]
 */
export async function getPageAuthSplit({ sinceDays = 7, excludeAdmins = true } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_page_auth_split', {
      _since_days: sinceDays,
      _exclude_admins: excludeAdmins,
    })
  if (error) throw error
  return data ?? []
}

/**
 * Event stream for all members of a household (newest first, max 150).
 * Returns: { created_at, event_name, event_group, properties, device_type, user_email }[]
 */
export async function getHouseholdEventStream({ householdId, limit = 150 } = {}) {
  const { data, error } = await supabase
    .schema(currentSchema)
    .rpc('admin_household_event_stream', {
      _household_id: householdId,
      _limit: limit,
    })
  if (error) throw error
  return data ?? []
}

// ── Registry activity (recipient-side: /registry/:token) ───────────────────
// Backed by 20260709000000_admin_registry_analytics.sql. Views + product
// clicks come from beta.events (registry_page_viewed / registry_product_clicked,
// added to analytics.js the same day); claims read beta.wishlist_claims
// directly since that table already records every claim.

export async function getRegistryOverview({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_overview', { _since_days: sinceDays, _exclude_admins: excludeAdmins })
  if (error) throw error
  return data?.[0] ?? null
}

export async function getRegistryViewsDaily({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_views_daily', { _since_days: sinceDays, _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getRegistryClaimsDaily({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_claims_daily', { _since_days: sinceDays, _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getRegistryProductClicks({ sinceDays = 30, excludeAdmins = true } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_product_clicks', { _since_days: sinceDays, _exclude_admins: excludeAdmins })
  if (error) throw error
  return data ?? []
}

export async function getRegistryLeaderboard({ sinceDays = 30, excludeAdmins = true, limit = 10 } = {}) {
  const { data, error } = await supabase.schema(currentSchema)
    .rpc('admin_registry_leaderboard', { _since_days: sinceDays, _exclude_admins: excludeAdmins, _limit: limit })
  if (error) throw error
  return data ?? []
}

// Time-window chips for the toolbar. `days = null` means "no upper bound" —
// passed to the RPC as a very large number so we get everything.
export const TIME_WINDOWS = [
  { id: '24h', label: '24h', days: 1   },
  { id: '7d',  label: '7d',  days: 7   },
  { id: '30d', label: '30d', days: 30  },
  { id: 'all', label: 'All', days: 3650 }, // 10y — effectively unlimited
]
