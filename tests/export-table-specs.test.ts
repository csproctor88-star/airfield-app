import { describe, it, expect } from 'vitest'
import { buildTableModuleFiles } from '@/lib/export/export-pdf'
import {
  INSPECTIONS_SPEC,
  CHECKS_SPEC,
  OBSTRUCTIONS_SPEC,
  PERSONNEL_SPEC,
} from '@/lib/export/export-table-specs'

const ctx = { baseName: 'Test AAF', baseIcao: 'KTST', period: { kind: 'all_time' as const }, outputMode: 'aggregate' as const }

describe('INSPECTIONS_SPEC', () => {
  it('maps a row to the right column count and aggregate path', () => {
    const row = { display_id: 'INSP-1', inspection_type: 'airfield', inspector_name: 'MSgt Doe', inspection_date: '2026-01-04', status: 'completed', completion_percent: 100, created_at: '2026-01-04T00:00:00Z' }
    expect(INSPECTIONS_SPEC.toRow(row)).toHaveLength(INSPECTIONS_SPEC.columns.length)
    expect(INSPECTIONS_SPEC.toRow(row)).toContain('100%')
    const files = buildTableModuleFiles([row], INSPECTIONS_SPEC, ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/Inspections.pdf'])
  })
})

describe('CHECKS_SPEC', () => {
  it('joins areas and counts photos', () => {
    const row = { display_id: 'AC-1', check_type: 'fod', areas: ['RW05', 'TWY A'], completed_by: 'SrA Roe', completed_at: '2026-01-05T00:00:00Z', status: 'completed', photo_count: 3, created_at: '2026-01-05T00:00:00Z' }
    const cells = CHECKS_SPEC.toRow(row)
    expect(cells).toHaveLength(CHECKS_SPEC.columns.length)
    expect(cells).toContain('RW05, TWY A')
    expect(cells).toContain('3')
    expect(buildTableModuleFiles([row], CHECKS_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Checks.pdf'])
  })
})

describe('OBSTRUCTIONS_SPEC', () => {
  it('renders violation as Yes/No and height with units', () => {
    const row = { display_id: 'OBST-1', description: 'Crane', object_height_agl: 120, runway_class: 'PA', has_violation: true, controlling_surface: 'Approach', created_at: '2026-01-06T00:00:00Z' }
    const cells = OBSTRUCTIONS_SPEC.toRow(row)
    expect(cells).toHaveLength(OBSTRUCTIONS_SPEC.columns.length)
    expect(cells).toContain('Yes')
    expect(cells).toContain('120 ft')
    expect(buildTableModuleFiles([row], OBSTRUCTIONS_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Obstructions.pdf'])
  })
})

describe('PERSONNEL_SPEC', () => {
  it('falls back to em-dash for null fields', () => {
    const row = { company_name: 'Acme', callsign: null, work_description: 'Paving', status: 'active', start_date: '2026-01-02', end_date: null, af_form_483_expiration: null, created_at: '2026-01-02T00:00:00Z' }
    const cells = PERSONNEL_SPEC.toRow(row)
    expect(cells).toHaveLength(PERSONNEL_SPEC.columns.length)
    expect(cells.filter((c) => c === '—').length).toBeGreaterThanOrEqual(3)
    expect(buildTableModuleFiles([row], PERSONNEL_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Personnel.pdf'])
  })
})
