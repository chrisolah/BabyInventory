// Pass-along bag — draft creation + item attachment.
//
// Flow under test:
//   Sign up + onboard → add an item → ItemDetail "Pass on" →
//   draft batch is created → item gets pass_along_batch_id +
//   inventory_status='pass_along' → user lands on PassAlongBatch with
//   the item visible → reference_code rendered.
//
// We deliberately stop short of the bag-request flow itself (which
// collects a shipping address and writes concierge_tasks). Those code
// paths involve address collection and per-destination UI that's noisy
// to assert against; the data shape changes least at the draft layer
// and that's where most regressions would surface anyway.
//
// What this test guards against:
//   - find-or-create logic in ItemDetail.handleSendOn (the single-draft
//     rule from project_single_draft_bag_rule).
//   - inventory_status flip + pre_bag_inventory_status capture (migration
//     022 — pre_bag_origin_tracking).
//   - reference_code generation on pass_along_batches insert.
//   - PassAlongBatch render of an item just attached.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import {
  freshEmail,
  signUpWithPassword,
  blastThroughOnboardingToHome,
  addOwnedItem,
} from './support/helpers.js'

test('pass-along: ItemDetail "Pass on" creates a draft and attaches the item', async ({ page }) => {
  const email = freshEmail()

  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Bag E2E', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Bag Household' })

  // Add an item we can target by brand (the row's displayed primary
  // string). itemType is a slot id from src/lib/wardrobe.js.
  await addOwnedItem(page, {
    itemType: 'bodysuits',
    size: '6-9M',
    brand: 'PassAlongBrand',
  })

  // Click into the item from /inventory. We target the unique brand text.
  await expect(page.getByText(/PassAlongBrand/)).toBeVisible()
  await page.getByText(/PassAlongBrand/).click()
  await expect(page).toHaveURL(/\/item\//)

  // Trigger "Pass on" from ItemDetail. Button label is "Pass on" (verified
  // in ItemDetail.jsx). The handler creates-or-finds a draft batch and
  // navigates to /pass-along/:id.
  await page.getByRole('button', { name: /^pass on$/i }).click()
  await expect(page).toHaveURL(/\/pass-along\/[0-9a-f-]+/, { timeout: 10000 })

  // The newly-attached item should be visible inside "Items in the bag".
  await expect(page.getByText(/items in the bag/i)).toBeVisible()
  await expect(page.getByText(/PassAlongBrand/)).toBeVisible()

  // ── Service-role assertions on the data ──────────────────────────────
  // Find the household this user belongs to so we can scope queries.
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = users.users.find(x => x.email?.toLowerCase() === email.toLowerCase())
  expect(u).toBeTruthy()

  const { data: memberships } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', u.id)
  expect(memberships?.length).toBe(1)
  const householdId = memberships[0].household_id

  const { data: batches, error: bErr } = await admin
    .from('pass_along_batches')
    .select('id, status, destination_type, reference_code, household_id')
    .eq('household_id', householdId)
  expect(bErr).toBeNull()
  expect(batches?.length, 'expected exactly one draft batch').toBe(1)
  const batch = batches[0]
  expect(batch.status).toBe('draft')
  expect(batch.destination_type).toBe('family') // ItemDetail.handleSendOn defaults
  expect(batch.reference_code, 'reference_code must be auto-generated').toBeTruthy()

  // The item should now be linked to the batch with inventory_status='pass_along'
  // and pre_bag_inventory_status capturing its prior 'owned' state (so removing
  // it from the bag later restores it correctly — migration 022).
  const { data: items } = await admin
    .from('clothing_items')
    .select('id, inventory_status, pass_along_batch_id, pre_bag_inventory_status, item_type')
    .eq('household_id', householdId)
  expect(items?.length).toBe(1)
  const item = items[0]
  expect(item.inventory_status).toBe('pass_along')
  expect(item.pass_along_batch_id).toBe(batch.id)
  expect(item.pre_bag_inventory_status).toBe('owned')
})

test('pass-along: starting a second item from ItemDetail joins the SAME draft (single-draft rule)', async ({ page }) => {
  const email = freshEmail()

  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Single Draft', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Single Draft HH' })

  // Add two items, distinguished by unique brand strings (no name field
  // exists, so brand is the user-controlled row identifier).
  await addOwnedItem(page, { itemType: 'bodysuits', size: '6-9M', brand: 'FirstBrand' })
  await page.goto('/inventory')
  await addOwnedItem(page, { itemType: 'bodysuits', size: '6-9M', brand: 'SecondBrand' })

  // Pass on the first.
  await page.goto('/inventory')
  await page.getByText(/FirstBrand/).first().click()
  await page.getByRole('button', { name: /^pass on$/i }).click()
  await expect(page).toHaveURL(/\/pass-along\/[0-9a-f-]+/)
  const firstBatchUrl = page.url()

  // Pass on the second.
  await page.goto('/inventory')
  await page.getByText(/SecondBrand/).first().click()
  await page.getByRole('button', { name: /^pass on$/i }).click()
  await expect(page).toHaveURL(/\/pass-along\/[0-9a-f-]+/)

  // Same URL = same batch — the single-draft rule held.
  expect(page.url()).toBe(firstBatchUrl)

  // Both items should now be in the bag.
  await expect(page.getByText(/FirstBrand/)).toBeVisible()
  await expect(page.getByText(/SecondBrand/)).toBeVisible()

  // And the data should show one batch with two items.
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const u = users.users.find(x => x.email?.toLowerCase() === email.toLowerCase())
  const { data: memberships } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', u.id)
  const householdId = memberships[0].household_id

  const { data: batches } = await admin
    .from('pass_along_batches')
    .select('id, status')
    .eq('household_id', householdId)
  expect(batches?.length, 'should still be exactly one draft batch').toBe(1)
  expect(batches[0].status).toBe('draft')

  const { data: bagItems } = await admin
    .from('clothing_items')
    .select('id, inventory_status, pass_along_batch_id')
    .eq('household_id', householdId)
    .eq('inventory_status', 'pass_along')
  expect(bagItems?.length, 'both items should be in the bag').toBe(2)
  expect(bagItems.every(i => i.pass_along_batch_id === batches[0].id)).toBe(true)
})
