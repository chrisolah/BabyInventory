-- 017_concierge_tasks_label_request_to_bag_request.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Renames concierge_tasks.task_type 'label_request' → 'bag_request' to match
-- the pivot from "we email you a prepaid label" → "we ship you a Sprigloop
-- bag" for the pass-along flow.
--
-- Background:
--   The original flow: user requests a prepaid shipping label, Chris emails
--   it, user puts it on their own box and ships. Concierge task type was
--   'label_request'.
--
--   The new flow: user requests a Sprigloop bag, Chris ships them a bag
--   (prelabeled-HQ for family destinations, blank-label flat-rate with
--   prepaid postage for friend/charity destinations). Concierge task type
--   is 'bag_request'. PassAlongBatch.jsx now inserts 'bag_request'; the DB
--   needs to accept that value.
--
--   Any existing 'label_request' rows are backfilled to 'bag_request' since
--   they all represent the same underlying "user needs a physical thing
--   shipped to them" intent — Chris will fulfill the open ones with a bag
--   instead of a label, which is what he wants anyway.
--
-- This migration:
--   1. Drops the OLD type_check constraint first. This matters: if we
--      tried to UPDATE label_request → bag_request before dropping, the
--      old constraint would reject the new row version because
--      'bag_request' isn't in its allow-list. Drop-first removes the
--      block; the UPDATE runs cleanly; then we add the new (superset)
--      constraint.
--   2. Backfills label_request → bag_request on existing rows.
--   3. Adds the new type_check as a SUPERSET that accepts BOTH
--      'label_request' (legacy) and 'bag_request' (new). Superset means
--      the SQL migration is also order-independent vs. the code deploy:
--      old clients inserting 'label_request' and new clients inserting
--      'bag_request' both succeed during the rollout window.
--
-- A future cleanup migration can drop 'label_request' from the allowed
-- list once we're confident no cached client bundles still reference it
-- (typically a week after the deploy is fine).
--
-- Idempotent. Safe to re-run.

-- ─── 1. Drop the OLD constraint so the UPDATE below isn't blocked ──────────

alter table beta.concierge_tasks
  drop constraint if exists concierge_tasks_type_check;

-- ─── 2. Backfill ────────────────────────────────────────────────────────────

update beta.concierge_tasks
   set task_type = 'bag_request'
 where task_type = 'label_request';

-- ─── 3. Add the new type_check as a superset ───────────────────────────────

alter table beta.concierge_tasks
  add  constraint concierge_tasks_type_check
  check (task_type in ('bag_request','label_request','family_match_needed','quality_flag'));

-- ─── PostgREST schema reload ────────────────────────────────────────────────

notify pgrst, 'reload schema';
