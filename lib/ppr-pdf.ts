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
import { formatPprColumnValue, type PprColumn, type PprCoordination, type PprEntry, type PprRemark } from '@/lib/supabase/ppr'

const STATUS_LABELS: Record<string, string> = {
  pending_amops_triage: 'Pending Triage',
  pending_coordination: 'Pending Coord',
  pending_amops_approval: 'Pending Approval',
  approved: 'Approved',
  denied: 'Denied',
  canceled: 'Canceled',
}

const COORD_STATUS_LABELS: Record<string, string> = {
  pending: 'PENDING',
  concur: 'CONCUR',
  non_concur: 'NON-CONCUR',
}

interface PprPdfInput {
  columns: PprColumn[]
  entries: PprEntry[]
  dateFrom: string
  dateTo: string
  baseName?: string | null
  baseIcao?: string | null
  /** IANA timezone of the base — used to render time-type custom
   *  columns whose `time_display='local'`. Falls back to UTC. */
  timezone?: string | null
  /** Optional remark thread per entry id. When present, each PPR's
   *  remarks (including coord-mirrored comments) are appended in a
   *  REMARKS section after the main table. */
  remarksByEntry?: Record<string, PprRemark[]>
  /** Optional coordination rows per entry id. When present, a
   *  COORDINATION section is appended summarizing each agency's
   *  decision, when, and any non-concur reason. */
  coordsByEntry?: Record<string, PprCoordination[]>
}

// Single source of truth for column-value formatting lives in
// lib/supabase/ppr.ts (`formatPprColumnValue`) so the PDF, the
// in-app tables, the detail card, and the email templates all
// render `time` as HHMM Z, `yes_no_na` as YES/NO/N/A, etc. the
// same way. Local alias kept so the rest of this file reads
// without churn.
const formatCell = formatPprColumnValue

export async function generatePprPdf(input: PprPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { columns, entries, dateFrom, dateTo, baseName, baseIcao, timezone, remarksByEntry, coordsByEntry } = input
  const tz = timezone || 'UTC'

  // Landscape gives us more columns worth of horizontal room
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })

  const rangeLabel = dateFrom === dateTo
    ? formatZuluDate(new Date(dateFrom + 'T00:00:00'))
    : `${formatZuluDate(new Date(dateFrom + 'T00:00:00'))} – ${formatZuluDate(new Date(dateTo + 'T00:00:00'))}`
  y = drawReportTitle(ctx, y, { title: 'PPR LOG', subtitle: `Arrival date: ${rangeLabel}` })

  // ── Table ──
  // The PDF mirrors the in-app PPR Log view: dynamic columns appear
  // when the admin marked them show_on_log. info_only is excluded
  // because it has no per-entry value.
  const dataColumns = columns.filter(c => c.show_on_log && c.column_type !== 'info_only')

  y = drawStatBox(ctx, y, [
    { label: 'Entries', value: String(entries.length) },
    { label: 'Columns', value: String(dataColumns.length) },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  // Build the per-entry remarks string once so it can drop into the
  // main table cell. Each remark is one line prefixed with its
  // Zulu timestamp + author so the audit context lands inline with
  // the PPR rather than in a separate (and previously bloated)
  // bottom section.
  const formatRemarksCell = (entryId: string): string => {
    const thread = (remarksByEntry?.[entryId] ?? [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (thread.length === 0) return ''
    return thread
      .map((r) => {
        const author = r.user_rank ? `${r.user_rank} ${r.user_name || ''}`.trim() : (r.user_name || 'Unknown')
        const when = formatZuluDateTime(r.created_at)
        return sanitizePdfText(`[${when} · ${author}] ${r.remark}`)
      })
      .join('\n')
  }
  const anyRemarks = entries.some((e) => (remarksByEntry?.[e.id] ?? []).length > 0)

  if (entries.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No PPR entries for the selected range.', margin, y)
  } else {
    const head: string[] = [
      'PPR #', 'Arrival Date', 'ETA (Z)', 'Status',
      ...dataColumns.map(c => sanitizePdfText(c.column_name)),
      'OI', 'Notes',
      ...(anyRemarks ? ['Remarks'] : []),
    ]
    const body: string[][] = entries.map(entry => [
      entry.ppr_number,
      entry.arrival_date,
      entry.arrival_eta_zulu ? entry.arrival_eta_zulu.replace(':', '') + 'Z' : '—',
      STATUS_LABELS[entry.status] || entry.status,
      ...dataColumns.map(c => sanitizePdfText(formatCell(c, entry.column_values?.[c.id] || '', { tz }))),
      entry.approver_oi || '',
      sanitizePdfText(entry.notes || ''),
      ...(anyRemarks ? [formatRemarksCell(entry.id)] : []),
    ])

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [head],
      body,
      didDrawPage: () => drawFooter(ctx),
    })
  }

  // ── Coordination ──
  // Per-entry agency decisions. Useful for after-action review and for
  // recreating the coordination timeline outside the app. Pending rows
  // are included so the export reflects the live state of the PPR.
  if (coordsByEntry) {
    const rows: string[][] = []
    for (const entry of entries) {
      const list = (coordsByEntry[entry.id] ?? [])
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
      for (const c of list) {
        rows.push([
          entry.ppr_number,
          sanitizePdfText(c.agency_name),
          COORD_STATUS_LABELS[c.status] || c.status,
          c.coordinated_at ? formatZuluDateTime(c.coordinated_at) : '—',
          sanitizePdfText(c.comment || ''),
        ])
      }
    }

    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastY = (doc as any).lastAutoTable?.finalY ?? y
      const coordStartY = lastY + 16
      doc.setFontSize(11)
      doc.setTextColor(40)
      doc.text('COORDINATION', margin, coordStartY)

      autoTable(doc, {
        ...tableStyles(ctx),
        startY: coordStartY + 4,
        head: [['PPR #', 'Agency', 'Decision', 'When', 'Comment']],
        body: rows,
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 130 },
          2: { cellWidth: 70 },
          3: { cellWidth: 110 },
          4: { cellWidth: 'auto' },
        },
        didDrawPage: () => drawFooter(ctx),
      })
    }
  }

  const filename = `ppr-log-${dateFrom}${dateFrom === dateTo ? '' : '-to-' + dateTo}.pdf`
  return { doc, filename }
}
