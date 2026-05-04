-- ============================================================================
-- Email outbox: full onboarding sequence (#06/#07/#08) (migration #029)
-- ----------------------------------------------------------------------------
-- Replaces the d2_nudge-only trigger with enqueue_onboarding_sequence —
-- one trigger function that schedules ALL FOUR onboarding emails on user
-- creation:
--   d2_nudge      — D+2  (engagement nudge, conditional A/B variant)
--   d4_invite     — D+4  (invite co-parent, skip if already invited)
--   d7_snapshot   — D+7  (weekly snapshot, skip if zero items)
--   d14_reengage  — D+14 (re-engagement, skip if active recently)
--
-- Each row's renderer queries live state at send-time and may return a
-- {skip} verdict — the dispatcher's new mark_outbox_skipped RPC handles
-- those by marking the row status='skipped' (with the reason as
-- last_error per the existing email_outbox_error_when_failed constraint).
--
-- Adding/removing emails from the sequence is a one-line edit in
-- enqueue_onboarding_sequence. Each email's dedupe_key + scheduled_for
-- offset is independent.
-- ============================================================================

-- ─── mark_outbox_skipped RPC ───────────────────────────────────────────────
-- Mirrors mark_outbox_failed but lands in status='skipped' instead of
-- 'failed'. The skipped status is a first-class outcome, not an error —
-- meant for "we evaluated the conditional and decided not to send" cases.
create or replace function beta.mark_outbox_skipped(_id uuid, _reason text)
returns void
language sql
security definer
set search_path = beta, public
as $$
  update beta.email_outbox
  set status = 'skipped',
      last_error = _reason
  where id = _id;
$$;

revoke all on function beta.mark_outbox_skipped(uuid, text) from public;

-- ─── Helper: does the user have a co-parent on their household? ────────────
-- Counts both materialized household_members AND pending invites — both
-- represent "the user has already invited someone." Returns true if the
-- household has more than just the creator OR has at least one pending
-- invite. Used by render_d4_invite to skip the "invite a co-parent" nudge
-- when it would be redundant.
create or replace function beta._user_has_co_parent(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beta, public
as $$
  select coalesce((
    select count(*) > 1
    from beta.household_members hm
    where hm.household_id in (
      select household_id from beta.household_members where user_id = _user_id
    )
  ), false)
  or coalesce((
    select count(*) > 0
    from beta.pending_invites pi
    where pi.household_id in (
      select household_id from beta.household_members where user_id = _user_id
    )
    and pi.accepted_at is null
    and pi.revoked_at is null
    and pi.expires_at > now()
  ), false);
$$;

revoke all on function beta._user_has_co_parent(uuid) from public;

-- ─── Helper: inventory stats for a user's wardrobe ────────────────────────
-- Returns a json object with the fields render_d7_snapshot needs:
--   total       — count of all clothing_items in the user's household(s)
--   owned       — count where inventory_status = 'owned'
--   outgrown    — count where status in (outgrown, pass_along, donated, exchanged)
--   top_brand   — most common brand (mode), or null if no brands recorded
-- All counts are over rows in households the user is a member of, matching
-- the wardrobe-view experience. If the user has no items, total=0 and the
-- renderer will skip with reason='zero_items'.
create or replace function beta._user_inventory_stats(_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = beta, public
as $$
  with user_households as (
    select household_id from beta.household_members where user_id = _user_id
  ),
  items as (
    select * from beta.clothing_items where household_id in (select household_id from user_households)
  ),
  brand_mode as (
    select brand, count(*) as c
    from items
    where brand is not null and brand <> ''
    group by brand
    order by c desc, brand asc
    limit 1
  )
  select jsonb_build_object(
    'total',     (select count(*) from items),
    'owned',     (select count(*) from items where inventory_status = 'owned'),
    'outgrown',  (select count(*) from items where inventory_status in ('outgrown','pass_along','donated','exchanged')),
    'top_brand', (select brand from brand_mode)
  );
$$;

revoke all on function beta._user_inventory_stats(uuid) from public;

-- ─── Helper: has the user been active within N days? ──────────────────────
-- Used by render_d14_reengage to skip the re-engagement nudge if the user
-- has been active recently (auth.users.last_sign_in_at within the window).
-- last_sign_in_at is updated by Gotrue on every successful auth — adequate
-- proxy for "still using the app."
create or replace function beta._user_active_within_days(_user_id uuid, _days int)
returns boolean
language sql
stable
security definer
set search_path = beta, auth, public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = _user_id
      and u.last_sign_in_at is not null
      and u.last_sign_in_at >= now() - make_interval(days => _days)
  );
$$;

revoke all on function beta._user_active_within_days(uuid, int) from public;

-- ─── Combined onboarding trigger function ──────────────────────────────────
-- One trigger schedules all four onboarding emails. Each PERFORM is its
-- own enqueue with independent dedupe_key + scheduled_for, so partial
-- failure (e.g., one dedupe collision) doesn't affect the others.
create or replace function beta.enqueue_onboarding_sequence()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  user_full_name text;
  first_name_val text;
  payload_val    jsonb;
begin
  -- Defensive (WHEN clause filters most of these).
  if new.email is null or new.email = '' then return new; end if;
  if coalesce(new.is_anonymous, false) is true then return new; end if;

  user_full_name := coalesce(new.raw_user_meta_data->>'name', '');
  first_name_val := nullif(split_part(user_full_name, ' ', 1), '');
  payload_val    := jsonb_build_object('first_name', first_name_val);

  perform beta.enqueue_email('d2_nudge',     new.id, new.email::text, payload_val, 'd2_nudge:'     || new.id::text, now() + interval '2 days');
  perform beta.enqueue_email('d4_invite',    new.id, new.email::text, payload_val, 'd4_invite:'    || new.id::text, now() + interval '4 days');
  perform beta.enqueue_email('d7_snapshot',  new.id, new.email::text, payload_val, 'd7_snapshot:'  || new.id::text, now() + interval '7 days');
  perform beta.enqueue_email('d14_reengage', new.id, new.email::text, payload_val, 'd14_reengage:' || new.id::text, now() + interval '14 days');

  return new;
end;
$func$;

revoke all on function beta.enqueue_onboarding_sequence() from public;

-- ─── Replace existing d2_nudge triggers with the new combined trigger ─────
-- The previous triggers (auth_users_d2_nudge_insert / _update) only enqueued
-- d2_nudge. New triggers point at enqueue_onboarding_sequence which schedules
-- the full sequence. We DROP the old enqueue_d2_nudge function only after
-- the trigger swap to avoid a window where the trigger references a missing
-- function.
drop trigger if exists auth_users_d2_nudge_insert on auth.users;
drop trigger if exists auth_users_d2_nudge_update on auth.users;

create trigger auth_users_onboarding_sequence_insert
  after insert on auth.users
  for each row
  when (
    new.email is not null
    and new.email <> ''
    and coalesce(new.is_anonymous, false) is false
  )
  execute function beta.enqueue_onboarding_sequence();

create trigger auth_users_onboarding_sequence_update
  after update of email, is_anonymous on auth.users
  for each row
  when (
    new.email is not null
    and new.email <> ''
    and coalesce(new.is_anonymous, false) is false
    and (
      old.email is null
      or old.email = ''
      or coalesce(old.is_anonymous, false) is true
    )
  )
  execute function beta.enqueue_onboarding_sequence();

drop function if exists beta.enqueue_d2_nudge();

comment on function beta.enqueue_onboarding_sequence() is
  'Trigger function: enqueues the full 4-email onboarding sequence (d2_nudge, d4_invite, d7_snapshot, d14_reengage) at signup with appropriate scheduled_for offsets. Replaces enqueue_d2_nudge as of 2026-05-04.';
