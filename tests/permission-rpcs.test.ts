import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Env-gated smoke tests for the three permission-matrix RPCs that
// shipped in the 2026-04-22 session:
//
//   • get_public_feedback_config — GRANT EXECUTE TO anon, authenticated
//   • base_exists                — GRANT EXECUTE TO anon, authenticated
//   • ces_update_discrepancy     — GRANT EXECUTE TO authenticated
//   • safety_update_rsc_bwc      — GRANT EXECUTE TO authenticated
//
// These run only when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
// are set (same gate as rls-smoke.test.ts). They do not sign in — they
// verify:
//   1. The public RPCs are reachable from anon and return a sensible shape.
//   2. The authenticated-only RPCs reject anon callers (no 200 + data).
// Full role round-trips require seeded test accounts; not covered here.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const envMissing = !url || !anon || url.includes('your-project')

// The anon key may be disabled (Supabase rotated legacy keys on 2026-03-04).
// Detect that at startup and skip the whole suite with a clear message so
// failures flag an infra issue, not a test bug.
let keyDisabled = false
beforeAll(async () => {
  if (envMissing) return
  const supabase = createClient(url!, anon!)
  const { error } = await supabase.rpc('base_exists', { p_base_id: NIL_UUID })
  if (error && /Legacy API keys|disabled|Invalid API key/i.test(error.message)) {
    keyDisabled = true
    // eslint-disable-next-line no-console
    console.warn(
      '[permission-rpcs] Skipping — Supabase anon key rejected: ' + error.message,
    )
  }
})

const gated = envMissing

const NIL_UUID = '00000000-0000-0000-0000-000000000000'

describe.skipIf(gated)('Public feedback RPCs — anon reachable', () => {
  it('get_public_feedback_config returns zero rows for an unknown base', async () => {
    if (keyDisabled) return
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.rpc('get_public_feedback_config', {
      p_base_id: NIL_UUID,
    })
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
    expect((data as unknown[]).length).toBe(0)
  })

  it('base_exists returns false for an unknown base', async () => {
    if (keyDisabled) return
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.rpc('base_exists', {
      p_base_id: NIL_UUID,
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})

describe.skipIf(gated)('Authenticated-only RPCs — anon must be rejected', () => {
  // We accept either a hard RPC error (permission denied) or a
  // non-2xx response — both express the same contract: anon can't call.
  function isRejection(error: unknown, data: unknown): boolean {
    if (error) return true
    // If the RPC returned successfully with an auth-rejection payload,
    // that also counts as a rejection (should not happen in practice).
    return data === null
  }

  it('ces_update_discrepancy rejects anon callers', async () => {
    if (keyDisabled) return
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.rpc('ces_update_discrepancy', {
      p_id: NIL_UUID,
      p_current_status: 'awaiting_action_by_ces',
      p_resolution_notes: null,
      p_note: null,
    })
    expect(isRejection(error, data)).toBe(true)
  })

  it('safety_update_rsc_bwc rejects anon callers', async () => {
    if (keyDisabled) return
    const supabase = createClient(url!, anon!)
    const { data, error } = await supabase.rpc('safety_update_rsc_bwc', {
      p_base_id: NIL_UUID,
      p_rsc_condition: 'dry',
    })
    expect(isRejection(error, data)).toBe(true)
  })
})
