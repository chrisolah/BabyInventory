-- ============================================================================
-- Migration 038 - seed_gaps
-- ============================================================================
-- Creates two seeding functions and a trigger:
--
--   seed_clothing_gaps(p_household_id, p_baby_id)
--     Inserts one gap row per (slot, age_range) for clothing. 26 slots x 6
--     age ranges = 156 rows. ON CONFLICT DO NOTHING via partial unique index
--     from migration 037 makes this idempotent.
--
--   seed_item_gaps(p_household_id)
--     Inserts one gap row per taxonomy item for non-clothing (77 items).
--     Household-level (baby_id = null). Idempotent.
--
--   trigger: after_baby_insert
--     Fires on INSERT to beta.babies. Seeds clothing gaps for the new baby
--     and, for the household's first baby, seeds non-clothing item gaps.
--
--   Backfill at the bottom seeds existing households.
-- ============================================================================

-- ─── Clothing gap seeding ─────────────────────────────────────────────────────

create or replace function beta.seed_clothing_gaps(
  p_household_id uuid,
  p_baby_id      uuid
) returns void language plpgsql security definer as $$
begin
  insert into beta.clothing_items
    (household_id, baby_id, slot_id, category, item_type, size_label,
     inventory_status, quantity, is_priority)
  values
    -- ── tops_and_bodysuits ──────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'bodysuits',     'tops_and_bodysuits', 'bodysuits',     '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'day_tops',      'tops_and_bodysuits', 'day_tops',      '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sweaters',      'tops_and_bodysuits', 'sweaters',      '18-24M', 'gap', 0, false),
    -- ── one_pieces ──────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'one_pieces',    'one_pieces',         'one_pieces',    '18-24M', 'gap', 0, false),
    -- ── bottoms ─────────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'shorts',        'bottoms',            'shorts',        '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'pants_leggings','bottoms',            'pants_leggings','18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'overalls',      'bottoms',            'overalls',      '18-24M', 'gap', 0, false),
    -- ── dresses_and_skirts ──────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'dresses',       'dresses_and_skirts', 'dresses',       '18-24M', 'gap', 0, false),
    -- ── sleepwear ────────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_sacks',       'sleepwear', 'sleep_sacks',       '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'footed_pajamas',    'sleepwear', 'footed_pajamas',    '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'two_piece_pajamas', 'sleepwear', 'two_piece_pajamas', '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sleep_gowns',       'sleepwear', 'sleep_gowns',       '18-24M', 'gap', 0, false),
    -- ── outerwear ────────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'rain_gear',     'outerwear', 'rain_gear',     '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'light_jackets', 'outerwear', 'light_jackets', '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'winter_coats',  'outerwear', 'winter_coats',  '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'snowsuits',     'outerwear', 'snowsuits',     '18-24M', 'gap', 0, false),
    -- ── footwear ─────────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'socks',  'footwear', 'socks',  '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'shoes',  'footwear', 'shoes',  '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'boots',  'footwear', 'boots',  '18-24M', 'gap', 0, false),
    -- ── accessories ──────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'warm_hats',       'accessories', 'warm_hats',       '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'sun_hats',        'accessories', 'sun_hats',        '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'mittens',         'accessories', 'mittens',         '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'bibs',            'accessories', 'bibs',            '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'burp_cloths',     'accessories', 'burp_cloths',     '18-24M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'hair_accessories','accessories', 'hair_accessories', '18-24M', 'gap', 0, false),
    -- ── swimwear ─────────────────────────────────────────────────────────────
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '0-3M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '3-6M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '6-9M',   'gap', 0, false),
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '9-12M',  'gap', 0, false),
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '12-18M', 'gap', 0, false),
    (p_household_id, p_baby_id, 'swimwear', 'swimwear', 'swimwear', '18-24M', 'gap', 0, false)
  on conflict do nothing;
end;
$$;

-- ─── Non-clothing gap seeding ─────────────────────────────────────────────────

