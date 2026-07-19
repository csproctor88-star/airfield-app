import { describe, it, expect } from 'vitest'
import type jsPDF from 'jspdf'
import {
  generateModsExemptionsRegisterPdf, generateModsExemptionDetailPdf,
} from '@/lib/mods-exemptions-pdf'
import type { ModsExemptionRow, ModsExemptionReviewRow } from '@/lib/supabase/mods-exemptions'

// Register/detail generator coverage: the { doc, filename } contract, and —
// the Local Regs / Read File lesson — raw-content assertions that decided
// and expired records stay on the register in the History section instead
// of silently vanishing.

function makeRecord(overrides: Partial<ModsExemptionRow> & { id: string; record_type: ModsExemptionRow['record_type']; title: string }): ModsExemptionRow {
  return {
    base_id: 'b1',
    status: 'approved',
    standard_reference: 'AC 150/5300-13B - TOFA',
    baseline_summary: null,
    relief_summary: null,
    justification: null,
    public_interest: null,
    safety_justification: null,
    mos_category: null,
    mos_subcategory: null,
    approval_authority: null,
    agis_tracking: null,
    docket_number: null,
    arff_small_airport: false,
    date_submitted: '2026-01-10',
    date_decided: '2026-03-01',
    effective_date: '2026-03-01',
    expiration_date: null,
    decision_summary: null,
    decision_conditions: null,
    last_reviewed_date: null,
    next_review_due: null,
    deviation_date: null,
    notified_date: null,
    written_notice_requested: false,
    written_notice_provided: false,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-10T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
    ...overrides,
  }
}

/** Raw page content streams — text drawn with doc.text/autoTable lands here. */
function pdfRawText(doc: jsPDF): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return JSON.stringify((doc as any).internal.pages)
}

const GENERATED_AT = '2026-07-18T12:00:00Z'

describe('generateModsExemptionsRegisterPdf', () => {
  it('returns the { doc, filename } contract', async () => {
    const { doc, filename } = await generateModsExemptionsRegisterPdf({
      baseName: 'Test Field', baseIcao: 'KTST',
      records: [makeRecord({ id: 'r1', record_type: 'mos', title: 'Pole line in TOFA' })],
      reviews: [], generatedAtIso: GENERATED_AT,
    })
    expect(filename).toBe('modifications-exemptions-register-ktst.pdf')
    expect(doc).toBeTruthy()
  })

  it('renders the ALP-table columns and the ACM exemptions list headings', async () => {
    const records = [
      makeRecord({
        id: 'm1', record_type: 'mos', title: 'Runway 4 hold offset',
        mos_category: 'Design', mos_subcategory: 'Runway Hold Positions - Offset Distance',
        agis_tracking: 'NRA 2026-ASO-1234', decision_conditions: 'Signage plan required',
      }),
      makeRecord({
        id: 'e1', record_type: 'exemption', title: 'ARFF Index reduction overnight',
        standard_reference: '14 CFR 139.319(h)(1)', docket_number: 'FAA-2026-0042',
      }),
    ]
    const reviews: ModsExemptionReviewRow[] = [{
      id: 'v1', base_id: 'b1', record_id: 'e1', review_date: '2026-06-01',
      reviewed_by: null, justification_still_valid: true, recommendation: 'retain',
      notes: null, created_at: '2026-06-01T12:00:00Z',
    }]
    const { doc } = await generateModsExemptionsRegisterPdf({
      baseName: 'Test Field', baseIcao: 'KTST', records, reviews, generatedAtIso: GENERATED_AT,
    })
    const raw = pdfRawText(doc)
    // 5300.1G ¶12.b ALP-table columns
    expect(raw).toContain('Standard modified')
    expect(raw).toContain('Airspace case')
    expect(raw).toContain('NRA 2026-ASO-1234')
    // ACM exemptions list (§139.203(b) / 5280.5D §2.12.6) with review answer
    expect(raw).toContain('Part 139 Exemptions')
    expect(raw).toContain('FAA-2026-0042')
    expect(raw).toContain('2026-06-01')
    expect(raw).toContain('YES')
  })

  it('keeps denied and EXPIRED records on the register in the History section', async () => {
    const records = [
      makeRecord({ id: 'ok', record_type: 'mos', title: 'Active mod' }),
      makeRecord({ id: 'den', record_type: 'exemption', title: 'Denied petition', status: 'denied' }),
      makeRecord({
        id: 'exp', record_type: 'mos', title: 'Expired five-year mod',
        expiration_date: '2026-07-01', // before GENERATED_AT's 2026-07-18
      }),
    ]
    const { doc } = await generateModsExemptionsRegisterPdf({
      baseName: 'Test Field', baseIcao: 'KTST', records, reviews: [], generatedAtIso: GENERATED_AT,
    })
    const raw = pdfRawText(doc)
    expect(raw).toContain('History')
    expect(raw).toContain('Denied petition')
    expect(raw).toContain('Expired five-year mod')
    // And the active section still shows the live record
    expect(raw).toContain('Active mod')
  })

  it('renders the deviation section with the 14-day framing when deviations exist', async () => {
    const records = [
      makeRecord({
        id: 'd1', record_type: 'deviation', title: 'ARFF vehicle diverted',
        status: 'notified', standard_reference: '139.319(h)',
        deviation_date: '2026-07-01', notified_date: '2026-07-03',
        date_submitted: null, date_decided: null, effective_date: null,
      }),
    ]
    const { doc } = await generateModsExemptionsRegisterPdf({
      baseName: 'Test Field', baseIcao: 'KTST', records, reviews: [], generatedAtIso: GENERATED_AT,
    })
    const raw = pdfRawText(doc)
    expect(raw).toContain('139.113')
    expect(raw).toContain('ARFF vehicle diverted')
    expect(raw).toContain('14 days')
  })
})

