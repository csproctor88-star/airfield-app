import jsPDF from 'jspdf'
import { formatZuluDateTime, formatZuluDate } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
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

// Single source of truth for cell formatting lives in
// lib/supabase/ppr.ts — keep this alias so the rest of the file
// reads without import churn.
const formatCell = formatPprColumnValue

/** Case-insensitive column lookup by name substring. */
function findColumn(columns: PprColumn[], match: string): PprColumn | undefined {
  const m = match.toLowerCase()
  return columns.find(c => c.column_name.toLowerCase().includes(m))
}

// ── Card layout constants (mm) ─────────────────────────────────
const CARD_GAP = 4              // gap between left and right card
const CARD_ROW_GAP = 4          // gap between successive card rows
const CARD_PADDING = 4          // internal card padding
const TITLE_HEIGHT = 7          // PPR# + status pill row
const STRIP_HEIGHT = 12         // 4-cell key-facts strip
const SECTION_GAP = 3           // gap before Notes / Remarks / Coordination
const SECTION_HEADER_HEIGHT = 5 // height of a labeled section header
const ROW_LINE_HEIGHT = 4.5     // one wrapped line of body text
const LABEL_WIDTH_RATIO = 0.45  // label column = 45% of card body width
const FOOTER_RESERVE = 12       // vertical room left at page bottom for footer

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

  // Arrival = entry.arrival_date + ETA column value if present.
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

  // Departure = depDate column + ETD column, either alone or combined.
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
 * Measure the height a card needs given its content. Mirrors the layout
 * walked in `renderCard` so the pre-render measurement stays in sync.
 * Returns the total card height in mm.
 */
function measureCard(doc: jsPDF, card: CardData, cardWidth: number): number {
  let h = CARD_PADDING * 2 + TITLE_HEIGHT
  if (card.headerStripCells.length > 0) h += STRIP_HEIGHT
  h += 2 // divider gap

  const bodyWidth = cardWidth - CARD_PADDING * 2
  const labelWidth = bodyWidth * LABEL_WIDTH_RATIO
  const valueWidth = bodyWidth - labelWidth - 2

  doc.setFontSize(7.5)
  for (const col of card.detailColumns) {
    const value = sanitizePdfText(formatCell(col, card.entry.column_values?.[col.id] || '', { tz: card.tz }))
    if (!value) continue
    const labelLines = doc.splitTextToSize(sanitizePdfText(col.column_name) + ':', labelWidth - 2)
    const valueLines = doc.splitTextToSize(value, valueWidth)
    h += Math.max(labelLines.length, valueLines.length, 1) * ROW_LINE_HEIGHT
  }
  if (card.entry.approver_oi) h += ROW_LINE_HEIGHT

  if (card.entry.notes) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    const w = doc.splitTextToSize(sanitizePdfText(card.entry.notes), bodyWidth)
    h += w.length * ROW_LINE_HEIGHT
  }

  if (card.remarks.length > 0) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    doc.setFontSize(7)
    for (const r of card.remarks) {
      const w = doc.splitTextToSize(sanitizePdfText(formatRemarkLine(r)), bodyWidth)
      h += w.length * ROW_LINE_HEIGHT
    }
  }

  if (card.coords.length > 0) {
    h += SECTION_GAP + SECTION_HEADER_HEIGHT
    doc.setFontSize(7)
    for (const c of card.coords) {
      const w = doc.splitTextToSize(sanitizePdfText(formatCoordLine(c)), bodyWidth)
      h += w.length * ROW_LINE_HEIGHT
    }
  }

  return h + 1 // small buffer for font-metric variance
}

