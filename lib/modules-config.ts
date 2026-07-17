import type { UserRole } from '@/lib/supabase/types'
import type { AirportType } from '@/lib/airport-mode'

export type ModuleKey =
  | 'checks'
  | 'inspections'
  | 'acsi'
  | 'discrepancies'
  | 'ces'
  | 'infrastructure'
  | 'parking'
  | 'obstructions'
  | 'qrc'
  | 'shift-checklist'
  | 'scn'
  | 'wildlife'
  | 'waivers'
  | 'notams'
  | 'ppr'
  | 'feedback'
  | 'contractors'
  | 'amtr'
  | 'sms'
  | 'training_part139'
  | 'aep'
  | 'field_conditions'
  | 'flip'
  | 'whmp'
  | 'read_file'
  | 'local_regs'
  | 'fpr'
  | 'driving_checks'

export type ModuleCategory = 'core-ops' | 'emergency' | 'compliance' | 'optional'

export type WizardStepKey =
  | 'runways'
  | 'taxiways'
  | 'navaids'
  | 'areas'
  | 'arff'
  | 'shops'
  | 'facilities'
  | 'templates'
  | 'shiftchecklist'
  | 'qrc'
  | 'scnagencies'
  | 'aepagencies'
  | 'lighting'
  | 'wildlife'
  | 'statusboards'
  | 'pprcolumns'
  | 'feedback'
  | 'fprchecklist'
  | 'drivingcheckitems'

export type ModuleDef = {
  key: ModuleKey
  label: string
  category: ModuleCategory
  description: string
  useCase: string
  hrefs: string[]
  setupSteps: WizardStepKey[]
  defaultEnabled: boolean
  roleRestrictions?: UserRole[]
  /**
   * Which airport_type modes this module applies to. Defaults to
   * ['usaf', 'faa_part139'] (both) when omitted. SCN and AMTR are
   * USAF-only; SMS / AEP / §139.303 Training (when added) are
   * civilian-only.
   */
  appliesTo?: AirportType[]
}

