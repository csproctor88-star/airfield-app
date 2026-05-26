/**
 * Field Conditions / TALPA — CRUD layer
 *
 * Per 14 CFR §139.313 and AC 150/5200-30D, civilian Part 139 airports
 * issue Field Condition Reports (FCRs) any time runway surface
 * conditions degrade. This module is the data layer for the 2 tables:
 *
 *   field_condition_reports — append-only with supersede_by_id chain
 *   field_condition_thirds  — per-third RwyCC + contaminant + depth
 *
 * `ficon_text` is materialized at INSERT (built via the rwycc.ts
 * generator) so the active-report card and CSV exports never need to
 * recompute. Revising a report is **always** a new (superseding) row;
 * UPDATE is reserved for back-filling `superseded_by_id` on the prior
 * row.
 *
 * Civilian Part 139 only (gated at module-config layer via
 * `appliesTo: ['faa_part139']`).
 */

import { createClient } from './client'
import { logActivity } from './activity'
import { friendlyError } from '@/lib/utils'
import {
  deriveRwycc,
  buildFiconNotamText,
  CONTAMINANT_LABELS,
  THIRD_ORDER,
  type Contaminant,
  type RwyccCode,
  type Third,
  type Treatment,
  type FiconThird,
} from '@/lib/calculations/rwycc'

function db() {
  return createClient()
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type FieldConditionThird = {
  id: string
  report_id: string
  third: Third
  contaminant: Contaminant
  depth_in: number | null
  coverage_percent: number | null
  rwycc: RwyccCode
  rwycc_derived: RwyccCode
  rwycc_manual_override: boolean
  override_reason: string | null
  sort_order: number
}

export type FieldConditionReport = {
  id: string
  base_id: string
  runway_id: string
  generated_at: string
  generated_by: string | null
  generated_by_oi: string | null
  valid_until: string
  temperature_f: number | null
  treatments: Treatment[]
  conditions_unchanged_since: string | null
  superseded_by_id: string | null
  notes: string | null
  ficon_text: string
  created_at: string
}

export type FieldConditionReportWithThirds = FieldConditionReport & {
  thirds: FieldConditionThird[]
  /** Joined from base_runways at read time for UI rendering. */
  runway_designator?: string | null
}

export type ThirdInput = {
  third: Third
  contaminant: Contaminant
  depth_in?: number | null
  coverage_percent: number
  /** Set when operator overrides the derived value; requires override_reason. */
  rwycc_override?: RwyccCode | null
  override_reason?: string | null
}

// ────────────────────────────────────────────────────────────────
// Fetch
// ────────────────────────────────────────────────────────────────

/**
 * Most-recent non-superseded report per runway at this base whose
 * valid_until is still in the future. One row per runway max.
 */
export async function fetchActiveByRunway(baseId: string): Promise<FieldConditionReportWithThirds[]> {
  const supabase = db()
  if (!supabase) return []

  const { data: reports } = await supabase
    .from('field_condition_reports')
    .select('*')
    .eq('base_id', baseId)
    .is('superseded_by_id', null)
    .gt('valid_until', new Date().toISOString())
    .order('generated_at', { ascending: false })

  if (!reports || reports.length === 0) return []

  return enrichWithThirdsAndRunway(reports as FieldConditionReport[])
}

/** Trailing N-day history (default 30 days). Both active + superseded. */
export async function fetchRecentHistory(
  baseId: string,
  days = 30,
): Promise<FieldConditionReportWithThirds[]> {
  const supabase = db()
  if (!supabase) return []
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const { data: reports } = await supabase
    .from('field_condition_reports')
    .select('*')
    .eq('base_id', baseId)
    .gte('generated_at', since)
    .order('generated_at', { ascending: false })

  if (!reports || reports.length === 0) return []

  return enrichWithThirdsAndRunway(reports as FieldConditionReport[])
}

export async function fetchReportById(id: string): Promise<FieldConditionReportWithThirds | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: report } = await supabase
    .from('field_condition_reports')
    .select('*')
    .eq('id', id)
    .single()
  if (!report) return null

  const enriched = await enrichWithThirdsAndRunway([report as FieldConditionReport])
  return enriched[0] ?? null
}

