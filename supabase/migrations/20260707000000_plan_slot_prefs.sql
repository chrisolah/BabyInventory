-- ============================================================================
-- Migration: plan_slot_prefs
-- ============================================================================
-- Lets a household stop tracking a slot in the Plan tab (parents can remove
-- an item they don't want to track through the app) without touching the
-- public Registry share. That's a deliberately SEPARATE setting from
-- wishlist_shares.skip_slots — hiding something in Plan has no effect on the
-- Registry, and hiding it on the Registry has no effect on Plan. Two
-- independent toggles, per Chris's call on 2026-07-07.
-- ============================================================================

create table if not exists beta.plan_slot_prefs (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references beta.households(id) on delete cascade,
  slot_id       text        not null,
  kind          text        not null check (kind in ('clothing','item')),
  hidden        boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only "hidden" rows are ever expected to exist — showing a slot again just
-- deletes the row (default state = tracked). One row per household+slot+kind.
create unique index if not exists plan_slot_prefs_unique
  on beta.plan_slot_prefs (household_id, slot_id, kind);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

drop trigger if exists plan_slot_prefs_set_updated_at on beta.plan_slot_prefs;
create trigger plan_slot_prefs_set_updated_at
  before update on beta.plan_slot_prefs
  for each row
  execute function beta.set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table beta.plan_slot_prefs enable row level security;

drop policy if exists plan_slot_prefs_select on beta.plan_slot_prefs;
drop policy if exists plan_slot_prefs_insert on beta.plan_slot_prefs;
drop policy if exists plan_slot_prefs_update on beta.plan_slot_prefs;
drop policy if exists plan_slot_prefs_delete on beta.plan_slot_prefs;

create policy plan_slot_prefs_select on beta.plan_slot_prefs
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy plan_slot_prefs_insert on beta.plan_slot_prefs
  for insert with check (beta.is_household_member(household_id, auth.uid()));

create policy plan_slot_prefs_update on beta.plan_slot_prefs
  for update using (beta.is_household_member(household_id, auth.uid()));

create policy plan_slot_prefs_delete on beta.plan_slot_prefs
  for delete using (beta.is_household_member(household_id, auth.uid()));

grant select, insert, update, delete on beta.plan_slot_prefs to authenticated;

-- ─── Upsert RPC ───────────────────────────────────────────────────────────────
-- Mirrors the pattern used for upsert_registry_qty_override. Un-hiding just
-- deletes the row so the slot falls back to its default (tracked) state.

create or replace function beta.set_plan_slot_hidden(
  p_slot_id text,
  p_kind    text,
  p_hidden  boolean
) returns void language plpgsql security invoker as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
  from beta.household_members
  where user_id = auth.uid()
  limit 1;

  if v_household_id is null then
    raise exception 'not a member of any household';
  end if;

  if not p_hidden then
    delete from beta.plan_slot_prefs
    where household_id = v_household_id
      and slot_id = p_slot_id
      and kind = p_kind;
    return;
  end if;

  insert into beta.plan_slot_prefs (household_id, slot_id, kind, hidden)
  values (v_household_id, p_slot_id, p_kind, true)
  on conflict (household_id, slot_id, kind)
  do update set hidden = true, updated_at = now();
end;
$$;

grant execute on function beta.set_plan_slot_hidden(text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
