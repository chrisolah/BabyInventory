-- ============================================================================
-- Migration 011 — widen user_activity_summary.onboarding_step range to 0..5
-- ============================================================================
-- Onboarding grew a fifth step ("receiving") between sizemode and invite so
-- parents can opt their household in to receiving hand-me-downs during setup,
-- not only from the Profile screen later. The 'complete' value therefore
-- moves from 4 to 5. Migration 003 hard-coded a CHECK (onboarding_step
-- between 0 and 4), which would reject any new 5 write from finishOnboarding().
--
-- New semantics (highest step reached):
--   0 → not started
--   1 → household created
--   2 → baby added
--   3 → size mode selected
--   4 → receiving opt-in saved (new)
--   5 → onboarding complete (invite step sent or skipped)
--
-- Idempotent — drop-if-exists then re-add.
-- ============================================================================

alter table beta.user_activity_summary
  drop constraint if exists user_activity_summary_onboarding_step_check;

alter table beta.user_activity_summary
  add constraint user_activity_summary_onboarding_step_check
  check (onboarding_step between 0 and 5);

-- PostgREST schema cache refresh so the column reads pick up the looser rule
-- without a dashboard kick.
notify pgrst, 'reload schema';
