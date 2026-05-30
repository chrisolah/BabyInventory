import fs from 'fs'
import path from 'path'

// Read the built index.html once at cold-start — faster than an HTTP self-fetch
// and avoids any rewrite/routing complications.
function getIndexHtml() {
  // Vercel deploys the Vite output directory as the static root.
  // In the serverless function runtime, static assets live at process.cwd().
  const candidates = [
    path.join(process.cwd(), 'index.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), '..', 'index.html'),
  ]
  for (const p of candidates) {
    try { return fs.readFileSync(p, 'utf-8') } catch (_) {}
  }
  return null
}

export default async function handler(req, res) {
  const { token } = req.query

  // Always return HTML — social scrapers and real users both get the same page.
  let html = getIndexHtml()
  let ogStatus = 'no_html'

  if (html) {
    ogStatus = 'html_ok'
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      try {
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
          const esc = s => String(s)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')

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

          ogStatus = 'injected'
        } else {
          ogStatus = `supabase_error:${data?.error || 'unknown'}`
        }
      } catch (e) {
        ogStatus = `fetch_error:${e.message}`
      }
    } else {
      ogStatus = 'no_env_vars'
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('x-og-status', ogStatus) // visible in browser devtools Network tab
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')

  if (!html) {
    // Nothing worked — redirect to let Vercel serve index.html normally
    return res.redirect(302, `/wishlist/${token}?fallback=1`)
  }

  res.send(html)
}
