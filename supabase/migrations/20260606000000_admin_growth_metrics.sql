-- Admin growth metrics RPCs
-- Adds 7 new analytics functions accessible to admins only:
--   admin_activation_funnel     — signup → item → 5 items → registry share
--   admin_time_to_first_item    — median/avg minutes from signup to first owned item
--   admin_anon_conversion       — current anon users vs permanent accounts
--   admin_registry_share_rate   — % of households with items that shared registry
--   admin_retention             — households active in last 7d / 30d
--   admin_category_depth        — owned item count per category across all households
--   admin_pass_along_funnel     — draft → shipped → fulfilled

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

  -- base: all non-admin households
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

  return query
  select 'Signed up'::text,
         _total,
         100.0;

  return query
  select '1+ items owned'::text,
         count(distinct ci.household_id)::int,
         round(count(distinct ci.household_id)::numeric / nullif(_total,0) * 100, 1)
  from beta.clothing_items ci
  join _hh on _hh.id = ci.household_id
  where ci.inventory_status = 'owned';

  return query
  select '5+ items owned'::text,
         count(*)::int,
         round(count(*)::numeric / nullif(_total,0) * 100, 1)
  from (
    select ci.household_id
    from beta.clothing_items ci
    join _hh on _hh.id = ci.household_id
    where ci.inventory_status = 'owned'
    group by ci.household_id
    having count(*) >= 5
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
  with first_item as (
    select ci.household_id,
           min(ci.created_at) as first_at
    from beta.clothing_items ci
    where ci.inventory_status = 'owned'
    group by ci.household_id
  ),
  deltas as (
    select extract(epoch from (fi.first_at - h.created_at)) / 60.0 as minutes
    from beta.households h
    join first_item fi on fi.household_id = h.id
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

-- ── 3. Anon conversion ───────────────────────────────────────────────────────
create or replace function beta.admin_anon_conversion()
returns table (
  permanent_accounts  int,
  anon_active         int,
  conversion_rate     numeric
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  select
    count(*) filter (where not u.is_anonymous)::int as permanent_accounts,
    count(*) filter (where u.is_anonymous)::int     as anon_active,
    round(
      count(*) filter (where not u.is_anonymous)::numeric
      / nullif(count(*)::numeric, 0) * 100
    , 1) as conversion_rate
  from auth.users u
  -- only count users who have a household (touched the app)
  where exists (
    select 1 from beta.household_members hm where hm.user_id = u.id
  );
end;
$$;
revoke all on function beta.admin_anon_conversion() from public;

-- ── 4. Registry share rate ───────────────────────────────────────────────────
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
    select distinct ci.household_id
    from beta.clothing_items ci
    where ci.inventory_status = 'owned'
      and (not _exclude_admins
           or not exists (
             select 1 from beta.household_members hm
             join auth.users u on u.id = hm.user_id
             where hm.household_id = ci.household_id
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

-- ── 5. Retention ─────────────────────────────────────────────────────────────
create or replace function beta.admin_retention(
  _exclude_admins boolean default true
)
returns table (
  cohort          text,
  total           int,
  active_7d       int,
  active_30d      int,
  retention_7d    numeric,
  retention_30d   numeric
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  with hh as (
    select h.id,
           h.created_at,
           case
             when h.created_at >= now() - interval '7 days'  then 'Last 7 days'
             when h.created_at >= now() - interval '30 days' then 'Last 30 days'
             else 'Older'
           end as cohort
    from beta.households h
    where not _exclude_admins
       or exists (
         select 1 from beta.household_members hm
         left join auth.users u on u.id = hm.user_id
         where hm.household_id = h.id
           and (u.email is null or u.email::text <> all (beta._admin_emails()))
       )
  ),
  last_activity as (
    select hm.household_id,
           max(e.created_at) as last_at
    from beta.household_members hm
    join beta.events e on e.user_id = hm.user_id
    group by hm.household_id
  )
  select
    hh.cohort::text,
    count(*)::int,
    count(*) filter (where la.last_at >= now() - interval '7 days')::int,
    count(*) filter (where la.last_at >= now() - interval '30 days')::int,
    round(count(*) filter (where la.last_at >= now() - interval '7 days')::numeric
          / nullif(count(*)::numeric,0) * 100, 1),
    round(count(*) filter (where la.last_at >= now() - interval '30 days')::numeric
          / nullif(count(*)::numeric,0) * 100, 1)
  from hh
  left join last_activity la on la.household_id = hh.id
  group by hh.cohort
  order by min(hh.created_at);
end;
$$;
revoke all on function beta.admin_retention(boolean) from public;

-- ── 6. Category depth ────────────────────────────────────────────────────────
create or replace function beta.admin_category_depth(
  _exclude_admins boolean default true
)
returns table (
  category   text,
  items      int,
  households int
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  -- clothing by category
  select
    coalesce(ci.category, 'unknown')::text,
    count(*)::int,
    count(distinct ci.household_id)::int
  from beta.clothing_items ci
  where ci.inventory_status = 'owned'
    and (not _exclude_admins
         or not exists (
           select 1 from beta.household_members hm
           join auth.users u on u.id = hm.user_id
           where hm.household_id = ci.household_id
             and u.email::text = any(beta._admin_emails())
         ))
  group by ci.category

  union all

  -- non-clothing items by top_category
  select
    coalesce(i.top_category, 'unknown')::text,
    count(*)::int,
    count(distinct i.household_id)::int
  from beta.items i
  where i.inventory_status = 'owned'
    and (not _exclude_admins
         or not exists (
           select 1 from beta.household_members hm
           join auth.users u on u.id = hm.user_id
           where hm.household_id = i.household_id
             and u.email::text = any(beta._admin_emails())
         ))
  group by i.top_category

  order by items desc;
end;
$$;
revoke all on function beta.admin_category_depth(boolean) from public;

-- ── 7. Pass-along funnel ─────────────────────────────────────────────────────
create or replace function beta.admin_pass_along_funnel(
  _exclude_admins boolean default true
)
returns table (
  stage       text,
  batches     int,
  households  int
)
language plpgsql security definer as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  select 'Started (draft)'::text,
         count(*)::int,
         count(distinct household_id)::int
  from beta.pass_along_batches
  where not _exclude_admins
     or not exists (
       select 1 from beta.household_members hm
       join auth.users u on u.id = hm.user_id
       where hm.household_id = beta.pass_along_batches.household_id
         and u.email::text = any(beta._admin_emails())
     )

  union all

  select 'Shipped'::text,
         count(*)::int,
         count(distinct household_id)::int
  from beta.pass_along_batches
  where status in ('shipped','received','fulfilled')
    and (not _exclude_admins
         or not exists (
           select 1 from beta.household_members hm
           join auth.users u on u.id = hm.user_id
           where hm.household_id = beta.pass_along_batches.household_id
             and u.email::text = any(beta._admin_emails())
         ))

  union all

  select 'Fulfilled'::text,
         count(*)::int,
         count(distinct household_id)::int
  from beta.pass_along_batches
  where status = 'fulfilled'
    and (not _exclude_admins
         or not exists (
           select 1 from beta.household_members hm
           join auth.users u on u.id = hm.user_id
           where hm.household_id = beta.pass_along_batches.household_id
             and u.email::text = any(beta._admin_emails())
         ));
end;
$$;
revoke all on function beta.admin_pass_along_funnel(boolean) from public;
