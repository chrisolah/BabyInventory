-- ============================================================================
-- Migration 006 — clothing_items
-- ============================================================================
-- Creates / aligns beta.clothing_items, the core inventory table. A prior
-- bring-up of data_model_v2 may have created this table with drifted columns
-- (same pattern that bit babies/user_activity_summary), so this migration is
-- defensive: `create table if not exists` + `add column if not exists` for
-- every field. Safe to re-run.
--
-- Scope = MVP fields only (matches what AddItem.jsx writes today). The fuller
-- data model in baby_clothing_data_fields.html includes color multi-select,
-- weight/height ranges, occasion, exchange details, photos — those will be
-- added in later migrations as the UI catches up.
-- ============================================================================

-- ─── Table (if not exists) ─────────────────────────────────────────────────

create table if not exists beta.clothing_items (
  id                uuid        primary key default gen_random_uuid(),
  household_id      uuid        not null references beta.households(id) on delete cascade,
  baby_id           uuid                 references beta.babies(id)     on delete set null,
  category          text        not null,
  item_type         text        not null,
  size_label        text        not null,
  inventory_status  text        not null default 'owned',
  condition         text,
  brand             text,
  name              text,
  season            text,
  quantity          integer     not null default 1,
  notes             text,
  priority          text,
  needed_by         date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Defensive add-column-if-not-exists (catches drifted schemas) ──────────

alter table beta.clothing_items add column if not exists household_id     uuid;
alter table beta.clothing_items add column if not exists baby_id          uuid;
alter table beta.clothing_items add column if not exists category         text;
alter table beta.clothing_items add column if not exists item_type        text;
alter table beta.clothing_items add column if not exists size_label       text;
alter table beta.clothing_items add column if not exists inventory_status text;
alter table beta.clothing_items add column if not exists condition        text;
alter table beta.clothing_items add column if not exists brand            text;
alter table beta.clothing_items add column if not exists name             text;
alter table beta.clothing_items add column if not exists season           text;
alter table beta.clothing_items add column if not exists quantity         integer not null default 1;
alter table beta.clothing_items add column if not exists notes            text;
alter table beta.clothing_items add column if not exists priority         text;
alter table beta.clothing_items add column if not exists needed_by        date;
alter table beta.clothing_items add column if not exists created_at       timestamptz not null default now();
alter table beta.clothing_items add column if not exists updated_at       timestamptz not null default now();

-- ─── Check constraints ────────────────────────────────────────────────────
-- Drop+recreate so re-runs don't fail on a stale enum. If existing rows would
-- violate a new constraint, the ALTER will error and surface the bad row —
-- same pattern as migration 002.

alter table beta.clothing_items drop constraint if exists clothing_items_category_check;
alter table beta.clothing_items add  constraint clothing_items_category_check
  check (category in (
    'tops_and_bodysuits',
    'one_pieces',
    'bottoms',
    'outerwear',
    'sleepwear',
    'accessories',
    'footwear',
    'swimwear',
    'dresses_and_skirts'
  ));

alter table beta.clothing_items drop constraint if exists clothing_items_size_check;
alter table beta.clothing_items add  constraint clothing_items_size_check
  check (size_label in ('0-3M','3-6M','6-9M','9-12M','12-18M','18-24M'));

alter table beta.clothing_items drop constraint if exists clothing_items_status_check;
alter table beta.clothing_items add  constraint clothing_items_status_check
  check (inventory_status in ('owned','needed','outgrown','donated','exchanged'));

alter table beta.clothing_items drop constraint if exists clothing_items_condition_check;
alter table beta.clothing_items add  constraint clothing_items_condition_check
  check (condition is null or condition in ('new','like_new','good','fair','worn'));

alter table beta.clothing_items drop constraint if exists clothing_items_season_check;
alter table beta.clothing_items add  constraint clothing_items_season_check
  check (season is null or season in ('spring','summer','fall','winter','all_season'));

alter table beta.clothing_items drop constraint if exists clothing_items_priority_check;
alter table beta.clothing_items add  constraint clothing_items_priority_check
  check (priority is null or priority in ('must_have','nice_to_have','low_priority'));

alter table beta.clothing_items drop constraint if exists clothing_items_quantity_positive;
alter table beta.clothing_items add  constraint clothing_items_quantity_positive
  check (quantity > 0);

-- household_id is NOT NULL on a fresh table but may be nullable on a drifted
-- one. Tighten if any rows are still null-free.
do $$
begin
  if not exists (
    select 1 from beta.clothing_items where household_id is null
  ) then
    alter table beta.clothing_items alter column household_id set not null;
  end if;
end $$;

-- ─── Indexes ──────────────────────────────────────────────────────────────

create index if not exists clothing_items_household_idx
  on beta.clothing_items(household_id);
create index if not exists clothing_items_baby_idx
  on beta.clothing_items(baby_id);
create index if not exists clothing_items_status_idx
  on beta.clothing_items(inventory_status);

-- ─── updated_at trigger (reuses helper from migration 001) ────────────────

drop trigger if exists clothing_items_set_updated_at on beta.clothing_items;
create trigger clothing_items_set_updated_at
  before update on beta.clothing_items
  for each row
  execute function beta.set_updated_at();

-- ─── Row-Level Security ────────────────────────────────────────────────────
-- Same model as babies: any household member can read/write items in their
-- household. Service role bypasses (per migration 005).

alter table beta.clothing_items enable row level security;

drop policy if exists clothing_items_select on beta.clothing_items;
drop policy if exists clothing_items_insert on beta.clothing_items;
drop policy if exists clothing_items_update on beta.clothing_items;
drop policy if exists clothing_items_delete on beta.clothing_items;

create policy clothing_items_select on beta.clothing_items
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy clothing_items_insert on beta.clothing_items
  for insert with check (beta.is_household_member(household_id, auth.uid()));

create policy clothing_items_update on beta.clothing_items
  for update using (beta.is_household_member(household_id, auth.uid()));

create policy clothing_items_delete on beta.clothing_items
  for delete using (beta.is_household_member(household_id, auth.uid()));

-- ─── Grants ────────────────────────────────────────────────────────────────

grant select, insert, update, delete on beta.clothing_items to authenticated;

-- ─── Tell PostgREST to reload its schema cache ─────────────────────────────
notify pgrst, 'reload schema';
