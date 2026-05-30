// Wishlist OG tag injector — Vercel serverless function
// Fetches share data from Supabase and injects wishlist-specific OG meta tags
// so Facebook/iMessage/WhatsApp show a meaningful preview for share links.
//
// How it works:
//   1. Vercel routes /wishlist/:token here (via vercel.json rewrite)
//   2. We self-fetch https://sprigloop.com/ to get the built index.html from CDN
//   3. We fetch the share data from Supabase
//   4. We inject OG tags and return the HTML
//   (No filesystem tricks — the CDN fetch is simpler and always works)

const BASE_URL = 'https://sprigloop.com'

// Cache per Lambda instance — cold starts re-fetch, warm instances reuse.
// Fine because the HTML only changes on deploy (new instance = new hash).
let cachedBaseHtml = null

async function getBaseHtml() {
  if (cachedBaseHtml) return cachedBaseHtml
  const res = await fetch(`${BASE_URL}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`index.html fetch failed: ${res.status}`)
  cachedBaseHtml = await res.text()
  return cachedBaseHtml
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

  // Step 1: get base HTML (with fallback)
  let html
  try {
    html = await getBaseHtml()
  } catch (_) {
    // Last resort — return a redirect so browsers still work
    res.setHeader('Location', `${BASE_URL}/wishlist/${encodeURIComponent(token || '')}?fallback=1`)
    return res.status(302).end()
  }

  // Step 2: fetch share data and inject OG tags
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey && token) {
      const shareRes = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_wishlist_for_share`,
        {
          method: 'POST',
          headers: {
            'Content-Type':    'application/json',
            'Content-Profile': 'beta',
            'apikey':          supabaseKey,
            'Authorization':   `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ p_token: token }),
        }
      )

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

        const pageUrl = `${BASE_URL}/wishlist/${encodeURIComponent(token)}`

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
    // Serve base index.html — React app loads normally, just no custom OG tags
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.send(html)
}
