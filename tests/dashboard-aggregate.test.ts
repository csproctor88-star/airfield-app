import { describe, it, expect } from 'vitest'
import { aggregate, applyFilters, timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import type { Measure, QuerySpec } from '@/lib/dashboard/analytics/types'

const measures: Measure[] = [
  { key: 'count', label: 'Count', kind: 'count' },
  { key: 'avg_days', label: 'Avg days', kind: 'avg', field: 'days' },
  { key: 'sum_days', label: 'Total days', kind: 'sum', field: 'days' },
]
const rows = [
  { shop: 'CES', status: 'open', days: 2 },
  { shop: 'CES', status: 'open', days: 4 },
  { shop: 'AM', status: 'closed', days: 10 },
]
const dim = (r: Record<string, unknown>, k: string) => String(r[k] ?? '—')

describe('aggregate', () => {
  it('count with no groupBy returns a single total', () => {
    const spec = { dataset: 'd', measure: 'count', chart: 'number' } as QuerySpec
    expect(aggregate(rows, spec, measures, dim)).toEqual({ labels: ['Total'], values: [3] })
  })
  it('count grouped by a dimension', () => {
    const spec = { dataset: 'd', measure: 'count', groupBy: 'shop', chart: 'bar' } as QuerySpec
    const out = aggregate(rows, spec, measures, dim)
    expect(out.labels).toEqual(['CES', 'AM'])
    expect(out.values).toEqual([2, 1])
  })
  it('avg measure averages the field per group', () => {
    const spec = { dataset: 'd', measure: 'avg_days', groupBy: 'shop', chart: 'bar' } as QuerySpec
    const out = aggregate(rows, spec, measures, dim)
    expect(out.labels).toEqual(['CES', 'AM'])
    expect(out.values).toEqual([3, 10])
  })
  it('sum measure totals the field overall', () => {
    const spec = { dataset: 'd', measure: 'sum_days', chart: 'number' } as QuerySpec
    expect(aggregate(rows, spec, measures, dim)).toEqual({ labels: ['Total'], values: [16] })
  })
  it('unknown measure throws', () => {
    const spec = { dataset: 'd', measure: 'nope', chart: 'number' } as QuerySpec
    expect(() => aggregate(rows, spec, measures, dim)).toThrow()
  })
})

describe('applyFilters', () => {
  it('eq keeps matching rows', () => {
    expect(applyFilters(rows, [{ field: 'status', op: 'eq', value: 'open' }])).toHaveLength(2)
  })
  it('neq drops matching rows', () => {
    expect(applyFilters(rows, [{ field: 'status', op: 'neq', value: 'open' }])).toHaveLength(1)
  })
  it('no filters returns all', () => {
    expect(applyFilters(rows, [])).toHaveLength(3)
    expect(applyFilters(rows, undefined)).toHaveLength(3)
  })
})

describe('timePresetSince', () => {
  it('returns null for all/undefined', () => {
    expect(timePresetSince('all', 1_000_000)).toBeNull()
    expect(timePresetSince(undefined, 1_000_000)).toBeNull()
  })
  it('7d returns now minus 7 days as ISO', () => {
    const now = Date.parse('2026-06-27T00:00:00Z')
    expect(timePresetSince('7d', now)).toBe(new Date(now - 7 * 86_400_000).toISOString())
  })
})
