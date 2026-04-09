import { createClient } from './client'

// ── Types ──

export type FeedbackFormField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'rating' | 'yes_no' | 'dropdown'
  required: boolean
  options?: string[] // for dropdown type
}

export type FeedbackFormConfig = {
  enabled: boolean
  title: string
  description: string
  fields: FeedbackFormField[]
  show_name: boolean
  show_email: boolean
  show_organization: boolean
  show_overall_rating: boolean
  thank_you_message: string
}

export const DEFAULT_FEEDBACK_CONFIG: FeedbackFormConfig = {
  enabled: false,
  title: 'Airfield Operations Feedback',
  description: 'We value your feedback. Please take a moment to share your experience.',
  fields: [],
  show_name: true,
  show_email: true,
  show_organization: true,
  show_overall_rating: true,
  thank_you_message: 'Thank you for your feedback!',
}

export type CustomerFeedback = {
  id: string
  base_id: string
  name: string | null
  email: string | null
  organization: string | null
  overall_rating: number | null
  comments: string | null
  responses: Record<string, unknown>
  submitted_at: string
}

// ── Fetch feedback for a base ──

export async function fetchFeedback(baseId: string, options?: {
  limit?: number
  startDate?: string
  endDate?: string
}): Promise<CustomerFeedback[]> {
  const supabase = createClient()
  if (!supabase) return []

  let query = (supabase as any)
    .from('customer_feedback')
    .select('*')
    .eq('base_id', baseId)
    .order('submitted_at', { ascending: false })
    .limit(options?.limit || 100)

  if (options?.startDate) query = query.gte('submitted_at', options.startDate)
  if (options?.endDate) query = query.lte('submitted_at', options.endDate)

  const { data } = await query
  return (data || []) as CustomerFeedback[]
}

// ── Submit feedback (public — uses anon key) ──

export async function submitFeedback(input: {
  base_id: string
  name?: string | null
  email?: string | null
  organization?: string | null
  overall_rating?: number | null
  comments?: string | null
  responses?: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Not configured' }

  const { error } = await (supabase as any)
    .from('customer_feedback')
    .insert({
      base_id: input.base_id,
      name: input.name || null,
      email: input.email || null,
      organization: input.organization || null,
      overall_rating: input.overall_rating || null,
      comments: input.comments || null,
      responses: input.responses || {},
    })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Delete feedback entry ──

export async function deleteFeedback(id: string): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await (supabase as any)
    .from('customer_feedback')
    .delete()
    .eq('id', id)

  return !error
}

// ── Fetch form config from bases table ──

export async function fetchFeedbackConfig(baseId: string): Promise<FeedbackFormConfig> {
  const supabase = createClient()
  if (!supabase) return DEFAULT_FEEDBACK_CONFIG

  const { data } = await supabase
    .from('bases')
    .select('feedback_form_config')
    .eq('id', baseId)
    .single()

  const row = data as Record<string, unknown> | null
  if (row?.feedback_form_config && typeof row.feedback_form_config === 'object') {
    return { ...DEFAULT_FEEDBACK_CONFIG, ...(row.feedback_form_config as Partial<FeedbackFormConfig>) }
  }
  return DEFAULT_FEEDBACK_CONFIG
}

// ── Save form config ──

export async function saveFeedbackConfig(baseId: string, config: FeedbackFormConfig): Promise<boolean> {
  const supabase = createClient()
  if (!supabase) return false

  const { error } = await supabase
    .from('bases')
    .update({ feedback_form_config: config } as any)
    .eq('id', baseId)

  return !error
}

// ── Analytics helpers ──

export async function fetchFeedbackStats(baseId: string, days: number = 30): Promise<{
  total: number
  avgRating: number | null
  ratingCounts: Record<number, number>
  recentCount: number
}> {
  const supabase = createClient()
  if (!supabase) return { total: 0, avgRating: null, ratingCounts: {}, recentCount: 0 }

  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data } = await (supabase as any)
    .from('customer_feedback')
    .select('overall_rating, submitted_at')
    .eq('base_id', baseId)

  if (!data || data.length === 0) return { total: 0, avgRating: null, ratingCounts: {}, recentCount: 0 }

  const all = data as { overall_rating: number | null; submitted_at: string }[]
  const rated = all.filter(r => r.overall_rating != null)
  const avgRating = rated.length > 0
    ? rated.reduce((s, r) => s + (r.overall_rating || 0), 0) / rated.length
    : null

  const ratingCounts: Record<number, number> = {}
  for (const r of rated) {
    const v = r.overall_rating!
    ratingCounts[v] = (ratingCounts[v] || 0) + 1
  }

  const recentCount = all.filter(r => r.submitted_at >= since).length

  return { total: all.length, avgRating, ratingCounts, recentCount }
}
