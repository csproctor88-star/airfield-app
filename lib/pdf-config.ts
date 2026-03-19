import type jsPDF from 'jspdf'
import type { PhotoForReport } from './reports/open-discrepancies-data'

// ── Status Labels (consolidated from 3 files) ──

export const PDF_STATUS_LABELS: Record<string, string> = {
  submitted_to_afm: 'Submitted to AFM',
  submitted_to_ces: 'Submitted to CES',
  awaiting_action_by_ces: 'Awaiting CES Action',
  waiting_for_project: 'Waiting for Project',
  work_completed_awaiting_verification: 'Awaiting Verification',
  open: 'Open',
}

// ── Type Abbreviation ──

const TYPE_ABBREV: Record<string, string> = {
  'Lighting Outage/Deficiency': 'Lighting',
  'Pavement Deficiency': 'Pavement',
  'Marking Deficiency': 'Marking',
  'Signage Deficiency': 'Signage',
  'Drainage Issue': 'Drainage',
  'Vegetation Encroachment': 'Vegetation',
  'Wildlife Hazard': 'Wildlife',
  'Airfield Obstruction': 'Obstruction',
  'NAVAID Deficiency': 'NAVAID',
  'FOD Hazard': 'FOD',
}

/** Abbreviate a formatted type name. Multi-type (newline or comma separated) handled. */
export function abbreviateType(formatted: string): string {
  // Handle comma-separated multi-types
  if (formatted.includes(',')) {
    return formatted.split(',').map(t => abbreviateType(t.trim())).join('\n')
  }
  return TYPE_ABBREV[formatted] || formatted
}

// ── Photo Constants ──

export const PDF_PHOTO = {
  THUMB_W: 20,   // mm
  THUMB_H: 15,   // mm (4:3 ratio)
  GAP: 1.5,      // mm between thumbs
  PADDING: 2,    // mm cell padding
  COL_W: 44,     // mm photo column width
} as const

// ── Table Styles ──

export const PDF_TABLE_STYLES = {
  HEAD_FILL: [30, 41, 59] as [number, number, number],
  ALT_ROW: [245, 245, 245] as [number, number, number],
  FONT_SIZE: 7,
  CELL_PADDING: 1.5,
} as const

// ── Column Definitions ──

export interface PdfColumnDef {
  key: string
  header: string
  baseWidth: number  // mm, 0 = flex
  halign?: 'left' | 'center' | 'right'
  fontSize?: number
}

export const COLUMN_DEFS: PdfColumnDef[] = [
  { key: 'work_order', header: 'W/O #', baseWidth: 16 },
  { key: 'title', header: 'Title', baseWidth: 0 },  // flex
  { key: 'status', header: 'Status', baseWidth: 24 },
  { key: 'location', header: 'Location', baseWidth: 16 },
  { key: 'type', header: 'Type', baseWidth: 22 },
  { key: 'shop', header: 'Shop', baseWidth: 20 },
  { key: 'days_open', header: 'Days', baseWidth: 10, halign: 'center' },
  { key: 'reported_by', header: 'Reported By', baseWidth: 20 },
  { key: 'last_update', header: 'Last Update', baseWidth: 14 },
  { key: 'comments', header: 'Comments', baseWidth: 32, fontSize: 6 },
  { key: 'photos', header: 'Photos', baseWidth: PDF_PHOTO.COL_W },
]

export const BASIC_COLUMNS = ['work_order', 'title', 'status', 'location']
export const ALL_OPTIONAL_COLUMNS = ['type', 'shop', 'days_open', 'reported_by', 'last_update', 'comments', 'photos']

function getColumnDef(key: string): PdfColumnDef | undefined {
  return COLUMN_DEFS.find(c => c.key === key)
}

// ── Photo Rendering Helpers ──

/** Compute the minimum cell height needed to display N photos in a cell of given width. */
export function photoCellHeight(numPhotos: number, cellWidth: number): number {
  if (numPhotos === 0) return 0
  const available = cellWidth - PDF_PHOTO.PADDING * 2
  const thumbsPerRow = Math.max(1, Math.floor(available / (PDF_PHOTO.THUMB_W + PDF_PHOTO.GAP)))
  const rows = Math.ceil(numPhotos / thumbsPerRow)
  return PDF_PHOTO.PADDING * 2 + rows * PDF_PHOTO.THUMB_H + Math.max(0, rows - 1) * PDF_PHOTO.GAP
}

