import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  todayIso,
} from '@/lib/pdf-utils'

export interface EventsLogPdfRow {
  /** ISO timestamp of the entry. */
  createdAt: string
  /** "Created Discrepancy DSC-1234", "Logged AMOPS Open", etc. */
  action: string
  /** Pre-built one-line details string (already capitalized). */
  details: string
  /** Operating initials of the actor. */
  oi: string
  /** Display name of the actor (rank + name when available). */
  user: string
}

interface EventsLogPdfInput {
  rows: EventsLogPdfRow[]
  startDate: string
  endDate: string
  baseName?: string | null
  baseIcao?: string | null
}

/**
 * Events Log PDF — AF Form 3616-style operational log export.
 * Landscape autoTable mirroring the Excel column order so an auditor
 * can cross-reference the two exports without column drift.
 */
export async function generateEventsLogPdf(input: EventsLogPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { rows, startDate, endDate, baseName, baseIcao } = input
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  const startLabel = startDate.split('T')[0]
  const endLabel = endDate.split('T')[0]
  const subtitle = startLabel === endLabel
    ? `Date: ${startLabel}`
    : `Range: ${startLabel} → ${endLabel}`

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, { title: 'EVENTS LOG', subtitle })
  y = drawStatBox(ctx, y, [
    { label: 'Total Entries', value: String(rows.length) },
    { label: 'Range Start', value: startLabel },
    { label: 'Range End', value: endLabel },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  if (rows.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No activity in the selected range.', margin, y)
  } else {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Date', 'Time (Z)', 'Action', 'Details', 'OI', 'User']],
      body: rows.map(r => {
        const d = new Date(r.createdAt)
        return [
          formatZuluDate(d),
          d.toISOString().slice(11, 16),
          sanitizePdfText(r.action),
          sanitizePdfText(r.details),
          sanitizePdfText(r.oi),
          sanitizePdfText(r.user),
        ]
      }),
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 50 },
        4: { cellWidth: 14, halign: 'center' },
        5: { cellWidth: 36 },
      },
      didDrawPage: () => drawFooter(ctx),
    })
  }

  return { doc, filename: `Events_Log_${startLabel}_to_${endLabel}.pdf` }
}
