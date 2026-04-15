import { createClient } from './client'
import { friendlyError } from '@/lib/utils'

export type DailyReviewSlot = 'day_amsl' | 'swing_amsl' | 'mid_amsl' | 'namo' | 'afm'

export interface DailyReviewRow {
  id: string
  base_id: string
  review_date: string

  day_amsl_signed_by: string | null
  day_amsl_signed_at: string | null
  day_amsl_notes: string | null
  day_amsl_events_hash: string | null

  swing_amsl_signed_by: string | null
  swing_amsl_signed_at: string | null
  swing_amsl_notes: string | null
  swing_amsl_events_hash: string | null

  mid_amsl_signed_by: string | null
  mid_amsl_signed_at: string | null
  mid_amsl_notes: string | null
  mid_amsl_events_hash: string | null

  namo_signed_by: string | null
  namo_signed_at: string | null
  namo_notes: string | null
  namo_events_hash: string | null

  afm_signed_by: string | null
  afm_signed_at: string | null
  afm_notes: string | null
  afm_events_hash: string | null

  fully_certified_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Returns the effective review date for a base right now, honoring its
 * timezone + daily reset time. Before the reset hour the "today" review
 * is still yesterday's — matches the shift-checklist / inspection behavior.
 */
export function getEffectiveReviewDate(timezone?: string | null, resetTime?: string | null): string {
  const tz = timezone || 'UTC'
  const rt = resetTime || '06:00'
  const now = new Date()
  // Wall-clock now in the base timezone
  const local = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const [rh, rm] = rt.split(':').map(Number)
  const resetMinutes = (rh || 6) * 60 + (rm || 0)
  const currentMinutes = local.getHours() * 60 + local.getMinutes()
  if (currentMinutes < resetMinutes) local.setDate(local.getDate() - 1)
  const y = local.getFullYear()
  const m = String(local.getMonth() + 1).padStart(2, '0')
  const d = String(local.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Convert a wall-clock (year/month/day/hour/minute) in the given IANA timezone
 * to a UTC Date. Approximates DST transitions (rare edge cases near the 2 AM
 * switch may be off by an hour; acceptable for review windows that use 06:00L).
 */
function zonedWallClockToUtc(
  y: number, m: number, d: number, hour: number, minute: number, timezone: string,
): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute))
  const shownInTz = new Date(guess.toLocaleString('en-US', { timeZone: timezone }))
  const offsetMs = guess.getTime() - shownInTz.getTime()
  return new Date(guess.getTime() + offsetMs)
}

/**
 * Compute the UTC time window for a review_date given the base's timezone
 * and reset time. Window is [reviewDate + resetTime localtime, next day +
 * resetTime localtime).
 */
export function getReviewWindowUtc(
  reviewDate: string,
  timezone?: string | null,
  resetTime?: string | null,
): { startIso: string; endIso: string } {
  const tz = timezone || 'UTC'
  const rt = resetTime || '06:00'
  const [y, m, d] = reviewDate.split('-').map(Number)
  const [rh, rmin] = rt.split(':').map(Number)
  const start = zonedWallClockToUtc(y, m, d, rh ?? 6, rmin ?? 0, tz)
  const end = zonedWallClockToUtc(y, m, d + 1, rh ?? 6, rmin ?? 0, tz)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function requiredSlotsForShifts(shiftCount: number): DailyReviewSlot[] {
  const amsls: DailyReviewSlot[] = shiftCount === 3
    ? ['day_amsl', 'swing_amsl', 'mid_amsl']
    : ['day_amsl', 'swing_amsl']
  return [...amsls, 'namo', 'afm']
}

export function isFullyCertified(row: DailyReviewRow, shiftCount: number): boolean {
  return requiredSlotsForShifts(shiftCount).every((slot) => row[`${slot}_signed_at` as keyof DailyReviewRow])
}

export const SLOT_LABELS: Record<DailyReviewSlot, string> = {
  day_amsl: 'Day Shift AMSL',
  swing_amsl: 'Swing Shift AMSL',
  mid_amsl: 'Mid Shift AMSL',
  namo: 'NAMO',
  afm: 'Airfield Manager',
}

/** Which roles can sign which slots. */
export const SLOT_ALLOWED_ROLES: Record<DailyReviewSlot, string[]> = {
  day_amsl: ['amops', 'airfield_manager', 'namo', 'base_admin', 'sys_admin'],
  swing_amsl: ['amops', 'airfield_manager', 'namo', 'base_admin', 'sys_admin'],
  mid_amsl: ['amops', 'airfield_manager', 'namo', 'base_admin', 'sys_admin'],
  namo: ['namo', 'airfield_manager', 'base_admin', 'sys_admin'],
  afm: ['airfield_manager', 'base_admin', 'sys_admin'],
}

export function canUserSignSlot(userRole: string | null, slot: DailyReviewSlot): boolean {
  if (!userRole) return false
  return SLOT_ALLOWED_ROLES[slot].includes(userRole)
}

/** Short deterministic hash of the entity IDs visible in the review. */
export async function computeEventsHash(ids: string[]): Promise<string> {
  const payload = [...ids].sort().join('|')
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
    return Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 0
  for (let i = 0; i < payload.length; i++) h = (h * 31 + payload.charCodeAt(i)) | 0
  return (h >>> 0).toString(16).padStart(8, '0')
}

// daily_reviews is not (yet) in the generated Supabase types, so cast the builder.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dr = (client: ReturnType<typeof createClient>) => (client as any).from('daily_reviews')

export async function fetchDailyReview(baseId: string, date: string): Promise<DailyReviewRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await dr(supabase)
    .select('*')
    .eq('base_id', baseId)
    .eq('review_date', date)
    .maybeSingle()

  if (error) {
    console.error('fetchDailyReview:', error.message)
    return null
  }
  return data as DailyReviewRow | null
}

