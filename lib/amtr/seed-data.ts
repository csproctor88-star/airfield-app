// ─────────────────────────────────────────────────────────────
// AMTR bundled seed data — the real 1C7X1 catalogs extracted from
// the /training documents (see scripts/extract-amtr-seed.mjs).
// `seedBaseCatalogs` adopts the standard catalogs for a base via the
// batch-insert CRUD helper. Guards against double-seeding.
// ─────────────────────────────────────────────────────────────

import jqsCatalog from './data/jqs-catalog.json'
import recurring1098 from './data/recurring-1098.json'
import formalCourses from './data/formal-courses.json'
import ratCourses from './data/rat-courses.json'
import milestones from './data/milestones.json'
import { DEFAULT_INSPECTION_CHECKLIST } from './inspection-checklist'
import { DEFAULT_623A_ENTRY_TYPES } from './reference-data'
import std803 from './data/std-803.json'
import {
  insertAmtrRows, countAmtrRows, fetchAmtrByBase, upsertAmtrRow, updateAmtrRow, setAmtrCatalogVersion,
} from '@/lib/supabase/amtr'

// Bump when the bundled standard catalogs are updated to a new HAF release.
export const CATALOG_VERSION = '2026.05 (1C7X1)'

const STD_803 = std803 as Record<string, unknown>[]

const INSPECTION_CHECKLIST = DEFAULT_INSPECTION_CHECKLIST.map((r, i) => ({
  kind: r.kind, label: r.label, item_number: r.item_number, auto_key: r.auto_key ?? null, sort_order: i,
})) as Record<string, unknown>[]

const ENTRY_TYPES_623A = DEFAULT_623A_ENTRY_TYPES.map((label, i) => ({ label, sort_order: i })) as Record<string, unknown>[]

// Standard qualification training packages, skill levels, and SEIs.
const QUAL_CATALOG = ([
  ['qtp', 'KMTC Local PCG'], ['qtp', '5-Level QTP'], ['qtp', 'AMOPS Supervisor/Shift Lead PCG'],
  ['qtp', '7-Level QTP'], ['qtp', 'Airfield Manager PCG'],
  ['skill_level', 'Trainer'], ['skill_level', 'Certifier'], ['skill_level', '1C731 Skill Level'],
  ['skill_level', '1C751 Skill Level'], ['skill_level', '1C771 Skill Level'], ['skill_level', '1C791 Skill Level'],
  ['sei', 'SEI 155'], ['sei', 'SEI 368'], ['sei', 'SEI 090'], ['sei', 'SEI 3LZ'],
] as [string, string][]).map(([category, name], i) => ({ category, name, sort_order: i })) as Record<string, unknown>[]

export type JqsSeedRow = {
  kind: 'section' | 'item'; number: string | null; title: string; depth: number
  required: boolean; training_refs: string | null; core_cert: string | null
  deploy_sei: string | null; prof3: string | null; prof5: string | null
  prof7: string | null; prof9: string | null; sort_order: number
}
export type Recurring1098Row = { task: string; type: string | null; frequency: string; score_or_hours: string | null; sort_order: number }
export type FormalRow = { section: string; course: string; sort_order: number }
export type RatRow = { course: string; category: string | null; method: string | null; frequency: string; sort_order: number }
export type MilestoneRow = { path: string; phase_label: string; sts_items: string | null; topic: string; sort_order: number }

export const JQS_CATALOG = jqsCatalog as JqsSeedRow[]
export const RECURRING_1098 = recurring1098 as Recurring1098Row[]
export const FORMAL_COURSES = formalCourses as FormalRow[]
export const RAT_COURSES = ratCourses as RatRow[]
export const MILESTONES = milestones as MilestoneRow[]

export const SEED_COUNTS = {
  jqs: JQS_CATALOG.length,
  recurring1098: RECURRING_1098.length,
  formal: FORMAL_COURSES.length,
  rat: RAT_COURSES.length,
  milestones: MILESTONES.length,
  inspection: DEFAULT_INSPECTION_CHECKLIST.length,
  std803: STD_803.length,
  quals: QUAL_CATALOG.length,
}

