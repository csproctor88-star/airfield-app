import { createClient } from '@/lib/supabase/client'
import { PERM } from '@/lib/permissions'
import {
  formatSigner,
  getSlotLabel,
  type DailyReviewSlot,
  type SignerInfo,
  type SlotLabelSource,
} from '@/lib/supabase/daily-reviews'

// ── NAMO/NAMT Report Tool — data module ─────────────────────
// Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
// Per-user activity counts (users × domains matrix) across nine domains.
// Fan-out mirrors lib/reports/analytics-data.ts; batched profile lookup
// mirrors fetchSignersForRows (lib/supabase/daily-reviews.ts).

export type UserActivityDomain =
  | 'wildlife_sightings' | 'wildlife_strikes' | 'checks' | 'inspections'
  | 'discrepancies' | 'qrc_opened' | 'qrc_closed' | 'daily_review_signoffs' | 'ppr'

export interface DomainDef {
  key: UserActivityDomain
  label: string
  viewPerm: string
  /** ISO date per-user (uuid) attribution begins; null = full history, no footnote. */
  coverageStart: string | null
}

// Coverage constants confirmed against supabase/migrations/ (2026-07-17):
// - wildlife_sightings / wildlife_strikes: observed_by_id / reported_by_id are
//   original to 2026031400_create_wildlife_tables.sql (module launch) → null.
// - checks: uuid attribution rides saved_by_id (added 2026030300_add_check_draft_data.sql)
//   via the deterministic same-row copy in 2026071741_checks_completed_by_id.sql
//   → '2026-03-03'. Rows completed before that fall back to completed_by free text.
// - inspections: inspector_id predates the migration tracker (original NOT NULL
//   column; 2026021701 only dropped NOT NULL) and 2026022200 backfilled
//   completed_by_id from it → full history → null.
// - discrepancies: reported_by has no ALTER adding it anywhere in migrations —
//   original to the pre-tracker table → null.
// - qrc_opened / qrc_closed: opened_by / closed_by original to
//   2026030700_create_qrc_module.sql → null.
// - daily_review_signoffs: *_signed_by original to 2026041302_daily_reviews.sql → null.
// - ppr: created_by original to 2026040602_ppr_tables.sql → null.
export const USER_ACTIVITY_DOMAINS: DomainDef[] = [
  { key: 'wildlife_sightings',    label: 'Wildlife Sightings',      viewPerm: PERM.WILDLIFE_VIEW,      coverageStart: null },
  { key: 'wildlife_strikes',      label: 'Wildlife Strikes',        viewPerm: PERM.WILDLIFE_VIEW,      coverageStart: null },
  { key: 'checks',                label: 'Airfield Checks',         viewPerm: PERM.CHECKS_VIEW,        coverageStart: '2026-03-03' },
  { key: 'inspections',           label: 'Inspections',             viewPerm: PERM.INSPECTIONS_VIEW,   coverageStart: null },
  { key: 'discrepancies',         label: 'Discrepancies Reported',  viewPerm: PERM.DISCREPANCIES_VIEW, coverageStart: null },
  { key: 'qrc_opened',            label: 'QRCs Initiated',          viewPerm: PERM.QRC_VIEW,           coverageStart: null },
  { key: 'qrc_closed',            label: 'QRCs Completed',          viewPerm: PERM.QRC_VIEW,           coverageStart: null },
  { key: 'daily_review_signoffs', label: 'Daily Review Sign-offs',  viewPerm: PERM.DAILY_REVIEWS_VIEW, coverageStart: null },
  { key: 'ppr',                   label: 'PPR Entries',             viewPerm: PERM.PPR_VIEW,           coverageStart: null },
]

const ALL_DOMAIN_KEYS: UserActivityDomain[] = USER_ACTIVITY_DOMAINS.map((d) => d.key)
const DOMAIN_BY_KEY = new Map<UserActivityDomain, DomainDef>(
  USER_ACTIVITY_DOMAINS.map((d) => [d.key, d]),
)

/** Kiosk/service roles excluded from zero-activity injection (profiles.role, authoritative). */
export const ZERO_ACTIVITY_EXCLUDED_ROLES: readonly string[] =
  ['airfield_status', 'atc', 'ppr', 'read_only']

export interface ActivityRecordRef { id: string; label: string; ts: string; href: string | null }

/** One in-range record occurrence, normalized across domains during the fan-out. */
export interface RawDomainRow {
  domain: UserActivityDomain
  id: string
  /** uuid actor column value (grouping precedence 1). */
  actorId: string | null
  /** free-text actor fallback (grouping precedence 2, only when actorId is null). */
  actorName: string | null
  ts: string
  label: string
  href: string | null
}

