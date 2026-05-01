#!/usr/bin/env node
// Authed mobile QA sweep — replays the session captured by auth-record.mjs
// against the post-login routes and runs the same diagnostic as the public
// sweep.
//
// Prerequisite: run `node tools/mobile-qa-sweep/auth-record.mjs` first to
// produce .auth-state.json.
//
// Run from BabyInventory/:
//   node tools/mobile-qa-sweep/authed-sweep.mjs
//
// Override target with BASE_URL (must match what you used for auth-record):
//   BASE_URL=https://beta.sprigloop.com node tools/mobile-qa-sweep/authed-sweep.mjs
//
// Output: tools/mobile-qa-sweep/output/authed/
//
// Routes covered: /home, /inventory, /add-item, /pass-along, /profile, /admin,
// and /item/:id (resolved at runtime from the first row in /inventory).
// /admin requires the saved auth state to be for an admin email; if it isn't,
// the route will bounce to /home and the bounce-detection below will flag it.
// /item/:id is skipped with a log message if /inventory returns zero items.
// Other ID-bearing routes (/pass-along/:id, /inventory/slot/...) are still
// out of scope — add later if those layouts regress.

import { chromium, devices } from '@playwright/test'
import { mkdir, writeFile, rm, access } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { DIAGNOSTIC_FN } from './diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STATE_PATH = resolve(__dirname, '.auth-state.json')
const BASE_URL = process.env.BASE_URL || 'https://sprigloop.com'

// VIEWPORT_PROFILE: 'mobile' (default) or 'desktop'. See public-sweep.mjs
// for full rationale. Same auth state works for both — Supabase session
// doesn't care about viewport.
const PROFILE = (process.env.VIEWPORT_PROFILE || 'mobile').toLowerCase()
if (PROFILE !== 'mobile' && PROFILE !== 'desktop') {
  console.error(
    '[sweep] VIEWPORT_PROFILE must be "mobile" or "desktop", got: ' + PROFILE
  )
  process.exit(1)
}
const IS_DESKTOP = PROFILE === 'desktop'
const OUT_DIR = resolve(
  __dirname,
  'output',
  IS_DESKTOP ? 'authed-desktop' : 'authed'
)

const MOBILE_VIEWPORTS = [
  { name: 'iphone-se',     ...devices['iPhone SE'] },
  { name: 'iphone-14-pro', ...devices['iPhone 14 Pro'] },
  { name: 'pixel-7',       ...devices['Pixel 7'] },
]

const DESKTOP_VIEWPORTS = [
  { name: 'laptop-1280',  viewport: { width: 1280, height: 800 } },
  { name: 'laptop-1440',  viewport: { width: 1440, height: 900 } },
  { name: 'desktop-1920', viewport: { width: 1920, height: 1080 } },
]

const VIEWPORTS = IS_DESKTOP ? DESKTOP_VIEWPORTS : MOBILE_VIEWPORTS

// Profile is split into two route entries because the screen has multiple
// tabs (Household / Account / Notifications) and the URL ?tab= param picks
// which one renders. Without an explicit ?tab=, /profile defaults to
// Household. The 2026-05-01 design-unification eyebrows live in the Account
// tab, so we capture both — Household catches the unchanged baseline,
// Account catches the new pills.
const STATIC_ROUTES = [
  { path: '/home',                 name: 'home' },
  { path: '/inventory',            name: 'inventory' },
  { path: '/add-item',             name: 'add-item' },
  { path: '/pass-along',           name: 'pass-along' },
  { path: '/profile',              name: 'profile-household' },
  { path: '/profile?tab=account',  name: 'profile-account' },
  { path: '/admin',                name: 'admin' },
]

async function fresh(dir) {
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
}

async function ensureAuthState() {
  try {
    await access(STATE_PATH)
  } catch {
    console.error('[sweep] No auth state at ' + STATE_PATH)
    console.error('[sweep] Run `node tools/mobile-qa-sweep/auth-record.mjs` first.')
    process.exit(1)
  }
}

