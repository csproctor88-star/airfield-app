import { createClient } from './client'
import { logActivity } from './activity'
import type { QrcTemplate, QrcExecution, QrcStepResponse } from './types'

// --- Templates ---

export async function fetchQrcTemplates(baseId?: string | null): Promise<QrcTemplate[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data } = await supabase
    .from('qrc_templates')
    .select('*')
    .eq('base_id', baseId)
    .order('sort_order', { ascending: true })
    .order('qrc_number', { ascending: true })
  return (data || []) as QrcTemplate[]
}

export async function createQrcTemplate(input: {
  base_id: string
  qrc_number: number
  title: string
  notes?: string
  steps: unknown[]
  references?: string
  has_scn_form?: boolean
  scn_fields?: Record<string, unknown>
  sort_order?: number
}): Promise<{ data: QrcTemplate | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase
    .from('qrc_templates')
    .insert({
      base_id: input.base_id,
      qrc_number: input.qrc_number,
      title: input.title,
      notes: input.notes ?? null,
      steps: input.steps as any,
      references: input.references ?? null,
      has_scn_form: input.has_scn_form ?? false,
      scn_fields: input.scn_fields ?? null,
      sort_order: input.sort_order ?? input.qrc_number,
    } as any)
    .select()
    .single()
  if (error) return { data: null, error: error.message }
  return { data: data as QrcTemplate, error: null }
}

export async function updateQrcTemplate(
  id: string,
  updates: Partial<Pick<QrcTemplate, 'title' | 'notes' | 'steps' | 'references' | 'has_scn_form' | 'scn_fields' | 'is_active' | 'sort_order' | 'qrc_number'>>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('qrc_templates')
    .update({ ...updates, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
  return { error: error?.message || null }
}

export async function reviewQrcTemplate(
  id: string,
  reviewNotes?: string
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  let userId: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  } catch { /* */ }

  const { error } = await supabase
    .from('qrc_templates')
    .update({
      last_reviewed_at: new Date().toISOString(),
      last_reviewed_by: userId || null,
      review_notes: reviewNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', id)
  return { error: error?.message || null }
}

export async function deleteQrcTemplate(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase.from('qrc_templates').delete().eq('id', id)
  return { error: error?.message || null }
}

export async function seedQrcTemplates(baseId: string, selectedNumbers?: number[]): Promise<{ count: number; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { count: 0, error: 'Supabase not configured' }

  const { QRC_SEED_DATA } = await import('../qrc-seed-data')

  // Check existing
  const { data: existing } = await supabase
    .from('qrc_templates')
    .select('qrc_number')
    .eq('base_id', baseId)
  const existingNumbers = new Set((existing || []).map((t: { qrc_number: number }) => t.qrc_number))

  const toInsert = QRC_SEED_DATA
    .filter(q => !existingNumbers.has(q.qrc_number))
    .filter(q => !selectedNumbers || selectedNumbers.includes(q.qrc_number))
    .map(q => ({
    base_id: baseId,
    qrc_number: q.qrc_number,
    title: q.title,
    notes: q.notes ?? null,
    steps: q.steps as any,
    references: q.references ?? null,
    has_scn_form: q.has_scn_form ?? false,
    scn_fields: q.scn_fields ?? null,
    sort_order: q.qrc_number,
  }))

  if (toInsert.length === 0) return { count: 0, error: null }

  const { error } = await supabase.from('qrc_templates').insert(toInsert as any)
  if (error) return { count: 0, error: error.message }
  return { count: toInsert.length, error: null }
}

// --- Executions ---

export async function startQrcExecution(input: {
  base_id: string
  template_id: string
  qrc_number: number
  title: string
  initials?: string
}): Promise<{ data: QrcExecution | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  let userId: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  } catch { /* */ }

  const { data, error } = await supabase
    .from('qrc_executions')
    .insert({
      base_id: input.base_id,
      template_id: input.template_id,
      qrc_number: input.qrc_number,
      title: input.title,
      opened_by: userId || null,
      open_initials: input.initials || null,
    } as any)
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  const exec = data as QrcExecution
  // Log activity — use "SCN ACTIVATED" for emergency QRCs with SCN forms
  if (exec) {
    const { data: tmpl } = await supabase.from('qrc_templates').select('has_scn_form').eq('id', input.template_id).single()
    const isScn = tmpl?.has_scn_form === true
    const openDetail = isScn
      ? `SECONDARY CRASH NET ACTIVATED — QRC #${input.qrc_number} ${input.title.toUpperCase()}`
      : `QRC #${input.qrc_number} INITIATED — ${input.title.toUpperCase()}`
    await logActivity('opened', 'qrc', exec.id, `QRC-${input.qrc_number}`, { details: openDetail }, input.base_id)
  }

  return { data: exec, error: null }
}

export async function fetchOpenExecutions(baseId?: string | null): Promise<QrcExecution[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data } = await supabase
    .from('qrc_executions')
    .select('*')
    .eq('base_id', baseId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
  return (data || []) as QrcExecution[]
}

export async function fetchExecutionHistory(baseId?: string | null, limit = 50): Promise<QrcExecution[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []
  const { data } = await supabase
    .from('qrc_executions')
    .select('*')
    .eq('base_id', baseId)
    .order('opened_at', { ascending: false })
    .limit(limit)
  return (data || []) as QrcExecution[]
}

export async function fetchExecution(id: string): Promise<QrcExecution | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data } = await supabase
    .from('qrc_executions')
    .select('*')
    .eq('id', id)
    .single()
  return (data as QrcExecution) || null
}

