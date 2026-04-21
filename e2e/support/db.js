// Service-role-backed helpers used by e2e setup.
//
// Why service role, not anon: wiping between runs needs to bypass RLS and
// delete auth users. The service role key is never exposed to the browser
// during tests — it lives only in the Playwright Node process.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SCHEMA = process.env.VITE_SCHEMA || 'beta'

if (!SUPABASE_URL) {
  throw new Error(
    'e2e/support/db.js: missing VITE_SUPABASE_URL (or SUPABASE_URL). ' +
    'Add it to .env.local.'
  )
}
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    'e2e/support/db.js: missing SUPABASE_SERVICE_ROLE_KEY. ' +
    'Grab it from Supabase Dashboard → Project Settings → API → service_role, ' +
    'then add it to .env.local. Never commit this key.'
  )
}

// One admin client, scoped to the test schema via Accept/Content-Profile so
// .from('foo') targets `beta.foo` without needing schema-qualified names.
export const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { schema: SCHEMA },
  global: {
    headers: {
      'Accept-Profile': SCHEMA,
      'Content-Profile': SCHEMA,
    },
  },
  auth: { persistSession: false, autoRefreshToken: false },
})

// Tables listed in delete order. household_members + user_activity_summary are
// usually cascaded when we wipe auth.users, but we delete explicitly too so a
// partial previous run can't leave orphan rows behind.
//
// events is wiped last because other writes may emit analytics rows.
const APP_TABLES = [
  'household_members',
  'babies',
  'households',
  'user_activity_summary',
  'events',
]

// PK column name per table — needed because PostgREST refuses unbounded DELETE;
// we pass a "where pk is not null" filter that matches every row.
const PK_BY_TABLE = {
  household_members: 'id',
  babies: 'id',
  households: 'id',
  user_activity_summary: 'user_id',
  events: 'id',
}

/**
 * Delete every auth user. Cascades clear user_activity_summary + household_members
 * via on-delete-cascade FKs, which is why we do users first.
 */
async function wipeAuthUsers() {
  // admin.listUsers is paginated. Default perPage is 50; bump up so a single
  // call usually suffices for our test volumes.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 })
  if (error) throw new Error(`listUsers failed: ${error.message}`)

  for (const user of data.users) {
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      // Don't throw on individual failures — we want the rest to clean up.
      // eslint-disable-next-line no-console
      console.warn(`[wipe] deleteUser ${user.id} failed: ${delErr.message}`)
    }
  }
}

/**
 * Delete every row from the app tables in the configured schema.
 * Safe to call even if some tables are already empty.
 */
async function wipeAppTables() {
  for (const table of APP_TABLES) {
    const pk = PK_BY_TABLE[table]
    const { error } = await admin.from(table).delete().not(pk, 'is', null)
    if (error) {
      // Missing-table errors we swallow; anything else is loud.
      if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
        // eslint-disable-next-line no-console
        console.warn(`[wipe] skipping ${table}: not present in ${SCHEMA}`)
        continue
      }
      throw new Error(`wipe ${SCHEMA}.${table} failed: ${error.message}`)
    }
  }
}

/**
 * Full wipe: auth users first (cascades), then anything left in app tables.
 */
export async function wipeBeta() {
  if (SCHEMA === 'production') {
    throw new Error('Refusing to wipe production schema. Set VITE_SCHEMA=beta.')
  }
  await wipeAuthUsers()
  await wipeAppTables()
}
