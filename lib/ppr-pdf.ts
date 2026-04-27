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
import type { PprColumn, PprEntry, PprRemark } from '@/lib/supabase/ppr'

interface PprPdfInput {
  columns: PprColumn[]
  entries: PprEntry[]
  dateFrom: string
  dateTo: string
  baseName?: string | null
  baseIcao?: string | null
  /** Optional remark thread per entry id. When present, each PPR's
   *  remarks (including coord-mirrored comments) are appended in a
   *  REMARKS section after the main table. */
  remarksByEntry?: Record<string, PprRemark[]>
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
  const { columns, entries, dateFrom, dateTo, baseName, baseIcao, remarksByEntry } = input

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
  // info_only columns hold static text on the column itself, not a
  // per-entry value — skip them in the table since every row would
  // either be blank or duplicate the column's static text.
  const dataColumns = columns.filter(c => c.column_type !== 'info_only')

  if (entries.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No PPR entries for the selected range.', margin, y)
  } else {
    const head: string[] = ['PPR #', 'Arrival', ...dataColumns.map(c => sanitizePdfText(c.column_name)), 'OI', 'Notes']
    const body: string[][] = entries.map(entry => [
      entry.ppr_number,
      entry.arrival_date,
      ...dataColumns.map(c => sanitizePdfText(formatCell(c, entry.column_values?.[c.id] || ''))),
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

  // ── Remarks ──
  // Flatten {entryId → [remarks]} into one row per remark, sorted in
  // entry/created_at order so each PPR's thread reads top-to-bottom.
  // Coordination comments are already mirrored into ppr_remarks
  // (with the [Agency — CONCUR/NON-CONCUR] prefix), so they fall
  // out naturally here without a second data path.
  if (remarksByEntry) {
    const rows: string[][] = []
    for (const entry of entries) {
      const thread = (remarksByEntry[entry.id] ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      for (const r of thread) {
        const author = r.user_rank ? `${r.user_rank} ${r.user_name || ''}`.trim() : (r.user_name || 'Unknown')
        rows.push([
          entry.ppr_number,
          sanitizePdfText(author),
          formatZuluDateTime(r.created_at),
          sanitizePdfText(r.remark),
        ])
      }
    }

    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastY = (doc as any).lastAutoTable?.finalY ?? y
      const remarksStartY = lastY + 16
      doc.setFontSize(11)
      doc.setTextColor(40)
      doc.text('REMARKS', margin, remarksStartY)

      autoTable(doc, {
        ...tableStyles(ctx),
        startY: remarksStartY + 4,
        head: [['PPR #', 'User', 'When', 'Remark']],
        body: rows,
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 110 },
          2: { cellWidth: 110 },
          3: { cellWidth: 'auto' },
        },
        didDrawPage: () => drawFooter(ctx),
      })
    }
  }

  const filename = `ppr-log-${dateFrom}${dateFrom === dateTo ? '' : '-to-' + dateTo}.pdf`
  return { doc, filename }
}
