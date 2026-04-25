-- ============================================================================
-- Migration 015 — drop the sizemode step from onboarding (remap user state)
-- ============================================================================
-- Mom interviews 2026-04-25 said nearly everyone thinks of baby clothing
-- size in age bands, so the "How do you think about sizes?" step was cut.
-- The babies.size_mode column stays (Profile still exposes the dial for
-- the long tail), and new rows pick up the 'by_age' default from
-- migration 001.
--
-- New step semantics on user_activity_summary.onboarding_step:
--   0 → not started
--   1 → household created
--   2 → baby added             (was 2; now skips sizemode → receiving)
--   3 → receiving opt-in saved (was 4)
--   4 → invite handled         (was 5)
--   5 → onboarding complete    (was 6)
--
-- Existing rows need a one-time decrement for any user who got past
-- baby. Anyone at step <= 2 is already on the right screen; anyone
-- at step >= 3 was sitting on a step that has shifted down by one.
-- ============================================================================

-- Run inside a single transaction so a half-applied state can't strand users.
begin;

-- 1) Loosen the CHECK temporarily. Migration 014 set it to 0..6; the new
--    target is 0..5. Dropping it now lets the decrement land regardless
--    of which constraint is currently in place (014 may or may not have
--    been applied in this env).
alter table beta.user_activity_summary
  drop constraint if exists user_activity_summary_onboarding_step_check;

-- 2) Decrement any user past the old sizemode step. Old indices to remap:
--    3 (was on receiving)         → 2
--    4 (was on invite)            → 3
--    5 (was on scan / completed under pre-014 schema) → 4
--    6 (was complete under 014)   → 5
update beta.user_activity_summary
   set onboarding_step = onboarding_step - 1
 where onboarding_step >= 3;

-- 3) Re-add the constraint at the new ceiling.
alter table beta.user_activity_summary
  add constraint user_activity_summary_onboarding_step_check
  check (onboarding_step between 0 and 5);

commit;

-- PostgREST schema cache refresh so the column reads pick up the new
-- ceiling without a dashboard kick.
notify pgrst, 'reload schema';
