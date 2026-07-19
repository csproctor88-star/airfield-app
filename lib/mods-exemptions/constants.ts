// Modifications & Exemptions — domain constants and pure helpers.
//
// Every regulatory value in this file traces to
// docs/references/part139-mos-exemptions-verified.md (gitignored; transcribed
// 2026-07-18 from the owner's source PDFs: 14 CFR Part 139 & Part 11 eCFR
// prints current as of 2026-07-16, FAA Order 5300.1G, FAA Order 5280.5D).
// Nothing here is encoded from model memory.

export type ModsExemptionRecordType = 'mos' | 'exemption' | 'deviation'

export type ModsExemptionStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'partially_granted'
  | 'denied'
  | 'withdrawn'
  | 'notification_pending'
  | 'notified'
  | 'closed'

export type ApprovalAuthority = 'ado' | 'regional' | 'headquarters'

export type ModsExemptionAttachmentKind =
  | 'petition'
  | 'decision_letter'
  | 'srm'
  | 'airspace_review'
  | 'correspondence'
  | 'other'

export type ReviewRecommendation = 'retain' | 'resubmit' | 'terminate'

export const RECORD_TYPE_LABELS: Record<ModsExemptionRecordType, string> = {
  mos: 'Modification of Standards',
  exemption: 'Part 139 Exemption',
  deviation: 'Emergency Deviation (§139.113)',
}

export const RECORD_TYPE_SHORT_LABELS: Record<ModsExemptionRecordType, string> = {
  mos: 'MOS',
  exemption: 'Exemption',
  deviation: 'Deviation',
}

// The petition track (MOS + exemption). partially_granted is exemption-only:
// Order 5280.5D §8.6 — "The FAA may grant, deny, or partially grant the
// exemption request"; 5300.1G speaks only of approval or disapproval.
const PETITION_STATUSES: ModsExemptionStatus[] = [
  'draft', 'submitted', 'under_review', 'approved', 'partially_granted', 'denied', 'withdrawn',
]
// §139.113 deviations are not petitions — the emergency already happened;
// what's tracked is the 14-day notification duty to the RADM.
const DEVIATION_STATUSES: ModsExemptionStatus[] = [
  'notification_pending', 'notified', 'closed',
]

export const STATUSES_BY_TYPE: Record<ModsExemptionRecordType, readonly ModsExemptionStatus[]> = {
  mos: PETITION_STATUSES.filter((s) => s !== 'partially_granted'),
  exemption: PETITION_STATUSES,
  deviation: DEVIATION_STATUSES,
}

// Per-type display labels over the shared keys: FAA "grants" exemptions
// (Part 11) but "approves" modifications (5300.1G ¶8.h).
const STATUS_LABELS_BASE: Record<ModsExemptionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  partially_granted: 'Partially granted',
  denied: 'Disapproved',
  withdrawn: 'Withdrawn',
  notification_pending: 'Notification pending',
  notified: 'RADM notified',
  closed: 'Closed',
}

export function statusLabel(recordType: ModsExemptionRecordType, status: ModsExemptionStatus): string {
  if (recordType === 'exemption') {
    if (status === 'approved') return 'Granted'
    if (status === 'denied') return 'Denied'
  }
  return STATUS_LABELS_BASE[status]
}

// Colors follow the house palette vars used by the other modules' chips.
export const STATUS_COLORS: Record<ModsExemptionStatus, string> = {
  draft: 'var(--color-text-3)',
  submitted: 'var(--color-accent)',
  under_review: 'var(--color-cyan)',
  approved: 'var(--color-success)',
  partially_granted: 'var(--color-warning)',
  denied: 'var(--color-danger)',
  withdrawn: 'var(--color-text-3)',
  notification_pending: 'var(--color-warning)',
  notified: 'var(--color-success)',
  closed: 'var(--color-text-3)',
}

export const APPROVAL_AUTHORITY_LABELS: Record<ApprovalAuthority, string> = {
  ado: 'Airports District Office (ADO)',
  regional: 'Regional Airports Division',
  headquarters: 'FAA Headquarters (AAS-1)',
}

export const ATTACHMENT_KIND_LABELS: Record<ModsExemptionAttachmentKind, string> = {
  petition: 'Petition / request',
  decision_letter: 'Decision letter',
  srm: 'SRM documentation',
  airspace_review: 'Airspace (OE/AAA) review',
  correspondence: 'Correspondence',
  other: 'Other',
}

