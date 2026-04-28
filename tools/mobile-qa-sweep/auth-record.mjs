#!/usr/bin/env node
// Auth-state recorder — opens a real browser, waits for you to sign in,
// then persists the session to .auth-state.json so authed-sweep.mjs can
// replay it without going through OTP / password again.
//
// Run from BabyInventory/:
//   node tools/mobile-qa-sweep/auth-record.mjs
//
// Override target with BASE_URL:
//   BASE_URL=https://beta.sprigloop.com node tools/mobile-qa-sweep/auth-record.mjs
//
// Re-run whenever the session expires (Supabase JWT defaults to 1hr access
// token + 7d refresh token, but the sweep is fast enough that it's almost
// always still valid by the time you re-run).

import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_PATH = resolve(__dirname, '.auth-state.json')
const BASE_URL = process.env.BASE_URL || 'https://sprigloop.com'

console.log('[record] Target: ' + BASE_URL)
console.log('[record] Output: ' + STATE_PATH)
console.log('')
console.log('[record] Opening browser. Sign in with your normal account.')
console.log('[record] As soon as you land on /home (or /onboarding), I save the session and close.')
console.log('')

const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()

await page.goto(BASE_URL + '/login')

// 5-minute window to complete sign-in. Long enough for OTP retrieval +
// any 2FA dance. The script ends as soon as we're past the auth gate.
try {
  await page.waitForURL(/\/(home|onboarding|inventory)/, { timeout: 5 * 60_000 })
} catch {
  console.error('[record] Timed out waiting for sign-in. Aborting without saving.')
  await browser.close()
  process.exit(1)
}

console.log('[record] Detected sign-in (URL: ' + page.url() + ')')

await context.storageState({ path: STATE_PATH })
console.log('[record] Saved auth state to ' + STATE_PATH)

await browser.close()
console.log('[record] Done. Run authed-sweep.mjs next.')