/** Pulls per-report thirds + runway designators in batch for the list views. */
async function enrichWithThirdsAndRunway(
  reports: FieldConditionReport[],
): Promise<FieldConditionReportWithThirds[]> {
  const supabase = db()
  if (!supabase || reports.length === 0) return reports.map(r => ({ ...r, thirds: [] }))

  const reportIds = reports.map(r => r.id)
  const runwayIds = Array.from(new Set(reports.map(r => r.runway_id)))

  const [thirdsRes, runwaysRes] = await Promise.all([
    supabase.from('field_condition_thirds').select('*').in('report_id', reportIds).order('sort_order', { ascending: true }),
    supabase.from('base_runways').select('id, runway_id').in('id', runwayIds),
  ])

  const thirdsByReport = new Map<string, FieldConditionThird[]>()
  for (const t of (thirdsRes.data || []) as FieldConditionThird[]) {
    const arr = thirdsByReport.get(t.report_id) ?? []
    arr.push(t)
    thirdsByReport.set(t.report_id, arr)
  }

  const designatorByRunway = new Map<string, string>()
  for (const r of (runwaysRes.data || []) as { id: string; runway_id: string }[]) {
    designatorByRunway.set(r.id, r.runway_id)
  }

  return reports.map(r => ({
    ...r,
    thirds: thirdsByReport.get(r.id) ?? [],
    runway_designator: designatorByRunway.get(r.runway_id) ?? null,
  }))
}

// ────────────────────────────────────────────────────────────────
// Create
// ────────────────────────────────────────────────────────────────

export type CreateReportInput = {
  base_id: string
  runway_id: string
  runway_designator: string                   // resolved by caller for FICON text
  valid_until: string                          // ISO timestamp
  temperature_f?: number | null
  treatments: Treatment[]
  notes?: string | null
  operating_initials?: string | null
  thirds: ThirdInput[]
}

/**
 * Issue a new field condition report:
 *  1. Compute derived RwyCC per third from rwycc.ts
 *  2. Use override value if provided (and stamp manual_override=true)
 *  3. Materialize FICON text via buildFiconNotamText
 *  4. INSERT report + 3 thirds
 *  5. Back-fill superseded_by_id on any prior active report for the same runway
 *  6. Log activity
 *
 * The supersede step is intentionally a second write (not a transaction).
 * Worst case is a transient window where both rows look active — idempotent
 * retry resolves; the partial index ensures the active-lookup remains fast.
 */
