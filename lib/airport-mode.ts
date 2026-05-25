/**
 * Dual-mode helpers — single source of truth for translating between
 * the USAF airfield-management vocabulary and FAA Part 139 civilian
 * vocabulary based on a base's `airport_type` flag.
 *
 * Phase 1 of the FAA expansion. See `.claude/plans/i-want-to-re-wobbly-koala.md`.
 *
 * Usage:
 *   import { isCivilian, getRoleLabel, getTerm, getRegSource } from '@/lib/airport-mode'
 *   const base = useInstallation().currentInstallation
 *   const managerLabel = getRoleLabel('airfield_manager', base)   // "Airfield Manager" or "Airport Operations Manager"
 *   const formLabel    = getTerm('form_505', base)                // "AF Form 505" or "Modification to Standards"
 *   const isFaa        = isCivilian(base)                         // false for USAF
 *   const sources      = getRegSource(base)                       // ['usaf','both','ufc','icao'] or ['faa','both','icao']
 *
 * Every helper accepts either a base-like object (anything with an
 * `airport_type` field), a raw AirportType string, or null/undefined.
 * Null/undefined defaults to 'usaf' — never surface civilian
 * terminology to a caller that hasn't told us they're civilian.
 */

export type AirportType = 'usaf' | 'faa_part139'
export type SurfaceSet = 'ufc_3_260_01' | 'faa_part77'

type BaseLike =
  | { airport_type?: AirportType | null; obstruction_surface_set?: SurfaceSet | null }
  | AirportType
  | null
  | undefined

/** Resolve any input shape to an AirportType, defaulting to 'usaf'. */
export function getAirportType(base: BaseLike): AirportType {
  if (!base) return 'usaf'
  if (typeof base === 'string') return base === 'faa_part139' ? 'faa_part139' : 'usaf'
  return base.airport_type === 'faa_part139' ? 'faa_part139' : 'usaf'
}

/** True when this base is a civilian FAA Part 139 airport. */
export function isCivilian(base: BaseLike): boolean {
  return getAirportType(base) === 'faa_part139'
}

/** True when this base is a USAF airfield (the default). */
export function isUsaf(base: BaseLike): boolean {
  return getAirportType(base) === 'usaf'
}

// ────────────────────────────────────────────────────────────────
// Role labels
// ────────────────────────────────────────────────────────────────

/**
 * Display labels for every role key under each mode. An empty string
 * means "this role doesn't exist in this mode" — UI should hide it.
 * Civilian roles (sms_manager, aep_coordinator, etc.) read the same
 * label in both modes since they only ever surface in civilian UI.
 */
const ROLE_LABELS: Record<string, { usaf: string; faa: string }> = {
  // Shared roles, relabeled per mode
  airfield_manager:      { usaf: 'Airfield Manager',  faa: 'Airport Operations Manager' },
  namo:                  { usaf: 'NAMO',              faa: 'Operations Supervisor' },
  amops:                 { usaf: 'AMOPS',             faa: 'Ops Specialist' },
  ces:                   { usaf: 'CES',               faa: 'Airport Maintenance' },
  safety:                { usaf: 'Wing Safety',       faa: 'Safety Officer' },
  atc:                   { usaf: 'ATC',               faa: 'ATC' },
  read_only:             { usaf: 'Read Only',         faa: 'Read Only' },
  base_admin:            { usaf: 'Base Admin',        faa: 'Airport Admin' },
  sys_admin:             { usaf: 'System Admin',      faa: 'System Admin' },
  ppr:                   { usaf: 'PPR',               faa: 'PPR' },
  airfield_status:       { usaf: 'Airfield Status',   faa: 'Airfield Status' },
  // USAF-only — empty string in civilian mode means "hide in civilian UI"
  majcom_rfm:            { usaf: 'MAJCOM / RFM',      faa: '' },
  // Civilian-only — empty string in USAF mode hides in USAF UI
  sms_manager:           { usaf: '', faa: 'SMS Manager' },
  aep_coordinator:       { usaf: '', faa: 'AEP Coordinator' },
  ops_supervisor:        { usaf: '', faa: 'Operations Supervisor' },
  arff_chief:            { usaf: '', faa: 'ARFF Chief' },
  accountable_executive: { usaf: '', faa: 'Accountable Executive' },
}

