// Generates public/sitemap.xml from the GUIDES registry + static routes.
// Run automatically via the `prebuild` npm script.
//
// To update a guide's lastmod: set `lastmod` on the guide object in
// src/lib/guides.js and rebuild — the sitemap updates automatically.

import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { GUIDES } from '../src/lib/guides.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://sprigloop.com'
const TODAY = new Date().toISOString().split('T')[0]

const STATIC_PAGES = [
  { path: '/',             changefreq: 'weekly',  priority: '1.0', lastmod: '2026-04-30' },
  { path: '/how-it-works', changefreq: 'monthly', priority: '0.8', lastmod: '2026-04-30' },
  { path: '/guides',       changefreq: 'weekly',  priority: '0.8', lastmod: TODAY },
  { path: '/about',        changefreq: 'monthly', priority: '0.7', lastmod: '2026-05-05' },
  { path: '/signup',       changefreq: 'monthly', priority: '0.7', lastmod: '2026-04-30' },
  { path: '/contact',      changefreq: 'monthly', priority: '0.6', lastmod: '2026-05-02' },
  { path: '/login',        changefreq: 'monthly', priority: '0.5', lastmod: '2026-04-30' },
  { path: '/privacy',      changefreq: 'yearly',  priority: '0.3', lastmod: '2026-05-05' },
  { path: '/terms',        changefreq: 'yearly',  priority: '0.3', lastmod: '2026-05-05' },
]

function url({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

const staticEntries = STATIC_PAGES.map(p =>
  url({ loc: `${BASE}${p.path}`, lastmod: p.lastmod, changefreq: p.changefreq, priority: p.priority })
)

const guideEntries = GUIDES.map(g =>
  url({
    loc: `${BASE}/guides/${g.slug}`,
    lastmod: g.lastmod ?? TODAY,
    changefreq: 'monthly',
    priority: '0.8',
  })
)

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries.join('\n')}
${guideEntries.join('\n')}
</urlset>
`

const out = resolve(__dirname, '../public/sitemap.xml')
writeFileSync(out, xml)
console.log(`[sitemap] wrote ${staticEntries.length + guideEntries.length} URLs to public/sitemap.xml`)
