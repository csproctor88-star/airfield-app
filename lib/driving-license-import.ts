import ExcelJS from 'exceljs'
import type { DriverLicenseImportRow } from '@/lib/supabase/driving-checks'

// ─────────────────────────────────────────────────────────────
// Parse an ADDx "Airfield Licenses Report" .xlsx into driver rows.
//
// Columns are matched by HEADER NAME (case-insensitive, whitespace-
// normalized) rather than fixed position, so a re-ordered or slightly
// renamed export still maps. The known ADDx layout is:
//   Last | First | Middle | Grade/Rank | Unit | Office |
//   AF 483 Number | Restrictions | Refresher Due Date
//
// Bundled with exceljs — callers dynamic-import this module so exceljs
// stays out of the base bundle (mirrors the *-pdf.ts lazy-load idiom).
// ─────────────────────────────────────────────────────────────

type Field = keyof DriverLicenseImportRow

/** Map one header cell to a field. Order matters — more specific tokens win. */
function matchField(header: string): Field | null {
  const h = header.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!h) return null
  if (h === 'last' || h.includes('last name') || h.includes('surname')) return 'last_name'
  if (h === 'first' || h.includes('first name')) return 'first_name'
  if (h === 'middle' || h.includes('middle')) return 'middle_name'
  if (h.includes('grade') || h.includes('rank')) return 'grade_rank'
  if (h.includes('unit') || h.includes('squadron')) return 'unit'
  if (h.includes('office')) return 'office'
  if (h.includes('483')) return 'af_483_number'
  if (h.includes('restriction')) return 'restrictions'
  if (h.includes('refresher') || (h.includes('due') && h.includes('date'))) return 'refresher_due'
  return null
}

function isoDate(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10)
}

/** Coerce any ExcelJS cell value to trimmed text (or null). Handles plain
 *  strings/numbers, rich text, hyperlinks, and formula results. */
function cellText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value instanceof Date) return isoDate(value)
  if (typeof value === 'object') {
    const v = value as { text?: string; result?: unknown; richText?: Array<{ text?: string }> }
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text ?? '').join('').trim() || null
    if (typeof v.text === 'string') return v.text.trim() || null
    if (v.result != null) return cellText(v.result)
  }
  return null
}

/** Excel serial (days since 1899-12-30) → ISO date. ExcelJS returns a Date
 *  for date-formatted cells, but a number-formatted date cell arrives as a
 *  serial — handle both, plus a parseable date string. */
function toIsoDate(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return isoDate(value)
  if (typeof value === 'number') {
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000
    const d = new Date(ms)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  if (typeof value === 'object') {
    const v = value as { result?: unknown; text?: string }
    if (v.result != null) return toIsoDate(v.result)
    if (typeof v.text === 'string') return toIsoDate(v.text)
    return null
  }
  if (typeof value === 'string') {
    const t = value.trim()
    if (!t) return null
    const parsed = new Date(t)
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }
  return null
}

export type LicenseParseResult = {
  rows: DriverLicenseImportRow[]
  /** Data rows skipped because they had no surname. */
  skipped: number
  /** Distinct fields the header row mapped to (for a "mapped N columns" note). */
  matchedColumns: Field[]
  error?: string
}

export async function parseAirfieldLicensesXlsx(buffer: ArrayBuffer): Promise<LicenseParseResult> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer)
  } catch {
    return { rows: [], skipped: 0, matchedColumns: [], error: 'Could not read the file — is it a valid .xlsx export?' }
  }
  const ws = wb.worksheets[0]
  if (!ws) return { rows: [], skipped: 0, matchedColumns: [], error: 'The workbook has no worksheets.' }

  // Map column index → field from the header (row 1). First match per field wins.
  const colField = new Map<number, Field>()
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const header = cellText(cell.value)
    if (!header) return
    const field = matchField(header)
    if (field && !Array.from(colField.values()).includes(field)) colField.set(col, field)
  })

  if (!Array.from(colField.values()).includes('last_name')) {
    return {
      rows: [], skipped: 0, matchedColumns: [],
      error: 'No "Last" name column found — is this an ADDx Airfield Licenses Report?',
    }
  }

  const rows: DriverLicenseImportRow[] = []
  let skipped = 0
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const rec: DriverLicenseImportRow = {
      last_name: '', first_name: null, middle_name: null, grade_rank: null,
      unit: null, office: null, af_483_number: null, restrictions: null, refresher_due: null,
    }
    for (const [col, field] of colField) {
      const raw: unknown = row.getCell(col).value
      if (field === 'refresher_due') rec.refresher_due = toIsoDate(raw)
      else (rec as Record<Field, string | null>)[field] = cellText(raw)
    }
    const last = (rec.last_name || '').trim()
    if (!last) { skipped++; continue } // a row with no surname isn't a driver
    rec.last_name = last
    rows.push(rec)
  }

  return { rows, skipped, matchedColumns: Array.from(new Set(colField.values())) }
}
