// Playwright globalSetup: runs once before the entire test run.
//
// We wipe the beta Supabase DB (auth users + app tables) so every run starts
// from a deterministic empty state. This is heavy-handed — it also clears
// anything Chris put in during manual testing — but given the suite is tiny
// and we're pre-launch, that's the right trade-off until we introduce a
// dedicated test schema.

import { wipeBeta } from './support/db.js'

export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log('[e2e] wiping beta schema + auth users…')
  const started = Date.now()
  await wipeBeta()
  // eslint-disable-next-line no-console
  console.log(`[e2e] wipe complete (${Date.now() - started}ms)`)
}