export async function updateStepResponse(
  executionId: string,
  stepId: string,
  response: QrcStepResponse
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  // Fetch current step_responses, merge, update
  const { data: current } = await supabase
    .from('qrc_executions')
    .select('step_responses')
    .eq('id', executionId)
    .single()

  const responses = (current?.step_responses || {}) as Record<string, QrcStepResponse>
  responses[stepId] = response

  const { error } = await supabase
    .from('qrc_executions')
    .update({ step_responses: responses, updated_at: new Date().toISOString() } as any)
    .eq('id', executionId)

  return { error: error?.message || null }
}

export async function updateScnData(
  executionId: string,
  scnData: Record<string, unknown>
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('qrc_executions')
    .update({ scn_data: scnData, updated_at: new Date().toISOString() } as any)
    .eq('id', executionId)
  return { error: error?.message || null }
}

export async function closeQrcExecution(
  executionId: string,
  initials?: string,
  baseId?: string | null
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  let userId: string | undefined
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  } catch { /* */ }

  const { data, error } = await supabase
    .from('qrc_executions')
    .update({
      status: 'closed',
      closed_by: userId || null,
      closed_at: new Date().toISOString(),
      close_initials: initials || null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', executionId)
    .select('qrc_number, title, scn_data, template_id')
    .single()

  if (error) return { error: error.message }

  if (data) {
    // Fetch template to check if SCN form and get field labels
    const { data: tmpl } = data.template_id
      ? await supabase.from('qrc_templates').select('has_scn_form, scn_fields').eq('id', data.template_id).single()
      : { data: null }
    const isScn = tmpl?.has_scn_form === true

    let detailStr = isScn
      ? `SECONDARY CRASH NET ACTIVATED — QRC #${data.qrc_number} ${data.title.toUpperCase()}`
      : `QRC #${data.qrc_number} COMPLETED — ${data.title.toUpperCase()}`

    // Append fillable field values if present
    const scnData = (data.scn_data || {}) as Record<string, unknown>
    const filledEntries = Object.entries(scnData).filter(([, v]) => v != null && v !== '')
    if (filledEntries.length > 0 && tmpl?.scn_fields) {
      const fields = ((tmpl.scn_fields as { fields?: { key: string; label: string }[] }).fields) || []
      const labelMap = Object.fromEntries(fields.map(f => [f.key, f.label]))
      const parts = filledEntries.map(([key, val]) => {
        const label = labelMap[key] || key.toUpperCase()
        return `${label.toUpperCase()}: ${String(val).toUpperCase()}`
      })
      detailStr += `. ${parts.join('; ')}`
    }

    await logActivity('closed', 'qrc', executionId, `QRC-${data.qrc_number}`, { details: detailStr }, baseId)
  }

  return { error: null }
}

export async function reopenQrcExecution(executionId: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }
  const { error } = await supabase
    .from('qrc_executions')
    .update({
      status: 'open',
      closed_by: null,
      closed_at: null,
      close_initials: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', executionId)
  return { error: error?.message || null }
}

export async function cancelQrcExecution(
  executionId: string,
  baseId?: string | null
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('qrc_executions')
    .delete()
    .eq('id', executionId)

  if (error) return { error: error.message }

  // Delete all activity log entries for this QRC execution
  await supabase
    .from('activity_log')
    .delete()
    .eq('entity_id', executionId)

  return { error: null }
}