/**
 * Display label for a role key, scoped to the airport mode.
 * Falls back to a humanized role key for unknown keys.
 * Returns '' when the role is not surfaced in the given mode —
 * callers should treat that as "hide".
 */
export function getRoleLabel(role: string | null | undefined, base: BaseLike): string {
  if (!role) return ''
  const entry = ROLE_LABELS[role]
  const mode = getAirportType(base)
  if (entry) return mode === 'faa_part139' ? entry.faa : entry.usaf
  // Unknown role — humanize the key
  return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** True when the role surfaces in the given mode at all. */
export function isRoleVisible(role: string, base: BaseLike): boolean {
  return getRoleLabel(role, base).length > 0
}

// ────────────────────────────────────────────────────────────────
// Terminology dictionary
// ────────────────────────────────────────────────────────────────

/**
 * Every key here is a piece of mode-specific vocabulary the UI may
 * need to render. Add new keys here rather than scattering inline
 * conditionals through components.
 */
export type TermKey =
  // Roles / org units (short forms — for chips, tight UI)
  | 'afm'              // Manager short form
  | 'amsl'             // Shift supervisor short form
  | 'namo'             // Operations supervisor short form
  | 'ces'              // Maintenance short form
  | 'amops'            // Operations short form
  // Org names (long forms — for body copy)
  | 'manager_full'
  | 'ops_office_full'
  | 'maintenance_full'
  | 'safety_office'
  // Shift slot labels
  | 'shift_day'
  | 'shift_swing'
  | 'shift_mid'
  | 'shift_supervisor'
  | 'shift_manager'
  // Forms
  | 'form_505'         // Waiver form
  | 'form_483'         // Personnel/escort log
  | 'form_3616'        // Daily events log
  // Emergency notification
  | 'scn'
  // Regulatory anchors
  | 'primary_reg'
  | 'design_reg'
  | 'obstruction_reg'
  | 'self_inspection_reg'
  | 'emergency_plan_reg'
  | 'wildlife_reg'
  // Process names
  | 'waiver_workflow'
  | 'compliance_inspection'

const TERMS: Record<TermKey, { usaf: string; faa: string }> = {
  afm:                   { usaf: 'AFM',                              faa: 'Manager' },
  amsl:                  { usaf: 'AMSL',                             faa: 'Shift Supervisor' },
  namo:                  { usaf: 'NAMO',                             faa: 'Ops Supervisor' },
  ces:                   { usaf: 'CES',                              faa: 'Maintenance' },
  amops:                 { usaf: 'AMOPS',                            faa: 'Ops' },

  manager_full:          { usaf: 'Airfield Manager',                 faa: 'Airport Operations Manager' },
  ops_office_full:       { usaf: 'Airfield Management Operations',   faa: 'Airport Operations' },
  maintenance_full:      { usaf: 'Civil Engineer Squadron',          faa: 'Airport Maintenance' },
  safety_office:         { usaf: 'Wing Safety',                      faa: 'Safety Office' },

  shift_day:             { usaf: 'Day AMSL',                         faa: 'Day Shift' },
  shift_swing:           { usaf: 'Swing AMSL',                       faa: 'Evening Shift' },
  shift_mid:             { usaf: 'Mid AMSL',                         faa: 'Night Shift' },
  shift_supervisor:      { usaf: 'NAMO',                             faa: 'Supervisor' },
  shift_manager:         { usaf: 'AFM',                              faa: 'Manager' },

  form_505:              { usaf: 'AF Form 505 (Waiver)',             faa: 'Modification to Standards' },
  form_483:              { usaf: 'AF Form 483',                      faa: 'SIDA Badge Log' },
  form_3616:             { usaf: 'AF Form 3616 (Daily Events Log)',  faa: 'Daily Ops Log' },

  scn:                   { usaf: 'Secondary Crash Net',              faa: 'Emergency Notification Cascade' },

  primary_reg:           { usaf: 'DAFMAN 13-204',                    faa: '14 CFR Part 139' },
  design_reg:            { usaf: 'UFC 3-260-01',                     faa: 'AC 150/5300-13B' },
  obstruction_reg:       { usaf: 'UFC 3-260-01 Ch. 3',               faa: '14 CFR Part 77' },
  self_inspection_reg:   { usaf: 'DAFMAN 13-204 Vol. 2',             faa: 'AC 150/5200-18C' },
  emergency_plan_reg:    { usaf: 'AFMAN 91-203',                     faa: 'AC 150/5200-31C' },
  wildlife_reg:          { usaf: 'DAFMAN 91-212',                    faa: 'AC 150/5200-33C / §139.337' },

  waiver_workflow:       { usaf: 'Waiver',                           faa: 'Modification to Standards' },
  compliance_inspection: { usaf: 'ACSI',                             faa: 'Part 139 Annual Inspection' },
}

/**
 * Returns the mode-appropriate string for a vocabulary key.
 * Unknown keys return the key itself — defensive, never throws.
 */
export function getTerm(key: TermKey, base: BaseLike): string {
  const entry = TERMS[key]
  if (!entry) return key
  return getAirportType(base) === 'faa_part139' ? entry.faa : entry.usaf
}

// ────────────────────────────────────────────────────────────────
// Discrepancy status labels (mirrors discrepancy_statuses table)
// ────────────────────────────────────────────────────────────────

/**
 * Status keys remain USAF-derived in the DB (`submitted_to_afm` etc.);
 * only the display label varies by mode. Mirrors the seed in migration
 * 2026052505_discrepancy_statuses_lookup.sql. Helpers expose the
 * mode-aware label without a DB round-trip.
 */
const DISCREPANCY_STATUS_LABELS: Record<string, { usaf: string; faa: string; sort: number }> = {
  submitted_to_afm: {
    usaf: 'Submitted to AFM',
    faa:  'Submitted to Operations Manager',
    sort: 1,
  },
  submitted_to_ces: {
    usaf: 'Submitted to CES',
    faa:  'Submitted to Maintenance',
    sort: 2,
  },
  awaiting_action_by_ces: {
    usaf: 'Awaiting Action by CES',
    faa:  'Awaiting Maintenance Action',
    sort: 3,
  },
  waiting_for_project: {
    usaf: 'Waiting for Project Design/Execution',
    faa:  'Waiting for Project',
    sort: 4,
  },
  work_completed_awaiting_verification: {
    usaf: 'Work Completed and Awaiting Verification',
    faa:  'Work Completed (Awaiting Verification)',
    sort: 5,
  },
}

/** Returns the mode-appropriate label for a discrepancy status key. */
export function getDiscrepancyStatusLabel(value: string | null | undefined, base: BaseLike): string {
  if (!value) return ''
  const entry = DISCREPANCY_STATUS_LABELS[value]
  if (!entry) return value
  return getAirportType(base) === 'faa_part139' ? entry.faa : entry.usaf
}

/** Returns the full list of {value,label} options ordered for UI rendering. */
export function getDiscrepancyStatusOptions(base: BaseLike): { value: string; label: string }[] {
  const mode = getAirportType(base)
  return Object.entries(DISCREPANCY_STATUS_LABELS)
    .sort((a, b) => a[1].sort - b[1].sort)
    .map(([value, labels]) => ({
      value,
      label: mode === 'faa_part139' ? labels.faa : labels.usaf,
    }))
}

// ────────────────────────────────────────────────────────────────
// Reference library filter
// ────────────────────────────────────────────────────────────────

/**
 * Which `regulations.source` values to surface to this base.
 * USAF: USAF regs + UFC + ICAO + dual.
 * Civilian: FAA + ICAO + dual.
 */
export function getRegSource(base: BaseLike): string[] {
  return isCivilian(base)
    ? ['faa', 'both', 'icao']
    : ['usaf', 'both', 'ufc', 'icao']
}

// ────────────────────────────────────────────────────────────────
// Obstruction surface set
// ────────────────────────────────────────────────────────────────

/**
 * Which imaginary-surface set to evaluate obstructions against.
 * Reads bases.obstruction_surface_set when present; falls back to
 * the mode default (UFC for USAF, Part 77 for civilian).
 */
export function getSurfaceSet(base: BaseLike): SurfaceSet {
  if (base && typeof base === 'object' && 'obstruction_surface_set' in base) {
    const explicit = (base as { obstruction_surface_set?: SurfaceSet }).obstruction_surface_set
    if (explicit === 'faa_part77' || explicit === 'ufc_3_260_01') return explicit
  }
  return isCivilian(base) ? 'faa_part77' : 'ufc_3_260_01'
}
