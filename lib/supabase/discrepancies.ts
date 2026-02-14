import { createClient } from './client'
import type { Severity, DiscrepancyStatus } from './types'
import { calculateSLADeadline } from '@/lib/calculations/sla'

export type DiscrepancyRow = {
  id: string
  display_id: string
  type: string
  severity: Severity
  status: DiscrepancyStatus
  title: string
  description: string
  location_text: string
  latitude: number | null
  longitude: number | null
  assigned_shop: string | null
  assigned_to: string | null
  reported_by: string
  work_order_number: string | null
  sla_deadline: string | null
  linked_notam_id: string | null
  inspection_id: string | null
  resolution_notes: string | null
  resolution_date: string | null
  photo_count: number
  created_at: string
  updated_at: string
}

export async function fetchDiscrepancies(): Promise<DiscrepancyRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('discrepancies')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch discrepancies:', error.message)
    return []
  }

  return data as DiscrepancyRow[]
}

export async function fetchDiscrepancy(id: string): Promise<DiscrepancyRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('discrepancies')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Failed to fetch discrepancy:', error.message)
    return null
  }

  return data as DiscrepancyRow
}

export async function createDiscrepancy(input: {
  title: string
  description: string
  location_text: string
  type: string
  severity: string
  assigned_shop?: string
  latitude?: number | null
  longitude?: number | null
}): Promise<{ data: DiscrepancyRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  // Get the current user for reported_by; fallback for unauthenticated sessions
  let reported_by = 'anonymous'
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) reported_by = user.id
  } catch {
    // Continue with fallback
  }

  // Generate a display ID based on timestamp to avoid count query issues with RLS
  const now = new Date()
  const year = now.getFullYear()
  const ts = now.getTime().toString(36).slice(-4).toUpperCase()
  const display_id = `D-${year}-${ts}`

  // Calculate SLA deadline
  const sla_deadline = calculateSLADeadline(input.severity, now).toISOString()

  const status: DiscrepancyStatus = input.assigned_shop ? 'assigned' : 'open'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .insert({
      display_id,
      type: input.type,
      severity: input.severity,
      status,
      title: input.title,
      description: input.description,
      location_text: input.location_text,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      assigned_shop: input.assigned_shop || null,
      reported_by,
      sla_deadline,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create discrepancy:', error.message)
    return { data: null, error: error.message }
  }

  return { data: data as DiscrepancyRow, error: null }
}

export async function fetchDiscrepancyKPIs(): Promise<{
  open: number
  critical: number
  overdue: number
}> {
  const supabase = createClient()
  if (!supabase) return { open: 0, critical: 0, overdue: 0 }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('discrepancies')
    .select('severity, status, sla_deadline')
    .not('status', 'in', '("closed")')

  if (error) {
    console.error('Failed to fetch KPIs:', error.message)
    return { open: 0, critical: 0, overdue: 0 }
  }

  const rows = (data ?? []) as { severity: string; status: string; sla_deadline: string | null }[]
  const now = new Date()

  const open = rows.filter(r => !['resolved', 'closed'].includes(r.status)).length
  const critical = rows.filter(r => r.severity === 'critical' && !['resolved', 'closed'].includes(r.status)).length
  const overdue = rows.filter(r => {
    if (!r.sla_deadline || ['resolved', 'closed'].includes(r.status)) return false
    return now > new Date(r.sla_deadline)
  }).length

  return { open, critical, overdue }
}
