// Static legal-page smoke. Cheap insurance against a footer link breaking,
// a route disappearing, or a CSS module not getting bundled.
//
// Each route assertion follows the same shape:
//   1. Page loads without console error
//   2. The expected H1 is rendered
//   3. The MarketingFooter is mounted and links back to the other legal pages
//
// Not exhaustive on copy — the legal text changes intentionally over time
// and pinning every paragraph would generate flake.

import { test, expect } from '@playwright/test'

const ROUTES = [
  { path: '/about',   h1: /one parent, one .*frustration/i,    title: /about sprigloop/i },
  { path: '/contact', h1: /send chris a/i,                      title: /contact sprigloop/i },
  { path: '/privacy', h1: /what i do with your/i,               title: /privacy policy/i },
  { path: '/terms',   h1: /the .*terms.* of using sprigloop/i,  title: /terms of service/i },
]

for (const route of ROUTES) {
  test(`${route.path} renders + sets the document title`, async ({ page }) => {
    const consoleErrors = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push('[console] ' + msg.text())
    })

    await page.goto(route.path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.h1)
    await expect(page).toHaveTitle(route.title)

    // MarketingFooter is mounted on every page in LandingLayout; assert
    // its four links are reachable so a footer regression is caught.
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: /^about$/i })).toBeVisible()
    await expect(footer.getByRole('link', { name: /^contact$/i })).toBeVisible()
    await expect(footer.getByRole('link', { name: /^privacy$/i })).toBeVisible()
    await expect(footer.getByRole('link', { name: /^terms$/i })).toBeVisible()

    expect(consoleErrors, 'no console errors on a static legal page').toEqual([])
  })
}

test('legal page footer links navigate correctly', async ({ page }) => {
  await page.goto('/privacy')

  // Click each footer link and confirm the URL flips. Use locator.first()
  // because the same nav appears in every layout slot if a page has multiple
  // (it doesn't today, but cheap defense).
  const footer = page.getByRole('contentinfo')

  await footer.getByRole('link', { name: /^terms$/i }).first().click()
  await expect(page).toHaveURL(/\/terms$/)

  await footer.getByRole('link', { name: /^about$/i }).first().click()
  await expect(page).toHaveURL(/\/about$/)

  await footer.getByRole('link', { name: /^contact$/i }).first().click()
  await expect(page).toHaveURL(/\/contact$/)

  await footer.getByRole('link', { name: /^privacy$/i }).first().click()
  await expect(page).toHaveURL(/\/privacy$/)
})
