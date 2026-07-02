/**
 * Regression guard for the PPR email-route authorization fix (audit H-1).
 *
 * The five PPR email routes read the target entry with the service-role client
 * (RLS bypass), so they MUST re-check permission + base access in-handler.
 * This suite locks two invariants:
 *   1. `callerCanActOnPpr` denies unless the caller has base access AND at
 *      least one of the allowed permissions (and short-circuits on base miss).
 *   2. All five routes actually call the gate — a source scan so the check
 *      can't be silently dropped in a future refactor.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { callerCanActOnPpr, PPR_EMAIL_PERMS } from '@/lib/ppr-authorize'

function fakeAdmin(opts: { baseOk?: boolean; perms?: readonly string[] }) {
  const calls: { fn: string; key?: string }[] = []
  const client = {
    calls,
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, key: args.p_key as string | undefined })
      if (fn === 'user_has_base_access') return Promise.resolve({ data: opts.baseOk === true, error: null })
      if (fn === 'user_has_permission') {
        return Promise.resolve({ data: (opts.perms ?? []).includes(args.p_key as string), error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
  }
  return client as unknown as SupabaseClient & { calls: { fn: string; key?: string }[] }
}

const U = '00000000-0000-0000-0000-000000000001'
const B = '00000000-0000-0000-0000-0000000000b1'

describe('callerCanActOnPpr', () => {
  it('denies when the caller has no access to the base — and does not check permissions', async () => {
    const admin = fakeAdmin({ baseOk: false, perms: ['ppr:approve'] })
    expect(await callerCanActOnPpr(admin, U, B, PPR_EMAIL_PERMS.approval)).toBe(false)
    // Short-circuit: base access failing must skip the permission RPC entirely.
    expect(admin.calls.some((c) => c.fn === 'user_has_permission')).toBe(false)
  })

  it('denies when the caller has base access but none of the required permissions', async () => {
    const admin = fakeAdmin({ baseOk: true, perms: ['ppr:read'] })
    expect(await callerCanActOnPpr(admin, U, B, PPR_EMAIL_PERMS.approval)).toBe(false)
  })

  it('allows when the caller has base access and a matching permission', async () => {
    const admin = fakeAdmin({ baseOk: true, perms: ['ppr:approve'] })
    expect(await callerCanActOnPpr(admin, U, B, PPR_EMAIL_PERMS.approval)).toBe(true)
  })

  it('denial route accepts EITHER ppr:triage OR ppr:approve', async () => {
    const triager = fakeAdmin({ baseOk: true, perms: ['ppr:triage'] })
    const approver = fakeAdmin({ baseOk: true, perms: ['ppr:approve'] })
    const readonly = fakeAdmin({ baseOk: true, perms: ['ppr:read'] })
    expect(await callerCanActOnPpr(triager, U, B, PPR_EMAIL_PERMS.denial)).toBe(true)
    expect(await callerCanActOnPpr(approver, U, B, PPR_EMAIL_PERMS.denial)).toBe(true)
    expect(await callerCanActOnPpr(readonly, U, B, PPR_EMAIL_PERMS.denial)).toBe(false)
  })

  it('coordination-request requires ppr:triage; a ppr:write-only user is denied', async () => {
    const writer = fakeAdmin({ baseOk: true, perms: ['ppr:write'] })
    const triager = fakeAdmin({ baseOk: true, perms: ['ppr:triage'] })
    expect(await callerCanActOnPpr(writer, U, B, PPR_EMAIL_PERMS.coordinationRequest)).toBe(false)
    expect(await callerCanActOnPpr(triager, U, B, PPR_EMAIL_PERMS.coordinationRequest)).toBe(true)
  })

  it('returns false without any RPC when inputs are empty', async () => {
    const admin = fakeAdmin({ baseOk: true, perms: ['ppr:approve'] })
    expect(await callerCanActOnPpr(admin, '', B, PPR_EMAIL_PERMS.approval)).toBe(false)
    expect(await callerCanActOnPpr(admin, U, '', PPR_EMAIL_PERMS.approval)).toBe(false)
    expect(await callerCanActOnPpr(admin, U, B, [])).toBe(false)
    expect(admin.calls.length).toBe(0)
  })
})

describe('PPR email routes call the authorization gate (source scan)', () => {
  const routes = [
    'send-ppr-approval',
    'send-ppr-denial',
    'send-ppr-cancellation',
    'send-ppr-update',
    'send-ppr-coordination-request',
  ]
  for (const route of routes) {
    it(`${route} imports and calls callerCanActOnPpr`, () => {
      const src = readFileSync(join(process.cwd(), 'app', 'api', route, 'route.ts'), 'utf8')
      expect(src).toContain("from '@/lib/ppr-authorize'")
      expect(src).toMatch(/callerCanActOnPpr\(\s*reader\s*,\s*user\.id\s*,\s*entry\.base_id\s*,/)
      // The gate must return 403 on failure.
      expect(src).toContain('status: 403')
    })
  }
})
