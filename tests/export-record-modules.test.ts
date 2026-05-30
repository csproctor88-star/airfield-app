import { describe, it, expect } from 'vitest'
import {
  buildWaiverFiles,
  buildAcsiFiles,
  buildTrainingFiles,
  type WaiverRecordBundle,
} from '@/lib/export/export-record-modules'
import type { WaiverRow } from '@/lib/supabase/waivers'
import type { AcsiInspection } from '@/lib/supabase/types'
import type { TrainingTranscriptInput } from '@/lib/training-part139-pdf'

const ctx = { period: { kind: 'all_time' as const }, baseName: 'Test AAF', baseIcao: 'KTST' }

// ── Waivers ────────────────────────────────────────────────────
function waiver(id: string, number: string, createdAt: string): WaiverRow {
  return {
    id, base_id: 'b1', waiver_number: number, classification: 'airfield_design' as never,
    status: 'active' as never, hazard_rating: null, action_requested: null,
    description: 'Test waiver', justification: null, risk_assessment_summary: null,
    corrective_action: null, criteria_impact: null, proponent: null, project_number: null,
    program_fy: null, estimated_cost: null, project_status: null, faa_case_number: null,
    period_valid: null, date_submitted: null, date_approved: null, expiration_date: null,
    last_reviewed_date: null, next_review_due: null, location_description: null,
    location_lat: null, location_lng: null, notes: null, photo_count: 0, attachment_count: 0,
    created_by: null, updated_by: null, created_at: createdAt, updated_at: createdAt,
  }
}

const emptyBundle = (waivers: WaiverRow[]): WaiverRecordBundle => ({
  waivers,
  criteriaByWaiver: {},
  reviewsByWaiver: {},
  coordinationByWaiver: {},
  attachmentsByWaiver: {},
})

describe('buildWaiverFiles', () => {
  it('emits one PDF per waiver, named by waiver_number', () => {
    const bundle = emptyBundle([waiver('1', 'AF505-2026-014', '2026-01-10T00:00:00Z')])
    const files = buildWaiverFiles(bundle, ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/Waivers/AF505-2026-014.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('filters by created_at range', () => {
    const bundle = emptyBundle([
      waiver('1', 'W-JAN', '2026-01-10T00:00:00Z'),
      waiver('2', 'W-FEB', '2026-02-10T00:00:00Z'),
    ])
    const files = buildWaiverFiles(bundle, { ...ctx, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' } })
    expect(files.map((f) => f.path)).toEqual(['documents/Waivers/W-FEB.pdf'])
  })

  it('returns [] when nothing matches', () => {
    const bundle = emptyBundle([waiver('1', 'W-1', '2026-01-10T00:00:00Z')])
    expect(buildWaiverFiles(bundle, { ...ctx, period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' } })).toEqual([])
  })

  it('sanitizes unsafe characters in the filename', () => {
    const bundle = emptyBundle([waiver('1', 'AF 505/2026 #14', '2026-01-10T00:00:00Z')])
    const files = buildWaiverFiles(bundle, ctx)
    expect(files[0].path).toBe('documents/Waivers/AF-505-2026-14.pdf')
  })
})

// ── ACSI ───────────────────────────────────────────────────────
function acsi(id: string, displayId: string, createdAt: string): AcsiInspection {
  return {
    id, display_id: displayId, base_id: 'b1', airfield_name: 'Test AAF',
    inspection_date: createdAt.slice(0, 10), fiscal_year: 2026, status: 'completed' as never,
    items: [], total_items: 0, passed_count: 0, failed_count: 0, na_count: 0,
    inspection_team: [], risk_cert_signatures: [], notes: null, inspector_id: null,
    inspector_name: null, draft_data: null, completed_at: createdAt, completed_by_name: null,
    created_at: createdAt, updated_at: createdAt,
  } as unknown as AcsiInspection
}

describe('buildAcsiFiles', () => {
  it('emits one text-only PDF per inspection (skipPhotos)', async () => {
    const files = await buildAcsiFiles([acsi('1', 'ACSI-FY2026', '2026-03-01T00:00:00Z')], ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/ACSI/ACSI-FY2026.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('filters by created_at range', async () => {
    const files = await buildAcsiFiles(
      [acsi('1', 'A-JAN', '2026-01-01T00:00:00Z'), acsi('2', 'A-MAR', '2026-03-01T00:00:00Z')],
      { ...ctx, period: { kind: 'range', from: '2026-03-01', to: '2026-03-31' } },
    )
    expect(files.map((f) => f.path)).toEqual(['documents/ACSI/A-MAR.pdf'])
  })
})

// ── Training ───────────────────────────────────────────────────
function transcript(name: string): TrainingTranscriptInput {
  return {
    base: { name: 'Test AAF', icao: 'KTST' },
    user: { name, rank: 'SrA', email: null, role: 'inspector' },
    topics: [],
    records: [],
    certificates: [],
  }
}

describe('buildTrainingFiles', () => {
  it('emits one transcript PDF per trainee, named by person', () => {
    const files = buildTrainingFiles([transcript('Jane Lee'), transcript('Bob Kim')], ctx)
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/Training/Bob-Kim.pdf',
      'documents/Training/Jane-Lee.pdf',
    ])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('returns [] with no trainees', () => {
    expect(buildTrainingFiles([], ctx)).toEqual([])
  })
})
