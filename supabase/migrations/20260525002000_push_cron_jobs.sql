-- ============================================================================
-- Push notifications: outgrown pile, size gap, re-engagement (migration #038)
-- ----------------------------------------------------------------------------
-- Three scheduled push checks, each called daily by pg_cron.
--
-- 1. enqueue_outgrown_pile_push()
--    Fires for households with 3+ outgrown items and no active bag in progress.
--    Dedupe key is weekly per household so it doesn't spam.
--
-- 2. enqueue_size_gap_push()
--    Fires for babies within 4 weeks of entering the next size band with
--    fewer than 3 owned items in that band. One push per baby per size
--    transition (dedupe key includes the next band).
--
-- 3. enqueue_reengagement_push()
--    Fires for users whose last sign-in was 14–28 days ago and who have
--    not received a re-engagement push in the last 30 days.
--
-- Schedule these in Studio after deploy:
--
--   select cron.schedule('push-outgrown-pile',   '0 14 * * *',
--     'select beta.enqueue_outgrown_pile_push()');
--   select cron.schedule('push-size-gap',         '0 14 * * *',
--     'select beta.enqueue_size_gap_push()');
--   select cron.schedule('push-reengagement',     '0 14 * * *',
--     'select beta.enqueue_reengagement_push()');
-- ============================================================================


-- ─── 1. Outgrown pile ────────────────────────────────────────────────────
create or replace function beta.enqueue_outgrown_pile_push()
returns int
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  rec         record;
  week_key    text;
  sent_count  int := 0;
begin
  for rec in
    -- Households with 3+ outgrown items and no active bag.
    select
      hm.user_id,
      ci.household_id,
      count(*)::int as outgrown_count
    from beta.clothing_items ci
    join beta.household_members hm
      on hm.household_id = ci.household_id and hm.role = 'owner'
    where ci.inventory_status = 'outgrown'
      and not exists (
        select 1 from beta.pass_along_batches b
        where b.household_id = ci.household_id
          and b.status in ('draft', 'bag_requested', 'bag_in_transit')
      )
    group by hm.user_id, ci.household_id
    having count(*) >= 3
  loop
    week_key := 'push:outgrown:' || rec.household_id::text
                || ':' || to_char(date_trunc('week', now()), 'IYYY-IW');

    perform beta.enqueue_push(
      rec.user_id,
      'Outgrown pile is growing',
      'You''ve got ' || rec.outgrown_count || ' outgrown item'
        || case when rec.outgrown_count = 1 then '' else 's' end
        || ' ready to pass on. Want to start a bag?',
      jsonb_build_object('screen', 'pass-along'),
      week_key
    );

    sent_count := sent_count + 1;
  end loop;

  return sent_count;
end;
$func$;

revoke all on function beta.enqueue_outgrown_pile_push() from public;

comment on function beta.enqueue_outgrown_pile_push() is
  'Daily cron: enqueues push for households with 3+ outgrown items and no active bag. Deduped weekly per household.';


-- ─── 2. Size gap ─────────────────────────────────────────────────────────
-- Fires when a baby is within 4 weeks of entering the next size band
-- and the household owns fewer than 3 items in that band.
create or replace function beta.enqueue_size_gap_push()
returns int
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  rec              record;
  age_months       int;
  current_band     text;
  next_band        text;
  weeks_to_next    numeric;
  owned_in_band    int;
  baby_first_name  text;
  dedupe           text;
  sent_count       int := 0;
begin
  for rec in
    select
      b.id       as baby_id,
      b.name     as baby_name,
      b.household_id,
      b.date_of_birth,
      hm.user_id
    from beta.babies b
    join beta.household_members hm
      on hm.household_id = b.household_id and hm.role = 'owner'
    where b.date_of_birth is not null
      and b.date_of_birth <= current_date
  loop
    age_months   := beta._baby_age_in_months(rec.baby_id);
    current_band := beta._baby_current_size_band(rec.baby_id);
    next_band    := beta._next_size_band(current_band);

    -- Skip if no current or next band (unsupported age range).
    if current_band is null or next_band is null then continue; end if;

    -- Weeks until the baby enters the next band.
    -- Each band transition happens at fixed month thresholds. We approximate
    -- by computing how many weeks remain in the current band.
    weeks_to_next := (
      case current_band
        when '0-3M'   then 3
        when '3-6M'   then 6
        when '6-9M'   then 9
        when '9-12M'  then 12
        when '12-18M' then 18
        when '18-24M' then 24
      end - age_months
    ) * 4.33; -- months → weeks

    -- Only alert when within 4 weeks of the transition.
    if weeks_to_next > 4 then continue; end if;

    -- Count owned (not outgrown, not pass_along) items for next band.
    select count(*)::int into owned_in_band
    from beta.clothing_items ci
    where ci.household_id = rec.household_id
      and ci.baby_id = rec.baby_id
      and ci.size_label = next_band
      and ci.inventory_status in ('owned', 'needed');

    -- Only push if they're under-stocked.
    if owned_in_band >= 3 then continue; end if;

    baby_first_name := coalesce(nullif(split_part(rec.baby_name, ' ', 1), ''), 'Your baby');
    dedupe := 'push:size_gap:' || rec.baby_id::text || ':' || next_band;

    perform beta.enqueue_push(
      rec.user_id,
      baby_first_name || ' is almost ready for ' || next_band,
      'You''ve got ' || owned_in_band || ' item'
        || case when owned_in_band = 1 then '' else 's' end
        || ' in ' || next_band || '. Check the wishlist to fill the gaps.',
      jsonb_build_object('screen', 'inventory', 'baby_id', rec.baby_id, 'size', next_band),
      dedupe
    );

    sent_count := sent_count + 1;
  end loop;

  return sent_count;
end;
$func$;

revoke all on function beta.enqueue_size_gap_push() from public;

comment on function beta.enqueue_size_gap_push() is
  'Daily cron: enqueues push when a baby is within 4 weeks of the next size band and has fewer than 3 items in it. Deduped per baby per band.';


-- ─── 3. Re-engagement ────────────────────────────────────────────────────
-- Fires once per user after 14 days of inactivity (last_sign_in_at).
-- Not re-sent within 30 days to avoid badgering inactive users.
create or replace function beta.enqueue_reengagement_push()
returns int
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  rec         record;
  dedupe      text;
  sent_count  int := 0;
begin
  for rec in
    select
      u.id          as user_id,
      u.last_sign_in_at
    from auth.users u
    -- Must have a push token to be worth targeting.
    where exists (
      select 1 from beta.push_tokens pt where pt.user_id = u.id
    )
    -- Inactive for 14–28 days (beyond 28 we don't bother; they've churned).
    and u.last_sign_in_at < now() - interval '14 days'
    and u.last_sign_in_at > now() - interval '28 days'
    -- Not anonymous.
    and coalesce(u.is_anonymous, false) is false
    -- Haven't already been sent a re-engagement push in the last 30 days.
    and not exists (
      select 1 from beta.push_outbox po
      where po.recipient_user_id = u.id
        and po.data->>'type' = 'reengagement'
        and po.created_at > now() - interval '30 days'
    )
  loop
    dedupe := 'push:reengagement:' || rec.user_id::text
              || ':' || to_char(date_trunc('month', now()), 'YYYY-MM');

    perform beta.enqueue_push(
      rec.user_id,
      'Your wardrobe is waiting',
      'It''s been a little while — pop in and see what''s next for your little one.',
      jsonb_build_object('screen', 'home', 'type', 'reengagement'),
      dedupe
    );

    sent_count := sent_count + 1;
  end loop;

  return sent_count;
end;
$func$;

revoke all on function beta.enqueue_reengagement_push() from public;

comment on function beta.enqueue_reengagement_push() is
  'Daily cron: enqueues a single re-engagement push for users inactive 14–28 days who have not been re-engaged in the last 30 days.';
