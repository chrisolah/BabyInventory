-- ============================================================================
-- Migration 039 - wishlist_shares + wishlist_claims
-- ============================================================================
-- wishlist_shares: one row per shareable link a parent creates.
-- wishlist_claims: one row per item claimed by a recipient.
-- ============================================================================

-- ─── wishlist_shares ─────────────────────────────────────────────────────────

create table if not exists beta.wishlist_shares (
  id                  uuid        primary key default gen_random_uuid(),
  household_id        uuid        not null references beta.households(id) on delete cascade,

  -- Public token embedded in the URL (/wishlist/:token)
  token               text        not null unique default encode(gen_random_bytes(16), 'hex'),

  -- Parent-authored content
  message             text,
  target_date         date,

  -- Category visibility arrays (null = all included / all skipped)
  -- Values: 'clothing' | 'sleep' | 'feeding' | 'diapering' | 'travel' | 'play' | 'health' | 'bath'
  included_categories text[],
  skip_categories     text[],

  -- Display options
  show_priority       boolean     not null default true,

  -- Lifecycle
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists wishlist_shares_household_idx on beta.wishlist_shares(household_id);
create index if not exists wishlist_shares_token_idx     on beta.wishlist_shares(token);

drop trigger if exists wishlist_shares_set_updated_at on beta.wishlist_shares;
create trigger wishlist_shares_set_updated_at
  before update on beta.wishlist_shares
  for each row execute function beta.set_updated_at();

-- RLS: owners can manage their own shares; public token lookup is handled by
-- the security-definer RPC (migration 040) — no SELECT policy needed for anon.
alter table beta.wishlist_shares enable row level security;

drop policy if exists wishlist_shares_select on beta.wishlist_shares;
drop policy if exists wishlist_shares_insert on beta.wishlist_shares;
drop policy if exists wishlist_shares_update on beta.wishlist_shares;
drop policy if exists wishlist_shares_delete on beta.wishlist_shares;

create policy wishlist_shares_select on beta.wishlist_shares
  for select using (beta.is_household_member(household_id, auth.uid()));

create policy wishlist_shares_insert on beta.wishlist_shares
  for insert with check (beta.is_household_member(household_id, auth.uid()));

create policy wishlist_shares_update on beta.wishlist_shares
  for update using (beta.is_household_member(household_id, auth.uid()));

create policy wishlist_shares_delete on beta.wishlist_shares
  for delete using (beta.is_household_member(household_id, auth.uid()));

grant select, insert, update, delete on beta.wishlist_shares to authenticated;

-- ─── wishlist_claims ─────────────────────────────────────────────────────────

create table if not exists beta.wishlist_claims (
  id            uuid        primary key default gen_random_uuid(),
  share_id      uuid        not null references beta.wishlist_shares(id) on delete cascade,

  -- Which item was claimed. slot_id matches taxonomy ids (e.g. 'crib',
  -- 'bodysuits'). slot_type distinguishes clothing vs non-clothing since
  -- slot ids are not globally unique (a clothing slot and item slot could
  -- theoretically share an id).
  slot_id       text        not null,
  slot_type     text        not null check (slot_type in ('clothing', 'item')),

  -- For clothing slots, which size was claimed
  size_label    text,

  -- Who claimed it (no account required)
  claimer_name  text        not null,

  -- How many units claimed in this transaction (default 1)
  quantity      integer     not null default 1 check (quantity > 0),

  claimed_at    timestamptz not null default now()
);

create index if not exists wishlist_claims_share_idx    on beta.wishlist_claims(share_id);
create index if not exists wishlist_claims_slot_idx     on beta.wishlist_claims(share_id, slot_id, slot_type);

-- Claims are written by unauthenticated visitors via the security-definer RPC.
-- Authenticated household members can read claims on their own shares.
alter table beta.wishlist_claims enable row level security;

drop policy if exists wishlist_claims_select on beta.wishlist_claims;

create policy wishlist_claims_select on beta.wishlist_claims
  for select using (
    exists (
      select 1 from beta.wishlist_shares ws
      where ws.id = share_id
        and beta.is_household_member(ws.household_id, auth.uid())
    )
  );

-- No direct INSERT/UPDATE/DELETE policy for authenticated users — all writes
-- go through the security-definer claim_wishlist_item RPC (migration 040).
grant select on beta.wishlist_claims to authenticated;

notify pgrst, 'reload schema';
