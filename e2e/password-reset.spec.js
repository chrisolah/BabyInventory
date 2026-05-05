// Password reset, end-to-end.
//
// Flow under test:
//   /login → "Forgot password?" → /reset-password (code entry) →
//   verifyOtp({type:'recovery'}) → set new password → /login → sign in
//   with the new password.
//
// Why this matters pre-launch: the recovery code-entry route was moved to
// /reset-password specifically to dodge a navigate race against PublicRoute
// (see feedback_recovery_codeentry_route in memory). If that race ever
// re-introduces itself, the "after verify, choose new password" step
// silently bounces the user to /home with a recovery session that lets
// them past the gate without ever setting a new password — a hard-to-spot
// auth bug. This test guards against that regression.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import {
  freshEmail,
  TEST_PASSWORD,
  signUpWithPassword,
  logInWithPassword,
  signOutFromProfile,
  blastThroughOnboardingToHome,
} from './support/helpers.js'

test('password reset: signup → forgot → verify code → new password → sign in works', async ({ page }) => {
  const email = freshEmail()
  const newPassword = 'fresh-test-pass-2026'

  // 1. Create the account + onboard so there's an established password to overwrite.
  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Reset E2E', email })
  await blastThroughOnboardingToHome(page)
  await signOutFromProfile(page)

  // 2. Initiate the reset from /login → "Forgot password?".
  await page.goto('/login')
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByRole('button', { name: /forgot password\?/i }).click()

  // The app navigates to /reset-password?email=… and the code-entry step
  // is what we want to be on. Email pre-fills via URL state and isn't
  // re-rendered as an input (initialEmail truthy → field hidden).
  await expect(page).toHaveURL(/\/reset-password/)
  await expect(page.getByRole('heading', { name: /enter your reset code/i })).toBeVisible()

  // 3. Mint a recovery OTP via service role. Mirrors the magic-link pattern
  //    in login.spec but with type:'recovery' to satisfy
  //    verifyOtp({type:'recovery'}) on the screen.
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })
  expect(linkErr).toBeNull()
  const otp = link?.properties?.email_otp
  expect(otp).toBeTruthy()

  await page.getByPlaceholder('123456').fill(otp)
  await page.getByRole('button', { name: /^continue$/i }).click()

  // 4. New-password step. The headline shifts to "Choose a new password".
  await expect(page.getByRole('heading', { name: /choose a new password/i })).toBeVisible()
  await page.getByPlaceholder('At least 8 characters').fill(newPassword)
  await page.getByPlaceholder(/re-enter your new password/i).fill(newPassword)
  await page.getByRole('button', { name: /update password/i }).click()

  // 5. Done splash → "Go to log in" → sign in with the NEW password.
  await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible()
  await page.getByRole('button', { name: /go to log in/i }).click()
  await expect(page).toHaveURL(/\/login/)

  await logInWithPassword(page, { email, password: newPassword })
  await expect(page).toHaveURL(/\/home/)

  // 6. Belt-and-braces: the OLD password should no longer work.
  //    (We sign out, then try the old credentials and assert on the error.)
  await signOutFromProfile(page)
  await page.goto('/login')
  await page.getByPlaceholder('sarah@example.com').fill(email)
  await page.getByPlaceholder('Your password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: /^log in$/i }).click()
  await expect(page.getByText(/invalid/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})
