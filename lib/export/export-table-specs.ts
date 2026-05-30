// Records Export — per-module table specs.
// Each spec is pure data: which columns, the natural date, and how to turn a
// row into stringified cells. Consumed by buildTableModuleFiles (export-pdf.ts).
import { EXPORT_MODULES } from './export-modules'
import type { TableModuleSpec } from './export-pdf'

function mod(key: string) {
  const m = EXPORT_MODULES.find((x) => x.key === key)
  if (!m) throw new Error(`Records Export: unknown module "${key}"`)
  return m
}

const dash = (v: string | null | undefined): string => (v == null || v === '' ? '—' : v)
const dateOnly = (v: string | null | undefined): string => (v ? v.slice(0, 10) : '—')
const yesNo = (v: boolean | null | undefined): string => (v ? 'Yes' : 'No')
// Compact UTC stamp "YYYY-MM-DD HH:MMZ" from an ISO string (stored as toISOString(), i.e. UTC).
const zuluDateTime = (v: string | null | undefined): string =>
  v ? `${v.slice(0, 10)} ${v.slice(11, 16)}Z` : '—'

// Domain acronyms that should render fully uppercase in humanized labels.
const ACRONYMS = new Set([
  'fod', 'rsc', 'rcr', 'bash', 'navaid', 'ppr', 'notam', 'notams', 'arff', 'scn',
  'aep', 'sms', 'moc', 'bwc', 'ife', 'qrc', 'pcas', 'acsi', 'afm', 'amops', 'namo',
  'ces', 'usda', 'na', 'id', 'wo', 'af', 'rwy', 'twy', 'pa', 'npa', 'vfr', 'ifr',
])

/**
 * Humanize an enum / snake_case value for display: split on spaces + underscores,
 * uppercase known acronyms, Title Case the rest. 'fod' -> 'FOD',
 * 'work_completed_awaiting_verification' -> 'Work Completed Awaiting Verification'.
 */
export function humanize(v: string | null | undefined): string {
  if (v == null || v === '') return '—'
  return v
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ')
}

// ── Discrepancies (moved from export-pdf.ts) ─────────────────
interface DiscrepancyLike {
  display_id: string
  status: string
  type: string
  title: string
  location_text: string
  assigned_shop: string | null
  work_order_number: string | null
  created_at: string
  reporter?: { name: string | null; rank: string | null } | null
}

function reporterLabel(r: DiscrepancyLike['reporter']): string {
  if (!r || !r.name) return '—'
  return r.rank ? `${r.rank} ${r.name}` : r.name
}

export const DISCREPANCIES_SPEC: TableModuleSpec<DiscrepancyLike> = {
  module: mod('discrepancies'),
  columns: ['ID', 'Date', 'Status', 'Type', 'Title', 'Location', 'Shop', 'WO #', 'Reported By'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    dateOnly(r.created_at),
    humanize(r.status),
    humanize(r.type),
    r.title,
    r.location_text,
    dash(r.assigned_shop),
    dash(r.work_order_number),
    reporterLabel(r.reporter),
  ],
}

// ── Inspections ──────────────────────────────────────────────
interface InspectionLike {
  display_id: string
  inspection_type: string
  inspector_name: string | null
  inspection_date: string
  status: string
  completion_percent: number
  created_at: string
}

export const INSPECTIONS_SPEC: TableModuleSpec<InspectionLike> = {
  module: mod('inspections'),
  columns: ['ID', 'Type', 'Inspector', 'Inspection Date', 'Status', 'Complete', 'Logged'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    r.inspection_type,
    dash(r.inspector_name),
    dateOnly(r.inspection_date),
    r.status,
    `${r.completion_percent}%`,
    dateOnly(r.created_at),
  ],
}

// ── Checks ───────────────────────────────────────────────────
interface CheckLike {
  display_id: string
  check_type: string
  areas: string[]
  completed_by: string | null
  completed_at: string | null
  status: string
  photo_count: number
  created_at: string
}

