import { describe, it, expect } from 'vitest'
import {
  SLOT_BY_ID,
  recommendedQty,
  computeCoverage,
} from '../lib/wardrobe'

// Pure-function tests — no DOM, no React, no fetch. Wardrobe's
// recommendation math is the source of truth for the Wish list tab and
// the slot detail screen, so the contract pinned here is what those
// surfaces depend on.

describe('recommendedQty', () => {
  // Bodysuits is a slot with explicit perAge for every range — exercises
  // the perAge-takes-precedence path.
  const bodysuits = SLOT_BY_ID.bodysuits

  // Pants & leggings is a slot with no perAge — exercises the fallback
  // to slot.recommended path.
  const pants = SLOT_BY_ID.pants_leggings

  it('returns the base value when babyCount is 1', () => {
    expect(recommendedQty(bodysuits, '0-3M', 1)).toBe(bodysuits.perAge['0-3M'])
    expect(recommendedQty(pants, '6-9M', 1)).toBe(pants.recommended)
  })

  it('defaults babyCount to 1 when omitted', () => {
    expect(recommendedQty(bodysuits, '0-3M')).toBe(bodysuits.perAge['0-3M'])
  })

  it('multiplies the base by babyCount for "all babies" views', () => {
    const base = bodysuits.perAge['0-3M']
    expect(recommendedQty(bodysuits, '0-3M', 2)).toBe(base * 2)
    expect(recommendedQty(bodysuits, '0-3M', 3)).toBe(base * 3)
  })

  it('coerces babyCount of 0 or negative to 1 (defensive)', () => {
    const base = bodysuits.perAge['0-3M']
    expect(recommendedQty(bodysuits, '0-3M', 0)).toBe(base)
    expect(recommendedQty(bodysuits, '0-3M', -5)).toBe(base)
  })

  it('floors fractional babyCount before multiplying', () => {
    // Defensive — callers shouldn't pass fractions, but if they do we
    // want a deterministic integer multiplier rather than fractional
    // recommendation rows.
    const base = bodysuits.perAge['3-6M']
    expect(recommendedQty(bodysuits, '3-6M', 2.7)).toBe(base * 2)
  })

  it('prefers perAge when both perAge and recommended are set', () => {
    // Pajamas has both a flat fallback (5) and per-age overrides.
    // perAge['0-3M']=6 must win over the flat 5.
    const pajamas = SLOT_BY_ID.pajamas
    expect(recommendedQty(pajamas, '0-3M', 1)).toBe(pajamas.perAge['0-3M'])
    expect(recommendedQty(pajamas, '0-3M', 1)).not.toBe(pajamas.recommended)
  })

  it('returns 0 for a null slot', () => {
    expect(recommendedQty(null, '0-3M', 1)).toBe(0)
    expect(recommendedQty(undefined, '0-3M', 2)).toBe(0)
  })
})

describe('computeCoverage', () => {
  const oneOwnedBodysuit = {
    id: 'i1',
    category: 'tops_and_bodysuits',
    item_type: 'bodysuit',
    size_label: '0-3M',
    inventory_status: 'owned',
    quantity: 1,
  }

  it('scales recommended by babyCount', () => {
    const rows = computeCoverage([oneOwnedBodysuit], '0-3M', 2)
    const bodysuitRow = rows.find(r => r.slot.id === 'bodysuits')
    expect(bodysuitRow).toBeTruthy()
    expect(bodysuitRow.ownedCount).toBe(1)
    expect(bodysuitRow.recommended).toBe(SLOT_BY_ID.bodysuits.perAge['0-3M'] * 2)
  })

  it('defaults babyCount to 1 (single-baby view) when omitted', () => {
    const rows = computeCoverage([oneOwnedBodysuit], '0-3M')
    const bodysuitRow = rows.find(r => r.slot.id === 'bodysuits')
    expect(bodysuitRow.recommended).toBe(SLOT_BY_ID.bodysuits.perAge['0-3M'])
  })

  it('widens the gap math when babyCount is greater than 1', () => {
    const base = SLOT_BY_ID.bodysuits.perAge['0-3M']
    const single = computeCoverage([oneOwnedBodysuit], '0-3M', 1)
      .find(r => r.slot.id === 'bodysuits')
    const dual = computeCoverage([oneOwnedBodysuit], '0-3M', 2)
      .find(r => r.slot.id === 'bodysuits')

    // Same single owned bodysuit, but the gap doubles when scaled.
    expect(single.needed).toBe(Math.max(base - 1, 0))
    expect(dual.needed).toBe(Math.max(base * 2 - 1, 0))
    expect(dual.needed).toBeGreaterThan(single.needed)
  })

  it('flips status from complete to gap when babyCount scales past owned count', () => {
    // Build a fully-stocked single-baby case — owned == recommended.
    // Then bump babyCount to 2 and the same items become a gap.
    const base = SLOT_BY_ID.bodysuits.perAge['0-3M']
    const fullyStocked = Array.from({ length: base }, (_, i) => ({
      id: `b${i}`,
      category: 'tops_and_bodysuits',
      item_type: 'bodysuit',
      size_label: '0-3M',
      inventory_status: 'owned',
      quantity: 1,
    }))

    const single = computeCoverage(fullyStocked, '0-3M', 1)
      .find(r => r.slot.id === 'bodysuits')
    const dual = computeCoverage(fullyStocked, '0-3M', 2)
      .find(r => r.slot.id === 'bodysuits')

    expect(single.status).toBe('complete')
    expect(dual.status).toBe('gap')
  })
})
