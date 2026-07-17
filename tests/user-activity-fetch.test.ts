// fetchUserActivityData — fetch-level contract guards.
//  - base_members (zero-activity opt-in) failures degrade gracefully: the
//    report still returns the real activity, flagged zeroActivityUnavailable,
//    instead of throwing (binding handoff from the data-module review).
//  - Domain/profile fetch failures still throw — the all-or-nothing contract
//    for the report's actual counted data is unchanged by that handoff.
import { describe, it, expect, vi, beforeEach } from 'vitest'

type TableResult = { data?: unknown; error?: { message: string } | null }

let resultsByTable: Record<string, TableResult> = {}

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'order'] as const) {
    builder[method] = vi.fn(() => builder)
  }
  builder.then = (resolve: (v: TableResult) => unknown) =>
    resolve(resultsByTable[table] ?? { data: [], error: null })
  return builder
}

const supabaseStub = { from: vi.fn((table: string) => makeBuilder(table)) }

vi.mock('@/lib/supabase/client', () => ({ createClient: () => supabaseStub }))
vi.mock('../lib/supabase/client', () => ({ createClient: () => supabaseStub }))

import { fetchUserActivityData } from '@/lib/reports/user-activity-data'

const START = '2026-07-01T00:00:00.000Z'
const END = '2026-07-31T23:59:59.999Z'

const checkRecord = {
  id: 'c1', completed_by_id: 'uuid-1', completed_by: null,
  completed_at: '2026-07-15T00:00:00.000Z', display_id: 'AC-0001',
}
const janeProfile = {
  id: 'uuid-1', name: 'Jane Doe', rank: 'SSgt', operating_initials: 'JD',
  role: 'namo', is_active: true,
}

beforeEach(() => {
  resultsByTable = {}
})

describe('fetchUserActivityData — base_members graceful degrade', () => {
  it('does not abort the report when base_members fails; flags zeroActivityUnavailable', async () => {
    resultsByTable = {
      airfield_checks: { data: [checkRecord], error: null },
      base_members: { data: null, error: { message: 'permission denied' } },
      profiles: { data: [janeProfile], error: null },
    }
    const result = await fetchUserActivityData('base-1', START, END, ['checks'], { includeZeroActivity: true })
    expect(result.zeroActivityUnavailable).toBe(true)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].key).toBe('uuid-1')
    expect(result.rows[0].counts.checks).toBe(1)
  })

  it('omits zero-activity rows (none injected) when the member lookup fails, but keeps real rows', async () => {
    resultsByTable = {
      airfield_checks: { data: [checkRecord], error: null },
      base_members: { data: null, error: { message: 'permission denied' } },
      profiles: { data: [janeProfile, { id: 'uuid-2', name: 'Bob Adams', rank: 'SrA', operating_initials: 'BA', role: 'namo', is_active: true }], error: null },
    }
    const result = await fetchUserActivityData('base-1', START, END, ['checks'], { includeZeroActivity: true })
    // Only the row with counted activity is present — no all-zero injection.
    expect(result.rows.map((r) => r.key)).toEqual(['uuid-1'])
  })

  it('succeeds normally (no notice) when base_members is readable', async () => {
    resultsByTable = {
      airfield_checks: { data: [checkRecord], error: null },
      base_members: { data: [{ user_id: 'uuid-2' }], error: null },
      profiles: {
        data: [janeProfile, { id: 'uuid-2', name: 'Bob Adams', rank: 'SrA', operating_initials: 'BA', role: 'namo', is_active: true }],
        error: null,
      },
    }
    const result = await fetchUserActivityData('base-1', START, END, ['checks'], { includeZeroActivity: true })
    expect(result.zeroActivityUnavailable).toBeUndefined()
    expect(result.rows.map((r) => r.key).sort()).toEqual(['uuid-1', 'uuid-2'])
  })
})

describe('fetchUserActivityData — domain/profile failures still throw (unchanged all-or-nothing contract)', () => {
  it('throws on a domain fetch failure', async () => {
    resultsByTable = { airfield_checks: { data: null, error: { message: 'boom' } } }
    await expect(
      fetchUserActivityData('base-1', START, END, ['checks']),
    ).rejects.toThrow(/User activity fetch failed \(checks\)/)
  })

  it('throws on a profiles fetch failure', async () => {
    resultsByTable = {
      airfield_checks: { data: [checkRecord], error: null },
      profiles: { data: null, error: { message: 'nope' } },
    }
    await expect(
      fetchUserActivityData('base-1', START, END, ['checks']),
    ).rejects.toThrow(/User activity fetch failed \(profiles\)/)
  })
})
