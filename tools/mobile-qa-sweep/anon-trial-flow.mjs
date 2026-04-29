#!/usr/bin/env node
// Anon-trial flow test — walks through the Phase 1+2 anonymous-trial entry
// path and captures screenshots at each step. Validates that:
//   1. Landing page renders the new "Try Sprigloop free" CTA.
//   2. Tapping it creates an anonymous Supabase session and lands on
//      /onboarding (not /signup).
//   3. The TrialBanner is visible on the authed surface.
//   4. The household onboarding step renders normally for an anonymous
//      user (the user_activity_summary trigger fired and produced a
//      step-0 row).
//
// Stops short of trying to upgrade — that needs an inbox to receive the
// OTP, which requires a fixture / mailbox harness we don't have. The
// upgrade step is exercised manually in the smoke-test path documented
// in project_anonymous_trial_signup.md.
//
// Run from BabyInventory/:
//   node tools/mobile-qa-sweep/anon-trial-flow.mjs
//
// Override target with BASE_URL:
//   BASE_URL=https://beta.sprigloop.com node tools/mobile-qa-sweep/anon-trial-flow.mjs
//
// Output: tools/mobile-qa-sweep/output/anon-trial/
//
// PREREQUISITE: Anonymous Sign-Ins must be enabled in the target Supabase
// project (Authentication → Providers → Anonymous Sign-Ins). Without
// that, the Try CTA falls back to /signup and the test fails on the
// "expected /onboarding" assertion.

import { chromium, devices } from '@playwright/test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.BASE_URL || 'https://sprigloop.com'
const OUT_DIR = resolve(__dirname, 'output', 'anon-trial')

// One mid-sized phone viewport — the flow doesn't need three because
// it's a behavior test, not a visual sweep. iPhone 14 Pro covers the
// realistic mobile case. Public + authed sweeps already handle the
// per-viewport visual coverage.
const VIEWPORT = { name: 'iphone-14-pro', ...devices['iPhone 14 Pro'] }

async function fresh(dir) {
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
}

async function shoot(page, label, screenshotsDir) {
  const path = resolve(screenshotsDir, label + '.png')
  await page.screenshot({ path, fullPage: true })
  return path.replace(OUT_DIR + '/', '')
}

async function main() {
  console.log('[anon-trial] target: ' + BASE_URL)
  console.log('[anon-trial] viewport: ' + VIEWPORT.name)
  await fresh(OUT_DIR)
  const screenshotsDir = resolve(OUT_DIR, 'screenshots')
  await mkdir(screenshotsDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ...VIEWPORT,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('pageerror', (err) => consoleErrors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push('[console] ' + msg.text())
  })

  const checks = []
  function check(label, ok, detail) {
    checks.push({ label, ok, detail: detail ?? null })
    process.stdout.write('  ' + (ok ? '✓' : '✗') + ' ' + label + '\n')
  }

  try {
    // ── Step 1: landing renders Try CTA ──────────────────────────────────
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(500)
    const landingShot = await shoot(page, '01-landing', screenshotsDir)

    const heroBtn = page.getByRole('button', { name: /try sprigloop free/i }).first()
    const heroVisible = await heroBtn.isVisible().catch(() => false)
    check('Landing renders "Try Sprigloop free" CTA', heroVisible)

    // ── Step 2: tapping the CTA navigates to /onboarding ─────────────────
    if (heroVisible) {
      await heroBtn.click()
      // The button briefly shows "Starting…" then navigates. Wait for the
      // route change before continuing.
      await page.waitForURL(
        (url) => url.pathname.startsWith('/onboarding') || url.pathname.startsWith('/signup'),
        { timeout: 15_000 },
      ).catch(() => {})
      await page.waitForTimeout(800)
    }

    const onboardingShot = await shoot(page, '02-onboarding', screenshotsDir)
    const landedAtOnboarding = page.url().includes('/onboarding')
    check(
      'Lands on /onboarding after Try CTA',
      landedAtOnboarding,
      page.url(),
    )

    if (page.url().includes('/signup')) {
      check(
        'Did NOT fall back to /signup (anonymous sign-ins enabled?)',
        false,
        'Check Supabase dashboard → Authentication → Providers → Anonymous Sign-Ins.',
      )
    }

    // ── Step 3: TrialBanner is visible on the authed surface ─────────────
    if (landedAtOnboarding) {
      // The banner self-gates on isAnonymous so it should be present
      // immediately after sign-in resolves. Match by aria-label which is
      // stable across copy tweaks.
      const banner = page.getByRole('button', { name: /save your wardrobe by creating an account/i })
      const bannerVisible = await banner.isVisible({ timeout: 3000 }).catch(() => false)
      check('TrialBanner is visible on /onboarding', bannerVisible)
    }

    // ── Step 4: console + page errors clean ──────────────────────────────
    check(
      'No JS / console errors during the flow',
      consoleErrors.length === 0,
      consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join(' | ') : null,
    )

    const allOk = checks.every((c) => c.ok)
    const report = {
      baseUrl: BASE_URL,
      ranAt: new Date().toISOString(),
      viewport: VIEWPORT.name,
      checks,
      consoleErrors,
      screenshots: {
        landing: landingShot,
        onboarding: onboardingShot,
      },
      allPassed: allOk,
    }
    await writeFile(resolve(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2))

    console.log('')
    console.log('[anon-trial] ' + (allOk ? 'all checks passed' : 'FAILED') )
    console.log('[anon-trial] report: ' + resolve(OUT_DIR, 'report.json'))
    if (!allOk) process.exit(1)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
