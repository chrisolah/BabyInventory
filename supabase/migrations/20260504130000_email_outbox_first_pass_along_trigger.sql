-- ============================================================================
-- Email outbox: first_pass_along trigger (migration #026)
-- ----------------------------------------------------------------------------
-- Migrates email #17 ("First bundle out the door") off the per-event Studio
-- Database Webhook + standalone send-first-pass-along edge function and onto
-- the outbox + central dispatcher pattern.
--
-- The email is "first per household" — it's sent at most once across a
-- household's lifetime, on the first pass_along_batch that reaches 'fulfilled'.
--
-- Three layers of dedup, in order of cheapness:
--   1. WHEN clause: only fire on the actual transition INTO 'fulfilled'
--      (skips no-op UPDATEs that don't change status).
--   2. Internal `count(*) <> 1` check: must be the household's FIRST
--      fulfilled batch. If a previous batch was already fulfilled, count
--      will be ≥ 2 and we early-return.
--   3. dedupe_key = 'first_pass_along:<household_id>': partial unique index
--      on email_outbox.dedupe_key prevents a second enqueue for the same
--      household even if the count check is somehow bypassed.
--
-- After this migration applies AND the dispatcher is deployed with the new
-- render_first_pass_along template, the old Studio webhook on
-- pass_along_batches → fulfilled must be DISABLED (manual step). The old
-- send-first-pass-along function + secret will be removed in a follow-up
-- cleanup commit.
-- ============================================================================

create or replace function beta.enqueue_first_pass_along()
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
  fulfilled_count int;
begin
  -- Defensive guards (WHEN clause covers most of these but protect against
  -- direct calls + future condition changes).
  if new.status <> 'fulfilled' then return new; end if;
  if old.status is not distinct from new.status then return new; end if;
  if new.created_by is null then return new; end if;

  -- "Is this the household's FIRST fulfilled batch?" check. AFTER trigger
  -- runs in the same transaction as the row update, so this row's new
  -- status='fulfilled' IS visible to the count query. Therefore:
  --   count == 1 → this is the only fulfilled batch in the household → send
  --   count >  1 → an earlier batch was already fulfilled → skip
  select count(*)::int into fulfilled_count
  from beta.pass_along_batches
  where household_id = new.household_id
    and status = 'fulfilled';

  if fulfilled_count <> 1 then return new; end if;

  -- Resolve the user we're emailing.
  select u.email::text, u.raw_user_meta_data->>'name'
    into user_email, user_full_name
  from auth.users u
  where u.id = new.created_by;

  if user_email is null then return new; end if;

  first_name_val := nullif(split_part(coalesce(user_full_name, ''), ' ', 1), '');

  select count(*)::int into item_count_val
  from beta.clothing_items
  where pass_along_batch_id = new.id;

  perform beta.enqueue_email(
    'first_pass_along',
    new.created_by,
    user_email,
    jsonb_build_object(
      'first_name',   first_name_val,
      'item_count',   item_count_val,
      'household_id', new.household_id,
      'batch_id',     new.id
    ),
    'first_pass_along:' || new.household_id::text,
    null
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_first_pass_along() from public;

drop trigger if exists pass_along_batches_first_pass_along_email
  on beta.pass_along_batches;

create trigger pass_along_batches_first_pass_along_email
  after update of status on beta.pass_along_batches
  for each row
  when (new.status = 'fulfilled' and old.status is distinct from 'fulfilled')
  execute function beta.enqueue_first_pass_along();

comment on function beta.enqueue_first_pass_along() is
  'Trigger function: enqueues email #17 (first_pass_along) on the household''s FIRST pass_along_batch that reaches fulfilled. Replaces the standalone send-first-pass-along edge function as of 2026-05-04.';
