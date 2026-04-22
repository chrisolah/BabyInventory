-- ============================================================================
-- Migration 009 — scan_usage (photo-scan rate limit)
-- ============================================================================
-- Backs the per-user daily rate limit for the photo-scan add-item feature.
-- The Edge Function `scan-clothing-tag` bumps the counter before calling
-- Anthropic; if the user is over the daily cap it short-circuits with 429.
--
-- Why a table instead of in-memory / a key-value cache?
--   1. Edge Functions are stateless per invocation — no in-process counter
--      can survive between requests.
--   2. Postgres is already there; no new infra to operate.
--   3. A table lets us answer "how often do users actually scan?" with a
--      plain SQL query later, which matters while we're tuning the cap.
--
-- Writes happen through service_role from the Edge Function, so RLS on this
-- table is deliberately locked shut against the anon/authenticated roles —
-- clients never read or write scan_usage directly.
-- ============================================================================

create table if not exists beta.scan_usage (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  day        date        not null default (current_date at time zone 'UTC'),
  count      integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Reuse the shared trigger helper installed by migration 001.
drop trigger if exists scan_usage_set_updated_at on beta.scan_usage;
create trigger scan_usage_set_updated_at
  before update on beta.scan_usage
  for each row
  execute function beta.set_updated_at();

-- RLS: table exists but no policies for authenticated/anon. The Edge
-- Function uses the service_role key which bypasses RLS entirely. This keeps
-- clients from ever reading or spoofing the counter.
alter table beta.scan_usage enable row level security;

-- Explicit: no grants to authenticated. service_role already has full table
-- access via the blanket grant in migration 005.
revoke all on beta.scan_usage from authenticated;
revoke all on beta.scan_usage from anon;

-- Helper: atomically bump a user's scan count for today. Returns the new
-- count. Called by the Edge Function with service_role. Pinned search_path
-- so "beta" resolves predictably no matter what the caller's search path is.
create or replace function beta.bump_scan_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = beta, public
as $$
declare
  v_day   date := (current_date at time zone 'UTC');
  v_count integer;
begin
  insert into beta.scan_usage (user_id, day, count)
  values (p_user_id, v_day, 1)
  on conflict (user_id, day)
  do update set count = beta.scan_usage.count + 1,
                updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function beta.bump_scan_usage(uuid) from public;
revoke all on function beta.bump_scan_usage(uuid) from authenticated;
revoke all on function beta.bump_scan_usage(uuid) from anon;
grant  execute on function beta.bump_scan_usage(uuid) to service_role;
