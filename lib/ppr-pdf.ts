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
  pending_amops_triage: 'Pending Review',
  pending_coordination: 'Pending Coord',
  pending_amops_approval: 'Pending Approval',
  approved: 'Approved',
  denied: 'Denied',
  canceled: 'Canceled',
}

const STATUS_COLORS: Record<string, [number, number, number]> = {
  pending_amops_triage: [239, 68, 68],
  pending_coordination: [251, 146, 60],
  pending_amops_approval: [251, 191, 36],
  approved: [34, 197, 94],
  denied: [239, 68, 68],
  canceled: [148, 163, 184],
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
  /** IANA timezone of the base — used for time-type custom columns
   *  whose `time_display='local'`. Falls back to UTC. */
  timezone?: string | null
  /** Optional remark thread per entry id. Rendered as a Remarks
   *  section inside each card. */
  remarksByEntry?: Record<string, PprRemark[]>
  /** Optional coordination rows per entry id. Rendered as a
   *  Coordination section inside each card. */
  coordsByEntry?: Record<string, PprCoordination[]>
}

const formatCell = formatPprColumnValue

/** Case-insensitive column lookup by name substring. */
function findColumn(columns: PprColumn[], match: string): PprColumn | undefined {
  const m = match.toLowerCase()
  return columns.find(c => c.column_name.toLowerCase().includes(m))
}

// ── Card layout constants (mm) ─────────────────────────────────
// 1-up cards on portrait letter (~186mm content width). Labels get
// roomy single-line rendering for most field names; only the longest
// ("Provide a list of any ground equipment...") will wrap.
const CARD_ROW_GAP = 5
const CARD_PADDING = 5
const TITLE_HEIGHT = 8
const STRIP_HEIGHT = 13
const SECTION_GAP = 4
const SECTION_HEADER_HEIGHT = 5
const ROW_LINE_HEIGHT = 5
const LABEL_WIDTH_RATIO = 0.62
const FOOTER_RESERVE = 12
const ROW_SHADE: [number, number, number] = [245, 247, 250]

function formatRemarkLine(r: PprRemark): string {
  const author = r.user_rank ? `${r.user_rank} ${r.user_name || ''}`.trim() : (r.user_name || 'Unknown')
  return `[${formatZuluDateTime(r.created_at)} · ${author}] ${r.remark}`
}

function formatCoordLine(c: PprCoordination): string {
  const status = COORD_STATUS_LABELS[c.status] || c.status
  const when = c.coordinated_at ? ` (${formatZuluDateTime(c.coordinated_at)})` : ''
  const comment = c.comment ? ` — ${c.comment}` : ''
  return `${c.agency_name} — ${status}${when}${comment}`
}

interface CardData {
  entry: PprEntry
  detailColumns: PprColumn[]
  headerStripCells: { label: string; value: string }[]
  remarks: PprRemark[]
  coords: PprCoordination[]
  tz: string
}

function buildHeaderStripCells(
  entry: PprEntry,
  callsignCol: PprColumn | undefined,
  aircraftCol: PprColumn | undefined,
  etaCol: PprColumn | undefined,
  etdCol: PprColumn | undefined,
  depDateCol: PprColumn | undefined,
  tz: string,
): { label: string; value: string }[] {
  const cells: { label: string; value: string }[] = []

  const eta = etaCol ? formatCell(etaCol, entry.column_values?.[etaCol.id] || '', { tz }) : ''
  cells.push({ label: 'Arrival', value: `${entry.arrival_date}${eta ? ' ' + eta : ''}` })

  if (aircraftCol) {
    const v = formatCell(aircraftCol, entry.column_values?.[aircraftCol.id] || '', { tz })
    if (v) cells.push({ label: 'Aircraft', value: v })
  }
  if (callsignCol) {
    const v = formatCell(callsignCol, entry.column_values?.[callsignCol.id] || '', { tz })
    if (v) cells.push({ label: 'Callsign', value: v })
  }

  let dep = ''
  if (depDateCol) dep = formatCell(depDateCol, entry.column_values?.[depDateCol.id] || '', { tz })
  if (etdCol) {
    const etd = formatCell(etdCol, entry.column_values?.[etdCol.id] || '', { tz })
    if (etd) dep = dep ? `${dep} ${etd}` : etd
  }
  if (dep) cells.push({ label: 'Departure', value: dep })

  return cells
}

