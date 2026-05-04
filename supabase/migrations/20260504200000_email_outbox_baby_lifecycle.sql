-- ============================================================================
-- Email outbox: baby lifecycle (#09 + #18) (migration #032)
-- ----------------------------------------------------------------------------
-- Wires two baby-keyed lifecycle emails to the existing outbox + trigger
-- pattern, both fired from a single trigger on the babies table:
--
--   #18 birthday_eve  — scheduled for (date_of_birth + 1 year) - 1 day
--   #09 size_shift    — five rows scheduled, one per future band transition,
--                       each at (DOB + transition_age_months) - 14 days
--
-- One trigger function (enqueue_baby_lifecycle) handles both: AFTER INSERT
-- when the row has DOB at create time, AFTER UPDATE OF date_of_birth when
-- DOB is filled in later (typical for users who sign up while expecting
-- and add DOB after birth). Past transitions (relative to current_date)
-- are skipped at enqueue time — no point scheduling something whose send
-- date is already in the past.
--
-- Both templates are scheduled per household member. dedupe_keys include
-- user_id so each member of a multi-parent household gets their own copy
-- without enqueue collisions:
--   birthday_eve:<user_id>:<baby_id>:<year>
--   size_shift:<user_id>:<baby_id>:<next_band>
--
-- Recurrence note: this migration only schedules the NEXT birthday. Year-2+
-- needs a separate mechanism (likely a daily cron or a self-rescheduling
-- pass on send). Deferred until birthday_eve has a real production fire.
-- ============================================================================

-- ─── Helper: items in a specific size band for a household ────────────────
-- Used by render_size_shift to count what's already on hand in the next
-- band, gating the send (skip if zero). Counts ALL inventory_status values
-- — owned, kept, even outgrown — because the email is asking "what's
-- waiting", and an item flagged as outgrown but still in the same size
-- band counts.
create or replace function beta._household_items_in_band_count(_household_id uuid, _band text)
returns int
language sql
stable
security definer
set search_path = beta, public
as $$
  select count(*)::int
  from beta.clothing_items
  where household_id = _household_id
    and size_label = _band;
$$;

revoke all on function beta._household_items_in_band_count(uuid, text) from public;

-- ─── Helper: year-window stats for a household ────────────────────────────
-- Used by render_birthday_eve. Window is inclusive on _start, exclusive on
-- _end (matching standard half-open interval semantics). Returns:
--   items_total          — count of clothing_items added in the window
--   items_passed_along   — count where pass_along_batch_id is non-null AND
--                          the batch was fulfilled in the window
--   sizes_worn           — distinct size_label values among items added in
--                          the window, ordered by the size-band sequence
create or replace function beta._household_year_stats(_household_id uuid, _start date, _end date)
returns jsonb
language sql
stable
security definer
set search_path = beta, public
as $$
  with items_in_window as (
    select * from beta.clothing_items
    where household_id = _household_id
      and created_at >= _start::timestamptz
      and created_at <  _end::timestamptz
  ),
  sizes as (
    select size_label
    from items_in_window
    where size_label is not null
    group by size_label
    order by case size_label
      when '0-3M'   then 1
      when '3-6M'   then 2
      when '6-9M'   then 3
      when '9-12M'  then 4
      when '12-18M' then 5
      when '18-24M' then 6
      else 99
    end
  ),
  passed_along as (
    select count(*)::int as c
    from items_in_window iw
    join beta.pass_along_batches b on b.id = iw.pass_along_batch_id
    where b.status = 'fulfilled'
      and b.fulfilled_at >= _start::timestamptz
      and b.fulfilled_at <  _end::timestamptz
  )
  select jsonb_build_object(
    'items_total',        (select count(*) from items_in_window),
    'items_passed_along', coalesce((select c from passed_along), 0),
    'sizes_worn',         coalesce((select array_agg(size_label) from sizes), array[]::text[])
  );
$$;

revoke all on function beta._household_year_stats(uuid, date, date) from public;

-- ─── Combined baby-lifecycle trigger function ─────────────────────────────
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
begin
  -- Defensive: trigger WHEN clause filters most of these.
  if new.date_of_birth is null then return new; end if;

  -- For each adult household member with email + non-anon, schedule the
  -- whole baby-lifecycle suite. New co-parents who join AFTER the baby
  -- exists won't backfill from this trigger — that's a known gap for v1.
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
    -- Compute next birthday from today's date, not from DOB. If DOB is in
    -- the future (rare — back-dated INSERT), schedule for the actual DOB.
    if new.date_of_birth >= current_date then
      birthday_when := (new.date_of_birth - interval '1 day')::timestamptz;
      birthday_year := 0;
    else
      -- Find the next occurrence of (month, day) of DOB on or after today
      birthday_when := (date_trunc('day', (
        new.date_of_birth + (
          (extract(year from age(current_date, new.date_of_birth)) + 1) || ' years'
        )::interval
      )) - interval '1 day')::timestamptz;
      birthday_year := (extract(year from age(current_date, new.date_of_birth)) + 1)::int;
    end if;

    -- Only schedule birthday if it's actually in the future
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

    -- Size-shift alerts: one per future band transition. Each scheduled
    -- 14 days before the baby crosses into the new band.
    for shift in
      select * from (values
        ('0-3M',   '3-6M',    3),
        ('3-6M',   '6-9M',    6),
        ('6-9M',   '9-12M',   9),
        ('9-12M',  '12-18M', 12),
        ('12-18M', '18-24M', 18)
      ) as t(from_band, to_band, age_months)
    loop
      shift_when := (
        new.date_of_birth
        + (shift.age_months || ' months')::interval
        - interval '14 days'
      )::timestamptz;

      -- Skip transitions whose send date is already past
      if shift_when <= now() then
        continue;
      end if;

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
    end loop;
  end loop;

  return new;
end;
$func$;

revoke all on function beta.enqueue_baby_lifecycle() from public;

-- ─── Triggers on babies ───────────────────────────────────────────────────
-- INSERT: typical case, baby created with DOB at onboarding-finish.
drop trigger if exists babies_lifecycle_emails_insert on beta.babies;
create trigger babies_lifecycle_emails_insert
  after insert on beta.babies
  for each row
  when (new.date_of_birth is not null)
  execute function beta.enqueue_baby_lifecycle();

-- UPDATE OF date_of_birth: catches the "expecting parent fills in DOB
-- after birth" case. Only fires on transition from null → set; subsequent
-- DOB corrections won't re-fire (would create duplicate enqueues).
drop trigger if exists babies_lifecycle_emails_update on beta.babies;
create trigger babies_lifecycle_emails_update
  after update of date_of_birth on beta.babies
  for each row
  when (new.date_of_birth is not null and old.date_of_birth is null)
  execute function beta.enqueue_baby_lifecycle();

comment on function beta.enqueue_baby_lifecycle() is
  'Trigger function: on babies INSERT or DOB-fill-in, schedules birthday_eve (next birthday) and size_shift (per future band transition) for each household member. Past-date transitions are skipped at enqueue time. Year-2+ recurrence not yet handled.';
