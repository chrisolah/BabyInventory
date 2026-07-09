-- Admin Registry analytics RPCs
--
-- Backs a new "Registry" tab on the admin dashboard. Until now the public
-- registry page (WishlistPublic.jsx, /registry/:token) fired zero analytics
-- events — the only registry signal in admin was admin_registry_share_rate
-- (whether a household ever shared a link), nothing about recipient-side
-- activity. src/lib/analytics.js now emits:
--   registry_page_viewed     — on every /registry/:token load, props: { token }
--   registry_product_clicked — on "Sprigloop pick" taps, props: { token, slot_id, product, context }
-- Claims don't need a new event — beta.wishlist_claims already records every
-- claim with a timestamp; these RPCs read that table directly.
--
-- Two different exclude-admin strategies are used here, matching the shape
-- of the underlying data (see feedback_admin_rpc_is_admin_bug memory —
-- never call is_admin(user_id), it doesn't exist):
--   - events-derived rows (views, product clicks) are session-scoped →
--     filtered via beta._admin_session_ids()
--   - wishlist_claims/wishlist_shares rows are household-scoped (no
--     session_id column) → filtered by checking household_members against
--     beta._admin_emails(), same pattern as admin_registry_share_rate.

-- ── 1. Daily views ────────────────────────────────────────────────────────
create or replace function beta.admin_registry_views_daily(
  _since_days     integer default 30,
  _exclude_admins boolean default true
)
returns table (
  day             date,
  views           bigint,
  unique_visitors bigint
)
language plpgsql security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  select
    date_trunc('day', e.created_at)::date as day,
    count(*)::bigint                      as views,
    count(distinct e.session_id)::bigint  as unique_visitors
  from beta.events e
  where e.event_name = 'registry_page_viewed'
    and e.created_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    )
  group by 1
  order by 1;
end;
$$;
revoke all on function beta.admin_registry_views_daily(integer, boolean) from public;
grant execute on function beta.admin_registry_views_daily(integer, boolean) to authenticated;

-- ── 2. Daily claims ───────────────────────────────────────────────────────
create or replace function beta.admin_registry_claims_daily(
  _since_days     integer default 30,
  _exclude_admins boolean default true
)
returns table (
  day      date,
  claims   bigint,
  quantity bigint
)
language plpgsql security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  select
    date_trunc('day', wc.claimed_at)::date as day,
    count(*)::bigint                       as claims,
    coalesce(sum(wc.quantity), 0)::bigint  as quantity
  from beta.wishlist_claims wc
  join beta.wishlist_shares ws on ws.id = wc.share_id
  where wc.claimed_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or not exists (
        select 1 from beta.household_members hm
        join auth.users u on u.id = hm.user_id
        where hm.household_id = ws.household_id
          and u.email::text = any (beta._admin_emails())
      )
    )
  group by 1
  order by 1;
end;
$$;
revoke all on function beta.admin_registry_claims_daily(integer, boolean) from public;
grant execute on function beta.admin_registry_claims_daily(integer, boolean) to authenticated;

-- ── 3. Sprigloop picks — click leaderboard ───────────────────────────────
create or replace function beta.admin_registry_product_clicks(
  _since_days     integer default 30,
  _exclude_admins boolean default true
)
returns table (
  slot_id text,
  clicks  bigint
)
language plpgsql security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  select
    coalesce(e.properties->>'slot_id', 'unknown')::text as slot_id,
    count(*)::bigint                                    as clicks
  from beta.events e
  where e.event_name = 'registry_product_clicked'
    and e.created_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    )
  group by 1
  order by clicks desc;
end;
$$;
revoke all on function beta.admin_registry_product_clicks(integer, boolean) from public;
grant execute on function beta.admin_registry_product_clicks(integer, boolean) to authenticated;

