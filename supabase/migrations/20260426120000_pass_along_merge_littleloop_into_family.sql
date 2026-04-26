-- 016_pass_along_merge_littleloop_into_family.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Merges the 'littleloop' destination_type into 'family' on
-- beta.pass_along_batches.
--
-- Background:
--   Originally we offered four destinations: 'littleloop' (ship to Sprigloop,
--   we decide whether to match or donate) and 'family' (ship to Sprigloop,
--   we forward to a matched household). Both destinations physically routed
--   to the same address and shared the same 4-step lifecycle. The two CTAs
--   were paying decision-tax for what was effectively the same operational
--   path. We collapsed them into a single 'Send to a Sprigloop family'
--   option, with copy that says outright that we'll donate if no match
--   is found — preserving the 'I don't care, you decide' affordance
--   without making the user pre-pick it.
--
-- This migration:
--   1. Backfills any existing rows where destination_type = 'littleloop'
--      to destination_type = 'family'.
--   2. Updates the destination_type default to 'family' (was 'littleloop').
--   3. Recreates pass_along_batches_destination_check to drop 'littleloop'
--      from the allowed enum.
--   4. Recreates pass_along_batches_recipient_required to drop 'littleloop'
--      from the no-recipient branch.
--
-- The recipient_household_only_family constraint already gates on
-- destination_type = 'family' specifically, so it needs no change.
-- label_requested_at semantics now apply to 'family' (see PassAlongBatch.jsx
-- canRequestLabel — same field, just the only HQ-routed destination now).
--
-- Idempotent: backfill is a no-op once run; constraint drop/add is safe
-- to re-run.

-- ─── 1. Backfill existing rows ─────────────────────────────────────────────

update beta.pass_along_batches
   set destination_type = 'family'
 where destination_type = 'littleloop';

-- ─── 2. Update column default ──────────────────────────────────────────────

alter table beta.pass_along_batches
  alter column destination_type set default 'family';

-- ─── 3. Tighten destination_check ──────────────────────────────────────────

alter table beta.pass_along_batches
  drop constraint if exists pass_along_batches_destination_check;

alter table beta.pass_along_batches
  add  constraint pass_along_batches_destination_check
  check (destination_type in ('family','person','charity'));

-- ─── 4. Recreate recipient_required without 'littleloop' ──────────────────
-- Mirrors the migration-013 loose form (drafts are scratch space) but with
-- 'littleloop' removed from the no-recipient branch.

alter table beta.pass_along_batches
  drop constraint if exists pass_along_batches_recipient_required;

alter table beta.pass_along_batches
  add  constraint pass_along_batches_recipient_required
  check (
    -- Drafts are allowed any intermediate combination of destination +
    -- recipient — matches the 'scratch space' mental model for drafts.
    status = 'draft'
    or (destination_type = 'family'
         and recipient_name is null
         and recipient_address is null)
    or (destination_type in ('person','charity')
         and recipient_name is not null
         and length(btrim(recipient_name)) > 0
         and recipient_address is not null
         and length(btrim(recipient_address)) > 0)
  );

-- ─── PostgREST schema reload ──────────────────────────────────────────────

notify pgrst, 'reload schema';
