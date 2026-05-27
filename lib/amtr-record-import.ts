// ─────────────────────────────────────────────────────────────
// AMTR — Import a member's record FROM the HAF training-record .xlsx.
//
// The reverse of lib/amtr-record-excel.ts: reads the same sheets/cells
// and writes into the AMTR tables so a unit's existing electronic record
// can be transcribed into Glidepath. Catalog-driven sheets (Qualifications,
// 1098, JQS, RAT) are matched to the base catalog by name/number; free-form
// sheets (623A, 797, 803) create rows. Imported initials are stored as
// transcribed text (NOT locked e-signatures).
//
// Client-side; ExcelJS is dynamically imported by the caller.
// ─────────────────────────────────────────────────────────────

import ExcelJS from 'exceljs'
import {
  fetchAmtrByBase, upsertAmtrRow, insertAmtrRows, updateAmtrMember, type AmtrMember,
} from '@/lib/supabase/amtr'
import { computeNextDue } from '@/lib/amtr/status'
import { parseAmtrDate } from '@/lib/amtr/excel-import'

type Row = Record<string, unknown>
type WS = ExcelJS.Worksheet

const txt = (cell: ExcelJS.Cell | undefined): string => {
  if (!cell) return ''
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string }
    if (o.richText) return o.richText.map((t) => t.text).join('')
    if (o.result != null) return String(o.result)
    if (o.text != null) return o.text
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return ''
  }
  return String(v)
}
const cell = (ws: WS, addr: string) => txt(ws.getCell(addr))
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const afterColon = (s: string) => { const i = s.indexOf(':'); return i >= 0 ? s.slice(i + 1).trim() : s.trim() }

// Sheet-name normalizer: lowercase, strip whitespace + non-alphanum so that
// "DAF Form 1098 2025", "Form 1098 (2025)", "1098-2025" all collapse to one
// key. Used by findSheet() to tolerate typos / variant spellings.
const normSheet = (s: string) => s.toLowerCase().replace(/[\s_().\-/&]+/g, '')

/** Locate a worksheet by canonical name + optional aliases. Returns the
 * matched worksheet and records its actual name in `seen` so the unmatched
 * report can ignore sheets we recognized via fuzzy match. */
function findSheet(wb: ExcelJS.Workbook, seen: Set<string>, canonical: string, ...aliases: string[]): WS | null {
  const targets = new Set([canonical, ...aliases].map(normSheet))
  for (const ws of wb.worksheets) {
    if (targets.has(normSheet(ws.name))) { seen.add(ws.name); return ws }
  }
  return null
}

export type ParsedRecord = {
  cover: { grade?: string; dafsc?: string; duty_position?: string; tsc?: string }
  qtp: { name: string; complete_date: string }[]
  quals: { name: string; attained: boolean }[]
  jqs: { number: string; start_date: string; complete_date: string; trainee: string; trainer: string; certifier: string }[]
  r1098: Record<string, { task: string; start_date: string; last_completed: string; certifier: string; trainee: string }[]>
  items797: { task: string; start_date: string; complete_date: string; trainee: string; trainer: string; certifier: string; milestone_window: string }[]
  e623a: { form_date: string; entry_type: string; trainee: string; trainer: string; namt: string; afm: string }[]
  rat: { course: string; completed: string }[]
  items803: Record<string, { sts_item: string; eval_date: string; in_ugt: string; results: string; evaluator: string }[]>
  /** Milestone sheets are catalog-only (no per-member completion data). We
   * record the topic count so the operator can see they weren't silently
   * dropped, but we don't write to `amtr_milestone_progress` — there's no
   * signoff data on these sheets to import. */
  milestoneTopics: Record<string, number>
  /** Sheets in the workbook that the parser didn't recognize at all. Surfaced
   * in the import summary so the operator sees data was potentially missed. */
  unmatchedSheets: string[]
}

