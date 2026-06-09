-- ============================================================================
-- Migration 037 - gap_infrastructure
-- ============================================================================
-- Adds the schema foundation for gap rows: every taxonomy slot gets a real
-- DB row with inventory_status='gap' so we can attach metadata (is_priority,
-- notes) to any slot regardless of whether the parent has added items to it.
--
-- Changes:
--   1. Add 'gap' to inventory_status check on clothing_items + items
--   2. Relax quantity constraint from > 0 to >= 0 (gap rows have quantity=0)
--   3. Add slot_id text column to both tables (stable taxonomy id for gap rows;
--      user-added rows can leave it null or have it set by keyword matching)
--   4. Add is_priority boolean to both tables
--   5. Partial unique indexes to prevent duplicate gap rows per slot
-- ============================================================================

-- ─── 1. inventory_status: add 'gap' ──────────────────────────────────────────

alter table beta.clothing_items drop constraint if exists clothing_items_status_check;
alter table beta.clothing_items add  constraint clothing_items_status_check
  check (inventory_status in (
    'owned', 'needed', 'outgrown', 'pass_along', 'kept',
    'donated', 'exchanged', 'gap'
  ));

alter table beta.items drop constraint if exists items_status_check;
alter table beta.items add  constraint items_status_check
  check (inventory_status in (
    'owned', 'needed', 'outgrown', 'pass_along', 'kept',
    'donated', 'exchanged', 'gap'
  ));

-- ─── 2. quantity: allow 0 for gap rows ───────────────────────────────────────

alter table beta.clothing_items drop constraint if exists clothing_items_quantity_positive;
alter table beta.clothing_items add  constraint clothing_items_quantity_nonneg
  check (quantity >= 0);

alter table beta.items drop constraint if exists items_quantity_positive;
alter table beta.items add  constraint items_quantity_nonneg
  check (quantity >= 0);

-- ─── 3. slot_id column ───────────────────────────────────────────────────────
-- Stable taxonomy identifier. For clothing_items gap rows this is the wardrobe
-- slot id (e.g. 'bodysuits'). For items gap rows this is the categories.js
-- item id (e.g. 'crib'). Nullable so existing user-entered rows aren't broken.

alter table beta.clothing_items add column if not exists slot_id text;
alter table beta.items          add column if not exists slot_id text;

-- ─── 4. is_priority column ───────────────────────────────────────────────────

alter table beta.clothing_items add column if not exists is_priority boolean not null default false;
alter table beta.items          add column if not exists is_priority boolean not null default false;

-- ─── 5. Partial unique indexes for gap deduplication ─────────────────────────
-- Prevents the seed function from inserting duplicate gap rows on re-runs.
-- Only applies to gap rows (WHERE inventory_status = 'gap') so regular
-- user-added rows are not affected.

create unique index if not exists clothing_gap_slot_unique
  on beta.clothing_items(household_id, baby_id, slot_id, size_label)
  where inventory_status = 'gap';

-- For non-clothing items, gaps are household-level (baby_id is null).
create unique index if not exists items_gap_slot_unique
  on beta.items(household_id, slot_id)
  where inventory_status = 'gap' and baby_id is null;

-- ─── Indexes for new columns ─────────────────────────────────────────────────

create index if not exists clothing_items_slot_id_idx on beta.clothing_items(slot_id);
create index if not exists items_slot_id_idx          on beta.items(slot_id);
create index if not exists clothing_items_priority_idx on beta.clothing_items(household_id, is_priority) where is_priority = true;
create index if not exists items_priority_idx          on beta.items(household_id, is_priority)          where is_priority = true;

notify pgrst, 'reload schema';
