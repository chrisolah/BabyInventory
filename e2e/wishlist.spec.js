// Coverage view — Plan tab with clothing category.
//
// The old "Wish list" tab in /inventory was renamed and moved. Coverage
// rows with "X of Y" format now live in the Plan tab (per-category view).
// This test was updated 2026-06-03 to use /plan instead of /inventory.
//
// Flow under test:
//   Sign up + onboard with a baby of known DOB → /plan (clothing) →
//   coverage rows render for the baby's current age range →
//   adding an owned item updates the matching slot from 0/N toward 1/N.

import { test, expect } from '@playwright/test'
import {
  freshEmail,
  signUpWithPassword,
  blastThroughOnboardingToHome,
  addOwnedItem,
} from './support/helpers.js'

test('plan coverage: clothing rows render; adding an item bumps the matching slot', async ({ page }) => {
  const email = freshEmail()

  // 6-9M coverage band: DOB ~7 months before today.
  const babyDob = '2025-10-05'

  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Wishlist E2E', email })
  await blastThroughOnboardingToHome(page, {
    householdName: 'Wishlist Household',
    babyName: 'Wishlist Baby',
    babyDob,
  })

  // Plan tab — clothing is selected by default and shows coverage rows.
  await page.goto('/plan')
  await expect(page.getByText(/loading/i)).not.toBeVisible({ timeout: 10000 })

  // Coverage rows show "X of Y" format. With 0 items, all slots show 0/N.
  const coverageRows = page.getByText(/\b\d+ of \d+\b/)
  await expect(coverageRows.first()).toBeVisible({ timeout: 10000 })
  const rowCount = await coverageRows.count()
  expect(rowCount, 'plan should render multiple coverage rows').toBeGreaterThanOrEqual(5)

  // Add a bodysuit in 6-9M — maps to the Bodysuits slot in the clothing
  // wardrobe taxonomy. Should move the slot from 0/N to 1/N.
  await addOwnedItem(page, {
    category: 'tops_and_bodysuits',
    itemType: 'bodysuits',
    size: '6-9M',
    brand: 'CoverageBrand',
  })

  // Back to Plan — assert at least one row now shows a non-zero left count.
  await page.goto('/plan')
  await expect(page.getByText(/loading/i)).not.toBeVisible({ timeout: 10000 })

  const nonZeroRow = page.getByText(/\b[1-9]\d* of \d+\b/)
  await expect(nonZeroRow.first()).toBeVisible({ timeout: 10000 })
})
