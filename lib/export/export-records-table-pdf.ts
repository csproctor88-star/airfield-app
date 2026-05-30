// Records Export — generic "records table" PDF.
// One reusable generator for every table module; the caller supplies the
// column headers and pre-stringified rows. Aggregate mode calls this once over
// all rows; monthly mode calls it once per month bucket.
import autoTable from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
} from '@/lib/pdf-utils'

export interface RecordsTablePdfOptions {
  /** Module label, e.g. 'Discrepancies' */
  title: string
  /** Optional subtitle, e.g. a month ('2026-01') or date range */
  subtitle?: string
  baseName?: string | null
  baseIcao?: string | null
  columns: string[]
  /** Pre-stringified rows; each inner array aligns with `columns` */
  rows: string[][]
}

export function generateRecordsTablePdf(opts: RecordsTablePdfOptions): jsPDF {
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: opts.baseName, baseIcao: opts.baseIcao })
  y = drawReportTitle(ctx, y, { title: opts.title.toUpperCase(), subtitle: opts.subtitle })
  y = drawStatBox(ctx, y, [{ label: 'Total Records', value: String(opts.rows.length) }])

  if (opts.rows.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No records in the selected period.', margin, y)
  } else {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [opts.columns],
      body: opts.rows,
      didDrawPage: () => drawFooter(ctx),
    })
  }

  return doc
}
