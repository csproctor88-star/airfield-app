// Shared Events Log row formatters.
//
// Extracted verbatim from app/(app)/activity/page.tsx so the Records Export
// (lib/export/export-rich-modules.ts) renders the AF Form 3616-style Events Log
// from exactly the same Action + Details strings the on-screen log shows — no
// formatting drift between the two surfaces. The activity page re-imports these.
//
// Pure functions only (no React, no Supabase client): safe to call from the
// export pipeline and from unit tests. Entity *details* enrichment still comes
// from fetchEntityDetails() in activity-queries; this module only formats.
import { moduleLabel } from '@/lib/activity-labels'
import type { ActivityEntry, EntityDetails } from '@/lib/supabase/activity-queries'

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  'Inspections/Checks': 'Logged Inspection/Check',
  'AMOPS Reporting': 'Logged AMOPS Report',
  'Tower Reporting': 'Logged Tower Report',
  'Shift Changes': 'Logged Shift Change',
  'Daily Tasks': 'Logged Daily Task',
  'QRC': 'Logged QRC Entry',
  'PCAS/SCN Tests & Activations': 'Logged PCAS/SCN',
  'Personnel on Airfield': 'Logged Personnel',
  'NOTAMs': 'Logged NOTAM',
  'ARFF': 'Logged ARFF',
  'IFE/GE': 'Logged IFE/GE',
  'CMA Violations': 'Logged CMA Violation',
  'BWC Declarations': 'Logged BWC Change',
  'Miscellaneous': 'Logged Entry',
}

/** Infer action label from free-typed manual entry text */
function inferActionFromText(details: string): string | null {
  const d = (details || '').toUpperCase()
  if (d.includes('SHIFT CHANGE')) return 'Shift Change'
  if (d.includes('AMOPS OPEN')) return 'AMOPS Open'
  if (d.includes('AMOPS CLOSED') || d.includes('AMOPS CLSD')) return 'AMOPS Closed'
  if (d.includes('NOTAM CANCEL') || d.includes('NOTAMC')) return 'NOTAM Canceled'
  if (d.includes('NOTAM ISSUED') || d.includes('NOTAMN')) return 'NOTAM Issued'
  if (d.includes('NOTAM REPLACED') || d.includes('NOTAMR')) return 'NOTAM Replaced'
  if (d.includes('NOTAM EXTENDED')) return 'NOTAM Extended'
  if (d.includes('SCN CHECK')) return 'SCN Check Complete'
  if (d.includes('SCN ACTIVATED')) return 'SCN Activated'
  if (d.includes('PCAS TESTED') || d.includes('PCAS TEST')) return 'PCAS Tested'
  if (d.includes('PCAS ACTIVATED')) return 'PCAS Activated'
  if (d.includes('PTD CK') || d.includes('PTD CHECK')) return 'PTD Check'
  if (d.includes('TOWER IS NOW OPEN') || d.includes('TOWER OPEN')) return 'Tower Open'
  if (d.includes('TOWER CLOSED') || d.includes('TOWER CLSD')) return 'Tower Closed'
  if (d.includes('BWC CHANGE') || d.includes('BWC/')) return 'BWC Change'
  if (d.includes('ARFF') && d.includes('STATUS')) return 'ARFF Status'
  if (d.includes('RUNWAY') && d.includes('IN USE')) return 'Runway In Use'
  if (d.includes('OPS RESUMED')) return 'Ops Resumed'
  if (d.includes('AREA CLOSED') || (d.includes('CLOSED') && (d.includes('RWY') || d.includes('TWY')))) return 'Area Closed'
  if (d.includes('AREA SUSPENDED') || d.includes('SUSPENDED')) return 'Area Suspended'
  if (d.includes('CHECKLIST COMPLETE') || d.includes('CHECKLIST CMPLT')) return 'Checklist Complete'
  if (d.includes('UNAUTHORIZED VEHICLE') || d.includes('CMAV')) return 'CMA Violation'
  if (d.includes('ON AIRFIELD FOR') || d.includes('ON THE AFLD FOR')) return 'On Airfield'
  if (d.includes('OFF AIRFIELD') || d.includes('OFF THE AFLD')) return 'Off Airfield'
  if (d.includes('PERSONNEL') && d.includes('ON AIRFIELD')) return 'Personnel On Airfield'
  if (d.includes('PERSONNEL') && d.includes('OFF AIRFIELD')) return 'Personnel Off Airfield'
  return null
}

