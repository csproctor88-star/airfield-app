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
import { insertAmtrRows, countAmtrRows } from '@/lib/supabase/amtr'

const INSPECTION_CHECKLIST = DEFAULT_INSPECTION_CHECKLIST.map((r, i) => ({
  kind: r.kind, label: r.label, item_number: r.item_number, auto_key: r.auto_key ?? null, sort_order: i,
})) as Record<string, unknown>[]

const ENTRY_TYPES_623A = DEFAULT_623A_ENTRY_TYPES.map((label, i) => ({ label, sort_order: i })) as Record<string, unknown>[]

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
}

const withBase = (baseId: string, rows: Record<string, unknown>[]) =>
  rows.map((r) => ({ ...r, base_id: baseId }))

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
  ]
  const results: SeedResult[] = []
  for (const job of jobs) {
    const existing = await countAmtrRows(job.table, baseId)
    if (existing > 0) {
      results.push({ table: job.table, inserted: 0, skipped: true, error: null })
      continue
    }
    const { inserted, error } = await insertAmtrRows(job.table, withBase(baseId, job.rows))
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
  return results
}
