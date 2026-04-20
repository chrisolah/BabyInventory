import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const schema = import.meta.env.VITE_SCHEMA || 'beta'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema },
  global: {
    headers: {
      'Accept-Profile': schema,
      'Content-Profile': schema,
    },
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

export const currentSchema = schema
export const currentEnv = import.meta.env.VITE_ENV || 'development'