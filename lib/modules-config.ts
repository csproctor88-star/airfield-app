import type { UserRole } from '@/lib/supabase/types'

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
  | 'lighting'
  | 'wildlife'
  | 'statusboards'
  | 'pprcolumns'
  | 'feedback'

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
    description: 'Airfield Certification and Safety Inspection — the annual ACSI per DAFMAN 13-204v2 §5.4.3.',
    useCase: 'Enable if your base completes the annual ACSI per AF policy.',
    hrefs: ['/acsi'],
    setupSteps: [],
    defaultEnabled: true,
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
    description: 'Wildlife sightings and strikes with BASH heatmap and trend reporting per DAFI 91-212.',
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
]

export const ALWAYS_ON_HREFS: ReadonlySet<string> = new Set([
  '/',
  '/dashboard',
  '/activity',
  '/recent-activity',
  '/more',
  '/training',
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

export function isModuleEnabled(href: string, enabledModules: readonly string[] | null | undefined): boolean {
  if (ALWAYS_ON_HREFS.has(href)) return true
  // Allow sub-paths like /discrepancies/new, /reports/lighting
  for (const alwaysOn of ALWAYS_ON_HREFS_ARR) {
    if (alwaysOn !== '/' && href.startsWith(alwaysOn + '/')) return true
  }
  const enabled = new Set(enabledModules ?? [])
  const directKey = HREF_TO_MODULE.get(href)
  if (directKey) return enabled.has(directKey)
  // Sub-path fallback: /discrepancies/abc → /discrepancies
  for (const [prefix, key] of HREF_TO_MODULE_ENTRIES) {
    if (href.startsWith(prefix + '/')) return enabled.has(key)
  }
  // Unknown href: fail open so unrelated pages aren't accidentally hidden.
  return true
}

export function isWizardStepEnabled(step: WizardStepKey, enabledModules: readonly string[] | null | undefined): boolean {
  if (CORE_WIZARD_STEPS.has(step)) return true
  const key = SETUP_STEP_TO_MODULE.get(step)
  if (!key) return true
  return new Set(enabledModules ?? []).has(key)
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

export function getModulesByCategory(): Record<ModuleCategory, ModuleDef[]> {
  const out: Record<ModuleCategory, ModuleDef[]> = {
    'core-ops': [],
    emergency: [],
    compliance: [],
    optional: [],
  }
  for (const mod of MODULES) out[mod.category].push(mod)
  return out
}

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  'core-ops': 'Core Airfield Operations',
  emergency: 'Emergency Response',
  compliance: 'Compliance & Reporting',
  optional: 'Optional Tools',
}