export interface UserActivityRow {
  kind: 'profile' | 'unlinked' | 'unattributed'
  key: string                         // profile id | normalized name | 'unattributed'
  display: string
  counts: Record<UserActivityDomain, number>
  total: number
  records: Partial<Record<UserActivityDomain, ActivityRecordRef[]>>
}

export interface UserActivityData {
  rows: UserActivityRow[]
  totals: Record<UserActivityDomain, number>
  coverageNotes: { domain: UserActivityDomain; coverageStart: string; affected: number }[]
  /**
   * Set when the zero-activity (base_members) lookup failed. The report still
   * renders — the matrix simply omits any all-zero rows, since we couldn't
   * confirm base membership — but the caller should surface a subtle notice
   * rather than treat this as the all-or-nothing throw contract below.
   */
  zeroActivityUnavailable?: boolean
}

/** Base member candidate for zero-activity injection (role from profiles, authoritative). */
export interface ZeroActivityMember extends SignerInfo { role: string }

function zeroCounts(): Record<UserActivityDomain, number> {
  const out = {} as Record<UserActivityDomain, number>
  for (const k of ALL_DOMAIN_KEYS) out[k] = 0
  return out
}

function emptyData(): UserActivityData {
  return { rows: [], totals: zeroCounts(), coverageNotes: [] }
}

// ── Grouping ────────────────────────────────────────────────

/**
 * Grouping precedence (spec §Design step 2): uuid wins → profile bucket
 * (resolved later; orphaned uuids fold into the unattributed row as
 * "Former user"); uuid null + non-empty free text → unlinked bucket keyed on
 * the normalized name; else unattributed.
 */
export function actorKeyFor(uuid: string | null, name: string | null):
  { kind: 'profile' | 'unlinked' | 'unattributed'; key: string } {
  if (uuid) return { kind: 'profile', key: uuid }
  const trimmed = (name ?? '').trim()
  if (trimmed) return { kind: 'unlinked', key: trimmed.toLowerCase() }
  return { kind: 'unattributed', key: 'unattributed' }
}

/**
 * Pure matrix builder. `rangeStartIso` (the fetch range start) enables coverage
 * footnotes: a note is emitted iff the range starts before a domain's
 * coverageStart AND ≥1 in-range record in that domain lacks uuid attribution.
 */
export function buildActivityMatrix(
  raw: RawDomainRow[],
  profiles: Map<string, SignerInfo>,
  domains: UserActivityDomain[],
  rangeStartIso?: string,
): UserActivityData {
  const rows = new Map<string, UserActivityRow>()
  let orphanUuidSeen = false

  const rowFor = (mapKey: string, init: () => UserActivityRow): UserActivityRow => {
    let row = rows.get(mapKey)
    if (!row) {
      row = init()
      rows.set(mapKey, row)
    }
    return row
  }

  const totals = zeroCounts()
  const unattributedByDomain = new Map<UserActivityDomain, number>()

  for (const r of raw) {
    const grouped = actorKeyFor(r.actorId, r.actorName)
    let row: UserActivityRow

    if (grouped.kind === 'profile') {
      const profile = profiles.get(grouped.key)
      if (profile) {
        row = rowFor(`profile:${grouped.key}`, () => ({
          kind: 'profile',
          key: grouped.key,
          display: formatSigner(profile),
          counts: zeroCounts(),
          total: 0,
          records: {},
        }))
      } else {
        // uuid with no surviving profile → the single unattributed row,
        // labeled "Former user" (spec §Design step 2).
        orphanUuidSeen = true
        row = rowFor('unattributed', () => ({
          kind: 'unattributed',
          key: 'unattributed',
          display: 'Unattributed',
          counts: zeroCounts(),
          total: 0,
          records: {},
        }))
      }
    } else if (grouped.kind === 'unlinked') {
      const verbatim = (r.actorName ?? '').trim()
      row = rowFor(`unlinked:${grouped.key}`, () => ({
        kind: 'unlinked',
        key: grouped.key,
        display: verbatim,       // rendered verbatim (first-seen spelling)
        counts: zeroCounts(),
        total: 0,
        records: {},
      }))
    } else {
      row = rowFor('unattributed', () => ({
        kind: 'unattributed',
        key: 'unattributed',
        display: 'Unattributed',
        counts: zeroCounts(),
        total: 0,
        records: {},
      }))
    }

    row.counts[r.domain] += 1
    row.total += 1
    totals[r.domain] += 1
    if (!row.records[r.domain]) row.records[r.domain] = []
    row.records[r.domain]!.push({ id: r.id, label: r.label, ts: r.ts, href: r.href })

    // Coverage accounting: records lacking uuid attribution entirely.
    if (r.actorId === null) {
      unattributedByDomain.set(r.domain, (unattributedByDomain.get(r.domain) ?? 0) + 1)
    }
  }

  const unattributedRow = rows.get('unattributed')
  if (unattributedRow && orphanUuidSeen) unattributedRow.display = 'Former user'

  const sorted = Array.from(rows.values()).sort(
    (a, b) => b.total - a.total || a.display.localeCompare(b.display),
  )

  // Coverage footnotes: iff rangeStart < coverageStart AND affected > 0.
  const coverageNotes: UserActivityData['coverageNotes'] = []
  if (rangeStartIso) {
    const rangeStartDay = rangeStartIso.slice(0, 10)
    for (const domain of domains) {
      const def = DOMAIN_BY_KEY.get(domain)
      if (!def?.coverageStart) continue
      if (rangeStartDay >= def.coverageStart) continue
      const affected = unattributedByDomain.get(domain) ?? 0
      if (affected > 0) {
        coverageNotes.push({ domain, coverageStart: def.coverageStart, affected })
      }
    }
  }

  return { rows: sorted, totals, coverageNotes }
}

