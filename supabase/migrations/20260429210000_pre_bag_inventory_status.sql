-- Migration #022: pre_bag_inventory_status column on clothing_items.
--
-- Tracks an item's inventory_status BEFORE it was attached to a pass-along
-- bag, so removing the item from the bag can restore it to the right pile:
--   - Owned items that were inline-passed-on  → restore to 'owned'
--   - Kept items that were chip-flipped to a bag → restore to 'kept'
--   - Legacy outgrown items that got attached → restore to 'outgrown'
--
-- Without this, removeItem in PassAlongBatch.jsx hardcoded
-- inventory_status='owned' regardless of origin, which surprised users
-- who tucked something away, decided to pass it on, then reversed course
-- — the item landed in active Owned instead of going back to the
-- Outgrown section. (Caught in testing 2026-04-29.)
--
-- Conventions:
--   • Set on attach (any code path that flips inventory_status to
--     'pass_along' and sets pass_along_batch_id).
--   • Read on detach (removeItem, handleDelete on a draft, anywhere
--     items are unlinked from a bag).
--   • Cleared on detach so a future re-attach cycle records fresh origin.
--   • Nullable. NULL reads as 'owned' in app code — keeps existing
--     pass_along rows that predate this column working without a backfill.

alter table beta.clothing_items
  add column if not exists pre_bag_inventory_status text;

comment on column beta.clothing_items.pre_bag_inventory_status is
  'Saved inventory_status from before the item was attached to a pass-along bag. Used by remove-from-bag flows to restore the item to its origin pile (Owned vs Tucked away vs legacy outgrown) instead of forcing every removal back to Owned. Cleared whenever pass_along_batch_id transitions to NULL.';
