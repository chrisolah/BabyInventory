-- ============================================================================
-- Baby-age helper RPCs (migration #031)
-- ----------------------------------------------------------------------------
-- Foundation for lifecycle emails that key off baby age:
--   #09 size-shift alert     — needs current band + next band
--   #10 outgrown nudge       — needs current band (to find aged-out items)
--   #18 birthday eve         — needs DOB-based scheduling
--   #19 six-month retrospective — keys off signup, doesn't need this set
--
-- These are pure SQL helpers — no app logic, no policies, no triggers. Each
-- is security-definer + revoked from public so callers (edge function via
-- service-role, or future RLS-allowed RPC wrappers) can invoke them without
-- leaking auth.users / babies access.
-- ============================================================================

-- ─── _baby_age_in_months ──────────────────────────────────────────────────
-- Completed-month age based on date_of_birth. Returns null for babies with
-- no DOB (expecting parents — they have due_date but not date_of_birth yet).
-- Negative values are not returned; an unborn baby returns null rather than
-- a negative number, since "negative months old" isn't a useful signal for
-- any current consumer.
create or replace function beta._baby_age_in_months(_baby_id uuid)
returns int
language sql
stable
security definer
set search_path = beta, public
as $$
  select case
    when b.date_of_birth is null then null
    when b.date_of_birth > current_date then null
    else (
      extract(year  from age(current_date, b.date_of_birth)) * 12 +
      extract(month from age(current_date, b.date_of_birth))
    )::int
  end
  from beta.babies b
  where b.id = _baby_id;
$$;

revoke all on function beta._baby_age_in_months(uuid) from public;

-- ─── _size_band_for_age_months ────────────────────────────────────────────
-- Pure mapping from age-in-months to clothing size band. Returns null for
-- ages outside the supported range (24M+, app doesn't model toddler sizes
-- like 2T/3T yet). Supported bands match the clothing_items_size_check
-- constraint: 0-3M, 3-6M, 6-9M, 9-12M, 12-18M, 18-24M.
create or replace function beta._size_band_for_age_months(_months int)
returns text
language sql
immutable
as $$
  select case
    when _months is null     then null
    when _months < 0         then null
    when _months < 3         then '0-3M'
    when _months < 6         then '3-6M'
    when _months < 9         then '6-9M'
    when _months < 12        then '9-12M'
    when _months < 18        then '12-18M'
    when _months < 24        then '18-24M'
    else null
  end;
$$;

-- Immutable + no schema access, so no `from public` revocation needed. Still
-- safe to call from any RLS context.

-- ─── _baby_current_size_band ──────────────────────────────────────────────
-- Convenience wrapper combining the two above. Returns the size band the
-- baby is currently in, or null if no DOB / unsupported age.
create or replace function beta._baby_current_size_band(_baby_id uuid)
returns text
language sql
stable
security definer
set search_path = beta, public
as $$
  select beta._size_band_for_age_months(beta._baby_age_in_months(_baby_id));
$$;

revoke all on function beta._baby_current_size_band(uuid) from public;

-- ─── _next_size_band ──────────────────────────────────────────────────────
-- Pure lookup: given a size band, return the next one up. Used by the
-- size-shift alert to identify the band the baby is about to enter.
-- Returns null at the top of the chart (18-24M has no next band in the
-- supported set).
create or replace function beta._next_size_band(_band text)
returns text
language sql
immutable
as $$
  select case _band
    when '0-3M'   then '3-6M'
    when '3-6M'   then '6-9M'
    when '6-9M'   then '9-12M'
    when '9-12M'  then '12-18M'
    when '12-18M' then '18-24M'
    when '18-24M' then null
    else null
  end;
$$;

-- ─── _user_primary_baby ───────────────────────────────────────────────────
-- Returns the baby_id of the user's "primary" baby (oldest by created_at
-- in any household they're a member of). Most households have exactly one
-- baby tracked; the order_by gives deterministic behavior for the
-- multi-baby case until the app surfaces an explicit primary-baby concept.
-- Returns null if the user has no babies in any household.
create or replace function beta._user_primary_baby(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = beta, public
as $$
  select b.id
  from beta.babies b
  where b.household_id in (
    select household_id from beta.household_members where user_id = _user_id
  )
  order by b.created_at asc
  limit 1;
$$;

revoke all on function beta._user_primary_baby(uuid) from public;

comment on function beta._baby_age_in_months(uuid) is
  'Returns the baby''s age in completed months, or null if no DOB / unborn. Foundation for lifecycle emails that key off baby age.';
comment on function beta._size_band_for_age_months(int) is
  'Pure mapping from age in months to clothing size band (0-3M through 18-24M). Returns null for unsupported ages.';
comment on function beta._baby_current_size_band(uuid) is
  'Convenience: the current size band for a baby. Wraps _baby_age_in_months + _size_band_for_age_months.';
comment on function beta._next_size_band(text) is
  'Pure lookup: the next size band up from the given one, or null at the top of the chart.';
comment on function beta._user_primary_baby(uuid) is
  'Returns the user''s primary baby_id (oldest by created_at across their households), or null if none.';
