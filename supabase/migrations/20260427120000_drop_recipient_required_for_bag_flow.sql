-- 018_drop_recipient_required_for_bag_flow.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Drops beta.pass_along_batches_recipient_required entirely.
--
-- Background:
--   The original constraint required recipient_name + recipient_address on
--   non-draft person/charity batches because Sprigloop generated a shipping
--   label per batch and needed the destination address.
--
--   With the bag flow, every batch ships in a Sprigloop-issued bag and the
--   user writes the recipient address directly on the bag. The in-app
--   recipient fields are no longer collected (PassAlongBatch dropped them
--   in this same change set), and the columns are now always-null for new
--   rows.
--
-- This migration:
--   1. Drops pass_along_batches_recipient_required.
--
-- We keep the recipient_name / recipient_address columns themselves for
-- backward-compat with existing rows that have values from the pre-bag-flow
-- era. They become legacy columns the app no longer writes to.
--
-- The recipient_household_only_family constraint (recipient_household_id is
-- only valid for 'family' destination) stays — that's about HQ matching,
-- not user input.
--
-- Idempotent. Safe to re-run.

alter table beta.pass_along_batches
  drop constraint if exists pass_along_batches_recipient_required;

-- ─── PostgREST schema reload ────────────────────────────────────────────────

notify pgrst, 'reload schema';
