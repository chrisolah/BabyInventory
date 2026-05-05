-- ============================================================================
-- 036 — Slot taxonomy expansion (Tier 1 + Tier 2)
-- ============================================================================
-- Real-world cataloging surfaced gaps in the slot taxonomy: no dedicated
-- sweaters slot under tops; hats lumped beanies and baseball caps; jackets
-- lumped parkas with spring jackets. The Tier 1 + Tier 2 expansion (see
-- src/lib/wardrobe.js for the full new SLOTS list) splits the overloaded
-- slots and adds a few new ones.
--
-- This migration exists ONLY to backfill any existing clothing_items rows
-- whose item_type now points at a removed slot id. clothing_items.item_type
-- is unconstrained TEXT, so the schema doesn't reject old values — but the
-- frontend's SLOT_BY_ID lookup will return undefined for removed ids, which
-- means those rows display as the generic "Item" fallback in inventory and
-- get excluded from wishlist coverage. Backfilling preserves the parent's
-- categorization intent across the rename.
--
-- Mapping (chosen as the most-likely-correct subtype, since we can't
-- distinguish from item_type alone):
--   pajamas → footed_pajamas   (the dominant pajama subtype 0-12M)
--   hats    → sun_hats         (more common on a year-round basis than
--                                beanies; users with beanies can edit)
--   jackets → light_jackets    (also more common than winter coats)
--
-- Idempotent. UPDATE filters on the OLD value, so re-running after a prior
-- run is a no-op (the old values won't be present anymore).

-- 1. pajamas → footed_pajamas
update beta.clothing_items
   set item_type = 'footed_pajamas'
 where item_type = 'pajamas';

-- 2. hats → sun_hats
update beta.clothing_items
   set item_type = 'sun_hats'
 where item_type = 'hats';

-- 3. jackets → light_jackets
update beta.clothing_items
   set item_type = 'light_jackets'
 where item_type = 'jackets';

-- Sanity probe (commented out — uncomment in SQL Editor if curious):
-- select item_type, count(*)
--   from beta.clothing_items
--  where item_type in ('pajamas','hats','jackets')
--  group by item_type;
-- Expected: 0 rows post-migration.
