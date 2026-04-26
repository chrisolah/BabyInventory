-- ============================================================================
-- 20260426060000_welcome_log
-- ============================================================================
-- Atomic dedupe for the send-welcome-email edge function.
--
-- Why: the previous idempotency check (read user_metadata.welcome_sent_at →
-- send → write metadata) is not atomic. Two concurrent invocations (e.g.
-- two browser tabs both observing SIGNED_IN via storage sync) both read
-- "not set" and both send, producing duplicate welcome emails.
--
-- Fix: insert into welcome_log first. The PK on user_id makes a second
-- concurrent insert fail with unique-violation (SQLSTATE 23505), and the
-- losing call short-circuits without sending.
-- ============================================================================

create table if not exists beta.welcome_log (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

-- Service-role-only table; the edge function uses it via the admin client.
-- No RLS policies — leave RLS off so the service role can insert without
-- any policy gymnastics. Anon/authed clients have no business touching this.
alter table beta.welcome_log disable row level security;

grant all on beta.welcome_log to service_role;