/** Draw photo thumbnails inside a table cell. Accepts both string[] (data URLs) and PhotoForReport[]. */
export function drawPhotosInCell(
  doc: jsPDF,
  photos: (string | PhotoForReport)[],
  cellX: number,
  cellY: number,
  cellWidth: number,
) {
  if (photos.length === 0) return

  const availableWidth = cellWidth - PDF_PHOTO.PADDING * 2
  const thumbsPerRow = Math.max(1, Math.floor(availableWidth / (PDF_PHOTO.THUMB_W + PDF_PHOTO.GAP)))
  let xOffset = cellX + PDF_PHOTO.PADDING
  let yOffset = cellY + PDF_PHOTO.PADDING

  for (let i = 0; i < photos.length; i++) {
    if (i > 0 && i % thumbsPerRow === 0) {
      yOffset += PDF_PHOTO.THUMB_H + PDF_PHOTO.GAP
      xOffset = cellX + PDF_PHOTO.PADDING
    }

    const photo = photos[i]
    const dataUrl = typeof photo === 'string' ? photo : photo.dataUrl

    if (dataUrl) {
      try {
        const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(dataUrl, format, xOffset, yOffset, PDF_PHOTO.THUMB_W, PDF_PHOTO.THUMB_H)
      } catch {
        drawPlaceholder(doc, xOffset, yOffset)
      }
    } else {
      drawPlaceholder(doc, xOffset, yOffset)
    }

    xOffset += PDF_PHOTO.THUMB_W + PDF_PHOTO.GAP
  }
}

function drawPlaceholder(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(180)
  doc.rect(x, y, PDF_PHOTO.THUMB_W, PDF_PHOTO.THUMB_H)
  doc.setFontSize(5)
  doc.setTextColor(150)
  doc.text('img', x + 2, y + PDF_PHOTO.THUMB_H / 2)
}

// ── PDF Text Sanitizer ──
// jsPDF's built-in Helvetica lacks many Unicode glyphs. Replace common ones with ASCII equivalents.

export function sanitizePdfText(text: string): string {
  return text
    .replace(/\u25BA/g, '>')    // ► BLACK RIGHT-POINTING POINTER
    .replace(/\u25B6/g, '>')    // ▶ BLACK RIGHT-POINTING TRIANGLE
    .replace(/\u25C4/g, '<')    // ◄ BLACK LEFT-POINTING POINTER
    .replace(/\u25C0/g, '<')    // ◀ BLACK LEFT-POINTING TRIANGLE
    .replace(/\u2190/g, '<-')   // ←
    .replace(/\u2192/g, '->')   // →
    .replace(/\u2191/g, '^')    // ↑
    .replace(/\u2193/g, 'v')    // ↓
    .replace(/\u21D0/g, '<=')   // ⇐
    .replace(/\u21D2/g, '=>')   // ⇒
    .replace(/\u2014/g, '--')   // — em dash
    .replace(/\u2013/g, '-')    // – en dash
    .replace(/\u2018/g, "'")    // ' left single quote
    .replace(/\u2019/g, "'")    // ' right single quote
    .replace(/\u201C/g, '"')    // " left double quote
    .replace(/\u201D/g, '"')    // " right double quote
    .replace(/\u2026/g, '...')  // … ellipsis
    .replace(/\u2022/g, '*')    // • bullet
}

// ── Core Table Builder ──

export interface DiscrepancyRowData {
  id: string
  work_order?: string
  title: string
  status_label: string
  location: string
  type_label?: string
  shop?: string
  days_open?: number
  reported_by?: string
  last_update?: string
  comments?: string
  photos?: (string | PhotoForReport)[]
}

interface BuildTableOptions {
  doc: jsPDF
  startY: number
  margin: number
  selectedColumns: string[]
  rows: DiscrepancyRowData[]
  pageWidth: number
}

/**
 * Build a discrepancy table with configurable columns.
 * Title is the flex column — absorbs remaining space after fixed columns.
 * Photos always renders as last column when selected.
 * Returns the finalY after the table.
 */
