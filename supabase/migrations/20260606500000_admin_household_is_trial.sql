-- ============================================================================
-- Migration: add is_trial to admin_household_summary
-- Marks households whose primary member is still an anonymous (trial) user.
-- Used by the admin Users tab to split accounts vs. trial users.
-- ============================================================================

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
  created_at     timestamptz,
  is_trial       boolean
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
      count(*)::int as cnt,
      -- Household is "trial" if every member is still anonymous
      bool_and(coalesce(u.is_anonymous, false)) as all_anon
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
    union all
    select
      it.household_id,
      count(*)::int as cnt
    from beta.items it
    group by it.household_id
  ),
  items_total as (
    select household_id, sum(cnt)::int as cnt
    from items_agg
    group by household_id
  ),
  last_evt as (
    select hm.household_id, max(e.created_at) as last_at
    from beta.household_members hm
    join beta.events e on e.user_id = hm.user_id
    where (
      not _exclude_admins
      or e.session_id::text not in (select s.session_id from beta._admin_session_ids() s)
    )
    group by hm.household_id
  )
  select
    h.id::uuid                          as household_id,
    h.name::text                        as household_name,
    coalesce(m.cnt, 0)::int             as member_count,
    coalesce(m.emails, array[]::text[]) as member_emails,
    coalesce(ba.cnt, 0)::int            as baby_count,
    coalesce(ba.names, array[]::text[]) as baby_names,
    coalesce(it.cnt, 0)::int            as item_count,
    le.last_at::timestamptz             as last_event_at,
    h.created_at::timestamptz           as created_at,
    coalesce(m.all_anon, false)::boolean as is_trial
  from beta.households h
  left join members    m  on m.household_id  = h.id
  left join babies_agg ba on ba.household_id = h.id
  left join items_total it on it.household_id = h.id
  left join last_evt   le on le.household_id = h.id
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

notify pgrst, 'reload schema';
