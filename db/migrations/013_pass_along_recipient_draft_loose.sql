-- 013_pass_along_recipient_draft_loose.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Loosen beta.pass_along_batches_recipient_required so it only fires once the
-- batch has left draft status. The sender-side UX flow is:
--
--   1. User creates a draft batch (destination defaults to 'littleloop').
--   2. User clicks a different destination card — e.g. "A friend or family".
--   3. UI reveals recipient fields so the user can fill them in.
--   4. User ships, at which point name + address must be present.
--
-- With the original constraint, step 2 was impossible: PostgREST sends an
-- UPDATE with just destination_type='person', and the constraint rejects
-- the row because recipient_name/address are still null. The UI had no way
-- to get to step 3 without already having the data for step 3.
--
-- The fix: drafts are the scratch space, full stop. Any intermediate shape
-- is allowed while status='draft'. Once a batch is shipped/received/
-- fulfilled/canceled, the destination/recipient combination must be
-- coherent again — same rules as before.
--
-- This is safe to re-run: dropping and re-adding the constraint is
-- idempotent, and we check the whole table after the new constraint is
-- installed (Postgres validates existing rows against a freshly added
-- check, so any drift from migration 010 would surface here).

alter table beta.pass_along_batches
  drop constraint if exists pass_along_batches_recipient_required;

alter table beta.pass_along_batches
  add  constraint pass_along_batches_recipient_required
  check (
    -- Drafts are allowed any intermediate combination of destination +
    -- recipient — this matches the "scratch space" mental model users have.
    status = 'draft'
    or (destination_type in ('littleloop','family')
         and recipient_name is null
         and recipient_address is null)
    or (destination_type in ('person','charity')
         and recipient_name is not null
         and length(btrim(recipient_name)) > 0
         and recipient_address is not null
         and length(btrim(recipient_address)) > 0)
  );
