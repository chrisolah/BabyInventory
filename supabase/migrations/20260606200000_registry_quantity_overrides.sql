-- ============================================================================
-- Migration: registry_quantity_overrides
-- Lets households set a custom desired quantity per slot on their registry.
-- Only affects registry gap display — Plan view uses wardrobe.js defaults.
-- ============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists beta.registry_quantity_overrides (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references beta.households(id) on delete cascade,
  slot_id       text        not null,
  size_label    text,
  desired_qty   int         not null check (desired_qty >= 1),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Unique per household + slot + size (NULLs treated as equal)
create unique index if not exists registry_quantity_overrides_unique
  on beta.registry_quantity_overrides (household_id, slot_id, coalesce(size_label, ''));

alter table beta.registry_quantity_overrides enable row level security;

create policy "household members can manage their overrides"
  on beta.registry_quantity_overrides for all
  using (
    household_id in (
      select household_id from beta.household_members where user_id = auth.uid()
    )
  )
  with check (
    household_id in (
      select household_id from beta.household_members where user_id = auth.uid()
    )
  );

-- ── Upsert RPC ────────────────────────────────────────────────────────────────

create or replace function beta.upsert_registry_qty_override(
  p_slot_id     text,
  p_size_label  text,
  p_desired_qty int
) returns void language plpgsql security invoker as $$
declare
  v_household_id uuid;
  v_updated      int;
begin
  select household_id into v_household_id
  from beta.household_members
  where user_id = auth.uid()
  limit 1;

  if v_household_id is null then
    raise exception 'not a member of any household';
  end if;

  if p_desired_qty < 1 then
    -- Remove override so the slot falls back to the recommended default
    delete from beta.registry_quantity_overrides
    where household_id = v_household_id
      and slot_id = p_slot_id
      and coalesce(size_label, '') = coalesce(p_size_label, '');
    return;
  end if;

  -- Try update first
  update beta.registry_quantity_overrides
  set desired_qty = p_desired_qty, updated_at = now()
  where household_id = v_household_id
    and slot_id = p_slot_id
    and coalesce(size_label, '') = coalesce(p_size_label, '');

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into beta.registry_quantity_overrides (household_id, slot_id, size_label, desired_qty)
    values (v_household_id, p_slot_id, p_size_label, p_desired_qty);
  end if;
end;
$$;

grant execute on function beta.upsert_registry_qty_override(text, text, int) to authenticated;

-- ── Update get_wishlist_for_share to include overrides ────────────────────────
-- Adds a `quantity_overrides` array to the RPC response so the public registry
-- page can respect custom quantities without requiring auth.

create or replace function beta.get_wishlist_for_share(p_token text)
returns json language plpgsql security definer as $$
declare
  v_share      beta.wishlist_shares%rowtype;
  v_household  beta.households%rowtype;
  v_babies     json;
  v_clothing   json;
  v_items      json;
  v_claims     json;
  v_qty_overrides json;
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

  -- Quantity overrides for this household
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
      'show_priority',       v_share.show_priority
    ),
    'household',         json_build_object('name', v_household.name),
    'babies',            coalesce(v_babies, '[]'::json),
    'clothing',          coalesce(v_clothing, '[]'::json),
    'items',             coalesce(v_items, '[]'::json),
    'claims',            coalesce(v_claims, '[]'::json),
    'quantity_overrides', coalesce(v_qty_overrides, '[]'::json)
  );
end;
$$;

grant execute on function beta.get_wishlist_for_share(text) to anon, authenticated;

notify pgrst, 'reload schema';