export async function createReport(input: CreateReportInput): Promise<{
  ok: boolean
  report?: FieldConditionReportWithThirds
  error?: string
}> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated' }

  if (input.thirds.length !== 3) {
    return { ok: false, error: 'Must provide all three runway thirds (touchdown / midpoint / rollout)' }
  }
  const thirdKeys = new Set(input.thirds.map(t => t.third))
  if (thirdKeys.size !== 3) return { ok: false, error: 'Duplicate thirds in input' }

  // Build per-third assessments with derived + final RwyCC values
  type EnrichedThird = ThirdInput & {
    rwycc: RwyccCode
    rwycc_derived: RwyccCode
    rwycc_manual_override: boolean
  }
  const enriched: EnrichedThird[] = input.thirds.map(t => {
    const derived = deriveRwycc({
      contaminant: t.contaminant,
      depthInches: t.depth_in ?? null,
      // temperature is a report-level field, not per-third; only compacted_snow uses it
      temperatureC: input.temperature_f !== null && input.temperature_f !== undefined
        ? (input.temperature_f - 32) * 5 / 9
        : null,
    })
    const override = t.rwycc_override
    const isOverride = override !== undefined && override !== null && override !== derived
    return {
      ...t,
      rwycc: isOverride ? (override as RwyccCode) : derived,
      rwycc_derived: derived,
      rwycc_manual_override: isOverride,
    }
  })

  // Override reason is required on every overridden third
  const missingReason = enriched.find(t => t.rwycc_manual_override && !t.override_reason?.trim())
  if (missingReason) {
    return { ok: false, error: `Override reason required for ${missingReason.third} third` }
  }

  // Materialize FICON text
  const ficonThirds: FiconThird[] = enriched
    .sort((a, b) => THIRD_ORDER.indexOf(a.third) - THIRD_ORDER.indexOf(b.third))
    .map(t => ({
      third: t.third,
      contaminant: t.contaminant,
      coveragePercent: t.coverage_percent,
      depthInches: t.depth_in ?? null,
      rwycc: t.rwycc,
    }))
  const ficonText = buildFiconNotamText({
    runwayDesignator: input.runway_designator,
    thirds: ficonThirds,
    treatments: input.treatments,
  })

  // Insert the report row
  const { data: reportRow, error: insertErr } = await supabase
    .from('field_condition_reports')
    .insert({
      base_id: input.base_id,
      runway_id: input.runway_id,
      generated_by: user.id,
      generated_by_oi: input.operating_initials ?? null,
      valid_until: input.valid_until,
      temperature_f: input.temperature_f ?? null,
      treatments: input.treatments,
      notes: input.notes?.trim() || null,
      ficon_text: ficonText,
    } as never)
    .select('*')
    .single()

  if (insertErr || !reportRow) {
    return { ok: false, error: insertErr ? friendlyError(insertErr.message) : 'Failed to save report' }
  }
  const report = reportRow as FieldConditionReport

  // Insert the 3 thirds
  const thirdRows = enriched.map((t, idx) => ({
    report_id: report.id,
    third: t.third,
    contaminant: t.contaminant,
    depth_in: t.depth_in ?? null,
    coverage_percent: t.coverage_percent,
    rwycc: t.rwycc,
    rwycc_derived: t.rwycc_derived,
    rwycc_manual_override: t.rwycc_manual_override,
    override_reason: t.rwycc_manual_override ? t.override_reason?.trim() ?? null : null,
    sort_order: THIRD_ORDER.indexOf(t.third) >= 0 ? THIRD_ORDER.indexOf(t.third) : idx,
  }))

  const { error: thirdsErr } = await supabase
    .from('field_condition_thirds')
    .insert(thirdRows as never)

  if (thirdsErr) {
    // Roll back the report row so the caller can retry cleanly
    await supabase.from('field_condition_reports').delete().eq('id', report.id)
    return { ok: false, error: friendlyError(thirdsErr.message) }
  }

  // Back-fill superseded_by_id on the prior active report for this runway
  await supabase
    .from('field_condition_reports')
    .update({ superseded_by_id: report.id } as never)
    .eq('base_id', input.base_id)
    .eq('runway_id', input.runway_id)
    .is('superseded_by_id', null)
    .neq('id', report.id)

  // Activity log entry
  const tdSummary = enriched.find(t => t.third === 'touchdown')
  const midSummary = enriched.find(t => t.third === 'midpoint')
  const roSummary = enriched.find(t => t.third === 'rollout')
  const rwyccTuple = `${tdSummary?.rwycc ?? '?'}/${midSummary?.rwycc ?? '?'}/${roSummary?.rwycc ?? '?'}`
  const detailStr = [
    tdSummary && `touchdown ${CONTAMINANT_LABELS[tdSummary.contaminant]}`,
    midSummary && `midpoint ${CONTAMINANT_LABELS[midSummary.contaminant]}`,
    roSummary && `rollout ${CONTAMINANT_LABELS[roSummary.contaminant]}`,
  ].filter(Boolean).join(', ')
  logActivity('created', 'field_condition', report.id,
    `FCR issued — RWY ${input.runway_designator} ${rwyccTuple}`,
    { details: `${detailStr.toUpperCase()} · FICON: ${ficonText}` },
    input.base_id)

  const enrichedReport = await fetchReportById(report.id)
  return { ok: true, report: enrichedReport ?? undefined }
}

// ────────────────────────────────────────────────────────────────
// Delete (only safe pre-supersede; UI restricts based on superseded_by_id)
// ────────────────────────────────────────────────────────────────

export async function deleteReport(id: string, baseId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }
  const { error } = await supabase.from('field_condition_reports').delete().eq('id', id)
  if (error) return { ok: false, error: friendlyError(error.message) }
  logActivity('deleted', 'field_condition', id, 'FCR deleted', undefined, baseId)
  return { ok: true }
}