/**
 * Pure zero-activity injection (opt-in): appends an all-zero row for each
 * active base member not already present, excluding kiosk/service roles.
 * Totals are unchanged; rows re-sorted (total desc, then name asc).
 */
export function injectZeroActivityRows(
  data: UserActivityData,
  members: ZeroActivityMember[],
): UserActivityData {
  const present = new Set(
    data.rows.filter((r) => r.kind === 'profile').map((r) => r.key),
  )
  const injected: UserActivityRow[] = []
  for (const m of members) {
    if (ZERO_ACTIVITY_EXCLUDED_ROLES.includes(m.role)) continue
    if (present.has(m.id)) continue
    present.add(m.id)
    injected.push({
      kind: 'profile',
      key: m.id,
      display: formatSigner(m),
      counts: zeroCounts(),
      total: 0,
      records: {},
    })
  }
  if (injected.length === 0) return data
  const rows = [...data.rows, ...injected].sort(
    (a, b) => b.total - a.total || a.display.localeCompare(b.display),
  )
  return { ...data, rows }
}

// ── Query plans (pure, exported for date-semantics tests) ───

export interface DomainQueryPlan {
  table: string
  select: string
  dateColumn: string
  /** DATE columns filter on local-day strings; timestamptz on UTC boundaries. */
  dateKind: 'timestamptz' | 'date'
  gte: string
  lte: string
  status?: { column: string; value: string }
}

export function buildDomainQueryPlan(
  domain: UserActivityDomain,
  startIso: string,
  endIso: string,
): DomainQueryPlan {
  const startDay = startIso.slice(0, 10)
  const endDay = endIso.slice(0, 10)
  switch (domain) {
    case 'wildlife_sightings':
      return {
        table: 'wildlife_sightings',
        select: 'id, observed_by_id, observed_by, observed_at, species_common',
        dateColumn: 'observed_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
      }
    case 'wildlife_strikes':
      // strike_date is a DATE column — day-string comparison (analytics-data.ts:340-341).
      return {
        table: 'wildlife_strikes',
        select: 'id, reported_by_id, reported_by, strike_date, species_common',
        dateColumn: 'strike_date', dateKind: 'date', gte: startDay, lte: endDay,
      }
    case 'checks':
      return {
        table: 'airfield_checks',
        select: 'id, completed_by_id, completed_by, completed_at, display_id',
        dateColumn: 'completed_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
        status: { column: 'status', value: 'completed' },
      }
    case 'inspections':
      return {
        table: 'inspections',
        select: 'id, completed_by_id, completed_by_name, completed_at, display_id',
        dateColumn: 'completed_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
        status: { column: 'status', value: 'completed' },
      }
    case 'discrepancies':
      return {
        table: 'discrepancies',
        select: 'id, reported_by, created_at, display_id',
        dateColumn: 'created_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
      }
    case 'qrc_opened':
      return {
        table: 'qrc_executions',
        select: 'id, opened_by, opened_at, qrc_number, title, label',
        dateColumn: 'opened_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
      }
    case 'qrc_closed':
      // Separate domain on its own timestamp: a QRC opened before the range but
      // closed inside it counts only as a completion.
      return {
        table: 'qrc_executions',
        select: 'id, closed_by, closed_at, qrc_number, title, label',
        dateColumn: 'closed_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
        status: { column: 'status', value: 'closed' },
      }
    case 'daily_review_signoffs':
      // review_date is a DATE column — day-string comparison.
      return {
        table: 'daily_reviews',
        select: [
          'id', 'review_date',
          'day_amsl_signed_by', 'day_amsl_signed_at',
          'swing_amsl_signed_by', 'swing_amsl_signed_at',
          'mid_amsl_signed_by', 'mid_amsl_signed_at',
          'namo_signed_by', 'namo_signed_at',
          'afm_signed_by', 'afm_signed_at',
        ].join(', '),
        dateColumn: 'review_date', dateKind: 'date', gte: startDay, lte: endDay,
      }
    case 'ppr':
      return {
        table: 'ppr_entries',
        select: 'id, created_by, created_at, ppr_number',
        dateColumn: 'created_at', dateKind: 'timestamptz', gte: startIso, lte: endIso,
      }
  }
}

