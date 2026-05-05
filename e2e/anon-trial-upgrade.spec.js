// Anonymous trial → permanent account upgrade, end-to-end.
//
// Flow under test:
//   Landing → Try Sprigloop free → anon Supabase session → /onboarding →
//   /home → tap TrialBanner → UpgradeAccountModal opens → fill name + email
//   + password → submit → permanent account inherits the trial UID + data.
//
// Why this matters pre-launch:
//   - The pre-signup trial path is the primary on-ramp now (per
//     project_anonymous_trial_signup memory). Nothing else in the suite
//     covers it end-to-end.
//   - Today's change added a name field to UpgradeAccountModal so trial-
//     converted users have a greeting name in raw_user_meta_data before
//     the welcome email fires. We assert that.
//   - terms_accepted_at is written via the same updateUser({ data }) call
//     and we assert that too — it's the consent paper trail and easy to
//     accidentally drop.

import { test, expect } from '@playwright/test'
import { admin } from './support/db.js'
import { freshEmail, TEST_PASSWORD, blastThroughOnboardingToHome } from './support/helpers.js'

test('anon trial → upgrade modal sets name + terms_accepted_at on the same auth row', async ({ page }) => {
  const email = freshEmail()
  const userName = 'Trial Upgrader'

  // 1. Landing → "Try Sprigloop free" → anon session → /onboarding.
  // Landing.jsx falls back to /signup if the anonymous-sign-in API call
  // returns 422 anonymous_provider_disabled. When that happens the entire
  // pre-signup trial path is unreachable and there's nothing meaningful to
  // assert here, so we skip with a loud message rather than fail. To run
  // this test, enable Auth → Providers → Anonymous Sign-Ins in the
  // Supabase project that VITE_SUPABASE_URL points at.
  await page.goto('/')
  await page.getByRole('button', { name: /try sprigloop free/i }).first().click()
  await expect(page).toHaveURL(/\/(onboarding|signup)/)
  if (page.url().includes('/signup')) {
    test.skip(
      true,
      'Anonymous Sign-Ins disabled on the target Supabase project — Try CTA fell ' +
      'back to /signup. Enable Auth → Providers → Anonymous Sign-Ins to run this test.'
    )
    return
  }

  // 2. Walk onboarding to /home (anon users can complete onboarding — it
  //    populates households + babies under the trial UID, which carries
  //    forward post-upgrade).
  await blastThroughOnboardingToHome(page, {
    householdName: 'Trial Household',
    babyName: 'Trial Baby',
  })

  // Capture the trial UID before the upgrade so we can confirm it's
  // preserved end-to-end (no data migration on conversion). The trial
  // user's email is null/empty, so we list anonymous users and pick the
  // most recent — the suite is single-worker so there's no race.
  const { data: preUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  const trialUser = preUsers.users.find(u => u.is_anonymous)
  expect(trialUser, 'expected one anonymous user after Try CTA').toBeTruthy()
  const trialUid = trialUser.id

  // 3. Tap the TrialBanner — this opens the upgrade modal directly via
  //    UpgradeGateContext.triggerUpgrade. The aria-label is the most
  //    stable selector here ("Save your wardrobe by creating an account").
  await page.getByRole('button', { name: /save your wardrobe/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // 4. Fill the three fields + submit. Today's name field is at the top.
  //    Inputs target by id; both the modal and the form labels use those.
  await page.locator('#upgrade-name').fill(userName)
  await page.locator('#upgrade-email').fill(email)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)

  // The notice text should be visible above the buttons (browsewrap pattern).
  await expect(page.getByText(/by creating your account, you agree/i)).toBeVisible()

  await page.getByRole('button', { name: /^create account$/i }).click()

  // Modal closes; AuthProvider picks up is_anonymous=false. UpgradeGate
  // resolves the deferred action (which was a no-op for triggerUpgrade
  // — see UpgradeGateContext.triggerUpgrade), so we stay put on /home.
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 })

  // 5. The TrialBanner self-unmounts when isAnonymous flips to false.
  //    A successful conversion means the banner is gone.
  await expect(page.getByRole('button', { name: /save your wardrobe/i })).toHaveCount(0)

  // 6. Verify on the back end: same auth.users row (UID preserved), now
  //    with email set, is_anonymous false, name + terms_accepted_at on
  //    raw_user_meta_data.
  const { data: postUser, error: postErr } = await admin.auth.admin.getUserById(trialUid)
  expect(postErr).toBeNull()
  expect(postUser?.user?.id).toBe(trialUid)
  expect(postUser?.user?.email?.toLowerCase()).toBe(email.toLowerCase())
  expect(postUser?.user?.is_anonymous).toBeFalsy()

  const meta = postUser?.user?.user_metadata ?? {}
  expect(meta.name).toBe(userName)
  expect(meta.terms_accepted_at, 'terms_accepted_at must be stamped on upgrade').toBeTruthy()

  // terms_accepted_at must be parseable as a recent ISO timestamp.
  const stamped = new Date(meta.terms_accepted_at)
  expect(Number.isNaN(stamped.getTime())).toBe(false)
  expect(Date.now() - stamped.getTime()).toBeLessThan(5 * 60 * 1000) // within 5 min
})
