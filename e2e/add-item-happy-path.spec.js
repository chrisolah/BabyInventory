// Happy-path: signup → full onboarding → add a clothing item → see it in inventory.
//
// This is the first e2e test that touches beta.clothing_items, so it's the
// regression guard for migration 006 (columns, check constraints, RLS insert
// policy, service_role grants). Same philosophy as onboarding-happy-path: we
// don't assert on copy or layout, only that the happy path completes.

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

function freshEmail() {
  return `e2e-${randomUUID().slice(0, 8)}@littleloop-e2e.test`
}

test('signup → onboard → add item → item appears in inventory', async ({ page }) => {
  const email = freshEmail()
  const password = 'correct-horse-battery-staple'

  // ── Signup ──────────────────────────────────────────────────────────────
  await page.goto('/signup')
  await page.getByPlaceholder('Sarah Johnson').fill('E2E AddItem')
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByPlaceholder('At least 8 characters').fill(password)
  await page.getByRole('button', { name: /create account/i }).click()

  // ── Blast through onboarding (same path as onboarding-happy-path) ───────
  await expect(page).toHaveURL(/\/onboarding/)
  await page.getByPlaceholder('The Johnson Family').fill('AddItem Household')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByPlaceholder('Lily').fill('Nora')
  await page.locator('input[type="date"]').fill('2025-06-15')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page.getByRole('button', { name: /by age/i }).click()

  await page.getByRole('button', { name: /skip for now/i }).click()
  await page.getByRole('button', { name: /go to my inventory/i }).click()

  // Now on /home — the empty-state card deep-links to /inventory.
  await expect(page).toHaveURL(/\/home/)
  await page.getByRole('button', { name: /start your inventory/i }).click()

  // ── Inventory: empty state, follow CTA to /add-item ─────────────────────
  await expect(page).toHaveURL(/\/inventory/)

  // Wait for the loading spinner to clear so we know the queries finished.
  // Then surface useful context if the empty-state CTA isn't there:
  // either the inventory errored out (likely migration 006 not applied) or
  // the page rendered something we don't expect.
  await expect(page.getByText(/loading…/i)).toHaveCount(0, { timeout: 10000 })

  const errorBanner = page.locator('text=/couldn.t load your inventory/i')
  if (await errorBanner.count()) {
    throw new Error(
      `/inventory rendered an error banner — most likely migration 006_clothing_items.sql ` +
      `is not applied to the test schema. Banner text: "${await errorBanner.first().innerText()}"`
    )
  }

  await page.getByRole('button', { name: /add first item/i }).click()

  // ── Add item form ──────────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/add-item/)
  await expect(page.getByText(/add an item/i)).toBeVisible()

  // Mode defaults to 'owned' — leave as-is.
  // Category, Type, Size, Condition are the required fields on this path.
  await page.getByLabel(/category/i).selectOption('tops_and_bodysuits')
  await page.getByPlaceholder(/long-sleeve onesie/i).fill('long sleeve onesie')
  await page.getByLabel(/^size$/i).selectOption('6-9M')
  await page.getByLabel(/condition/i).selectOption('like_new')

  // Optional: brand to give us a recognisable string to assert against.
  await page.getByPlaceholder(/carter's/i).fill('H&M')

  await page.getByRole('button', { name: /^save item$/i }).click()

  // ── Lands back on /inventory with the new item visible ──────────────────
  await expect(page).toHaveURL(/\/inventory/)

  // The ItemRow renders item_type humanised (snake_case → "Long sleeve onesie").
  await expect(page.getByText(/long sleeve onesie/i)).toBeVisible()
  // Meta line should include size and brand.
  await expect(page.getByText(/6-9M/)).toBeVisible()
  await expect(page.getByText(/H&M/)).toBeVisible()
})
