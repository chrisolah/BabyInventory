// Shared CORS headers for Edge Functions called from the browser.
// Mirrors what Supabase's CLI-generated functions use by default. We
// intentionally allow any origin here because the Edge Function is still
// JWT-gated — origin checks don't buy us anything on top of signed requests.
//
// The `content-profile` / `accept-profile` / `x-supabase-api-version` entries
// are added because supabase-js inherits our `db: { schema: 'beta' }` client
// config and forwards those PostgREST schema-selection headers on every
// outbound request — including `functions.invoke`. If they're missing from
// this list, the browser's preflight OPTIONS fails with "Request header field
// content-profile is not allowed by Access-Control-Allow-Headers" and the
// whole call is blocked before it reaches the function. That was the real
// cause of our mysterious FunctionsFetchError on mobile and desktop alike.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, content-profile, accept-profile, x-supabase-api-version, prefer, range',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
