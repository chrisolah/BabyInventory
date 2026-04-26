-- ============================================================================
-- Migration — household pending invites
-- ============================================================================
-- Adds the persistence layer for inviting members to a household:
--
--   * beta.pending_invites — one row per outstanding invite. Token = the row's
--     uuid id, used directly as the path param in /invite/:token URLs.
--   * beta.peek_invite(token) — public/anon-callable. Returns just enough to
--     render the "Chris invited you to the Smith household" landing screen
--     before the recipient has signed up or signed in.
--   * beta.accept_invite(token) — auth-required. Validates the invite, adds
--     the recipient to household_members, marks the invite accepted.
--   * beta.revoke_invite(invite_id) — owner-only. Lets the inviter cancel.
--
-- Writes (insert/update of pending_invites itself) go through the
-- send-household-invite edge function running with the service role.
-- RLS only grants SELECT to household members so the UI can list pending
-- invites for the household.
-- ============================================================================

-- citext gives us case-insensitive equality for emails without scattering
-- lower(...) calls. Available by default on Supabase.
create extension if not exists citext;

-- ─── Table ─────────────────────────────────────────────────────────────────

create table if not exists beta.pending_invites (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references beta.households(id) on delete cascade,
  invited_email citext      not null,
  invited_by    uuid        not null references auth.users(id)      on delete cascade,
  role          text        not null default 'member' check (role in ('owner','member')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by   uuid        references auth.users(id),
  revoked_at    timestamptz,
  -- An invite is in exactly one terminal state at a time.
  constraint pending_invites_state_exclusive
    check (not (accepted_at is not null and revoked_at is not null))
);

create index if not exists pending_invites_household_idx
  on beta.pending_invites(household_id);

-- Stops "send invite" from creating duplicate active invites to the same
-- address for the same household. Partial: accepted/revoked rows don't count.
create unique index if not exists pending_invites_active_unique
  on beta.pending_invites(household_id, invited_email)
  where accepted_at is null and revoked_at is null;

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table beta.pending_invites enable row level security;

drop policy if exists pending_invites_select on beta.pending_invites;

-- Members of the household can see its outstanding invites. INSERT / UPDATE /
-- DELETE are intentionally NOT granted via RLS — the edge function is the
-- only writer (runs as service role and does its own auth checks).
create policy pending_invites_select on beta.pending_invites
  for select using (beta.is_household_member(household_id, auth.uid()));

-- ─── peek_invite RPC (anon-callable) ───────────────────────────────────────
-- Used by the /invite/:token landing page to show a friendly preview before
-- the recipient signs up / in. Returns ONLY non-sensitive metadata: household
-- name, inviter display name (or email fallback), invited address, role,
-- expiry, and a status enum. No counts, no household contents, no other
-- members. A token guess is infeasible (122-bit uuid), and anyone holding
-- the token was given it by the inviter.
create or replace function beta.peek_invite(p_token uuid)
returns table (
  household_name  text,
  inviter_label   text,
  invited_email   text,
  role            text,
  expires_at      timestamptz,
  status          text
)
language plpgsql
security definer
set search_path = beta, public
stable
as $$
declare
  v_invite beta.pending_invites%rowtype;
  v_status text;
begin
  select * into v_invite from beta.pending_invites where id = p_token;
  if not found then
    return;
  end if;

  if v_invite.accepted_at is not null then v_status := 'accepted';
  elsif v_invite.revoked_at  is not null then v_status := 'revoked';
  elsif v_invite.expires_at  < now()     then v_status := 'expired';
  else                                        v_status := 'active';
  end if;

  return query
    select
      h.name,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'name', ''),
        u.email
      ) as inviter_label,
      v_invite.invited_email::text,
      v_invite.role,
      v_invite.expires_at,
      v_status
    from beta.households h
    left join auth.users u on u.id = v_invite.invited_by
    where h.id = v_invite.household_id;
end;
$$;

-- ─── accept_invite RPC ─────────────────────────────────────────────────────
-- Called by the recipient (signed-in) from the /invite/:token screen.
-- Returns the household_id on success; raises a descriptive error on failure
-- so the UI can show specific messaging.
create or replace function beta.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = beta, public
as $$
declare
  v_invite     beta.pending_invites%rowtype;
  v_user_id    uuid  := auth.uid();
  v_user_email citext;
begin
  if v_user_id is null then
    raise exception 'must be signed in to accept an invite';
  end if;

  v_user_email := (auth.jwt() ->> 'email')::citext;
  if v_user_email is null then
    raise exception 'no email on session';
  end if;

  select * into v_invite
    from beta.pending_invites
    where id = p_token
    for update;

  if not found                              then raise exception 'invite not found';        end if;
  if v_invite.accepted_at is not null       then raise exception 'invite already accepted'; end if;
  if v_invite.revoked_at  is not null       then raise exception 'invite has been revoked'; end if;
  if v_invite.expires_at  < now()           then raise exception 'invite has expired';      end if;

  -- Token must be redeemed by the address it was sent to. Without this,
  -- a leaked URL would be a household-wide back door.
  if v_invite.invited_email <> v_user_email then
    raise exception 'invite was sent to a different email address';
  end if;

  -- Idempotent join: if the user already happens to be a member, still mark
  -- the invite accepted so its token can't be reused.
  insert into beta.household_members (household_id, user_id, role)
    values (v_invite.household_id, v_user_id, v_invite.role)
    on conflict (household_id, user_id) do nothing;

  update beta.pending_invites
    set accepted_at = now(),
        accepted_by = v_user_id
    where id = p_token;

  return v_invite.household_id;
end;
$$;

-- ─── revoke_invite RPC ─────────────────────────────────────────────────────
-- Owner-only cancellation. We keep the row (with revoked_at set) for audit /
-- "show the inviter why this address can be re-invited" purposes rather
-- than hard-deleting.
create or replace function beta.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = beta, public
as $$
declare
  v_invite beta.pending_invites%rowtype;
begin
  select * into v_invite from beta.pending_invites where id = p_invite_id;
  if not found then
    raise exception 'invite not found';
  end if;

  if not exists (
    select 1 from beta.household_members
      where household_id = v_invite.household_id
        and user_id      = auth.uid()
        and role         = 'owner'
  ) then
    raise exception 'only household owners can revoke invites';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'invite already accepted, cannot revoke';
  end if;

  update beta.pending_invites
    set revoked_at = now()
    where id = p_invite_id;
end;
$$;

-- ─── Grants ────────────────────────────────────────────────────────────────
grant select on beta.pending_invites to authenticated;

-- peek is intentionally callable by anon — the /invite/:token landing page
-- needs to render before the recipient signs in.
grant execute on function beta.peek_invite(uuid)    to anon, authenticated;
grant execute on function beta.accept_invite(uuid)  to authenticated;
grant execute on function beta.revoke_invite(uuid)  to authenticated;