// Note: fetchChecks pre-filters to status='completed', so draft checks never
// appear in exports regardless of the selected period.
export const CHECKS_SPEC: TableModuleSpec<CheckLike> = {
  module: mod('checks'),
  columns: ['ID', 'Type', 'Areas', 'Completed By', 'Completed', 'Status', 'Photos'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    humanize(r.check_type),
    r.areas.join(', '),
    dash(r.completed_by),
    dateOnly(r.completed_at),
    humanize(r.status),
    String(r.photo_count),
  ],
}

// ── Obstructions ─────────────────────────────────────────────
interface ObstructionLike {
  display_id: string | null
  description: string | null
  object_height_agl: number
  runway_class: string
  has_violation: boolean
  controlling_surface: string | null
  created_at: string
}

export const OBSTRUCTIONS_SPEC: TableModuleSpec<ObstructionLike> = {
  module: mod('obstructions'),
  columns: ['ID', 'Description', 'Height AGL', 'Runway Class', 'Violation', 'Surface', 'Logged'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    dash(r.display_id),
    dash(r.description),
    `${r.object_height_agl} ft`,
    humanize(r.runway_class),
    yesNo(r.has_violation),
    r.controlling_surface ? humanize(r.controlling_surface) : '—',
    dateOnly(r.created_at),
  ],
}

// ── Personnel / Contractors ──────────────────────────────────
interface ContractorLike {
  company_name: string
  callsign: string | null
  work_description: string
  status: string
  start_date: string
  end_date: string | null
  af_form_483_expiration: string | null
  created_at: string
}

export const PERSONNEL_SPEC: TableModuleSpec<ContractorLike> = {
  module: mod('personnel'),
  columns: ['Company', 'Callsign', 'Work', 'Status', 'Start', 'End', 'AF 483 Exp'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.company_name,
    dash(r.callsign),
    r.work_description,
    humanize(r.status),
    dateOnly(r.start_date),
    dateOnly(r.end_date),
    dateOnly(r.af_form_483_expiration),
  ],
}

// ── Wildlife (sightings + strikes, one combined table) ───────
// Sightings and strikes live in separate tables with different columns; the
// export flattens both into one normalized row with a Kind column. Strike-only
// fields (Aircraft, Damage) are null for sightings and render as "—".
// export-data.ts owns the mapping from the raw rows to this shape.
export interface WildlifeExportRow {
  /** Natural date: observed_at for sightings, strike_date for strikes. */
  date: string
  species: string | null
  category: string | null
  count: number
  kind: 'Sighting' | 'Strike'
  location: string | null
  observer: string
  aircraft: string | null
  damage: string | null
}

export const WILDLIFE_SPEC: TableModuleSpec<WildlifeExportRow> = {
  module: mod('wildlife'),
  columns: ['Date', 'Species', 'Category', 'Count', 'Kind', 'Location', 'Observer', 'Aircraft', 'Damage'],
  getDate: (r) => r.date,
  toRow: (r) => [
    dateOnly(r.date),
    dash(r.species),
    r.category ? humanize(r.category) : '—',
    String(r.count),
    r.kind,
    dash(r.location),
    dash(r.observer),
    dash(r.aircraft),
    dash(r.damage),
  ],
}

// ── Daily Reviews (rich per-slot sign-off row) ───────────────
// One row per review_date; each slot cell is the resolved signer name (or "—"
// if unsigned). export-data.ts resolves signer profile IDs to names before
// building this shape.
export interface DailyReviewExportRow {
  review_date: string
  day_amsl: string | null
  swing_amsl: string | null
  mid_amsl: string | null
  namo: string | null
  afm: string | null
  /** ISO timestamp once every required slot is signed; null while pending. */
  certified_at: string | null
}

export const DAILY_REVIEWS_SPEC: TableModuleSpec<DailyReviewExportRow> = {
  module: mod('daily_reviews'),
  columns: ['Date', 'Day AMSL', 'Swing AMSL', 'Mid AMSL', 'NAMO', 'AFM', 'Certified'],
  getDate: (r) => r.review_date,
  toRow: (r) => [
    dateOnly(r.review_date),
    dash(r.day_amsl),
    dash(r.swing_amsl),
    dash(r.mid_amsl),
    dash(r.namo),
    dash(r.afm),
    zuluDateTime(r.certified_at),
  ],
}
