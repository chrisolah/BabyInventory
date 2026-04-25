-- ============================================================================
-- Migration 008 — babies.age_range_override
-- ============================================================================
-- Adds an optional manual age-band override to beta.babies.
--
-- Why: inferAgeRange() computes a baby's current age range from DOB alone.
-- That's right for most families but wrong for the tails — a 95th-percentile
-- 4-month-old already wears 6-9M; a small-for-age 10-month-old still wears
-- 6-9M. Parents know this before we do (the pediatrician told them at the
-- last well-visit), so let them set it explicitly.
--
-- Shape:
--   null                → follow DOB-based inference (default)
--   one of AGE_RANGES   → pin the baby to that range; front-end ignores
--                         monthsOld for currentRange and suppresses the
--                         outgrow banner (since the banner is a calendar-age
--                         signal that doesn't apply to overridden babies).
--
-- Apply via Supabase SQL Editor against the beta project. Idempotent —
-- re-running is a no-op once the column + constraint are present.
-- ============================================================================

alter table beta.babies
  add column if not exists age_range_override text;

alter table beta.babies
  drop constraint if exists babies_age_range_override_check;

alter table beta.babies
  add constraint babies_age_range_override_check
  check (
    age_range_override is null
    or age_range_override in ('0-3M','3-6M','6-9M','9-12M','12-18M','18-24M')
  );
