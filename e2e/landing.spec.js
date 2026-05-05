import { test, expect } from '@playwright/test'

// Landing copy + CTA wiring smoke. Updated 2026-05-04 after the landing
// went through several rewrites that drifted the previous "Get started
// free" / "Have clothes to pass on?" anchors out from under us. Current
// truth is in src/screens/Landing.jsx — primary CTA reads "Try Sprigloop
// free", secondary scrolls to the pass-along hub.

test.describe('landing page', () => {
  test('loads and shows primary CTA', async ({ page }) => {
    await page.goto('/')
    // Multiple "Try Sprigloop free" buttons render across the page
    // (hero, hub, mission, final). The hero one is first; .first() pins
    // the assertion to that without forcing the test to know about the
    // others.
    await expect(
      page.getByRole('button', { name: 'Try Sprigloop free' }).first()
    ).toBeVisible()
  })

  test('shows supply-side CTA', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'See how pass-along works' })
    ).toBeVisible()
  })

  test('primary CTA starts the trial flow', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try Sprigloop free' }).first().click()
    // Two valid landings depending on Supabase project config:
    //   /onboarding — anon-sign-in succeeded (the happy path)
    //   /signup     — anon-sign-in returned 422 anonymous_provider_disabled
    //                 and Landing.jsx fell back to /signup
    // Both reflect correct app behavior; the toggle is a project-level
    // setting, not a code path. Accept either so the test stays green
    // across re-init / config drift.
    await expect(page).toHaveURL(/\/(onboarding|signup)/)
  })

  test('supply CTA scrolls to pass-along hub section', async ({ page }) => {
    await page.goto('/')
    // The hub section uses a CSS-Modules class (compiled to a hashed
    // name), so we can't target a stable class selector. Anchor on the
    // section's headline text instead — "Three places your outgrown
    // clothes can go." is unique on the page.
    const hubHeadline = page.getByRole('heading', {
      name: /three places your outgrown/i,
    })
    await page.getByRole('button', { name: 'See how pass-along works' }).click()
    await expect(hubHeadline).toBeInViewport()
  })
})
