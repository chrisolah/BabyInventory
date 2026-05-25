-- ============================================================================
-- Push notification infrastructure (migration #036)
-- ----------------------------------------------------------------------------
-- Mirrors the email_outbox pattern for push notifications.
--
-- Tables:
--   beta.push_tokens  — device tokens per user (APNs for iOS)
--   beta.push_outbox  — pending/sent/failed push rows
--
-- Helpers:
--   beta.enqueue_push()            — used by triggers + cron jobs
--   beta.claim_push_outbox_batch() — called by send-push-outbox edge fn
--   beta.mark_push_sent()          — marks a row sent
--   beta.mark_push_failed()        — marks a row failed
--   beta.save_push_token()         — authenticated RPC; client calls on registration
--
-- The send-push-outbox edge function is invoked by pg_cron every minute
-- (same as send-email-outbox). Set it up in Studio once after deploy:
--
--   select cron.schedule(
--     'send-push-outbox',
--     '* * * * *',
--     $$
--       select net.http_post(
--         url    := '<SUPABASE_URL>/functions/v1/send-push-outbox',
--         headers := jsonb_build_object(
--           'Content-Type',  'application/json',
--           'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--         ),
--         body   := '{}'::jsonb
--       )
--     $$
--   );
-- ============================================================================

-- ─── push_tokens ─────────────────────────────────────────────────────────
create table if not exists beta.push_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null default 'ios'
                check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_idx on beta.push_tokens (user_id);

-- RLS: users can only see and manage their own tokens.
alter table beta.push_tokens enable row level security;

create policy "push_tokens: owner read"
  on beta.push_tokens for select
  using (user_id = auth.uid());

create policy "push_tokens: owner insert"
  on beta.push_tokens for insert
  with check (user_id = auth.uid());

create policy "push_tokens: owner delete"
  on beta.push_tokens for delete
  using (user_id = auth.uid());


-- ─── push_outbox ─────────────────────────────────────────────────────────
create table if not exists beta.push_outbox (
  id                  uuid primary key default gen_random_uuid(),
  recipient_user_id   uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  body                text not null,
  data                jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
                        check (status in ('pending', 'sending', 'sent', 'failed')),
  dedupe_key          text unique,
  scheduled_for       timestamptz,
  attempts            int not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  constraint push_outbox_attempts_non_negative check (attempts >= 0)
);

create index if not exists push_outbox_pending_idx
  on beta.push_outbox (status, scheduled_for nulls first)
  where status = 'pending';

create index if not exists push_outbox_recipient_idx
  on beta.push_outbox (recipient_user_id, created_at desc);

comment on table beta.push_outbox is
  'Pending / sent / failed push notification rows. Mirrors email_outbox pattern. Claimed by send-push-outbox edge function via pg_cron.';


-- ─── enqueue_push ─────────────────────────────────────────────────────────
create or replace function beta.enqueue_push(
  _recipient_user   uuid,
  _title            text,
  _body             text,
  _data             jsonb        default '{}'::jsonb,
  _dedupe_key       text         default null,
  _scheduled_for    timestamptz  default null
)
returns uuid
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  new_id uuid;
begin
  insert into beta.push_outbox (
    recipient_user_id, title, body, data, dedupe_key, scheduled_for
  )
  values (
    _recipient_user, _title, _body, _data, _dedupe_key, _scheduled_for
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into new_id;

  return new_id;
end;
$func$;

revoke all on function beta.enqueue_push(uuid, text, text, jsonb, text, timestamptz) from public;

comment on function beta.enqueue_push is
  'Convenience wrapper for enqueuing push notifications. Deduplicates by dedupe_key. Used by triggers and cron jobs.';


-- ─── claim_push_outbox_batch ──────────────────────────────────────────────
-- Atomically claims up to _limit pending rows. FOR UPDATE SKIP LOCKED
-- prevents double-dispatch when pg_cron fires overlap.
create or replace function beta.claim_push_outbox_batch(_limit int default 50)
returns table (
  id                uuid,
  recipient_user_id uuid,
  title             text,
  body              text,
  data              jsonb,
  attempts          int
)
language plpgsql
security definer
set search_path = beta, public
as $func$
begin
  return query
  with claimed as (
    update beta.push_outbox o
    set status   = 'sending',
        attempts = o.attempts + 1
    where o.id in (
      select id from beta.push_outbox
      where status = 'pending'
        and (scheduled_for is null or scheduled_for <= now())
      order by created_at
      limit _limit
      for update skip locked
    )
    returning o.id, o.recipient_user_id, o.title, o.body, o.data, o.attempts + 1
  )
  select * from claimed;
end;
$func$;

revoke all on function beta.claim_push_outbox_batch(int) from public;


-- ─── mark_push_sent ───────────────────────────────────────────────────────
create or replace function beta.mark_push_sent(_id uuid)
returns void
language sql
security definer
set search_path = beta, public
as $$
  update beta.push_outbox
  set status = 'sent', sent_at = now()
  where id = _id;
$$;

revoke all on function beta.mark_push_sent(uuid) from public;


-- ─── mark_push_failed ─────────────────────────────────────────────────────
create or replace function beta.mark_push_failed(_id uuid, _error text)
returns void
language sql
security definer
set search_path = beta, public
as $$
  update beta.push_outbox
  set status     = case when attempts >= 3 then 'failed' else 'pending' end,
      last_error = _error
  where id = _id;
$$;

revoke all on function beta.mark_push_failed(uuid, text) from public;


-- ─── save_push_token ──────────────────────────────────────────────────────
-- Authenticated RPC the client calls after receiving an APNs registration
-- token. Upserts so re-registrations (token refresh, reinstall) are safe.
create or replace function beta.save_push_token(
  _token    text,
  _platform text default 'ios'
)
returns void
language plpgsql
security definer
set search_path = beta, public
as $func$
begin
  insert into beta.push_tokens (user_id, token, platform)
  values (auth.uid(), _token, _platform)
  on conflict (user_id, token) do nothing;
end;
$func$;

-- Callable by authenticated users only.
revoke all on function beta.save_push_token(text, text) from public;
grant execute on function beta.save_push_token(text, text) to authenticated;

comment on function beta.save_push_token is
  'Upserts a push token for the current user. Called by the client after APNs registration. Safe to call on every app launch.';
