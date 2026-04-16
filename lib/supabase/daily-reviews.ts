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
 * to a UTC Date. Uses Intl.DateTimeFormat so the result is independent of the
 * host machine's local timezone (matters on Vercel/UTC vs developer machines).
 */
function zonedWallClockToUtc(
  y: number, m: number, d: number, hour: number, minute: number, timezone: string,
): Date {
  const candidate = new Date(Date.UTC(y, m - 1, d, hour, minute))
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = dtf.formatToParts(candidate)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const shownAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  const offsetMs = shownAsUtc - candidate.getTime()
  return new Date(candidate.getTime() - offsetMs)
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

/**
 * Which AMSL shift owns the given wall-clock hour in the base timezone.
 * - 3-shift bases: day 0600-1359, swing 1400-2159, mid 2200-0559
 * - 2-shift bases: day 0600-1759, swing 1800-0559
 */
export function currentAmslSlot(
  timezone: string | null | undefined,
  shiftCount: number,
  now: Date = new Date(),
): DailyReviewSlot {
  const tz = timezone || 'UTC'
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' })
  const hour = Number(dtf.formatToParts(now).find((p) => p.type === 'hour')?.value ?? 0)
  if (shiftCount === 3) {
    if (hour >= 6 && hour < 14) return 'day_amsl'
    if (hour >= 14 && hour < 22) return 'swing_amsl'
    return 'mid_amsl'
  }
  if (hour >= 6 && hour < 18) return 'day_amsl'
  return 'swing_amsl'
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

export async function fetchDailyReview(baseId: string, date: string): Promise<DailyReviewRow | null> {
  const supabase = createClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('daily_reviews')
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

export function formatSigner(s: SignerInfo): string {
  const parts = [s.rank, s.name].filter(Boolean)
  const primary = parts.length > 0 ? parts.join(' ') : 'Unknown'
  return s.operating_initials ? `${primary} (${s.operating_initials})` : primary
}

/** Batch-resolve signer profiles across multiple review rows — one Supabase round trip. */
export async function fetchSignersForRows(rows: DailyReviewRow[]): Promise<Map<string, SignerInfo>> {
  const out = new Map<string, SignerInfo>()
  const supabase = createClient()
  if (!supabase || rows.length === 0) return out

  const slots: DailyReviewSlot[] = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm']
  const ids = new Set<string>()
  for (const row of rows) {
    for (const slot of slots) {
      const id = row[`${slot}_signed_by` as keyof DailyReviewRow] as string | null
      if (id) ids.add(id)
    }
  }
  if (ids.size === 0) return out

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, rank, operating_initials')
    .in('id', Array.from(ids))

  if (error || !data) return out
  for (const p of data as unknown as SignerInfo[]) out.set(p.id, p)
  return out
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
  const { data, error } = await supabase
    .from('daily_reviews')
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
    const { data, error } = await supabase
      .from('daily_reviews')
      .update(slotCols)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return { data: null, error: friendlyError(error.message) }
    row = data as DailyReviewRow
  } else {
    const { data, error } = await supabase
      .from('daily_reviews')
      .insert({ base_id: input.baseId, review_date: input.date, ...slotCols })
      .select()
      .single()
    if (error) return { data: null, error: friendlyError(error.message) }
    row = data as DailyReviewRow
  }

  // Fire fully_certified_at once all required slots are filled
  if (row && !row.fully_certified_at && isFullyCertified(row, input.shiftCount)) {
    const { data: certified } = await supabase
      .from('daily_reviews')
      .update({ fully_certified_at: new Date().toISOString() })
      .eq('id', row.id)
      .select()
      .single()
    if (certified) row = certified as DailyReviewRow
  }

  return { data: row, error: null }
}
