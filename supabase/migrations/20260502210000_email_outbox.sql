-- ============================================================================
-- Email outbox (migration #024)
-- ----------------------------------------------------------------------------
-- A central queue for all outbound user-facing emails. Replaces the per-event
-- "one Database Webhook + one edge function per email type" pattern with:
--   1. DB triggers (or pg_cron daily jobs) that INSERT into beta.email_outbox
--   2. A single edge function (`send-email-outbox`) that polls + dispatches
--   3. A pg_cron job that calls the dispatcher every minute
--
-- Benefits over the per-email-webhook pattern:
--   - One function deploy, one webhook secret, one Studio config, ever
--   - Built-in retry via attempts/max_attempts
--   - Built-in dedup via dedupe_key partial unique index
--   - Audit trail: every outbound email has a row with status + last_error
--   - Time-based scheduling for lifecycle emails (D+2, weekly digest, etc.)
--     just by setting scheduled_for in the future
--
-- Trade-off: 0–60s latency on transactional events vs sub-second for direct
-- webhook→function. Acceptable for everything we send. The two existing
-- functions (send-bag-on-the-way, send-first-pass-along) keep their direct
-- webhook wiring; new emails go through the outbox.
-- ============================================================================

create table if not exists beta.email_outbox (
  id                  uuid        primary key default gen_random_uuid(),
  template_id         text        not null,
  recipient_user_id   uuid        references auth.users(id) on delete set null,
  recipient_email     text        not null,
  payload             jsonb       not null default '{}'::jsonb,
  status              text        not null default 'pending',
  attempts            int         not null default 0,
  max_attempts        int         not null default 3,
  last_error          text,
  scheduled_for       timestamptz,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  -- Optional logical idempotency key. If present and another row with the
  -- same key already exists, the INSERT is a no-op via the partial unique
  -- index below. Use values like 'bag_on_the_way:<batch_id>' to ensure a
  -- given event enqueues at most one email.
  dedupe_key          text
);

alter table beta.email_outbox drop constraint if exists email_outbox_status_check;
alter table beta.email_outbox add  constraint email_outbox_status_check
  check (status in ('pending','sending','sent','failed','skipped'));

-- Sent rows must have sent_at; non-sent rows must not.
alter table beta.email_outbox drop constraint if exists email_outbox_sent_at_shape;
alter table beta.email_outbox add  constraint email_outbox_sent_at_shape
  check (
    (status = 'sent' and sent_at is not null)
    or
    (status <> 'sent' and sent_at is null)
  );

-- Failed/skipped rows should carry an explanation.
alter table beta.email_outbox drop constraint if exists email_outbox_error_when_failed;
alter table beta.email_outbox add  constraint email_outbox_error_when_failed
  check (
    (status in ('failed','skipped') and last_error is not null)
    or
    (status not in ('failed','skipped'))
  );

-- ─── Indexes ────────────────────────────────────────────────────────────────

-- Primary cron-poll path. Partial index keeps it small even as `sent` rows
-- accumulate; the cron query filters by `status = 'pending'` so it only
-- touches the live tail.
create index if not exists email_outbox_pending_idx
  on beta.email_outbox (scheduled_for nulls first, created_at)
  where status = 'pending';

-- Dedup path. Partial unique so multiple rows can have null dedupe_key (for
-- emails where dedup doesn't matter); only non-null keys are constrained
-- to be unique.
create unique index if not exists email_outbox_dedupe_key_uniq
  on beta.email_outbox (dedupe_key)
  where dedupe_key is not null;

-- Audit lookups by recipient.
create index if not exists email_outbox_recipient_idx
  on beta.email_outbox (recipient_user_id, created_at desc);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Service role only. Users never read or write this table directly; triggers
-- + cron run as superuser, edge function uses the service role key.
alter table beta.email_outbox enable row level security;

drop policy if exists email_outbox_no_user_access on beta.email_outbox;
-- No policies = no rows visible to authenticated/anon roles. Service role
-- bypasses RLS entirely. This is the desired posture.

-- ─── Helper: enqueue function ───────────────────────────────────────────────
-- Convenience wrapper for triggers + scheduled inserts. Returns the row id
-- if a new row was inserted, or null if a duplicate dedupe_key blocked it.
create or replace function beta.enqueue_email(
  _template_id      text,
  _recipient_user   uuid,
  _recipient_email  text,
  _payload          jsonb default '{}'::jsonb,
  _dedupe_key       text default null,
  _scheduled_for    timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  new_id uuid;
begin
  insert into beta.email_outbox (
    template_id, recipient_user_id, recipient_email, payload, dedupe_key, scheduled_for
  )
  values (
    _template_id, _recipient_user, _recipient_email, _payload, _dedupe_key, _scheduled_for
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into new_id;

  return new_id;
end;
$func$;

revoke all on function beta.enqueue_email(text, uuid, text, jsonb, text, timestamptz) from public;
-- Not granted to authenticated; only triggers + cron + admin RPCs use this.


-- ─── Dispatcher RPCs ────────────────────────────────────────────────────────
-- Three RPCs the dispatcher edge function calls. Doing the row state
-- transitions in SQL (rather than the SDK) lets us use FOR UPDATE SKIP
-- LOCKED for safe concurrent dispatch — multiple pg_cron firings won't
-- double-claim the same row.

-- Atomically claim up to _limit pending rows. Returns claimed rows with
-- everything the dispatcher needs to render + send. Status flips to
-- 'sending' and attempts increments before the row is returned, so a
-- crashed dispatcher leaves rows in 'sending' (visible for forensics
-- via the recipient_idx).
create or replace function beta.claim_outbox_batch(_limit int default 50)
returns table (
  id                uuid,
  template_id       text,
  recipient_user_id uuid,
  recipient_email   text,
  payload           jsonb,
  attempts          int
)
language plpgsql
security definer
set search_path = beta, public
as $func$
begin
  return query
  with claimed as (
    update beta.email_outbox o
    set status = 'sending',
        attempts = o.attempts + 1
    where o.id in (
      select inner_o.id
      from beta.email_outbox inner_o
      where inner_o.status = 'pending'
        and (inner_o.scheduled_for is null or inner_o.scheduled_for <= now())
        and inner_o.attempts < inner_o.max_attempts
      order by inner_o.created_at
      limit _limit
      for update skip locked
    )
    returning o.id, o.template_id, o.recipient_user_id, o.recipient_email, o.payload, o.attempts
  )
  select c.id, c.template_id, c.recipient_user_id, c.recipient_email, c.payload, c.attempts
  from claimed c;
end;
$func$;

revoke all on function beta.claim_outbox_batch(int) from public;

-- Mark a row as successfully sent.
create or replace function beta.mark_outbox_sent(_id uuid)
returns void
language sql
security definer
set search_path = beta, public
as $func$
  update beta.email_outbox
  set status = 'sent',
      sent_at = now()
  where id = _id;
$func$;

revoke all on function beta.mark_outbox_sent(uuid) from public;

-- Mark a row as failed. If attempts < max_attempts, returns it to 'pending'
-- so the next cron run will retry. Otherwise marks 'failed' permanently.
create or replace function beta.mark_outbox_failed(_id uuid, _error text)
returns void
language plpgsql
security definer
set search_path = beta, public
as $func$
declare
  row_attempts int;
  row_max int;
begin
  select attempts, max_attempts into row_attempts, row_max
  from beta.email_outbox where id = _id;

  if row_attempts is null then return; end if;

  if row_attempts < row_max then
    update beta.email_outbox
    set status = 'pending',
        last_error = _error
    where id = _id;
  else
    update beta.email_outbox
    set status = 'failed',
        last_error = _error
    where id = _id;
  end if;
end;
$func$;

revoke all on function beta.mark_outbox_failed(uuid, text) from public;
