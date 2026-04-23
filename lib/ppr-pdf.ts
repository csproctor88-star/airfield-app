import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDateTime, formatZuluDate } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
} from '@/lib/pdf-utils'
import type { PprColumn, PprEntry } from '@/lib/supabase/ppr'

interface PprPdfInput {
  columns: PprColumn[]
  entries: PprEntry[]
  dateFrom: string
  dateTo: string
  baseName?: string | null
  baseIcao?: string | null
}

function formatYesNoNa(v: string): string {
  if (v === 'yes') return 'YES'
  if (v === 'no') return 'NO'
  if (v === 'na') return 'N/A'
  return v || ''
}

function formatCell(col: PprColumn, raw: string): string {
  if (!raw) return ''
  switch (col.column_type) {
    case 'yes_no_na':
      return formatYesNoNa(raw)
    case 'date':
      try { return new Date(raw + 'T00:00:00').toLocaleDateString() } catch { return raw }
    default:
      return raw
  }
}

export async function generatePprPdf(input: PprPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { columns, entries, dateFrom, dateTo, baseName, baseIcao } = input

  // Landscape gives us more columns worth of horizontal room
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })

  const rangeLabel = dateFrom === dateTo
    ? formatZuluDate(new Date(dateFrom + 'T00:00:00'))
    : `${formatZuluDate(new Date(dateFrom + 'T00:00:00'))} – ${formatZuluDate(new Date(dateTo + 'T00:00:00'))}`
  y = drawReportTitle(ctx, y, { title: 'PPR LOG', subtitle: `Arrival date: ${rangeLabel}` })
  y = drawStatBox(ctx, y, [
    { label: 'Entries', value: String(entries.length) },
    { label: 'Columns', value: String(columns.length) },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  // ── Table ──
  if (entries.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No PPR entries for the selected range.', margin, y)
  } else {
    const head: string[] = ['PPR #', 'Arrival', ...columns.map(c => sanitizePdfText(c.column_name)), 'OI', 'Notes']
    const body: string[][] = entries.map(entry => [
      entry.ppr_number,
      entry.arrival_date,
      ...columns.map(c => sanitizePdfText(formatCell(c, entry.column_values?.[c.id] || ''))),
      entry.approver_oi || '',
      sanitizePdfText(entry.notes || ''),
    ])

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [head],
      body,
      didDrawPage: () => drawFooter(ctx),
    })
  }

  const filename = `ppr-log-${dateFrom}${dateFrom === dateTo ? '' : '-to-' + dateTo}.pdf`
  return { doc, filename }
}
