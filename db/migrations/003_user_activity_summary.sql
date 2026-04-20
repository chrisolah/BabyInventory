-- ============================================================================
-- Migration 003 — user_activity_summary (stub)
-- ============================================================================
-- Creates beta.user_activity_summary — the denormalized user-state table from
-- data_model_v2. The full schema has a dozen columns (sessions_total,
-- items_added_total, etc.); this migration installs it with ONLY the columns
-- needed to unblock reliable onboarding resume:
--
--   onboarding_step semantics (highest step reached):
--     0 → not started
--     1 → household created
--     2 → baby added
--     3 → size mode selected
--     4 → onboarding complete (invite step sent or skipped)
--
-- Later migrations will add activated_at, sessions_total, acquisition_*, etc.
-- as the features that need them come online.
-- ============================================================================

-- ─── Table ─────────────────────────────────────────────────────────────────

create table if not exists beta.user_activity_summary (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  onboarding_step smallint    not null default 0
                              check (onboarding_step between 0 and 4),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── updated_at trigger (reuses helper from migration 001) ─────────────────

drop trigger if exists uas_set_updated_at on beta.user_activity_summary;
create trigger uas_set_updated_at
  before update on beta.user_activity_summary
  for each row
  execute function beta.set_updated_at();

-- ─── Auto-create a row for every new signup ────────────────────────────────
-- Trigger fires on auth.users INSERT. SECURITY DEFINER so it can write into
-- beta.user_activity_summary despite RLS. search_path pinned so `beta` resolves
-- predictably regardless of the calling session's search_path.

create or replace function beta.handle_new_user_activity_summary()
returns trigger
language plpgsql
security definer
set search_path = beta, public
as $$
begin
  insert into beta.user_activity_summary (user_id, onboarding_step)
  values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_uas on auth.users;
create trigger on_auth_user_created_uas
  after insert on auth.users
  for each row
  execute function beta.handle_new_user_activity_summary();

-- ─── Backfill for any users who already exist ──────────────────────────────
-- Best-effort reconstruction from current household/baby state:
--   has a baby in one of their households → at least step 2 (can't tell if
--     size_mode or invite were confirmed, so 2 is the safe lower bound)
--   has a household but no baby            → step 1
--   neither                                → step 0

insert into beta.user_activity_summary (user_id, onboarding_step)
select
  u.id,
  case
    when exists (
      select 1
      from beta.babies b
      join beta.household_members hm on hm.household_id = b.household_id
      where hm.user_id = u.id
    ) then 2
    when exists (
      select 1 from beta.household_members hm where hm.user_id = u.id
    ) then 1
    else 0
  end as onboarding_step
from auth.users u
on conflict (user_id) do nothing;

-- ─── Row-Level Security ────────────────────────────────────────────────────

alter table beta.user_activity_summary enable row level security;

drop policy if exists uas_select on beta.user_activity_summary;
drop policy if exists uas_insert on beta.user_activity_summary;
drop policy if exists uas_update on beta.user_activity_summary;

-- A user can read and update only their own summary row. Inserts should go
-- through the on_auth_user_created_uas trigger, not direct client writes, so
-- INSERT is scoped to self as a defensive fallback (e.g. if the trigger fails
-- for some reason and the client retries).
create policy uas_select on beta.user_activity_summary
  for select using (user_id = auth.uid());

create policy uas_insert on beta.user_activity_summary
  for insert with check (user_id = auth.uid());

create policy uas_update on beta.user_activity_summary
  for update using (user_id = auth.uid());

-- ─── Grants ────────────────────────────────────────────────────────────────

grant select, insert, update on beta.user_activity_summary to authenticated;
