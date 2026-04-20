-- ============================================================================
-- Migration 001 — households, household_members, babies
-- ============================================================================
-- Creates the core relational backbone for onboarding: a family unit
-- (households), user ↔ household junction (household_members), and the babies
-- who belong to a household.
--
-- Matches data_model_v2. User identity is Supabase's auth.users — we do NOT
-- create a separate beta.users table. Name/zip_code live in
-- auth.users.raw_user_meta_data.
--
-- Target schema: beta (run separately against production when that env exists).
-- Apply via Supabase SQL Editor (beta project). Idempotent-ish: uses
-- "create table if not exists" and "create or replace" for functions so you
-- can re-run after edits without fully dropping the schema.
-- ============================================================================

create schema if not exists beta;

-- ─── Tables ────────────────────────────────────────────────────────────────

create table if not exists beta.households (
  id          uuid        primary key default gen_random_uuid(),
  name        text,                                  -- e.g. "The Johnson family"; nullable — can be set later
  created_at  timestamptz not null default now()
);

create table if not exists beta.household_members (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references beta.households(id) on delete cascade,
  user_id       uuid        not null references auth.users(id)       on delete cascade,
  role          text        not null default 'member'                check (role in ('owner','member')),
  joined_at     timestamptz not null default now(),
  unique (household_id, user_id)
);

create index if not exists household_members_user_idx
  on beta.household_members(user_id);
create index if not exists household_members_household_idx
  on beta.household_members(household_id);

create table if not exists beta.babies (
  id             uuid        primary key default gen_random_uuid(),
  household_id   uuid        not null references beta.households(id) on delete cascade,
  name           text,                                  -- nullable: expecting parents may not have picked a name yet
  date_of_birth  date,
  due_date       date,
  gender         text        check (gender in ('boy','girl','neutral') or gender is null),
  size_mode      text        not null default 'by_age' check (size_mode in ('by_age','by_weight','exact')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Either a DOB (already born) or a due date (expecting) must be present.
  constraint babies_dob_or_due check (date_of_birth is not null or due_date is not null)
);

create index if not exists babies_household_idx
  on beta.babies(household_id);

-- ─── Shared helpers ────────────────────────────────────────────────────────

-- Membership check. SECURITY DEFINER so RLS policies on other tables can call
-- it without triggering recursive RLS evaluation on household_members itself.
create or replace function beta.is_household_member(h_id uuid, u_id uuid)
returns boolean
language sql
security definer
set search_path = beta, public
stable
as $$
  select exists (
    select 1 from beta.household_members
    where household_id = h_id and user_id = u_id
  );
$$;

-- updated_at auto-bump
create or replace function beta.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- When a household is created, auto-add the creator as an owner. This keeps
-- the client flow simple — a single INSERT creates the household AND the
-- creator's membership in one round trip. SECURITY DEFINER so the trigger
-- can write to household_members despite RLS.
create or replace function beta.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = beta, public
as $$
begin
  insert into beta.household_members (household_id, user_id, role)
  values (new.id, auth.uid(), 'owner');
  return new;
end;
$$;

-- ─── Triggers ──────────────────────────────────────────────────────────────

drop trigger if exists households_add_creator on beta.households;
create trigger households_add_creator
  after insert on beta.households
  for each row
  execute function beta.add_creator_as_owner();

drop trigger if exists babies_set_updated_at on beta.babies;
create trigger babies_set_updated_at
  before update on beta.babies
  for each row
  execute function beta.set_updated_at();

-- ─── Row-Level Security ────────────────────────────────────────────────────

alter table beta.households        enable row level security;
alter table beta.household_members enable row level security;
alter table beta.babies            enable row level security;

-- Drop any prior versions so this migration is idempotent.
drop policy if exists households_select   on beta.households;
drop policy if exists households_insert   on beta.households;
drop policy if exists households_update   on beta.households;
drop policy if exists households_delete   on beta.households;

drop policy if exists hm_select on beta.household_members;
drop policy if exists hm_insert on beta.household_members;
drop policy if exists hm_delete on beta.household_members;

drop policy if exists babies_select on beta.babies;
drop policy if exists babies_insert on beta.babies;
drop policy if exists babies_update on beta.babies;
drop policy if exists babies_delete on beta.babies;

-- households: members can read; any authed user can create; owners modify.
create policy households_select on beta.households
  for select using (beta.is_household_member(id, auth.uid()));

create policy households_insert on beta.households
  for insert with check (auth.uid() is not null);

create policy households_update on beta.households
  for update using (
    exists (
      select 1 from beta.household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

create policy households_delete on beta.households
  for delete using (
    exists (
      select 1 from beta.household_members hm
      where hm.household_id = households.id
        and hm.user_id = auth.uid()
        and hm.role = 'owner'
    )
  );

-- household_members: user sees their own memberships; user can add themselves
-- (multi-household join flow — e.g. grandparent); user can remove themselves.
-- Co-parent invite (owner adding someone else) will go through an RPC once
-- the invite flow is built — don't grant owners blanket INSERT here yet.
create policy hm_select on beta.household_members
  for select using (user_id = auth.uid());

create policy hm_insert on beta.household_members
  for insert with check (user_id = auth.uid());

create policy hm_delete on beta.household_members
  for delete using (user_id = auth.uid());

-- babies: visible/editable to any member of the household they belong to.
create policy babies_select on beta.babies
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy babies_insert on beta.babies
  for insert with check (beta.is_household_member(household_id, auth.uid()));

create policy babies_update on beta.babies
  for update using (beta.is_household_member(household_id, auth.uid()));

create policy babies_delete on beta.babies
  for delete using (beta.is_household_member(household_id, auth.uid()));

-- ─── Grants ────────────────────────────────────────────────────────────────
-- Supabase's `authenticated` role is what a signed-in client connects as.
-- RLS does the real filtering; GRANT just unlocks the table-level door.

grant usage on schema beta to authenticated;
grant select, insert, update, delete on beta.households        to authenticated;
grant select, insert, update, delete on beta.household_members to authenticated;
grant select, insert, update, delete on beta.babies            to authenticated;
