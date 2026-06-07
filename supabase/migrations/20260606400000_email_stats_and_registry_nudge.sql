-- ============================================================================
-- Migration: email stats fixes + D+10 registry nudge
-- ----------------------------------------------------------------------------
-- 1. Fix _user_item_count — was clothing_items only; now includes items table
-- 2. Fix _user_inventory_stats — was clothing_items only; now includes items
-- 3. Add d10_registry to onboarding sequence (D+10, skips if < 5 items)
-- ============================================================================

-- ── 1. Fix _user_item_count ───────────────────────────────────────────────────
-- Used by render_d2_nudge to determine engaged (5+ items) vs not.
-- Previously only counted clothing_items — missed all non-clothing gear.

create or replace function beta._user_item_count(_user_id uuid)
returns int
language sql
stable
security definer
set search_path = beta, public
as $$
  with hh as (
    select household_id from beta.household_members where user_id = _user_id
  )
  select (
    (select count(*)::int from beta.clothing_items where household_id in (select household_id from hh))
    +
    (select count(*)::int from beta.items where household_id in (select household_id from hh))
  );
$$;

revoke all on function beta._user_item_count(uuid) from public;

-- ── 2. Fix _user_inventory_stats ─────────────────────────────────────────────
-- Used by render_d7_snapshot. Previously only counted clothing_items.
-- Now includes both tables. top_brand still from clothing only (items
-- table doesn't have a brand field in the same way).

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
  clothing as (
    select * from beta.clothing_items
    where household_id in (select household_id from user_households)
  ),
  non_clothing as (
    select * from beta.items
    where household_id in (select household_id from user_households)
  ),
  brand_mode as (
    select brand, count(*) as c
    from clothing
    where brand is not null and brand <> ''
    group by brand
    order by c desc, brand asc
    limit 1
  )
  select jsonb_build_object(
    'total',     (select count(*) from clothing) + (select count(*) from non_clothing),
    'owned',
      (select count(*) from clothing where inventory_status = 'owned')
      + (select count(*) from non_clothing where inventory_status = 'owned'),
    'outgrown',  (select count(*) from clothing where inventory_status in ('outgrown','pass_along','donated','exchanged')),
    'top_brand', (select brand from brand_mode)
  );
$$;

revoke all on function beta._user_inventory_stats(uuid) from public;

-- ── 3. Add d10_registry to onboarding sequence ───────────────────────────────
-- Fires at D+10. render_d10_registry skips if user has fewer than 5 items.
-- Explains the registry share feature — that it shows real gaps from
-- owned inventory, not a wish list.

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
  if new.email is null or new.email = '' then return new; end if;
  if coalesce(new.is_anonymous, false) is true then return new; end if;

  user_full_name := coalesce(new.raw_user_meta_data->>'name', '');
  first_name_val := nullif(split_part(user_full_name, ' ', 1), '');
  payload_val    := jsonb_build_object('first_name', first_name_val);

  perform beta.enqueue_email('d2_nudge',     new.id, new.email::text, payload_val, 'd2_nudge:'     || new.id::text, now() + interval '2 days');
  perform beta.enqueue_email('d4_invite',    new.id, new.email::text, payload_val, 'd4_invite:'    || new.id::text, now() + interval '4 days');
  perform beta.enqueue_email('d7_snapshot',  new.id, new.email::text, payload_val, 'd7_snapshot:'  || new.id::text, now() + interval '7 days');
  perform beta.enqueue_email('d10_registry', new.id, new.email::text, payload_val, 'd10_registry:' || new.id::text, now() + interval '10 days');
  perform beta.enqueue_email('d14_reengage', new.id, new.email::text, payload_val, 'd14_reengage:' || new.id::text, now() + interval '14 days');

  return new;
end;
$func$;

revoke all on function beta.enqueue_onboarding_sequence() from public;

comment on function beta.enqueue_onboarding_sequence() is
  'Trigger: enqueues 5-email onboarding sequence at signup. d2/d4/d7/d10/d14. Updated 2026-06-06 to add d10_registry + fix item count scope.';

notify pgrst, 'reload schema';