const SECTION_SHEET: Record<string, string> = {
  apprenticeGrad: 'DAF Form 803 (Apprentice Grad)', amslAmos: 'DAF Form 803 (AMSL_AMOS)',
  fiveLevel: 'DAF Form 803 (5-Level)', sevenLevel: 'DAF Form 803 (7-Level)', afm: 'DAF Form 803 (AFM)',
}

const MILESTONE_SHEETS: { sheet: string; path: string }[] = [
  { sheet: '5-Level QTP Milestone',   path: 'fiveLevelQtp'  },
  { sheet: 'AMOS_AMSL PCG Milestone', path: 'amosAmslPcg'   },
  { sheet: '7-Level QTP Milestone',   path: 'sevenLevelQtp' },
  { sheet: 'AFM PCG Milestone',       path: 'afmPcg'        },
]

// Sheets that are intentionally not imported (informational reference / blank).
// Listed here so they don't show up in the "unmatched sheets" warning.
const IGNORED_SHEETS = new Set(['proficiencycodekey', 'sheet18'])

/** Split a 623A "INIT — comment" cell into initials + comment. */
function splitInit(s: string): { init: string; comment: string } {
  const m = s.split(/\s+[—–-]\s+/)
  if (m.length >= 2) return { init: m[0].trim(), comment: m.slice(1).join(' — ').trim() }
  // No separator: short tokens are initials, longer text is a comment.
  return s.trim().length <= 4 ? { init: s.trim(), comment: '' } : { init: '', comment: s.trim() }
}

