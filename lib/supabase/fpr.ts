import { createClient } from './client'
import { friendlyError } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShiftDef, ShiftKey } from '@/lib/shifts'
import { FPR_DEFAULT_ITEMS } from '@/lib/fpr-default-items'

// ─────────────────────────────────────────────────────────────
// Flight Planning Room (FPR) Check CRUD.
//
// Modeled on lib/supabase/scn.ts: upsert-by-natural-key saves that
// delete and rewrite child results, friendly error strings, and a pure
// summarize function for the Events Log preview. Schema in staged
// migrations 2026071720/2026071721.
//
// The fpr_* tables are created by staged migrations and are not yet in
// the generated Database type, so route queries through an untyped
// client (same idiom as amtr.ts / flip.ts) until the owner applies the
// migrations and regenerates types.
// ─────────────────────────────────────────────────────────────

function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

export type FprItemStatus = 'satisfactory' | 'issue' | 'na'

export const FPR_STATUS_LABELS: Record<FprItemStatus, string> = {
  satisfactory: 'Satisfactory',
  issue: 'Issue',
  na: 'N/A',
}

export const FPR_STATUS_COLORS: Record<FprItemStatus, string> = {
  satisfactory: 'var(--color-success)',
  issue: 'var(--color-warning)',
  na: 'var(--color-text-3)',
}

export type FprChecklistItemRow = {
  id: string
  base_id: string
  label: string
  guidance: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FprCheckRow = {
  id: string
  base_id: string
  check_date: string
  shift: ShiftKey
  started_at: string
  completed_at: string | null
  completed_by: string | null
  completed_by_oi: string | null
  notes: string | null
  created_at: string
}

export type FprCheckResultRow = {
  id: string
  check_id: string
  item_id: string | null
  item_label: string
  status: FprItemStatus
  notes: string | null
  sort_order: number
  created_at: string
}

export type FprCheckWithResults = FprCheckRow & { results: FprCheckResultRow[] }

export type FprResultInput = {
  item_id: string | null
  item_label: string
  status: FprItemStatus
  notes?: string | null
  sort_order: number
}

/** Zulu YYYY-MM-DD for today. Checks are tracked by Zulu date to match the rest of the app. */
export function todayZuluDate(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────
// Pure helpers (unit-tested; no Supabase access)
// ─────────────────────────────────────────────────────────────

export type FprResultDraft = {
  item_id: string | null
  item_label: string
  status: FprItemStatus
  notes: string
  sort_order: number
}

/**
 * Build the check modal's draft rows from the checklist template,
 * carrying forward any prior results when editing an existing check.
 * Pure — the results-snapshot mapper (labels snapshotted at draft time,
 * item_id carried for cross-reference, template sort order preserved,
 * inactive items excluded from new drafts).
 *
 * Prior results are matched by item_id first (survives renames), then
 * by label (covers rows whose item_id was nulled by a template delete).
 */
export function buildFprResultDrafts(
  items: FprChecklistItemRow[],
  existing?: FprCheckResultRow[] | null,
): FprResultDraft[] {
  const byItemId = new Map<string, FprCheckResultRow>()
  const byLabel = new Map<string, FprCheckResultRow>()
  for (const r of existing ?? []) {
    if (r.item_id) byItemId.set(r.item_id, r)
    if (!byLabel.has(r.item_label)) byLabel.set(r.item_label, r)
  }
  return items
    .filter(i => i.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i, idx) => {
      const prior = byItemId.get(i.id) ?? byLabel.get(i.label)
      return {
        item_id: i.id,
        item_label: i.label,
        status: prior?.status ?? 'satisfactory',
        notes: prior?.notes ?? '',
        sort_order: i.sort_order ?? idx,
      }
    })
}

/** Summarize a check for the Events Log. Pure. Returns e.g.
 *   "Day Shift Flight Planning Room check complete — all items satisfactory"
 *   "Mid Shift Flight Planning Room check complete — issues: Enroute charts (superseded edition on rack), N/A: Printer/forms stock"
 */
export function summarizeFprCheck(check: FprCheckWithResults, shiftLabel: string): string {
  const label = `${shiftLabel} Flight Planning Room check complete`
  const issues = check.results.filter(r => r.status === 'issue')
  const naItems = check.results.filter(r => r.status === 'na')
  const naSuffix = naItems.length > 0 ? `, N/A: ${naItems.map(r => r.item_label).join(', ')}` : ''
  if (issues.length === 0) {
    return `${label} — all items satisfactory${naSuffix}`
  }
  const parts = issues.map(r => (r.notes ? `${r.item_label} (${r.notes})` : r.item_label))
  return `${label} — issues: ${parts.join(', ')}${naSuffix}`
}

export type FprTodayCard = {
  shift: ShiftKey
  label: string
  check: FprCheckWithResults | undefined
}

/**
 * Derive today's per-shift cards. Pure — the today view's ordering source
 * of truth. Card order follows `getActiveShifts` (canonical day → swing →
 * mid), NOT the fetch order: `fetchTodayFprChecks` orders by `shift`
 * alphabetically (day, mid, swing), which would mis-order a 3-shift base.
 * Only currently-active shifts get a card; a check for a now-inactive
 * shift (e.g. a `mid` check after the base dropped to 1 shift) has no
 * today card here and surfaces only in history.
 */
export function deriveFprTodayCards(
  activeShifts: ShiftDef[],
  todayChecks: FprCheckWithResults[],
): FprTodayCard[] {
  return activeShifts.map((s) => ({
    shift: s.key,
    label: s.label,
    check: todayChecks.find((c) => c.shift === s.key),
  }))
}

// ─────────────────────────────────────────────────────────────
// Checklist template (per-base config)
// ─────────────────────────────────────────────────────────────

export async function fetchFprChecklistItems(baseId: string, activeOnly = false): Promise<FprChecklistItemRow[]> {
  const supabase = db()
  if (!supabase || !baseId) return []

  let query = supabase
    .from('fpr_checklist_items')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    console.error('fetchFprChecklistItems failed:', error.message)
    return []
  }
  return (data || []) as FprChecklistItemRow[]
}