export function buildDiscrepancyTable(opts: BuildTableOptions): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const autoTable = require('jspdf-autotable').default || require('jspdf-autotable')

  const { doc, startY, margin, selectedColumns, rows, pageWidth } = opts
  const contentWidth = pageWidth - margin * 2

  // Ensure photos is always last if present
  const orderedCols = selectedColumns.filter(c => c !== 'photos')
  if (selectedColumns.includes('photos')) orderedCols.push('photos')

  // Build column defs in order
  const colDefs = orderedCols.map(key => getColumnDef(key)).filter(Boolean) as PdfColumnDef[]

  // Calculate flex (title) width
  const fixedTotal = colDefs.reduce((sum, c) => sum + (c.key === 'title' ? 0 : c.baseWidth), 0)
  const titleWidth = Math.max(24, contentWidth - fixedTotal)

  // Build head row
  const headRow = colDefs.map(c => c.header)

  // Build body rows
  const hasPhotosCol = orderedCols.includes('photos')
  const photosColIdx = hasPhotosCol ? orderedCols.indexOf('photos') : -1

  const s = sanitizePdfText  // shorthand
  const tableBody = rows.map(row => {
    return orderedCols.map(key => {
      switch (key) {
        case 'work_order': return s(row.work_order || '')
        case 'title': return s(row.title)
        case 'status': return s(row.status_label)
        case 'location': return s(row.location)
        case 'type': return s(row.type_label ? abbreviateType(row.type_label) : '')
        case 'shop': return s(row.shop || 'Unassigned')
        case 'days_open': return row.days_open != null ? row.days_open.toString() : ''
        case 'reported_by': return s(row.reported_by || '')
        case 'last_update': return row.last_update || ''
        case 'comments': return s(row.comments || '')
        case 'photos': return '' // rendered via didDrawCell
        default: return ''
      }
    })
  })

  // Build columnStyles
  const columnStyles: Record<number, Record<string, unknown>> = {}
  colDefs.forEach((c, i) => {
    const style: Record<string, unknown> = {
      cellWidth: c.key === 'title' ? titleWidth : c.baseWidth,
    }
    if (c.halign) style.halign = c.halign
    if (c.fontSize) style.fontSize = c.fontSize
    columnStyles[i] = style
  })

  const daysColIdx = orderedCols.indexOf('days_open')

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [headRow],
    body: tableBody,
    styles: {
      fontSize: PDF_TABLE_STYLES.FONT_SIZE,
      cellPadding: PDF_TABLE_STYLES.CELL_PADDING,
      textColor: [0, 0, 0] as [number, number, number],
    },
    headStyles: {
      fillColor: PDF_TABLE_STYLES.HEAD_FILL,
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: PDF_TABLE_STYLES.FONT_SIZE,
    },
    alternateRowStyles: { fillColor: PDF_TABLE_STYLES.ALT_ROW },
    columnStyles,
    didParseCell: (hookData: {
      section: string
      column: { index: number }
      row: { index: number }
      cell: { styles: { textColor?: unknown; fontStyle?: string; minCellHeight?: number } }
    }) => {
      if (hookData.section !== 'body') return
      const rowIdx = hookData.row.index
      const row = rows[rowIdx]
      if (!row) return

      // Bold + red for >30 days
      if (daysColIdx >= 0 && hookData.column.index === daysColIdx && row.days_open != null && row.days_open > 30) {
        hookData.cell.styles.textColor = [220, 38, 38]
        hookData.cell.styles.fontStyle = 'bold'
      }

      // Set row height for photos
      if (hasPhotosCol && hookData.column.index === photosColIdx) {
        const photos = row.photos || []
        if (photos.length > 0) {
          hookData.cell.styles.minCellHeight = photoCellHeight(photos.length, PDF_PHOTO.COL_W)
        }
      }
    },
    didDrawCell: (hookData: {
      section: string
      column: { index: number }
      row: { index: number }
      cell: { x: number; y: number; width: number }
    }) => {
      if (hookData.section === 'body' && hasPhotosCol && hookData.column.index === photosColIdx) {
        const photos = rows[hookData.row.index]?.photos || []
        drawPhotosInCell(doc, photos, hookData.cell.x, hookData.cell.y, hookData.cell.width)
      }
    },
  })

  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

// ── Template Persistence ──

export interface PdfReportTemplate {
  name: string
  columns: string[]
}

const TEMPLATES_KEY = 'glidepath_pdf_templates'

export function loadPdfTemplates(): PdfReportTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (raw) return JSON.parse(raw) as PdfReportTemplate[]
  } catch { /* ignore */ }
  return [getDefaultTemplate()]
}

export function savePdfTemplates(templates: PdfReportTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

export function getDefaultTemplate(): PdfReportTemplate {
  return {
    name: 'Basic',
    columns: [...BASIC_COLUMNS],
  }
}
