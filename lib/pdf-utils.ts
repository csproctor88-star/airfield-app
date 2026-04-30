import jsPDF from 'jspdf'
import type { UserOptions } from 'jspdf-autotable'
import { formatZuluDateTime } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'

// ─────────────────────────────────────────────────────────────
// Shared PDF utility — consolidates boilerplate used across the
// 19 generators in lib/*-pdf.ts + lib/reports/*-pdf.ts. Covers
// document setup, the "BASE NAME (ICAO)" / AMS header block, the
// title + stat box chrome, the autoTable theme, and the page
// footer. Generators still own their body content; this just
// lets a fix to (e.g.) the header line happen once instead of
// 19 times.
//
// ── Y-COORDINATE CONVENTION ──
// jsPDF text APIs (`doc.text`) draw with the y-coord as the text
// BASELINE. Box APIs (`doc.rect`, `doc.roundedRect`) draw with
// the y-coord as the TOP edge. Mixing these without care causes
// silent overlap: text drawn at y=10 occupies roughly y=7.5..y=11,
// while a rect drawn at y=10 starts AT y=10. To stay consistent
// across all generators, treat the running `y` cursor as
// "the top edge of the next element to draw", and:
//
//   • For text: draw at `y + caphHeight` (≈ 3mm at 9pt), then
//     advance `y += textHeight + spacing`.
//   • For boxes: draw at `y` directly, then `y += boxH + spacing`.
//
// Always advance y AFTER drawing a colored left-rule that extends
// above the cursor (e.g. status row rules drawn from rowStart - 3
// for cap-height alignment). The next row's rule top must clear
// the previous element's bottom by at least STEP_ROW_GAP_MM /2.
// ─────────────────────────────────────────────────────────────

/** Min gap (mm) between row content and the next row's left-rule top edge. */
export const STEP_ROW_GAP_MM = 6
/** Min gap (mm) between a banner/info block (warning, conditional, text card) and the next element. */
export const BLOCK_POST_SPACING_MM = 6
/** Approximate cap-height for 9pt Helvetica in mm — use as text-baseline offset. */
export const TEXT_CAP_HEIGHT_9PT_MM = 3
/** Thin spacing (mm) used between a label and a sub-element within the same row. */
export const ROW_INNER_GAP_MM = 2

export interface PdfContext {
  doc: jsPDF
  pageWidth: number
  pageHeight: number
  margin: number
  contentWidth: number
}

export interface CreatePdfOptions {
  orientation?: 'portrait' | 'landscape'
  format?: 'letter' | 'a4' | 'legal'
  /** Page margin in mm. Defaults to 15 (portrait) / 12 (landscape) to match house style. */
  margin?: number
}

/** Standard document setup matching the Glidepath report style. */
export function createPdf(opts: CreatePdfOptions = {}): PdfContext {
  const { orientation = 'portrait', format = 'letter' } = opts
  const margin = opts.margin ?? (orientation === 'landscape' ? 12 : 15)
  const doc = new jsPDF({ orientation, unit: 'mm', format })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  return {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
  }
}

export interface BaseHeaderOptions {
  baseName?: string | null
  baseIcao?: string | null
  /** Second line of the small-gray header. Defaults to "AIRFIELD MANAGEMENT SECTION". */
  sectionLabel?: string
}

/**
 * Small gray header line (base name + ICAO, then AMS label). Every
 * operational report starts with this. Returns the next `y` cursor.
 */
export function drawBaseHeader(
  ctx: PdfContext,
  y: number,
  opts: BaseHeaderOptions = {},
): number {
  const { doc, margin } = ctx
  const { baseName, baseIcao, sectionLabel = 'AIRFIELD MANAGEMENT SECTION' } = opts
  const line1 = baseName
    ? `${baseName.toUpperCase()}${baseIcao ? ` (${baseIcao})` : ''}`
    : 'AIRFIELD OPERATIONS'
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(sanitizePdfText(line1), margin, y)
  doc.text(sectionLabel, margin, y + 4)
  return y + 12
}

export interface ReportTitleOptions {
  title: string
  subtitle?: string
}

/** Bold title + optional gray subtitle line. Returns the next `y` cursor. */
export function drawReportTitle(
  ctx: PdfContext,
  y: number,
  opts: ReportTitleOptions,
): number {
  const { doc, margin } = ctx
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text(opts.title, margin, y)
  y += 7
  if (opts.subtitle) {
    doc.setFontSize(11)
    doc.setTextColor(60)
    doc.text(opts.subtitle, margin, y)
    y += 8
  } else {
    y += 1
  }
  return y
}

export interface StatBoxItem {
  label: string
  value: string
}

/**
 * Rounded light-gray info box with N evenly-spaced label/value pairs.
 * Pass `{ label: 'Generated', value: formatZuluDateTime(new Date()) }` to
 * get the standard timestamp column. Returns the next `y` cursor.
 */
export function drawStatBox(
  ctx: PdfContext,
  y: number,
  items: StatBoxItem[],
): number {
  const { doc, margin, contentWidth } = ctx
  const boxHeight = 16
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD')

  const colWidth = items.length > 0 ? contentWidth / items.length : contentWidth
  items.forEach((item, i) => {
    const x = margin + 4 + i * colWidth
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(item.label, x, y + 5)
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.text(item.value, x, y + 11)
  })
  return y + boxHeight + 6
}

/**
 * Standard footer — "Generated by Glidepath — <Zulu>" left, page numbers right.
 * Use inside autoTable's `didDrawPage` hook, or call directly on the last
 * page for non-tabular reports.
 */
export function drawFooter(ctx: PdfContext): void {
  const { doc, margin, pageWidth, pageHeight } = ctx
  const total = doc.getNumberOfPages()
  const current = doc.getCurrentPageInfo().pageNumber
  doc.setFontSize(7)
  doc.setTextColor(140)
  doc.text(
    `Generated by Glidepath — ${formatZuluDateTime(new Date())}`,
    margin,
    pageHeight - 8,
  )
  doc.text(
    `Page ${current} of ${total}`,
    pageWidth - margin,
    pageHeight - 8,
    { align: 'right' },
  )
}

/**
 * Glidepath house-style autoTable defaults — grid theme, 7pt fontSize,
 * dark slate header (fill #1e293b / white text), 4.5% gray alternate rows.
 * Spread the result into your autoTable call so you can override any
 * key (e.g. `columnStyles`, `didParseCell`) per-report.
 */
export function tableStyles(ctx: PdfContext): Partial<UserOptions> {
  return {
    theme: 'grid',
    margin: { left: ctx.margin, right: ctx.margin },
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  }
}

/** `YYYY-MM-DD` of the current UTC date — used for default filenames. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
