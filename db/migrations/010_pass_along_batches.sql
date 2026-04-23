-- ============================================================================
-- Migration 010 — pass_along_batches (sender-side hub + receiver opt-in)
-- ============================================================================
-- Seeds the community exchange. Parents bundle outgrown items into a "batch"
-- (one physical box) and ship it to one of four destinations:
--   • Littleloop HQ (concierge — Chris receives, matches, or donates)
--   • A specific person (freeform name + address; e.g. a sister, a friend)
--   • A charity (freeform name + address; e.g. a local Goodwill)
--   • Another Littleloop family that opted in to receiving hand-me-downs
--
-- For the 'family' destination: sender does NOT pick a specific household.
-- They just flag intent. The box physically ships to Littleloop HQ and Chris
-- forwards to a matched household during the received → fulfilled transition
-- (sets recipient_household_id at that point). This protects recipient
-- addresses and lets Chris inspect/reject unusable items before they
-- disappoint a receiver.
--
-- Status transitions depend on destination:
--   littleloop  : draft → shipped → received → fulfilled (matched | donated)
--   family      : draft → shipped → received → fulfilled (outcome: matched,
--                                                         recipient_household_id set)
--   person      : draft → shipped → fulfilled (outcome: matched)
--   charity     : draft → shipped → fulfilled (outcome: donated)
--
-- This is the SENDER side only. Receiver-initiated requests (browse/claim
-- specific items) are deferred; receivers just opt in and wait to be matched.
--
-- Scope in this migration:
--   1. beta.pass_along_batches table with RLS
--   2. beta.clothing_items gets pass_along_batch_id FK + 'pass_along' status
--   3. beta.households gets receiving-preferences columns (opt-in for the
--      'family' destination to route to them)
--   4. Reference-code generator function
--   5. RLS policies using the created_by pattern (see migration 004) so the
--      INSERT RETURNING round-trip works for creators.
--
-- Target schema: beta. Apply via Supabase SQL Editor. Idempotent.
-- ============================================================================

-- ─── Reference code generator ──────────────────────────────────────────────
-- Format: LL-XXXX-YYYY  (uppercase hex, collision-resistant, human-readable)

create or replace function beta.generate_pass_along_ref_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  collision integer;
begin
  loop
    candidate := 'LL-' ||
      upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4)) ||
      '-' ||
      upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
    select count(*) into collision
      from beta.pass_along_batches
      where reference_code = candidate;
    exit when collision = 0;
  end loop;
  return candidate;
exception
  when undefined_table then
    -- First call before the table exists during initial migration run.
    return 'LL-' ||
      upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4)) ||
      '-' ||
      upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4));
end;
$$;

-- ─── Table ─────────────────────────────────────────────────────────────────

