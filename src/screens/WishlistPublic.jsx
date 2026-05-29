// Public wishlist recipient page — no auth required.
// Full implementation: task #15 (recipient UI + per-unit claiming).
// This stub resolves the /wishlist/:token URL so share links don't 404.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase, currentSchema } from '../lib/supabase'

export default function WishlistPublic() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: result, error } = await supabase
        .schema(currentSchema)
        .rpc('get_wishlist_for_share', { p_token: token })
      if (error || result?.error) {
        setNotFound(true)
      } else {
        setData(result)
      }
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#6b7280' }}>
        Loading…
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🍃</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: '#111827', marginBottom: 8 }}>This wishlist isn't available</div>
        <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 280 }}>The link may have expired or been deactivated.</p>
      </div>
    )
  }

  // Full recipient UI coming in task #15. For now just confirm the link works.
  const householdName = data?.household?.name || 'This family'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '24px' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#111827', marginBottom: 8 }}>{householdName}&rsquo;s Wishlist</div>
      {data?.share?.message && (
        <p style={{ fontSize: 14, color: '#374151', maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>{data.share.message}</p>
      )}
      <p style={{ fontSize: 13, color: '#9ca3af' }}>Full wishlist view coming soon.</p>
    </div>
  )
}
