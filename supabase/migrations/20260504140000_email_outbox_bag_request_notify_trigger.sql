-- ============================================================================
-- Email outbox: bag_request_notify trigger (migration #027)
-- ----------------------------------------------------------------------------
-- Migrates the operational "new bag request" email off the per-event Studio
-- Database Webhook + standalone notify-bag-request edge function and onto
-- the outbox + central dispatcher pattern.
--
-- This is OPERATIONAL mail (Chris-only, not user-facing). Recipient is
-- hardcoded to chris@sprigloop.com — the operational alias forwarded via
-- Cloudflare Email Routing to sprigloop@gmail.com (Cloudflare→Outlook
-- previously bounced; resolved 2026-05-04 by switching the Cloudflare
-- destination to a Gmail mailbox).
--
-- Trigger fires AFTER INSERT on beta.concierge_tasks WHEN task_type =
-- 'bag_request'. It enriches the row with the requester's email/name (from
-- auth.users) and the household name (via the related batch) and writes a
-- single email_outbox row.
--
-- Idempotency:
--   - WHEN clause filters to bag_request inserts only.
--   - dedupe_key = 'bag_request_notify:<task_id>' guarantees at-most-one
--     enqueue per task even if the trigger fires twice.
--
-- After this migration applies AND the dispatcher is deployed with the new
-- render_bag_request_notify template, the old Studio webhook on
-- concierge_tasks INSERT must be DISABLED (manual step). The old
-- notify-bag-request function + secret will be removed in a follow-up
-- cleanup commit.
-- ============================================================================

create or replace function beta.enqueue_bag_request_notify()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  notify_to        text  := 'chris@sprigloop.com';
  task_payload     jsonb := coalesce(new.payload, '{}'::jsonb);
  destination_t    text  := coalesce(task_payload->>'destination_type', 'unknown');
  reference_code_v text  := coalesce(task_payload->>'reference_code', '—');
  ship_to_address  text  := coalesce(task_payload->>'ship_to_address', '');
  requester_email  text  := '';
  requester_name   text  := '';
  household_name_v text  := '';
begin
  -- Defensive (WHEN clause already filters this).
  if new.task_type <> 'bag_request' then return new; end if;

  -- Requester from auth.users — best-effort, ignore lookup failure.
  if new.created_by is not null then
    select u.email::text, coalesce(u.raw_user_meta_data->>'name', '')
      into requester_email, requester_name
    from auth.users u
    where u.id = new.created_by;
  end if;

  -- Household name via the related batch — best-effort.
  if new.related_batch_id is not null then
    select coalesce(h.name, '')
      into household_name_v
    from beta.pass_along_batches b
    join beta.households h on h.id = b.household_id
    where b.id = new.related_batch_id;
  end if;

  perform beta.enqueue_email(
    'bag_request_notify',
    null,
    notify_to,
    jsonb_build_object(
      'task_id',          new.id,
      'destination_type', destination_t,
      'reference_code',   reference_code_v,
      'ship_to_address',  ship_to_address,
      'requester_email',  coalesce(requester_email, ''),
      'requester_name',   coalesce(requester_name, ''),
      'household_name',   coalesce(household_name_v, ''),
      'requested_at',     new.created_at,
      'related_batch_id', new.related_batch_id
    ),
    'bag_request_notify:' || new.id::text,
    null
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_bag_request_notify() from public;

drop trigger if exists concierge_tasks_bag_request_notify_email
  on beta.concierge_tasks;

create trigger concierge_tasks_bag_request_notify_email
  after insert on beta.concierge_tasks
  for each row
  when (new.task_type = 'bag_request')
  execute function beta.enqueue_bag_request_notify();

comment on function beta.enqueue_bag_request_notify() is
  'Trigger function: enqueues operational bag-request notification email when a bag_request concierge_task is inserted. Replaces the standalone notify-bag-request edge function as of 2026-05-04. Recipient hardcoded to chris@sprigloop.com (Cloudflare-routed to sprigloop@gmail.com).';
