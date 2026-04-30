-- Migration #021: add 'kept' to clothing_items.inventory_status check constraint.
--
-- Adds a new inventory state for items the household is keeping (sibling
-- hand-me-down or sentimental keepsake) but no longer in active rotation.
--
-- State machine context:
--   - 'owned'      = active wardrobe, currently fits
--   - 'needed'     = wish list
--   - 'outgrown'   = legacy transient state (pre-redesign). New flows skip
--                    this; existing rows render in the new bottom-of-Owned
--                    "Outgrown" section with a default Pass-on chip until
--                    reclassified.
--   - 'pass_along' = packed in a draft/active bag
--   - 'kept'       = NEW. Tucked away by the household. Non-funnel-pressured
--                    but always reversible: the user can flip 'kept' → 'owned'
--                    (sibling is now wearing them) or 'kept' → 'pass_along'
--                    (decided to send them on after all) at any time.
--   - 'donated' / 'exchanged' = terminal post-batch outcomes
--
-- Idempotent: drop-then-add constraint pattern matches migration #010 and
-- the constraint-rewrite-order rule (constraint dropped before any future
-- UPDATE that might write the new value). No data backfill needed — the
-- new value is opt-in via app writes.

alter table beta.clothing_items drop constraint if exists clothing_items_status_check;
alter table beta.clothing_items add  constraint clothing_items_status_check
  check (inventory_status in (
    'owned',
    'needed',
    'outgrown',
    'pass_along',
    'kept',
    'donated',
    'exchanged'
  ));
