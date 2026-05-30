import { describe, it, expect, vi } from 'vitest'
import { buildTableModuleFiles, periodSubtitle } from '@/lib/export/export-pdf'
import { DISCREPANCIES_SPEC } from '@/lib/export/export-table-specs'

type Row = { display_id: string; status: string; type: string; title: string; location_text: string; assigned_shop: string | null; work_order_number: string | null; created_at: string; reporter?: { name: string | null; rank: string | null } | null }

const rows: Row[] = [
  { display_id: 'DSC-1', status: 'open',   type: 'Pavement', title: 'Crack',    location_text: 'RW05', assigned_shop: 'Pavements', work_order_number: 'WO1', created_at: '2026-01-10T00:00:00Z', reporter: { name: 'Doe', rank: 'MSgt' } },
  { display_id: 'DSC-2', status: 'closed', type: 'Lighting', title: 'Light out',location_text: 'TWY A', assigned_shop: 'Electric',  work_order_number: null,  created_at: '2026-02-05T00:00:00Z', reporter: null },
  { display_id: 'DSC-3', status: 'open',   type: 'Signage',  title: 'Sign bent',location_text: 'TWY B', assigned_shop: null,        work_order_number: null,  created_at: '2026-02-20T00:00:00Z', reporter: { name: 'Roe', rank: null } },
]

const ctxBase = { baseName: 'Test AAF', baseIcao: 'KTST' }

describe('periodSubtitle', () => {
  it('labels all-time', () => {
    expect(periodSubtitle({ kind: 'all_time' })).toBe('All time')
  })
  it('labels a range with "to" (not an arrow — the core PDF font cannot render →)', () => {
    expect(periodSubtitle({ kind: 'range', from: '2026-01-01', to: '2026-03-31' }))
      .toBe('2026-01-01 to 2026-03-31')
  })
})

describe('buildTableModuleFiles — aggregate', () => {
  it('produces one PDF at documents/<folder>.pdf for all-time', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate',
    })
    expect(files.map((f) => f.path)).toEqual(['documents/Discrepancies.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('filters by range before rendering', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' }, outputMode: 'aggregate',
    })
    expect(files).toHaveLength(1) // 2 Feb rows still → one aggregate file
  })

  it('returns no files when nothing matches the range', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' }, outputMode: 'aggregate',
    })
    expect(files).toEqual([])
  })
})

describe('buildTableModuleFiles — monthly', () => {
  it('produces one PDF per month at documents/<folder>/YYYY-MM.pdf', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'all_time' }, outputMode: 'monthly',
    })
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/Discrepancies/2026-01.pdf',
      'documents/Discrepancies/2026-02.pdf',
    ])
  })
})

describe('buildTableModuleFiles — error boundary', () => {
  it('returns [] instead of throwing when a spec mapper throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const badSpec = { ...DISCREPANCIES_SPEC, toRow: () => { throw new Error('boom') } }
    const files = buildTableModuleFiles(rows, badSpec, {
      ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate',
    })
    expect(files).toEqual([])
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