const withBase = (baseId: string, rows: Record<string, unknown>[]) =>
  rows.map((r) => ({ ...r, base_id: baseId, managed: true }))

export type SeedResult = { table: string; inserted: number; skipped: boolean; error: string | null }

/**
 * Adopt the standard 1C7X1 catalogs for a base. Each catalog is skipped
 * if it already has rows (so re-running won't duplicate). Returns a
 * per-catalog summary.
 */
export async function seedBaseCatalogs(baseId: string): Promise<SeedResult[]> {
  const jobs: { table: string; rows: Record<string, unknown>[] }[] = [
    { table: 'amtr_jqs_catalog', rows: JQS_CATALOG as unknown as Record<string, unknown>[] },
    { table: 'amtr_1098_catalog', rows: RECURRING_1098 as unknown as Record<string, unknown>[] },
    { table: 'amtr_formal_catalog', rows: FORMAL_COURSES as unknown as Record<string, unknown>[] },
    { table: 'amtr_rat_catalog', rows: RAT_COURSES as unknown as Record<string, unknown>[] },
    { table: 'amtr_milestone_catalog', rows: MILESTONES as unknown as Record<string, unknown>[] },
    { table: 'amtr_inspection_checklist', rows: INSPECTION_CHECKLIST },
    { table: 'amtr_623a_entry_types', rows: ENTRY_TYPES_623A },
    { table: 'amtr_803_catalog', rows: STD_803 },
    { table: 'amtr_qual_catalog', rows: QUAL_CATALOG },
  ]
  const currentYearStr = String(new Date().getUTCFullYear())
  const results: SeedResult[] = []
  for (const job of jobs) {
    const existing = await countAmtrRows(job.table, baseId)
    if (existing > 0) {
      results.push({ table: job.table, inserted: 0, skipped: true, error: null })
      continue
    }
    // 1098 catalog is per-year (Phase B) — tag seed rows with current year.
    const rows = job.table === 'amtr_1098_catalog'
      ? job.rows.map((r) => ({ ...r, year_label: currentYearStr }))
      : job.rows
    const { inserted, error } = await insertAmtrRows(job.table, withBase(baseId, rows))
    results.push({ table: job.table, inserted, skipped: false, error })
  }
  // 1098 needs current/prior year rows for the progress UI.
  const yearCount = await countAmtrRows('amtr_1098_years', baseId)
  if (yearCount === 0) {
    const year = new Date().getUTCFullYear()
    await insertAmtrRows('amtr_1098_years', [
      { base_id: baseId, year_label: String(year), is_current: true },
      { base_id: baseId, year_label: String(year - 1), is_current: false },
    ])
  }
  await setAmtrCatalogVersion(baseId, CATALOG_VERSION)
  return results
}

// ── Version-aware standard-catalog sync ────────────────────
export type SyncRow = Record<string, unknown>
export type SyncCfg = { table: string; rows: SyncRow[]; key: (r: SyncRow) => string; fields: string[] }

