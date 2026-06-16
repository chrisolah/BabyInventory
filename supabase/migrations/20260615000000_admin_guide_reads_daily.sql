-- admin_guide_reads_daily
-- Daily roll-up of guide_read events for the Guides admin tab.
-- Returns one row per day within the requested window.

CREATE OR REPLACE FUNCTION beta.admin_guide_reads_daily(
  _since_days     integer DEFAULT 30,
  _exclude_admins boolean DEFAULT true
)
RETURNS TABLE (
  day             date,
  reads           bigint,
  unique_readers  bigint
)
LANGUAGE sql SECURITY DEFINER
SET search_path = beta, public
AS $$
  SELECT
    DATE_TRUNC('day', created_at)::date AS day,
    COUNT(*)                            AS reads,
    COUNT(DISTINCT session_id)          AS unique_readers
  FROM beta.events
  WHERE
    event_name = 'guide_read'
    AND created_at >= NOW() - (_since_days || ' days')::interval
    AND (
      NOT _exclude_admins
      OR session_id::text NOT IN (SELECT s.session_id FROM beta._admin_session_ids() s)
    )
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION beta.admin_guide_reads_daily FROM PUBLIC;
GRANT EXECUTE ON FUNCTION beta.admin_guide_reads_daily TO authenticated;