export async function parseAmtrRecordWorkbook(buf: ArrayBuffer): Promise<ParsedRecord> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const out: ParsedRecord = {
    cover: {}, qtp: [], quals: [], jqs: [], r1098: {}, items797: [], e623a: [], rat: [], items803: {},
    milestoneTopics: {}, unmatchedSheets: [],
  }
  // Track every sheet the parser recognized (via canonical match or fuzzy
  // alias). After parsing, any worksheet name NOT in this set (and not on
  // the IGNORED_SHEETS list) is reported back as unmatched.
  const seen = new Set<string>()
  const get = (canonical: string, ...aliases: string[]) => findSheet(wb, seen, canonical, ...aliases)

  // "Cover" is identity-only; mark seen so it doesn't show in unmatched.
  findSheet(wb, seen, 'Cover')

  // Qualifications — identity + QTP (date) + skill/SEI (Yes/No)
  const q = get('Qualifications')
  if (q) {
    out.cover.dafsc = afterColon(cell(q, 'B4')) || undefined
    out.cover.grade = afterColon(cell(q, 'B3')) || undefined
    out.cover.duty_position = afterColon(cell(q, 'A4')) || undefined
    out.cover.tsc = afterColon(cell(q, 'A5')) || undefined
    for (let r = 7; r <= 40; r++) {
      const name = cell(q, `A${r}`); const b = cell(q, `B${r}`)
      if (!name || /^\(yes\/no\)/i.test(b) || /training status code/i.test(name)) continue
      if (/^(yes|no)$/i.test(b)) out.quals.push({ name, attained: /^yes$/i.test(b) })
      else { const d = parseAmtrDate(b); if (d || /pcg|qtp|qualif/i.test(name)) out.qtp.push({ name, complete_date: d }) }
    }
  }

  // JQS-CFETP — item rows keyed by leading number. Section/heading rows are
  // merged across the row, so skip them (their merged title bleeds into the
  // initials columns otherwise).
  const j = get('JQS-CFETP')
  if (j) {
    const colNum = (s: string) => s.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)
    const sectionRows = new Set<number>()
    for (const rng of ((j.model.merges as string[]) ?? [])) {
      const mm = String(rng).match(/^A(\d+):([A-Z]+)(\d+)$/)
      if (mm && mm[1] === mm[3] && colNum(mm[2]) >= 3) sectionRows.add(Number(mm[1]))
    }
    for (let r = 7; r <= j.rowCount; r++) {
      if (sectionRows.has(r)) continue
      const a = cell(j, `A${r}`); const m = a.match(/^\s*(\d+(?:\.\d+)*)/)
      if (!m) continue
      const start = parseAmtrDate(cell(j, `D${r}`)), comp = parseAmtrDate(cell(j, `E${r}`))
      let tr = cell(j, `F${r}`), trn = cell(j, `G${r}`), cert = cell(j, `H${r}`)
      // Guard against merged-title bleed: a "value" equal to the row title isn't an initial.
      if (tr === a) tr = ''; if (trn === a) trn = ''; if (cert === a) cert = ''
      if (start || comp || tr || trn || cert) out.jqs.push({ number: m[1].replace(/\.$/, ''), start_date: start, complete_date: comp, trainee: tr, trainer: trn, certifier: cert })
    }
  }

  // DAF 1098 — scan every worksheet for "1098" in the name. A 4-digit
  // year anywhere in the sheet name is taken as the year_label;
  // otherwise the sheet is treated as the current year. Tolerates
  // variants: "DAF Form 1098 2024", "Form 1098 (2024)", "1098-2027",
  // and the bare "DAF Form 1098" the AFFSA template uses for the
  // current year.
  const currentYearStr = String(new Date().getUTCFullYear())
  for (const ws of wb.worksheets) {
    if (!/1098/i.test(ws.name)) continue
    const m = ws.name.match(/1098[\s_().\-/]*(\d{4})/i)
    const year = m ? m[1] : currentYearStr
    seen.add(ws.name)
    const rows: ParsedRecord['r1098'][string] = []
    for (let r = 4; r <= ws.rowCount; r++) {
      const task = cell(ws, `A${r}`); if (!task) continue
      rows.push({ task, start_date: parseAmtrDate(cell(ws, `B${r}`)), last_completed: parseAmtrDate(cell(ws, `C${r}`)), certifier: cell(ws, `D${r}`), trainee: cell(ws, `E${r}`) })
    }
    if (rows.length) {
      // If multiple sheets map to the same year (e.g. both "DAF Form
      // 1098" and "DAF Form 1098 2026" exist), merge the rows rather
      // than overwriting — the parser doesn't dedupe by task, the
      // catalog-match step skips duplicates.
      const existing = out.r1098[year] ?? []
      out.r1098[year] = [...existing, ...rows]
    }
  }

  // DAF 797
  const f797 = get('DAF Form 797')
  if (f797) for (let r = 4; r <= f797.rowCount; r++) {
    const task = cell(f797, `A${r}`); if (!task) continue
    out.items797.push({ task, start_date: parseAmtrDate(cell(f797, `B${r}`)), complete_date: parseAmtrDate(cell(f797, `C${r}`)), trainee: cell(f797, `D${r}`), trainer: cell(f797, `E${r}`), certifier: cell(f797, `F${r}`), milestone_window: cell(f797, `G${r}`) })
  }

  // 623A — canonical AFFSA template name is "DAF Form 623A"; tolerate
  // the older bare "623A" sheet name too.
  const f623 = get('DAF Form 623A', '623A')
  if (f623) for (let r = 2; r <= f623.rowCount; r++) {
    const type = cell(f623, `B${r}`); const date = cell(f623, `A${r}`)
    if (!type && !date) continue
    out.e623a.push({ form_date: parseAmtrDate(date), entry_type: type, trainee: cell(f623, `C${r}`), trainer: cell(f623, `D${r}`), namt: cell(f623, `E${r}`), afm: cell(f623, `F${r}`) })
  }

  // RAT
  const rat = get('Ready Airman Training')
  if (rat) for (let r = 3; r <= rat.rowCount; r++) {
    const course = cell(rat, `A${r}`); if (!course) continue
    out.rat.push({ course, completed: parseAmtrDate(cell(rat, `C${r}`)) })
  }

  // 803 (five sections)
  for (const [section, sheet] of Object.entries(SECTION_SHEET)) {
    const ws = get(sheet); if (!ws) continue
    let header = 0
    for (let r = 1; r <= 8; r++) if (/JQS Task Item/i.test(cell(ws, `A${r}`))) { header = r; break }
    const rows: ParsedRecord['items803'][string] = []
    for (let r = (header || 3) + 1; r <= ws.rowCount; r++) {
      const item = cell(ws, `A${r}`)
      const date = parseAmtrDate(cell(ws, `K${r}`)), ugt = cell(ws, `L${r}`), res = cell(ws, `M${r}`), ev = cell(ws, `N${r}`)
      if (!item && !date && !res && !ev) continue
      if (/^remarks$/i.test(item)) continue
      rows.push({ sts_item: item, eval_date: date, in_ugt: ugt, results: res, evaluator: ev })
    }
    if (rows.length) out.items803[section] = rows
  }

  // Milestone sheets — count topics so the operator can confirm the parser
  // saw them. Per-member completion data isn't on these sheets (catalog only),
  // so we don't write to amtr_milestone_progress here.
  for (const { sheet, path } of MILESTONE_SHEETS) {
    const ws = get(sheet); if (!ws) continue
    let count = 0
    for (let r = 2; r <= ws.rowCount; r++) {
      const title = cell(ws, `A${r}`); if (title) count++
    }
    if (count > 0) out.milestoneTopics[path] = count
  }

  // Sheets that the parser didn't recognize at all — surface in summary so
  // the operator sees what was silently dropped (rather than the prior
  // behavior of just ignoring unknown names).
  for (const ws of wb.worksheets) {
    if (seen.has(ws.name)) continue
    if (IGNORED_SHEETS.has(normSheet(ws.name))) continue
    out.unmatchedSheets.push(ws.name)
  }

  return out
}

