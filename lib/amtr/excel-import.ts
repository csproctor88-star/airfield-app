// ─────────────────────────────────────────────────────────────
// AMTR Excel/JSON import helpers (SheetJS — already a dependency).
//
// parseAmtrDate handles the date formats the prototype's workbooks
// use (Excel serials, ISO, M/D/YY, D-MMM-YY). parseRosterWorkbook
// maps a member roster sheet to AmtrMember create inputs. Full
// multi-sheet (JQS / 623A / 797 / 1098) import is a follow-up; the
// JSON round-trip (exportAmtrJson / parseAmtrJson) is complete.
// ─────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx'

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

export type RosterImportRow = {
  full_name: string
  grade?: string
  dafsc?: string
  unit?: string
  status?: string
  tsc?: string
  duty_position?: string
  supervisor?: string
  date_assigned?: string
}

/** Read the first sheet of a workbook as a member roster. */
export function parseRosterWorkbook(buf: ArrayBuffer): RosterImportRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' })
  const pick = (r: Record<string, unknown>, keys: string[]): string => {
    for (const k of Object.keys(r)) {
      if (keys.some((want) => k.toLowerCase().includes(want))) {
        const v = r[k]
        if (v != null && String(v).trim()) return String(v).trim()
      }
    }
    return ''
  }
  return rows
    .map((r) => ({
      full_name: pick(r, ['name', 'member']),
      grade: pick(r, ['grade', 'rank']),
      dafsc: pick(r, ['dafsc', 'afsc']),
      unit: pick(r, ['unit']),
      status: pick(r, ['status']),
      tsc: pick(r, ['tsc']),
      duty_position: pick(r, ['duty', 'position']),
      supervisor: pick(r, ['supervisor', 'trainer']),
      date_assigned: parseAmtrDate(r[Object.keys(r).find((k) => k.toLowerCase().includes('assign')) ?? '']),
    }))
    .filter((r) => r.full_name)
}

/** Serialize a full AMTR snapshot to a JSON blob string (export). */
export function exportAmtrJson(snapshot: unknown): string {
  return JSON.stringify(snapshot, null, 2)
}

/** Parse an exported AMTR JSON blob (import round-trip). */
export function parseAmtrJson(text: string): unknown {
  return JSON.parse(text)
}
