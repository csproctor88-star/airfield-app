// ─────────────────────────────────────────────────────────────
// AMTR — "Export Record" to the HAF electronic training record (.xlsx).
//
// Loads the real HAF template workbook (public/amtr/...) and writes the
// member's record into each sheet's data region, preserving the HAF
// headers, formatting, and sheet layout so the export matches the
// inspection-format spreadsheet. Example data shipped in the template is
// cleared first; rows beyond the template's blanks are appended.
//
// Client-side only (like every other generator in this app).
// ─────────────────────────────────────────────────────────────

import ExcelJS from 'exceljs'
import { fetchAmtrByBase, fetchAmtrByMember, type AmtrMember } from '@/lib/supabase/amtr'

const TEMPLATE_URL = '/amtr/training-record-template.xlsx'
type Row = Record<string, unknown>
type WS = ExcelJS.Worksheet

const dt = (v: unknown): string => (v ? String(v).slice(0, 10) : '')
const str = (v: unknown): string => (v == null ? '' : String(v))
function set(ws: WS, addr: string, v: unknown) { ws.getCell(addr).value = v === '' || v == null ? null : (v as ExcelJS.CellValue) }

/** "Last, First M" → "LAST - FIRST - M." for the cover title. */
function coverName(full: string): string {
  const s = (full || '').trim()
  if (!s) return ''
  if (s.includes(',')) {
    const [last, rest] = s.split(',')
    const parts = rest.trim().split(/\s+/)
    return [last.trim(), ...parts].filter(Boolean).join(' - ').toUpperCase() + '.'
  }
  return s.toUpperCase()
}

async function loadTemplate(): Promise<ExcelJS.Workbook> {
  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) throw new Error('Could not load the HAF training-record template.')
  const buf = await res.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  return wb
}

async function fetchRecordData(installationId: string, memberId: string) {
  const [jqsCat, jqsProg, qualCat, qualProg, items797, items803, r1098Cat, r1098Prog, ratCat, ratProg, e623a] = await Promise.all([
    fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
    fetchAmtrByMember<Row>('amtr_jqs_progress', memberId),
    fetchAmtrByBase<Row>('amtr_qual_catalog', installationId),
    fetchAmtrByMember<Row>('amtr_qual_progress', memberId),
    fetchAmtrByMember<Row>('amtr_797', memberId, 'sort_order'),
    fetchAmtrByMember<Row>('amtr_803', memberId, 'sort_order'),
    fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
    fetchAmtrByMember<Row>('amtr_1098_progress', memberId),
    fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
    fetchAmtrByMember<Row>('amtr_rat_progress', memberId),
    fetchAmtrByMember<Row>('amtr_623a', memberId, 'form_date'),
  ])
  return { jqsCat, jqsProg, qualCat, qualProg, items797, items803, r1098Cat, r1098Prog, ratCat, ratProg, e623a }
}

// ── Generic flat-table writer ──────────────────────────────
// Clears the value columns over the data region, then writes `rows`
// (each an array of [colLetter, value] pairs), appending rows (with the
// first data row's style) when there are more rows than blanks.
function writeFlatTable(ws: WS, startRow: number, cols: string[], rows: [string, unknown][][]) {
  // Clear a generous window of existing data so example rows don't linger.
  const clearTo = Math.max(startRow + rows.length, startRow + 60)
  for (let r = startRow; r <= clearTo; r++) for (const c of cols) set(ws, `${c}${r}`, null)
  rows.forEach((cells, i) => {
    const rn = startRow + i
    if (rn > ws.rowCount) ws.insertRow(rn, [], 'i')
    for (const [c, v] of cells) set(ws, `${c}${rn}`, v)
  })
}

function fillCover(ws: WS | undefined, member: AmtrMember) {
  if (!ws) return
  set(ws, 'A1', coverName(member.full_name))
}

