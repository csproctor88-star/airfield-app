import { describe, it, expect } from 'vitest'
import {
  generateInspectionReportsPdf,
  buildInspectionFiles,
  type InspectionReportLike,
} from '@/lib/export/export-inspection-pdf'

function insp(id: string, createdAt: string, items: InspectionReportLike['items'] = []): InspectionReportLike {
  return {
    display_id: id,
    inspection_type: 'airfield',
    inspection_date: createdAt.slice(0, 10),
    inspector_name: 'MSgt Doe',
    status: 'completed',
    completion_percent: 100,
    items,
    notes: null,
    created_at: createdAt,
  }
}

const ctx = { period: { kind: 'all_time' as const }, outputMode: 'aggregate' as const, baseName: 'Test AAF', baseIcao: 'KTST' }

describe('generateInspectionReportsPdf', () => {
  it('returns null with no inspections', () => {
    expect(generateInspectionReportsPdf([], { baseName: 'X', baseIcao: 'Y' })).toBeNull()
  })

  it('renders a multi-page doc (one page per inspection)', () => {
    const doc = generateInspectionReportsPdf(
      [insp('AC-1', '2026-05-01T00:00:00Z'), insp('AC-2', '2026-05-02T00:00:00Z')],
      { baseName: 'Test AAF', baseIcao: 'KTST' },
    )!
    expect(doc).not.toBeNull()
    expect(doc.getNumberOfPages()).toBe(2)
  })

  it('renders an inspection with checklist items without throwing', () => {
    const items = [
      { category: 'Pavement', text: 'Cracks/spalling', status: 'sat', notes: '' },
      { category: 'Pavement', text: 'FOD', status: 'sat', notes: '' },
      { category: 'Lighting', text: 'Edge lights', status: 'unsat', notes: '3 out RWY 19' },
      { category: 'Lighting', text: 'PAPI', status: 'na', na_reason: 'Not installed' },
    ]
    const doc = generateInspectionReportsPdf([insp('AC-9', '2026-05-04T00:00:00Z', items)], { baseName: 'T', baseIcao: 'K' })!
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})

describe('buildInspectionFiles', () => {
  it('produces one consolidated PDF at documents/Inspections.pdf', () => {
    const files = buildInspectionFiles([insp('AC-1', '2026-05-01T00:00:00Z')], ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/Inspections.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('filters by created_at range', () => {
    const files = buildInspectionFiles(
      [insp('AC-1', '2026-01-10T00:00:00Z'), insp('AC-2', '2026-02-10T00:00:00Z')],
      { ...ctx, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' } },
    )
    expect(files.map((f) => f.path)).toEqual(['documents/Inspections.pdf'])
  })

  it('returns [] when nothing matches the range', () => {
    const files = buildInspectionFiles([insp('AC-1', '2026-01-10T00:00:00Z')], {
      ...ctx,
      period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' },
    })
    expect(files).toEqual([])
  })

  it('splits one consolidated PDF per month in monthly mode', () => {
    const files = buildInspectionFiles(
      [insp('AC-1', '2026-01-10T00:00:00Z'), insp('AC-2', '2026-02-10T00:00:00Z')],
      { ...ctx, outputMode: 'monthly' },
    )
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/Inspections/2026-01.pdf',
      'documents/Inspections/2026-02.pdf',
    ])
  })
})
