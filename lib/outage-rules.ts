// Outage compliance engine — DAFMAN 13-204v2 Table A3.1
// Calculates outage status for lighting system components and detects violations

import type { InfrastructureFeature, LightingSystem, LightingSystemComponent } from '@/lib/supabase/types'

// ── Types ──

export type OutageStatus = {
  componentId: string
  componentLabel: string
  componentType: string
  totalCount: number
  inoperativeCount: number
  outagePct: number
  allowablePct: number | null
  allowableCount: number | null
  allowableConsecutive: number | null
  allowableNoAdjacent: boolean
  isZeroTolerance: boolean
  isExceeded: boolean
  isApproaching: boolean
  hasAdjacentViolation: boolean
  hasConsecutiveViolation: boolean
  allowableOutageText: string | null
  requiredActions: {
    notam: boolean
    notifyCE: boolean
    systemShutoff: boolean
    notifyTerps: boolean
    obstructionNotamAttrs: boolean
  }
  notamTemplate: string | null
  qCode: string | null
}

export type SystemHealthStatus = 'operational' | 'degraded' | 'exceeded' | 'inoperative'

export type SystemHealth = {
  systemId: string
  systemName: string
  systemType: string
  runwayOrTaxiway: string | null
  isPrecision: boolean
  status: SystemHealthStatus
  components: OutageStatus[]
  totalFeatures: number
  inoperativeFeatures: number
  overallOutagePct: number
  worstComponent: OutageStatus | null
  exceededComponents: OutageStatus[]
  approachingComponents: OutageStatus[]
}

// Alert tier for UI rendering
export type AlertTier = 'green' | 'yellow' | 'red' | 'black'

export function getAlertTier(health: SystemHealth): AlertTier {
  if (health.status === 'inoperative') return 'black'
  if (health.exceededComponents.length > 0) return 'red'
  if (health.approachingComponents.length > 0) return 'yellow'
  return 'green'
}

export const ALERT_TIER_CONFIG: Record<AlertTier, { label: string; color: string; bg: string }> = {
  green: { label: 'Operational', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  yellow: { label: 'Approaching Limit', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  red: { label: 'Exceeded', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  black: { label: 'System Inoperative', color: '#EF4444', bg: 'rgba(239,68,68,0.2)' },
}

// ── System type labels ──

export const SYSTEM_TYPE_LABELS: Record<string, string> = {
  alsf1: 'ALSF-1',
  alsf2: 'ALSF-2',
  ssalr: 'SSALR',
  malsr: 'MALSR',
  sals: 'SALS',
  reil: 'REIL',
  threshold: 'Threshold Lights',
  end_lights: 'End Lights',
  runway_edge: 'Runway Edge Lights',
  runway_centerline: 'Runway Centerline Lights',
  tdz: 'Touchdown Zone Lights',
  rdr_signs: 'RDR Signs (Lighted)',
  taxiway_edge: 'Taxiway Edge Lights',
  taxiway_centerline: 'Taxiway Centerline Lights',
  taxiway_end: 'Taxiway End Lights',
  elevated_guard: 'Elevated Runway Guard Lights',
  inpavement_guard: 'In-Pavement Runway Guard Lights',
  stop_bar: 'Stop Bar Lights',
  clearance_bar: 'Taxiway Clearance Bar Lights',
  papi: 'PAPI',
  chapi: 'CHAPI',
  beacon: 'Rotating Beacon',
  obstruction_fixed: 'Fixed Obstruction Lights',
  hazard_flashing: 'Flashing Hazard Beacon',
  hazard_rotating: 'Rotating Hazard Beacon',
  windcone: 'Wind Cone',
  runway_distance_markers: 'Runway Distance Markers',
  signage: 'Airfield Signage',
  stadium_light: 'Stadium Lights',
  eals: 'EALS',
}

// System types available for selection
export const SYSTEM_TYPES = Object.keys(SYSTEM_TYPE_LABELS)
  .sort((a, b) => SYSTEM_TYPE_LABELS[a].localeCompare(SYSTEM_TYPE_LABELS[b]))

// ── DAFMAN Notes ──

export const DAFMAN_NOTES: Record<number, string> = {
  1: 'Document discrepancy and issue appropriate NOTAM(s).',
  2: 'Notify Airfield Lighting (CE Electrical).',
  3: 'Turn off affected lighting system. Notify AFM, AOF/CC, OSS/CC, OG/CC (or equivalents). Installation Commander is waiver authority for up to 24 hours. MAJCOM/A3 is waiver authority for periods > 24 hours. Waiver authority may NOT be delegated. Civil aircraft operations prohibited; other DoD components prohibited unless approved by their respective waiver authority.',
  4: 'Notify TERPs to determine impact to instrument procedures; send NOTAMs accordingly.',
  5: 'NOTAMs for unlit obstructions must contain specific attributes per FAAO JO 7930.2, 5-2-3 OBSTACLES, Items 5-10.',
}

export function getDafmanNotes(notesStr: string | null): { number: number; text: string }[] {
  if (!notesStr) return []
  return notesStr
    .split(',')
    .map((n) => parseInt(n.trim()))
    .filter((n) => !isNaN(n) && DAFMAN_NOTES[n])
    .map((n) => ({ number: n, text: DAFMAN_NOTES[n] }))
}

// ── Adjacent / Consecutive Detection ──

/** Sort features by geodesic position along a line (uses latitude + longitude) */
function sortByPosition(features: InfrastructureFeature[]): InfrastructureFeature[] {
  if (features.length <= 1) return features
  // Use the first two features to determine primary axis
  const first = features[0]
  const last = features[features.length - 1]
  const latRange = Math.abs(
    Math.max(...features.map((f) => f.latitude)) - Math.min(...features.map((f) => f.latitude)),
  )
  const lonRange = Math.abs(
    Math.max(...features.map((f) => f.longitude)) - Math.min(...features.map((f) => f.longitude)),
  )
  // Sort by the axis with more spread
  if (latRange >= lonRange) {
    return [...features].sort((a, b) => a.latitude - b.latitude)
  }
  return [...features].sort((a, b) => a.longitude - b.longitude)
}

export function detectAdjacentViolation(features: InfrastructureFeature[]): boolean {
  const sorted = sortByPosition(features)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].status === 'inoperative' && sorted[i + 1].status === 'inoperative') {
      return true
    }
  }
  return false
}

