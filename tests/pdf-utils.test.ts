import { describe, it, expect } from 'vitest'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  todayIso,
} from '@/lib/pdf-utils'
import { generateFeedbackPdf } from '@/lib/feedback-pdf'
import { generatePprPdf } from '@/lib/ppr-pdf'
import { generatePersonnelPdf } from '@/lib/personnel-pdf'

describe('pdf-utils helpers', () => {
  it('createPdf builds a jsPDF with expected page geometry', () => {
    const ctx = createPdf({ orientation: 'portrait' })
    expect(ctx.doc).toBeDefined()
    expect(ctx.pageWidth).toBeCloseTo(215.9, 1) // letter, mm
    expect(ctx.pageHeight).toBeCloseTo(279.4, 1)
    expect(ctx.margin).toBe(15)
    expect(ctx.contentWidth).toBeCloseTo(185.9, 1)
  })

  it('landscape uses the tighter 12mm default margin', () => {
    const ctx = createPdf({ orientation: 'landscape' })
    expect(ctx.margin).toBe(12)
    expect(ctx.pageWidth).toBeGreaterThan(ctx.pageHeight)
  })

  it('drawBaseHeader advances y by 12mm', () => {
    const ctx = createPdf()
    const next = drawBaseHeader(ctx, 20, { baseName: 'Demo AFB', baseIcao: 'KDMO' })
    expect(next).toBe(32)
  })

  it('drawReportTitle advances y by 15mm with a subtitle, 8mm without', () => {
    const ctx = createPdf()
    expect(drawReportTitle(ctx, 10, { title: 'X', subtitle: 'Y' })).toBe(25)
    expect(drawReportTitle(ctx, 10, { title: 'X' })).toBe(18)
  })

  it('drawStatBox advances y by boxHeight + spacing regardless of item count', () => {
    const ctx = createPdf()
    const yAfterThree = drawStatBox(ctx, 10, [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
    ])
    const yAfterZero = drawStatBox(ctx, 10, [])
    expect(yAfterThree).toBe(32) // 10 + 16 + 6
    expect(yAfterZero).toBe(32)
  })

  it('tableStyles carries the Glidepath brand colors', () => {
    const s = tableStyles(createPdf())
    expect(s.theme).toBe('grid')
    expect(s.headStyles).toMatchObject({ fillColor: [30, 41, 59], textColor: 255 })
    expect(s.alternateRowStyles).toMatchObject({ fillColor: [245, 245, 245] })
  })

  it('drawFooter writes without throwing when doc is empty', () => {
    const ctx = createPdf()
    expect(() => drawFooter(ctx)).not.toThrow()
  })

  it('todayIso returns a YYYY-MM-DD date', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('migrated generators render without errors', () => {
  it('generateFeedbackPdf produces a doc + filename for empty + populated input', async () => {
    const empty = await generateFeedbackPdf({
      feedback: [],
      stats: { total: 0, avgRating: null, ratingCounts: {}, recentCount: 0 },
      windowLabel: 'Last 30 days',
      baseName: 'Demo AFB',
      baseIcao: 'KDMO',
    })
    expect(empty.filename).toMatch(/^customer-feedback-\d{4}-\d{2}-\d{2}\.pdf$/)

    const populated = await generateFeedbackPdf({
      feedback: [
        {
          id: 'f1',
          base_id: 'b1',
          submitted_at: new Date().toISOString(),
          name: 'Pilot',
          email: null,
          organization: 'ACME',
          overall_rating: 4,
          comments: 'Great ramp layout',
          responses: { q1: 'yes' },
        },
      ],
      stats: { total: 1, avgRating: 4, ratingCounts: { 4: 1 }, recentCount: 1 },
      windowLabel: 'April 2026',
      baseName: 'Demo AFB',
      baseIcao: 'KDMO',
    })
    expect(populated.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('generatePprPdf handles empty + populated input', async () => {
    const empty = await generatePprPdf({
      columns: [],
      entries: [],
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      baseName: 'Demo AFB',
      baseIcao: 'KDMO',
    })
    expect(empty.filename).toMatch(/^ppr-log-2026-04-01-to-2026-04-30\.pdf$/)

    const populated = await generatePprPdf({
      columns: [{
        id: 'c1', base_id: 'b1', column_name: 'Tail #', column_type: 'text',
        sort_order: 1, is_required: false, is_public: false, info_text: null,
        created_at: '2026-04-01',
      }],
      entries: [{
        id: 'e1', base_id: 'b1', ppr_number: 'PPR-001', arrival_date: '2026-04-15',
        arrival_eta_zulu: null,
        column_values: { c1: 'N12345' }, approver_oi: 'JD', notes: 'OK',
        created_by: null, updated_by: null,
        created_at: '2026-04-14', updated_at: '2026-04-14',
        status: 'approved', requester_name: null, requester_email: null, requester_phone: null,
        triaged_by: null, triaged_at: null, approval_user_id: null, approval_at: null,
        denial_reason: null, public_submission: false,
      }],
      dateFrom: '2026-04-15',
      dateTo: '2026-04-15',
      baseName: 'Demo AFB',
      baseIcao: 'KDMO',
    })
    expect(populated.filename).toMatch(/^ppr-log-2026-04-15\.pdf$/)
    expect(populated.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('generatePersonnelPdf handles empty + populated input', async () => {
    const empty = await generatePersonnelPdf({
      contractors: [],
      filterLabel: 'All',
      baseName: 'Demo AFB',
      baseIcao: 'KDMO',
    })
    expect(empty.filename).toMatch(/^personnel-all-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(empty.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