export const MODULES: ModuleDef[] = [
  {
    key: 'checks',
    label: 'Airfield Checks',
    category: 'core-ops',
    description: 'Daily, weekly, and monthly airfield condition checks with photo capture and signatures.',
    useCase: 'BASH, FOD Check, daily airfield, lighting, and friction checks — the everyday rhythm of the Airfield Manager.',
    hrefs: ['/checks'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'inspections',
    label: 'Inspections',
    category: 'core-ops',
    description: 'Daily airfield and lighting inspections that step through the configured template section by section, with pass/fail/discrepancy capture per item.',
    useCase: 'Required at most bases per DAFMAN 13-204v2 §5.1; templates clone from the DAFMAN-derived defaults and customize per local OI.',
    hrefs: ['/inspections'],
    setupSteps: ['templates'],
    defaultEnabled: true,
  },
  {
    key: 'acsi',
    label: 'ACSI (Annual Compliance)',
    category: 'compliance',
    description: 'Comprehensive annual compliance inspection — the USAF ACSI (DAFMAN 13-204v2 §5.4.3) on military bases, or the FAA Part 139 certification-inspection readiness self-audit based on FAA Form 5280-4 on civilian airports.',
    useCase: 'Enable to run and document your recurring comprehensive compliance inspection — the annual ACSI on military bases, or a Part 139 certification-inspection readiness audit that mirrors the FAA\'s own Form 5280-4 on civilian airports.',
    hrefs: ['/acsi'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['usaf', 'faa_part139'],
  },
  {
    key: 'discrepancies',
    label: 'Discrepancies',
    category: 'core-ops',
    description: 'Track airfield discrepancies from report through CES work-order to closure, auto-routing each to the owning CE shop by type.',
    useCase: 'Any base tracking NAVAID outages, pavement issues, FOD, lighting failures, etc. Unmapped types fall back to the AFM dispatcher.',
    hrefs: ['/discrepancies'],
    setupSteps: ['shops'],
    defaultEnabled: true,
  },
  {
    key: 'ces',
    label: 'CES Work Orders',
    category: 'core-ops',
    description: 'Work-order dashboard for CE shops to action discrepancies routed to them via the type-to-shop mapping.',
    useCase: 'Bases with a dedicated CE shop workflow. Turn off if CE tracks work orders in another system.',
    hrefs: ['/ces'],
    setupSteps: ['shops'],
    defaultEnabled: true,
    roleRestrictions: ['ces'],
  },
  {
    key: 'infrastructure',
    label: 'Visual NAVAIDs',
    category: 'core-ops',
    description: 'Mapped runway/taxiway lighting, signs, and Visual NAVAIDs with automatic detection when outages exceed the DAFMAN 13-204v2 Table A3.1 allowable thresholds.',
    useCase: 'Bases that track individual light/sign/NAVAID status and want the Outage Engine to flag systems exceeding A3.1 allowances and auto-create discrepancies.',
    hrefs: ['/infrastructure'],
    setupSteps: ['navaids', 'lighting'],
    defaultEnabled: true,
  },
  {
    key: 'parking',
    label: 'Parking Plans',
    category: 'core-ops',
    description: 'To-scale aircraft parking diagrams with wingtip/taxilane clearance checks per UFC 3-260-01.',
    useCase: 'Bases that draft parking plans for transient or exercise operations.',
    hrefs: ['/parking'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'obstructions',
    label: 'Obstructions',
    category: 'compliance',
    description: 'Obstruction evaluations with FAA and UFC 3-260-01 imaginary-surface analysis.',
    useCase: 'Bases reviewing construction, temporary obstacles, or long-term obstruction waivers.',
    hrefs: ['/obstructions'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'qrc',
    label: 'QRC (Emergency Checklists)',
    category: 'emergency',
    description: 'Quick Reaction Checklists for emergency and contingency response, sequenced step-by-step with a full audit trail of who acknowledged what and when.',
    useCase: 'Aircraft mishap, hung ordnance, fuel spill, severe weather, and other emergency response scenarios per DAFMAN 13-204v2 §2.5.2.8.',
    hrefs: ['/qrc'],
    setupSteps: ['qrc'],
    defaultEnabled: true,
  },
  {
    key: 'scn',
    label: 'Secondary Crash Net',
    category: 'emergency',
    description: 'Daily Secondary Crash Net communication check log with per-agency status badges and backup SCN verification.',
    useCase: 'Document the daily SCN check required for emergency coordination with fire, medical, ATC, and other response agencies per DAFMAN 13-204v2 §4.2.2.3.7.',
    hrefs: ['/scn'],
    setupSteps: ['scnagencies'],
    defaultEnabled: true,
    appliesTo: ['usaf'],
  },
  {
    key: 'shift-checklist',
    label: 'Shift Checklist',
    category: 'core-ops',
    description: 'Per-shift task tracking (Day/Swing/Mid) with daily, weekly, and monthly frequency, 3-state toggle, and 0600L reset.',
    useCase: 'Bases that want AMOPS personnel to step through a shift turnover checklist with per-task accountability.',
    hrefs: ['/shift-checklist'],
    setupSteps: ['shiftchecklist'],
    defaultEnabled: true,
  },
  {
    key: 'wildlife',
    label: 'Wildlife / BASH',
    category: 'compliance',
    description: 'Wildlife sightings and strikes with BASH heatmap and trend reporting per DAFMAN 91-212.',
    useCase: 'Bases with a BASH plan and wildlife strike reporting requirement (most do).',
    hrefs: ['/wildlife'],
    setupSteps: ['wildlife'],
    defaultEnabled: true,
  },
  {
    key: 'waivers',
    label: 'Waivers',
    category: 'compliance',
    description: 'Airfield criteria waivers (AF Form 505) with 6 classifications and annual review tracking.',
    useCase: 'Bases managing long-term criteria waivers that need annual review sign-off.',
    hrefs: ['/waivers'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'notams',
    label: 'NOTAMs',
    category: 'core-ops',
    description: 'Live FAA NOTAM feed with expiry tracking and active/expired filtering.',
    useCase: 'Turn off if your NOTAMs are managed entirely in the FAA NOTAM Manager system.',
    hrefs: ['/notams'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'ppr',
    label: 'Prior Permission Required',
    category: 'optional',
    description: 'Prior Permission Required log with per-base configurable columns, multi-agency coordination, and PDF export.',
    useCase: 'Bases that require PPR for transient aircraft and want a digital log shared with the agencies that need to action each request.',
    hrefs: ['/ppr'],
    setupSteps: ['pprcolumns'],
    defaultEnabled: true,
  },
  {
    key: 'feedback',
    label: 'Customer Feedback',
    category: 'optional',
    description: 'Public feedback form with QR code for base ops or transient parking; submissions land in the Feedback module for AFM review.',
    useCase: 'Bases that want a no-login feedback channel for transient aircrew and contractors.',
    hrefs: ['/feedback'],
    setupSteps: ['feedback'],
    defaultEnabled: false,
  },
  {
    key: 'contractors',
    label: 'Contractors / Personnel',
    category: 'compliance',
    description: 'AF Form 483 Personnel on Airfield log with escort credentials and expiry tracking.',
    useCase: 'Bases actively escorting contractors or tracking airfield access credentials.',
    hrefs: ['/contractors'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'amtr',
    label: 'Training Records (AMTR)',
    category: 'compliance',
    description: 'Airfield Management Training Record — roster + per-member electronic record covering AF Forms 623A, 797, 803, 1098, JQS-CFETP, QTP/PCG milestones, formal courses, qualifications, and Ready Airman Training, with role-based signatures and due-date notifications.',
    useCase: 'Bases managing mandatory airfield-management personnel training and upgrade qualifications.',
    hrefs: ['/amtr'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['usaf'],
  },
  {
    key: 'flip',
    label: 'FLIP Management',
    category: 'compliance',
    description: 'Electronic FLIPs Continuity Binder (DAFMAN 13-204V2 §2.5.2.18): account overview, local FLIP list, reference library, non-procedural FLIP change coordination with AFM approval, and documented FLIP edition reviews with sequential Custodian→NAMO→AFM sign-off.',
    useCase: 'Units with an appointed primary/alternate FLIPs manager tracking FLIP products, edition reviews, and non-procedural changes.',
    hrefs: ['/flip'],
    setupSteps: [],
    defaultEnabled: false,
    appliesTo: ['usaf', 'faa_part139'],
  },
  {
    key: 'sms',
    label: 'Safety Management System',
    category: 'compliance',
    description: 'Safety Management System per 14 CFR §139.401–415 (Part 139 SMS Final Rule) — Safety Policy, hazard register with 5×5 risk matrix, mitigations, Safety Performance Indicators, internal audits, Management of Change, and anonymous public safety reporting.',
    useCase: 'Required for Class I–III commercial-service airports per the FAA SMS Final Rule (April 2025 deadline for Class III). Implements all four AC 150/5200-37A pillars: Policy, SRM, SA, and Promotion.',
    hrefs: ['/sms', '/sms/policy', '/sms/hazards', '/sms/spis', '/sms/audits', '/sms/moc', '/sms/reports', '/sms/communications'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['faa_part139'],
  },
  {
    key: 'training_part139',
    label: 'Training (§139.303)',
    category: 'compliance',
    description: '§139.303 training records per 14 CFR Part 139 — topic catalog, per-user records with 24-month retention, AAAE / ACE professional certificates, compliance matrix, and 30-day expiry digest.',
    useCase: 'Required for Class I–IV Part 139 airports. Demonstrates personnel training currency to FAA inspectors. Seeds the 13 §139.303(e) topics on every civilian base.',
    hrefs: ['/training', '/training/topics', '/training/roster', '/training/compliance'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['faa_part139'],
  },
  {
    key: 'aep',
    label: 'Airport Emergency Plan',
    category: 'emergency',
    description: 'Airport Emergency Plan per 14 CFR §139.325 — versioned plan document with AE annual sign-off, response-agency roster, periodic comms checks, and the triennial full-scale / annual tabletop drill program. Drill completions feed SMS Safety Performance Indicators.',
    useCase: 'Required for all Part 139 airports. Replaces the USAF Secondary Crash Net module on civilian bases.',
    hrefs: ['/aep', '/aep/plan', '/aep/agencies', '/aep/comms-checks', '/aep/drills'],
    setupSteps: ['aepagencies'],
    defaultEnabled: true,
    appliesTo: ['faa_part139'],
  },
  {
    key: 'field_conditions',
    label: 'Field Conditions / TALPA',
    category: 'core-ops',
    description: 'Runway condition assessment per AC 150/5200-30D — per-third RwyCC matrix, treatment log, FICON NOTAM text generator for FAA NOTAM Manager. Required when surface conditions degrade.',
    useCase: 'Required for all Part 139 airports issuing winter / wet-pavement field conditions. Replaces ad-hoc spreadsheets with auditable per-third tracking.',
    hrefs: ['/field-conditions'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['faa_part139'],
  },
  {
    key: 'whmp',
    label: 'Wildlife Hazard Management Plan',
    category: 'compliance',
    description: 'Annual Wildlife Hazard Management Plan per 14 CFR §139.337 — versioned WHMP artifact with FAA acceptance + AE annual sign-off + hazardous species register + mitigation summary. Findings deep-link into the SMS hazard register.',
    useCase: 'Required for Part 139 airports with significant wildlife hazards. The strike + sighting capture in the existing /wildlife module feeds the annual assessment narrative.',
    hrefs: ['/wildlife/whmp'],
    setupSteps: [],
    defaultEnabled: true,
    appliesTo: ['faa_part139'],
  },
  {
    key: 'read_file',
    label: 'Read File',
    category: 'compliance',
    description: 'Read-and-initial continuity file — leadership uploads documents that airfield management personnel must read and acknowledge, with a per-version audit trail and a compliance report.',
    useCase: 'Distribute OIs, policy letters, and read-and-initial items to airfield management personnel and track who has reviewed each one.',
    hrefs: ['/read-file'],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'local_regs',
    label: 'Local Regulations',
    category: 'compliance',
    description: 'Recurring review of standing local regulations — base OIs, wing instructions, and local supplements. Leadership uploads the current PDFs; airfield management personnel re-review each on a monthly or quarterly cadence, with per-document compliance visibility and a review report.',
    useCase: 'Keep airfield management personnel current on locally-issued regulations with a recurring read-and-attest cadence, and show at a glance who has reviewed the current edition of each document.',
    // Surface is a self-gated "Base Regs" tab on the always-on /regulations
    // route, so no hrefs (no nav item, no HREF_TO_MODULE mapping) and no
    // wizard step. Applies to both airport modes (no appliesTo) — local SOPs
    // follow the same rhythm on civilian Part 139 bases.
    hrefs: [],
    setupSteps: [],
    defaultEnabled: true,
  },
  {
    key: 'fpr',
    label: 'Flight Planning Room Check',
    category: 'core-ops',
    description: 'Per-shift Flight Planning Room check log — verify FLIP currency, charts, forms, and NOTAM display against a locally configured checklist.',
    useCase: 'Bases that want a per-shift, per-item record of the Flight Planning Room check instead of a free-text Events Log entry, with a reviewable 30-day history and monthly PDF export.',
    hrefs: ['/fpr'],
    setupSteps: ['fprchecklist'],
    defaultEnabled: false,
    appliesTo: ['usaf'],
  },
  {
    key: 'driving_checks',
    label: 'Airfield Driving Spot Check',
    category: 'core-ops',
    description: 'Log airfield driving enforcement spot checks — driver identification, AF Form 483 verification, vehicle details, and a locally configured item list — with a filterable history and an Airfield Operations Board-ready PDF export.',
    useCase: 'Bases conducting random airfield driving enforcement checks under DAFI 13-213, Airfield Driving, that want a structured record instead of free-text Events Log entries, with pass-rate trending and a by-checker report.',
    hrefs: ['/driving-checks'],
    setupSteps: ['drivingcheckitems'],
    defaultEnabled: false,
    appliesTo: ['usaf'],
  },
]

export const ALWAYS_ON_HREFS: ReadonlySet<string> = new Set([
  '/',
  '/dashboard',
  '/activity',
  '/recent-activity',
  '/more',
  '/help',
  '/settings',
  '/settings/base-setup',
  '/settings/base-setup/modules',
  '/settings/users',
  '/users',
  '/reports',
  '/regulations',
  '/aircraft',
  '/library',
])

const HREF_TO_MODULE: ReadonlyMap<string, ModuleKey> = (() => {
  const m = new Map<string, ModuleKey>()
  for (const mod of MODULES) {
    for (const href of mod.hrefs) m.set(href, mod.key)
  }
  return m
})()

const SETUP_STEP_TO_MODULE: ReadonlyMap<WizardStepKey, ModuleKey> = (() => {
  const m = new Map<WizardStepKey, ModuleKey>()
  for (const mod of MODULES) {
    for (const step of mod.setupSteps) m.set(step, mod.key)
  }
  return m
})()

/** Wizard steps that are always required regardless of module selection.
 *  These capture the physical airfield itself — runways, taxiways, areas,
 *  ARFF, facilities — and are prerequisites for almost every module. */
export const CORE_WIZARD_STEPS: ReadonlySet<WizardStepKey> = new Set<WizardStepKey>([
  'runways',
  'taxiways',
  'areas',
  'arff',
  'facilities',
])

const ALWAYS_ON_HREFS_ARR: string[] = Array.from(ALWAYS_ON_HREFS)
const HREF_TO_MODULE_ENTRIES: Array<[string, ModuleKey]> = Array.from(HREF_TO_MODULE.entries())
const MODULE_BY_KEY: ReadonlyMap<ModuleKey, ModuleDef> = new Map(MODULES.map(m => [m.key, m]))

/**
 * Returns true when a module is permitted for an airport_type. A
 * module without `appliesTo` applies to both modes (default). Used
 * by isModuleEnabled to filter civilian-only / USAF-only modules,
 * and by the Base Configuration module selector to hide modules that
 * don't apply to the base's airport type.
 */
export function moduleAppliesToAirport(key: ModuleKey, airportType: AirportType | null | undefined): boolean {
  const mod = MODULE_BY_KEY.get(key)
  if (!mod?.appliesTo) return true
  if (!airportType) return true // unknown mode → fail open
  return mod.appliesTo.includes(airportType)
}

export function isModuleEnabled(
  href: string,
  enabledModules: readonly string[] | null | undefined,
  airportType?: AirportType | null,
): boolean {
  if (ALWAYS_ON_HREFS.has(href)) return true
  // Allow sub-paths like /discrepancies/new, /reports/lighting
  for (const alwaysOn of ALWAYS_ON_HREFS_ARR) {
    if (alwaysOn !== '/' && href.startsWith(alwaysOn + '/')) return true
  }
  const enabled = new Set(enabledModules ?? [])
  const directKey = HREF_TO_MODULE.get(href)
  if (directKey) {
    return enabled.has(directKey) && moduleAppliesToAirport(directKey, airportType)
  }
  // Sub-path fallback: /discrepancies/abc → /discrepancies
  for (const [prefix, key] of HREF_TO_MODULE_ENTRIES) {
    if (href.startsWith(prefix + '/')) {
      return enabled.has(key) && moduleAppliesToAirport(key, airportType)
    }
  }
  // Unknown href: fail open so unrelated pages aren't accidentally hidden.
  return true
}

export function isWizardStepEnabled(
  step: WizardStepKey,
  enabledModules: readonly string[] | null | undefined,
  airportType?: AirportType | null,
): boolean {
  if (CORE_WIZARD_STEPS.has(step)) return true
  const key = SETUP_STEP_TO_MODULE.get(step)
  if (!key) return true
  if (!new Set(enabledModules ?? []).has(key)) return false
  return moduleAppliesToAirport(key, airportType)
}

export type SetupStepStatus = 'complete' | 'skipped' | 'in_progress'
export type SetupProgressEntry = {
  status: SetupStepStatus
  completed_at?: string
  completed_by?: string
}
export type SetupProgress = Record<string, SetupProgressEntry>

export function isStepDone(step: WizardStepKey, progress: SetupProgress | null | undefined): boolean {
  const entry = progress?.[step]
  return entry?.status === 'complete' || entry?.status === 'skipped'
}

export function isModuleSetupComplete(
  moduleKey: ModuleKey,
  progress: SetupProgress | null | undefined,
): boolean {
  const mod = MODULES.find(m => m.key === moduleKey)
  if (!mod) return true
  if (mod.setupSteps.length === 0) return true
  return mod.setupSteps.every(step => isStepDone(step, progress))
}

export const TYPICAL_BASE_PRESET: ModuleKey[] = MODULES
  .filter(m => m.defaultEnabled)
  .map(m => m.key)

export const ALL_TOGGLEABLE_MODULES: ModuleKey[] = MODULES.map(m => m.key)

/**
 * The modules that apply to a given airport_type — USAF-only modules
 * (SCN, AMTR, ACSI) are dropped on civilian bases and civilian-only
 * Part 139 modules (SMS, AEP, §139.303 Training, Field Conditions, WHMP)
 * are dropped on USAF bases. Passing null/undefined returns all modules
 * (fail open). Use to scope the Base Configuration module selector and
 * its presets so each base only sees relevant modules.
 */
export function modulesForAirport(airportType?: AirportType | null): ModuleDef[] {
  return MODULES.filter(m => moduleAppliesToAirport(m.key, airportType))
}

export function getModulesByCategory(
  airportType?: AirportType | null,
): Record<ModuleCategory, ModuleDef[]> {
  const out: Record<ModuleCategory, ModuleDef[]> = {
    'core-ops': [],
    emergency: [],
    compliance: [],
    optional: [],
  }
  for (const mod of MODULES) {
    if (!moduleAppliesToAirport(mod.key, airportType)) continue
    out[mod.category].push(mod)
  }
  return out
}

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  'core-ops': 'Core Airfield Operations',
  emergency: 'Emergency Response',
  compliance: 'Compliance & Reporting',
  optional: 'Optional Tools',
}
