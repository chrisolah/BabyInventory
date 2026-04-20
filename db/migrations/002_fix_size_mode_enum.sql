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

alter table beta.babies
  add constraint babies_size_mode_check
  check (size_mode in ('by_age','by_weight','both'));
