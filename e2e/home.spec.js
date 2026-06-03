import { test, expect } from '@playwright/test'
import {
  freshEmail,
  signUpWithPassword,
  blastThroughOnboardingToHome,
} from './support/helpers.js'

// Home screen smoke tests.
// Added 2026-06-03 — Home was untested despite being the main post-onboarding hub.
//
// Home is the 8-category readiness grid. After a fresh sign-up + onboarding:
//   - Greeting renders (Hi, {name} or Welcome)
//   - All 8 category cards are present and clickable
//   - Clothing card has the "Pass Along" badge
//   - Stats row shows "items tracked"
//   - Sidebar nav is present with expected links
//   - Guides link in sidebar navigates to /guides

test.describe('home screen', () => {
  let email

  test.beforeEach(async ({ page }) => {
    email = freshEmail()
    await page.goto('/signup')
    await signUpWithPassword(page, { name: 'Home Test', email })
    await blastThroughOnboardingToHome(page, {
      householdName: 'Home Household',
      babyName: 'Home Baby',
    })
    await expect(page).toHaveURL(/\/home/)
  })

  test('renders greeting', async ({ page }) => {
    // Greeting says "Hi, {firstName}" or "Welcome" for no-name accounts
    const greeting = page.getByRole('heading', { level: 1 })
    await expect(greeting).toBeVisible()
    await expect(greeting).toContainText(/hi,|welcome/i)
  })

  test('renders all 8 category cards', async ({ page }) => {
    const categories = [
      'Clothing', 'Sleep', 'Feeding', 'Diapering',
      'Travel', 'Play', 'Health', 'Bath',
    ]
    for (const cat of categories) {
      await expect(page.getByRole('button', { name: cat })).toBeVisible()
    }
  })

  test('clothing card has Pass Along badge', async ({ page }) => {
    await expect(page.getByText('Pass Along')).toBeVisible()
  })

  test('stats row shows items tracked', async ({ page }) => {
    await expect(page.getByText(/items tracked/i)).toBeVisible()
  })

  test('clicking a category card navigates to inventory', async ({ page }) => {
    await page.getByRole('button', { name: 'Sleep' }).click()
    await expect(page).toHaveURL(/\/inventory.*category=sleep/)
  })

  test('clothing card navigates to inventory clothing view', async ({ page }) => {
    await page.getByRole('button', { name: 'Clothing' }).click()
    await expect(page).toHaveURL(/\/inventory.*category=clothing/)
  })

  test('sidebar shows all primary nav items', async ({ page }) => {
    const sidebar = page.getByRole('navigation', { name: /main navigation/i })
    await expect(sidebar.getByRole('button', { name: /^home$/i })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: /^inventory$/i })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: /^plan$/i })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: /^guides$/i })).toBeVisible()
    await expect(sidebar.getByRole('button', { name: /^pass along$/i })).toBeVisible()
  })

  test('sidebar Guides link navigates to /guides', async ({ page }) => {
    const sidebar = page.getByRole('navigation', { name: /main navigation/i })
    await sidebar.getByRole('button', { name: /^guides$/i }).click()
    await expect(page).toHaveURL(/\/guides/)
    // Guides page renders within the app shell (sidebar stays visible)
    await expect(
      page.getByRole('navigation', { name: /main navigation/i })
    ).toBeVisible()
  })

  test('sidebar Plan link navigates to /plan', async ({ page }) => {
    const sidebar = page.getByRole('navigation', { name: /main navigation/i })
    await sidebar.getByRole('button', { name: /^plan$/i }).click()
    await expect(page).toHaveURL(/\/plan/)
  })
})
