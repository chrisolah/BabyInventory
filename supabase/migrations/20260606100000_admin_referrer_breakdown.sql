-- admin_referrer_breakdown: groups page_viewed events by traffic source
-- derived from document.referrer stored in event properties.
-- Sources: google, bing, direct, internal, other.

CREATE OR REPLACE FUNCTION beta.admin_referrer_breakdown(
  _since_days   int     DEFAULT 30,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  source   text,
  sessions int,
  users    int
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT beta.is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN referrer = '' OR referrer IS NULL         THEN 'Direct'
      WHEN referrer LIKE '%google.%'                 THEN 'Google'
      WHEN referrer LIKE '%bing.%'                   THEN 'Bing'
      WHEN referrer LIKE '%duckduckgo.%'             THEN 'DuckDuckGo'
      WHEN referrer LIKE '%sprigloop.com%'           THEN 'Internal'
      WHEN referrer LIKE '%localhost%'               THEN 'Internal'
      ELSE 'Other'
    END AS source,
    COUNT(DISTINCT e.session_id)::int AS sessions,
    COUNT(DISTINCT e.user_id)::int    AS users
  FROM beta.events e
  CROSS JOIN LATERAL (
    SELECT COALESCE(e.properties->>'referrer', '') AS referrer
  ) r
  WHERE e.event_name = 'page_viewed'
    AND e.created_at >= NOW() - (_since_days || ' days')::interval
    AND (NOT _exclude_admins
         OR e.session_id::text NOT IN (
           SELECT s.session_id FROM beta._admin_session_ids() s
         ))
  GROUP BY source
  ORDER BY sessions DESC;
END;
$$;

REVOKE ALL ON FUNCTION beta.admin_referrer_breakdown(int, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.admin_referrer_breakdown(int, boolean) TO authenticated;