create or replace function beta.seed_item_gaps(
  p_household_id uuid
) returns void language plpgsql security definer as $$
begin
  insert into beta.items
    (household_id, baby_id, slot_id, top_category, sub_category, item_type,
     inventory_status, quantity, is_priority)
  values
    -- ── sleep ────────────────────────────────────────────────────────────────
    (p_household_id, null, 'crib',               'sleep', 'sleep_surfaces',   'crib',               'gap', 0, false),
    (p_household_id, null, 'bassinet',           'sleep', 'sleep_surfaces',   'bassinet',           'gap', 0, false),
    (p_household_id, null, 'pack_n_play',        'sleep', 'sleep_surfaces',   'pack_n_play',        'gap', 0, false),
    (p_household_id, null, 'crib_mattress',      'sleep', 'sleep_bedding',    'crib_mattress',      'gap', 0, false),
    (p_household_id, null, 'mattress_protector', 'sleep', 'sleep_bedding',    'mattress_protector', 'gap', 0, false),
    (p_household_id, null, 'fitted_sheets',      'sleep', 'sleep_bedding',    'fitted_sheets',      'gap', 0, false),
    (p_household_id, null, 'white_noise_machine','sleep', 'sleep_environment','white_noise_machine','gap', 0, false),
    (p_household_id, null, 'blackout_curtains',  'sleep', 'sleep_environment','blackout_curtains',  'gap', 0, false),
    (p_household_id, null, 'night_light',        'sleep', 'sleep_environment','night_light',        'gap', 0, false),
    (p_household_id, null, 'baby_monitor',       'sleep', 'sleep_monitoring', 'baby_monitor',       'gap', 0, false),
    -- ── feeding ──────────────────────────────────────────────────────────────
    (p_household_id, null, 'breast_pump',       'feeding', 'breastfeeding',  'breast_pump',       'gap', 0, false),
    (p_household_id, null, 'nursing_pillow',    'feeding', 'breastfeeding',  'nursing_pillow',    'gap', 0, false),
    (p_household_id, null, 'nursing_pads',      'feeding', 'breastfeeding',  'nursing_pads',      'gap', 0, false),
    (p_household_id, null, 'nipple_cream',      'feeding', 'breastfeeding',  'nipple_cream',      'gap', 0, false),
    (p_household_id, null, 'milk_storage',      'feeding', 'breastfeeding',  'milk_storage',      'gap', 0, false),
    (p_household_id, null, 'bottles',           'feeding', 'bottle_feeding', 'bottles',           'gap', 0, false),
    (p_household_id, null, 'bottle_brush',      'feeding', 'bottle_feeding', 'bottle_brush',      'gap', 0, false),
    (p_household_id, null, 'bottle_sterilizer', 'feeding', 'bottle_feeding', 'bottle_sterilizer', 'gap', 0, false),
    (p_household_id, null, 'drying_rack',       'feeding', 'bottle_feeding', 'drying_rack',       'gap', 0, false),
    (p_household_id, null, 'high_chair',        'feeding', 'solids',         'high_chair',        'gap', 0, false),
    (p_household_id, null, 'baby_spoons',       'feeding', 'solids',         'baby_spoons',       'gap', 0, false),
    (p_household_id, null, 'baby_bowls',        'feeding', 'solids',         'baby_bowls',        'gap', 0, false),
    (p_household_id, null, 'sippy_cup',         'feeding', 'solids',         'sippy_cup',         'gap', 0, false),
    (p_household_id, null, 'silicone_placemat', 'feeding', 'solids',         'silicone_placemat', 'gap', 0, false),
    (p_household_id, null, 'baby_food_maker',   'feeding', 'solids',         'baby_food_maker',   'gap', 0, false),
    (p_household_id, null, 'mesh_feeder',       'feeding', 'solids',         'mesh_feeder',       'gap', 0, false),
    -- ── diapering ────────────────────────────────────────────────────────────
    (p_household_id, null, 'disposable_diapers',  'diapering', 'diapers',          'disposable_diapers',  'gap', 0, false),
    (p_household_id, null, 'cloth_diapers',       'diapering', 'diapers',          'cloth_diapers',       'gap', 0, false),
    (p_household_id, null, 'swim_diapers',        'diapering', 'diapers',          'swim_diapers',        'gap', 0, false),
    (p_household_id, null, 'diaper_rash_cream',   'diapering', 'diapers',          'diaper_rash_cream',   'gap', 0, false),
    (p_household_id, null, 'changing_pad',        'diapering', 'changing_station', 'changing_pad',        'gap', 0, false),
    (p_household_id, null, 'changing_pad_covers', 'diapering', 'changing_station', 'changing_pad_covers', 'gap', 0, false),
    (p_household_id, null, 'wipes',               'diapering', 'changing_station', 'wipes',               'gap', 0, false),
    (p_household_id, null, 'diaper_pail',         'diapering', 'changing_station', 'diaper_pail',         'gap', 0, false),
    (p_household_id, null, 'wipe_warmer',         'diapering', 'changing_station', 'wipe_warmer',         'gap', 0, false),
    (p_household_id, null, 'diaper_bag',          'diapering', 'diaper_bag',       'diaper_bag',          'gap', 0, false),
    (p_household_id, null, 'wet_bag',             'diapering', 'diaper_bag',       'wet_bag',             'gap', 0, false),
    -- ── travel ───────────────────────────────────────────────────────────────
    (p_household_id, null, 'stroller',            'travel', 'strollers',  'stroller',            'gap', 0, false),
    (p_household_id, null, 'stroller_organizer',  'travel', 'strollers',  'stroller_organizer',  'gap', 0, false),
    (p_household_id, null, 'stroller_bassinet',   'travel', 'strollers',  'stroller_bassinet',   'gap', 0, false),
    (p_household_id, null, 'infant_car_seat',     'travel', 'car_seats',  'infant_car_seat',     'gap', 0, false),
    (p_household_id, null, 'convertible_car_seat','travel', 'car_seats',  'convertible_car_seat','gap', 0, false),
    (p_household_id, null, 'car_seat_mirror',     'travel', 'car_seats',  'car_seat_mirror',     'gap', 0, false),
    (p_household_id, null, 'car_seat_protector',  'travel', 'car_seats',  'car_seat_protector',  'gap', 0, false),
    (p_household_id, null, 'structured_carrier',  'travel', 'carriers',   'structured_carrier',  'gap', 0, false),
    (p_household_id, null, 'wrap_carrier',        'travel', 'carriers',   'wrap_carrier',        'gap', 0, false),
    (p_household_id, null, 'ring_sling',          'travel', 'carriers',   'ring_sling',          'gap', 0, false),
    (p_household_id, null, 'portable_high_chair', 'travel', 'travel_gear','portable_high_chair', 'gap', 0, false),
    -- ── play ─────────────────────────────────────────────────────────────────
    (p_household_id, null, 'play_mat',         'play', 'infant_play',    'play_mat',         'gap', 0, false),
    (p_household_id, null, 'baby_gym',         'play', 'infant_play',    'baby_gym',         'gap', 0, false),
    (p_household_id, null, 'bouncer_swing',    'play', 'infant_play',    'bouncer_swing',    'gap', 0, false),
    (p_household_id, null, 'rattles_sensory',  'play', 'infant_play',    'rattles_sensory',  'gap', 0, false),
    (p_household_id, null, 'jumper_exersaucer','play', 'mobile_play',    'jumper_exersaucer','gap', 0, false),
    (p_household_id, null, 'push_walker',      'play', 'mobile_play',    'push_walker',      'gap', 0, false),
    (p_household_id, null, 'stacking_blocks',  'play', 'mobile_play',    'stacking_blocks',  'gap', 0, false),
    (p_household_id, null, 'shape_sorter',     'play', 'mobile_play',    'shape_sorter',     'gap', 0, false),
    (p_household_id, null, 'board_books',      'play', 'books_learning', 'board_books',      'gap', 0, false),
    (p_household_id, null, 'bath_books',       'play', 'books_learning', 'bath_books',       'gap', 0, false),
    (p_household_id, null, 'outdoor_blanket',  'play', 'outdoor_play',   'outdoor_blanket',  'gap', 0, false),
    -- ── health ───────────────────────────────────────────────────────────────
    (p_household_id, null, 'thermometer',    'health', 'health_monitoring', 'thermometer',    'gap', 0, false),
    (p_household_id, null, 'nasal_aspirator','health', 'health_monitoring', 'nasal_aspirator','gap', 0, false),
    (p_household_id, null, 'humidifier',     'health', 'health_monitoring', 'humidifier',     'gap', 0, false),
    (p_household_id, null, 'nail_clippers',  'health', 'grooming',          'nail_clippers',  'gap', 0, false),
    (p_household_id, null, 'baby_brush_comb','health', 'grooming',          'baby_brush_comb','gap', 0, false),
    (p_household_id, null, 'medicine_dropper','health','grooming',          'medicine_dropper','gap',0, false),
    (p_household_id, null, 'outlet_covers',  'health', 'baby_safety',       'outlet_covers',  'gap', 0, false),
    (p_household_id, null, 'cabinet_locks',  'health', 'baby_safety',       'cabinet_locks',  'gap', 0, false),
    (p_household_id, null, 'baby_gate',      'health', 'baby_safety',       'baby_gate',      'gap', 0, false),
    (p_household_id, null, 'corner_guards',  'health', 'baby_safety',       'corner_guards',  'gap', 0, false),
    -- ── bath ─────────────────────────────────────────────────────────────────
    (p_household_id, null, 'baby_bathtub',      'bath', 'bath_setup',     'baby_bathtub',      'gap', 0, false),
    (p_household_id, null, 'hooded_towels',     'bath', 'bath_setup',     'hooded_towels',     'gap', 0, false),
    (p_household_id, null, 'washcloths',        'bath', 'bath_setup',     'washcloths',        'gap', 0, false),
    (p_household_id, null, 'bath_mat',          'bath', 'bath_setup',     'bath_mat',          'gap', 0, false),
    (p_household_id, null, 'bath_thermometer',  'bath', 'bath_setup',     'bath_thermometer',  'gap', 0, false),
    (p_household_id, null, 'rinse_cup',         'bath', 'bath_setup',     'rinse_cup',         'gap', 0, false),
    (p_household_id, null, 'baby_wash_shampoo', 'bath', 'bath_products',  'baby_wash_shampoo', 'gap', 0, false),
    (p_household_id, null, 'baby_lotion',       'bath', 'bath_products',  'baby_lotion',       'gap', 0, false)
  on conflict do nothing;
