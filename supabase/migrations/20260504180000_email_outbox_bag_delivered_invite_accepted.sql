-- ============================================================================
-- Email outbox: bag_delivered (#15) + invite_accepted (#26) (migration #030)
-- ----------------------------------------------------------------------------
-- Two transactional templates, both follow the same pattern as
-- bag_on_the_way / first_pass_along: PG trigger gathers data + enqueues,
-- dispatcher renders from self-contained payload.
--
-- bag_delivered: fires on pass_along_batches UPDATE → 'fulfilled'. Coexists
-- with the existing first_pass_along trigger on the same transition — one
-- is the per-batch transactional confirmation, the other is the one-time
-- per-household celebration. Both fire on the same UPDATE; users on their
-- first fulfilled batch get both emails (different purposes).
--
-- invite_accepted: fires on pending_invites UPDATE OF accepted_at where the
-- transition is null → non-null. Recipient is the inviter
-- (pending_invites.invited_by), not the new joiner. The new joiner gets
-- their own welcome email via the existing send-welcome-email function if
-- they're a brand new account.
-- ============================================================================

-- ─── bag_delivered trigger ────────────────────────────────────────────────
create or replace function beta.enqueue_bag_delivered_email()
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
begin
  if new.status <> 'fulfilled' then return new; end if;
  if old.status is not distinct from new.status then return new; end if;
  if new.created_by is null then return new; end if;

  select u.email::text, u.raw_user_meta_data->>'name'
    into user_email, user_full_name
  from auth.users u
  where u.id = new.created_by;

  if user_email is null then return new; end if;

  first_name_val := nullif(split_part(coalesce(user_full_name, ''), ' ', 1), '');

  select count(*)::int into item_count_val
  from beta.clothing_items
  where pass_along_batch_id = new.id;

  recipient_label := case new.destination_type
    when 'family'  then 'another Sprigloop family'
    when 'person'  then coalesce(new.recipient_name, 'the recipient you chose')
    when 'charity' then coalesce(new.recipient_name, 'the charity you chose')
    else 'the recipient'
  end;

  perform beta.enqueue_email(
    'bag_delivered',
    new.created_by,
    user_email,
    jsonb_build_object(
      'first_name',      first_name_val,
      'item_count',      item_count_val,
      'recipient_label', recipient_label,
      'batch_id',        new.id
    ),
    'bag_delivered:' || new.id::text,
    null
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_bag_delivered_email() from public;

drop trigger if exists pass_along_batches_bag_delivered_email
  on beta.pass_along_batches;

create trigger pass_along_batches_bag_delivered_email
  after update of status on beta.pass_along_batches
  for each row
  when (new.status = 'fulfilled' and old.status is distinct from 'fulfilled')
  execute function beta.enqueue_bag_delivered_email();

-- ─── invite_accepted trigger ──────────────────────────────────────────────
create or replace function beta.enqueue_invite_accepted_email()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  inviter_email   text;
  inviter_name    text;
  inviter_first   text;
  accepter_name   text;
  accepter_first  text;
begin
  -- Only fire on null → non-null transition (defensive — WHEN clause
  -- already filters this).
  if new.accepted_at is null then return new; end if;
  if old.accepted_at is not null then return new; end if;

  -- Resolve the inviter (the user we're emailing).
  select u.email::text, coalesce(u.raw_user_meta_data->>'name', '')
    into inviter_email, inviter_name
  from auth.users u
  where u.id = new.invited_by;

  if inviter_email is null then return new; end if;

  inviter_first := nullif(split_part(inviter_name, ' ', 1), '');

  -- Resolve the accepter (best-effort — if the user record doesn't have
  -- a name, fall back to "Someone").
  if new.accepted_by is not null then
    select coalesce(u.raw_user_meta_data->>'name', '')
      into accepter_name
    from auth.users u
    where u.id = new.accepted_by;
  end if;

  accepter_first := coalesce(nullif(split_part(coalesce(accepter_name, ''), ' ', 1), ''), 'Someone');

  perform beta.enqueue_email(
    'invite_accepted',
    new.invited_by,
    inviter_email,
    jsonb_build_object(
      'inviter_first_name',  inviter_first,
      'accepter_first_name', accepter_first,
      'accepter_full_name',  coalesce(accepter_name, accepter_first)
    ),
    'invite_accepted:' || new.id::text,
    null
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_invite_accepted_email() from public;

drop trigger if exists pending_invites_accepted_email on beta.pending_invites;
create trigger pending_invites_accepted_email
  after update of accepted_at on beta.pending_invites
  for each row
  when (new.accepted_at is not null and old.accepted_at is null)
  execute function beta.enqueue_invite_accepted_email();

comment on function beta.enqueue_bag_delivered_email() is
  'Trigger function: enqueues email #15 (bag_delivered) on every pass_along_batch fulfilled transition. Coexists with first_pass_along trigger.';
comment on function beta.enqueue_invite_accepted_email() is
  'Trigger function: enqueues email #26 (invite_accepted) when a pending_invites row is accepted. Recipient is the inviter.';
