-- ============================================================================
-- Push notifications: bag status transition triggers (migration #037)
-- ----------------------------------------------------------------------------
-- Three notifications tied to pass_along_batches status changes:
--
--   bag_in_transit  → "Your Sprigloop bag is on the way!"
--   received        → "We got your bag — we'll take it from here."
--   fulfilled       → "Your items found a new home!" / "have been donated!"
--
-- Each trigger fires AFTER UPDATE on pass_along_batches when the status
-- column transitions TO the target value. Deduped per batch so a manual
-- status correction doesn't double-fire.
--
-- Recipient is the household creator (the user who packed the bag). We
-- look up the household owner via household_members where role = 'owner',
-- falling back to created_by on the batch itself.
-- ============================================================================

-- ─── Helper: household owner user_id ─────────────────────────────────────
create or replace function beta._batch_owner_user_id(_batch_id uuid)
returns uuid
language sql
stable
security definer
set search_path = beta, public
as $$
  select coalesce(
    -- Prefer the household owner
    (
      select hm.user_id
      from beta.pass_along_batches b
      join beta.household_members hm on hm.household_id = b.household_id
      where b.id = _batch_id
        and hm.role = 'owner'
      limit 1
    ),
    -- Fall back to batch created_by
    (
      select created_by
      from beta.pass_along_batches
      where id = _batch_id
    )
  );
$$;

revoke all on function beta._batch_owner_user_id(uuid) from public;


-- ─── Trigger function ─────────────────────────────────────────────────────
create or replace function beta.enqueue_bag_status_push()
returns trigger
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  recipient_uid  uuid;
  push_title     text;
  push_body      text;
  dedupe         text;
begin
  -- Only care about status changes TO these three values.
  if new.status not in ('bag_in_transit', 'received', 'fulfilled') then
    return new;
  end if;
  -- Ignore no-ops (status unchanged).
  if old.status = new.status then
    return new;
  end if;

  recipient_uid := beta._batch_owner_user_id(new.id);
  if recipient_uid is null then return new; end if;

  if new.status = 'bag_in_transit' then
    push_title := 'Your Sprigloop bag is on the way!';
    push_body  := 'Start gathering those outgrown clothes - your bag should arrive soon.';
    dedupe     := 'push:bag_in_transit:' || new.id::text;

  elsif new.status = 'received' then
    push_title := 'We got your bag!';
    push_body  := 'Sprigloop received your pass-along bag. We''ll take it from here.';
    dedupe     := 'push:received:' || new.id::text;

  elsif new.status = 'fulfilled' then
    -- Copy varies by destination.
    if new.destination_type = 'charity' then
      push_body := 'Your outgrown items have been donated. Thank you!';
    else
      push_body := 'Your outgrown items found a new home with a Sprigloop family.';
    end if;
    push_title := 'Items passed along!';
    dedupe     := 'push:fulfilled:' || new.id::text;
  end if;

  perform beta.enqueue_push(
    recipient_uid,
    push_title,
    push_body,
    jsonb_build_object('batch_id', new.id, 'status', new.status),
    dedupe
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_bag_status_push() from public;

drop trigger if exists pass_along_batches_bag_status_push on beta.pass_along_batches;

create trigger pass_along_batches_bag_status_push
  after update of status on beta.pass_along_batches
  for each row
  when (
    new.status in ('bag_in_transit', 'received', 'fulfilled')
    and old.status is distinct from new.status
  )
  execute function beta.enqueue_bag_status_push();

comment on function beta.enqueue_bag_status_push() is
  'Enqueues push notifications on bag_in_transit, received, and fulfilled status transitions.';
