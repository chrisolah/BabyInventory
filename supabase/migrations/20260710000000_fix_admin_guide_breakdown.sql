-- Fix admin_guide_breakdown (introduced 20260604000000_admin_page_breakdown.sql)
--
-- Three bugs found while debugging why Guides showed only 2 affiliate clicks
-- against 7 real Amazon Associates clicks on 2026-07-10:
--
--   1. The exclude-admins check called `beta.is_admin(user_id)`, but only a
--      zero-arg `beta.is_admin()` exists anywhere in the schema (see
--      20260501120000_admin_views.sql). This hadn't errored yet only because
--      every guide_read/affiliate_link_clicked event so far has come from
--      logged-out visitors (user_id IS NULL short-circuits the OR before
--      reaching the bad call) — but the first read or click from a signed-in
--      non-admin user would throw "function beta.is_admin(uuid) does not
--      exist" and take down the whole RPC, not just misreport it.
--   2. The affiliate_link_clicked subquery never applied the _exclude_admins
--      filter at all, unlike the reads subquery.
--   3. The two subqueries were combined with `reads LEFT JOIN clicks`. Any
--      slug whose reads got entirely admin-filtered to zero rows would
--      vanish from the reads side and take its (real, non-admin) affiliate
--      clicks down with it, since a LEFT JOIN only keeps rows from the left
--      table.
--
-- Fix: match the plpgsql + beta._admin_session_ids() pattern used everywhere
-- else (registry analytics, funnel rollup, daily visits), apply the same
-- exclude-admins filter to both subqueries, and FULL JOIN + COALESCE so a
-- guide's affiliate clicks always surface even if its reads got filtered out.

CREATE OR REPLACE FUNCTION beta.admin_guide_breakdown(
  _since_days     integer DEFAULT 30,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  slug              text,
  reads             bigint,
  unique_readers    bigint,
  affiliate_clicks  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = beta, public
AS $$
BEGIN
  IF NOT beta.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH reads AS (
    SELECT
      e.properties->>'slug'          AS slug,
      COUNT(*)::bigint               AS reads,
      COUNT(DISTINCT e.session_id)::bigint AS unique_readers
    FROM beta.events e
    WHERE e.event_name = 'guide_read'
      AND e.created_at >= NOW() - (_since_days || ' days')::interval
      AND (
        NOT _exclude_admins
        OR e.session_id::text NOT IN (SELECT s.session_id FROM beta._admin_session_ids() s)
      )
    GROUP BY 1
  ),
  clicks AS (
    SELECT
      e.properties->>'guide'         AS slug,
      COUNT(*)::bigint                AS clicks
    FROM beta.events e
    WHERE e.event_name = 'affiliate_link_clicked'
      AND e.created_at >= NOW() - (_since_days || ' days')::interval
      AND (
        NOT _exclude_admins
        OR e.session_id::text NOT IN (SELECT s.session_id FROM beta._admin_session_ids() s)
      )
    GROUP BY 1
  )
  SELECT
    COALESCE(r.slug, c.slug, 'unknown')::text AS slug,
    COALESCE(r.reads, 0)::bigint               AS reads,
    COALESCE(r.unique_readers, 0)::bigint      AS unique_readers,
    COALESCE(c.clicks, 0)::bigint              AS affiliate_clicks
  FROM reads r
  FULL JOIN clicks c ON c.slug = r.slug
  ORDER BY COALESCE(r.reads, 0) DESC, COALESCE(c.clicks, 0) DESC;
END;
$$;

REVOKE ALL ON FUNCTION beta.admin_guide_breakdown(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.admin_guide_breakdown(integer, boolean) TO authenticated;
