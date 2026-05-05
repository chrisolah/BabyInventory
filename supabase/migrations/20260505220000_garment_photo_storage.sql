-- ============================================================================
-- 034 — Garment photo storage
-- ============================================================================
-- Phase 2 of the two-photo scan flow: persist the wider garment shot so the
-- Inventory tab can show a real visual thumbnail next to each item. Tag
-- close-ups remain ephemeral (OCR'd and discarded) — only the garment
-- shot is stored.
--
-- What this migration sets up:
--   1. A nullable `garment_photo_path` text column on beta.clothing_items.
--      The path is the bucket-relative key (e.g.
--      "<household_id>/<item_id>.jpg"); the column is null for any row
--      without a saved garment photo (manual-entry items, scans where the
--      user skipped the garment step, legacy rows).
--
--   2. A private storage bucket named "garment-photos" with RLS gated on
--      household membership. The path scheme is
--      "<household_id>/<item_id>.jpg" — household_id is the FIRST path
--      segment, parsed via storage.foldername() — and the policies check
--      beta.is_household_member() against that segment. SELECT/INSERT/
--      DELETE all share the same scope: a user can only touch photos for
--      households they belong to.
--
--   3. No SELECT policy that opens the bucket publicly. Reads happen
--      through signed URLs generated client-side with the user's session,
--      which Supabase Storage validates against these policies.
--
-- Idempotent: column add uses IF NOT EXISTS, bucket insert uses ON
-- CONFLICT, policies are dropped before recreation. Safe to re-run.
--
-- Apply to both projects (beta + prod) in one paste each.

-- ── 1. Column on clothing_items ───────────────────────────────────────────

alter table beta.clothing_items
  add column if not exists garment_photo_path text;

comment on column beta.clothing_items.garment_photo_path is
  'Bucket-relative key in storage.garment-photos. Null when no photo saved.';

-- ── 2. Bucket ─────────────────────────────────────────────────────────────
-- Private (public = false) so reads require signed URLs scoped to the user
-- session. Names cap at 1024 chars (Supabase default); paths under our
-- scheme top out around 80.

insert into storage.buckets (id, name, public)
values ('garment-photos', 'garment-photos', false)
on conflict (id) do nothing;

-- ── 3. RLS on storage.objects for this bucket ─────────────────────────────
-- storage.foldername(name) returns the path segments as a text[]. The first
-- element is our household_id. We check membership via the existing
-- security-definer function so the policy doesn't need to recurse into
-- household_members RLS.

drop policy if exists garment_photos_select on storage.objects;
drop policy if exists garment_photos_insert on storage.objects;
drop policy if exists garment_photos_update on storage.objects;
drop policy if exists garment_photos_delete on storage.objects;

create policy garment_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'garment-photos'
    and beta.is_household_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

create policy garment_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'garment-photos'
    and beta.is_household_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

create policy garment_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'garment-photos'
    and beta.is_household_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );

create policy garment_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'garment-photos'
    and beta.is_household_member(
      (storage.foldername(name))[1]::uuid,
      auth.uid()
    )
  );
