-- ============================================================================
-- Migration 040 - wishlist RPCs
-- ============================================================================
-- Two security-definer functions callable by unauthenticated users:
--
--   get_wishlist_for_share(token text)
--     Returns the full wishlist payload for a share link. Called by the
--     public /wishlist/:token route — no auth required.
--
--   claim_wishlist_item(token, slot_id, slot_type, size_label, claimer_name, quantity)
--     Records a claim. Validates the share exists and is active, then inserts
--     a wishlist_claims row. Returns the updated claim summary for the slot.
--
-- Both run as the postgres role (security definer) to bypass RLS.
-- ============================================================================

-- ─── get_wishlist_for_share ──────────────────────────────────────────────────

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
  -- Load share
  select * into v_share
  from beta.wishlist_shares
  where token = p_token and is_active = true;

  if not found then
    return json_build_object('error', 'not_found');
  end if;

  -- Load household display name
  select * into v_household
  from beta.households where id = v_share.household_id;

  -- Baby names (for display in hero)
  select json_agg(json_build_object('name', name, 'due_date', due_date, 'date_of_birth', date_of_birth))
  into v_babies
  from beta.babies
  where household_id = v_share.household_id;

  -- Clothing gap rows with priority flag
  -- Returns slot_id, category, size_label, is_priority for all gap rows.
  -- Coverage (owned count) is computed client-side using the same taxonomy.
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
      -- Owned count for this slot+size across all babies in household
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
      -- Apply included_categories filter if set
      and (
        v_share.included_categories is null
        or 'clothing' = any(v_share.included_categories)
      )
  ) c;

  -- Non-clothing gap rows with priority flag
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
      -- Apply included_categories filter
      and (
        v_share.included_categories is null
        or it.top_category = any(v_share.included_categories)
      )
  ) i;

  -- All existing claims for this share
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
      'show_priority',       v_share.show_priority
    ),
    'household', json_build_object(
      'name', v_household.name
    ),
    'babies',   coalesce(v_babies, '[]'::json),
    'clothing', coalesce(v_clothing, '[]'::json),
    'items',    coalesce(v_items, '[]'::json),
    'claims',   coalesce(v_claims, '[]'::json)
  );
end;
$$;

-- Allow anonymous callers to execute this function
grant execute on function beta.get_wishlist_for_share(text) to anon, authenticated;

-- ─── claim_wishlist_item ─────────────────────────────────────────────────────

create or replace function beta.claim_wishlist_item(
  p_token        text,
  p_slot_id      text,
  p_slot_type    text,   -- 'clothing' | 'item'
  p_size_label   text,   -- null for non-clothing
  p_claimer_name text,
  p_quantity     integer default 1
) returns json language plpgsql security definer as $$
declare
  v_share_id uuid;
begin
  -- Validate share
  select id into v_share_id
  from beta.wishlist_shares
  where token = p_token and is_active = true;

  if not found then
    return json_build_object('error', 'share_not_found');
  end if;

  if p_claimer_name is null or trim(p_claimer_name) = '' then
    return json_build_object('error', 'claimer_name_required');
  end if;

  if p_quantity < 1 then
    return json_build_object('error', 'invalid_quantity');
  end if;

  -- Insert the claim
  insert into beta.wishlist_claims
    (share_id, slot_id, slot_type, size_label, claimer_name, quantity)
  values
    (v_share_id, p_slot_id, p_slot_type, p_size_label, trim(p_claimer_name), p_quantity);

  -- Return updated claim summary for this slot so the client can update UI
  return json_build_object(
    'ok', true,
    'claims', (
      select json_agg(json_build_object(
        'claimer_name', claimer_name,
        'quantity',     quantity,
        'claimed_at',   claimed_at
      ) order by claimed_at asc)
      from beta.wishlist_claims
      where share_id = v_share_id
        and slot_id = p_slot_id
        and slot_type = p_slot_type
        and (size_label = p_size_label or (size_label is null and p_size_label is null))
    )
  );
end;
$$;

grant execute on function beta.claim_wishlist_item(text, text, text, text, text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
