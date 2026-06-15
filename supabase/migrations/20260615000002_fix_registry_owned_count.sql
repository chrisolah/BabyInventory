-- Fix: registry incorrectly hides partially-covered non-clothing slots.
--
-- Migration 20260615000001 added a NOT EXISTS clause to exclude gap slots
-- where the household owns >= 1 item. This was correct for single-quantity
-- items (crib: need 1, have 1 = fully covered, hide it) but wrong for
-- multi-quantity items (rattles: need 4, have 1 = still need 3, must show).
--
-- Correct behavior:
--   - All gap slots are returned from the RPC.
--   - owned_count is computed correctly (slot_id match OR item_type fallback
--     for legacy rows written before the slot_id fix in AddItem/BatchReview).
--   - The frontend (WishlistPublic) filters out fully-covered items so
--     gift-givers don't see "Need 0 more" cards.
--
-- This migration also restores quantity_overrides in the return payload
-- (dropped accidentally in 20260615000001).

create or replace function beta.get_wishlist_for_share(p_token text)
returns json language plpgsql security definer as $$
declare
  v_share         beta.wishlist_shares%rowtype;
  v_household     beta.households%rowtype;
  v_babies        json;
  v_clothing      json;
  v_items         json;
  v_claims        json;
  v_qty_overrides json;
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

  -- Clothing gap rows
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
      and (
        v_share.included_sizes is null
        or ci.size_label = any(v_share.included_sizes)
      )
      and (
        v_share.skip_sizes is null
        or ci.size_label != all(v_share.skip_sizes)
      )
      and (
        v_share.included_slots is null
        or ci.slot_id = any(v_share.included_slots)
      )
      and (
        v_share.skip_slots is null
        or ci.slot_id != all(v_share.skip_slots)
      )
  ) c;

  -- Non-clothing gap rows.
  -- owned_count matches on slot_id (rows written after the AddItem/BatchReview fix)
  -- OR item_type (legacy rows written before the fix, which have slot_id = null).
  -- No NOT EXISTS: all gap slots are returned; the frontend filters fully-covered ones.
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
          and owned.inventory_status = 'owned'
          and (
            (owned.slot_id is not null and owned.slot_id = it.slot_id)
            or (owned.slot_id is null and owned.item_type = it.item_type)
          )
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

  select json_agg(json_build_object(
    'slot_id',     rqo.slot_id,
    'size_label',  rqo.size_label,
    'desired_qty', rqo.desired_qty
  ))
  into v_qty_overrides
  from beta.registry_quantity_overrides rqo
  where rqo.household_id = v_share.household_id;

  return json_build_object(
    'share', json_build_object(
      'id',                  v_share.id,
      'token',               v_share.token,
      'message',             v_share.message,
      'target_date',         v_share.target_date,
      'included_categories', v_share.included_categories,
      'skip_categories',     v_share.skip_categories,
      'included_sizes',      v_share.included_sizes,
      'skip_sizes',          v_share.skip_sizes,
      'included_slots',      v_share.included_slots,
      'skip_slots',          v_share.skip_slots,
      'show_priority',       v_share.show_priority
    ),
    'household',          json_build_object('name', v_household.name),
    'babies',             coalesce(v_babies, '[]'::json),
    'clothing',           coalesce(v_clothing, '[]'::json),
    'items',              coalesce(v_items, '[]'::json),
    'claims',             coalesce(v_claims, '[]'::json),
    'quantity_overrides', coalesce(v_qty_overrides, '[]'::json)
  );
end;
$$;

grant execute on function beta.get_wishlist_for_share(text) to anon, authenticated;

notify pgrst, 'reload schema';
