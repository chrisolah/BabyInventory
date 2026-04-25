-- ============================================================================
-- Migration 014 — widen user_activity_summary.onboarding_step range to 0..6
-- ============================================================================
-- Onboarding gained a sixth step ("scan") between invite and complete so new
-- parents are exposed to the photo-scan feature at peak cold-start friction.
-- The 'complete' value therefore moves from 5 to 6. Migration 011 widened
-- the CHECK constraint to 0..5, which would now reject any new 6 write
-- from finishOnboarding().
--
-- New semantics (highest step reached):
--   0 → not started
--   1 → household created
--   2 → baby added
--   3 → size mode selected
--   4 → receiving opt-in saved
--   5 → invite handled (sent or skipped)        (new threshold)
--   6 → onboarding complete (scan tried or skipped)
--
-- Idempotent — drop-if-exists then re-add. Mirrors migration 011's pattern.
-- ============================================================================

alter table beta.user_activity_summary
  drop constraint if exists user_activity_summary_onboarding_step_check;

alter table beta.user_activity_summary
  add constraint user_activity_summary_onboarding_step_check
  check (onboarding_step between 0 and 6);

-- PostgREST schema cache refresh so the column reads pick up the looser rule
-- without a dashboard kick.
notify pgrst, 'reload schema';
