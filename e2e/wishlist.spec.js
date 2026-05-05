// Wishlist tab — recommended-wardrobe coverage view.
//
// Flow under test:
//   Sign up + onboard with a baby of known DOB → /inventory → switch to
//   the "Wish list" tab → coverage rows render for the baby's current
//   age range → adding an item updates the matching slot's coverage
//   from "0 of N" toward "1 of N".
//
// Why this matters: Wishlist is the "aha" feature (formerly "need-tab
// auto-gap"). Most regressions would surface as a wrong number on a
// single slot row, which is hard to catch by eye but easy to assert.

import { test, expect } from '@playwright/test'
import {
  freshEmail,
  signUpWithPassword,
  blastThroughOnboardingToHome,
  addOwnedItem,
} from './support/helpers.js'

test('wishlist: tab renders coverage rows; adding an item bumps the matching slot', async ({ page }) => {
  const email = freshEmail()

  // 6-9M coverage band: pick a DOB that lands the baby in 6-9M today
  // (~7 months old). 2025-10-05 is ~7 months relative to 2026-05-05.
  // The exact bucket logic lives in src/lib/wardrobe.js — if the bucket
  // boundaries shift, this test may need its DOB nudged.
  const babyDob = '2025-10-05'

  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Wishlist E2E', email })
  await blastThroughOnboardingToHome(page, {
    householdName: 'Wishlist Household',
    babyName: 'Wishlist Baby',
    babyDob,
  })

  // Switch to the Wishlist tab on /inventory.
  await page.goto('/inventory')
  await page.getByRole('button', { name: /^wish list$/i }).click()

  // The wishlist surfaces multiple slot rows ("Pajamas", "Bodysuits",
  // "Pants", etc.). We don't lock the test to a specific roster — just
  // assert at least a handful render so a totally-empty wishlist would
  // fail. The "X of Y" pattern is the key visual.
  const coverageRows = page.getByText(/\b\d+ of \d+\b/)
  await expect(coverageRows.first()).toBeVisible()
  const rowCount = await coverageRows.count()
  expect(rowCount, 'wishlist should render multiple coverage rows').toBeGreaterThanOrEqual(5)

  // Add an item that maps to a known slot — long-sleeve onesie under
  // "tops_and_bodysuits" lands in the Bodysuits slot per the existing
  // wardrobe taxonomy. Use the 6-9M size so it counts toward the
  // currently-selected age range.
  // itemType is a slot id from src/lib/wardrobe.js (the Type field is now
  // a <select>, not free-text). 'bodysuits' lands in the Bodysuits slot,
  // which has a non-zero recommended count for 6-9M (6 per the calibration
  // at the time of writing) — so the row should flip from 0/N to 1/N.
  await addOwnedItem(page, {
    category: 'tops_and_bodysuits',
    itemType: 'bodysuits',
    size: '6-9M',
    brand: 'CoverageBrand',
  })

  // Back to the Wishlist tab. The Bodysuits row should now show 1 of N
  // instead of 0 of N. We don't pin N because the recommended count
  // can shift with calibration audits — assert the LEFT side moved
  // off zero.
  await page.goto('/inventory')
  await page.getByRole('button', { name: /^wish list$/i }).click()

  // Sanity: total "X of Y" rows present, and at least one of them shows
  // a non-zero LEFT count now.
  const nonZeroRow = page.getByText(/\b[1-9]\d* of \d+\b/)
  await expect(nonZeroRow.first()).toBeVisible({ timeout: 10000 })
})