describe('generateModsExemptionDetailPdf', () => {
  it('includes populated fields, the review history, and flags an expired record', async () => {
    const record = makeRecord({
      id: 'e9', record_type: 'exemption', title: 'Old exemption',
      standard_reference: '14 CFR 139.317', docket_number: 'FAA-2020-9',
      expiration_date: '2026-01-01',
    })
    const reviews: ModsExemptionReviewRow[] = [{
      id: 'v9', base_id: 'b1', record_id: 'e9', review_date: '2025-12-01',
      reviewed_by: null, justification_still_valid: false, recommendation: 'terminate',
      notes: 'Requirement now met', created_at: '2025-12-01T12:00:00Z',
    }]
    const { doc, filename } = await generateModsExemptionDetailPdf({
      baseName: 'Test Field', baseIcao: 'KTST', record, reviews, attachments: [],
      generatedAtIso: GENERATED_AT,
    })
    expect(filename).toBe('exemption-record-ktst-e9.pdf')
    const raw = pdfRawText(doc)
    expect(raw).toContain('EXPIRED')
    expect(raw).toContain('FAA-2020-9')
    expect(raw).toContain('NO') // justification_still_valid = false
    expect(raw).toContain('Requirement now met')
  })

  it('excludes reviews and attachments belonging to other records', async () => {
    const record = makeRecord({ id: 'a1', record_type: 'mos', title: 'Mine' })
    const reviews: ModsExemptionReviewRow[] = [{
      id: 'vX', base_id: 'b1', record_id: 'OTHER', review_date: '2026-05-05',
      reviewed_by: null, justification_still_valid: true, recommendation: null,
      notes: 'someone else’s review', created_at: '2026-05-05T12:00:00Z',
    }]
    const { doc } = await generateModsExemptionDetailPdf({
      baseName: 'Test Field', baseIcao: 'KTST', record, reviews, attachments: [],
      generatedAtIso: GENERATED_AT,
    })
    const raw = pdfRawText(doc)
    expect(raw).not.toContain('2026-05-05')
  })
})