create table if not exists beta.pass_along_batches (
  id                      uuid        primary key default gen_random_uuid(),
  household_id            uuid        not null references beta.households(id) on delete cascade,
  created_by              uuid        not null references auth.users(id)      on delete set null,
  reference_code          text        not null unique default beta.generate_pass_along_ref_code(),
  destination_type        text        not null default 'littleloop',
  recipient_name          text,                                  -- required for 'person','charity'; null for 'littleloop','family'
  recipient_address       text,                                  -- required for 'person','charity'; null for 'littleloop','family'
  recipient_notes         text,                                  -- freeform: relation, drop-off hours, anything useful
  recipient_household_id  uuid        references beta.households(id) on delete set null,
                                                                 -- only set when destination_type='family' AND Chris has matched
  status                  text        not null default 'draft',
  outcome                 text,                                  -- null until fulfilled; then 'matched' or 'donated'
  shipped_at              timestamptz,
  received_at             timestamptz,                           -- only set when destination_type in ('littleloop','family')
  fulfilled_at            timestamptz,
  label_requested_at      timestamptz,                           -- only meaningful when destination_type = 'littleloop'
  label_request_address   text,                                  -- sender's return address; collected when label is requested
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Defensive add-column-if-not-exists (in case a prior partial run left a drifted table).
alter table beta.pass_along_batches add column if not exists household_id           uuid;
alter table beta.pass_along_batches add column if not exists created_by             uuid;
alter table beta.pass_along_batches add column if not exists reference_code         text;
alter table beta.pass_along_batches add column if not exists destination_type       text not null default 'littleloop';
alter table beta.pass_along_batches add column if not exists recipient_name         text;
alter table beta.pass_along_batches add column if not exists recipient_address      text;
alter table beta.pass_along_batches add column if not exists recipient_notes        text;
alter table beta.pass_along_batches add column if not exists recipient_household_id uuid;
alter table beta.pass_along_batches add column if not exists status                 text;
alter table beta.pass_along_batches add column if not exists outcome                text;
alter table beta.pass_along_batches add column if not exists shipped_at             timestamptz;
alter table beta.pass_along_batches add column if not exists received_at            timestamptz;
alter table beta.pass_along_batches add column if not exists fulfilled_at           timestamptz;
alter table beta.pass_along_batches add column if not exists label_requested_at     timestamptz;
alter table beta.pass_along_batches add column if not exists label_request_address  text;
alter table beta.pass_along_batches add column if not exists notes                  text;
alter table beta.pass_along_batches add column if not exists created_at             timestamptz not null default now();
alter table beta.pass_along_batches add column if not exists updated_at             timestamptz not null default now();

-- ─── Check constraints ─────────────────────────────────────────────────────

alter table beta.pass_along_batches drop constraint if exists pass_along_batches_status_check;
alter table beta.pass_along_batches add  constraint pass_along_batches_status_check
  check (status in ('draft','shipped','received','fulfilled','canceled'));

alter table beta.pass_along_batches drop constraint if exists pass_along_batches_destination_check;
alter table beta.pass_along_batches add  constraint pass_along_batches_destination_check
  check (destination_type in ('littleloop','family','person','charity'));

alter table beta.pass_along_batches drop constraint if exists pass_along_batches_outcome_check;
alter table beta.pass_along_batches add  constraint pass_along_batches_outcome_check
  check (outcome is null or outcome in ('matched','donated'));

-- Outcome is only meaningful on fulfilled rows.
alter table beta.pass_along_batches drop constraint if exists pass_along_batches_outcome_when_fulfilled;
alter table beta.pass_along_batches add  constraint pass_along_batches_outcome_when_fulfilled
  check ((status = 'fulfilled') = (outcome is not null));

-- Recipient field shape by destination:
--   littleloop | family      : no recipient_name/address (Chris handles routing)
--   person     | charity     : recipient_name and recipient_address required
alter table beta.pass_along_batches drop constraint if exists pass_along_batches_recipient_required;
alter table beta.pass_along_batches add  constraint pass_along_batches_recipient_required
  check (
    (destination_type in ('littleloop','family')
       and recipient_name is null and recipient_address is null)
    or
    (destination_type in ('person','charity')
       and recipient_name is not null and length(btrim(recipient_name)) > 0
       and recipient_address is not null and length(btrim(recipient_address)) > 0)
  );

-- recipient_household_id only valid for 'family' destination.
alter table beta.pass_along_batches drop constraint if exists pass_along_batches_recipient_household_only_family;
alter table beta.pass_along_batches add  constraint pass_along_batches_recipient_household_only_family
  check (recipient_household_id is null or destination_type = 'family');

-- ─── Indexes ───────────────────────────────────────────────────────────────

create index if not exists pass_along_batches_household_idx
  on beta.pass_along_batches(household_id);
create index if not exists pass_along_batches_created_by_idx
  on beta.pass_along_batches(created_by);
create index if not exists pass_along_batches_status_idx
  on beta.pass_along_batches(status);
create index if not exists pass_along_batches_destination_idx
  on beta.pass_along_batches(destination_type);
create index if not exists pass_along_batches_recipient_household_idx
  on beta.pass_along_batches(recipient_household_id);
create index if not exists pass_along_batches_ref_idx
  on beta.pass_along_batches(reference_code);

-- ─── updated_at trigger ────────────────────────────────────────────────────

drop trigger if exists pass_along_batches_set_updated_at on beta.pass_along_batches;
create trigger pass_along_batches_set_updated_at
  before update on beta.pass_along_batches
  for each row
  execute function beta.set_updated_at();

-- ─── Extend households: receiving opt-in ──────────────────────────────────
-- A household opts in to receiving hand-me-downs by setting accepts_hand_me_downs
-- to true and (optionally) narrowing which sizes and genders they'd like.
-- When a sender picks the 'family' destination, Chris manually matches the
-- shipped batch to one of the opted-in households, preferring sizes/genders
-- that match what's in the box.

alter table beta.households add column if not exists accepts_hand_me_downs boolean not null default false;
alter table beta.households add column if not exists accepts_sizes         text[];
alter table beta.households add column if not exists accepts_genders       text[];
alter table beta.households add column if not exists receiving_paused_until date;
alter table beta.households add column if not exists receiving_notes       text;

-- Constrain accepts_sizes to the known size enum (null or empty array = any).
alter table beta.households drop constraint if exists households_accepts_sizes_check;
alter table beta.households add  constraint households_accepts_sizes_check
  check (
    accepts_sizes is null
    or accepts_sizes <@ array['0-3M','3-6M','6-9M','9-12M','12-18M','18-24M']::text[]
  );

-- Constrain accepts_genders to the known gender enum.
alter table beta.households drop constraint if exists households_accepts_genders_check;
alter table beta.households add  constraint households_accepts_genders_check
  check (
    accepts_genders is null
    or accepts_genders <@ array['boy','girl','neutral']::text[]
  );

-- Index to quickly find actively-opted-in households when matching a batch.
create index if not exists households_accepting_idx
  on beta.households(accepts_hand_me_downs)
  where accepts_hand_me_downs = true;

-- ─── Extend clothing_items: FK + inventory_status 'pass_along' ─────────────

alter table beta.clothing_items
  add column if not exists pass_along_batch_id uuid
  references beta.pass_along_batches(id) on delete set null;

create index if not exists clothing_items_pass_along_batch_idx
  on beta.clothing_items(pass_along_batch_id);

-- Extend inventory_status enum to include 'pass_along'. Items in a draft or
-- shipped batch live in this state so they don't clutter Owned/Outgrown views.
-- Once the batch is fulfilled, items flip to 'exchanged' (matched outcome) or
-- 'donated' (donated outcome) via app logic or a future trigger.
alter table beta.clothing_items drop constraint if exists clothing_items_status_check;
alter table beta.clothing_items add  constraint clothing_items_status_check
  check (inventory_status in (
    'owned',
    'needed',
    'outgrown',
    'pass_along',
    'donated',
    'exchanged'
  ));

-- ─── Row-Level Security ────────────────────────────────────────────────────
-- Model: any household member can read/write their household's batches.
-- Creator tracking (created_by) handles the INSERT…RETURNING case documented
-- in migration 004 / the RLS RETURNING gotcha: the SELECT policy evaluates
-- against the new row, and household membership is already satisfied because
-- household_id matches a household the user belongs to.

alter table beta.pass_along_batches enable row level security;

drop policy if exists pass_along_batches_select on beta.pass_along_batches;
drop policy if exists pass_along_batches_insert on beta.pass_along_batches;
drop policy if exists pass_along_batches_update on beta.pass_along_batches;
drop policy if exists pass_along_batches_delete on beta.pass_along_batches;

create policy pass_along_batches_select on beta.pass_along_batches
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy pass_along_batches_insert on beta.pass_along_batches
  for insert with check (
    beta.is_household_member(household_id, auth.uid())
    and created_by = auth.uid()
  );

create policy pass_along_batches_update on beta.pass_along_batches
  for update using (beta.is_household_member(household_id, auth.uid()));

-- Only allow deleting drafts — once shipped, the box exists in the physical
-- world and the record shouldn't disappear from the sender's history.
create policy pass_along_batches_delete on beta.pass_along_batches
  for delete using (
    beta.is_household_member(household_id, auth.uid())
    and status = 'draft'
  );

-- ─── Grants ────────────────────────────────────────────────────────────────

grant select, insert, update, delete on beta.pass_along_batches to authenticated;

-- ─── Tell PostgREST to reload its schema cache ─────────────────────────────

notify pgrst, 'reload schema';
