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
  it('renders violation as Yes/No, height with units, and the resolved standard label', () => {
    const row = { display_id: 'OBST-1', description: 'Crane', object_height_agl: 120, runway_class: 'A', surface_set: 'ufc_3_260_01' as const, has_violation: true, controlling_surface: 'Approach', created_at: '2026-01-06T00:00:00Z' }
    const cells = OBSTRUCTIONS_SPEC.toRow(row)
    expect(cells).toHaveLength(OBSTRUCTIONS_SPEC.columns.length)
    expect(cells).toContain('Yes')
    expect(cells).toContain('120 ft')
    expect(cells).toContain('UFC 3-260-01 — Air Force Class A')
    expect(buildTableModuleFiles([row], OBSTRUCTIONS_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Obstructions.pdf'])
  })

  it('falls back to UFC for a legacy NULL surface_set row — never a bare class cell', () => {
    const row = { display_id: 'OBST-2', description: 'Pole', object_height_agl: 40, runway_class: null, surface_set: null, has_violation: false, controlling_surface: null, created_at: '2026-01-07T00:00:00Z' }
    const cells = OBSTRUCTIONS_SPEC.toRow(row)
    expect(cells).toContain('UFC 3-260-01 — Air Force Class B')
    expect(cells.some((c) => /class null/i.test(c))).toBe(false)
  })

  it('renders the FAA Part 77 label for a Part 77 row with NULL runway_class', () => {
    const row = { display_id: 'OBST-3', description: 'Tower', object_height_agl: 80, runway_class: null, surface_set: 'faa_part77' as const, has_violation: true, controlling_surface: 'Primary', created_at: '2026-01-08T00:00:00Z' }
    const cells = OBSTRUCTIONS_SPEC.toRow(row)
    expect(cells).toContain('FAA Part 77 (14 CFR §77.19)')
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
