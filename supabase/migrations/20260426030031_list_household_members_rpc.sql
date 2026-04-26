-- ============================================================================
-- Migration — list_household_members RPC
-- ============================================================================
-- The hm_select RLS policy on beta.household_members is scoped to
-- `user_id = auth.uid()`, so a member querying the table only ever sees
-- their own row. Loosening that policy to "all members of households I
-- belong to" is appealing but introduces a self-referential RLS recursion
-- on the same table — Postgres rejects it without a SECURITY DEFINER
-- helper. We already have beta.is_household_member() as that helper, but
-- using it in the policy still doesn't surface the joining-user's identity
-- (auth.users name/email) to the client, since auth.users itself is
-- inaccessible to the anon/authenticated roles.
--
-- Solution: a SECURITY DEFINER RPC that returns the member rows joined
-- to auth.users for display fields (name, email), gated by membership.
-- This is the same pattern as beta.peek_invite — definer access into
-- restricted tables, with our own auth.uid() check on entry.
--
-- Returned shape mirrors what Profile.jsx already renders for the caller:
--   user_id      → react key
--   role         → owner | member badge
--   joined_at    → sort key
--   display_name → coalesce(metadata.name, email) — same logic as peek_invite
--   email        → secondary line under name
-- ============================================================================

create or replace function beta.list_household_members(p_household_id uuid)
returns table (
  user_id      uuid,
  role         text,
  joined_at    timestamptz,
  display_name text,
  email        text
)
language plpgsql
security definer
set search_path = beta, public
stable
as $$
begin
  -- Membership gate. Without this, any signed-in user could enumerate the
  -- members of any household by guessing household ids. is_household_member
  -- is itself SECURITY DEFINER so it bypasses RLS on household_members.
  if auth.uid() is null then
    raise exception 'must be signed in';
  end if;

  if not beta.is_household_member(p_household_id, auth.uid()) then
    raise exception 'not a member of this household';
  end if;

  return query
    select
      hm.user_id,
      hm.role,
      hm.joined_at,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'name', ''),
        u.email
      )::text as display_name,
      u.email::text
    from beta.household_members hm
    left join auth.users u on u.id = hm.user_id
    where hm.household_id = p_household_id
    order by hm.joined_at asc;
end;
$$;

grant execute on function beta.list_household_members(uuid) to authenticated;

notify pgrst, 'reload schema';
