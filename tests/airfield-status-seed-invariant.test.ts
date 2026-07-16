import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Guard for the KFAR status-board bug (2026-07-16): 37 of 64 bases had no
// airfield_status row — nothing reliable ever created one — and every
// status-board save on those bases failed with "Could not save the airfield
// status change" (updateAirfieldStatus bails when the row lookup is empty).
// Migration 2026071600 backfilled the fleet and added the
// bases_seed_airfield_status AFTER INSERT trigger on bases.
//
// The fixture bases are created by supabase/seed-test-accounts.mjs through a
// plain `bases` INSERT, so this doubles as a trigger regression check: drop
// the trigger and the next fixture reseed produces a base with no status row,
// failing here. Env-gated exactly like rls-cross-base-isolation.test.ts.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const password = process.env.TEST_RLS_PASSWORD
const baseA = process.env.TEST_RLS_BASE_A
const baseB = process.env.TEST_RLS_BASE_B
const gated = !url || !anon || !password || !baseA || !baseB || url.includes('your-project')

const DOMAIN = 'glidepath-rls-test.com'

async function signIn(email: string) {
  const client = createClient(url!, anon!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: password! })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return client
}

describe.skipIf(gated)('airfield_status seed invariant', () => {
  const cases: Array<[string, string, string | undefined]> = [
    ['base A', `rls-writer-a@${DOMAIN}`, baseA],
    ['base B', `rls-writer-b@${DOMAIN}`, baseB],
  ]

  it.each(cases)('%s has exactly one airfield_status row visible to its member', async (_label, email, baseId) => {
    const client = await signIn(email)
    const { data, error } = await client
      .from('airfield_status')
      .select('id')
      .eq('base_id', baseId!)
    expect(error).toBeNull()
    // Missing row = the KFAR bug (every board save fails). More than one =
    // the partial unique index on base_id was dropped.
    expect(data ?? []).toHaveLength(1)
  })
})
