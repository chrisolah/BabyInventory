-- ============================================================================
-- Migration 012 — concierge_tasks (Chris's admin inbox)
-- ============================================================================
-- V1.9 redesigns the community exchange as a concierge flow: every pass-along
-- batch ultimately touches Chris in some way (matching, label generation,
-- re-routing, donating). This table is that concierge inbox — a single
-- append-only queue of "something needs a human to do a thing."
--
-- Phase 1 task types:
--   • label_request  — sender asked for a prepaid shipping label to Littleloop
--                      HQ. Payload carries the return address + reference code.
--                      Resolution = label mailed, status flips to 'resolved'.
--
-- Future task types (not inserted yet; placeholder for schema shape):
--   • family_match_needed  — a family-destination batch arrived, Chris needs
--                            to pick a recipient_household from the opt-in pool.
--   • quality_flag         — item photo looked damaged; needs eyes before reship.
--
-- Delivery channel is database-only for now. Chris will read this via Supabase
-- Studio or a future admin screen. Email/push notification is a followup (see
-- accompanying task in the task list) so the feature ships without any new
-- infrastructure dependencies.
--
-- Access model:
--   • INSERT — authenticated members of the referenced household (created_by =
--     auth.uid() and is_household_member). This lets the client fire-and-forget
--     a row when the user takes a concierge-triggering action.
--   • SELECT/UPDATE/DELETE — service_role only. The client never reads, edits,
--     or deletes tasks; Chris works them through the admin console.
--
-- Idempotent. Target schema: beta.
-- ============================================================================

create table if not exists beta.concierge_tasks (
  id               uuid        primary key default gen_random_uuid(),
  task_type        text        not null,
  status           text        not null default 'open',
  household_id     uuid        references beta.households(id)          on delete set null,
  created_by       uuid        references auth.users(id)               on delete set null,
  related_batch_id uuid        references beta.pass_along_batches(id)  on delete set null,
  payload          jsonb       not null default '{}'::jsonb,
  notes            text,
  resolved_at      timestamptz,
  resolved_by      uuid        references auth.users(id)               on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Defensive add-columns in case a prior partial run left a drifted table.
alter table beta.concierge_tasks add column if not exists task_type        text;
alter table beta.concierge_tasks add column if not exists status           text not null default 'open';
alter table beta.concierge_tasks add column if not exists household_id     uuid;
alter table beta.concierge_tasks add column if not exists created_by       uuid;
alter table beta.concierge_tasks add column if not exists related_batch_id uuid;
alter table beta.concierge_tasks add column if not exists payload          jsonb not null default '{}'::jsonb;
alter table beta.concierge_tasks add column if not exists notes            text;
alter table beta.concierge_tasks add column if not exists resolved_at      timestamptz;
alter table beta.concierge_tasks add column if not exists resolved_by      uuid;
alter table beta.concierge_tasks add column if not exists created_at       timestamptz not null default now();
alter table beta.concierge_tasks add column if not exists updated_at       timestamptz not null default now();

-- ─── Check constraints ───────────────────────────────────────────────────────

alter table beta.concierge_tasks drop constraint if exists concierge_tasks_status_check;
alter table beta.concierge_tasks add  constraint concierge_tasks_status_check
  check (status in ('open','in_progress','resolved','canceled'));

alter table beta.concierge_tasks drop constraint if exists concierge_tasks_type_check;
alter table beta.concierge_tasks add  constraint concierge_tasks_type_check
  check (task_type in ('label_request','family_match_needed','quality_flag'));

-- Resolved rows must have a resolved_at timestamp; open/in_progress must not.
alter table beta.concierge_tasks drop constraint if exists concierge_tasks_resolved_at_shape;
alter table beta.concierge_tasks add  constraint concierge_tasks_resolved_at_shape
  check (
    (status in ('resolved','canceled') and resolved_at is not null)
    or
    (status in ('open','in_progress') and resolved_at is null)
  );

-- ─── Indexes ────────────────────────────────────────────────────────────────

create index if not exists concierge_tasks_status_idx
  on beta.concierge_tasks(status)
  where status in ('open','in_progress');

create index if not exists concierge_tasks_type_idx
  on beta.concierge_tasks(task_type);

create index if not exists concierge_tasks_batch_idx
  on beta.concierge_tasks(related_batch_id);

create index if not exists concierge_tasks_created_at_idx
  on beta.concierge_tasks(created_at desc);

-- ─── updated_at trigger ─────────────────────────────────────────────────────

drop trigger if exists concierge_tasks_set_updated_at on beta.concierge_tasks;
create trigger concierge_tasks_set_updated_at
  before update on beta.concierge_tasks
  for each row
  execute function beta.set_updated_at();

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- INSERT-only for authenticated users, and they must be scoped to their own
-- household. service_role bypasses RLS and handles all reads + lifecycle.

alter table beta.concierge_tasks enable row level security;

drop policy if exists concierge_tasks_insert on beta.concierge_tasks;
drop policy if exists concierge_tasks_select on beta.concierge_tasks;
drop policy if exists concierge_tasks_update on beta.concierge_tasks;
drop policy if exists concierge_tasks_delete on beta.concierge_tasks;

-- Authenticated users can insert tasks, but only for their own household.
-- created_by must match auth.uid() so we have honest attribution.
create policy concierge_tasks_insert on beta.concierge_tasks
  for insert with check (
    created_by = auth.uid()
    and (
      household_id is null
      or beta.is_household_member(household_id, auth.uid())
    )
  );

-- No SELECT / UPDATE / DELETE policies for authenticated. service_role reads
-- and resolves everything. The client never needs to see these rows — the
-- user-facing state (e.g. label_requested_at on pass_along_batches) lives on
-- the underlying domain table.

-- ─── Grants ─────────────────────────────────────────────────────────────────

grant insert on beta.concierge_tasks to authenticated;
-- Explicit: no select/update/delete to authenticated; service_role has full
-- access via migration 005's blanket grant.

-- ─── Tell PostgREST to reload its schema cache ──────────────────────────────

notify pgrst, 'reload schema';
