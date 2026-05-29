-- ============================================================================
-- Migration 041 - wishlist skip_sizes
-- ============================================================================
-- Adds a skip_sizes column to wishlist_shares so parents can mark specific
-- clothing size ranges as "well stocked" without hiding all clothing from the
-- link. Updates get_wishlist_for_share to filter out those sizes.
--
-- Values are AGE_RANGES labels: '0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'
-- null = no sizes skipped (show all clothing gaps as normal)
-- ============================================================================

alter table beta.wishlist_shares
  add column if not exists skip_sizes text[];

-- ─── Updated get_wishlist_for_share ──────────────────────────────────────────

create or replace function beta.get_wishlist_for_share(p_token text)
returns json language plpgsql security definer as $$
declare
  v_share      beta.wishlist_shares%rowtype;
  v_household  beta.households%rowtype;
  v_babies     json;
  v_clothing   json;
  v_items      json;
  v_claims     json;
begin
  select * into v_share
  from beta.wishlist_shares
  where token = p_token and is_active = true;

  if not found then
    return json_build_object('error', 'not_found');
  end if;

  select * into v_household
  from beta.households where id = v_share.household_id;

  select json_agg(json_build_object('name', name, 'due_date', due_date, 'date_of_birth', date_of_birth))
  into v_babies
  from beta.babies
  where household_id = v_share.household_id;

  select json_agg(row_to_json(c))
  into v_clothing
  from (
    select
      ci.id,
      ci.slot_id,
      ci.category,
      ci.size_label,
      ci.is_priority,
      ci.baby_id,
      coalesce((
        select sum(owned.quantity)
        from beta.clothing_items owned
        where owned.household_id = v_share.household_id
          and owned.slot_id = ci.slot_id
          and owned.size_label = ci.size_label
          and owned.inventory_status = 'owned'
      ), 0)::int as owned_count
    from beta.clothing_items ci
    where ci.household_id = v_share.household_id
      and ci.inventory_status = 'gap'
      and (
        v_share.included_categories is null
        or 'clothing' = any(v_share.included_categories)
      )
      -- Filter out sizes the parent has marked as well-stocked
      and (
        v_share.skip_sizes is null
        or ci.size_label != all(v_share.skip_sizes)
      )
  ) c;

  select json_agg(row_to_json(i))
  into v_items
  from (
    select
      it.id,
      it.slot_id,
      it.top_category,
      it.sub_category,
      it.is_priority,
      coalesce((
        select sum(owned.quantity)
        from beta.items owned
        where owned.household_id = v_share.household_id
          and owned.slot_id = it.slot_id
          and owned.inventory_status = 'owned'
      ), 0)::int as owned_count
    from beta.items it
    where it.household_id = v_share.household_id
      and it.inventory_status = 'gap'
      and it.baby_id is null
      and (
        v_share.included_categories is null
        or it.top_category = any(v_share.included_categories)
      )
  ) i;

  select json_agg(row_to_json(cl))
  into v_claims
  from (
    select slot_id, slot_type, size_label, claimer_name, quantity, claimed_at
    from beta.wishlist_claims
    where share_id = v_share.id
    order by claimed_at asc
  ) cl;

  return json_build_object(
    'share', json_build_object(
      'id',                  v_share.id,
      'token',               v_share.token,
      'message',             v_share.message,
      'target_date',         v_share.target_date,
      'included_categories', v_share.included_categories,
      'skip_categories',     v_share.skip_categories,
      'skip_sizes',          v_share.skip_sizes,
      'show_priority',       v_share.show_priority
    ),
    'household', json_build_object('name', v_household.name),
    'babies',    coalesce(v_babies, '[]'::json),
    'clothing',  coalesce(v_clothing, '[]'::json),
    'items',     coalesce(v_items, '[]'::json),
    'claims',    coalesce(v_claims, '[]'::json)
  );
end;
$$;

grant execute on function beta.get_wishlist_for_share(text) to anon, authenticated;

notify pgrst, 'reload schema';
