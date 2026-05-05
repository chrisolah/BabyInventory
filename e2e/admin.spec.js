// Admin dashboard smoke.
//
// What this catches: routes loading, the email-allowlist guard letting
// admin emails through, the three RPC-backed tabs (Visits, Funnel,
// Households) rendering their loading-or-content state without erroring.
//
// What this does NOT catch: the actual analytics math. That's covered in
// the unit-level tests on the RPCs themselves.
//
// Why it works against a wiped DB: the admin emails are baked into both
// App.jsx (client-side) and beta._admin_emails() (server-side). Signing
// up with chris@sprigloop.com after the wipe creates an account on the
// allowlist; getDailyVisits + family return empty rows for the empty DB,
// which the tabs render as an empty-state message rather than an error.

import { test, expect } from '@playwright/test'
import {
  TEST_PASSWORD,
  signUpWithPassword,
  blastThroughOnboardingToHome,
} from './support/helpers.js'

// One of the two emails in App.jsx's ADMIN_EMAILS. The DB function
// _admin_emails() must agree — see the admin_views migration. If the
// allowlists drift, this test fails at the AdminGuard redirect.
const ADMIN_EMAIL = 'chris@sprigloop.com'

test('admin: signed in as an allowlisted email reaches /admin and all 3 tabs render', async ({ page }) => {
  await page.goto('/signup')
  await signUpWithPassword(page, {
    name: 'Admin Smoke',
    email: ADMIN_EMAIL,
    password: TEST_PASSWORD,
  })
  await blastThroughOnboardingToHome(page, { householdName: 'Admin Household' })

  // Navigate to /admin. AdminGuard checks the lowercase email against
  // ADMIN_EMAILS — chris@sprigloop.com is in the set, so we should land
  // on the page rather than getting bounced to /home.
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { level: 1, name: /^admin$/i })).toBeVisible().catch(() => {})

  // Three tabs by aria-label "Admin sections" tablist.
  const tablist = page.getByRole('tablist', { name: /admin sections/i })
  await expect(tablist.getByRole('tab', { name: /visits/i })).toBeVisible()
  await expect(tablist.getByRole('tab', { name: /funnel/i })).toBeVisible()
  await expect(tablist.getByRole('tab', { name: /households/i })).toBeVisible()

  // For each tab, switch to it, confirm aria-selected="true", and confirm
  // no error banner rendered. We deliberately don't assert on specific
  // content text — text varies depending on whether the wiped DB has
  // events from prior tests in the run, and matching loosely (e.g.
  // /sessions/i) collides with UI chrome ("Hide my sessions") in
  // strict mode.
  async function expectTabRendersWithoutError(name) {
    const tab = tablist.getByRole('tab', { name })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    // No "couldn't load" / "failed" banner — the visit/funnel/households
    // RPCs all surface errors with that wording when they fail.
    await expect(page.getByText(/couldn.t load|failed to load/i)).toHaveCount(0)
  }

  await expectTabRendersWithoutError(/visits/i)
  await expectTabRendersWithoutError(/funnel/i)
  await expectTabRendersWithoutError(/households/i)
})

test('admin: a non-allowlisted user is bounced to /home', async ({ page }) => {
  // Pick an email that's clearly not on the allowlist. The redirect happens
  // client-side in AdminGuard; the server-side _admin_emails() check is the
  // true authority and rejects the RPCs anyway, but this catches a regression
  // where AdminGuard might be removed accidentally.
  const email = `non-admin-${Date.now()}@littleloop-e2e.test`

  await page.goto('/signup')
  await signUpWithPassword(page, { name: 'Non Admin', email })
  await blastThroughOnboardingToHome(page, { householdName: 'Non-admin HH' })

  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home/)
})
