-- ============================================================================
-- Email outbox: bag_on_the_way trigger (migration #025)
-- ----------------------------------------------------------------------------
-- Migrates email #14 ("Your Sprigloop bag is on the way") off the per-event
-- Studio Database Webhook + standalone send-bag-on-the-way edge function and
-- onto the outbox + central dispatcher pattern.
--
-- Trigger fires AFTER UPDATE OF status on beta.pass_along_batches when the
-- row transitions INTO 'bag_in_transit'. It gathers everything the dispatcher
-- needs to render (recipient email + first name from auth.users, item count
-- from clothing_items, recipient label from destination_type/recipient_name)
-- and writes a single email_outbox row via beta.enqueue_email().
--
-- Idempotency:
--   - WHEN clause + internal `is distinct from` check both ensure we only
--     fire on a real transition INTO bag_in_transit, not on every UPDATE
--     while the row is already in that state.
--   - dedupe_key = 'bag_on_the_way:<batch_id>' guarantees at-most-one
--     enqueue per batch even if the trigger fires twice.
--
-- After this migration applies AND the dispatcher is deployed with the
-- new render_bag_on_the_way template, the old Studio webhook on
-- pass_along_batches must be DISABLED (manual step, dashboard) to avoid
-- duplicate sends. The old send-bag-on-the-way function + its webhook
-- secret will be removed in a follow-up cleanup commit.
-- ============================================================================

create or replace function beta.enqueue_bag_on_the_way()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  user_email      text;
  user_full_name  text;
  first_name_val  text;
  item_count_val  int;
  recipient_label text;
  app_url         text := 'https://sprigloop.com';
begin
  -- Defensive guards. The trigger WHEN clause already filters most of these,
  -- but they protect against direct calls + future condition changes.
  if new.status <> 'bag_in_transit' then return new; end if;
  if old.status is not distinct from new.status then return new; end if;
  if new.created_by is null then return new; end if;

  -- Resolve the creator (the user we're emailing).
  select u.email::text, u.raw_user_meta_data->>'name'
    into user_email, user_full_name
  from auth.users u
  where u.id = new.created_by;

  if user_email is null then return new; end if;

  -- First name from "First Last" metadata; null if no name set.
  first_name_val := nullif(split_part(coalesce(user_full_name, ''), ' ', 1), '');

  -- Item count for this batch (matches what the old function sent).
  select count(*)::int into item_count_val
  from beta.clothing_items
  where pass_along_batch_id = new.id;

  -- Recipient label. 'family' destinations never expose the receiving
  -- household's identity to the sender — privacy contract from
  -- feedback_pass_along_framing memory. person/charity carry the name
  -- the user themselves typed in.
  recipient_label := case new.destination_type
    when 'family'  then 'another Sprigloop family'
    when 'person'  then coalesce(new.recipient_name, 'the recipient you chose')
    when 'charity' then coalesce(new.recipient_name, 'the charity you chose')
    else 'the recipient'
  end;

  perform beta.enqueue_email(
    'bag_on_the_way',
    new.created_by,
    user_email,
    jsonb_build_object(
      'first_name',      first_name_val,
      'item_count',      item_count_val,
      'recipient_label', recipient_label,
      'bag_url',         app_url || '/pass-along/' || new.id::text,
      'batch_id',        new.id
    ),
    'bag_on_the_way:' || new.id::text,
    null
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_bag_on_the_way() from public;

drop trigger if exists pass_along_batches_bag_on_the_way_email
  on beta.pass_along_batches;

create trigger pass_along_batches_bag_on_the_way_email
  after update of status on beta.pass_along_batches
  for each row
  when (new.status = 'bag_in_transit' and old.status is distinct from 'bag_in_transit')
  execute function beta.enqueue_bag_on_the_way();

comment on function beta.enqueue_bag_on_the_way() is
  'Trigger function: enqueues email #14 (bag_on_the_way) when a pass_along_batch transitions to bag_in_transit. Replaces the standalone send-bag-on-the-way edge function as of 2026-05-04.';