export function detectConsecutiveViolation(
  features: InfrastructureFeature[],
  maxConsecutive: number,
): boolean {
  const sorted = sortByPosition(features)
  let streak = 0
  for (const f of sorted) {
    if (f.status === 'inoperative') {
      streak++
      if (streak > maxConsecutive) return true
    } else {
      streak = 0
    }
  }
  return false
}

// ── Component Outage Calculation ──

export function calculateComponentOutage(
  component: LightingSystemComponent,
  features: InfrastructureFeature[],
  overrideFeatures?: InfrastructureFeature[],
): OutageStatus {
  // overrideFeatures is used for "overall" components that aggregate all system features
  const componentFeatures = overrideFeatures || features.filter((f) => f.system_component_id === component.id)
  const inoperativeCount = componentFeatures.filter((f) => f.status === 'inoperative').length
  const totalCount = overrideFeatures ? (component.total_count || componentFeatures.length) : (component.total_count || componentFeatures.length)
  const outagePct = totalCount > 0 ? (inoperativeCount / totalCount) * 100 : 0

  const hasAdjacentViolation = component.allowable_no_adjacent
    ? detectAdjacentViolation(componentFeatures)
    : false

  const hasConsecutiveViolation =
    component.allowable_outage_consecutive !== null
      ? detectConsecutiveViolation(componentFeatures, component.allowable_outage_consecutive)
      : false

  const isExceeded =
    (component.is_zero_tolerance && inoperativeCount > 0) ||
    (component.allowable_outage_pct !== null && outagePct > component.allowable_outage_pct) ||
    (component.allowable_outage_count !== null &&
      inoperativeCount > component.allowable_outage_count) ||
    (component.allowable_no_adjacent && hasAdjacentViolation) ||
    (component.allowable_outage_consecutive !== null && hasConsecutiveViolation)

  const isApproaching =
    !isExceeded &&
    ((component.allowable_outage_pct !== null &&
      outagePct >= component.allowable_outage_pct - 5 &&
      inoperativeCount > 0) ||
      (component.allowable_outage_count !== null &&
        inoperativeCount >= component.allowable_outage_count &&
        inoperativeCount > 0))

  return {
    componentId: component.id,
    componentLabel: component.label,
    componentType: component.component_type,
    totalCount,
    inoperativeCount,
    outagePct: Math.round(outagePct * 10) / 10,
    allowablePct: component.allowable_outage_pct,
    allowableCount: component.allowable_outage_count,
    allowableConsecutive: component.allowable_outage_consecutive,
    allowableNoAdjacent: component.allowable_no_adjacent,
    isZeroTolerance: component.is_zero_tolerance,
    isExceeded,
    isApproaching,
    hasAdjacentViolation,
    hasConsecutiveViolation,
    allowableOutageText: component.allowable_outage_text,
    requiredActions: {
      notam: component.requires_notam,
      notifyCE: component.requires_ce_notification,
      systemShutoff: component.requires_system_shutoff,
      notifyTerps: component.requires_terps_notification,
      obstructionNotamAttrs: component.requires_obstruction_notam_attrs,
    },
    notamTemplate: component.notam_text_template,
    qCode: component.q_code,
  }
}