-- ── 4. Overview summary (north-star-style single row) ────────────────────
create or replace function beta.admin_registry_overview(
  _since_days     integer default 30,
  _exclude_admins boolean default true
)
returns table (
  total_views       bigint,
  unique_visitors   bigint,
  total_claims      bigint,
  total_claim_qty   bigint,
  claim_conversion  numeric,
  picks_clicks      bigint,
  picks_ctr         numeric,
  active_registries int,
  total_registries  int
)
language plpgsql security definer
set search_path = beta, public
as $$
declare
  _views    bigint;
  _visitors bigint;
  _claims   bigint;
  _qty      bigint;
  _clicks   bigint;
  _active   int;
  _total    int;
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  select count(*), count(distinct e.session_id)
  into _views, _visitors
  from beta.events e
  where e.event_name = 'registry_page_viewed'
    and e.created_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    );

  select count(*), coalesce(sum(wc.quantity), 0)
  into _claims, _qty
  from beta.wishlist_claims wc
  join beta.wishlist_shares ws on ws.id = wc.share_id
  where wc.claimed_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or not exists (
        select 1 from beta.household_members hm
        join auth.users u on u.id = hm.user_id
        where hm.household_id = ws.household_id
          and u.email::text = any (beta._admin_emails())
      )
    );

  select count(*)
  into _clicks
  from beta.events e
  where e.event_name = 'registry_product_clicked'
    and e.created_at >= now() - (_since_days || ' days')::interval
    and (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    );

  select count(*) filter (where ws.is_active), count(*)
  into _active, _total
  from beta.wishlist_shares ws
  where (
    not _exclude_admins
    or not exists (
      select 1 from beta.household_members hm
      join auth.users u on u.id = hm.user_id
      where hm.household_id = ws.household_id
        and u.email::text = any (beta._admin_emails())
    )
  );

  return query select
    _views,
    _visitors,
    _claims,
    _qty,
    round(_claims::numeric / nullif(_views, 0) * 100, 1),
    _clicks,
    round(_clicks::numeric / nullif(_views, 0) * 100, 1),
    _active,
    _total;
end;
$$;
revoke all on function beta.admin_registry_overview(integer, boolean) from public;
grant execute on function beta.admin_registry_overview(integer, boolean) to authenticated;

-- ── 5. Top registries — views + claims per household ─────────────────────
create or replace function beta.admin_registry_leaderboard(
  _since_days     integer default 30,
  _exclude_admins boolean default true,
  _limit          integer default 10
)
returns table (
  household_id   uuid,
  household_name text,
  token          text,
  views          bigint,
  claims         bigint,
  last_activity  timestamptz
)
language plpgsql security definer
set search_path = beta, public
as $$
begin
  if not beta.is_admin() then raise exception 'admin only'; end if;

  return query
  with v as (
    select
      e.properties->>'token' as token,
      count(*)               as views,
      max(e.created_at)      as last_view
    from beta.events e
    where e.event_name = 'registry_page_viewed'
      and e.created_at >= now() - (_since_days || ' days')::interval
      and (
        not _exclude_admins
        or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
      )
    group by 1
  ),
  c as (
    select
      ws.id              as share_id,
      count(*)           as claims,
      max(wc.claimed_at) as last_claim
    from beta.wishlist_claims wc
    join beta.wishlist_shares ws on ws.id = wc.share_id
    where wc.claimed_at >= now() - (_since_days || ' days')::interval
    group by 1
  )
  select
    ws.household_id,
    h.name::text,
    ws.token,
    coalesce(v.views, 0)::bigint,
    coalesce(c.claims, 0)::bigint,
    greatest(v.last_view, c.last_claim)
  from beta.wishlist_shares ws
  join beta.households h on h.id = ws.household_id
  left join v on v.token = ws.token
  left join c on c.share_id = ws.id
  where (coalesce(v.views, 0) > 0 or coalesce(c.claims, 0) > 0)
    and (
      not _exclude_admins
      or not exists (
        select 1 from beta.household_members hm
        join auth.users u on u.id = hm.user_id
        where hm.household_id = ws.household_id
          and u.email::text = any (beta._admin_emails())
      )
    )
  order by coalesce(v.views, 0) desc, coalesce(c.claims, 0) desc
  limit _limit;
end;
$$;
revoke all on function beta.admin_registry_leaderboard(integer, boolean, integer) from public;
grant execute on function beta.admin_registry_leaderboard(integer, boolean, integer) to authenticated;