export function formatAction(action: string, entityType: string, displayId?: string, metadata?: Record<string, unknown> | null): string {
  // Template-based manual entries — use template label for specific action
  if (entityType === 'manual' && metadata?.template_label) {
    return metadata.template_label as string
  }
  if (entityType === 'manual' && metadata?.template_category) {
    return TEMPLATE_CATEGORY_LABELS[metadata.template_category as string] || 'Logged Entry'
  }
  // Infer action from free-typed text when no template metadata exists
  if (entityType === 'manual' && metadata?.details) {
    const inferred = inferActionFromText(metadata.details as string)
    if (inferred) return inferred
  }

  const entity = moduleLabel(entityType)
  const id = displayId ? ` ${displayId}` : ''
  const actionLabel: Record<string, string> = {
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    completed: 'Completed',
    opened: 'Opened',
    closed: 'Closed',
    status_updated: 'Status changed on',
    saved: 'Saved',
    filed: 'Filed',
    resumed: 'Resumed',
    reviewed: 'Reviewed',
    waiver_review_deleted: 'Deleted review for',
    noted: 'Logged',
    logged_personnel: 'Logged',
    personnel_off_airfield: 'Personnel Off Airfield',
    cancelled: 'Cancelled',
  }
  const label = actionLabel[action] || (action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' '))
  // Some actions are self-contained labels (don't append entity)
  if (action === 'personnel_off_airfield') return `${label}${id}`
  // For manual entries without template category, show as "Logged Entry"
  if (entityType === 'manual') return entity
  return `${label} ${entity}${id}`
}

// Known acronyms/abbreviations that should be uppercase
const ACRONYMS = new Set([
  'fod', 'ife', 'rsc', 'rcr', 'bwc', 'bash', 'qrc', 'notam', 'notams',
  'arff', 'pcas', 'scn', 'lmr', 'tacan', 'vor', 'ils', 'dme', 'ndb',
  'papi', 'vasi', 'malsr', 'gps', 'rnav', 'rwy', 'twy', 'amops',
  'na', 'id',
])

function capitalizeValue(str: string): string {
  if (!str) return str
  // If it looks like an all-caps abbreviation already, keep it
  if (str === str.toUpperCase() && str.length <= 6) return str
  // Check if the whole string is a known acronym
  if (ACRONYMS.has(str.toLowerCase())) return str.toUpperCase()
  // Title case each word, respecting known acronyms
  return str
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatMetadataValue(val: unknown): string {
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (Array.isArray(val)) return val.map(v => typeof v === 'string' ? capitalizeValue(v) : String(v)).join(', ')
  const str = String(val)
  return capitalizeValue(str)
}

// Keys to skip in generic metadata formatting (internal/redundant)
const SKIP_META_KEYS = new Set(['fields', 'field'])

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return ''
  // If metadata has a pre-formatted details string, return it uppercased
  if (typeof metadata.details === 'string') return metadata.details.toUpperCase()
  const parts: string[] = []
  for (const [key, val] of Object.entries(metadata)) {
    if (val == null || val === '' || SKIP_META_KEYS.has(key)) continue
    parts.push(formatMetadataValue(val))
  }
  return parts.join(' | ').toUpperCase()
}

export function buildDetailsString(a: ActivityEntry, detailsMap: Map<string, EntityDetails>): string {
  const parts: string[] = []

  // Add metadata-derived details
  const metaStr = formatMetadata(a.metadata)
  if (metaStr) parts.push(metaStr)

  // Add DB-fetched entity details — skip if metadata already has a formatted details string
  // to avoid duplicating title/description that's already in the metadata
  const hasFormattedMeta = a.metadata && typeof (a.metadata as Record<string, unknown>).details === 'string'
  if (!hasFormattedMeta && a.entity_id && detailsMap.has(a.entity_id)) {
    const ed = detailsMap.get(a.entity_id)!
    const dbParts: string[] = []
    if (ed.title) dbParts.push(ed.title)
    if (ed.description) dbParts.push(ed.description)
    if (ed.notes) dbParts.push(ed.notes)
    if (ed.extra) dbParts.push(ed.extra)
    if (dbParts.length) parts.push(dbParts.join(' | '))
  }

  return parts.join(' | ').toUpperCase()
}