// ── Row mapping ─────────────────────────────────────────────

const DAILY_REVIEW_SLOTS: DailyReviewSlot[] = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm']

export interface DailyReviewSignoffSource {
  id: string
  review_date: string
  day_amsl_signed_by: string | null
  day_amsl_signed_at: string | null
  swing_amsl_signed_by: string | null
  swing_amsl_signed_at: string | null
  mid_amsl_signed_by: string | null
  mid_amsl_signed_at: string | null
  namo_signed_by: string | null
  namo_signed_at: string | null
  afm_signed_by: string | null
  afm_signed_at: string | null
}

/**
 * Five-slot fan-out: one raw row per non-null `*_signed_by` slot.
 * `base` threads through to `getSlotLabel` so civilian Part 139 bases get
 * their mode-appropriate slot labels (e.g. "Day Shift Lead" / "Ops
 * Supervisor") instead of the USAF default; omit/null for the USAF default.
 */
export function expandDailyReviewRows(
  rows: DailyReviewSignoffSource[],
  base?: SlotLabelSource | null,
): RawDomainRow[] {
  const out: RawDomainRow[] = []
  for (const row of rows) {
    for (const slot of DAILY_REVIEW_SLOTS) {
      const signedBy = row[`${slot}_signed_by` as keyof DailyReviewSignoffSource] as string | null
      if (!signedBy) continue
      const signedAt = row[`${slot}_signed_at` as keyof DailyReviewSignoffSource] as string | null
      out.push({
        domain: 'daily_review_signoffs',
        id: `${row.id}:${slot}`,
        actorId: signedBy,
        actorName: null,
        ts: signedAt ?? row.review_date,
        label: `Daily review ${row.review_date} — ${getSlotLabel(slot, base)}`,
        href: null,
      })
    }
  }
  return out
}

type Db = Record<string, unknown>
const s = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)

function mapDomainRows(domain: UserActivityDomain, data: Db[], base?: SlotLabelSource | null): RawDomainRow[] {
  switch (domain) {
    case 'wildlife_sightings':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.observed_by_id), actorName: s(r.observed_by),
        ts: String(r.observed_at),
        label: s(r.species_common) ?? 'Wildlife sighting', href: null,
      }))
    case 'wildlife_strikes':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.reported_by_id), actorName: s(r.reported_by),
        ts: String(r.strike_date),
        label: s(r.species_common) ?? 'Wildlife strike', href: null,
      }))
    case 'checks':
      return data.map((r) => ({
        domain, id: String(r.id),
        // Pre-backfill rows have null completed_by_id → free-text fallback.
        actorId: s(r.completed_by_id), actorName: s(r.completed_by),
        ts: String(r.completed_at),
        label: s(r.display_id) ?? 'Check', href: `/checks/${r.id}`,
      }))
    case 'inspections':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.completed_by_id), actorName: s(r.completed_by_name),
        ts: String(r.completed_at),
        label: s(r.display_id) ?? 'Inspection', href: `/inspections/${r.id}`,
      }))
    case 'discrepancies':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.reported_by), actorName: null,
        ts: String(r.created_at),
        label: s(r.display_id) ?? 'Discrepancy', href: `/discrepancies/${r.id}`,
      }))
    case 'qrc_opened':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.opened_by), actorName: null,
        ts: String(r.opened_at),
        label: `QRC ${r.qrc_number} — ${s(r.label) ?? s(r.title) ?? 'Execution'}`, href: null,
      }))
    case 'qrc_closed':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.closed_by), actorName: null,
        ts: String(r.closed_at),
        label: `QRC ${r.qrc_number} — ${s(r.label) ?? s(r.title) ?? 'Execution'}`, href: null,
      }))
    case 'daily_review_signoffs':
      return expandDailyReviewRows(data as unknown as DailyReviewSignoffSource[], base)
    case 'ppr':
      return data.map((r) => ({
        domain, id: String(r.id),
        actorId: s(r.created_by), actorName: null,
        ts: String(r.created_at),
        label: s(r.ppr_number) ?? 'PPR', href: null,
      }))
  }
}

