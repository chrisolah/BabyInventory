-- ============================================================================
-- Migration 007 — drop legacy clothing_items columns
-- ============================================================================
-- Migration 006 added the current clothing_items columns via `add column if
-- not exists`, but the pre-existing table (created by a data_model_v2
-- bring-up) still carries columns the app doesn't use — and some of them are
-- NOT NULL with no default, which means every INSERT the app issues would
-- fail.
--
-- This migration removes those legacy columns. Safe only if clothing_items
-- has no meaningful rows (true when authored: count = 0 in beta); if you're
-- re-running against a populated table, move or back up the data first.
--
-- Idempotent via `drop column if exists`. Tightens inventory_status to NOT
-- NULL at the end so it matches migration 006's intent.
-- ============================================================================

alter table beta.clothing_items drop column if exists added_by;
alter table beta.clothing_items drop column if exists mode;
alter table beta.clothing_items drop column if exists status;
alter table beta.clothing_items drop column if exists qty_owned;
alter table beta.clothing_items drop column if exists qty_needed;
alter table beta.clothing_items drop column if exists weight_min;
alter table beta.clothing_items drop column if exists weight_max;
alter table beta.clothing_items drop column if exists gender_tag;

-- Tighten inventory_status. Migration 006's `add column if not exists`
-- couldn't set NOT NULL because the column was added to a populated table
-- (now emptied); do it here so drift bites identically in fresh bring-ups.
alter table beta.clothing_items alter column inventory_status set not null;

-- ─── Tell PostgREST to reload its schema cache ─────────────────────────────
notify pgrst, 'reload schema';
