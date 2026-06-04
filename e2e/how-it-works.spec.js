import { test, expect } from '@playwright/test'

// How it works page smoke tests.
// Added 2026-06-03 — page was untested despite being a primary SEO surface.
//
// Covers:
//   - Page loads + sets correct document title
//   - H1 renders
//   - All three step sections present
//   - FAQ section renders
//   - Nav links: Guides + How it works visible and functional
//   - No console errors

test.describe('/how-it-works', () => {
  test('loads, sets title, renders H1', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto('/how-it-works')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/how sprigloop works/i)
    await expect(page).toHaveTitle(/how sprigloop works/i)

    expect(errors, 'no console errors').toEqual([])
  })

  test('renders all three step sections', async ({ page }) => {
    await page.goto('/how-it-works')

    // Step numbers are rendered as styled divs, so target the H2 headings.
    await expect(page.getByRole('heading', { name: /add everything your baby has/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /plan ahead and share/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /pass on what they outgrow/i })).toBeVisible()
  })

  test('renders FAQ section with expandable items', async ({ page }) => {
    await page.goto('/how-it-works')

    await expect(page.getByRole('heading', { name: /common questions/i })).toBeVisible()

    // At least one <details> element should be present
    const details = page.locator('details')
    await expect(details.first()).toBeVisible()
    const count = await details.count()
    expect(count, 'should have multiple FAQ items').toBeGreaterThanOrEqual(5)
  })

  test('FAQ items expand on click', async ({ page }) => {
    await page.goto('/how-it-works')

    const firstItem = page.locator('details').first()
    // Closed by default — summary visible, body hidden
    await firstItem.locator('summary').click()
    await expect(firstItem).toHaveAttribute('open', '')
  })

  test('nav shows How it works and Guides links', async ({ page }) => {
    await page.goto('/how-it-works')

    await expect(page.getByRole('button', { name: /how it works/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^guides$/i })).toBeVisible()
  })

  test('nav Guides link navigates to /guides', async ({ page }) => {
    await page.goto('/how-it-works')
    await page.getByRole('button', { name: /^guides$/i }).click()
    await expect(page).toHaveURL(/\/guides/)
  })

  test('logo navigates back to home', async ({ page }) => {
    await page.goto('/how-it-works')
    await page.getByRole('button', { name: /back to sprigloop home/i }).click()
    // Accepts '/' (logged-out) or '/home' (if auth session exists from prior test)
    await expect(page).toHaveURL(/^\/$|\/home/)
  })

  test('final CTA starts trial flow', async ({ page }) => {
    await page.goto('/how-it-works')
    await page.getByRole('button', { name: /try sprigloop free/i }).click()
    await expect(page).toHaveURL(/\/(onboarding|signup)/)
  })
})
