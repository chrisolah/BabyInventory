// Happy-path smoke test: signup → all 4 onboarding steps → lands on /home.
//
// This is the flow that burned most of the 2026-04-20 debug session — it
// covers households RLS, user_activity_summary trigger, babies insert +
// update, size_mode constraint/default. If any of those regress, this test
// fails before a user hits it.
//
// We don't test copy/layout here — only that each step advances the state
// machine and that the app ends up at /home.

import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

// Fresh email per run. If globalSetup already wiped auth.users this isn't
// strictly needed, but it also guards against re-running the test against a
// DB somebody forgot to wipe.
function freshEmail() {
  return `e2e-${randomUUID().slice(0, 8)}@littleloop-e2e.test`
}

test('signup + full onboarding lands user on /home', async ({ page }) => {
  const email = freshEmail()
  const password = 'correct-horse-battery-staple'

  // ── Signup ──────────────────────────────────────────────────────────────
  await page.goto('/signup')
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible()

  // Labels aren't htmlFor-linked in Signup.jsx, so we target by placeholder.
  await page.getByPlaceholder('Sarah Johnson').fill('E2E Tester')
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByPlaceholder('At least 8 characters').fill(password)
  await page.getByRole('button', { name: /create account/i }).click()

  // ── Step 1: household ───────────────────────────────────────────────────
  await expect(page).toHaveURL(/\/onboarding/)
  await expect(page.getByRole('heading', { name: /name your household/i })).toBeVisible()

  await page.getByPlaceholder('The Johnson Family').fill('E2E Household')
  await page.getByRole('button', { name: /^continue$/i }).click()

  // ── Step 2: baby ────────────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: /tell us about your baby/i })).toBeVisible()

  await page.getByPlaceholder('Lily').fill('E2E Baby')
  // 'Already born' is the default, no need to click — but fill the date.
  // A stable past date avoids any "date in the future" validation later.
  await page.locator('input[type="date"]').fill('2025-06-15')
  await page.getByRole('button', { name: /^continue$/i }).click()

  // ── Step 3: size mode ───────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: /how do you think about sizes/i })).toBeVisible()

  // Each card is a <button>. "By age" is distinct enough to match exactly.
  await page.getByRole('button', { name: /by age/i }).click()

  // ── Step 4: invite ──────────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: /invite a family member/i })).toBeVisible()
  await page.getByRole('button', { name: /skip for now/i }).click()

  // ── Done screen + navigate to /home ─────────────────────────────────────
  await expect(page.getByRole('button', { name: /go to my inventory/i })).toBeVisible()
  await page.getByRole('button', { name: /go to my inventory/i }).click()

  await expect(page).toHaveURL(/\/home/)
})
