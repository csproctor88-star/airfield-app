// ─────────────────────────────────────────────────────────────
// AMTR — extract the STANDARD CATALOG content from a HAF training-record
// workbook so a base admin / NAMT can update to a new HAF version in-app
// (no deploy). Produces SyncCfg[] for the catalogs the workbook defines;
// those feed runSyncCatalogs() — the same no-wipe merge as the bundled
// sync. Catalogs not present in the workbook (formal, 623A types,
// inspection checklist) are left to the bundled standard.
//
// Client-side; ExcelJS is dynamically imported by the caller.
// ─────────────────────────────────────────────────────────────

import ExcelJS from 'exceljs'
import { buildSyncCfg, type SyncCfg, type SyncRow } from '@/lib/amtr/seed-data'

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
const c = (ws: WS, addr: string) => txt(ws.getCell(addr)).replace(/\s+/g, ' ').trim()
const colNum = (s: string) => s.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0)
const segs = (num: string) => num.split('.').filter(Boolean).length

const SECTION_SHEET: Record<string, string> = {
  apprenticeGrad: 'DAF Form 803 (Apprentice Grad)', amslAmos: 'DAF Form 803 (AMSL_AMOS)',
  fiveLevel: 'DAF Form 803 (5-Level)', sevenLevel: 'DAF Form 803 (7-Level)', afm: 'DAF Form 803 (AFM)',
}
const MILESTONE_SHEET: Record<string, string> = {
  fiveLevelQtp: '5-Level QTP Milestone', amosAmslPcg: 'AMOS_AMSL PCG Milestone',
  sevenLevelQtp: '7-Level QTP Milestone', afmPcg: 'AFM PCG Milestone',
}

export async function parseStandardCatalogsWorkbook(buf: ArrayBuffer): Promise<{ cfgs: SyncCfg[]; summary: Record<string, number> }> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf)
  const get = (n: string) => wb.getWorksheet(n)
  const rowsByTable: Record<string, SyncRow[]> = {}

  // JQS-CFETP — sections (merged rows) + items with core/dep/prof columns.
  const j = get('JQS-CFETP')
  if (j) {
    const sectionRows = new Set<number>()
    for (const rng of ((j.model.merges as string[]) ?? [])) {
      const mm = String(rng).match(/^A(\d+):([A-Z]+)(\d+)$/)
      if (mm && mm[1] === mm[3] && colNum(mm[2]) >= 3) sectionRows.add(Number(mm[1]))
    }
    const out: SyncRow[] = []
    for (let r = 7; r <= j.rowCount; r++) {
      const a = c(j, `A${r}`); if (!a) continue
      const m = a.match(/^(\d+(?:\.\d+)*)/)
      const isSection = sectionRows.has(r)
      if (!isSection && !m) continue
      const number = m ? m[1] : null
      if (isSection) {
        out.push({ kind: 'section', number, title: a, depth: number ? Math.max(0, segs(number) - 1) : 0, required: false, training_refs: null, core_cert: null, deploy_sei: null, prof3: null, prof5: null, prof7: null, prof9: null, sort_order: out.length })
      } else {
        const title = a.replace(/^\s*[\d.]+\s*/, '')
        out.push({ kind: 'item', number, title, depth: number ? Math.max(1, segs(number) - 1) : 1, required: false, training_refs: null, core_cert: c(j, `B${r}`) || null, deploy_sei: c(j, `C${r}`) || null, prof3: c(j, `I${r}`) || null, prof5: c(j, `J${r}`) || null, prof7: c(j, `K${r}`) || null, prof9: c(j, `L${r}`) || null, sort_order: out.length })
      }
    }
    if (out.length) rowsByTable.amtr_jqs_catalog = out
  }

  // DAF 1098 — task list + type/frequency/score (current-year sheet preferred).
  const f1098 = get('DAF Form 1098 2026') ?? get('DAF Form 1098 2025')
  if (f1098) {
    const out: SyncRow[] = []
    for (let r = 4; r <= f1098.rowCount; r++) {
      const task = c(f1098, `A${r}`); if (!task) continue
      out.push({ task, type: c(f1098, `G${r}`) || null, frequency: c(f1098, `H${r}`) || 'Annual', score_or_hours: c(f1098, `F${r}`) || null, sort_order: out.length })
    }
    if (out.length) rowsByTable.amtr_1098_catalog = out
  }

  // DAF 803 — standard STS items per section.
  {
    const out: SyncRow[] = []
    for (const [section, sheet] of Object.entries(SECTION_SHEET)) {
      const ws = get(sheet); if (!ws) continue
      let header = 0
      for (let r = 1; r <= 8; r++) if (/JQS Task Item/i.test(c(ws, `A${r}`))) { header = r; break }
      for (let r = (header || 3) + 1; r <= ws.rowCount; r++) {
        const item = c(ws, `A${r}`)
        if (!item || /^remarks$/i.test(item) || !/^\d/.test(item)) continue
        out.push({ section, sts_item: item, sort_order: out.length })
      }
    }
    if (out.length) rowsByTable.amtr_803_catalog = out
  }

  // Qualifications — QTP block (complete-date side) then skill levels / SEIs.
  const q = get('Qualifications')
  if (q) {
    const out: SyncRow[] = []
    let inYesNo = false
    for (let r = 7; r <= 30; r++) {
      const name = c(q, `A${r}`); const b = c(q, `B${r}`)
      if (/yes\/no/i.test(b) || /yes\/no/i.test(name)) { inYesNo = true; continue }
      if (/training status code/i.test(name)) break
      if (!name) continue
      const category = inYesNo ? (/sei/i.test(name) ? 'sei' : 'skill_level') : 'qtp'
      out.push({ category, name, sort_order: out.length })
    }
    if (out.length) rowsByTable.amtr_qual_catalog = out
  }

  // Ready Airman Training — course list.
  const rat = get('Ready Airman Training')
  if (rat) {
    const out: SyncRow[] = []
    for (let r = 3; r <= rat.rowCount; r++) {
      const course = c(rat, `A${r}`); if (!course) continue
      out.push({ course, category: null, method: null, frequency: 'Annual', sort_order: out.length })
    }
    if (out.length) rowsByTable.amtr_rat_catalog = out
  }

  // QTP / PCG Milestones — topic (+ STS items on the QTP sheets) per path.
  {
    const out: SyncRow[] = []
    for (const [path, sheet] of Object.entries(MILESTONE_SHEET)) {
      const ws = get(sheet); if (!ws) continue
      const hasSts = /sts/i.test(c(ws, 'B1'))
      for (let r = 2; r <= ws.rowCount; r++) {
        const topic = c(ws, `A${r}`); if (!topic) continue
        out.push({ path, phase_label: 'Required Milestones', sts_items: hasSts ? (c(ws, `B${r}`) || null) : null, topic, sort_order: out.length })
      }
    }
    if (out.length) rowsByTable.amtr_milestone_catalog = out
  }

  const cfgs = Object.entries(rowsByTable).map(([table, rows]) => buildSyncCfg(table, rows))
  const labels: Record<string, string> = {
    amtr_jqs_catalog: 'JQS-CFETP', amtr_1098_catalog: 'DAF 1098', amtr_803_catalog: 'DAF 803',
    amtr_qual_catalog: 'Qualifications', amtr_rat_catalog: 'Ready Airman Training', amtr_milestone_catalog: 'Milestones',
  }
  const summary: Record<string, number> = {}
  for (const [table, rows] of Object.entries(rowsByTable)) summary[labels[table] ?? table] = rows.length
  return { cfgs, summary }
}
