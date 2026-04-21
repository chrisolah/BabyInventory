import { test, expect } from '@playwright/test'

test.describe('landing page', () => {
  test('loads and shows primary CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Get started free')).toBeVisible()
  })

  test('shows supply-side CTA', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Have clothes to pass on?')).toBeVisible()
  })

  test('primary CTA navigates to signup', async ({ page }) => {
    await page.goto('/')
    await page.getByText('Get started free').click()
    await expect(page).toHaveURL('/signup')
  })

  test('supply CTA scrolls to supply section', async ({ page }) => {
    await page.goto('/')
    // The supply section uses a CSS-Modules class (compiled to a hashed name),
    // so we can't target a stable `.supply-section` selector. Anchor on the
    // section's headline text instead — it's unique on the page.
    const supplyHeadline = page.getByRole('heading', {
      name: /your .* pile has a/i,
    })
    await page.getByText('Have clothes to pass on?').click()
    await expect(supplyHeadline).toBeInViewport()
  })
})
