// Cloudflare Pages Function — intercepts /wishlist/:token requests and
// injects wishlist-specific OG meta tags before serving index.html.
// Social scrapers (Facebook, iMessage, WhatsApp, Slack, etc.) see the
// correct title + description for each share link.

export async function onRequest(context) {
  const { params, env, request } = context
  const token = params.token

  // Always fetch the base index.html from the Pages asset bundle
  const assetReq = new Request(new URL('/index.html', request.url).toString())
  const indexRes = await env.ASSETS.fetch(assetReq)
  let html = await indexRes.text()

  try {
    const supabaseUrl = env.VITE_SUPABASE_URL
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
    }

    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/get_wishlist_for_share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Profile': 'beta',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ p_token: token }),
    })

    const data = await rpcRes.json()

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

      // Escape special HTML characters to prevent broken markup
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

      // Strip the generic title + description and inject wishlist-specific ones
      html = html
        .replace(/<title>[^<]*<\/title>/, '')
        .replace(/<meta name="description"[^>]*>/, '')
        .replace('</head>', `    ${inject}\n  </head>`)
    }
  } catch (_) {
    // Silently fall through — serve plain index.html on any error
  }

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  })
}
