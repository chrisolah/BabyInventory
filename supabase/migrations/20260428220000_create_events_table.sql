-- Analytics events table.
--
-- src/lib/analytics.js has been calling supabase.schema('beta').from('events')
-- .insert() since the analytics module was first added, but no migration ever
-- created the table. PostgREST 404s every insert silently — caught 2026-04-28
-- by the mobile QA sweep's network listener. Pre-launch we want this signal
-- working: per-step drop-off, feature usage, funnel completion.
--
-- Schema mirrors the analytics.js insert payload exactly:
--   session_id   — crypto.randomUUID() per browser session, persisted in
--                  sessionStorage. Required (every event has one).
--   device_type  — 'ios' | 'android' | 'web' from a UA sniff.
--   event_name   — the specific event ('add_item_started', etc).
--   event_group  — coarse category (the second arg to logEvent).
--   properties   — arbitrary jsonb payload from the call site.
--   user_id      — auth.users id, nullable (some events fire pre-auth, e.g.
--                  landing-page views).
--   funnel_id    — optional funnel identifier when the event is part of a
--                  funnel (e.g. 'signup', 'onboarding', 'first_item').
--   funnel_step  — optional step index within that funnel.

CREATE TABLE IF NOT EXISTS beta.events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  session_id   uuid NOT NULL,
  device_type  text NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
  event_name   text NOT NULL,
  event_group  text NOT NULL,
  properties   jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  funnel_id    text,
  funnel_step  smallint
);

-- Time-based queries (recent events, per-day rollups) — most analytics
-- queries scan recent windows, so a DESC index on created_at is the right
-- shape.
CREATE INDEX IF NOT EXISTS events_created_at_idx
  ON beta.events (created_at DESC);

-- Event-name lookup — "how many add_item_started events in the last 7 days"
-- is the most common shape.
CREATE INDEX IF NOT EXISTS events_event_name_idx
  ON beta.events (event_name);

-- Per-user queries — filtered partial index since most events have a
-- user_id but pre-auth events don't, and we never query "all anon events
-- by user".
CREATE INDEX IF NOT EXISTS events_user_id_idx
  ON beta.events (user_id) WHERE user_id IS NOT NULL;

-- Funnel queries — group by funnel_id, order by funnel_step.
CREATE INDEX IF NOT EXISTS events_funnel_idx
  ON beta.events (funnel_id, funnel_step) WHERE funnel_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────
-- Anyone (anon or authenticated) can INSERT — events fire from the landing
-- page before signup. No SELECT/UPDATE/DELETE policies — reads are
-- service-role only (admin queries, dashboards). This means a malicious
-- client could spam the table with fake events; rate limiting is left to
-- Supabase's platform limits for now. If volume becomes a problem, add
-- a per-session-id rate check or move event collection to an edge function.
ALTER TABLE beta.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_insert_anyone
  ON beta.events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Grant the basic permissions PostgREST needs for the policy to apply.
GRANT INSERT ON beta.events TO anon, authenticated;
