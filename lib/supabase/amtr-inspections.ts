import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { upsertAmtrRow } from './amtr'

// amtr_inspections / amtr_inspection_checklist aren't in the generated
// Database type — route through an untyped client (RLS gates writes).
function db(): SupabaseClient | null {
  return createClient() as unknown as SupabaseClient | null
}

export type InspectionItemResponse = {
  item_number: string
  status: 'yes' | 'no' | 'na' | null
  auto: 'yes' | 'no' | 'na' | null
  findings: string[]            // raw auto findings — immutable audit source
  detail?: string               // editable finding text (seeded from findings)
  correctiveAction?: string     // inspector corrective action
  note?: string                 // deprecated: read on load, migrated to correctiveAction
}

/** Fill detail/correctiveAction for back-compat with rows saved before these fields. */
export function normalizeInspectionItem(it: InspectionItemResponse): InspectionItemResponse {
  return {
    ...it,
    detail: it.detail ?? (it.findings ?? []).join(' · '),
    correctiveAction: it.correctiveAction ?? it.note ?? '',
  }
}

export type AmtrInspection = {
  id: string
  base_id: string
  member_id: string
  inspection_date: string
  status: 'draft' | 'completed'
  items: InspectionItemResponse[]
  notes: string | null
  yes_count: number
  no_count: number
  na_count: number
  gap_count: number
  completed_at: string | null
  completed_by: string | null
  completed_by_name: string | null
  created_623a_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export async function fetchAmtrInspections(baseId: string): Promise<AmtrInspection[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('amtr_inspections').select('*').eq('base_id', baseId).order('inspection_date', { ascending: false })
  if (error) { console.error('fetchAmtrInspections:', error.message); return [] }
  return (data ?? []) as AmtrInspection[]
}

export async function fetchAmtrInspectionsByMember(memberId: string): Promise<AmtrInspection[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('amtr_inspections').select('*').eq('member_id', memberId).order('inspection_date', { ascending: false })
  if (error) { console.error('fetchAmtrInspectionsByMember:', error.message); return [] }
  return (data ?? []) as AmtrInspection[]
}

export async function fetchAmtrInspection(id: string): Promise<AmtrInspection | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase.from('amtr_inspections').select('*').eq('id', id).single()
  if (error) { console.error('fetchAmtrInspection:', error.message); return null }
  return data as AmtrInspection
}

/** The most recent inspection per member at a base (for the unit roster view). */
export async function fetchLatestInspectionPerMember(baseId: string): Promise<Map<string, AmtrInspection>> {
  const rows = await fetchAmtrInspections(baseId) // already date-desc
  const latest = new Map<string, AmtrInspection>()
  for (const r of rows) if (!latest.has(r.member_id)) latest.set(r.member_id, r)
  return latest
}

function counts(items: InspectionItemResponse[]) {
  let yes = 0, no = 0, na = 0
  for (const it of items) {
    if (it.status === 'yes') yes++
    else if (it.status === 'no') no++
    else if (it.status === 'na') na++
  }
  return { yes_count: yes, no_count: no, na_count: na, gap_count: no }
}

export async function saveAmtrInspectionDraft(input: {
  id?: string; base_id: string; member_id: string; inspection_date: string
  items: InspectionItemResponse[]; notes?: string | null; created_by?: string | null
}): Promise<{ data: AmtrInspection | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const row: Record<string, unknown> = {
    ...(input.id ? { id: input.id } : {}),
    base_id: input.base_id, member_id: input.member_id, inspection_date: input.inspection_date,
    status: 'draft', items: input.items, notes: input.notes ?? null,
    ...counts(input.items), updated_at: new Date().toISOString(),
    ...(input.created_by ? { created_by: input.created_by } : {}),
  }
  const { data, error } = await supabase.from('amtr_inspections').upsert(row as never, { onConflict: 'id' }).select().single()
  if (error) { console.error('saveAmtrInspectionDraft:', error.message); return { data: null, error: friendlyError(error.message) } }
  return { data: data as AmtrInspection, error: null }
}

/** Mark an inspection completed and drop a 623A "Records Inspection" entry on the member. */
export async function completeAmtrInspection(input: {
  id: string; base_id: string; member_id: string; inspection_date: string
  items: InspectionItemResponse[]; notes?: string | null; completed_by?: string | null; completed_by_name?: string | null
}): Promise<{ data: AmtrInspection | null; error: string | null }> {
  const supabase = db()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const c = counts(input.items)

  // Auto-create the 623A entry documenting the inspection (checklist item 4.12).
  let created623aId: string | null = null
  const summary = `Monthly training records inspection completed${input.completed_by_name ? ` by ${input.completed_by_name}` : ''}. ${c.gap_count} gap(s) noted.`
  const { data: e623a } = await upsertAmtrRow('amtr_623a', {
    base_id: input.base_id, member_id: input.member_id, form_date: input.inspection_date,
    entry_type: 'Monthly Training Records Inspection', namt_comment: summary,
  })
  if (e623a?.id) created623aId = String(e623a.id)

  const row: Record<string, unknown> = {
    id: input.id, base_id: input.base_id, member_id: input.member_id, inspection_date: input.inspection_date,
    status: 'completed', items: input.items, notes: input.notes ?? null, ...c,
    completed_at: new Date().toISOString(), completed_by: input.completed_by ?? null,
    completed_by_name: input.completed_by_name ?? null, created_623a_id: created623aId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('amtr_inspections').upsert(row as never, { onConflict: 'id' }).select().single()
  if (error) { console.error('completeAmtrInspection:', error.message); return { data: null, error: friendlyError(error.message) } }
  return { data: data as AmtrInspection, error: null }
}

export async function reopenAmtrInspection(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('amtr_inspections')
    .update({ status: 'draft', completed_at: null, completed_by: null, completed_by_name: null, updated_at: new Date().toISOString() } as never)
    .eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}

export async function deleteAmtrInspection(id: string): Promise<{ error: string | null }> {
  const supabase = db()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('amtr_inspections').delete().eq('id', id)
  return { error: error ? friendlyError(error.message) : null }
}
