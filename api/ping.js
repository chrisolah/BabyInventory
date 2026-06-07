export default function handler(req, res) {
  res.json({
    ok: true,
    hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
  })
}