/**
 * Pre-render measurement. Must match `renderCard`'s layout walk EXACTLY
 * — including font weight, since bold characters measure wider than
 * normal at the same point size. The previous version measured labels
 * in normal weight but rendered them in bold, causing card chrome to
 * truncate before the last few rows.
 */
function measureCard(doc: jsPDF, card: CardData, cardWidth: number): number {
  let h = CARD_PADDING * 2 + TITLE_HEIGHT
  if (card.headerStripCells.length > 0) h += STRIP_HEIGHT
  h += 3 // divider gap

  const bodyWidth = cardWidth - CARD_PADDING * 2
  const labelWidth = bodyWidth * LABEL_WIDTH_RATIO
  const valueWidth = bodyWidth - labelWidth - 2

  for (const col of card.detailColumns) {
    const value = sanitizePdfText(formatCell(col, card.entry.column_values?.[col.id] || '', { tz: card.tz }))
    if (!value) continue
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const labelLines = doc.splitTextToSize(sanitizePdfText(col.column_name) + ':', labelWidth - 2)
    doc.setFont('helvetica', 'normal')
    const valueLines = doc.splitTextToSize(value, valueWidth)
    h += Math.max(labelLines.length, valueLines.length, 1) * ROW_LINE_HEIGHT
  }
  if (card.entry.approver_oi) h += ROW_LINE_HEIGHT

  if (card.entry.notes) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const w = doc.splitTextToSize(sanitizePdfText(card.entry.notes), bodyWidth)
    h += w.length * ROW_LINE_HEIGHT
  }

  if (card.remarks.length > 0) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const r of card.remarks) {
      const w = doc.splitTextToSize(sanitizePdfText(formatRemarkLine(r)), bodyWidth)
      h += w.length * ROW_LINE_HEIGHT
    }
  }

  if (card.coords.length > 0) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    for (const c of card.coords) {
      const w = doc.splitTextToSize(sanitizePdfText(formatCoordLine(c)), bodyWidth)
      h += w.length * ROW_LINE_HEIGHT
    }
  }

  return h + 2 // small buffer for font-metric variance
}

