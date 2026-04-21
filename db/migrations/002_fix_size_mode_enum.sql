-- ============================================================================
-- Migration 002 — align babies.size_mode with the onboarding UI
-- ============================================================================
-- 001 wrote the size_mode CHECK as ('by_age','by_weight','exact'). The
-- prototype's third option is actually "Both" (show age labels AND weight
-- ranges together), not "exact". This migration re-creates the constraint
-- with the correct enum.
--
-- Only needed if you already ran 001. Idempotent.
-- ============================================================================

alter table beta.babies
  drop constraint if exists babies_size_mode_check;

-- Migrate any pre-existing rows from the old enum ('exact') to the new one.
-- Also defensively catch any other stale value so the new constraint doesn't
-- fail on re-apply. On 2026-04-20, beta had a row with size_mode='exact'
-- blocking this migration; this backfill makes the migration idempotent.
update beta.babies
set size_mode = 'by_age'
where size_mode not in ('by_age','by_weight','both');

alter table beta.babies
  add constraint babies_size_mode_check
  check (size_mode in ('by_age','by_weight','both'));
