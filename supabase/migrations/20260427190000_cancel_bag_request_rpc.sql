-- 020_cancel_bag_request_rpc.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds an RPC that lets a user cancel an open bag_request, atomically
-- reverting the batch to draft AND marking the concierge_task canceled.
--
-- Why an RPC instead of straight client UPDATEs:
--   pass_along_batches has full RLS (members can update their own rows),
--   but concierge_tasks is INSERT-only for authenticated users — Chris
--   reads + lifecycle-manages tasks via service_role. To let the user
--   cancel both atomically we need a SECURITY DEFINER function that does
--   its own household-membership check and writes both rows in one tx.
--
-- Cancellation is only allowed while the bag hasn't been dispatched yet:
--   • batch.status must be 'bag_requested'
--   • concierge_task.status must be 'open'
-- Once Chris resolves the task (advancing the batch to bag_in_transit
-- via the trigger from migration 019), the bag is on its way and there's
-- no take-back path — the postage on a blank flat-rate bag is already
-- spent. The function silently no-ops in that case rather than raising,
-- so a stale UI cancel button doesn't crash on the user.
--
-- Idempotent. Safe to re-run.

create or replace function beta.cancel_bag_request(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = beta, public
as $$
declare
  v_household_id uuid;
begin
  -- Find the batch's household so we can authorize the caller.
  select household_id
    into v_household_id
    from beta.pass_along_batches
   where id = p_batch_id;

  if v_household_id is null then
    raise exception 'batch_not_found' using errcode = 'P0002';
  end if;

  if not beta.is_household_member(v_household_id, auth.uid()) then
    raise exception 'not_household_member' using errcode = '42501';
  end if;

  -- Revert the batch — only if it's still in bag_requested. If Chris has
  -- already resolved the task and advanced the batch to bag_in_transit
  -- (or beyond), this WHERE clause filters out and we leave the batch
  -- alone. The concierge_task update below has the matching guard.
  update beta.pass_along_batches
     set status                = 'draft',
         label_requested_at    = null,
         label_request_address = null
   where id = p_batch_id
     and status = 'bag_requested';

  -- Cancel any matching open task. resolved_at gets stamped because the
  -- concierge_tasks_resolved_at_shape constraint requires it for any
  -- non-active status.
  update beta.concierge_tasks
     set status      = 'canceled',
         resolved_at = now()
   where related_batch_id = p_batch_id
     and task_type        = 'bag_request'
     and status           = 'open';
end;
$$;

grant execute on function beta.cancel_bag_request(uuid) to authenticated;

-- ─── PostgREST schema reload ───────────────────────────────────────────────

notify pgrst, 'reload schema';
