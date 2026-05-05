// Consent paper trail.
//
// Sprigloop uses browsewrap-with-notice on /signup ("By creating your
// account, you agree to..."). The act of submitting writes a
// `terms_accepted_at` ISO timestamp into auth.users.raw_user_meta_data
// — that's the durable record of when consent happened. If the metadata
// write silently stops (e.g. someone refactors getMetadata in Signup.jsx),
// we lose every future user's consent evidence and won't notice.
//
// This spec covers the /signup path; the anon-trial-upgrade spec covers
// the modal-conversion path. Both must stamp the field.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import { freshEmail, signUpWithPassword } from './support/helpers.js'

test('signup writes terms_accepted_at to raw_user_meta_data', async ({ page }) => {
  const email = freshEmail()
  const userName = 'Consent Stamper'

  await page.goto('/signup')

  // Sanity-check the notice is rendered above the submit affordance — if
  // the notice text disappears for any reason, the consent claim is
  // untenable even though the metadata write would still happen.
  await expect(page.getByText(/by creating your account, you agree/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible()

  await signUpWithPassword(page, { name: userName, email })
  await expect(page).toHaveURL(/\/onboarding/)

  // Service-role lookup: find the user we just created and assert on
  // their metadata. listUsers is paginated; with the suite running
  // single-worker after a wipe, the user count is small and fits well
  // under perPage=50.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  expect(error).toBeNull()
  const created = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
  expect(created, `expected to find ${email} in auth.users`).toBeTruthy()

  const meta = created.user_metadata ?? {}
  expect(meta.name).toBe(userName)
  expect(meta.terms_accepted_at, 'terms_accepted_at must be stamped at signup').toBeTruthy()

  // The stamp must be a parseable, recent ISO timestamp — not something
  // misshaped that ends up "truthy but useless" in an audit.
  const stamped = new Date(meta.terms_accepted_at)
  expect(Number.isNaN(stamped.getTime())).toBe(false)
  expect(Date.now() - stamped.getTime()).toBeLessThan(5 * 60 * 1000) // within 5 min
})