// ── Fetch fan-out ───────────────────────────────────────────

async function fetchDomainRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  baseId: string,
  domain: UserActivityDomain,
  startIso: string,
  endIso: string,
  base?: SlotLabelSource | null,
): Promise<RawDomainRow[]> {
  const plan = buildDomainQueryPlan(domain, startIso, endIso)
  let query = supabase
    .from(plan.table)
    .select(plan.select)
    .eq('base_id', baseId)
    .gte(plan.dateColumn, plan.gte)
    .lte(plan.dateColumn, plan.lte)
    .order(plan.dateColumn, { ascending: true })
  if (plan.status) query = query.eq(plan.status.column, plan.status.value)
  const { data, error } = await query
  if (error) throw new Error(`User activity fetch failed (${domain}): ${error.message}`)
  return mapDomainRows(domain, (data ?? []) as Db[], base)
}

/**
 * Fetch + aggregate per-user activity for the selected domains.
 * Promise.all fan-out per domain (mirrors analytics-data.ts), then ONE batched
 * profiles lookup covering actor uuids + zero-activity members (mirrors
 * fetchSignersForRows). Domain/profile query errors throw — a leadership
 * report must never silently render zeros. The base_members lookup (used
 * only for the zero-activity opt-in) is the one exception: it degrades
 * gracefully (see below) rather than aborting an otherwise-successful report.
 */
export async function fetchUserActivityData(
  baseId: string,
  startIso: string,
  endIso: string,
  domains: UserActivityDomain[],
  opts?: {
    includeZeroActivity?: boolean
    /** Base config for civilian-aware daily-review slot labels; omit/null = USAF default. */
    base?: SlotLabelSource | null
  },
): Promise<UserActivityData> {
  const supabase = createClient()
  if (!supabase || !baseId || domains.length === 0) return emptyData()

  const rawArrays = await Promise.all(
    domains.map((d) => fetchDomainRows(supabase, baseId, d, startIso, endIso, opts?.base)),
  )
  const raw: RawDomainRow[] = ([] as RawDomainRow[]).concat(...rawArrays)

  // Zero-activity candidates: base members (membership), roles from profiles
  // (authoritative — base_members.role is legacy/stale). A failure here is
  // NOT fatal: the report is still useful without the zero-activity rows, so
  // we note it (zeroActivityUnavailable) instead of throwing.
  let memberIds: string[] = []
  let zeroActivityUnavailable = false
  if (opts?.includeZeroActivity) {
    const { data: members, error } = await supabase
      .from('base_members')
      .select('user_id')
      .eq('base_id', baseId)
    if (error) {
      zeroActivityUnavailable = true
    } else {
      memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id)
    }
  }

  // ONE batched profiles lookup for actor uuids + member ids.
  const ids = new Set<string>()
  for (const r of raw) if (r.actorId) ids.add(r.actorId)
  for (const id of memberIds) ids.add(id)

  type ProfileRow = SignerInfo & { role: string | null; is_active: boolean | null }
  const profileMap = new Map<string, SignerInfo>()
  const profileRows: ProfileRow[] = []
  if (ids.size > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, rank, operating_initials, role, is_active')
      .in('id', Array.from(ids))
    if (error) throw new Error(`User activity fetch failed (profiles): ${error.message}`)
    for (const p of (data ?? []) as unknown as ProfileRow[]) {
      profileRows.push(p)
      profileMap.set(p.id, {
        id: p.id, name: p.name, rank: p.rank, operating_initials: p.operating_initials,
      })
    }
  }

  let result = buildActivityMatrix(raw, profileMap, domains, startIso)

  if (opts?.includeZeroActivity && !zeroActivityUnavailable) {
    const memberIdSet = new Set(memberIds)
    const members: ZeroActivityMember[] = profileRows
      .filter((p) => memberIdSet.has(p.id) && p.is_active !== false && p.role != null)
      .map((p) => ({
        id: p.id, name: p.name, rank: p.rank,
        operating_initials: p.operating_initials, role: p.role as string,
      }))
    result = injectZeroActivityRows(result, members)
  }

  if (zeroActivityUnavailable) result = { ...result, zeroActivityUnavailable: true }

  return result
}
