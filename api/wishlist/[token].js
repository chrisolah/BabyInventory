import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// _index.html is copied here by the build script: `cp dist/index.html api/wishlist/_index.html`
// Using __dirname means no path guessing — the file is always right next to this function.
let cachedHtml = null
function getHtml() {
  if (!cachedHtml) {
    cachedHtml = fs.readFileSync(path.join(__dirname, '_index.html'), 'utf-8')
  }
  return cachedHtml
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default async function handler(req, res) {
  const { token } = req.query
  let html = getHtml()

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey && token) {
      const shareRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_wishlist_for_share`, {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Content-Profile': 'beta',
          'apikey':          supabaseKey,
          'Authorization':   `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ p_token: token }),
      })

      const data = await shareRes.json()

      if (data && !data.error) {
        const { household, babies } = data
        const householdName = household?.name
        const title = householdName
          ? `${householdName}'s Baby Wishlist`
          : 'Baby Wishlist'

        const babyNames = (babies || []).filter(b => b.name).map(b => b.name)
        let description
        if (babyNames.length) {
          description = `Help ${babyNames.join(' & ')} get everything they need! Browse the wishlist and claim items — no account needed.`
        } else if (householdName) {
          description = `Help the ${householdName} family prepare for their new arrival. Browse their wishlist and claim items — no account needed.`
        } else {
          description = `Browse this baby wishlist and claim items for the family — no account needed. Powered by Sprigloop.`
        }

        const pageUrl = `https://sprigloop.com/wishlist/${encodeURIComponent(token)}`

        const inject = [
          `<title>${esc(title)} | Sprigloop</title>`,
          `<meta name="description" content="${esc(description)}" />`,
          `<meta property="og:title" content="${esc(title)}" />`,
          `<meta property="og:description" content="${esc(description)}" />`,
          `<meta property="og:url" content="${pageUrl}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="Sprigloop" />`,
          `<meta name="twitter:card" content="summary" />`,
          `<meta name="twitter:title" content="${esc(title)}" />`,
          `<meta name="twitter:description" content="${esc(description)}" />`,
        ].join('\n    ')

        html = html
          .replace(/<title>[^<]*<\/title>/, '')
          .replace(/<meta name="description"[^>]*\/?>/, '')
          .replace('</head>', `    ${inject}\n  </head>`)
      }
    }
  } catch (_) {
    // Serve plain index.html — the React app will load normally
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.send(html)
}