export type ImportSummary = {
  counts: Record<string, number>
  unmatched: string[]
  /** Topics on milestone sheets — informational only (no per-member data). */
  milestoneTopics: Record<string, number>
  /** Sheets in the workbook that the parser didn't recognize. */
  unmatchedSheets: string[]
}

export function summarizeParsed(p: ParsedRecord): ImportSummary {
  const counts: Record<string, number> = {
    Qualifications: p.qtp.length + p.quals.length,
    'JQS-CFETP': p.jqs.length,
    'DAF 1098': Object.values(p.r1098).reduce((n, a) => n + a.length, 0),
    'DAF 797': p.items797.length,
    '623A': p.e623a.length,
    'Ready Airman Training': p.rat.length,
    'DAF 803': Object.values(p.items803).reduce((n, a) => n + a.length, 0),
  }
  return { counts, unmatched: [], milestoneTopics: p.milestoneTopics, unmatchedSheets: p.unmatchedSheets }
}

/** Write a parsed record into the AMTR tables for a member. Catalog-matched
 * rows update progress; free-form rows are inserted. Returns what was written
 * and any catalog rows that couldn't be matched. Errors are accumulated per
 * section (not thrown) so a partial import surfaces in the summary toast
 * rather than silently swallowing 100 failed inserts. */