function renderCard(doc: jsPDF, card: CardData, x: number, y: number, cardWidth: number, height: number): void {
  // Outline
  doc.setDrawColor(200)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, cardWidth, height, 2, 2, 'S')

  const innerX = x + CARD_PADDING
  const bodyWidth = cardWidth - CARD_PADDING * 2
  let cy = y + CARD_PADDING

  // ── Title row: PPR# left, status pill right ──
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0)
  doc.text(`PPR #${card.entry.ppr_number}`, innerX, cy + 4)

  const statusLabel = STATUS_LABELS[card.entry.status] || card.entry.status
  const statusColor = STATUS_COLORS[card.entry.status] || [120, 120, 120]
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  const pillWidth = doc.getTextWidth(statusLabel) + 4
  const pillX = x + cardWidth - CARD_PADDING - pillWidth
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
  doc.roundedRect(pillX, cy + 0.5, pillWidth, 5, 1, 1, 'F')
  doc.setTextColor(255)
  doc.text(statusLabel, pillX + pillWidth / 2, cy + 4, { align: 'center' })
  doc.setTextColor(0)

  cy += TITLE_HEIGHT

  // ── Header strip: even-width cells with label + value ──
  if (card.headerStripCells.length > 0) {
    doc.setDrawColor(230)
    doc.line(innerX, cy, innerX + bodyWidth, cy)
    cy += 1

    const n = card.headerStripCells.length
    const cellWidth = bodyWidth / n
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < n; i++) {
      const cellX = innerX + i * cellWidth
      const cell = card.headerStripCells[i]
      // Label
      doc.setFontSize(6)
      doc.setTextColor(120)
      doc.text(cell.label.toUpperCase(), cellX, cy + 3)
      // Value (first wrapped line only — strip is one-line per cell)
      doc.setFontSize(9)
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      const lines = doc.splitTextToSize(sanitizePdfText(cell.value), cellWidth - 2)
      if (lines.length > 0) doc.text(lines[0], cellX, cy + 8)
      doc.setFont('helvetica', 'normal')
    }
    cy += STRIP_HEIGHT - 1
  }

  // Divider before body
  doc.setDrawColor(230)
  doc.line(innerX, cy, innerX + bodyWidth, cy)
  cy += 2

  // ── Detail body: label : value rows ──
  const labelWidth = bodyWidth * LABEL_WIDTH_RATIO
  const valueWidth = bodyWidth - labelWidth - 2

  doc.setFontSize(7.5)
  doc.setTextColor(80)
  for (const col of card.detailColumns) {
    const value = sanitizePdfText(formatCell(col, card.entry.column_values?.[col.id] || '', { tz: card.tz }))
    if (!value) continue

    doc.setFont('helvetica', 'bold')
    const labelLines = doc.splitTextToSize(sanitizePdfText(col.column_name) + ':', labelWidth - 2)
    labelLines.forEach((line: string, i: number) => {
      doc.text(line, innerX, cy + 3 + i * ROW_LINE_HEIGHT)
    })

    doc.setFont('helvetica', 'normal')
    const valueLines = doc.splitTextToSize(value, valueWidth)
    valueLines.forEach((line: string, i: number) => {
      doc.text(line, innerX + labelWidth, cy + 3 + i * ROW_LINE_HEIGHT)
    })

    cy += Math.max(labelLines.length, valueLines.length, 1) * ROW_LINE_HEIGHT
  }

  if (card.entry.approver_oi) {
    doc.setFont('helvetica', 'bold')
    doc.text('OI:', innerX, cy + 3)
    doc.setFont('helvetica', 'normal')
    doc.text(sanitizePdfText(card.entry.approver_oi), innerX + labelWidth, cy + 3)
    cy += ROW_LINE_HEIGHT
  }

  // ── Notes ──
  if (card.entry.notes) {
    cy += SECTION_GAP
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(60)
    doc.text('Notes', innerX, cy + 3)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(80)
    const lines = doc.splitTextToSize(sanitizePdfText(card.entry.notes), bodyWidth)
    lines.forEach((line: string, i: number) => {
      doc.text(line, innerX, cy + 3 + i * ROW_LINE_HEIGHT)
    })
    cy += lines.length * ROW_LINE_HEIGHT
  }

  // ── Remarks ──
  if (card.remarks.length > 0) {
    cy += SECTION_GAP
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(60)
    doc.text('Remarks', innerX, cy + 3)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80)
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
    doc.setFontSize(8)
    doc.setTextColor(60)
    doc.text('Coordination', innerX, cy + 3)
    cy += SECTION_HEADER_HEIGHT

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80)
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

  // Header-strip column lookups — case-insensitive substring match.
  const callsignCol = findColumn(dataColumns, 'callsign')
  const aircraftCol = findColumn(dataColumns, 'aircraft type') || findColumn(dataColumns, 'aircraft')
  const etaCol = findColumn(dataColumns, 'eta') || findColumn(dataColumns, 'arrival time')
  const etdCol = findColumn(dataColumns, 'etd') || findColumn(dataColumns, 'departure time')
  const depDateCol = findColumn(dataColumns, 'departure date')

  const stripIds = new Set([callsignCol?.id, aircraftCol?.id, etaCol?.id, etdCol?.id, depDateCol?.id]
    .filter((x): x is string => !!x))
  const detailColumns = dataColumns.filter(c => !stripIds.has(c.id))

  // ── Page chrome (page 1) ──
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

  const cardWidth = (contentWidth - CARD_GAP) / 2
  const yLimit = pageHeight - margin - FOOTER_RESERVE

  // Walk entries two at a time.
  for (let i = 0; i < entries.length; i += 2) {
    const left = entries[i]
    const right = entries[i + 1]

    const leftCard: CardData = {
      entry: left,
      detailColumns,
      headerStripCells: buildHeaderStripCells(left, callsignCol, aircraftCol, etaCol, etdCol, depDateCol, tz),
      remarks: remarksByEntry?.[left.id] ?? [],
      coords: coordsByEntry?.[left.id] ?? [],
      tz,
    }
    const rightCard: CardData | null = right ? {
      entry: right,
      detailColumns,
      headerStripCells: buildHeaderStripCells(right, callsignCol, aircraftCol, etaCol, etdCol, depDateCol, tz),
      remarks: remarksByEntry?.[right.id] ?? [],
      coords: coordsByEntry?.[right.id] ?? [],
      tz,
    } : null

    const leftH = measureCard(doc, leftCard, cardWidth)
    const rightH = rightCard ? measureCard(doc, rightCard, cardWidth) : 0
    const rowH = Math.max(leftH, rightH)

    // Page break if this row won't fit. A card taller than usable
    // page height will still render — it just overflows past the
    // footer reserve, which is rare and acceptable for v1.
    if (y + rowH > yLimit) {
      doc.addPage()
      y = margin
    }

    renderCard(doc, leftCard, margin, y, cardWidth, leftH)
    if (rightCard) {
      renderCard(doc, rightCard, margin + cardWidth + CARD_GAP, y, cardWidth, rightH)
    }
    y += rowH + CARD_ROW_GAP
  }

  // Footer on every page now that we know the final page count.
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    drawFooter(ctx)
  }

  return { doc, filename: buildFilename(dateFrom, dateTo) }
}
