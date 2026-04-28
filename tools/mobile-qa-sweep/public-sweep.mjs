#!/usr/bin/env node
// Public mobile QA sweep — hits unauthenticated routes and captures
// screenshots + DOM diagnostics across three phone viewports.
//
// Run from BabyInventory/:
//   node tools/mobile-qa-sweep/public-sweep.mjs
//
// Override target with BASE_URL:
//   BASE_URL=https://beta.sprigloop.com node tools/mobile-qa-sweep/public-sweep.mjs
//
// Output: tools/mobile-qa-sweep/output/public/

import { chromium, devices } from '@playwright/test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { DIAGNOSTIC_FN } from './diagnostics.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, 'output', 'public')
const BASE_URL = process.env.BASE_URL || 'https://sprigloop.com'

// Three representative phone widths. Heights are device-typical, but full-page
// screenshots ignore height anyway — the entire scrollable page is captured.
const VIEWPORTS = [
  { name: 'iphone-se',     ...devices['iPhone SE'] },        // 375 × 667
  { name: 'iphone-14-pro', ...devices['iPhone 14 Pro'] },    // 393 × 852
  { name: 'pixel-7',       ...devices['Pixel 7'] },          // 412 × 915
]

const ROUTES = [
  { path: '/',               name: 'landing' },
  { path: '/signup',         name: 'signup' },
  { path: '/login',          name: 'login' },
  { path: '/reset-password', name: 'reset-password' },
]

async function fresh(dir) {
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
}

async function sweepRoute(browser, viewport, route) {
  const context = await browser.newContext({
    ...viewport,
    // Ignore HTTPS errors so a misconfigured cert in beta doesn't break us.
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  const url = BASE_URL + route.path
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('[console] ' + msg.text())
  })

  let loadOk = true
  let loadError = null
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  } catch (err) {
    loadOk = false
    loadError = String(err)
  }

  // Settle any post-load animations / fonts
  await page.waitForTimeout(800)

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
    loadOk,
    loadError,
    screenshot: loadOk ? screenshotPath.replace(OUT_DIR + '/', '') : null,
    diagnostic,
    errors,
  }
}

function severity(issue) {
  // High = visibly broken. Medium = polish-tier. Low = informational.
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

function buildMarkdown(results) {
  const lines = []
  lines.push('# Mobile QA sweep — public routes')
  lines.push('')
  lines.push('Target: `' + BASE_URL + '`')
  lines.push('Run: ' + new Date().toISOString())
  lines.push('')

  // Top-level summary
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
  lines.push('- Routes swept: ' + ROUTES.length)
  lines.push('- Viewports: ' + VIEWPORTS.map((v) => v.name).join(', '))
  lines.push('- Total issues flagged: **' + totalIssues + '** (' + highIssues + ' high-severity)')
  lines.push('')

  // Per route
  for (const route of ROUTES) {
    lines.push('## ' + route.name + ' (`' + route.path + '`)')
    lines.push('')
    for (const viewport of VIEWPORTS) {
      const r = results.find((x) => x.route === route.name && x.viewport === viewport.name)
      if (!r) continue
      lines.push('### ' + viewport.name + ' (' + r.viewportWidth + 'px)')
      lines.push('')
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
  console.log('[sweep] target: ' + BASE_URL)
  console.log('[sweep] viewports: ' + VIEWPORTS.map((v) => v.name).join(', '))
  console.log('[sweep] routes: ' + ROUTES.map((r) => r.name).join(', '))
  await fresh(OUT_DIR)

  const browser = await chromium.launch({ headless: true })
  const results = []

  try {
    for (const viewport of VIEWPORTS) {
      for (const route of ROUTES) {
        process.stdout.write('  ' + viewport.name + ' ' + route.name + ' … ')
        const r = await sweepRoute(browser, viewport, route)
        const issueCount = r.diagnostic?.issues.length ?? 0
        process.stdout.write(
          (r.loadOk ? 'ok' : 'FAIL') + ' (' + issueCount + ' issues)\n'
        )
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
  await writeFile(resolve(OUT_DIR, 'report.md'), buildMarkdown(results))

  console.log('')
  console.log('[sweep] done')
  console.log('[sweep] report: ' + resolve(OUT_DIR, 'report.md'))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
