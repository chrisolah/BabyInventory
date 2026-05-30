const BASE_URL = 'https://sprigloop.com'

let cachedBaseHtml = null

async function getBaseHtml() {
  if (cachedBaseHtml) return cachedBaseHtml
  const res = await fetch(`${BASE_URL}/`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
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
  const debug = req.query.debug === '1'

  const diag = {
    token: token || null,
    baseHtmlFetched: false,
    baseHtmlLen: 0,
    supabaseCalled: false,
    supabaseOk: false,
    supabaseError: null,
    injected: false,
    ogTitleInFinal: null,
    redirected: false,
  }

  // Step 1: get base HTML
  let html
  try {
    html = await getBaseHtml()
    diag.baseHtmlFetched = true
    diag.baseHtmlLen = html.length
  } catch (e) {
    diag.baseHtmlFetched = false
    if (debug) return res.json({ ...diag, error: String(e) })
    diag.redirected = true
    res.setHeader('Location', `${BASE_URL}/wishlist/${encodeURIComponent(token || '')}?fallback=1`)
    return res.status(302).end()
  }

  // Step 2: fetch share data and inject OG tags
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey && token) {
      diag.supabaseCalled = true
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
      diag.supabaseOk = !!(data && !data.error)
      if (data?.error) diag.supabaseError = data.error

      if (data && !data.error) {
        const { household, babies } = data
        const householdName = household?.name
        const title = householdName ? `${householdName}'s Baby Wishlist` : 'Baby Wishlist'

        const babyNames = (babies || []).filter(b => b.name).map(b => b.name)
        let description
        if (babyNames.length) {
          description = `Help ${babyNames.join(' & ')} get everything they need! Browse the wishlist and claim items.`
        } else if (householdName) {
          description = `Help the ${householdName} family prepare for their new arrival. Browse the wishlist and claim items.`
        } else {
          description = `Browse this baby wishlist and claim items for the family. Powered by Sprigloop.`
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
          .replace(/<title>[^<]*<\/title>/gi, '')
          .replace(/<meta\s+name="description"[^>]*\/?>/gi, '')
          .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/gi, '')
          .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/gi, '')
          .replace('</head>', `    ${inject}\n  </head>`)

        diag.injected = true
        diag.ogTitleInFinal = (html.match(/og:title.*?content="([^"]+)"/) || [])[1] || null
      }
    }
  } catch (e) {
    diag.supabaseError = String(e)
  }

  if (debug) return res.json(diag)

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store') // disable cache while debugging
  res.setHeader('X-OG-Diag', JSON.stringify(diag))
  res.send(html)
}
