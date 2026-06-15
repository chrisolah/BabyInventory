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
  // Each step gets a heading-visible barrier before the click on the next
  // affordance. Without it, Playwright's auto-wait on a button query races
  // the navigation and times out (this exact race bit the suite when the
  // helpers spec first landed — see e2e/support/helpers.js for the writeup).
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByRole('heading', { name: /name your household/i })).toBeVisible()
  await page.getByPlaceholder('The Johnson Family').fill('AddItem Household')
  await page.getByRole('button', { name: /^continue$/i }).click()

  await expect(page.getByRole('heading', { name: /tell us about your baby/i })).toBeVisible()
  await page.getByPlaceholder('Lily').fill('Nora')
  // DOB places the baby in the 6-9M age band relative to mid-2026 runs,
  // matching the size '6-9M' we add below. Inventory filters by current
  // age band; mismatched bands hide the saved item from the default tab.
  await page.locator('input[type="date"]').fill('2025-10-15')
  await page.getByRole('button', { name: /^continue$/i }).click()

  // Receiving step (added 2026-04-25 mom-interview round). Toggle defaults
  // off, so the advance button reads "Not right now". If the default ever
  // flips, the button reads "Continue" — match loosely.
  await expect(page.getByRole('heading', { name: /open to receiving/i })).toBeVisible()
  await page.getByRole('button', { name: /^(not right now|continue)$/i }).click()

  // Invite step.
  await expect(page.getByRole('heading', { name: /invite a family member/i })).toBeVisible()
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Scan step (added 2026-04-25 onboarding scan exposure). Skip with the
  // same skip-link pattern as invite.
  await expect(page.getByRole('heading', { name: /try the photo-scan/i })).toBeVisible()
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Done screen.
  await expect(page.getByRole('button', { name: /go to my inventory/i })).toBeVisible()
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
  // Type is now a slot-id <select>, not a free-text input. 'bodysuits' is
  // the slot id for the "Bodysuits" entry in src/lib/wardrobe.js (matches
  // the historic "long sleeve onesie" intent of this test). The placeholder
  // pattern on the brand input (Carter's, …) is still text-input.
  await page.getByLabel(/category/i).selectOption('tops_and_bodysuits')
  await page.getByLabel(/^type$/i).selectOption('bodysuits')
  await page.getByLabel(/^size$/i).selectOption('6-9M')
  await page.getByLabel(/condition/i).selectOption('like_new')

  // Brand is the user-controlled identifier (no name field exists in the
  // form), so we use a value we can assert on uniquely.
  await page.getByPlaceholder(/carter's/i).fill('H&M')

  await page.getByRole('button', { name: /^save item$/i }).click()

  // ── Lands back on /inventory with the new item visible ──────────────────
  await expect(page).toHaveURL(/\/inventory/)

  // Inventory ItemRow displays brand as the row title (when no `name` field
  // was filled). The brand "H&M" is unique on the page; a /6-9M/ assertion
  // collides with the age chip, the thumbnail label, and the "+ Add item
  // in 6-9M" CTA, so we drop it — the brand match is sufficient proof.
  await expect(page.getByText(/H&M/)).toBeVisible()
})