export async function createFprChecklistItem(
  baseId: string,
  label: string,
  guidance?: string | null,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const trimmed = label.trim()
  if (!trimmed) return { error: 'Item label is required' }

  // Append to end by default
  const { data: existing } = await supabase
    .from('fpr_checklist_items')
    .select('sort_order')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing && existing.length > 0 ? (existing[0] as { sort_order: number }).sort_order : 0) + 10

  const { error } = await supabase.from('fpr_checklist_items').insert({
    base_id: baseId,
    label: trimmed,
    guidance: guidance?.trim() || null,
    sort_order: nextOrder,
  })
  return { error: error ? friendlyError(error.message) : null }
}

export async function updateFprChecklistItem(
  id: string,
  patch: Partial<Pick<FprChecklistItemRow, 'label' | 'guidance' | 'is_active'>>,
): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) fields.label = patch.label.trim()
  if (patch.guidance !== undefined) fields.guidance = patch.guidance?.trim() || null
  if (patch.is_active !== undefined) fields.is_active = patch.is_active

  const { error } = await supabase.from('fpr_checklist_items').update(fields).eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/** Persist a new ordering: sort_order is reassigned (10, 20, 30, …) in array order. */
export async function reorderFprChecklistItems(orderedIds: string[]): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('fpr_checklist_items')
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() })
      .eq('id', orderedIds[i])
    if (error) return { error: friendlyError(error.message) }
  }
  return { error: null }
}

export async function deleteFprChecklistItem(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('fpr_checklist_items').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

/**
 * Insert the proposed default items from lib/fpr-default-items.ts.
 * Intended for an empty list (the wizard's "Load default checklist"
 * button, mirroring QRC's import-defaults idiom); skips items whose
 * label already exists at the base so a replay/double-click can't
 * duplicate rows.
 */
export async function seedDefaultFprItems(baseId: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }

  const { data: existing, error: fetchErr } = await supabase
    .from('fpr_checklist_items')
    .select('label')
    .eq('base_id', baseId)
  if (fetchErr) return { error: friendlyError(fetchErr.message) }

  const existingLabels = new Set(((existing || []) as { label: string }[]).map(i => i.label))
  const toInsert = FPR_DEFAULT_ITEMS
    .filter(item => !existingLabels.has(item.label))
    .map((item, i) => ({
      base_id: baseId,
      label: item.label,
      guidance: item.guidance ?? null,
      sort_order: (i + 1) * 10,
    }))
  if (toInsert.length === 0) return { error: null }

  const { error } = await supabase.from('fpr_checklist_items').insert(toInsert)
  return { error: error ? friendlyError(error.message) : null }
}

// ─────────────────────────────────────────────────────────────
// Checks
// ─────────────────────────────────────────────────────────────

