// Shared CORS headers for Edge Functions called from the browser.
// Mirrors what Supabase's CLI-generated functions use by default. We
// intentionally allow any origin here because the Edge Function is still
// JWT-gated — origin checks don't buy us anything on top of signed requests.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
