import type jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  getSlotLabel, requiredSlotsForShifts,
  type DailyReviewRow, type SignerInfo, type SlotLabelSource,
} from '@/lib/supabase/daily-reviews'
import { buildReviewDateSpine, buildCertLogRows } from './daily-review-log-data'

export interface DailyReviewLogOptions {
  baseName: string
  baseIcao: string | null
  shiftCount: number
  startDate: string
  endDate: string
  generatedBy: string
  rows: DailyReviewRow[]
  signers: Map<string, SignerInfo>
  base: SlotLabelSource | null
}

export function generateDailyReviewLogPdf(opts: DailyReviewLogOptions): { doc: jsPDF; filename: string } {
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: opts.baseName, baseIcao: opts.baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'DAILY REVIEW CERTIFICATION LOG',
    subtitle: `${opts.startDate} → ${opts.endDate} · ${opts.shiftCount}-shift`,
  })

  const required = requiredSlotsForShifts(opts.shiftCount)
  const spine = buildReviewDateSpine(opts.startDate, opts.endDate)
  const rowByDate = new Map(opts.rows.map((r) => [r.review_date, r] as const))
  const logRows = buildCertLogRows(spine, rowByDate, opts.signers, required, opts.base)
  const certified = logRows.filter((r) => r.certifiedAt !== null).length

  y = drawStatBox(ctx, y, [
    { label: 'Range', value: `${opts.startDate} – ${opts.endDate}` },
    { label: 'Days', value: String(spine.length) },
    { label: 'Certified', value: `${certified} of ${spine.length}` },
    { label: 'Pending', value: String(spine.length - certified) },
  ])

  const certCol = required.length + 1
  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['Date', ...required.map((s) => getSlotLabel(s, opts.base)), 'Certified']],
    body: logRows.map((r) => [r.date, ...r.slots, r.certifiedText]),
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === certCol
          && /PENDING/.test(String(data.cell.raw))) {
        data.cell.styles.textColor = [150, 90, 0]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: () => drawFooter(ctx),
  })

  // Notes appendix (only if any)
  const withNotes = logRows.filter((r) => r.notes.length > 0)
  if (withNotes.length > 0) {
    let ny = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8
    doc.setFontSize(10); doc.setTextColor(0)
    doc.text('NOTES', margin, ny); ny += 6
    doc.setFontSize(8); doc.setTextColor(60)
    for (const r of withNotes) {
      for (const n of r.notes) {
        const line = sanitizePdfText(`${r.date} — ${n.slotLabel}: ${n.note}`)
        const wrapped = doc.splitTextToSize(line, ctx.contentWidth)
        if (ny > ctx.pageHeight - 16) { doc.addPage(); ny = margin; drawFooter(ctx) }
        doc.text(wrapped, margin, ny)
        ny += wrapped.length * 4 + 1
      }
    }
  }

  const slug = (opts.baseIcao || opts.baseName || 'base').replace(/[^A-Za-z0-9]+/g, '-')
  const filename = `daily-review-log_${slug}_${opts.startDate}_${opts.endDate}.pdf`
  return { doc, filename }
}
