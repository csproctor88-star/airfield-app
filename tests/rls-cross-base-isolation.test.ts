import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Executable proof of the database's cross-base security wall — the property the
// whole multi-tenant model depends on: a user signed into one base can neither
// READ nor WRITE another base's records, and a read-only user cannot write even
// to their own base. The previous rls-smoke test only checked that a logged-OUT
// stranger is blocked; this signs in as real seeded users and exercises the
// authenticated cross-base paths the RLS policies actually gate.
//
// Requires the seeded fixtures + creds from supabase/seed-test-accounts.mjs
// (writes TEST_RLS_* into .env.local). Skips cleanly when they're absent
// (e.g. CI without secrets), like the other env-gated suites.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const password = process.env.TEST_RLS_PASSWORD
const baseA = process.env.TEST_RLS_BASE_A
const baseB = process.env.TEST_RLS_BASE_B
const gated = !url || !anon || !password || !baseA || !baseB || url.includes('your-project')

const DOMAIN = 'glidepath-rls-test.com'
const WRITER_A = `rls-writer-a@${DOMAIN}`
const READONLY_A = `rls-readonly-a@${DOMAIN}`
const WRITER_B = `rls-writer-b@${DOMAIN}`

async function signIn(email: string) {
  const client = createClient(url!, anon!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: password! })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return client
}

function fixtureRow(base: string, tag: string) {
  return {
    display_id: `__TESTRLS_${tag}_${Date.now()}__`,
    type: 'other',
    title: 'rls test',
    description: 'x',
    location_text: 'x',
    base_id: base,
  }
}

describe.skipIf(gated)('cross-base RLS isolation', () => {
  it('reads own base but NOT another base (base A user)', async () => {
    const client = await signIn(WRITER_A)
    const own = await client.from('discrepancies').select('id').eq('base_id', baseA!)
    expect(own.error).toBeNull()
    expect((own.data ?? []).length).toBeGreaterThanOrEqual(1)
    // Base B HAS a seeded discrepancy — a non-empty result here would be a leak.
    const other = await client.from('discrepancies').select('id').eq('base_id', baseB!)
    expect(other.error).toBeNull()
    expect(other.data ?? []).toHaveLength(0)
  })

  it('reads own base but NOT another base (base B user — symmetric)', async () => {
    const client = await signIn(WRITER_B)
    const own = await client.from('discrepancies').select('id').eq('base_id', baseB!)
    expect((own.data ?? []).length).toBeGreaterThanOrEqual(1)
    const other = await client.from('discrepancies').select('id').eq('base_id', baseA!)
    expect(other.data ?? []).toHaveLength(0)
  })

  it('read-only user cannot write to its own base', async () => {
    const client = await signIn(READONLY_A)
    const { error } = await client.from('discrepancies').insert(fixtureRow(baseA!, 'RO'))
    expect(error).not.toBeNull() // INSERT policy requires discrepancies:write
  })

  it('writer cannot create rows in a base it does not belong to', async () => {
    const client = await signIn(WRITER_A)
    const { error } = await client.from('discrepancies').insert(fixtureRow(baseB!, 'XB'))
    expect(error).not.toBeNull() // no base access to B
  })

  it('writer CAN create then remove a row in its own base (positive control)', async () => {
    const client = await signIn(WRITER_A)
    const ins = await client.from('discrepancies').insert(fixtureRow(baseA!, 'OK')).select('id').single()
    expect(ins.error).toBeNull()
    if (ins.data?.id) await client.from('discrepancies').delete().eq('id', ins.data.id)
  })
})

// Regression guards for the 2026-06-06 pentest findings (migration 2026062011).
// Each asserts the exact hole that was open is now closed. Do not loosen without
// understanding which cross-tenant breach the assertion protects.
describe.skipIf(gated)('pentest remediation guards', () => {
  // #1 — self privilege-escalation. THE critical finding: any user could set
  // their own role to sys_admin via a direct profiles UPDATE.
  it('a low-priv user cannot escalate their own role to sys_admin', async () => {
    const client = await signIn(READONLY_A)
    const { data: me } = await client.auth.getUser()
    const uid = me.user!.id
    const before = (await client.from('profiles').select('role').eq('id', uid).single()).data?.role
    await client.from('profiles').update({ role: 'sys_admin' }).eq('id', uid)
    const after = (await client.from('profiles').select('role').eq('id', uid).single()).data?.role
    expect(after).not.toBe('sys_admin')
    expect(after).toBe(before)
    if (after === 'sys_admin') await client.from('profiles').update({ role: before }).eq('id', uid) // safety revert
  })

  // #3 — base-config tables must not leak other bases (were USING(true)).
  it.each(['base_areas', 'base_navaids', 'base_runways', 'base_arff_aircraft'])(
    'reads no foreign-base rows from %s',
    async (table) => {
      const client = await signIn(READONLY_A)
      const { data, error } = await client.from(table).select('base_id').limit(500)
      expect(error).toBeNull()
      expect((data ?? []).filter((r) => r.base_id && r.base_id !== baseA).length).toBe(0)
    },
  )

  // #2 — profiles is a cross-tenant directory unless scoped to shared bases.
  it('does not expose profiles from other bases', async () => {
    const client = await signIn(READONLY_A)
    const { data: me } = await client.auth.getUser()
    const { data } = await client.from('profiles').select('id, primary_base_id')
    const foreign = (data ?? []).filter((p) => p.primary_base_id && p.primary_base_id !== baseA && p.id !== me.user!.id)
    expect(foreign).toHaveLength(0)
  })

  // #4 — bases must not be enumerable beyond membership.
  it('cannot enumerate the full customer roster via bases', async () => {
    const client = await signIn(READONLY_A)
    const { data } = await client.from('bases').select('id')
    expect((data ?? []).filter((b) => b.id !== baseA)).toHaveLength(0)
  })

  // #5 — NULL-base_id rows must not be readable cross-tenant.
  it.each(['runway_status_log', 'status_updates', 'check_comments', 'activity_log'])(
    'exposes no NULL-base_id rows from %s',
    async (table) => {
      const client = await signIn(READONLY_A)
      const { data, error } = await client.from(table).select('base_id').is('base_id', null).limit(1)
      expect(error).toBeNull()
      expect(data ?? []).toHaveLength(0)
    },
  )
})