function fillQualifications(ws: WS | undefined, member: AmtrMember, cat: Row[], prog: Row[]) {
  if (!ws) return
  // Identity header lines.
  set(ws, 'A3', `Name: ${member.full_name ?? ''}`)
  set(ws, 'B3', `Rank: ${member.grade ?? ''}`)
  set(ws, 'A4', `Current Duty Position: ${member.duty_position ?? ''}`)
  set(ws, 'B4', `DAFSC: ${member.dafsc ?? ''}`)
  set(ws, 'A5', `TSC: ${member.tsc ?? ''}`)
  const progByCat = new Map(prog.map((p) => [String(p.catalog_id), p]))
  // QTP packages (complete date) — block starts R7. Skill levels + SEIs (Yes/No) — block starts R13.
  const qtp = cat.filter((c) => c.category === 'qtp')
  const yn = cat.filter((c) => c.category === 'skill_level' || c.category === 'sei')
  for (let r = 7; r <= 11; r++) { set(ws, `A${r}`, null); set(ws, `B${r}`, null) }
  qtp.forEach((c, i) => { const r = 7 + i; if (r > ws.rowCount) ws.insertRow(r, [], 'i'); set(ws, `A${r}`, str(c.name)); const p = progByCat.get(String(c.id)); set(ws, `B${r}`, dt(p?.complete_date)) })
  for (let r = 13; r <= 22; r++) { set(ws, `A${r}`, null); set(ws, `B${r}`, null) }
  yn.forEach((c, i) => { const r = 13 + i; if (r > ws.rowCount) ws.insertRow(r, [], 'i'); set(ws, `A${r}`, str(c.name)); const p = progByCat.get(String(c.id)); set(ws, `B${r}`, p?.attained ? 'Yes' : 'No') })
}

function fill1098(ws: WS | undefined, yearLabel: string, cat: Row[], prog: Row[]) {
  if (!ws) return
  const byCat = new Map(prog.filter((p) => String(p.year_label) === yearLabel).map((p) => [String(p.catalog_id), p]))
  const rows = cat.map((c) => {
    const p = byCat.get(String(c.id))
    return [
      ['A', str(c.task)], ['B', dt(p?.start_date)], ['C', dt(p?.last_completed)],
      ['D', str(p?.certifier_initials)], ['E', str(p?.trainee_initials)],
      ['F', str(c.score_or_hours)], ['G', str(c.type)], ['H', str(c.frequency)], ['I', dt(p?.next_due)],
    ] as [string, unknown][]
  })
  writeFlatTable(ws, 4, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], rows)
}

function fill797(ws: WS | undefined, items: Row[]) {
  if (!ws) return
  const rows = items.map((it) => ([
    ['A', str(it.task)], ['B', dt(it.start_date)], ['C', dt(it.complete_date)],
    ['D', str(it.trainee_initials)], ['E', str(it.trainer_initials)], ['F', str(it.certifier_initials)],
    ['G', str(it.milestone_window)],
  ]) as [string, unknown][])
  writeFlatTable(ws, 4, ['A', 'B', 'C', 'D', 'E', 'F', 'G'], rows)
}

function fill623a(ws: WS | undefined, entries: Row[]) {
  if (!ws) return
  const rows = entries.map((e) => ([
    ['A', dt(e.form_date)], ['B', str(e.entry_type)],
    ['C', `${str(e.trainee_initials)}${e.trainee_comment ? ` — ${str(e.trainee_comment)}` : ''}`.trim()],
    ['D', `${str(e.trainer_initials)}${e.trainer_comment ? ` — ${str(e.trainer_comment)}` : ''}`.trim()],
    ['E', `${str(e.namt_initials)}${e.namt_comment ? ` — ${str(e.namt_comment)}` : ''}`.trim()],
    ['F', `${str(e.afm_initials)}${e.afm_comment ? ` — ${str(e.afm_comment)}` : ''}`.trim()],
  ]) as [string, unknown][])
  writeFlatTable(ws, 2, ['A', 'B', 'C', 'D', 'E', 'F'], rows)
}

function fillRat(ws: WS | undefined, cat: Row[], prog: Row[]) {
  if (!ws) return
  const byCat = new Map(prog.map((p) => [String(p.catalog_id), p]))
  const rows = cat.map((c) => {
    const p = byCat.get(String(c.id))
    return [['A', str(c.course)], ['B', ''], ['C', dt(p?.completed)]] as [string, unknown][]
  })
  writeFlatTable(ws, 3, ['A', 'B', 'C'], rows)
}