// ── System-Level Health Calculation ──

export function calculateSystemHealth(
  system: LightingSystem,
  components: LightingSystemComponent[],
  allFeatures: InfrastructureFeature[],
): SystemHealth {
  // Filter features belonging to this system's components
  const componentIds = new Set(components.map((c) => c.id))
  const systemFeatures = allFeatures.filter(
    (f) => f.system_component_id && componentIds.has(f.system_component_id),
  )

  const componentStatuses = components.map((c) => {
    if (c.component_type === 'overall') {
      // "Overall" aggregates ALL features in the system, not just those directly assigned to it
      return calculateComponentOutage(c, allFeatures, systemFeatures)
    }
    return calculateComponentOutage(c, allFeatures)
  })

  const totalFeatures = systemFeatures.length
  const inoperativeFeatures = systemFeatures.filter((f) => f.status === 'inoperative').length
  const overallOutagePct = totalFeatures > 0 ? (inoperativeFeatures / totalFeatures) * 100 : 0

  const exceededComponents = componentStatuses.filter((c) => c.isExceeded)
  const approachingComponents = componentStatuses.filter((c) => c.isApproaching)

  // Find the "overall" component for system-level threshold
  const overallComponent = componentStatuses.find((c) => c.componentType === 'overall')

  let status: SystemHealthStatus = 'operational'
  if (overallComponent?.isExceeded) {
    status = 'inoperative'
  } else if (exceededComponents.length > 0) {
    status = 'exceeded'
  } else if (inoperativeFeatures > 0) {
    status = 'degraded'
  }

  // Worst component = first exceeded, or first approaching, or null
  const worstComponent = exceededComponents[0] || approachingComponents[0] || null

  return {
    systemId: system.id,
    systemName: system.name,
    systemType: system.system_type,
    runwayOrTaxiway: system.runway_or_taxiway,
    isPrecision: system.is_precision,
    status,
    components: componentStatuses,
    totalFeatures,
    inoperativeFeatures,
    overallOutagePct: Math.round(overallOutagePct * 10) / 10,
    worstComponent,
    exceededComponents,
    approachingComponents,
  }
}

// ── Batch Calculation for All Systems ──

export function calculateAllSystemHealth(
  systems: LightingSystem[],
  componentsBySystem: Map<string, LightingSystemComponent[]>,
  allFeatures: InfrastructureFeature[],
): SystemHealth[] {
  return systems.map((system) => {
    const components = componentsBySystem.get(system.id) || []
    return calculateSystemHealth(system, components, allFeatures)
  })
}

// ── Summary Stats ──

export function getHealthSummary(healths: SystemHealth[]): {
  total: number
  operational: number
  degraded: number
  exceeded: number
  inoperative: number
  worstTier: AlertTier
} {
  const total = healths.length
  const operational = healths.filter((h) => h.status === 'operational').length
  const degraded = healths.filter((h) => h.status === 'degraded').length
  const exceeded = healths.filter((h) => h.status === 'exceeded').length
  const inoperative = healths.filter((h) => h.status === 'inoperative').length

  let worstTier: AlertTier = 'green'
  for (const h of healths) {
    const tier = getAlertTier(h)
    if (tier === 'black') { worstTier = 'black'; break }
    if (tier === 'red') worstTier = 'red'
    else if (tier === 'yellow' && worstTier === 'green') worstTier = 'yellow'
  }

  return { total, operational, degraded, exceeded, inoperative, worstTier }
}