async function attachResults(supabase: SupabaseClient, checks: FprCheckRow[]): Promise<FprCheckWithResults[]> {
  if (checks.length === 0) return []
  const ids = checks.map(c => c.id)
  const { data: results } = await supabase
    .from('fpr_check_results')
    .select('*')
    .in('check_id', ids)
    .order('sort_order', { ascending: true })

  const byCheck = new Map<string, FprCheckResultRow[]>()
  for (const r of (results || []) as FprCheckResultRow[]) {
    const arr = byCheck.get(r.check_id) ?? []
    arr.push(r)
    byCheck.set(r.check_id, arr)
  }
  return checks.map(c => ({ ...c, results: byCheck.get(c.id) ?? [] }))
}

export async function fetchTodayFprChecks(baseId: string, dateZulu: string = todayZuluDate()): Promise<FprCheckWithResults[]> {
  const supabase = db()
  if (!supabase || !baseId) return []

  const { data: checks, error } = await supabase
    .from('fpr_checks')
    .select('*')
    .eq('base_id', baseId)
    .eq('check_date', dateZulu)
    .order('shift', { ascending: true })

  if (error || !checks || checks.length === 0) return []
  return attachResults(supabase, checks as FprCheckRow[])
}

export async function fetchFprCheckById(id: string): Promise<FprCheckWithResults | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: check, error } = await supabase
    .from('fpr_checks')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !check) return null

  const [withResults] = await attachResults(supabase, [check as FprCheckRow])
  return withResults ?? null
}

export async function fetchFprChecksInRange(baseId: string, startDate: string, endDate: string): Promise<FprCheckWithResults[]> {
  const supabase = db()
  if (!supabase || !baseId) return []

  const { data: checks } = await supabase
    .from('fpr_checks')
    .select('*')
    .eq('base_id', baseId)
    .gte('check_date', startDate)
    .lte('check_date', endDate)
    .order('check_date', { ascending: true })
    .order('shift', { ascending: true })

  if (!checks || checks.length === 0) return []
  return attachResults(supabase, checks as FprCheckRow[])
}

/**
 * Upsert a check by its natural key (base_id, check_date, shift) and
 * rewrite its per-item results (delete-and-rewrite children, per the
 * scn.ts saveCheck idiom). Replay-safe: re-running the same save lands
 * on the same row and rewrites the same results.
 *
 * Deliberately does NOT write activity_log — the page's completion
 * handler calls logActivity with summarizeFprCheck output (house rule:
 * CRUD modules never touch activity_log; see the design spec's
 * "Events Log write" section).
 */
export async function saveFprCheck(input: {
  baseId: string
  checkDate: string
  shift: ShiftKey
  operatingInitials?: string | null
  notes?: string | null
  items: FprResultInput[]
}): Promise<{ data: FprCheckWithResults | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch { /* unauthenticated — skip attribution */ }

  // Upsert the check row by (base_id, check_date, shift)
  const { data: existing } = await supabase
    .from('fpr_checks')
    .select('id')
    .eq('base_id', input.baseId)
    .eq('check_date', input.checkDate)
    .eq('shift', input.shift)
    .maybeSingle()

  const completedAt = new Date().toISOString()
  const checkPayload = {
    base_id: input.baseId,
    check_date: input.checkDate,
    shift: input.shift,
    completed_at: completedAt,
    completed_by: userId,
    completed_by_oi: input.operatingInitials || null,
    notes: input.notes || null,
  }

  let checkId: string
  if (existing?.id) {
    checkId = existing.id as string
    const { error } = await supabase.from('fpr_checks').update(checkPayload).eq('id', checkId)
    if (error) return { data: null, error: friendlyError(error.message) }
    // Clear existing results so we can rewrite — a silent delete failure
    // followed by the reinsert below would duplicate result rows.
    const { error: clearError } = await supabase.from('fpr_check_results').delete().eq('check_id', checkId)
    if (clearError) return { data: null, error: friendlyError(clearError.message) }
  } else {
    const { data: inserted, error } = await supabase
      .from('fpr_checks')
      .insert(checkPayload)
      .select('id')
      .single()
    if (error || !inserted) return { data: null, error: friendlyError(error?.message || 'Failed to save check') }
    checkId = (inserted as { id: string }).id
  }

  // Insert results
  if (input.items.length > 0) {
    const resultRows = input.items.map(i => ({
      check_id: checkId,
      item_id: i.item_id,
      item_label: i.item_label,
      status: i.status,
      notes: i.notes || null,
      sort_order: i.sort_order,
    }))
    const { error: rErr } = await supabase.from('fpr_check_results').insert(resultRows)
    if (rErr) return { data: null, error: friendlyError(rErr.message) }
  }

  const full = await fetchFprCheckById(checkId)
  if (!full) return { data: null, error: 'Saved but could not re-fetch check' }
  return { data: full, error: null }
}

export async function deleteFprCheck(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('fpr_checks').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
