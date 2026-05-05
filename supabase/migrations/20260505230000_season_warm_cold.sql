-- ============================================================================
-- 035 — Collapse season enum to warm / cold / all-season
-- ============================================================================
-- The four-season distinction (spring/summer/fall/winter + all_season)
-- wasn't doing useful work for baby clothes. The functional axis parents
-- actually shop on is "is it warm enough for warm weather" vs "is it warm
-- enough for cold weather" — sleeve length, fabric weight, exposure to
-- weather. Collapsing to warm_weather + cold_weather + all_season also
-- makes scan-time inference tractable: the model can read those off a
-- garment photo where seasonal nuance ("is this a fall jacket or a winter
-- jacket?") is judgment.
--
-- Order matters: drop the OLD check constraint BEFORE rewriting values.
-- Updates targeting the new values would fail validation against the old
-- constraint mid-statement otherwise (this exact bit beta on 2026-04-27
-- with the concierge_tasks rename — see feedback_constraint_rewrite_order).
--
-- Mapping:
--   spring | summer       → warm_weather
--   fall   | winter       → cold_weather
--   all_season            → all_season  (no change)
--   null                  → null         (no change)
--
-- Idempotent. Re-running the migration after it's already applied is a
-- no-op: the drop-if-exists is safe, the UPDATE filters on the old
-- values that won't be present anymore, and the constraint name is
-- recreated identically.

-- 1. Drop the old constraint so the UPDATE below isn't rejected.
alter table beta.clothing_items
  drop constraint if exists clothing_items_season_check;

-- 2. Backfill in two passes so each pass touches a tight, indexed row set.
update beta.clothing_items
   set season = 'warm_weather'
 where season in ('spring','summer');

update beta.clothing_items
   set season = 'cold_weather'
 where season in ('fall','winter');

-- 3. Reinstate the constraint with the new domain.
alter table beta.clothing_items
  add constraint clothing_items_season_check
  check (season is null or season in ('warm_weather','cold_weather','all_season'));

-- 4. Sanity probe — counts of each value post-migration. Useful in the
-- SQL Editor to confirm the rewrite worked; harmless to leave in.
-- (Returns a single result set; fine to skip if not interested.)
-- select coalesce(season, '__null__') as season, count(*)
--   from beta.clothing_items
--  group by coalesce(season, '__null__')
--  order by count(*) desc;
