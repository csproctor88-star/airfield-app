import { describe, it, expect } from 'vitest'
import { generateEventsLogPdf } from '@/lib/events-log-pdf'
import { generateScnMonthlyPdf } from '@/lib/scn-pdf'
import { generateModuleReferencePdf, generateBaseSetupPdf } from '@/lib/training-pdf'

// Smoke coverage for PDF generators that take simple/array inputs: confirm they
// produce a { doc, filename } with at least one page and a sane filename, rather
// than throwing on a data-shape change. The contract every generator honours is
// `{ doc, filename }` (see CLAUDE.md).
//
// NOTE (no silent cap): the row-heavy generators — qrc, parking,
// waiver, amtr (roster/member), amtr-inspection, qrc-monthly-review,
// sms, check, email — still lack smoke tests because they require full domain-row
// fixtures; covering them is a tracked low-priority follow-up. Already covered
// elsewhere: feedback, ppr, personnel (pdf-utils.test.ts), discrepancy
// (discrepancy-pdf.test.ts), aep ×3 (aep.test.ts), training-part139,
// acsi civilian + USAF (acsi-pdf.test.ts), obstruction (obstruction-pdf.test.ts).

describe('PDF generator smoke tests', () => {
  it('events-log generator returns a {doc, filename} for an empty range', async () => {
    const { doc, filename } = await generateEventsLogPdf({ rows: [], startDate: '2026-05-01', endDate: '2026-05-31' })
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('SCN monthly generator returns a {doc, filename} for an empty month', () => {
    const { doc, filename } = generateScnMonthlyPdf({ monthYyyyMm: '2026-05', checks: [], agencies: ['Tower', 'Fire'] })
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('training module-reference generator returns a {doc, filename}', async () => {
    const { doc, filename } = await generateModuleReferencePdf([])
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('base-setup guide generator returns a {doc, filename}', async () => {
    const { doc, filename } = await generateBaseSetupPdf([])
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