// Natural key + synced fields per standard catalog (shared by the bundled sync
// and the uploaded-workbook sync so matching is identical).
export const CATALOG_SYNC_META: Record<string, { key: (r: SyncRow) => string; fields: string[] }> = {
  // `required` and `training_refs` are deliberately omitted from the
  // JQS sync field list — the AFFSA workbook doesn't carry them, so
  // including them would force every upload to overwrite NAMT-edited
  // values back to their parsed defaults (false / null). Leaving
  // them off means new items insert with their DB defaults but
  // subsequent uploads don't touch them, preserving admin edits.
  amtr_jqs_catalog: { key: (r) => `${r.kind}|${r.number ?? r.title}`, fields: ['kind', 'number', 'title', 'depth', 'core_cert', 'deploy_sei', 'prof3', 'prof5', 'prof7', 'prof9', 'sort_order'] },
  amtr_1098_catalog: { key: (r) => String(r.task), fields: ['task', 'type', 'frequency', 'score_or_hours', 'sort_order'] },
  amtr_formal_catalog: { key: (r) => `${r.section}|${r.course}`, fields: ['section', 'course', 'sort_order'] },
  amtr_rat_catalog: { key: (r) => String(r.course), fields: ['course', 'category', 'method', 'frequency', 'sort_order'] },
  amtr_milestone_catalog: { key: (r) => `${r.path}|${r.topic}`, fields: ['path', 'phase_label', 'sts_items', 'topic', 'sort_order'] },
  amtr_inspection_checklist: { key: (r) => `${r.kind}|${r.item_number ?? r.label}`, fields: ['kind', 'label', 'item_number', 'auto_key', 'sort_order'] },
  amtr_623a_entry_types: { key: (r) => String(r.label), fields: ['label', 'sort_order'] },
  amtr_803_catalog: { key: (r) => `${r.section}|${r.sts_item}`, fields: ['section', 'sts_item', 'sort_order'] },
  amtr_qual_catalog: { key: (r) => `${r.category}|${r.name}`, fields: ['category', 'name', 'sort_order'] },
}

const BUNDLED: Record<string, SyncRow[]> = {
  amtr_jqs_catalog: JQS_CATALOG as unknown as SyncRow[],
  amtr_1098_catalog: RECURRING_1098 as unknown as SyncRow[],
  amtr_formal_catalog: FORMAL_COURSES as unknown as SyncRow[],
  amtr_rat_catalog: RAT_COURSES as unknown as SyncRow[],
  amtr_milestone_catalog: MILESTONES as unknown as SyncRow[],
  amtr_inspection_checklist: INSPECTION_CHECKLIST,
  amtr_623a_entry_types: ENTRY_TYPES_623A,
  amtr_803_catalog: STD_803,
  amtr_qual_catalog: QUAL_CATALOG,
}

/** Build a SyncCfg for a table from a set of source rows (bundled or uploaded). */
export function buildSyncCfg(table: string, rows: SyncRow[]): SyncCfg {
  const m = CATALOG_SYNC_META[table]
  return { table, rows, key: m.key, fields: m.fields }
}

export type SyncResult = { table: string; added: number; updated: number; retired: number; error: string | null }

/** Per-table diff produced by computeSyncDiff — fed to the admin
 *  preview modal so they see EXACTLY what will change before clicking
 *  Update. Samples are up to 5 representative item labels per bucket. */
export type SyncDiffTable = {
  table: string
  added: number
  updated: number
  retired: number
  addedSamples: string[]
  updatedSamples: string[]
  retiredSamples: string[]
}
export type SyncDiff = { perTable: SyncDiffTable[]; totals: { added: number; updated: number; retired: number } }

/** Dry-run computation of what runSyncCatalogs would do with these
 *  cfgs against the base's current catalogs. Reads only. */
export async function computeSyncDiff(baseId: string, cfgs: SyncCfg[]): Promise<SyncDiff> {
  const currentYearStr = String(new Date().getUTCFullYear())
  const perTable: SyncDiffTable[] = []
  for (const cfg of cfgs) {
    let existing = await fetchAmtrByBase<SyncRow>(cfg.table, baseId)
    if (cfg.table === 'amtr_1098_catalog') {
      existing = existing.filter((r) => String(r.year_label) === currentYearStr)
    }
    const exByKey = new Map(existing.map((r) => [cfg.key(r), r]))
    const newKeys = new Set(cfg.rows.map(cfg.key))
    let added = 0, updated = 0, retired = 0
    const addedSamples: string[] = [], updatedSamples: string[] = [], retiredSamples: string[] = []
    const labelOf = (r: SyncRow): string => String(r.title ?? r.task ?? r.course ?? r.topic ?? r.name ?? r.sts_item ?? r.label ?? cfg.key(r))
    for (const b of cfg.rows) {
      const ex = exByKey.get(cfg.key(b))
      if (!ex) {
        added++
        if (addedSamples.length < 5) addedSamples.push(labelOf(b))
      } else {
        const changed = ex.retired === true || ex.managed !== true || cfg.fields.some((f) => String(ex[f] ?? '') !== String(b[f] ?? ''))
        if (changed) {
          updated++
          if (updatedSamples.length < 5) updatedSamples.push(labelOf(b))
        }
      }
    }
    for (const ex of existing) {
      if (ex.managed === true && ex.retired !== true && !newKeys.has(cfg.key(ex))) {
        retired++
        if (retiredSamples.length < 5) retiredSamples.push(labelOf(ex))
      }
    }
    perTable.push({ table: cfg.table, added, updated, retired, addedSamples, updatedSamples, retiredSamples })
  }
  const totals = perTable.reduce(
    (acc, t) => ({ added: acc.added + t.added, updated: acc.updated + t.updated, retired: acc.retired + t.retired }),
    { added: 0, updated: 0, retired: 0 },
  )
  return { perTable, totals }
}

