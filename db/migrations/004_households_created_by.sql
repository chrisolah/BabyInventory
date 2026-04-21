-- ============================================================================
-- Migration 004 — households.created_by + defensive babies columns
-- ============================================================================
-- Two fixes rolled up from the 2026-04-20 beta debug session:
--
-- 1. households needs a `created_by` column that defaults to auth.uid() so
--    the creator can read back their own newly-inserted row. Without this,
--    PostgREST's `INSERT ... RETURNING *` runs the new row through the SELECT
--    policy (which required membership via an AFTER INSERT trigger), and
--    Postgres reports the failure as "new row violates row-level security
--    policy for table households" — even when the INSERT WITH CHECK passes.
--    See feedback_rls_returning memory for full context.
--
-- 2. beta.babies was created (outside of migration 001, from an earlier bring-
--    up of the fuller data_model_v2) without `updated_at` / `created_at`
--    columns, causing the shared `set_updated_at` trigger to crash during
--    onboarding with "record 'new' has no field 'updated_at'". We also
--    installed this defensively in migration 003 for user_activity_summary.
--    Applying the same defense to babies.
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- ─── 1. households.created_by ──────────────────────────────────────────────

alter table beta.households
  add column if not exists created_by uuid default auth.uid();

-- Backfill any existing rows from household_members (owner wins if multiple).
-- Best-effort: if a household has no owner row (shouldn't happen given the
-- add_creator_as_owner trigger), created_by stays null.
update beta.households h
set created_by = (
  select hm.user_id
  from beta.household_members hm
  where hm.household_id = h.id and hm.role = 'owner'
  order by hm.joined_at asc
  limit 1
)
where created_by is null;

-- Rewrite households_select to allow creators to see their own row even when
-- the AFTER INSERT trigger's membership row isn't yet visible in the same
-- statement (the original bug). Membership-based access remains for other
-- household members.
drop policy if exists households_select on beta.households;
create policy households_select on beta.households
  for select using (
    created_by = auth.uid()
    or beta.is_household_member(id, beta.current_user_id())
  );

-- ─── 2. Defensive updated_at / created_at on beta.babies ───────────────────
-- Migration 001's `create table if not exists` was a no-op on the pre-existing
-- beta.babies, which lacked these columns. Adding them here so the shared
-- set_updated_at trigger can fire without error.

alter table beta.babies
  add column if not exists updated_at timestamptz not null default now();
alter table beta.babies
  add column if not exists created_at timestamptz not null default now();

-- Force the updated_at trigger to re-plan against the current row type — safe
-- even if already correct.
drop trigger if exists babies_set_updated_at on beta.babies;
create trigger babies_set_updated_at
  before update on beta.babies
  for each row
  execute function beta.set_updated_at();

-- ─── Tell PostgREST to reload its schema cache ─────────────────────────────
notify pgrst, 'reload schema';
