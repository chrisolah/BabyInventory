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

// Time-window chips for the toolbar. `days = null` means "no upper bound" —
// passed to the RPC as a very large number so we get everything.
export const TIME_WINDOWS = [
  { id: '24h', label: '24h', days: 1   },
  { id: '7d',  label: '7d',  days: 7   },
  { id: '30d', label: '30d', days: 30  },
  { id: 'all', label: 'All', days: 3650 }, // 10y — effectively unlimited
]
