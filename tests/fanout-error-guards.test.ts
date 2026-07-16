// Regression guards for the 2026-07-16 fan-out silent-error sweep.
// Each test pins an invariant that used to fail silently:
//  - setActivePlan must NOT set the target active when clearing the old
//    active flags failed (would leave two active plans).
//  - createWaiverReview must roll the review row back when stamping the
//    waiver's review dates fails (otherwise a retry duplicates the review
//    while the waiver still shows overdue).
//  - upsertWaiverCriteria must stop when the clear-delete fails (otherwise
//    the reinsert duplicates every criteria row).
import { describe, it, expect, vi, beforeEach } from 'vitest'

type Call = {
  table: string
  op: 'select' | 'update' | 'delete' | 'insert'
  payload?: unknown
  filters: Array<{ kind: string; arg: unknown; arg2?: unknown }>
}

const calls: Call[] = []
// Decide the awaited result of a chain (both thenable awaits and .single()).
let resolveCall: (call: Call) => { data?: unknown; error: { message: string } | null }

function makeBuilder(table: string) {
  let current: Call | null = null
  const builder: Record<string, unknown> = {}

  for (const op of ['select', 'update', 'delete', 'insert'] as const) {
    builder[op] = vi.fn((payload?: unknown) => {
      // .insert(rows).select() chains: keep the insert call, ignore the
      // trailing select's own recording by only tracking ops with payload
      // semantics once.
      if (op === 'select' && current?.op === 'insert') return builder
      current = { table, op, payload, filters: [] }
      calls.push(current)
      return builder
    })
  }
  for (const kind of ['eq', 'in', 'is', 'neq'] as const) {
    builder[kind] = vi.fn((col: string, val?: unknown) => {
      current?.filters.push({ kind, arg: col, arg2: val })
      return builder
    })
  }
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(async () => (current ? resolveCall(current) : { data: null, error: null }))
  builder.maybeSingle = builder.single
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve(current ? resolveCall(current) : { data: null, error: null })

  return builder
}

const supabaseStub = {
  from: vi.fn((table: string) => makeBuilder(table)),
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
}

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseStub }))
vi.mock('../lib/supabase/client', () => ({ createClient: () => supabaseStub }))

import { setActivePlan } from '@/lib/supabase/parking'
import { createWaiverReview, upsertWaiverCriteria } from '@/lib/supabase/waivers'

beforeEach(() => {
  calls.length = 0
  resolveCall = () => ({ data: null, error: null })
})

describe('setActivePlan (single-active-plan invariant)', () => {
  it('clears old flags first, then activates the target', async () => {
    resolveCall = () => ({ data: null, error: null })
    const ok = await setActivePlan('plan-2', 'base-1')
    expect(ok).toBe(true)
    const updates = calls.filter((c) => c.table === 'parking_plans' && c.op === 'update')
    expect(updates).toHaveLength(2)
    expect(updates[0].payload).toMatchObject({ is_active: false })
    expect(updates[1].payload).toMatchObject({ is_active: true })
    expect(updates[1].filters).toContainEqual({ kind: 'eq', arg: 'id', arg2: 'plan-2' })
  })

  it('returns false and never activates the target when the clear step fails', async () => {
    resolveCall = (call) =>
      call.op === 'update' && (call.payload as { is_active?: boolean })?.is_active === false
        ? { error: { message: 'rls denial' } }
        : { data: null, error: null }
    const ok = await setActivePlan('plan-2', 'base-1')
    expect(ok).toBe(false)
    const activate = calls.find(
      (c) => c.op === 'update' && (c.payload as { is_active?: boolean })?.is_active === true,
    )
    expect(activate).toBeUndefined()
  })
})

describe('createWaiverReview (review-date stamp rollback)', () => {
  it('rolls the review row back and errors when the waiver stamp fails', async () => {
    resolveCall = (call) => {
      if (call.table === 'waiver_reviews' && call.op === 'insert') {
        return { data: { id: 'rev-1', review_date: '2026-07-16' }, error: null }
      }
      if (call.table === 'waivers' && call.op === 'update') {
        return { error: { message: 'row-level security' } }
      }
      return { data: null, error: null }
    }
    const res = await createWaiverReview({ waiver_id: 'w-1', review_year: 2026 })
    expect(res.data).toBeNull()
    expect(res.error).toBeTruthy()
    const rollback = calls.find((c) => c.table === 'waiver_reviews' && c.op === 'delete')
    expect(rollback).toBeTruthy()
    expect(rollback?.filters).toContainEqual({ kind: 'eq', arg: 'id', arg2: 'rev-1' })
  })

  it('keeps the review and stamps the waiver on the happy path', async () => {
    resolveCall = (call) =>
      call.table === 'waiver_reviews' && call.op === 'insert'
        ? { data: { id: 'rev-1', review_date: '2026-07-16' }, error: null }
        : { data: null, error: null }
    const res = await createWaiverReview({ waiver_id: 'w-1', review_year: 2026 })
    expect(res.error).toBeNull()
    expect(res.data).toBeTruthy()
    const stamp = calls.find((c) => c.table === 'waivers' && c.op === 'update')
    expect(stamp?.payload).toMatchObject({ next_review_due: '2027-02-01' })
    expect(calls.find((c) => c.table === 'waiver_reviews' && c.op === 'delete')).toBeUndefined()
  })
})

describe('upsertWaiverCriteria (clear-then-reinsert guard)', () => {
  it('stops with an error and never reinserts when the clear-delete fails', async () => {
    resolveCall = (call) =>
      call.table === 'waiver_criteria' && call.op === 'delete'
        ? { error: { message: 'permission denied' } }
        : { data: null, error: null }
    const res = await upsertWaiverCriteria('w-1', [
      { criteria_reference: 'ref', description: 'd' } as never,
    ])
    expect(res.error).toBeTruthy()
    expect(calls.find((c) => c.table === 'waiver_criteria' && c.op === 'insert')).toBeUndefined()
  })
})
