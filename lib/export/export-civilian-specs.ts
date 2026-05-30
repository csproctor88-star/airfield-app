// Records Export — civilian (FAA Part 139) multi-kind table specs (Phase 2d).
//
// SMS and AEP are not single record lists — each is a *module* holding several
// distinct record kinds (SMS: hazards / mitigations / audits / MoC / safety
// reports; AEP: plans / response agencies / drills / comms checks). Each kind is
// its own TableModuleSpec with a `subName`, so buildTableModuleFiles emits one
// PDF per kind under the module folder:
//   documents/SMS/Hazards.pdf, documents/SMS/Mitigations.pdf, …
//   documents/AEP/Plans.pdf,   documents/AEP/Drills.pdf, …
// Both modules are appliesTo:'civilian' in the registry, so they only export on
// FAA Part 139 bases.
import { EXPORT_MODULES, type ExportModule } from './export-modules'
import type { TableModuleSpec } from './export-pdf'
import type {
  SmsHazard,
  SmsMitigation,
  SmsAudit,
  SmsMoc,
  SmsSafetyReport,
} from '@/lib/supabase/sms'
import type {
  AepPlan,
  AepResponseAgency,
  AepDrill,
  AepCommsCheckWithResults,
} from '@/lib/supabase/aep'
import {
  AEP_AGENCY_ROLE_LABELS,
  AEP_DRILL_TYPE_LABELS,
  AEP_COMMS_STATUS_LABELS,
} from '@/lib/supabase/aep'

function mod(key: string): ExportModule {
  const m = EXPORT_MODULES.find((x) => x.key === key)
  if (!m) throw new Error(`Records Export: unknown module "${key}"`)
  return m
}

const dash = (v: string | null | undefined): string => (v == null || v === '' ? '—' : v)
const dateOnly = (v: string | null | undefined): string => (v ? v.slice(0, 10) : '—')
const yesNo = (v: boolean | null | undefined): string => (v ? 'Yes' : 'No')
/** Title-case a snake_case enum value: 'no_response' → 'No Response'. */
const enumLabel = (v: string | null | undefined): string =>
  v == null || v === ''
    ? '—'
    : v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// ── SMS ────────────────────────────────────────────────────────
export const SMS_HAZARDS_SPEC: TableModuleSpec<SmsHazard> = {
  module: mod('sms'),
  subName: 'Hazards',
  columns: ['Code', 'Title', 'Status', 'Source', 'Risk', 'Residual', 'Identified'],
  getDate: (r) => r.identified_at,
  toRow: (r) => [
    r.hazard_code,
    r.title,
    enumLabel(r.status),
    enumLabel(r.source_type),
    enumLabel(r.current_band),
    enumLabel(r.residual_band),
    dateOnly(r.identified_at),
  ],
}

export const SMS_MITIGATIONS_SPEC: TableModuleSpec<SmsMitigation> = {
  module: mod('sms'),
  subName: 'Mitigations',
  columns: ['Title', 'Control', 'Status', 'Due', 'Completed', 'Logged'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.title,
    enumLabel(r.control_type),
    enumLabel(r.status),
    dateOnly(r.due_date),
    dateOnly(r.completed_at),
    dateOnly(r.created_at),
  ],
}

export const SMS_AUDITS_SPEC: TableModuleSpec<SmsAudit> = {
  module: mod('sms'),
  subName: 'Audits',
  columns: ['Code', 'Title', 'Type', 'Status', 'Scheduled', 'Performed', 'Open', 'Closed'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.audit_code,
    r.title,
    enumLabel(r.audit_type),
    enumLabel(r.status),
    dateOnly(r.scheduled_date),
    dateOnly(r.performed_date),
    String(r.findings_open),
    String(r.findings_closed),
  ],
}

export const SMS_MOC_SPEC: TableModuleSpec<SmsMoc> = {
  module: mod('sms'),
  subName: 'Management-of-Change',
  columns: ['Code', 'Title', 'Category', 'Status', 'Proposed', 'Effective'],
  getDate: (r) => r.proposed_at,
  toRow: (r) => [
    r.moc_code,
    r.title,
    enumLabel(r.change_category),
    enumLabel(r.status),
    dateOnly(r.proposed_at),
    dateOnly(r.effective_date),
  ],
}

