-- Migration: admin_page_breakdown RPC
-- Adds two new admin-only RPCs for the Pages tab in the admin dashboard:
--
--   admin_page_breakdown  — traffic per page (sessions + unique users)
--   admin_guide_breakdown — per-guide reads + affiliate clicks
--
-- Both gate on is_admin() server-side (same pattern as existing admin RPCs).

-- ── admin_page_breakdown ──────────────────────────────────────────────────────
-- Groups page_viewed events by the `page` property in the JSON `properties`
-- column. Returns sessions (unique session_ids) and users (unique user_ids)
-- per page, sorted by sessions desc.

CREATE OR REPLACE FUNCTION beta.admin_page_breakdown(
  _since_days  integer DEFAULT 7,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  page     text,
  sessions bigint,
  users    bigint,
  events   bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    COALESCE(properties->>'page', 'unknown') AS page,
    COUNT(DISTINCT session_id)               AS sessions,
    COUNT(DISTINCT user_id)                  AS users,
    COUNT(*)                                 AS events
  FROM beta.events
  WHERE
    event_name = 'page_viewed'
    AND created_at >= NOW() - (_since_days || ' days')::interval
    AND (
      NOT _exclude_admins
      OR user_id IS NULL
      OR NOT beta.is_admin(user_id)
    )
  GROUP BY 1
  ORDER BY sessions DESC;
$$;

REVOKE ALL ON FUNCTION beta.admin_page_breakdown FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.admin_page_breakdown TO authenticated;


-- ── admin_guide_breakdown ─────────────────────────────────────────────────────
-- Per-guide reads (guide_read events) and affiliate link clicks, for the
-- last N days. Returns one row per guide slug.

CREATE OR REPLACE FUNCTION beta.admin_guide_breakdown(
  _since_days  integer DEFAULT 30,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  slug              text,
  reads             bigint,
  unique_readers    bigint,
  affiliate_clicks  bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    slug,
    reads,
    unique_readers,
    COALESCE(a.clicks, 0) AS affiliate_clicks
  FROM (
    SELECT
      properties->>'slug' AS slug,
      COUNT(*)             AS reads,
      COUNT(DISTINCT session_id) AS unique_readers
    FROM beta.events
    WHERE
      event_name = 'guide_read'
      AND created_at >= NOW() - (_since_days || ' days')::interval
      AND (
        NOT _exclude_admins
        OR user_id IS NULL
        OR NOT beta.is_admin(user_id)
      )
    GROUP BY 1
  ) r
  LEFT JOIN (
    SELECT
      properties->>'guide' AS slug,
      COUNT(*) AS clicks
    FROM beta.events
    WHERE
      event_name = 'affiliate_link_clicked'
      AND created_at >= NOW() - (_since_days || ' days')::interval
    GROUP BY 1
  ) a USING (slug)
  ORDER BY reads DESC;
$$;

REVOKE ALL ON FUNCTION beta.admin_guide_breakdown FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.admin_guide_breakdown TO authenticated;
