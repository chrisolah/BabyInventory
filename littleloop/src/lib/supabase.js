import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Schema switches automatically based on environment:
// - local dev and beta branch → 'beta' schema
// - main branch / production build → 'production' schema
const schema = import.meta.env.VITE_SCHEMA || 'beta'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export const currentSchema = schema
export const currentEnv = import.meta.env.VITE_ENV || 'development'
