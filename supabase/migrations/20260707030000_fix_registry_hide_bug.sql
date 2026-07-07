-- ============================================================================
-- Fix: hidden registry slots could never be un-hidden
-- ============================================================================
-- Root cause: get_wishlist_for_share filtered clothing gap rows by
-- skip_slots directly in SQL. Both WishlistEdit (the household's own
-- /registry/edit screen) and WishlistPublic (the anon gift-giver page) call
-- this SAME rpc with the SAME token — so once a slot was hidden, its row
-- vanished from the RPC response entirely, including for the household member
-- trying to manage their own registry. With no row, there was no eye icon to
-- tap to show it again. The slot stayed hidden forever.
--
-- Fix: the RPC now returns every gap row unconditionally (skip_slots is no
-- longer applied in SQL). WishlistEdit already handles this correctly — it
-- was only ever missing the hidden rows to render the toggle on. Filtering
-- for the PUBLIC page moves to the client (WishlistPublic.jsx), which also
-- fixes a second latent bug: skip_slots was never applied to non-clothing
-- items in the public view at all.
-- ============================================================================

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

  -- Clothing gap rows. NOTE: skip_slots is intentionally NOT applied here —
  -- see comment above. included_categories/included_sizes/skip_sizes/
  -- included_slots are left as-is; they aren't part of the reported bug and
  -- the UI doesn't currently exercise them the way it does skip_slots.
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
  ) c;

  -- Non-clothing gap rows.
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
    'claims',              coalesce(v_claims, '[]'::json),
    'quantity_overrides', coalesce(v_qty_overrides, '[]'::json)
  );
end;
$$;

grant execute on function beta.get_wishlist_for_share(text) to anon, authenticated;

notify pgrst, 'reload schema';
