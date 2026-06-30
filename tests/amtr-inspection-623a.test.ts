import { describe, it, expect } from 'vitest'
import { buildInspection623aComment } from '@/lib/amtr/inspection-623a'
import type { InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

const item = (over: Partial<InspectionItemResponse>): InspectionItemResponse => ({
  item_number: '6.3', status: 'no', auto: 'no', findings: [], ...over,
})

describe('buildInspection623aComment', () => {
  it('uses the recordsInspection template header + cite', () => {
    const out = buildInspection623aComment({ inspectionDate: '2026-06-30', inspectorName: 'SMSgt Proctor', items: [] })
    expect(out).toContain('Monthly Training Records Inspection')
    expect(out).toContain('IAW DAFMAN 13-204v2 Para 2.6.2.8')
    expect(out).toContain('Inspection Date: 2026-06-30')
    expect(out).toContain('Inspector: SMSgt Proctor')
  })
  it('reads "No discrepancies noted." with zero gaps', () => {
    expect(buildInspection623aComment({ inspectionDate: '2026-06-30', items: [item({ status: 'yes' })] }))
      .toContain('No discrepancies noted.')
  })
  it('lists item number, detail, and corrective action for each gap', () => {
    const out = buildInspection623aComment({
      inspectionDate: '2026-06-30',
      items: [
        item({ item_number: '6.3', status: 'no', detail: 'missing Jan, Mar Proficiency Test', correctiveAction: 'counseled; due by 15th' }),
        item({ item_number: '4.1', status: 'yes' }),
      ],
    })
    expect(out).toContain('Discrepancies (1):')
    expect(out).toContain('6.3 — missing Jan, Mar Proficiency Test')
    expect(out).toContain('Corrective Action: counseled; due by 15th')
    expect(out).not.toContain('4.1')   // only gaps listed
  })
  it('falls back to findings when detail is absent', () => {
    const out = buildInspection623aComment({ inspectionDate: '2026-06-30', items: [item({ status: 'no', findings: ['A', 'B'] })] })
    expect(out).toContain('6.3 — A · B')
  })
})
