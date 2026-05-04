-- ============================================================================
-- Email outbox: six_month_retro (#19) + outgrown_nudge (#10) (migration #033)
-- ----------------------------------------------------------------------------
-- Two more lifecycle templates, both extending existing trigger functions:
--
-- six_month_retro: 5th enqueue inside enqueue_onboarding_sequence,
--   scheduled +180 days from signup. Renderer queries the user's primary
--   household stats via _household_year_stats with start = signup,
--   end = now. Lifecycle template, no skip — milestone deserves its note.
--
-- outgrown_nudge: extends enqueue_baby_lifecycle to schedule one outgrown
--   nudge per future band transition, at +14 days AFTER the transition
--   (vs size_shift at -14 days BEFORE). Renderer queries
--   _household_aged_out_items_in_band; skip if zero items remain in the
--   aged-past band with active inventory_status (owned, kept, needed).
--
-- Adding the new email to enqueue_onboarding_sequence is a one-line edit
-- (one extra PERFORM enqueue_email call). Confirms the architecture
-- payoff from migration #029 — extending the sequence has zero ceremony.
-- ============================================================================

-- ─── Helper: aged-out items in a specific band for a household ────────────
-- "Aged out" = still in active inventory_status (owned/kept/needed) but
-- size_label matches a band the baby has aged past. Used by render_outgrown_
-- nudge to gate the send (skip if zero) AND to surface a sample of items
-- by name in the email body.
--
-- Returns:
--   { count: int, sample: [ {brand, name, item_type, size_label, season}, ... up to 5 ] }
--
-- Sample limit is 5 server-side; renderer typically shows 3 + "+ N more".
create or replace function beta._household_aged_out_items_in_band(_household_id uuid, _band text)
returns jsonb
language sql
stable
security definer
set search_path = beta, public
as $$
  with active_in_band as (
    select id, brand, name, item_type, size_label, season, created_at
    from beta.clothing_items
    where household_id = _household_id
      and size_label = _band
      and inventory_status in ('owned', 'kept', 'needed')
    order by created_at desc
  ),
  sample_rows as (
    select brand, name, item_type, size_label, season
    from active_in_band
    limit 5
  )
  select jsonb_build_object(
    'count', (select count(*) from active_in_band),
    'sample', coalesce((
      select jsonb_agg(jsonb_build_object(
        'brand', brand,
        'name', name,
        'item_type', item_type,
        'size_label', size_label,
        'season', season
      ))
      from sample_rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function beta._household_aged_out_items_in_band(uuid, text) from public;

-- ─── Replace enqueue_onboarding_sequence to add six_month_retro ───────────
-- One extra PERFORM enqueue_email call. dedupe_key 'six_month_retro:<user_id>'
-- so it's at-most-once per user. Payload includes signup_at so the renderer
-- can compute the stat window without an extra DB lookup.
create or replace function beta.enqueue_onboarding_sequence()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  user_full_name text;
  first_name_val text;
  payload_val    jsonb;
  payload_with_signup jsonb;
begin
  if new.email is null or new.email = '' then return new; end if;
  if coalesce(new.is_anonymous, false) is true then return new; end if;

  user_full_name := coalesce(new.raw_user_meta_data->>'name', '');
  first_name_val := nullif(split_part(user_full_name, ' ', 1), '');
  payload_val    := jsonb_build_object('first_name', first_name_val);
  -- six_month_retro renderer needs the signup timestamp to scope its
  -- stat window. Other emails don't need it; keep payload minimal for
  -- those.
  payload_with_signup := payload_val || jsonb_build_object('signup_at', to_char(new.created_at, 'YYYY-MM-DD"T"HH24:MI:SSOF'));

  perform beta.enqueue_email('d2_nudge',        new.id, new.email::text, payload_val,         'd2_nudge:'        || new.id::text, now() + interval '2 days');
  perform beta.enqueue_email('d4_invite',       new.id, new.email::text, payload_val,         'd4_invite:'       || new.id::text, now() + interval '4 days');
  perform beta.enqueue_email('d7_snapshot',     new.id, new.email::text, payload_val,         'd7_snapshot:'     || new.id::text, now() + interval '7 days');
  perform beta.enqueue_email('d14_reengage',    new.id, new.email::text, payload_val,         'd14_reengage:'    || new.id::text, now() + interval '14 days');
  perform beta.enqueue_email('six_month_retro', new.id, new.email::text, payload_with_signup, 'six_month_retro:' || new.id::text, now() + interval '180 days');

  return new;
end;
$func$;

revoke all on function beta.enqueue_onboarding_sequence() from public;

-- ─── Replace enqueue_baby_lifecycle to add outgrown_nudge ─────────────────
-- Same loop structure as before — for each household member, schedule the
-- birthday + per-band size_shift + per-band outgrown_nudge. The
-- outgrown_nudge fires +14 days AFTER the transition (vs size_shift at -14
-- days BEFORE), so each band yields one of each, separated by ~28 days.
create or replace function beta.enqueue_baby_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = beta, auth, public
as $func$
declare
  member_record record;
  payload_val   jsonb;
  birthday_when timestamptz;
  birthday_year int;
  shift         record;
  shift_when    timestamptz;
  outgrown_when timestamptz;
begin
  if new.date_of_birth is null then return new; end if;

  for member_record in
    select hm.user_id,
           u.email::text as email,
           coalesce(u.raw_user_meta_data->>'name', '') as full_name
    from beta.household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = new.household_id
      and u.email is not null
      and u.email::text <> ''
      and coalesce(u.is_anonymous, false) is false
  loop
    -- ── Birthday eve ─────────────────────────────────────────────────────
    if new.date_of_birth >= current_date then
      birthday_when := (new.date_of_birth - interval '1 day')::timestamptz;
      birthday_year := 0;
    else
      birthday_when := (date_trunc('day', (
        new.date_of_birth + (
          (extract(year from age(current_date, new.date_of_birth)) + 1) || ' years'
        )::interval
      )) - interval '1 day')::timestamptz;
      birthday_year := (extract(year from age(current_date, new.date_of_birth)) + 1)::int;
    end if;

    if birthday_when > now() then
      payload_val := jsonb_build_object(
        'first_name',   nullif(split_part(member_record.full_name, ' ', 1), ''),
        'baby_name',    new.name,
        'baby_id',      new.id,
        'household_id', new.household_id,
        'year_number',  birthday_year
      );
      perform beta.enqueue_email(
        'birthday_eve',
        member_record.user_id,
        member_record.email,
        payload_val,
        'birthday_eve:' || member_record.user_id::text || ':' || new.id::text || ':' || birthday_year::text,
        birthday_when
      );
    end if;

    -- ── Per-band size_shift + outgrown_nudge ─────────────────────────────
    for shift in
      select * from (values
        ('0-3M',   '3-6M',    3),
        ('3-6M',   '6-9M',    6),
        ('6-9M',   '9-12M',   9),
        ('9-12M',  '12-18M', 12),
        ('12-18M', '18-24M', 18)
      ) as t(from_band, to_band, age_months)
    loop
      shift_when    := (new.date_of_birth + (shift.age_months || ' months')::interval - interval '14 days')::timestamptz;
      outgrown_when := (new.date_of_birth + (shift.age_months || ' months')::interval + interval '14 days')::timestamptz;

      -- size_shift: fires BEFORE transition
      if shift_when > now() then
        payload_val := jsonb_build_object(
          'first_name',   nullif(split_part(member_record.full_name, ' ', 1), ''),
          'baby_name',    new.name,
          'baby_id',      new.id,
          'household_id', new.household_id,
          'current_band', shift.from_band,
          'next_band',    shift.to_band
        );
        perform beta.enqueue_email(
          'size_shift',
          member_record.user_id,
          member_record.email,
          payload_val,
          'size_shift:' || member_record.user_id::text || ':' || new.id::text || ':' || shift.to_band,
          shift_when
        );
      end if;

      -- outgrown_nudge: fires AFTER transition
      if outgrown_when > now() then
        payload_val := jsonb_build_object(
          'first_name',   nullif(split_part(member_record.full_name, ' ', 1), ''),
          'baby_name',    new.name,
          'baby_id',      new.id,
          'household_id', new.household_id,
          'from_band',    shift.from_band
        );
        perform beta.enqueue_email(
          'outgrown_nudge',
          member_record.user_id,
          member_record.email,
          payload_val,
          'outgrown_nudge:' || member_record.user_id::text || ':' || new.id::text || ':' || shift.from_band,
          outgrown_when
        );
      end if;
    end loop;
  end loop;

  return new;
end;
$func$;

revoke all on function beta.enqueue_baby_lifecycle() from public;

comment on function beta._household_aged_out_items_in_band(uuid, text) is
  'Returns count + sample of items still active in a specific size band. Used by render_outgrown_nudge.';
comment on function beta.enqueue_onboarding_sequence() is
  'Trigger function: enqueues the full 5-email onboarding sequence (d2_nudge, d4_invite, d7_snapshot, d14_reengage, six_month_retro) at signup.';
comment on function beta.enqueue_baby_lifecycle() is
  'Trigger function: on babies INSERT or DOB-fill-in, schedules birthday_eve (next birthday), size_shift (per future band, -14d) and outgrown_nudge (per future band, +14d) per household member.';
