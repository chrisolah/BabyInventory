// Playwright config for Littleloop e2e tests.
//
// Strategy:
// - Tests run against a locally-served Vite build (port 5173) pointed at the
//   real beta Supabase project via .env.local. We don't run a separate "test"
//   schema — we wipe beta before the run in globalSetup. Trade-off: CI and
//   manual beta testing can't happen simultaneously.
// - Single worker: tests mutate shared beta state, so parallelism would cause
//   cross-contamination. Keep it serial until we move to a test schema.
// - Chromium only: cross-browser coverage isn't worth the wall-clock cost on
//   a solo project pre-launch. Add firefox/webkit later if real bugs emerge.

import { defineConfig, devices } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local into process.env so the Playwright Node process and the
// globalSetup module both see SUPABASE_SERVICE_ROLE_KEY etc. Vite's normal
// import.meta.env loading only applies to client code, not to this file.
// Tiny inline parser — saves adding dotenv as a dep just for this.
const envPath = resolve(__dirname, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const [, key, rawValue] = m
    if (process.env[key] !== undefined) continue
    // Strip optional surrounding quotes.
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
}

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  globalSetup: './e2e/global-setup.js',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Boot Vite automatically if no dev server is on 5173. reuseExistingServer
  // lets you leave `npm run dev` running locally during iteration.
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
