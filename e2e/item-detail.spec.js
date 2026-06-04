// ItemDetail actions — edit, tuck-away, move-back-to-owned, delete.
//
// Flow under test:
//   Signup + onboard + add an item, then exercise each ItemDetail action
//   in turn:
//     1. Edit (re-uses /add-item in edit mode)
//     2. Tuck away → inventory_status flips to 'kept'
//     3. Move back to Owned → flips 'kept' back to 'owned'
//     4. Delete → row is gone
//
// Pass on is covered separately in pass-along-bag.spec.js — leaving it
// out here so this spec stays focused on the lifecycle that doesn't
// involve cross-table writes.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import {
  freshEmail,
  signUpWithPassword,
  blastThroughOnboardingToHome,
  addOwnedItem,
} from './support/helpers.js'

// Find the household for a user we just created. Returns the id.
// Supabase admin listUsers caps at 50 per page regardless of perPage param.
// Paginate until we find the email or exhaust all pages.
async function findUserByEmail(email) {
  let page = 1
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 50 })
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 50) return null
    page++
  }
}

async function householdIdFor(email) {
  const u = await findUserByEmail(email)
  expect(u, `expected user ${email}`).toBeTruthy()
  const { data: members } = await admin
    .from('household_members')
    .select('household_id')
    .eq('user_id', u.id)
  expect(members?.length).toBe(1)
  return members[0].household_id
}

test('item detail: edit an item, save, see updated values in inventory', async ({ page }) => {
  const email = freshEmail()
  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Edit E2E', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Edit Household' })

  await addOwnedItem(page, {
    itemType: 'bodysuits',
    size: '6-9M',
    brand: 'OldBrand',
  })

  // Open the item by its brand (no name field exists, brand is the row's
  // primary display string per buildItemDisplay). Then go into edit mode
  // (AddItem in edit mode reuses the same form). The page action button
  // is literally "Edit item" (not just "Edit") — anchored regex.
  await page.getByText(/OldBrand/).first().click()
  await expect(page).toHaveURL(/\/item\/[0-9a-f-]+/)
  await page.getByRole('button', { name: /^edit item$/i }).click()
  await expect(page).toHaveURL(/\/item\/[0-9a-f-]+\/edit/)

  // Change brand. The brand input is reachable via its placeholder.
  const brandInput = page.getByPlaceholder(/carter's/i)
  await brandInput.fill('NewBrand')
  // AddItem renders "Save item" on insert, "Save changes" in edit mode —
  // we're in edit mode here, so the button label is "Save changes". The
  // edit handler navigates back to the item detail page (/item/:id), not
  // /inventory like insert does. Verify the brand changed by navigating
  // to /inventory afterward.
  await page.getByRole('button', { name: /^save changes$/i }).click()
  await expect(page).toHaveURL(/\/item\/[0-9a-f-]+$/)

  await page.goto('/inventory')
  await expect(page.getByText(/NewBrand/)).toBeVisible()
  await expect(page.getByText(/OldBrand/)).toHaveCount(0)
})

test('item detail: Tuck away → Move back to Owned round trip', async ({ page }) => {
  const email = freshEmail()
  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Tuck E2E', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Tuck Household' })

  await addOwnedItem(page, { itemType: 'bodysuits', size: '6-9M', brand: 'TuckBrand' })

  // Open the item, then capture the URL so we can re-open it after each
  // action — Tuck away and Move back to Owned both navigate to /inventory
  // on success (handler design, see ItemDetail.handleTuckAway / handle-
  // ReturnToOwned). The button-swap-on-same-page model would only work
  // if those handlers stayed put.
  await page.getByText(/TuckBrand/).first().click()
  await expect(page).toHaveURL(/\/item\/[0-9a-f-]+/)
  const itemUrl = page.url()

  // Tuck away — navigates to /inventory.
  await page.getByRole('button', { name: /^tuck away$/i }).click()
  await expect(page).toHaveURL(/\/inventory/)

  // Verify status='kept' on the row via service role.
  const householdId = await householdIdFor(email)
  let { data: items } = await admin
    .from('clothing_items')
    .select('id, inventory_status, item_type')
    .eq('household_id', householdId)
  expect(items?.length).toBe(1)
  expect(items[0].inventory_status).toBe('kept')

  // Re-open the same item to exercise Move back. The action bar now shows
  // "Move back to Owned" instead of "Tuck away" because canReturnToOwned
  // is true for kept items.
  await page.goto(itemUrl)
  await expect(page.getByRole('button', { name: /move back to owned/i })).toBeVisible()
  await page.getByRole('button', { name: /move back to owned/i }).click()
  await expect(page).toHaveURL(/\/inventory/)

  ;({ data: items } = await admin
    .from('clothing_items')
    .select('id, inventory_status')
    .eq('household_id', householdId))
  expect(items[0].inventory_status).toBe('owned')
})

test('item detail: delete removes the row + lands on /inventory', async ({ page }) => {
  const email = freshEmail()
  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Delete E2E', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Delete Household' })

  await addOwnedItem(page, { itemType: 'bodysuits', size: '6-9M', brand: 'DeleteBrand' })

  await page.getByText(/DeleteBrand/).first().click()
  // Page action label is "Delete item" (not "Delete"); regex is anchored.
  await page.getByRole('button', { name: /^delete item$/i }).click()

  // Confirm modal opens. Both the page action and the modal confirm button
  // share the literal text "Delete item" (different buttons, same label).
  // The modal's confirm button is rendered last in the DOM so we use
  // .last() to disambiguate.
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /^delete item$/i }).last().click()

  await expect(page).toHaveURL(/\/inventory/, { timeout: 10000 })
  await expect(page.getByText(/DeleteBrand/)).toHaveCount(0)

  const householdId = await householdIdFor(email)
  const { data: items } = await admin
    .from('clothing_items')
    .select('id')
    .eq('household_id', householdId)
  expect(items?.length, 'item should be hard-deleted').toBe(0)
})