function renderCard(doc: jsPDF, card: CardData, x: number, y: number, cardWidth: number, height: number): void {
  // Outline
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, cardWidth, height, 2, 2, 'S')

  const innerX = x + CARD_PADDING
  const bodyWidth = cardWidth - CARD_PADDING * 2
  let cy = y + CARD_PADDING

  // ── Title row ──
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`PPR #${card.entry.ppr_number}`, innerX, cy + 4.5)

  const statusLabel = STATUS_LABELS[card.entry.status] || card.entry.status
  const statusColor = STATUS_COLORS[card.entry.status] || [120, 120, 120]
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  const pillWidth = doc.getTextWidth(statusLabel) + 5
  const pillX = x + cardWidth - CARD_PADDING - pillWidth
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.roundedRect(pillX, cy + 1, pillWidth, 5.5, 1.5, 1.5, 'F')
  doc.setTextColor(255)
  doc.text(statusLabel, pillX + pillWidth / 2, cy + 4.8, { align: 'center' })
  doc.setTextColor(0)
  cy += TITLE_HEIGHT

  // ── Header strip ──
  if (card.headerStripCells.length > 0) {
    doc.setDrawColor(230)
    doc.line(innerX, cy, innerX + bodyWidth, cy)
    cy += 1
    const n = card.headerStripCells.length
    const cellWidth = bodyWidth / n
    for (let i = 0; i < n; i++) {
      const cellX = innerX + i * cellWidth
      const cell = card.headerStripCells[i]
      doc.setFontSize(6.5)
      doc.setTextColor(120)
      doc.setFont('helvetica', 'bold')
      doc.text(cell.label.toUpperCase(), cellX, cy + 3)
      doc.setFontSize(10)
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(sanitizePdfText(cell.value), cellWidth - 2)
      if (lines.length > 0) doc.text(lines[0], cellX, cy + 9)
    }
    cy += STRIP_HEIGHT - 1
  }

  // Divider before body
  doc.setDrawColor(230)
  doc.line(innerX, cy, innerX + bodyWidth, cy)
  cy += 3

  // ── Detail body with alternating row shading ──
  const labelWidth = bodyWidth * LABEL_WIDTH_RATIO
  const valueWidth = bodyWidth - labelWidth - 2

  let rowIdx = 0
  for (const col of card.detailColumns) {
    const value = sanitizePdfText(formatCell(col, card.entry.column_values?.[col.id] || '', { tz: card.tz }))
    if (!value) continue

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const labelLines = doc.splitTextToSize(sanitizePdfText(col.column_name) + ':', labelWidth - 2)
    doc.setFont('helvetica', 'normal')
    const valueLines = doc.splitTextToSize(value, valueWidth)
    const rowH = Math.max(labelLines.length, valueLines.length, 1) * ROW_LINE_HEIGHT

    // Zebra stripe — every other row gets a very light gray fill so
    // the eye can track label → value across the gap without losing
    // its place.
    if (rowIdx % 2 === 1) {
      doc.setFillColor(ROW_SHADE[0], ROW_SHADE[1], ROW_SHADE[2])
      doc.rect(innerX, cy, bodyWidth, rowH, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40)
    labelLines.forEach((line: string, i: number) => {
      doc.text(line, innerX + 1, cy + 3.5 + i * ROW_LINE_HEIGHT)
    })

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    valueLines.forEach((line: string, i: number) => {
      doc.text(line, innerX + labelWidth, cy + 3.5 + i * ROW_LINE_HEIGHT)
    })

    cy += rowH
    rowIdx++
  }

  if (card.entry.approver_oi) {
    if (rowIdx % 2 === 1) {
      doc.setFillColor(ROW_SHADE[0], ROW_SHADE[1], ROW_SHADE[2])
      doc.rect(innerX, cy, bodyWidth, ROW_LINE_HEIGHT, 'F')
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(40)
    doc.text('OI:', innerX + 1, cy + 3.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(70)
    doc.text(sanitizePdfText(card.entry.approver_oi), innerX + labelWidth, cy + 3.5)
    cy += ROW_LINE_HEIGHT
  }

  // ── Notes ──
  if (card.entry.notes) {
    cy += SECTION_GAP
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(40)
    doc.text('Notes', innerX, cy + 3.5)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(70)
    const lines = doc.splitTextToSize(sanitizePdfText(card.entry.notes), bodyWidth)
    lines.forEach((line: string, i: number) => {
      doc.text(line, innerX, cy + 3.5 + i * ROW_LINE_HEIGHT)
    })
    cy += lines.length * ROW_LINE_HEIGHT
  }

  // ── Remarks ──
  if (card.remarks.length > 0) {
    cy += SECTION_GAP
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(40)
    doc.text('Remarks', innerX, cy + 3.5)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(70)
    for (const r of card.remarks) {
      const lines = doc.splitTextToSize(sanitizePdfText(formatRemarkLine(r)), bodyWidth)
      lines.forEach((line: string, i: number) => {
        doc.text(line, innerX, cy + 3 + i * ROW_LINE_HEIGHT)
      })
      cy += lines.length * ROW_LINE_HEIGHT
    }
  }

  // ── Coordination ──
  if (card.coords.length > 0) {
    cy += SECTION_GAP
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(40)
    doc.text('Coordination', innerX, cy + 3.5)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(70)
    for (const c of card.coords) {
      const lines = doc.splitTextToSize(sanitizePdfText(formatCoordLine(c)), bodyWidth)
      lines.forEach((line: string, i: number) => {
        doc.text(line, innerX, cy + 3 + i * ROW_LINE_HEIGHT)
      })
      cy += lines.length * ROW_LINE_HEIGHT
    }
  }
}

function buildFilename(dateFrom: string, dateTo: string): string {
  return `ppr-log-${dateFrom}${dateFrom === dateTo ? '' : '-to-' + dateTo}.pdf`
}

export async function generatePprPdf(input: PprPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { columns, entries, dateFrom, dateTo, baseName, baseIcao, timezone, remarksByEntry, coordsByEntry } = input
  const tz = timezone || 'UTC'

  const ctx = createPdf({ orientation: 'portrait' })
  const { doc, margin, contentWidth, pageHeight } = ctx

  const dataColumns = columns.filter(c => c.show_on_log && c.column_type !== 'info_only')

  const callsignCol = findColumn(dataColumns, 'callsign')
  const aircraftCol = findColumn(dataColumns, 'aircraft type') || findColumn(dataColumns, 'aircraft')
  const etaCol = findColumn(dataColumns, 'eta') || findColumn(dataColumns, 'arrival time')
  const etdCol = findColumn(dataColumns, 'etd') || findColumn(dataColumns, 'departure time')
  const depDateCol = findColumn(dataColumns, 'departure date')

  const stripIds = new Set([callsignCol?.id, aircraftCol?.id, etaCol?.id, etdCol?.id, depDateCol?.id]
    .filter((x): x is string => !!x))
  const detailColumns = dataColumns.filter(c => !stripIds.has(c.id))

  // ── Page 1 chrome ──
  let y = margin
  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  const rangeLabel = dateFrom === dateTo
    ? formatZuluDate(new Date(dateFrom + 'T00:00:00'))
    : `${formatZuluDate(new Date(dateFrom + 'T00:00:00'))} – ${formatZuluDate(new Date(dateTo + 'T00:00:00'))}`
  y = drawReportTitle(ctx, y, { title: 'PPR LOG', subtitle: `Arrival date: ${rangeLabel}` })
  y = drawStatBox(ctx, y, [
    { label: 'Entries', value: String(entries.length) },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  if (entries.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No PPR entries for the selected range.', margin, y)
    drawFooter(ctx)
    return { doc, filename: buildFilename(dateFrom, dateTo) }
  }

  // ── Summary table — quick spreadsheet-style index of every PPR in
  //    the export. Lets an auditor scan the list before diving into
  //    each card. Columns intentionally tight so they fit a portrait
  //    width without character-stack cramming. ──
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60)
  doc.text('SUMMARY', margin, y + 4)
  y += 6

  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['PPR #', 'Arrival', 'Aircraft', 'Callsign', 'Departure', 'Status']],
    body: entries.map((e) => {
      const ar = etaCol ? formatCell(etaCol, e.column_values?.[etaCol.id] || '', { tz }) : ''
      const ac = aircraftCol ? formatCell(aircraftCol, e.column_values?.[aircraftCol.id] || '', { tz }) : ''
      const cs = callsignCol ? formatCell(callsignCol, e.column_values?.[callsignCol.id] || '', { tz }) : ''
      const dd = depDateCol ? formatCell(depDateCol, e.column_values?.[depDateCol.id] || '', { tz }) : ''
      const et = etdCol ? formatCell(etdCol, e.column_values?.[etdCol.id] || '', { tz }) : ''
      return [
        sanitizePdfText(e.ppr_number),
        `${e.arrival_date}${ar ? ' ' + ar : ''}`,
        sanitizePdfText(ac),
        sanitizePdfText(cs),
        dd ? `${dd}${et ? ' ' + et : ''}` : sanitizePdfText(et),
        STATUS_LABELS[e.status] || e.status,
      ]
    }),
    // Column widths sum to contentWidth so the summary table spans
    // the full page width and lines up with the cards below.
    tableWidth: contentWidth,
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 36 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22 },
      4: { cellWidth: 36 },
      5: { cellWidth: 38 },
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10

  // ── Details — one card per PPR, full content width ──
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(60)
  // Force a fresh line for the section label, but don't force a page
  // break — let cards flow into whatever room is left after the
  // summary table.
  if (y + 10 > pageHeight - margin - FOOTER_RESERVE) {
    doc.addPage()
    y = margin
  }
  doc.text('DETAILS', margin, y + 4)
  y += 6

  const cardWidth = contentWidth
  const yLimit = pageHeight - margin - FOOTER_RESERVE

  for (const entry of entries) {
    const card: CardData = {
      entry,
      detailColumns,
      headerStripCells: buildHeaderStripCells(entry, callsignCol, aircraftCol, etaCol, etdCol, depDateCol, tz),
      remarks: remarksByEntry?.[entry.id] ?? [],
      coords: coordsByEntry?.[entry.id] ?? [],
      tz,
    }
    const h = measureCard(doc, card, cardWidth)
    if (y + h > yLimit) {
      doc.addPage()
      y = margin
    }
    renderCard(doc, card, margin, y, cardWidth, h)
    y += h + CARD_ROW_GAP
  }

  // Footer on every page after the final page count is known.
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(ctx)
  }

  return { doc, filename: buildFilename(dateFrom, dateTo) }
}
