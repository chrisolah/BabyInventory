-- ============================================================================
-- Migration: fix admin analytics to include beta.items (non-clothing)
-- Previously admin_activation_funnel, admin_time_to_first_item, and
-- admin_registry_share_rate only counted clothing_items. Users who added
-- gear (strollers, bassinets, etc.) without clothing were not counted as
-- activated. This fixes all three functions.
-- ============================================================================

-- ── 1. Activation funnel ─────────────────────────────────────────────────────
create or replace function beta.admin_activation_funnel(
  _exclude_admins boolean default true
)
returns table (
  stage       text,
  households  int,
  pct         numeric
)
language plpgsql security definer as $$
declare
  _total int;
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  create temp table _hh on commit drop as
    select h.id
    from beta.households h
    where not _exclude_admins
       or exists (
         select 1 from beta.household_members hm
         left join auth.users u on u.id = hm.user_id
         where hm.household_id = h.id
           and (u.email is null or u.email::text <> all (beta._admin_emails()))
       );

  select count(*)::int into _total from _hh;

  return query select 'Signed up'::text, _total, 100.0;

  -- 1+ items: clothing OR non-clothing
  return query
  select '1+ items owned'::text,
         count(distinct hh.id)::int,
         round(count(distinct hh.id)::numeric / nullif(_total,0) * 100, 1)
  from _hh hh
  where exists (
    select 1 from beta.clothing_items ci
    where ci.household_id = hh.id and ci.inventory_status = 'owned'
  ) or exists (
    select 1 from beta.items it
    where it.household_id = hh.id and it.inventory_status = 'owned'
  );

  -- 5+ items: combined count across both tables
  return query
  select '5+ items owned'::text,
         count(*)::int,
         round(count(*)::numeric / nullif(_total,0) * 100, 1)
  from (
    select hh.id
    from _hh hh
    where (
      select count(*)
      from beta.clothing_items ci
      where ci.household_id = hh.id and ci.inventory_status = 'owned'
    ) + (
      select count(*)
      from beta.items it
      where it.household_id = hh.id and it.inventory_status = 'owned'
    ) >= 5
  ) x;

  return query
  select 'Registry shared'::text,
         count(distinct ws.household_id)::int,
         round(count(distinct ws.household_id)::numeric / nullif(_total,0) * 100, 1)
  from beta.wishlist_shares ws
  join _hh on _hh.id = ws.household_id
  where ws.is_active = true;
end;
$$;
revoke all on function beta.admin_activation_funnel(boolean) from public;
grant execute on function beta.admin_activation_funnel(boolean) to authenticated;

-- ── 2. Time to first item ────────────────────────────────────────────────────
create or replace function beta.admin_time_to_first_item(
  _exclude_admins boolean default true
)
returns table (
  median_minutes  numeric,
  avg_minutes     numeric,
  sample_size     int
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  with first_clothing as (
    select ci.household_id, min(ci.created_at) as first_at
    from beta.clothing_items ci
    where ci.inventory_status = 'owned'
    group by ci.household_id
  ),
  first_item as (
    select it.household_id, min(it.created_at) as first_at
    from beta.items it
    where it.inventory_status = 'owned'
    group by it.household_id
  ),
  first_any as (
    select
      coalesce(fc.household_id, fi.household_id) as household_id,
      least(fc.first_at, fi.first_at) as first_at
    from first_clothing fc
    full outer join first_item fi on fi.household_id = fc.household_id
  ),
  deltas as (
    select extract(epoch from (fa.first_at - h.created_at)) / 60.0 as minutes
    from beta.households h
    join first_any fa on fa.household_id = h.id
    where not _exclude_admins
       or exists (
         select 1 from beta.household_members hm
         left join auth.users u on u.id = hm.user_id
         where hm.household_id = h.id
           and (u.email is null or u.email::text <> all (beta._admin_emails()))
       )
  )
  select
    round(percentile_cont(0.5) within group (order by minutes)::numeric, 1),
    round(avg(minutes)::numeric, 1),
    count(*)::int
  from deltas
  where minutes >= 0;
end;
$$;
revoke all on function beta.admin_time_to_first_item(boolean) from public;
grant execute on function beta.admin_time_to_first_item(boolean) to authenticated;

-- ── 3. Registry share rate ───────────────────────────────────────────────────
create or replace function beta.admin_registry_share_rate(
  _exclude_admins boolean default true
)
returns table (
  households_with_items  int,
  households_shared      int,
  share_rate             numeric
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  with eligible as (
    -- households with at least one owned item (clothing or non-clothing)
    select distinct hh.id as household_id
    from beta.households hh
    where (
      exists (
        select 1 from beta.clothing_items ci
        where ci.household_id = hh.id and ci.inventory_status = 'owned'
      ) or exists (
        select 1 from beta.items it
        where it.household_id = hh.id and it.inventory_status = 'owned'
      )
    )
    and (not _exclude_admins
         or not exists (
           select 1 from beta.household_members hm
           join auth.users u on u.id = hm.user_id
           where hm.household_id = hh.id
             and u.email::text = any(beta._admin_emails())
         ))
  )
  select
    count(*)::int,
    count(ws.household_id)::int,
    round(count(ws.household_id)::numeric / nullif(count(*)::numeric,0) * 100, 1)
  from eligible e
  left join beta.wishlist_shares ws
    on ws.household_id = e.household_id and ws.is_active = true;
end;
$$;
revoke all on function beta.admin_registry_share_rate(boolean) from public;
grant execute on function beta.admin_registry_share_rate(boolean) to authenticated;

notify pgrst, 'reload schema';