export interface SignerInfo {
  id: string
  name: string | null
  rank: string | null
  operating_initials: string | null
}

/**
 * Resolve the signer profile for each signed slot on a daily review row.
 * Returns a map keyed by slot; slots with no signer are omitted.
 */
export async function fetchDailyReviewSigners(row: DailyReviewRow): Promise<Partial<Record<DailyReviewSlot, SignerInfo>>> {
  const supabase = createClient()
  if (!supabase) return {}

  const slots: DailyReviewSlot[] = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm']
  const ids = new Set<string>()
  for (const slot of slots) {
    const id = row[`${slot}_signed_by` as keyof DailyReviewRow] as string | null
    if (id) ids.add(id)
  }
  if (ids.size === 0) return {}

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials')
    .in('id', Array.from(ids))

  if (error || !data) return {}

  const byId = new Map<string, SignerInfo>()
  for (const p of data as unknown as SignerInfo[]) byId.set(p.id, p)

  const out: Partial<Record<DailyReviewSlot, SignerInfo>> = {}
  for (const slot of slots) {
    const id = row[`${slot}_signed_by` as keyof DailyReviewRow] as string | null
    if (id && byId.has(id)) out[slot] = byId.get(id)!
  }
  return out
}

export async function fetchRecentReviews(baseId: string, days = 14): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []

  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const { data, error } = await dr(supabase)
    .select('*')
    .eq('base_id', baseId)
    .gte('review_date', cutoff)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('fetchRecentReviews:', error.message)
    return []
  }
  return (data || []) as DailyReviewRow[]
}

export async function signDailyReview(input: {
  baseId: string
  date: string
  slot: DailyReviewSlot
  userId: string
  eventsHash: string
  notes?: string | null
  shiftCount: number
}): Promise<{ data: DailyReviewRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const existing = await fetchDailyReview(input.baseId, input.date)

  const slotCols: Record<string, string | null> = {
    [`${input.slot}_signed_by`]: input.userId,
    [`${input.slot}_signed_at`]: new Date().toISOString(),
    [`${input.slot}_notes`]: input.notes || null,
    [`${input.slot}_events_hash`]: input.eventsHash,
    updated_at: new Date().toISOString(),
  }

  let row: DailyReviewRow | null = null

  if (existing) {
    const { data, error } = await dr(supabase)
      .update(slotCols)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return { data: null, error: friendlyError(error.message) }
    row = data as DailyReviewRow
  } else {
    const { data, error } = await dr(supabase)
      .insert({ base_id: input.baseId, review_date: input.date, ...slotCols })
      .select()
      .single()
    if (error) return { data: null, error: friendlyError(error.message) }
    row = data as DailyReviewRow
  }

  // Fire fully_certified_at once all required slots are filled
  if (row && !row.fully_certified_at && isFullyCertified(row, input.shiftCount)) {
    const { data: certified } = await dr(supabase)
      .update({ fully_certified_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single()
    if (certified) row = certified as DailyReviewRow
  }

  return { data: row, error: null }
}