// One-shot pre-pass: load /inventory at a default mobile viewport, click the
// first item row, capture the resulting /item/:id URL, return the id. Used to
// build a /item/:id route to append to the sweep so ItemDetail layout gets
// the same treatment as the static routes.
//
// Returns null (and logs) if /inventory has no items, the row click doesn't
// navigate within 5s, or anything throws. Sweep proceeds with static routes
// only when null.
async function discoverItemId(browser) {
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    storageState: STATE_PATH,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()
  let id = null
  try {
    await page.goto(BASE_URL + '/inventory', { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(1500)
    // SectionItemRow + ItemRow both render as <button aria-label="Open <name>">
    // and both pin the .itemRow class. The class hash from CSS modules makes
    // the literal class name volatile (Inventory_itemRow_<hash>), so we match
    // on the substring 'itemRow' which survives rebuilds. The aria-label part
    // alone wasn't enough — ProfileMenu's <button aria-label="Open profile
    // menu"> sits higher in DOM order and was being clicked instead, opening
    // the dropdown rather than navigating to a row.
    const firstRow = page
      .locator('button[class*="itemRow"][aria-label^="Open "]')
      .first()
    const count = await firstRow.count()
    if (count === 0) {
      console.log('[sweep] /inventory has no items — skipping /item/:id sweep')
      return null
    }
    await firstRow.click()
    await page.waitForURL(/\/item\/[^/?#]+/, { timeout: 5_000 }).catch(() => null)
    const m = page.url().match(/\/item\/([^/?#]+)/)
    if (m) id = m[1]
    else console.log('[sweep] click on first row didn\'t navigate to /item/:id — skipping')
  } catch (err) {
    console.log('[sweep] item-id discovery failed: ' + err.message + ' — skipping /item/:id')
  } finally {
    await context.close()
  }
  return id
}

async function sweepRoute(browser, viewport, route) {
  const context = await browser.newContext({
    ...viewport,
    storageState: STATE_PATH,
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  const url = BASE_URL + route.path
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    // "Failed to load resource: the server responded with a status of 404 ()"
    // is captured (with URL) by the response listener below — skip the
    // console version to avoid duplicates with empty-URL parens.
    if (text.startsWith('Failed to load resource')) return
    errors.push('[console] ' + text)
  })
  page.on('response', (resp) => {
    const status = resp.status()
    if (status === 404) errors.push('[404] ' + resp.url())
    else if (status >= 500) errors.push('[' + status + '] ' + resp.url())
  })

  let loadOk = true
  let loadError = null
  let finalUrl = null
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    finalUrl = page.url()
  } catch (err) {
    loadOk = false
    loadError = String(err)
  }

  // Detect auth bounce — if we asked for /home but ended up at /login or /,
  // the saved storageState is stale. Flag clearly so Chris re-records.
  let authBounced = false
  if (loadOk && finalUrl) {
    const finalPath = new URL(finalUrl).pathname
    if (finalPath === '/login' || finalPath === '/' || finalPath === '/signup') {
      authBounced = true
    }
  }

  // Settle post-load animations + lazy data fetches
  await page.waitForTimeout(1200)

  const screenshotDir = resolve(OUT_DIR, 'screenshots', viewport.name)
  await mkdir(screenshotDir, { recursive: true })
  const screenshotPath = resolve(screenshotDir, route.name + '.png')

  let diagnostic = null
  if (loadOk) {
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true })
    } catch (err) {
      errors.push('[screenshot] ' + String(err))
    }
    try {
      diagnostic = await page.evaluate(DIAGNOSTIC_FN)
      // Filter small_tap_target on desktop — see public-sweep.mjs.
      if (IS_DESKTOP && diagnostic) {
        const kept = diagnostic.issues.filter((i) => i.kind !== 'small_tap_target')
        const byKind = kept.reduce((acc, i) => {
          acc[i.kind] = (acc[i.kind] || 0) + 1
          return acc
        }, {})
        diagnostic = {
          ...diagnostic,
          issues: kept,
          stats: { ...diagnostic.stats, total: kept.length, byKind },
        }
      }
    } catch (err) {
      errors.push('[diagnostic] ' + String(err))
    }
  }

  await context.close()

  return {
    route: route.name,
    path: route.path,
    viewport: viewport.name,
    viewportWidth: viewport.viewport.width,
    url,
    finalUrl,
    loadOk,
    loadError,
    authBounced,
    screenshot: loadOk ? screenshotPath.replace(OUT_DIR + '/', '') : null,
    diagnostic,
    errors,
  }
}

function severity(issue) {
  switch (issue.kind) {
    case 'horizontal_overflow':
    case 'child_overflow':
    case 'content_clipped':
    case 'offscreen':
      return 'high'
    case 'small_tap_target':
      return 'medium'
    case 'small_text':
      return 'low'
    default:
      return 'low'
  }
}

function buildMarkdown(results, routes) {
  const lines = []
  lines.push(
    '# ' + (IS_DESKTOP ? 'Desktop' : 'Mobile') + ' QA sweep — authed routes'
  )
  lines.push('')
  lines.push('Target: `' + BASE_URL + '`')
  lines.push('Profile: `' + PROFILE + '`')
  lines.push('Run: ' + new Date().toISOString())
  lines.push('')
  if (IS_DESKTOP) {
    lines.push(
      '_small_tap_target findings are filtered out on desktop (mouse-driven, ' +
        '44px floor doesn\'t apply)._'
    )
    lines.push('')
  }

  // Auth-bounce check first — if any route bounced, the session is dead.
  const bouncedAny = results.some((r) => r.authBounced)
  if (bouncedAny) {
    lines.push('## ⚠️  Auth state appears stale')
    lines.push('')
    lines.push('At least one authed route redirected back to a public route. ')
    lines.push('Re-run `node tools/mobile-qa-sweep/auth-record.mjs` to refresh ')
    lines.push('the session, then re-run this sweep.')
    lines.push('')
  }

  let totalIssues = 0
  let highIssues = 0
  for (const r of results) {
    if (r.diagnostic) {
      totalIssues += r.diagnostic.issues.length
      highIssues += r.diagnostic.issues.filter((i) => severity(i) === 'high').length
    }
  }
  lines.push('## Summary')
  lines.push('')
  lines.push('- Routes swept: ' + routes.length)
  lines.push('- Viewports: ' + VIEWPORTS.map((v) => v.name).join(', '))
  lines.push('- Total issues flagged: **' + totalIssues + '** (' + highIssues + ' high-severity)')
  lines.push('')

  for (const route of routes) {
    lines.push('## ' + route.name + ' (`' + route.path + '`)')
    lines.push('')
    for (const viewport of VIEWPORTS) {
      const r = results.find((x) => x.route === route.name && x.viewport === viewport.name)
      if (!r) continue
      lines.push('### ' + viewport.name + ' (' + r.viewportWidth + 'px)')
      lines.push('')
      if (r.authBounced) {
        lines.push('_Bounced to `' + new URL(r.finalUrl).pathname + '` — auth state stale._')
        lines.push('')
        continue
      }
      if (!r.loadOk) {
        lines.push('Load failed: `' + r.loadError + '`')
        lines.push('')
        continue
      }
      if (r.screenshot) {
        lines.push('![screenshot](' + r.screenshot + ')')
        lines.push('')
      }
      const issues = r.diagnostic?.issues || []
      if (issues.length === 0) {
        lines.push('_No issues flagged._')
        lines.push('')
        continue
      }
      const grouped = { high: [], medium: [], low: [] }
      for (const i of issues) grouped[severity(i)].push(i)
      for (const sev of ['high', 'medium', 'low']) {
        if (grouped[sev].length === 0) continue
        lines.push('**' + sev.toUpperCase() + '** (' + grouped[sev].length + ')')
        lines.push('')
        for (const i of grouped[sev].slice(0, 15)) {
          const detailKv = Object.entries(i.detail)
            .map(([k, v]) => k + '=' + v)
            .join(', ')
          const text = i.text ? ' "' + i.text + '"' : ''
          lines.push(
            '- `' + i.kind + '` · `' + i.selector + '`' + text + ' (' + detailKv + ')'
          )
        }
        if (grouped[sev].length > 15) {
          lines.push('- _… ' + (grouped[sev].length - 15) + ' more_')
        }
        lines.push('')
      }
      if (r.errors.length) {
        lines.push('**Console / page errors:**')
        lines.push('')
        for (const e of r.errors.slice(0, 5)) {
          lines.push('- ' + e)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}

async function main() {
  await ensureAuthState()
  console.log('[sweep] profile: ' + PROFILE)
  console.log('[sweep] target: ' + BASE_URL)
  console.log('[sweep] viewports: ' + VIEWPORTS.map((v) => v.name).join(', '))
  await fresh(OUT_DIR)

  const browser = await chromium.launch({ headless: true })

  // Discover the first item id once before the main loop so /item/:id can
  // be swept across all viewports against the same item. If discovery fails
  // (zero items, click didn't navigate, network error), the sweep proceeds
  // with the static routes only.
  console.log('[sweep] discovering item id for /item/:id sweep …')
  const itemId = await discoverItemId(browser)
  const routes = [...STATIC_ROUTES]
  if (itemId) {
    routes.push({ path: '/item/' + itemId, name: 'item-detail' })
    console.log('[sweep] item id: ' + itemId)
  }
  console.log('[sweep] routes: ' + routes.map((r) => r.name).join(', '))

  const results = []

  try {
    for (const viewport of VIEWPORTS) {
      for (const route of routes) {
        process.stdout.write('  ' + viewport.name + ' ' + route.name + ' … ')
        const r = await sweepRoute(browser, viewport, route)
        if (r.authBounced) {
          process.stdout.write('AUTH BOUNCE\n')
        } else {
          const issueCount = r.diagnostic?.issues.length ?? 0
          process.stdout.write(
            (r.loadOk ? 'ok' : 'FAIL') + ' (' + issueCount + ' issues)\n'
          )
        }
        results.push(r)
      }
    }
  } finally {
    await browser.close()
  }

  await writeFile(
    resolve(OUT_DIR, 'report.json'),
    JSON.stringify({ baseUrl: BASE_URL, ranAt: new Date().toISOString(), results }, null, 2)
  )
  await writeFile(resolve(OUT_DIR, 'report.md'), buildMarkdown(results, routes))

  console.log('')
  console.log('[sweep] done')
  console.log('[sweep] report: ' + resolve(OUT_DIR, 'report.md'))

  if (results.some((r) => r.authBounced)) {
    console.log('')
    console.log('[sweep] ⚠️  one or more routes bounced to public — auth state may be stale')
    console.log('[sweep]     re-run auth-record.mjs to refresh')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
