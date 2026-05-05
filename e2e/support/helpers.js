// Shared e2e helpers. Keep these focused on the *flow*, not on every assertion
// — specs should still own the assertions that matter to them. The goal is
// readable specs, not a framework.
//
// Two patterns to be aware of:
//   1. Selectors target placeholder/role/heading rather than CSS classes,
//      because the app uses CSS Modules and class names are hash-mangled
//      at build time. The few class targets we DO use are the marketing
//      footer's stable wordmark + nav role.
//   2. We never sleep — Playwright's auto-waiting handles 99% of timing.
//      The exception is networkidle on signup post-redirect, which we
//      keep minimal.

import { expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

/**
 * Generate a fresh @littleloop-e2e.test email per call. globalSetup wipes
 * auth.users between runs, but a fresh address per test still adds belt-
 * and-braces against partially-failed prior runs and against running the
 * same test in re-record mode without a wipe in between.
 */
export function freshEmail() {
  return `e2e-${randomUUID().slice(0, 8)}@littleloop-e2e.test`
}

/**
 * Stable test password used everywhere. Long enough to satisfy the 8-char
 * floor in Signup.jsx + UpgradeAccountModal.jsx; not anywhere near sensitive.
 */
export const TEST_PASSWORD = 'correct-horse-battery-staple'

/**
 * Fill the signup form and submit. Assumes the page is already on /signup
 * (caller does the goto). Default method is password — the magic-link
 * variant is exercised in login.spec.js explicitly. Stops at submit; doesn't
 * assert on the post-signup destination because callers want to chain into
 * onboarding from the same step without an extra await.
 */
export async function signUpWithPassword(page, { name, email, password = TEST_PASSWORD }) {
  await page.getByPlaceholder('Sarah Johnson').fill(name)
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByPlaceholder('At least 8 characters').fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
}

/**
 * Fill the login form (password method) and submit. Same goto-first contract
 * as signUpWithPassword.
 */
export async function logInWithPassword(page, { email, password = TEST_PASSWORD }) {
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByPlaceholder('Your password').fill(password)
  await page.getByRole('button', { name: /^log in$/i }).click()
}

/**
 * Sign out from any authed surface. ProfileMenu's logout sits behind a
 * profile-icon trigger, so we navigate to /profile?tab=account where the
 * Sign-out button is rendered inline — more stable than chasing the menu
 * popover across viewports.
 */
export async function signOutFromProfile(page) {
  await page.goto('/profile?tab=account')
  await page.getByRole('button', { name: /sign out/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

/**
 * Walk the 5 onboarding steps with default values, ending on /home.
 *
 * Steps + selectors mirror onboarding-happy-path.spec.js — keep this in
 * sync if onboarding's structure changes.
 *
 * `babyDob` defaults to a date that puts the baby in the 6-9M size band
 * relative to "today" — Inventory filters items by the baby's current age
 * band, and addOwnedItem defaults to size '6-9M'. If the DOB and the item
 * size don't agree, the item is saved correctly but doesn't show on the
 * default Inventory tab and assertions like `getByText(brand)` time out.
 *
 * 2025-10-15 → ~6.5–7 months on test runs through mid-2026 → 6-9M band.
 * Roll forward when this code is being run after late 2026.
 */
export async function blastThroughOnboardingToHome(page, opts = {}) {
  const householdName = opts.householdName ?? 'E2E Household'
  const babyName = opts.babyName ?? 'E2E Baby'
  const babyDob = opts.babyDob ?? '2025-10-15'

  await expect(page).toHaveURL(/\/onboarding/)

  // Household. Wait for the heading first so the React tree is mounted —
  // a fresh signup can land on /onboarding fractionally before the first
  // step has rendered.
  await expect(page.getByRole('heading', { name: /name your household/i })).toBeVisible()
  await page.getByPlaceholder('The Johnson Family').fill(householdName)
  await page.getByRole('button', { name: /^continue$/i }).click()

  // Baby
  await expect(page.getByRole('heading', { name: /tell us about your baby/i })).toBeVisible()
  await page.getByPlaceholder('Lily').fill(babyName)
  await page.locator('input[type="date"]').fill(babyDob)
  await page.getByRole('button', { name: /^continue$/i }).click()

  // Receiving opt-in (toggle defaults off → button reads "Not right now")
  await expect(page.getByRole('heading', { name: /open to receiving/i })).toBeVisible()
  await page.getByRole('button', { name: /^(not right now|continue)$/i }).click()

  // Invite. Heading-wait barrier is critical here: without it, Playwright's
  // auto-wait on the next "skip for now" button can race the receiving→invite
  // navigation and time out matching against a stale tree. (This was the
  // 13-of-15 failure mode on the first run of the new specs — root cause
  // documented for whoever debugs the next step-reorder.)
  await expect(page.getByRole('heading', { name: /invite a family member/i })).toBeVisible()
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Photo-scan trial — same race, same barrier.
  await expect(page.getByRole('heading', { name: /try the photo-scan/i })).toBeVisible()
  await page.getByRole('button', { name: /skip for now/i }).click()

  // Done splash → /home
  await expect(page.getByRole('button', { name: /go to my inventory/i })).toBeVisible()
  await page.getByRole('button', { name: /go to my inventory/i }).click()
  await expect(page).toHaveURL(/\/home/)
}

/**
 * Add a single owned clothing item via /add-item. Returns nothing; assert
 * on inventory in the calling spec.
 *
 * Type was redesigned from a free-text input to a slot-id <select>, so
 * `itemType` must be a slot id from src/lib/wardrobe.js (e.g. 'bodysuits',
 * 'pajamas', 'pants_leggings'), NOT free text. The form gates Type on a
 * Category selection, so we set Category first.
 *
 * Tests can't assert on a "name" field — there isn't one in the form.
 * The Inventory rows display name → brand → slot.singular as the visible
 * row title, in that fallback order. Since name doesn't exist, brand IS
 * the user-controlled identifier — use a unique brand string per item
 * when a test needs to distinguish multiple rows.
 */
export async function addOwnedItem(page, opts = {}) {
  const category = opts.category ?? 'tops_and_bodysuits'
  const itemType = opts.itemType ?? 'bodysuits'
  const size = opts.size ?? '6-9M'
  const condition = opts.condition ?? 'like_new'
  const brand = opts.brand ?? 'H&M'

  await page.goto('/add-item')
  await expect(page.getByText(/add an item/i)).toBeVisible()

  await page.getByLabel(/category/i).selectOption(category)
  await page.getByLabel(/^type$/i).selectOption(itemType)
  await page.getByLabel(/^size$/i).selectOption(size)
  await page.getByLabel(/condition/i).selectOption(condition)
  if (brand) await page.getByPlaceholder(/carter's/i).fill(brand)

  await page.getByRole('button', { name: /^save item$/i }).click()
  await expect(page).toHaveURL(/\/inventory/)
}
