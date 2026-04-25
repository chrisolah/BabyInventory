-- ============================================================================
-- Migration 005 — service_role grants on beta
-- ============================================================================
-- Migrations 001/003 only granted to `authenticated`, the role browser-side
-- Supabase clients use. The `service_role` (used by server-side code with the
-- service role key) had no schema-level USAGE on beta and would error with
-- "permission denied for schema beta" the first time it tried to read or
-- write. Discovered 2026-04-20 when Playwright's globalSetup tried to wipe
-- beta tables before the e2e suite.
--
-- Service role bypasses RLS by design — these grants only unlock the
-- schema/table-level door so the bypass can take effect.
--
-- Idempotent: GRANT/ALTER DEFAULT PRIVILEGES are no-ops if already granted.
-- Run for `production` separately when that schema exists.
-- ============================================================================

grant usage on schema beta to service_role;

grant all on all tables    in schema beta to service_role;
grant all on all sequences in schema beta to service_role;
grant all on all functions in schema beta to service_role;

-- Future tables/sequences/functions in beta inherit these grants.
alter default privileges in schema beta
  grant all on tables    to service_role;
alter default privileges in schema beta
  grant all on sequences to service_role;
alter default privileges in schema beta
  grant all on functions to service_role;

-- Tell PostgREST to refresh its schema cache so the new grants are picked up
-- without waiting for the periodic reload.
notify pgrst, 'reload schema';
