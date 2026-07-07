-- ============================================================================
-- Migration: quick-add source tagging
-- ============================================================================
-- Marks items created via Plan's quick-add (tap "+" on a slot card, no scan,
-- no manual form) so the UI can show a "Quick added" badge instead of a
-- brand/name that just says nothing. Null for everything else (scanned,
-- manually entered via AddItem, batch review, etc).
-- ============================================================================

alter table beta.clothing_items add column if not exists source text;
alter table beta.items          add column if not exists source text;

alter table beta.clothing_items drop constraint if exists clothing_items_source_check;
alter table beta.clothing_items add  constraint clothing_items_source_check
  check (source is null or source in ('quick_add'));

alter table beta.items drop constraint if exists items_source_check;
alter table beta.items add  constraint items_source_check
  check (source is null or source in ('quick_add'));

notify pgrst, 'reload schema';
