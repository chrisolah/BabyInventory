-- 019_bag_flow_status_states.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Completes the bag-flow lifecycle on pass_along_batches.
--
-- Background:
--   The original status enum ('draft','shipped','received','fulfilled',
--   'canceled') predates the bag flow. Under the bag flow there are two
--   important in-between states the user (and Chris) need to see:
--
--     bag_requested   — user has asked Sprigloop to ship them a bag.
--                       Items are locked. Awaiting Chris to dispatch.
--     bag_in_transit  — Chris has shipped the bag to the user (resolved
--                       the bag_request concierge_task). User now needs
--                       to receive it, fill it, and drop in a mailbox.
--
--   Once the user confirms they've mailed the bag, status advances to
--   'shipped' (family path) or auto-fulfills (person/charity paths,
--   same as today).
--
-- This migration:
--   1. Drops the OLD status check, backfills any draft+label_requested_at
--      rows to 'bag_requested', then adds the NEW (wider) status check.
--      Drop-then-update-then-readd because the old constraint would block
--      the backfill UPDATE (same pattern as migration 017's task_type
--      rename — see feedback_constraint_rewrite_order memory).
--   2. Adds bag_dispatched_at column on pass_along_batches — stamped
--      automatically when Chris resolves the bag_request concierge_task.
--   3. Adds an AFTER UPDATE trigger on concierge_tasks: when a bag_request
--      row flips status to 'resolved', the trigger advances the related
--      pass_along_batch from bag_requested → bag_in_transit and stamps
--      bag_dispatched_at. This frees Chris from a manual dual-write — he
--      just clicks resolve in Studio and the batch moves on its own.
--
-- Per-user shipping address (autofilled on subsequent bag requests) lives
-- in auth.users.user_metadata.shipping_address — consistent with how
-- name/prefs/welcome_sent_at are stored. No DB schema for that piece.
--
-- Idempotent. Safe to re-run.

-- ─── 1. Status check widening + backfill ───────────────────────────────────

alter table beta.pass_along_batches
  drop constraint if exists pass_along_batches_status_check;

-- Backfill: any draft batch that already has a bag request stamped under
-- the previous flow is mid-journey and should jump to bag_requested so
-- the new UI shows the right state. (This catches batches that pre-date
-- this migration — typically only beta test rows.)
update beta.pass_along_batches
   set status = 'bag_requested'
 where status = 'draft'
   and label_requested_at is not null;

alter table beta.pass_along_batches
  add  constraint pass_along_batches_status_check
  check (status in (
    'draft',
    'bag_requested',
    'bag_in_transit',
    'shipped',
    'received',
    'fulfilled',
    'canceled'
  ));

-- ─── 2. bag_dispatched_at column ───────────────────────────────────────────

alter table beta.pass_along_batches
  add column if not exists bag_dispatched_at timestamptz;

-- ─── 3. Trigger: auto-advance batch on bag_request resolution ──────────────
--
-- Fires AFTER UPDATE on concierge_tasks. Only acts when:
--   • task_type = 'bag_request'                (right kind of task)
--   • status changed from non-resolved → resolved (this update is the resolve)
--   • related_batch_id is set                  (we know which batch)
-- And only updates the batch if it's still in bag_requested state — so
-- the trigger is idempotent against accidental status flips on the task.

create or replace function beta.advance_batch_on_bag_dispatched()
returns trigger
language plpgsql
security definer
set search_path = beta, public
as $$
begin
  if new.task_type = 'bag_request'
     and (old.status is null or old.status <> 'resolved')
     and new.status = 'resolved'
     and new.related_batch_id is not null
  then
    update beta.pass_along_batches
       set status            = 'bag_in_transit',
           bag_dispatched_at = coalesce(bag_dispatched_at, now())
     where id = new.related_batch_id
       and status = 'bag_requested';
  end if;
  return new;
end;
$$;

drop trigger if exists concierge_tasks_advance_batch on beta.concierge_tasks;
create trigger concierge_tasks_advance_batch
  after update on beta.concierge_tasks
  for each row
  execute function beta.advance_batch_on_bag_dispatched();

-- ─── PostgREST schema reload ───────────────────────────────────────────────

notify pgrst, 'reload schema';
