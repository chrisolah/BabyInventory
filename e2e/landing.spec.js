import { test, expect } from '@playwright/test'

// Landing copy + CTA wiring smoke.
//
// Updated 2026-06-03 after Option C redesign:
//   - Hero rewritten with problem-first copy
//   - Secondary CTA changed from "See how pass-along works" to "See how it works"
//   - Hub section headline changed to "When they outgrow it, we take it from there."
//   - "Guides" nav link added alongside "How it works"
//
// Current truth is in src/screens/Landing.jsx.

test.describe('landing page', () => {
  test('loads and shows primary CTA', async ({ page }) => {
    await page.goto('/')
    // Multiple "Try Sprigloop free" buttons across the page; .first() pins
    // to the hero one without enumerating all of them.
    await expect(
      page.getByRole('button', { name: 'Try Sprigloop free' }).first()
    ).toBeVisible()
  })

  test('shows secondary "See how it works" CTA', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: 'See how it works' })
    ).toBeVisible()
  })

  test('hero headline contains the new problem-first copy', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { level: 1 })
    ).toContainText(/nobody prepares for/i)
  })

  test('primary CTA starts the trial flow', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Try Sprigloop free' }).first().click()
    // Two valid landings depending on Supabase project config:
    //   /onboarding — anon-sign-in succeeded (happy path)
    //   /signup     — anon-sign-in returned 422 anonymous_provider_disabled
    await expect(page).toHaveURL(/\/(onboarding|signup)/)
  })

  test('secondary CTA scrolls to pass-along section', async ({ page }) => {
    await page.goto('/')
    // Hub section heading as of Option C redesign.
    const hubHeadline = page.getByRole('heading', {
      name: /when they outgrow it/i,
    })
    await page.getByRole('button', { name: 'See how it works' }).click()
    await expect(hubHeadline).toBeInViewport()
  })

  test('nav shows How it works and Guides links', async ({ page }) => {
    await page.goto('/')
    // Use exact: true — the hero also has "See how it works" which would
    // cause a strict-mode violation with a loose regex match.
    await expect(page.getByRole('button', { name: 'How it works', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guides', exact: true })).toBeVisible()
  })

  test('nav Guides link navigates to /guides', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Guides', exact: true }).click()
    await expect(page).toHaveURL(/\/guides/)
  })

  test('nav How it works link navigates to /how-it-works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'How it works', exact: true }).click()
    await expect(page).toHaveURL(/\/how-it-works/)
  })
})
