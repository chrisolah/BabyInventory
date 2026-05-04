-- ============================================================================
-- Email outbox: D+2 onboarding nudge (#05) trigger (migration #028)
-- ----------------------------------------------------------------------------
-- First lifecycle (time-scheduled) email through the outbox. Fires when a
-- new user signs up with an email — or when an anonymous user converts to
-- a permanent account — and enqueues with scheduled_for = signup + 2 days.
-- The dispatcher's claim_outbox_batch RPC already filters
-- (scheduled_for is null or scheduled_for <= now()), so the row simply
-- becomes claimable when its time comes; no separate cron job needed.
--
-- The renderer queries live state at send time (item count via the
-- _user_item_count RPC below) and picks one of two variants:
--   <  5 items  → "Five tags is the magic number" (push to engagement)
--   >= 5 items  → "Sprigloop's earning its keep" (acknowledge progress)
--
-- The trigger fires on:
--   1. INSERT to auth.users when row has email + is_anonymous=false
--      (typical email signup)
--   2. UPDATE to auth.users where email or is_anonymous transitions in a
--      way that makes the row "newly engageable" — empty→set email, OR
--      anon→permanent. Both cases mean a previously-unaddressable user
--      now has an inbox, and the D+2 timer should start now.
--
-- dedupe_key = 'd2_nudge:<user_id>' guarantees at-most-one enqueue per
-- user across both triggers + any future re-fires.
-- ============================================================================

-- ── Helper: live item count for a user across all their households ────────
-- The household_members join handles users in shared households (co-parent,
-- grandparent, etc.) — count includes all items in any household they're
-- a member of, matching the wardrobe-view experience.
create or replace function beta._user_item_count(_user_id uuid)
returns int
language sql
stable
security definer
set search_path = beta, public
as $$
  select count(*)::int
  from beta.clothing_items ci
  where ci.household_id in (
    select hm.household_id
    from beta.household_members hm
    where hm.user_id = _user_id
  );
$$;

revoke all on function beta._user_item_count(uuid) from public;

-- ── Trigger function ──────────────────────────────────────────────────────
create or replace function beta.enqueue_d2_nudge()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  user_full_name text;
  first_name_val text;
begin
  -- Defensive (WHEN clause already filters).
  if new.email is null or new.email = '' then return new; end if;
  if coalesce(new.is_anonymous, false) is true then return new; end if;

  user_full_name := coalesce(new.raw_user_meta_data->>'name', '');
  first_name_val := nullif(split_part(user_full_name, ' ', 1), '');

  perform beta.enqueue_email(
    'd2_nudge',
    new.id,
    new.email::text,
    jsonb_build_object(
      'first_name', first_name_val
    ),
    'd2_nudge:' || new.id::text,
    now() + interval '2 days'
  );

  return new;
end;
$func$;

revoke all on function beta.enqueue_d2_nudge() from public;

-- ── INSERT trigger: typical email signup ──────────────────────────────────
drop trigger if exists auth_users_d2_nudge_insert on auth.users;
create trigger auth_users_d2_nudge_insert
  after insert on auth.users
  for each row
  when (
    new.email is not null
    and new.email <> ''
    and coalesce(new.is_anonymous, false) is false
  )
  execute function beta.enqueue_d2_nudge();

-- ── UPDATE trigger: anon→permanent OR email-added ─────────────────────────
-- WHEN clause filters to true transitions only — skips routine UPDATEs
-- where the row was already engageable (e.g., email change after signup).
-- Without that, the trigger would re-enqueue on every email change; the
-- dedupe_key would catch it but it's cheaper to short-circuit here.
drop trigger if exists auth_users_d2_nudge_update on auth.users;
create trigger auth_users_d2_nudge_update
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
  execute function beta.enqueue_d2_nudge();

comment on function beta.enqueue_d2_nudge() is
  'Trigger function: enqueues email #05 (D+2 onboarding nudge) on auth.users INSERT or anon→permanent conversion. Schedules for now()+2d. Renderer picks variant based on live item count.';
