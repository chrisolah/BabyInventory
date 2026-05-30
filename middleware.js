// Vercel Edge Middleware — injects wishlist-specific OG meta tags for
// /wishlist/:token routes so social scrapers (Facebook, iMessage, WhatsApp,
// Slack, etc.) show the correct title + description for each share link.
//
// Runs at the edge before Vercel's SPA rewrite rule. On any error it falls
// through silently and the SPA serves normally.

export const config = {
  matcher: '/wishlist/:token+',
}

export default async function middleware(request) {
  const url = new URL(request.url)
  const token = url.pathname.replace(/^\/wishlist\//, '').split('/')[0]
  if (!token) return

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return

  try {
    const [shareRes, htmlRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/rpc/get_wishlist_for_share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Profile': 'beta',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ p_token: token }),
      }),
      fetch(new URL('/index.html', url.origin)),
    ])

    const data = await shareRes.json()
    let html = await htmlRes.text()

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

      return new Response(html, {
        headers: { 'content-type': 'text/html;charset=utf-8' },
      })
    }
  } catch (_) {
    // Fall through to normal SPA serving
  }
}