end;
$$;

-- ─── Trigger: seed on baby INSERT ────────────────────────────────────────────

create or replace function beta.on_baby_insert_seed_gaps()
returns trigger language plpgsql security definer as $$
begin
  -- Always seed clothing gaps for this new baby.
  perform beta.seed_clothing_gaps(new.household_id, new.id);

  -- Seed non-clothing item gaps once per household (first baby only).
  if not exists (
    select 1 from beta.items
    where household_id = new.household_id
      and inventory_status = 'gap'
      and baby_id is null
    limit 1
  ) then
    perform beta.seed_item_gaps(new.household_id);
  end if;

  return new;
end;
$$;

drop trigger if exists baby_insert_seed_gaps on beta.babies;
create trigger baby_insert_seed_gaps
  after insert on beta.babies
  for each row execute function beta.on_baby_insert_seed_gaps();

-- ─── Backfill: seed existing households ──────────────────────────────────────
-- Runs once at migration time for any households that already have babies.
-- The ON CONFLICT DO NOTHING in each seed function makes this safe to re-run.

do $$
declare
  r record;
begin
  -- Clothing gaps: one seeding call per existing baby
  for r in select id, household_id from beta.babies loop
    perform beta.seed_clothing_gaps(r.household_id, r.id);
  end loop;

  -- Non-clothing gaps: one seeding call per household that has at least one baby
  for r in
    select distinct household_id
    from beta.babies
    where not exists (
      select 1 from beta.items i
      where i.household_id = beta.babies.household_id
        and i.inventory_status = 'gap'
        and i.baby_id is null
    )
  loop
    perform beta.seed_item_gaps(r.household_id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