export const SMS_SAFETY_REPORTS_SPEC: TableModuleSpec<SmsSafetyReport> = {
  module: mod('sms'),
  subName: 'Safety-Reports',
  columns: ['Code', 'Category', 'Triage', 'Occurred', 'Location', 'Anonymous', 'Submitted'],
  getDate: (r) => r.submitted_at,
  toRow: (r) => [
    r.report_code,
    enumLabel(r.category),
    enumLabel(r.triage_status),
    dateOnly(r.occurred_at),
    dash(r.location_text),
    yesNo(r.is_anonymous),
    dateOnly(r.submitted_at),
  ],
}

export const SMS_SPECS = [
  SMS_HAZARDS_SPEC,
  SMS_MITIGATIONS_SPEC,
  SMS_AUDITS_SPEC,
  SMS_MOC_SPEC,
  SMS_SAFETY_REPORTS_SPEC,
] as const

// ── AEP ────────────────────────────────────────────────────────
export const AEP_PLANS_SPEC: TableModuleSpec<AepPlan> = {
  module: mod('aep'),
  subName: 'Plans',
  columns: ['Version', 'Effective', 'FAA Accepted', 'FAA Ref', 'Last Reviewed', 'Status'],
  getDate: (r) => r.effective_date,
  toRow: (r) => [
    r.version,
    dateOnly(r.effective_date),
    dateOnly(r.approved_by_faa_at),
    dash(r.faa_acceptance_ref),
    dateOnly(r.last_reviewed_at),
    r.replaced_by_id ? 'Superseded' : 'Active',
  ],
}

export const AEP_AGENCIES_SPEC: TableModuleSpec<AepResponseAgency> = {
  module: mod('aep'),
  subName: 'Response-Agencies',
  columns: ['Agency', 'Role', 'Contact', 'Phone', 'Active'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.agency_name,
    AEP_AGENCY_ROLE_LABELS[r.agency_role] ?? enumLabel(r.agency_role),
    dash(r.primary_contact_name),
    dash(r.primary_contact_phone),
    yesNo(r.is_active),
  ],
}

export const AEP_DRILLS_SPEC: TableModuleSpec<AepDrill> = {
  module: mod('aep'),
  subName: 'Drills',
  columns: ['Date', 'Type', 'Scenario', 'Status', 'Participants'],
  getDate: (r) => r.drill_date,
  toRow: (r) => [
    dateOnly(r.drill_date),
    AEP_DRILL_TYPE_LABELS[r.drill_type] ?? enumLabel(r.drill_type),
    r.scenario,
    enumLabel(r.status),
    String(r.participants?.length ?? 0),
  ],
}

export const AEP_COMMS_CHECKS_SPEC: TableModuleSpec<AepCommsCheckWithResults> = {
  module: mod('aep'),
  subName: 'Comms-Checks',
  columns: ['Date', 'Period', 'OI', 'Checked', 'Loud & Clear', 'Exceptions'],
  getDate: (r) => r.check_date,
  toRow: (r) => {
    const total = r.results.length
    const clear = r.results.filter((x) => x.status === 'loud_clear').length
    const exceptions = r.results
      .filter((x) => x.status !== 'loud_clear')
      .map((x) => `${x.agency_name} (${AEP_COMMS_STATUS_LABELS[x.status] ?? x.status})`)
    return [
      dateOnly(r.check_date),
      enumLabel(r.check_period),
      dash(r.completed_by_oi),
      String(total),
      String(clear),
      exceptions.length ? exceptions.join(', ') : '—',
    ]
  },
}

export const AEP_SPECS = [
  AEP_PLANS_SPEC,
  AEP_AGENCIES_SPEC,
  AEP_DRILLS_SPEC,
  AEP_COMMS_CHECKS_SPEC,
] as const
