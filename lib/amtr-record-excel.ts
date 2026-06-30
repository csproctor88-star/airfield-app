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

// Deep-copy a cell's style so an appended/cloned row keeps the template's
// borders, alignment and fonts (assigning the live object would share refs).
function cloneStyle(s: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(s || {})) as Partial<ExcelJS.Style>
}
const colRow = (a: string) => { const m = /^([A-Z]+)(\d+)$/.exec(a)!; return { col: m[1], row: Number(m[2]) } }
type Merge = { a: { col: string; row: number }; b: { col: string; row: number } }
const parseMerge = (s: string): Merge => { const [a, b] = s.split(':'); return { a: colRow(a), b: colRow(b) } }

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
  const [jqsCat, jqsProg, qualCat, qualProg, items797, items803, r1098Cat, r1098Prog, ratCat, ratProg, e623a, sections803] = await Promise.all([
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
    fetchAmtrByBase<Row>('amtr_803_sections', installationId),
  ])
  return { jqsCat, jqsProg, qualCat, qualProg, items797, items803, r1098Cat, r1098Prog, ratCat, ratProg, e623a, sections803 }
}

// ── Generic flat-table writer ──────────────────────────────
// Clears the value columns over the data region, then writes `rows`
// (each an array of [colLetter, value] pairs), appending rows (with the
// first data row's style) when there are more rows than blanks.
function writeFlatTable(ws: WS, startRow: number, cols: string[], rows: [string, unknown][][]) {
  // Clear range covers (a) the existing sheet's rowCount so the template's
  // baked-in example data (the 623A sheet ships with ~106 illustrative rows)
  // gets wiped even when the member has fewer entries, AND (b) a 60-row pad
  // past the new data so growth headroom is clean.
  const origRowCount = ws.rowCount
  const clearTo = Math.max(startRow + rows.length, startRow + 60, origRowCount)
  for (let r = startRow; r <= clearTo; r++) for (const c of cols) set(ws, `${c}${r}`, null)
  // Style source for appended rows: the second template data row (the first
  // can carry a special top border); fall back to the first. Appended rows
  // beyond the template's pre-formatted region copy this style so every entry
  // keeps the table's borders instead of spilling outside it.
  const styleRow = Math.min(startRow + 1, origRowCount)
  const tplHeight = ws.getRow(styleRow).height
  const tplStyles = cols.map((c) => cloneStyle(ws.getCell(`${c}${styleRow}`).style))
  rows.forEach((cells, i) => {
    const rn = startRow + i
    if (rn > origRowCount) {
      if (tplHeight) ws.getRow(rn).height = tplHeight
      cols.forEach((c, ci) => { ws.getCell(`${c}${rn}`).style = tplStyles[ci] })
    }
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
  // Override column E's header at runtime to reflect that the NAMT
  // column also holds certifier sign-offs from the auto-623A flow.
  // Editing the source template binary used to corrupt drawing anchors;
  // this approach keeps the template untouched.
  set(ws, 'E1', 'NAMT / Certifier Initials/Comments')
  // Defensive sort by form_date ascending — the upstream fetch already
  // orders by form_date, but a mixed type pool (DATE vs TEXT, NULLs)
  // could disrupt it. Sorting here on the parsed slice guarantees
  // chronological output regardless of upstream behavior.
  const sorted = [...entries].sort((a, b) => {
    const ad = dt(a.form_date), bd = dt(b.form_date)
    if (!ad && !bd) return 0
    if (!ad) return 1  // null dates fall to the bottom
    if (!bd) return -1
    return ad.localeCompare(bd)
  })
  // Format: "<comment> / <INITIALS>" — comment leads so the export
  // reads as the narrative first, signature second. Falls back to
  // either piece alone when the other is missing.
  const fmt = (initials: unknown, comment: unknown): string => {
    const i = str(initials).trim()
    const c = str(comment).trim()
    if (i && c) return `${c} / ${i}`
    return c || i
  }
  const rows = sorted.map((e) => ([
    ['A', dt(e.form_date)], ['B', str(e.entry_type)],
    ['C', fmt(e.trainee_initials, e.trainee_comment)],
    ['D', fmt(e.trainer_initials, e.trainer_comment)],
    ['E', fmt(e.namt_initials, e.namt_comment)],
    ['F', fmt(e.afm_initials, e.afm_comment)],
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

// DAF 803 sheets are NOT a flat table — each evaluation is a fixed multi-row
// BLOCK: a "JQS Task Item(s) Evaluated" header row, the STS item merged across
// the next rows (with Date / UGT / Results / Evaluator merged alongside in
// cols K-N), a merged "Remarks" label row, then a merged remarks area. Blocks
// repeat on a fixed stride (typically 10 rows). We write one evaluation into
// each block's data row, clear the template's sample evals, and clone a fresh
// block (styles + merges) for any evaluation beyond the template's blocks.

const LABEL_RE = /JQS Task Item|^Date$|In UGT|Results|Evaluator|Remarks/i
function clone803Block(ws: WS, srcStart: number, height: number, relMerges: Merge[], dstStart: number) {
  for (let k = 0; k < height; k++) {
    const sr = ws.getRow(srcStart + k), dr = ws.getRow(dstStart + k)
    if (sr.height) dr.height = sr.height
    for (let cn = 1; cn <= 14; cn++) {
      const sc = sr.getCell(cn), dc = dr.getCell(cn)
      dc.style = cloneStyle(sc.style)
      const v = sc.value
      dc.value = (typeof v === 'string' && LABEL_RE.test(v)) ? v : null // keep static labels, drop sample data
    }
  }
  for (const m of relMerges) ws.mergeCells(`${m.a.col}${dstStart + m.a.row}:${m.b.col}${dstStart + m.b.row}`)
}

function fill803(ws: WS | undefined, items: Row[]) {
  if (!ws) return
  // Block header rows = those whose col A starts with "JQS Task Item".
  const headers: number[] = []
  for (let r = 1; r <= ws.rowCount; r++) if (/JQS Task Item/i.test(str(ws.getCell(`A${r}`).value))) headers.push(r)
  if (!headers.length) return
  const height = headers.length > 1 ? headers[1] - headers[0] : 10
  const srcStart = headers[0], srcEnd = srcStart + height - 1
  // First block's merges, captured relative to its start, for cloning overflow blocks.
  const relMerges: Merge[] = (ws.model.merges || []).map(parseMerge)
    .filter((m) => m.a.row >= srcStart && m.b.row <= srcEnd)
    .map((m) => ({ a: { col: m.a.col, row: m.a.row - srcStart }, b: { col: m.b.col, row: m.b.row - srcStart } }))
  // Clear the template's sample evaluation + remarks from every existing block.
  for (const h of headers) {
    for (const c of ['A', 'K', 'L', 'M', 'N']) set(ws, `${c}${h + 1}`, null)
    for (let r = h + 1; r < h + height; r++) { if (/^Remarks$/i.test(str(ws.getCell(`A${r}`).value))) { set(ws, `A${r + 1}`, null); break } }
  }
  // One evaluation per block; clone new blocks once the template's run out.
  items.forEach((it, i) => {
    let base: number
    if (i < headers.length) base = headers[i]
    else { base = headers[headers.length - 1] + height * (i - headers.length + 1); clone803Block(ws, srcStart, height, relMerges, base) }
    set(ws, `A${base + 1}`, str(it.sts_item))
    set(ws, `K${base + 1}`, dt(it.eval_date))
    set(ws, `L${base + 1}`, str(it.in_ugt))
    set(ws, `M${base + 1}`, str(it.results))
    set(ws, `N${base + 1}`, str(it.evaluator_initials))
  })
}

const SECTION_SHEET: Record<string, string> = {
  apprenticeGrad: 'DAF Form 803 (Apprentice Grad)', amslAmos: 'DAF Form 803 (AMSL_AMOS)',
  fiveLevel: 'DAF Form 803 (5-Level)', sevenLevel: 'DAF Form 803 (7-Level)', afm: 'DAF Form 803 (AFM)',
}

// Deep-copy a built-in 803 sheet's skeleton (column widths, row heights, cell
// values + styles, merges) into a brand-new sheet, so a manager-added custom
// section gets its own 803-format tab. Clone from a *pristine* built-in sheet
// (before the built-in fill loop runs); fill803 then clears the sample block and
// writes the custom section's evaluations. Drawings/images aren't copied (the
// 803 form sheets carry none).
function clone803Sheet(wb: ExcelJS.Workbook, src: WS, dstName: string): WS {
  const dst = wb.addWorksheet(dstName)
  for (let i = 1; i <= 14; i++) { const w = src.getColumn(i).width; if (w) dst.getColumn(i).width = w }
  src.eachRow({ includeEmpty: true }, (row, rn) => {
    const dr = dst.getRow(rn)
    if (row.height) dr.height = row.height
    row.eachCell({ includeEmpty: true }, (cell, cn) => {
      const dc = dr.getCell(cn)
      dc.value = cell.value as ExcelJS.CellValue
      dc.style = cloneStyle(cell.style)
    })
  })
  for (const m of (src.model.merges || [])) dst.mergeCells(m)
  return dst
}

// Slot the cloned custom-section 803 sheets directly after the built-in
// "DAF Form 803 (AFM)" tab instead of at the end of the workbook. ExcelJS's
// addWorksheet always appends (it assigns the next-highest orderNo), and the
// template keeps ~11 sheets after AFM (Milestones, 623A, 1098s…), so a custom
// section like CBRN would otherwise land dead last. Tab order is driven purely
// by each worksheet's orderNo (Workbook.worksheets sorts on it), so we rebuild
// the order: keep every existing sheet's relative order, insert the custom
// sheets immediately after AFM, then renumber. No-op if AFM is absent.
function placeCustom803SheetsAfterAfm(wb: ExcelJS.Workbook, customSheets: WS[]): void {
  if (!customSheets.length) return
  const customSet = new Set<WS>(customSheets)
  const ordered = wb.worksheets.filter((w) => !customSet.has(w))
  const afmIdx = ordered.findIndex((w) => w.name === SECTION_SHEET.afm)
  if (afmIdx < 0) return
  ordered.splice(afmIdx + 1, 0, ...customSheets)
  // `orderNo` exists at runtime (Workbook.worksheets sorts on it) but isn't in
  // ExcelJS's published types, hence the cast.
  ordered.forEach((w, i) => { (w as WS & { orderNo: number }).orderNo = i })
}

/** Build a unique, Excel-legal sheet name for a custom 803 section. */
function customSheetName(label: string, used: Set<string>): string {
  const safe = String(label || 'Custom').replace(/[[\]:*?/\\]/g, '').trim() || 'Custom'
  let name = `DAF Form 803 (${safe})`.slice(0, 31)
  let n = 2
  while (used.has(name)) name = `${name.slice(0, 28)} ${n++}`.slice(0, 31)
  used.add(name)
  return name
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

  // Rename the bare "623A" sheet to the canonical "DAF Form 623A" at
  // runtime so the exported workbook matches the AFFSA naming. We do
  // this through ExcelJS (not openpyxl on the binary template) because
  // a prior attempt to rename the sheet inside the template file with
  // openpyxl corrupted drawing anchors and broke export entirely.
  const ws623a = wb.getWorksheet('DAF Form 623A') ?? wb.getWorksheet('623A')
  if (ws623a && ws623a.name !== 'DAF Form 623A') ws623a.name = 'DAF Form 623A'

  fillCover(wb.getWorksheet('Cover'), member)
  fillQualifications(wb.getWorksheet('Qualifications'), member, data.qualCat, data.qualProg)
  fillJqs(wb.getWorksheet('JQS-CFETP'), data.jqsCat, data.jqsProg)
  fill1098(wb.getWorksheet('DAF Form 1098 2026'), currentYear, data.r1098Cat, data.r1098Prog)
  fill1098(wb.getWorksheet('DAF Form 1098 2025'), String(Number(currentYear) - 1), data.r1098Cat, data.r1098Prog)
  fill797(wb.getWorksheet('DAF Form 797'), data.items797)
  fill623a(ws623a, data.e623a)
  fillRat(wb.getWorksheet('Ready Airman Training'), data.ratCat, data.ratProg)
  // Custom (manager-added) 803 sections get their own cloned 803 sheet. Clone
  // from a pristine built-in sheet BEFORE the built-in fill loop, so each clone
  // starts from a single sample block.
  const builtinKeys = new Set(Object.keys(SECTION_SHEET))
  const customSecs = data.sections803.filter((s) => s.builtin !== true && !builtinKeys.has(String(s.section_key)))
  const customSheets: { key: string; ws: WS }[] = []
  if (customSecs.length) {
    const srcSheet = Object.values(SECTION_SHEET).map((n) => wb.getWorksheet(n)).find(Boolean)
    if (srcSheet) {
      const used = new Set(wb.worksheets.map((w) => w.name))
      for (const sec of customSecs) {
        const name = customSheetName(String(sec.label ?? sec.section_key), used)
        customSheets.push({ key: String(sec.section_key), ws: clone803Sheet(wb, srcSheet, name) })
      }
    }
  }
  // Built-in 803 sections → their template sheets.
  for (const [section, sheet] of Object.entries(SECTION_SHEET)) {
    fill803(wb.getWorksheet(sheet), data.items803.filter((r) => r.section === section))
  }
  // Custom 803 sections → their cloned sheets.
  for (const { key, ws } of customSheets) {
    fill803(ws, data.items803.filter((r) => String(r.section) === key))
  }
  // Place the cloned custom 803 tabs directly after the built-in AFM 803 tab.
  placeCustom803SheetsAfterAfm(wb, customSheets.map((c) => c.ws))

  const buf = await wb.xlsx.writeBuffer()
  const safe = (member.full_name || 'member').replace(/[^a-z0-9]+/gi, '_')
  downloadBuffer(buf as ArrayBuffer, `Training_Record_${safe}.xlsx`)
}
