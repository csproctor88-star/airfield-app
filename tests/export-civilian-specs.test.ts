import { describe, it, expect } from 'vitest'
import { buildTableModuleFiles } from '@/lib/export/export-pdf'
import {
  SMS_HAZARDS_SPEC,
  SMS_MITIGATIONS_SPEC,
  SMS_AUDITS_SPEC,
  SMS_MOC_SPEC,
  SMS_SAFETY_REPORTS_SPEC,
  AEP_PLANS_SPEC,
  AEP_AGENCIES_SPEC,
  AEP_DRILLS_SPEC,
  AEP_COMMS_CHECKS_SPEC,
  SMS_SPECS,
  AEP_SPECS,
} from '@/lib/export/export-civilian-specs'

const ctx = { baseName: 'Civ Muni', baseIcao: 'KCIV', period: { kind: 'all_time' as const }, outputMode: 'aggregate' as const }

// ── subName path routing ──────────────────────────────────────
describe('multi-kind subName routing', () => {
  it('routes SMS hazards to documents/SMS/Hazards.pdf', () => {
    const row = { hazard_code: 'HZ-1', title: 'Bird', status: 'open', source_type: 'manual', current_band: 'high', residual_band: 'medium', identified_at: '2026-01-04T00:00:00Z' } as never
    const files = buildTableModuleFiles([row], SMS_HAZARDS_SPEC, ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/SMS/Hazards.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('routes AEP drills to documents/AEP/Drills.pdf', () => {
    const row = { drill_date: '2026-02-01', drill_type: 'full_scale', scenario: 'Crash', status: 'completed', participants: [{}, {}] } as never
    const files = buildTableModuleFiles([row], AEP_DRILLS_SPEC, ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/AEP/Drills.pdf'])
  })

  it('nests the month under the subName in monthly mode', () => {
    const row = { drill_date: '2026-02-01', drill_type: 'tabletop', scenario: 'X', status: 'completed', participants: [] } as never
    const files = buildTableModuleFiles([row], AEP_DRILLS_SPEC, { ...ctx, outputMode: 'monthly' })
    expect(files.map((f) => f.path)).toEqual(['documents/AEP/Drills/2026-02.pdf'])
  })
})

// ── column mapping ────────────────────────────────────────────
describe('SMS specs map rows correctly', () => {
  it('hazards: title-cases enum bands and status', () => {
    const row = { hazard_code: 'HZ-2', title: 'FOD', status: 'under_review', source_type: 'wildlife_strike', current_band: 'high', residual_band: null, identified_at: '2026-01-04T00:00:00Z' } as never
    const cells = SMS_HAZARDS_SPEC.toRow(row)
    expect(cells).toHaveLength(SMS_HAZARDS_SPEC.columns.length)
    expect(cells).toContain('Under Review')
    expect(cells).toContain('Wildlife Strike')
    expect(cells).toContain('High')
    expect(cells).toContain('—') // null residual band
  })

  it('mitigations / audits / moc map to the right column counts', () => {
    const mit = { title: 'Fence', control_type: 'engineering', status: 'completed', due_date: '2026-03-01', completed_at: '2026-02-20T00:00:00Z', created_at: '2026-01-10T00:00:00Z' } as never
    expect(SMS_MITIGATIONS_SPEC.toRow(mit)).toHaveLength(SMS_MITIGATIONS_SPEC.columns.length)
    const aud = { audit_code: 'AUDIT-1', title: 'Annual', audit_type: 'internal', status: 'completed', scheduled_date: '2026-01-01', performed_date: '2026-01-15', findings_open: 1, findings_closed: 4, created_at: '2026-01-01T00:00:00Z' } as never
    expect(SMS_AUDITS_SPEC.toRow(aud)).toContain('1')
    expect(SMS_AUDITS_SPEC.toRow(aud)).toContain('4')
    const moc = { moc_code: 'MOC-1', title: 'New SOP', change_category: 'procedural', status: 'approved', proposed_at: '2026-01-02T00:00:00Z', effective_date: '2026-02-01' } as never
    expect(SMS_MOC_SPEC.toRow(moc)).toContain('Procedural')
  })

  it('safety reports render anonymous flag as Yes/No', () => {
    const rep = { report_code: 'SR-1', category: 'runway_incursion', triage_status: 'new', occurred_at: '2026-01-03T00:00:00Z', location_text: 'RWY 09', is_anonymous: true, submitted_at: '2026-01-03T00:00:00Z' } as never
    const cells = SMS_SAFETY_REPORTS_SPEC.toRow(rep)
    expect(cells).toContain('Yes')
    expect(cells).toContain('Runway Incursion')
  })
})

describe('AEP specs map rows correctly', () => {
  it('plans: derive Active/Superseded from replaced_by_id', () => {
    const base = { version: 'v3', effective_date: '2026-01-01', approved_by_faa_at: '2026-01-05', faa_acceptance_ref: 'REF1', last_reviewed_at: '2026-01-10T00:00:00Z' }
    expect(AEP_PLANS_SPEC.toRow({ ...base, replaced_by_id: null } as never)).toContain('Active')
    expect(AEP_PLANS_SPEC.toRow({ ...base, replaced_by_id: 'x' } as never)).toContain('Superseded')
  })

  it('agencies: map role via the label table', () => {
    const ag = { agency_name: 'City FD', agency_role: 'mutual_aid_fire', primary_contact_name: 'Chief', primary_contact_phone: '555', is_active: true, created_at: '2026-01-01T00:00:00Z' } as never
    expect(AEP_AGENCIES_SPEC.toRow(ag)).toContain('Mutual-Aid Fire')
  })

  it('comms checks: count loud&clear and list exceptions', () => {
    const chk = {
      check_date: '2026-02-01', check_period: 'monthly', completed_by_oi: 'AB',
      results: [
        { agency_name: 'ARFF', status: 'loud_clear' },
        { agency_name: 'EMS', status: 'no_response' },
      ],
    } as never
    const cells = AEP_COMMS_CHECKS_SPEC.toRow(chk)
    expect(cells).toContain('2') // total checked
    expect(cells).toContain('1') // loud & clear
    expect(cells.some((c) => c.includes('EMS') && c.includes('No Response'))).toBe(true)
  })
})

describe('spec collections', () => {
  it('expose 5 SMS + 4 AEP specs, all with a subName and folder', () => {
    expect(SMS_SPECS).toHaveLength(5)
    expect(AEP_SPECS).toHaveLength(4)
    for (const s of [...SMS_SPECS, ...AEP_SPECS]) {
      expect(s.subName, s.module.key).toBeTruthy()
      expect(s.module.folder).toBeTruthy()
    }
  })
})