export async function applyAmtrImport(
  installationId: string, member: AmtrMember, p: ParsedRecord,
): Promise<{ written: number; unmatched: string[]; errors: string[] }> {
  const unmatched: string[] = []
  const errors: string[] = []
  let written = 0
  const memberId = member.id
  const onErr = (label: string, err: string | null) => { if (err) errors.push(`[${label}] ${err}`) }

  // Cover identity (only fill blanks / update from the sheet).
  const coverPatch: Partial<AmtrMember> = {}
  if (p.cover.grade) coverPatch.grade = p.cover.grade
  if (p.cover.dafsc) coverPatch.dafsc = p.cover.dafsc
  if (p.cover.duty_position) coverPatch.duty_position = p.cover.duty_position
  if (p.cover.tsc) coverPatch.tsc = p.cover.tsc
  if (Object.keys(coverPatch).length) { await updateAmtrMember(memberId, coverPatch); written++ }

  // Catalogs for matching.
  const [qualCat, jqsCat, c1098, ratCat] = await Promise.all([
    fetchAmtrByBase<Row>('amtr_qual_catalog', installationId),
    fetchAmtrByBase<Row>('amtr_jqs_catalog', installationId),
    fetchAmtrByBase<Row>('amtr_1098_catalog', installationId),
    fetchAmtrByBase<Row>('amtr_rat_catalog', installationId),
  ])
  const byName = (cat: Row[], field: string) => { const m = new Map<string, Row>(); for (const c of cat) m.set(norm(String(c[field] ?? '')), c); return m }
  const qualByName = byName(qualCat, 'name')
  const ratByName = byName(ratCat, 'course')
  const jqsByNum = new Map<string, Row>()
  for (const c of jqsCat) { if (c.kind === 'section') continue; const n = String(c.number ?? '').replace(/[.\s]+$/, '').trim(); if (n) jqsByNum.set(n, c) }
  // 1098 catalog is per-year now. Build a {year_label → {normTask → row}}
  // index and a helper that clones the most-recent year's catalog into a
  // missing target year on first reference.
  let c1098Mut = [...c1098]
  const c1098ByYearTask = (): Map<string, Map<string, Row>> => {
    const m = new Map<string, Map<string, Row>>()
    for (const c of c1098Mut) {
      const yr = String(c.year_label ?? '')
      if (!yr) continue
      if (!m.has(yr)) m.set(yr, new Map())
      m.get(yr)!.set(norm(String(c.task ?? '')), c)
    }
    return m
  }
  const ensure1098YearCatalog = async (targetYear: string): Promise<void> => {
    const index = c1098ByYearTask()
    if (index.has(targetYear) && index.get(targetYear)!.size > 0) return
    // Pick the most-recent populated year as the source. If no year has
    // any rows, the catalog itself is empty and there's nothing to clone.
    const populatedYears = Array.from(index.keys()).sort().reverse()
    const sourceYear = populatedYears[0]
    if (!sourceYear) return
    const sourceRows = c1098Mut.filter((c) => String(c.year_label) === sourceYear)
    const clones = sourceRows.map((c) => ({
      base_id: installationId,
      year_label: targetYear,
      task: c.task,
      type: c.type ?? null,
      frequency: c.frequency ?? 'Annual',
      sort_order: c.sort_order ?? 0,
    }))
    const { error } = await insertAmtrRows('amtr_1098_catalog', clones)
    if (error) onErr(`1098 catalog clone -> ${targetYear}`, error)
    // Refresh the in-memory catalog list with the new rows. We refetch
    // from the DB to get the generated UUIDs.
    c1098Mut = await fetchAmtrByBase<Row>('amtr_1098_catalog', installationId)
  }

  // Qualifications — QTP (complete date) and skill/SEI (attained).
  for (const item of p.qtp) {
    const c = qualByName.get(norm(item.name))
    if (!c) { unmatched.push(`Qual: ${item.name}`); continue }
    const { error } = await upsertAmtrRow(
      'amtr_qual_progress',
      { base_id: installationId, member_id: memberId, catalog_id: c.id, complete_date: item.complete_date || null, attained: !!item.complete_date },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) onErr(`Qual ${item.name}`, error); else written++
  }
  for (const item of p.quals) {
    const c = qualByName.get(norm(item.name))
    if (!c) { unmatched.push(`Qual: ${item.name}`); continue }
    const { error } = await upsertAmtrRow(
      'amtr_qual_progress',
      { base_id: installationId, member_id: memberId, catalog_id: c.id, attained: item.attained },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) onErr(`Qual ${item.name}`, error); else written++
  }

  // 1098 by year. Catalog is per-year — make sure each year referenced in
  // the workbook has its own catalog rows (clone from the most-recent
  // populated year if missing) before matching.
  for (const [year, rows] of Object.entries(p.r1098)) {
    await ensure1098YearCatalog(year)
    const yearIndex = c1098ByYearTask().get(year) ?? new Map<string, Row>()
    for (const row of rows) {
      const c = yearIndex.get(norm(row.task))
      if (!c) { unmatched.push(`1098 ${year}: ${row.task}`); continue }
      const next = computeNextDue(row.last_completed, String(c.frequency ?? 'Annual'))
      const { error } = await upsertAmtrRow(
        'amtr_1098_progress',
        { base_id: installationId, member_id: memberId, catalog_id: c.id, year_label: year, start_date: row.start_date || null, last_completed: row.last_completed || null, next_due: next, certifier_initials: row.certifier || null, trainee_initials: row.trainee || null },
        { onConflict: 'member_id,catalog_id,year_label' },
      )
      if (error) onErr(`1098 ${year} ${row.task}`, error); else written++
    }
  }

  // JQS by number.
  for (const row of p.jqs) {
    const c = jqsByNum.get(row.number)
    if (!c) { unmatched.push(`JQS ${row.number}`); continue }
    const { error } = await upsertAmtrRow(
      'amtr_jqs_progress',
      { base_id: installationId, member_id: memberId, catalog_id: c.id, start_date: row.start_date || null, complete_date: row.complete_date || null, trainee_initials: row.trainee || null, trainer_initials: row.trainer || null, certifier_initials: row.certifier || null },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) onErr(`JQS ${row.number}`, error); else written++
  }

  // RAT by course.
  for (const row of p.rat) {
    const c = ratByName.get(norm(row.course))
    if (!c) { unmatched.push(`RAT: ${row.course}`); continue }
    const { error } = await upsertAmtrRow(
      'amtr_rat_progress',
      { base_id: installationId, member_id: memberId, catalog_id: c.id, completed: row.completed || null },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) onErr(`RAT ${row.course}`, error); else written++
  }

  // Free-form inserts (797, 623A, 803). Now uses { inserted, error } return.
  if (p.items797.length) {
    const { inserted, error } = await insertAmtrRows('amtr_797', p.items797.map((it, i) => ({ base_id: installationId, member_id: memberId, task: it.task, start_date: it.start_date || null, complete_date: it.complete_date || null, trainee_initials: it.trainee || null, trainer_initials: it.trainer || null, certifier_initials: it.certifier || null, milestone_window: it.milestone_window || null, requires_certifier: !!it.certifier, sort_order: i })))
    written += inserted
    onErr(`797 (${p.items797.length} rows)`, error)
  }
  if (p.e623a.length) {
    const { inserted, error } = await insertAmtrRows('amtr_623a', p.e623a.map((e) => {
      const c = splitInit(e.trainee), d = splitInit(e.trainer), n = splitInit(e.namt), a = splitInit(e.afm)
      return { base_id: installationId, member_id: memberId, form_date: e.form_date || null, entry_type: e.entry_type || null, trainee_initials: c.init || null, trainee_comment: c.comment || null, trainer_initials: d.init || null, trainer_comment: d.comment || null, namt_initials: n.init || null, namt_comment: n.comment || null, afm_initials: a.init || null, afm_comment: a.comment || null }
    }))
    written += inserted
    onErr(`623A (${p.e623a.length} rows)`, error)
  }
  for (const [section, rows] of Object.entries(p.items803)) {
    const { inserted, error } = await insertAmtrRows('amtr_803', rows.map((it, i) => ({ base_id: installationId, member_id: memberId, section, sts_item: it.sts_item || null, eval_date: it.eval_date || null, in_ugt: it.in_ugt || null, results: it.results || null, evaluator_initials: it.evaluator || null, sort_order: i })))
    written += inserted
    onErr(`803 ${section} (${rows.length} rows)`, error)
  }

  return { written, unmatched, errors }
}