// JQS-CFETP: fill per-member Training Start/Complete + initials on item rows,
// matched to the catalog by leading task number. Catalog/proficiency columns
// are the template's standard CFETP and are left intact.
function fillJqs(ws: WS | undefined, cat: Row[], prog: Row[]) {
  if (!ws) return
  const progByCat = new Map(prog.map((p) => [String(p.catalog_id), p]))
  const numToProg = new Map<string, Row>()
  for (const c of cat) {
    if (c.kind === 'section') continue
    const num = str(c.number).replace(/[.\s]+$/, '').trim()
    const p = progByCat.get(String(c.id))
    if (num && p) numToProg.set(num, p)
  }
  const leadNum = (s: string) => { const m = String(s).match(/^\s*([\d]+(?:\.[\d]+)*)/); return m ? m[1].replace(/[.\s]+$/, '') : '' }
  for (let r = 7; r <= ws.rowCount; r++) {
    const a = ws.getCell(`A${r}`).value
    const text = a && typeof a === 'object' ? '' : str(a)
    const num = leadNum(text)
    if (!num) continue
    // clear example initials/dates on item rows
    for (const c of ['D', 'E', 'F', 'G', 'H']) set(ws, `${c}${r}`, null)
    const p = numToProg.get(num)
    if (!p) continue
    set(ws, `D${r}`, dt(p.start_date)); set(ws, `E${r}`, dt(p.complete_date))
    set(ws, `F${r}`, str(p.trainee_initials)); set(ws, `G${r}`, str(p.trainer_initials)); set(ws, `H${r}`, str(p.certifier_initials))
  }
}

// DAF 803: one row per evaluation — A:J (merged) = STS item, K date, L UGT,
// M results, N evaluator initials. Clears example values, writes member evals.
function fill803(ws: WS | undefined, items: Row[]) {
  if (!ws) return
  // Find the header row (col A starts with "JQS Task Item").
  let header = 0
  for (let r = 1; r <= 8; r++) { if (/JQS Task Item/i.test(str(ws.getCell(`A${r}`).value))) { header = r; break } }
  const start = (header || 3) + 1
  const clearTo = Math.max(start + items.length, start + 30)
  for (let r = start; r <= clearTo; r++) for (const c of ['A', 'K', 'L', 'M', 'N']) set(ws, `${c}${r}`, null)
  items.forEach((it, i) => {
    const r = start + i
    if (r > ws.rowCount) ws.insertRow(r, [], 'i')
    set(ws, `A${r}`, str(it.sts_item))
    set(ws, `K${r}`, dt(it.eval_date))
    set(ws, `L${r}`, str(it.in_ugt))
    set(ws, `M${r}`, str(it.results))
    set(ws, `N${r}`, str(it.evaluator_initials))
  })
}

const SECTION_SHEET: Record<string, string> = {
  apprenticeGrad: 'DAF Form 803 (Apprentice Grad)', amslAmos: 'DAF Form 803 (AMSL_AMOS)',
  fiveLevel: 'DAF Form 803 (5-Level)', sevenLevel: 'DAF Form 803 (7-Level)', afm: 'DAF Form 803 (AFM)',
}

function downloadBuffer(buf: ArrayBuffer, filename: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Export a member's record as the populated HAF training-record workbook. */
export async function exportAmtrRecord(installationId: string, member: AmtrMember): Promise<void> {
  const [wb, data] = await Promise.all([loadTemplate(), fetchRecordData(installationId, member.id)])
  const currentYear = String(new Date().getUTCFullYear())

  fillCover(wb.getWorksheet('Cover'), member)
  fillQualifications(wb.getWorksheet('Qualifications'), member, data.qualCat, data.qualProg)
  fillJqs(wb.getWorksheet('JQS-CFETP'), data.jqsCat, data.jqsProg)
  fill1098(wb.getWorksheet('DAF Form 1098 2026'), currentYear, data.r1098Cat, data.r1098Prog)
  fill1098(wb.getWorksheet('DAF Form 1098 2025'), String(Number(currentYear) - 1), data.r1098Cat, data.r1098Prog)
  fill797(wb.getWorksheet('DAF Form 797'), data.items797)
  fill623a(wb.getWorksheet('623A'), data.e623a)
  fillRat(wb.getWorksheet('Ready Airman Training'), data.ratCat, data.ratProg)
  for (const [section, sheet] of Object.entries(SECTION_SHEET)) {
    fill803(wb.getWorksheet(sheet), data.items803.filter((r) => r.section === section))
  }

  const buf = await wb.xlsx.writeBuffer()
  const safe = (member.full_name || 'member').replace(/[^a-z0-9]+/gi, '_')
  downloadBuffer(buf as ArrayBuffer, `Training_Record_${safe}.xlsx`)
}
