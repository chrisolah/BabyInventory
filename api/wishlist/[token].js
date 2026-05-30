// Vercel Serverless Function — serves /wishlist/:token with wishlist-specific
// OG meta tags so social scrapers (Facebook, iMessage, WhatsApp, Slack, etc.)
// show the correct title + description for each share link.
//
// Fetches share data from Supabase, injects OG tags into index.html, and
// returns the full HTML. The React app still loads normally for real users.
// On any error it falls through and serves plain index.html.

export default async function handler(req, res) {
  const { token } = req.query
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host  = req.headers.host

  let html = ''

  try {
    const [shareRes, htmlRes] = await Promise.all([
      supabaseUrl && supabaseKey
        ? fetch(`${supabaseUrl}/rest/v1/rpc/get_wishlist_for_share`, {
            method: 'POST',
            headers: {
              'Content-Type':    'application/json',
              'Content-Profile': 'beta',
              'apikey':          supabaseKey,
              'Authorization':   `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ p_token: token }),
          })
        : Promise.resolve(null),
      fetch(`${proto}://${host}/index.html`),
    ])

    html = await htmlRes.text()

    if (shareRes) {
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

        const esc = s => String(s)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

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
    // Fall through — if html is empty, fetch index.html directly as fallback
    if (!html) {
      try {
        const proto = req.headers['x-forwarded-proto'] || 'https'
        const fallback = await fetch(`${proto}://${req.headers.host}/index.html`)
        html = await fallback.text()
      } catch (_) {
        html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>'
      }
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  res.send(html)
}
