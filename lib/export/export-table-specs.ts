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
    r.status,
    r.type,
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
    r.check_type,
    r.areas.join(', '),
    dash(r.completed_by),
    dateOnly(r.completed_at),
    r.status,
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
    r.runway_class,
    yesNo(r.has_violation),
    dash(r.controlling_surface),
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
    r.status,
    dateOnly(r.start_date),
    dateOnly(r.end_date),
    dateOnly(r.af_form_483_expiration),
  ],
}
