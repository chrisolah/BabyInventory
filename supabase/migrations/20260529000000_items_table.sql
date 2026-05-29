-- ============================================================================
-- Migration 036 — beta.items (general non-clothing item tracking)
-- ============================================================================
-- Creates beta.items, the inventory table for all non-clothing categories:
-- sleep, feeding, diapering, travel, play, health, bath.
--
-- Clothing continues to use beta.clothing_items. HouseholdContext merges both
-- into a single items array, stamping top_category='clothing' on the
-- clothing_items rows at read time.
--
-- Key differences from clothing_items:
--   - top_category replaces the implicit "clothing" assumption
--   - sub_category + item_type are free-text (validated at app layer via
--     taxonomy in src/lib/categories.js — tighten with check constraints once
--     the taxonomy stabilises)
--   - age_relevance replaces size_label (nullable — many items aren't
--     age-specific; when set, values mirror clothing age ranges for consistency)
--   - no season column (not relevant for most non-clothing categories)
-- ============================================================================

create table if not exists beta.items (
  id                uuid        primary key default gen_random_uuid(),
  household_id      uuid        not null references beta.households(id) on delete cascade,
  baby_id           uuid                 references beta.babies(id)     on delete set null,

  -- Category hierarchy
  top_category      text        not null,   -- sleep | feeding | diapering | travel | play | health | bath
  sub_category      text        not null,   -- e.g. 'bedding', 'monitors' (within sleep)
  item_type         text        not null,   -- e.g. 'sleep_sack', 'white_noise_machine'

  -- Display / search
  name              text,                   -- optional user-supplied name
  brand             text,

  -- Lifecycle
  inventory_status  text        not null default 'owned',
  condition         text,
  quantity          integer     not null default 1,
  age_relevance     text,                   -- e.g. '0-6M', '6-12M', null = not age-specific
  priority          text,
  notes             text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ─── Check constraints ────────────────────────────────────────────────────────

alter table beta.items drop constraint if exists items_top_category_check;
alter table beta.items add  constraint items_top_category_check
  check (top_category in ('sleep','feeding','diapering','travel','play','health','bath'));

alter table beta.items drop constraint if exists items_status_check;
alter table beta.items add  constraint items_status_check
  check (inventory_status in ('owned','needed','outgrown','donated','exchanged','pass_along','kept'));

alter table beta.items drop constraint if exists items_condition_check;
alter table beta.items add  constraint items_condition_check
  check (condition is null or condition in ('new','like_new','good','fair','worn'));

alter table beta.items drop constraint if exists items_priority_check;
alter table beta.items add  constraint items_priority_check
  check (priority is null or priority in ('must_have','nice_to_have','low_priority'));

alter table beta.items drop constraint if exists items_quantity_positive;
alter table beta.items add  constraint items_quantity_positive
  check (quantity > 0);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists items_household_idx      on beta.items(household_id);
create index if not exists items_baby_idx           on beta.items(baby_id);
create index if not exists items_top_category_idx   on beta.items(top_category);
create index if not exists items_status_idx         on beta.items(inventory_status);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

drop trigger if exists items_set_updated_at on beta.items;
create trigger items_set_updated_at
  before update on beta.items
  for each row
  execute function beta.set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table beta.items enable row level security;

drop policy if exists items_select on beta.items;
drop policy if exists items_insert on beta.items;
drop policy if exists items_update on beta.items;
drop policy if exists items_delete on beta.items;

create policy items_select on beta.items
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy items_insert on beta.items
  for insert with check (beta.is_household_member(household_id, auth.uid()));

create policy items_update on beta.items
  for update using (beta.is_household_member(household_id, auth.uid()));

create policy items_delete on beta.items
  for delete using (beta.is_household_member(household_id, auth.uid()));

-- ─── Grants ───────────────────────────────────────────────────────────────────

grant select, insert, update, delete on beta.items to authenticated;

-- ─── PostgREST schema reload ──────────────────────────────────────────────────

notify pgrst, 'reload schema';