export const REVIEW_RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  retain: 'Retain — justification still valid',
  resubmit: 'Resubmit / petition anew',
  terminate: 'Terminate — no longer needed',
}

// ── Order 5300.1G Appendix A — MOS categories and subcategories ─────────
// Transcribed from the verified reference doc (pages 8–11 of the order).
// The picker offers these verbatim; 'Other' rows are the order's own.
export const MOS_CATEGORIES: Record<string, readonly string[]> = {
  'Airport Equipment Standards': [
    'Painting Marking and Lighting of Vehicles on the AOA',
    'Design Specifications for Snow Removal, Aircraft Rescue & Fire Fighting and other equipment',
    'Installation and Acceptance Standards for Snow Temperature Sensors, Foreign Object Detection and other equipment',
    'Operational/Performance Standards for Snow Removal and Aircraft Rescue & Fire Fighting equipment',
    'Other',
  ],
  'ATC Facility': [
    'Automated Weather Systems - AWOS/ASOS',
    'Runway Visual Range',
  ],
  'Design': [
    'Blast Pad Dimensions',
    'Clearway',
    'Declared Distances',
    'End Around Taxiway (EAT)',
    'Full Length Parallel Taxiway',
    'Horizontal Geometry - Taxiway Curves and Intersections, including 180 degree turns',
    'New Instrument Approaches - Waivers to TERPS',
    'Obstacle Free Zone (OFZ) - TERPS Waivers Related',
    'Runway End Siting Requirements',
    'Runway Hold Positions - Marking',
    'Runway Hold Positions - Offset Distance',
    'Runway Object Free Area (ROFA)',
    'Runway or Taxiway Width',
    'Runway Protection Zone (RPZ)',
    'Runway to Heliport Separation',
    'Airplane Design Group VI Standards',
    'Runway to Taxilane Separation',
    'Runway to Taxiway Separation',
    'Runway Visibility Zone',
    'Surface Gradient and Line of Sight',
    'Taxilane to Parallel Taxilane',
    'Taxiway Edge Safety Margin',
    'Taxiway Object Free Area (TOFA)',
    'Taxiway Safety Area (TSA)',
    'Taxiway to Object Separation',
    'Taxiway to Taxiway/Taxilane Separation',
    'Taxiway/Taxilane Wingtip Clearance',
    'Treatment of Jet Blast',
    'Other',
  ],
  'Lighting': [
    'Configuration - Aiming/Beam Spread',
    'Configuration - Color',
    'Location',
    'Configuration - Flash Rate',
    'Configuration - Intensity',
    'Control and Monitoring',
    'Fixture Hardware',
    'Installation',
    'Interconnecting Hardware',
    'Power Source',
    'Other',
  ],
  'Markings': [
    'Configuration - Color',
    'Location',
    'Materials',
    'Other',
  ],
  'NAVAIDS': [
    'Approach Light Systems',
    'Non-NCP NAVAID Does Not Meet Runway (VFR/IFR) OFZ Standards',
    'Non-NCP NAVAID Requires Exception on a CAT II or III Runway',
    'Non-NCP NAVAID that Requires TERPS Waiver',
    'Siting Criteria',
    'Other',
  ],
  'Methods & Materials': [
    'General Provisions',
    'Earthwork, P-100s',
    'Flexible Base Course, P-200s',
    'Rigid Base Course, P-300s',
    'Flexible Surface Course, P-400s',
    'Rigid Pavement, P-501',
    'Miscellaneous, P-600s',
    'Fencing, F-100s',
    'Drainage, D-700s',
    'Turf, T-900s',
    'Lighting, L-100s',
    'Other',
  ],
  'Signage': [
    'Control and Monitoring',
    'Dimension',
    'Fixture Hardware',
    'Interconnecting Hardware',
    'Legend - Color',
    'Legend - Wording',
    'Location',
    'Power Source',
    'Other',
  ],
  'Visual Aids': [
    'Centerline/Edge',
    'Land and Hold Short Lighting',
    'Radio Control',
    'Runway/Taxiway',
    'SMGCS',
    'Visual Guidance Slope Indicator (VGSI) for IFR and VFR Runways',
    'Airport Beacon',
    'Wind Cones',
    'Runway Status Lights',
    'Obstruction Lights',
    'Other',
  ],
}

