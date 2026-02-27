/**
 * Shared styled Excel export utilities using ExcelJS.
 * Provides consistent formatting across all Excel exports in Glidepath.
 */

import type ExcelJS from 'exceljs'

export interface ColumnDef {
  header: string
  key: string
  width: number
  /** Optional: format as date */
  isDate?: boolean
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' },
}

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
}

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8FAFC' },
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
}

/** Create a new ExcelJS workbook */
export async function createStyledWorkbook(): Promise<ExcelJS.Workbook> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Glidepath'
  wb.created = new Date()
  return wb
}

/** Add a styled worksheet with headers, data rows, alternating colors, borders, and auto-filter. */
export function addStyledSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: ColumnDef[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: Record<string, any>[],
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(name)

  // Set columns
  ws.columns = columns.map(c => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }))

  // Style header row
  styleHeaderRow(ws)

  // Add data rows
  for (const row of rows) {
    ws.addRow(row)
  }

  // Apply alternating rows + borders
  addAlternatingRows(ws)

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  // Auto-filter
  if (ws.rowCount > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    }
  }

  return ws
}

/** Style the first row as a header */
export function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const headerRow = ws.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = THIN_BORDER
  })
  headerRow.height = 24
}

/** Apply alternating row colors and borders to all data rows */
export function addAlternatingRows(ws: ExcelJS.Worksheet): void {
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER
      if (i % 2 === 0) {
        cell.fill = ALT_ROW_FILL
      }
    })
  }
}

/** Save workbook as a downloadable file in the browser */
export async function saveWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Capitalize first letter of each word (Title Case) */
export function titleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
