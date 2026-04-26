-- ============================================================================
-- Migration — accept_invite marks the joiner's onboarding complete
-- ============================================================================
-- The Home onboarding gate redirects any user with onboarding_step < 5 to
-- /onboarding. That gate has no concept of "joined an existing household via
-- invite" — it only reads the per-user counter. Without this fix, a brand-new
-- user who signs up to accept an invite ends up at step 0, joins the
-- household, then gets dumped into onboarding to name a household and add
-- babies that already exist in the household they just joined.
--
-- Fix: when accept_invite() succeeds, bump the joiner's onboarding_step to
-- 5 (ONBOARDING_COMPLETE per migration 015). They're joining an established
-- household — no household creation, no babies, no receiving prefs needed.
--
-- greatest() is defensive: if the joiner somehow already had a higher value
-- (impossible today since the ceiling IS 5, but cheap insurance against
-- future widening), don't regress them.
--
-- Also includes a one-off backfill for any existing household_members whose
-- onboarding_step is below 5 — most likely test users from the invite-flow
-- testing on 2026-04-25. They're stuck in onboarding right now and the RPC
-- update alone wouldn't help them.
-- ============================================================================

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

  -- Skip onboarding for invite joiners — see migration header.
  insert into beta.user_activity_summary (user_id, onboarding_step)
    values (v_user_id, 5)
    on conflict (user_id)
      do update set onboarding_step = greatest(beta.user_activity_summary.onboarding_step, 5);

  update beta.pending_invites
    set accepted_at = now(),
        accepted_by = v_user_id
    where id = p_token;

  return v_invite.household_id;
end;
$$;

-- ─── One-off backfill ──────────────────────────────────────────────────────
-- Anyone who's a household *member* (not owner) but stuck below complete is
-- in the exact failure mode this migration fixes. Restricted to role='member'
-- so a mid-onboarding owner who has created their household but hasn't
-- finished receiving prefs etc. doesn't get jumped to the end.
update beta.user_activity_summary uas
   set onboarding_step = 5
  from beta.household_members hm
 where hm.user_id = uas.user_id
   and hm.role    = 'member'
   and uas.onboarding_step < 5;

notify pgrst, 'reload schema';
