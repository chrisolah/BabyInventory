-- ============================================================================
-- Migration 037 - add item_photo_path to beta.items
-- ============================================================================
-- Adds a nullable photo storage path column to beta.items, mirroring
-- garment_photo_path on beta.clothing_items. Used by the item-recognition
-- scan flow (scan-item edge function) to store display photos for
-- non-clothing inventory items.
--
-- Storage: same garment-photos bucket as clothing, path pattern:
--   {household_id}/{item_id}.jpg
-- ============================================================================

alter table beta.items
  add column if not exists item_photo_path text;

notify pgrst, 'reload schema';
