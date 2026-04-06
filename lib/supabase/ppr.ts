import { createClient } from './client'
import { logActivity } from './activity'

function db() {
  const supabase = createClient()
  return supabase ? (supabase as any) : null
}

// ── Types ──

export type PprColumnType = 'text' | 'date' | 'time' | 'yes_no_na' | 'phone' | 'number' | 'email'

export const PPR_COLUMN_TYPES: { value: PprColumnType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'yes_no_na', label: 'Yes / No / N/A' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
]

export type PprColumn = {
  id: string
  base_id: string
  column_name: string
  column_type: PprColumnType
  sort_order: number
  is_required: boolean
  created_at: string
}

export type PprEntry = {
  id: string
  base_id: string
  ppr_number: string
  arrival_date: string
  column_values: Record<string, string>
  notes: string | null
  approver_oi: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

// ── PPR Number Generation ──

/** Get Julian day (1-366) from a date string (YYYY-MM-DD) */
function julianDay(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86400000)
}

/** Generate PPR number: {julian_day}-{sequence}-{OI} */
export function generatePprNumber(julDay: number, sequence: number, oi: string): string {
  const dayStr = String(julDay).padStart(3, '0')
  const seqStr = String(sequence).padStart(3, '0')
  return `${dayStr}-${seqStr}-${oi || 'XX'}`
}

// ── Columns CRUD ──

export async function fetchPprColumns(baseId: string): Promise<PprColumn[]> {
  const supabase = db()
  if (!supabase) return []

  const { data } = await supabase
    .from('ppr_columns')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })

  return (data || []) as PprColumn[]
}

export async function createPprColumn(input: {
  base_id: string
  column_name: string
  column_type?: PprColumnType
  sort_order?: number
  is_required?: boolean
}): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ppr_columns')
    .insert(input)
    .select()
    .single()

  if (error || !data) return null
  return data as PprColumn
}

export async function updatePprColumn(
  id: string,
  updates: Partial<Pick<PprColumn, 'column_name' | 'column_type' | 'sort_order' | 'is_required'>>,
): Promise<PprColumn | null> {
  const supabase = db()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('ppr_columns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null
  return data as PprColumn
}

export async function deletePprColumn(id: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('ppr_columns')
    .delete()
    .eq('id', id)

  return !error
}

// ── Entries CRUD ──

export async function fetchPprEntries(baseId: string, dateFrom?: string, dateTo?: string): Promise<PprEntry[]> {
  const supabase = db()
  if (!supabase) return []

  let query = supabase
    .from('ppr_entries')
    .select('*')
    .eq('base_id', baseId)
    .order('arrival_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (dateFrom) query = query.gte('arrival_date', dateFrom)
  if (dateTo) query = query.lte('arrival_date', dateTo)

  const { data } = await query
  return (data || []) as PprEntry[]
}

export async function fetchPprEntriesForDate(baseId: string, date: string): Promise<PprEntry[]> {
  return fetchPprEntries(baseId, date, date)
}

/** Count existing PPRs for a given base + arrival date (for sequence numbering) */
async function countPprsForDate(baseId: string, arrivalDate: string): Promise<number> {
  const supabase = db()
  if (!supabase) return 0

  const { count } = await supabase
    .from('ppr_entries')
    .select('id', { count: 'exact', head: true })
    .eq('base_id', baseId)
    .eq('arrival_date', arrivalDate)

  return count ?? 0
}

export async function createPprEntry(input: {
  base_id: string
  arrival_date: string
  column_values: Record<string, string>
  notes?: string
  approver_oi: string
}): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Generate PPR number
  const existingCount = await countPprsForDate(input.base_id, input.arrival_date)
  const julDay = julianDay(input.arrival_date)
  const pprNumber = generatePprNumber(julDay, existingCount + 1, input.approver_oi)

  const { data, error } = await supabase
    .from('ppr_entries')
    .insert({
      base_id: input.base_id,
      ppr_number: pprNumber,
      arrival_date: input.arrival_date,
      column_values: input.column_values,
      notes: input.notes || null,
      approver_oi: input.approver_oi,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (error || !data) return null

  const entry = data as PprEntry
  logActivity('created', 'ppr_entry', entry.id, `PPR ${entry.ppr_number}`, { details: `PPR ${entry.ppr_number} APPROVED FOR ${input.arrival_date}` }, input.base_id)
  return entry
}

export async function updatePprEntry(
  id: string,
  updates: Partial<Pick<PprEntry, 'column_values' | 'notes' | 'arrival_date'>>,
  baseId?: string,
): Promise<PprEntry | null> {
  const supabase = db()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('ppr_entries')
    .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return null

  const entry = data as PprEntry
  logActivity('updated', 'ppr_entry', entry.id, `PPR ${entry.ppr_number}`, undefined, baseId)
  return entry
}

export async function deletePprEntry(id: string, pprNumber?: string, baseId?: string): Promise<boolean> {
  const supabase = db()
  if (!supabase) return false

  const { error } = await supabase
    .from('ppr_entries')
    .delete()
    .eq('id', id)

  if (!error && pprNumber) {
    logActivity('deleted', 'ppr_entry', id, `PPR ${pprNumber}`, undefined, baseId)
  }
  return !error
}