// Order 5300.1G ¶8.i — situations where a MOS is NOT applicable. Rendered
// as a hint panel on the MOS form so nobody drafts a doomed request.
export const MOS_NOT_APPLICABLE: readonly string[] = [
  'Non-standard Runway Safety Area (RSA) dimensions — RSAs get an RSA determination under FAA Orders 5200.8 / 5200.9 instead',
  'Non-standard Obstacle Free Zone (OFZ) surfaces',
  'Non-standard approach / departure surfaces',
  'To match existing equipment owned by the airport',
  'Impermissible land use within Runway Protection Zone (RPZ) limits',
]

// §139.111(b)(2) — required contents of a small-airport ARFF exemption
// petition (shown as a completeness checklist when arff_small_airport is
// toggled on). (b)(1)(i) adds the 120-day advance filing requirement.
export const ARFF_PETITION_CONTENTS: readonly string[] = [
  'An itemized cost to comply with the requirement from which the exemption is sought',
  'Current staffing levels',
  'The current annual financial report (e.g., single audit report or FAA Form 5100-127)',
  'Annual passenger enplanement data for the previous 12 calendar months',
  'The type and frequency of air carrier operations served',
  'A history of air carrier service',
  'Anticipated changes to air carrier service',
]

export const ARFF_ADVANCE_FILING_DAYS = 120 // §139.111(b)(1)(i)

// §139.113 / Order 5280.5D §2.13 — notify the RADM within 14 days of the
// emergency ("as soon as possible but at least within 14 days").
export const DEVIATION_NOTIFY_DAYS = 14

// §11.101 — reconsideration of a denial must reach FAA within 60 days.
export const RECONSIDERATION_WINDOW_DAYS = 60

// ── Pure date helpers ───────────────────────────────────────────────────
// All operate on local YYYY-MM-DD strings (never Date-parse a bare date
// string into UTC — the session-6 DATE-boundary lesson).

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12))
  return dt.toISOString().slice(0, 10)
}

/** Same calendar day next year; Feb 29 clamps to Feb 28. */
export function nextAnnualReviewDate(reviewDateIso: string): string {
  const [y, m, d] = reviewDateIso.split('-').map(Number)
  if (m === 2 && d === 29) return `${y + 1}-02-28`
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** RADM notification deadline: deviation date + 14 days (§139.113). */
export function deviationNotifyDeadline(deviationDateIso: string): string {
  return addDaysIso(deviationDateIso, DEVIATION_NOTIFY_DAYS)
}

/** Last day FAA can receive a reconsideration request (§11.101). */
export function reconsiderationDeadline(dateDecidedIso: string): string {
  return addDaysIso(dateDecidedIso, RECONSIDERATION_WINDOW_DAYS)
}

/** A record with a decided-positive status counts as decided relief. */
export function isDecidedRelief(status: ModsExemptionStatus): boolean {
  return status === 'approved' || status === 'partially_granted'
}

/**
 * Computed display state — never stored. A decided record whose
 * expiration_date has passed is Expired regardless of stored status
 * (expiring ON the date is still valid through that day).
 */
export function isExpired(
  record: { status: ModsExemptionStatus; expiration_date: string | null },
  todayIso: string,
): boolean {
  if (!isDecidedRelief(record.status)) return false
  if (!record.expiration_date) return false
  return record.expiration_date < todayIso
}

export type ReviewDueState = 'overdue' | 'due_soon' | null

/**
 * Annual-review badge state (5280.5D §2.12.2): overdue once next_review_due
 * has passed; due_soon inside the 30 days before it. Only decided relief
 * carries a review duty.
 */
export function reviewDueState(
  record: { status: ModsExemptionStatus; next_review_due: string | null },
  todayIso: string,
): ReviewDueState {
  if (!isDecidedRelief(record.status)) return null
  if (!record.next_review_due) return null
  if (record.next_review_due < todayIso) return 'overdue'
  if (addDaysIso(todayIso, 30) >= record.next_review_due) return 'due_soon'
  return null
}

/** Deviation whose 14-day notification window lapsed without a notified_date. */
export function deviationNotificationOverdue(
  record: { record_type: ModsExemptionRecordType; deviation_date: string | null; notified_date: string | null },
  todayIso: string,
): boolean {
  if (record.record_type !== 'deviation') return false
  if (!record.deviation_date || record.notified_date) return false
  return deviationNotifyDeadline(record.deviation_date) < todayIso
}
