-- Migration: admin analytics auth split + household event stream
-- Adds three new SECURITY DEFINER RPCs for the admin dashboard:
--   1. admin_auth_split          — overall logged-in vs anonymous split
--   2. admin_page_auth_split     — per-page split (logged-in vs anonymous)
--   3. admin_household_event_stream — full event history for a household

-- 1. Overall auth split
CREATE OR REPLACE FUNCTION beta.admin_auth_split(
  _since_days     int     DEFAULT 7,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  auth_state   text,
  sessions     bigint,
  users        bigint,
  page_views   bigint,
  events_total bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    CASE WHEN user_id IS NULL THEN 'anonymous' ELSE 'logged_in' END::text AS auth_state,
    COUNT(DISTINCT session_id)::bigint  AS sessions,
    COUNT(DISTINCT user_id)::bigint     AS users,
    COUNT(*) FILTER (WHERE event_name = 'page_viewed')::bigint AS page_views,
    COUNT(*)::bigint                    AS events_total
  FROM beta.events
  WHERE created_at >= now() - (_since_days || ' days')::interval
    AND (
      NOT _exclude_admins
      OR user_id IS NULL
      OR user_id NOT IN (
        SELECT id FROM auth.users WHERE email = ANY(beta._admin_emails())
      )
    )
  GROUP BY 1
  ORDER BY 1 DESC
$$;

GRANT EXECUTE ON FUNCTION beta.admin_auth_split(int, boolean) TO authenticated;

-- 2. Per-page auth split
CREATE OR REPLACE FUNCTION beta.admin_page_auth_split(
  _since_days     int     DEFAULT 7,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  page               text,
  logged_in_sessions bigint,
  anon_sessions      bigint,
  total_sessions     bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    COALESCE((properties->>'page')::text, 'unknown') AS page,
    COUNT(DISTINCT session_id) FILTER (WHERE user_id IS NOT NULL)::bigint AS logged_in_sessions,
    COUNT(DISTINCT session_id) FILTER (WHERE user_id IS NULL)::bigint     AS anon_sessions,
    COUNT(DISTINCT session_id)::bigint                                    AS total_sessions
  FROM beta.events
  WHERE event_name = 'page_viewed'
    AND created_at >= now() - (_since_days || ' days')::interval
    AND (
      NOT _exclude_admins
      OR user_id IS NULL
      OR user_id NOT IN (
        SELECT id FROM auth.users WHERE email = ANY(beta._admin_emails())
      )
    )
  GROUP BY 1
  ORDER BY total_sessions DESC
  LIMIT 20
$$;

GRANT EXECUTE ON FUNCTION beta.admin_page_auth_split(int, boolean) TO authenticated;

-- 3. Household event stream (all members' events, newest first)
CREATE OR REPLACE FUNCTION beta.admin_household_event_stream(
  _household_id uuid,
  _limit        int DEFAULT 150
)
RETURNS TABLE (
  created_at  timestamptz,
  event_name  text,
  event_group text,
  properties  jsonb,
  device_type text,
  user_email  text
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    e.created_at,
    e.event_name::text,
    e.event_group::text,
    e.properties,
    e.device_type::text,
    u.email::text AS user_email
  FROM beta.events e
  LEFT JOIN auth.users u ON u.id = e.user_id
  WHERE e.user_id IN (
    SELECT hm.user_id
    FROM beta.household_members hm
    WHERE hm.household_id = _household_id
      AND hm.user_id IS NOT NULL
  )
  ORDER BY e.created_at DESC
  LIMIT _limit
$$;

GRANT EXECUTE ON FUNCTION beta.admin_household_event_stream(uuid, int) TO authenticated;
