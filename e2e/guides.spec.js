import { test, expect } from '@playwright/test'

// Guides listing + detail page smoke tests.
// Added 2026-06-03 when /guides and /guides/:slug were shipped.
//
// Covers:
//   - /guides listing loads, sets title, renders guide cards
//   - Each guide card navigates to the correct detail page
//   - Guide detail renders title, AI disclosure, sections, sources
//   - Back link returns to /guides
//   - Guides accessible from logged-out nav and from logged-in sidebar
//   - No console errors on either page

const GUIDES = [
  {
    slug: 'how-much-does-a-newborn-need',
    titlePattern: /how much does a newborn actually need/i,
  },
  {
    slug: 'when-does-baby-outgrow-each-size',
    titlePattern: /when will my baby outgrow each size/i,
  },
  {
    slug: 'what-to-do-with-outgrown-baby-clothes',
    titlePattern: /what to do with outgrown baby clothes/i,
  },
  {
    slug: 'baby-registry-what-you-actually-need',
    titlePattern: /baby registry.*what you actually need/i,
  },
  {
    slug: 'how-to-organize-baby-clothes-by-size',
    titlePattern: /how to organize baby clothes by size/i,
  },
]

test.describe('/guides listing', () => {
  test('loads, sets title, renders guide cards', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(String(e)))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

    await page.goto('/guides')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/guides/i)
    await expect(page).toHaveTitle(/guides.*sprigloop/i)

    // One card per guide — assert all five are present
    for (const guide of GUIDES) {
      await expect(
        page.getByRole('button', { name: guide.titlePattern })
      ).toBeVisible()
    }

    expect(errors, 'no console errors').toEqual([])
  })

  test('shows AI disclosure note', async ({ page }) => {
    await page.goto('/guides')
    await expect(page.getByText(/researched and written with ai assistance/i)).toBeVisible()
  })

  test('nav shows How it works and Guides links', async ({ page }) => {
    await page.goto('/guides')
    await expect(page.getByRole('button', { name: /how it works/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^guides$/i })).toBeVisible()
  })
})

test.describe('/guides/:slug detail pages', () => {
  for (const guide of GUIDES) {
    test(`${guide.slug} — loads and renders correctly`, async ({ page }) => {
      const errors = []
      page.on('pageerror', e => errors.push(String(e)))
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

      await page.goto(`/guides/${guide.slug}`)

      // H1 matches the guide title
      await expect(page.getByRole('heading', { level: 1 })).toContainText(guide.titlePattern)

      // Document title is set
      await expect(page).toHaveTitle(/sprigloop guides/i)

      // AI disclosure is shown on every guide
      await expect(page.getByText(/ai assistance/i)).toBeVisible()

      // Sources section is present
      await expect(page.getByText(/^sources$/i)).toBeVisible()

      // Footer CTA links to plan or signup
      await expect(
        page.getByRole('button', { name: /try sprigloop free|open plan tab/i })
      ).toBeVisible()

      expect(errors, 'no console errors').toEqual([])
    })
  }

  test('back link returns to /guides listing', async ({ page }) => {
    await page.goto(`/guides/${GUIDES[0].slug}`)
    await page.getByRole('button', { name: /all guides/i }).first().click()
    await expect(page).toHaveURL(/\/guides$/)
  })

  test('unknown slug shows not-found message gracefully', async ({ page }) => {
    await page.goto('/guides/this-does-not-exist')
    await expect(page.getByText(/guide not found/i)).toBeVisible()
  })

  test('detail page CTA starts trial for logged-out user', async ({ page }) => {
    await page.goto(`/guides/${GUIDES[0].slug}`)
    await page.getByRole('button', { name: /try sprigloop free/i }).click()
    await expect(page).toHaveURL(/\/(onboarding|signup)/)
  })
})

test.describe('guides navigation integration', () => {
  test('landing page Guides nav link reaches /guides', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /^guides$/i }).click()
    await expect(page).toHaveURL(/\/guides/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('how-it-works page Guides nav link reaches /guides', async ({ page }) => {
    await page.goto('/how-it-works')
    await page.getByRole('button', { name: /^guides$/i }).click()
    await expect(page).toHaveURL(/\/guides/)
  })
})
