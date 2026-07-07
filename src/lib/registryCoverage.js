// Shared "how many of this registry gap are still needed" calculation —
// used by both registry surfaces (the household's own /registry/edit screen
// and the public /registry/:token gift-giver page) so they can't compute
// coverage differently and drift apart. That drift is exactly what caused
// two related bugs fixed on 2026-07-07: the public page rendered a
// "Covered" card instead of hiding it once a gap was fully met, and the
// edit screen didn't treat covered gaps as inactive at all (still showed
// live qty controls and a prioritize button on something nobody needs
// anymore).
import { SLOTS, recommendedQty } from './wardrobe'
import { ITEMS, CONSUMABLE_SLOT_IDS } from './categories'

export const CLOTHING_SLOT = Object.fromEntries(SLOTS.map(s => [s.id, s]))
export const ITEM_SLOT = Object.fromEntries(ITEMS.map(i => [i.id, i]))

export function claimKey(slotType, slotId, sizeLabel) {
  return `${slotType}:${slotId}:${sizeLabel || ''}`
}

// slotType: 'clothing' | 'item'. sizeLabel is only meaningful for clothing.
// claimsMap/qtyOverridesMap are optional — the edit screen has no concept of
// claims-from-a-different-person until claims are wired in there too, and
// not every caller has quantity overrides loaded.
export function computeStillNeeded({ slotType, slotId, sizeLabel, ownedCount, claimsMap, qtyOverridesMap }) {
  const isClothing = slotType === 'clothing'
  const isConsumable = !isClothing && CONSUMABLE_SLOT_IDS.has(slotId)
  if (isConsumable) {
    return { stillNeeded: 1, isCovered: false, claimData: { total: 0, claimers: [] } }
  }
  const slot = isClothing ? CLOTHING_SLOT[slotId] : ITEM_SLOT[slotId]
  const recommended = isClothing ? recommendedQty(slot, sizeLabel) : (slot?.recommended ?? 1)
  const overrideKey = `${slotId}:${sizeLabel || ''}`
  const desiredQty = qtyOverridesMap?.[overrideKey] ?? recommended
  const claimData = (claimsMap && claimsMap[claimKey(slotType, slotId, sizeLabel)]) || { total: 0, claimers: [] }
  const stillNeeded = Math.max(0, desiredQty - (ownedCount || 0) - claimData.total)
  return { stillNeeded, isCovered: stillNeeded === 0, claimData }
}
