// ─────────────────────────────────────────────────────────────
// AMTR date + JSON import helpers.
//
// parseAmtrDate handles the date formats the prototype's workbooks
// use (Excel serials, ISO, M/D/YY, D-MMM-YY). The live Excel import
// path uses ExcelJS (lib/amtr-record-excel.ts); the old SheetJS-based
// roster parser was removed along with the vulnerable `xlsx` dependency.
// The JSON round-trip (exportAmtrJson / parseAmtrJson) is complete.
// ─────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

/** Normalize a cell value to a YYYY-MM-DD string, or '' if unparseable. */
export function parseAmtrDate(value: unknown): string {
  if (value == null || value === '') return ''
  // Excel serial date number (days since 1899-12-30).
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86_400_000)
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  // ISO already.
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // D-MMM-YY / D MMM YYYY
  const m1 = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s]?(\d{2,4})?$/)
  if (m1) {
    const day = Number(m1[1])
    const mon = MONTHS[m1[2].toLowerCase()]
    let year = m1[3] ? Number(m1[3]) : new Date().getUTCFullYear()
    if (year < 100) year += 2000
    if (mon != null) return isoOf(year, mon, day)
  }
  // M/D/YY or M/D/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m2) {
    let year = Number(m2[3]); if (year < 100) year += 2000
    return isoOf(year, Number(m2[1]) - 1, Number(m2[2]))
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

function isoOf(year: number, monthIdx: number, day: number): string {
  const d = new Date(Date.UTC(year, monthIdx, day))
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** Serialize a full AMTR snapshot to a JSON blob string (export). */
export function exportAmtrJson(snapshot: unknown): string {
  return JSON.stringify(snapshot, null, 2)
}

/** Parse an exported AMTR JSON blob (import round-trip). */
export function parseAmtrJson(text: string): unknown {
  return JSON.parse(text)
}
