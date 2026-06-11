import { createClient } from './client'
import { friendlyError } from '@/lib/utils'
import { getTerm, type TermKey } from '@/lib/airport-mode'

export type DailyReviewSlot = 'day_amsl' | 'swing_amsl' | 'mid_amsl' | 'namo' | 'afm'

/** Each slot's TermKey for mode-aware label resolution via getTerm. */
const SLOT_TO_TERM: Record<DailyReviewSlot, TermKey> = {
  day_amsl:   'shift_day',
  swing_amsl: 'shift_swing',
  mid_amsl:   'shift_mid',
  namo:       'shift_supervisor',
  afm:        'shift_manager',
}

/**
 * Returns the mode-appropriate label for a daily-review slot.
 * USAF: 'Day Shift AMSL' / 'Swing Shift AMSL' / 'Mid Shift AMSL' / 'NAMO' / 'Airfield Manager'.
 * Civilian: 'Day Shift Lead' / 'Swing Shift Lead' / 'Mid Shift Lead' / 'Ops Supervisor' / 'Operations Manager'.
 */
export function getSlotLabel(slot: DailyReviewSlot, base: { airport_type?: 'usaf' | 'faa_part139' | null } | null | undefined): string {
  return getTerm(SLOT_TO_TERM[slot], base)
}

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

/**
 * Static USAF-default slot labels — kept for back-compat with any
 * caller that hasn't been wired through getSlotLabel(slot, base) yet.
 * Prefer getSlotLabel for new code so civilian Part 139 bases render
 * "Day Shift Lead" / "Operations Manager" etc.
 */
export const SLOT_LABELS: Record<DailyReviewSlot, string> = {
  day_amsl: 'Day Shift AMSL',
  swing_amsl: 'Swing Shift AMSL',
  mid_amsl: 'Mid Shift AMSL',
  namo: 'NAMO',
  afm: 'Airfield Manager',
}

/** Maps each signing slot to the permission key that gates it. */
export const SLOT_PERMISSION: Record<DailyReviewSlot, string> = {
  day_amsl: 'daily_reviews:sign:amsl',
  swing_amsl: 'daily_reviews:sign:amsl',
  mid_amsl: 'daily_reviews:sign:amsl',
  namo: 'daily_reviews:sign:namo',
  afm: 'daily_reviews:sign:afm',
}

export function canUserSignSlot(
  has: (key: string) => boolean,
  slot: DailyReviewSlot,
): boolean {
  return has(SLOT_PERMISSION[slot])
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

/** Compact signer label for tiles/tables: "Last (initials)" or "Last". */
export function signerCompact(s: SignerInfo): string {
  const last = (s.name || '').trim().split(/\s+/).slice(-1)[0] || 'Unknown'
  return s.operating_initials ? `${last} (${s.operating_initials})` : last
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

/**
 * Uncertified reviews older than `beforeDate` (exclusive), newest first.
 * A row exists only once ≥1 slot is signed, so `fully_certified_at IS NULL`
 * means "started but not certified". Fetches limit+1 so the caller can show
 * a "+N older" hint.
 */
export async function fetchOutstandingReviews(
  baseId: string,
  beforeDate: string,
  limit = 50,
): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('base_id', baseId)
    .is('fully_certified_at', null)
    .lt('review_date', beforeDate)
    .order('review_date', { ascending: false })
    .limit(limit + 1)
  if (error) { console.error('fetchOutstandingReviews:', error.message); return [] }
  return (data || []) as DailyReviewRow[]
}

/** All reviews with review_date within [startDate, endDate] inclusive, ascending. */
export async function fetchReviewsInRange(
  baseId: string,
  startDate: string,
  endDate: string,
): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('base_id', baseId)
    .gte('review_date', startDate)
    .lte('review_date', endDate)
    .order('review_date', { ascending: true })
  if (error) { console.error('fetchReviewsInRange:', error.message); return [] }
  return (data || []) as DailyReviewRow[]
}

/** Fetch-all for the records export: every daily review for a base, newest first. */
export async function fetchDailyReviewsForBase(baseId: string | null): Promise<DailyReviewRow[]> {
  const supabase = createClient()
  if (!supabase || !baseId) return []

  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('base_id', baseId)
    .order('review_date', { ascending: false })

  if (error) {
    console.error('fetchDailyReviewsForBase:', error.message)
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

  // Signing goes through the SECURITY DEFINER RPC sign_daily_review_slot
  // (migration 2026062013). The DB derives signed_by from auth.uid()
  // (never the client), enforces the per-slot permission, refuses to
  // overwrite another user's signature, and recomputes fully_certified_at
  // server-side. input.userId is no longer trusted for attribution — kept
  // in the signature for call-site compatibility but unused.
  // NOTE: sign_daily_review_slot isn't in the generated types.ts yet
  // (regen deferred — see project memory), so the rpc call is cast as any,
  // matching the route-handler convention for hand-maintained DB functions.
  const { data, error } = await (supabase as any).rpc('sign_daily_review_slot', {
    p_base_id: input.baseId,
    p_date: input.date,
    p_slot: input.slot,
    p_events_hash: input.eventsHash,
    p_notes: input.notes || null,
    p_shift_count: input.shiftCount,
  })

  if (error) return { data: null, error: friendlyError(error.message) }
  return { data: (data as DailyReviewRow) || null, error: null }
}
