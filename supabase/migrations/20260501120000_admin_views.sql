-- ============================================================================
-- Admin analytics RPCs (migration #023)
-- ----------------------------------------------------------------------------
-- Adds SECURITY DEFINER helpers used by the in-app /admin dashboard:
--   beta.is_admin()                  → boolean, gates every other RPC here
--   beta.admin_funnel_rollup(...)    → step counts per funnel
--   beta.admin_daily_visits(...)     → daily distinct sessions + users
--   beta.admin_household_summary(...) → CRM-ish roll-up of households
--
-- Admin allowlist is centralized in beta._admin_emails() — update that one
-- function to add/remove admins. When the list grows past ~5, swap it for a
-- real `beta.admin_users` table.
--
-- "Hide my sessions" semantics: when _exclude_admins is true, any session_id
-- ever seen carrying an admin user_id is excluded entirely — so Chris's
-- pre-login landing hits get filtered too, not just the post-signup events.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. _admin_emails() — single source of truth for the admin allowlist.
--    Every other function in this migration delegates to this.
-- ----------------------------------------------------------------------------
create or replace function beta._admin_emails()
returns text[]
language sql
immutable
security definer
set search_path = beta, public
as $$
  select array[
    'chris@sprigloop.com',
    'chrisjolah@outlook.com'
  ]::text[];
$$;

revoke all on function beta._admin_emails() from public;


-- ----------------------------------------------------------------------------
-- 1. is_admin()
-- ----------------------------------------------------------------------------
create or replace function beta.is_admin()
returns boolean
language sql
stable
security definer
set search_path = beta, public
as $$
  select coalesce(
    (select email from auth.users where id = auth.uid()) = any (beta._admin_emails()),
    false
  );
$$;

revoke all on function beta.is_admin() from public;
grant execute on function beta.is_admin() to authenticated;


-- ----------------------------------------------------------------------------
-- 2. _admin_session_ids() — internal helper, used by every roll-up below
--    Returns the set of session_ids tied to an admin user (so we can drop
--    them wholesale when _exclude_admins is true).
--
--    Returns TEXT, not uuid: beta and prod drifted on events.session_id
--    column type (beta=text, prod=uuid). All callers cast e.session_id::text
--    so this works on both. If/when the column types are realigned, this
--    can be tightened back to uuid.
-- ----------------------------------------------------------------------------
drop function if exists beta._admin_session_ids();

create function beta._admin_session_ids()
returns table (session_id text)
language sql
stable
security definer
set search_path = beta, public
as $$
  select distinct e.session_id::text
  from beta.events e
  join auth.users u on u.id = e.user_id
  where u.email = any (beta._admin_emails());
$$;

revoke all on function beta._admin_session_ids() from public;
-- Not granted to authenticated; only the admin RPCs below call it via DEFINER.


-- ----------------------------------------------------------------------------
-- 3. admin_funnel_rollup(funnel, since_days, exclude_admins)
--    Returns one row per funnel step with distinct sessions + users.
-- ----------------------------------------------------------------------------
create or replace function beta.admin_funnel_rollup(
  _funnel_id      text,
  _since_days     int default 7,
  _exclude_admins boolean default true
)
returns table (
  step       smallint,
  event_name text,
  sessions   bigint,
  users      bigint
)
language plpgsql
stable
security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with filtered as (
    select e.*
    from beta.events e
    where e.funnel_id = _funnel_id
      and e.funnel_step is not null
      and e.created_at >= now() - make_interval(days => _since_days)
      and (
        not _exclude_admins
        or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
      )
  )
  select
    f.funnel_step                         as step,
    mode() within group (order by f.event_name) as event_name,
    count(distinct f.session_id)::bigint  as sessions,
    count(distinct f.user_id)::bigint     as users
  from filtered f
  group by f.funnel_step
  order by f.funnel_step;
end;
$$;

revoke all on function beta.admin_funnel_rollup(text, int, boolean) from public;
grant execute on function beta.admin_funnel_rollup(text, int, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. admin_daily_visits(since_days, exclude_admins)
--    Daily distinct sessions + distinct users (any event_name).
-- ----------------------------------------------------------------------------
create or replace function beta.admin_daily_visits(
  _since_days     int default 7,
  _exclude_admins boolean default true
)
returns table (
  day      date,
  sessions bigint,
  users    bigint,
  events   bigint
)
language plpgsql
stable
security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with filtered as (
    select e.*
    from beta.events e
    where e.created_at >= now() - make_interval(days => _since_days)
      and (
        not _exclude_admins
        or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
      )
  )
  select
    f.created_at::date                    as day,
    count(distinct f.session_id)::bigint  as sessions,
    count(distinct f.user_id)::bigint     as users,
    count(*)::bigint                      as events
  from filtered f
  group by f.created_at::date
  order by f.created_at::date;
end;
$$;

revoke all on function beta.admin_daily_visits(int, boolean) from public;
grant execute on function beta.admin_daily_visits(int, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. admin_household_summary(exclude_admins)
--    CRM-ish per-household roll-up. Member emails are ARRAY-aggregated for
--    expansion in the UI; baby_names too. last_event_at is from events
--    (joined on the events table's user_id ↔ household_members).
-- ----------------------------------------------------------------------------
create or replace function beta.admin_household_summary(
  _exclude_admins boolean default true
)
returns table (
  household_id   uuid,
  household_name text,
  member_count   int,
  member_emails  text[],
  baby_count     int,
  baby_names     text[],
  item_count     int,
  last_event_at  timestamptz,
  created_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  with members as (
    select
      hm.household_id,
      array_agg(u.email::text order by hm.role = 'owner' desc, u.email) as emails,
      count(*)::int as cnt
    from beta.household_members hm
    left join auth.users u on u.id = hm.user_id
    group by hm.household_id
  ),
  babies_agg as (
    select
      b.household_id,
      array_agg(coalesce(b.name, '(unnamed)')::text order by b.created_at) as names,
      count(*)::int as cnt
    from beta.babies b
    group by b.household_id
  ),
  items_agg as (
    select
      ci.household_id,
      count(*)::int as cnt
    from beta.clothing_items ci
    group by ci.household_id
  ),
  last_evt as (
    -- Latest event timestamp for any user belonging to the household.
    select hm.household_id, max(e.created_at) as last_at
    from beta.household_members hm
    join beta.events e on e.user_id = hm.user_id
    where (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    )
    group by hm.household_id
  )
  -- Explicit casts on every returned column. Postgres requires the result row
  -- type to match the RETURNS TABLE declaration exactly — auth.users.email is
  -- varchar in the Supabase auth schema, not text, so a bare array_agg(u.email)
  -- returns varchar[] and trips "structure of query does not match function
  -- result type". Same defensive cast on the scalar columns.
  select
    h.id::uuid                          as household_id,
    h.name::text                        as household_name,
    coalesce(m.cnt, 0)::int             as member_count,
    coalesce(m.emails, array[]::text[]) as member_emails,
    coalesce(ba.cnt, 0)::int            as baby_count,
    coalesce(ba.names, array[]::text[]) as baby_names,
    coalesce(ia.cnt, 0)::int            as item_count,
    le.last_at::timestamptz             as last_event_at,
    h.created_at::timestamptz           as created_at
  from beta.households h
  left join members    m  on m.household_id  = h.id
  left join babies_agg ba on ba.household_id = h.id
  left join items_agg  ia on ia.household_id = h.id
  left join last_evt   le on le.household_id = h.id
  -- Drop households whose ONLY members are admins, when the toggle is on.
  where (
    not _exclude_admins
    or exists (
      select 1
      from beta.household_members hm
      left join auth.users u on u.id = hm.user_id
      where hm.household_id = h.id
        and (u.email is null or u.email::text <> all (beta._admin_emails()))
    )
  )
  order by le.last_at desc nulls last, h.created_at desc;
end;
$$;

revoke all on function beta.admin_household_summary(boolean) from public;
grant execute on function beta.admin_household_summary(boolean) to authenticated;