/**
 * Merge a set of standard-catalog configs into a base BY NATURAL KEY: update
 * changed managed rows in place (preserving their id → member progress stays
 * attached), insert new items, and soft-retire managed items dropped from the
 * new version. NAMT-added custom rows (managed=false) are untouched. Never
 * deletes — records survive a version change. Only the catalogs present in
 * `cfgs` are touched.
 */
export async function runSyncCatalogs(baseId: string, cfgs: SyncCfg[], version: string): Promise<SyncResult[]> {
  const currentYearStr = String(new Date().getUTCFullYear())
  const out: SyncResult[] = []
  for (const cfg of cfgs) {
    let existing = await fetchAmtrByBase<SyncRow>(cfg.table, baseId)
    // 1098 catalog is per-year (Phase B). Sync only affects the current
    // year — historical years are frozen so updating to a new standard
    // version doesn't rewrite archived 1098 catalogs.
    if (cfg.table === 'amtr_1098_catalog') {
      existing = existing.filter((r) => String(r.year_label) === currentYearStr)
    }
    const exByKey = new Map(existing.map((r) => [cfg.key(r), r]))
    const newKeys = new Set(cfg.rows.map(cfg.key))
    let added = 0, updated = 0, retired = 0, error: string | null = null
    for (const b of cfg.rows) {
      const ex = exByKey.get(cfg.key(b))
      const payload: SyncRow = { managed: true, retired: false }
      for (const f of cfg.fields) payload[f] = b[f] ?? null
      // Tag 1098 inserts with the current year so they pass NOT NULL +
      // UNIQUE (base_id, year_label, task) constraints.
      if (cfg.table === 'amtr_1098_catalog') payload.year_label = currentYearStr
      if (ex) {
        const changed = ex.retired === true || ex.managed !== true || cfg.fields.some((f) => String(ex[f] ?? '') !== String(b[f] ?? ''))
        if (changed) { const { error: e } = await updateAmtrRow(cfg.table, String(ex.id), payload); if (e) error = e; else updated++ }
      } else {
        const { error: e } = await upsertAmtrRow(cfg.table, { base_id: baseId, ...payload }); if (e) error = e; else added++
      }
    }
    for (const ex of existing) {
      if (ex.managed === true && ex.retired !== true && !newKeys.has(cfg.key(ex))) {
        const { error: e } = await updateAmtrRow(cfg.table, String(ex.id), { retired: true }); if (e) error = e; else retired++
      }
    }
    out.push({ table: cfg.table, added, updated, retired, error })
  }
  await setAmtrCatalogVersion(baseId, version)
  return out
}

/** Sync the base to the bundled standard catalogs (the app's current version). */
export async function syncStandardCatalogs(baseId: string): Promise<SyncResult[]> {
  const cfgs = Object.keys(CATALOG_SYNC_META).map((t) => buildSyncCfg(t, BUNDLED[t] ?? []))
  return runSyncCatalogs(baseId, cfgs, CATALOG_VERSION)
}
