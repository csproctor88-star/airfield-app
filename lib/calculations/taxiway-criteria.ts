// Taxiway Clearance Criteria — Dual Standard Support
//
// FAA: AC 150/5300-13A, Table 4-1 (Taxiway Design Group 1–7)
// UFC: UFC 3-260-01 (4 Feb 2019, Change 3), Table 5-1 (Fixed-Wing Taxiways)
//
// All dimensions in feet, measured from taxiway centerline unless noted.

// ─────────────────────────────────────────────────────────
// FAA AC 150/5300-13A — Taxiway Design Group (TDG) System
// ─────────────────────────────────────────────────────────

export interface TaxiwayCriteria {
  /** Taxiway Design Group (1–7) */
  tdg: number
  /** TDG label for display */
  label: string
  /** Representative ADG range */
  adgRange: string
  /** Minimum taxiway pavement width (ft) */
  pavementWidth: number
  /** Taxiway shoulder width (ft, each side) */
  shoulderWidth: number
  /** Taxiway Safety Area half-width from centerline (ft) — graded, drained, no objects */
  safetyAreaHalfWidth: number
  /** Taxiway Object Free Area half-width from centerline (ft) — no objects above taxiway elevation */
  ofaHalfWidth: number
  /** Wingtip clearance (ft) — distance from pavement edge to nearest object */
  wingtipClearance: number
}

// FAA AC 150/5300-13A, Table 4-1 — Taxiway Design Standards
// These are the TAXIWAY values. Taxilane values are narrower (separate table below).
export const TAXIWAY_CRITERIA: Record<number, TaxiwayCriteria> = {
  1: {
    tdg: 1,
    label: 'TDG-1',
    adgRange: 'ADG I (small GA)',
    pavementWidth: 25,
    shoulderWidth: 10,
    safetyAreaHalfWidth: 49,
    ofaHalfWidth: 89,
    wingtipClearance: 26,
  },
  2: {
    tdg: 2,
    label: 'TDG-2',
    adgRange: 'ADG I–II',
    pavementWidth: 35,
    shoulderWidth: 10,
    safetyAreaHalfWidth: 65,
    ofaHalfWidth: 131,
    wingtipClearance: 40,
  },
  3: {
    tdg: 3,
    label: 'TDG-3',
    adgRange: 'ADG III (737, C-130)',
    pavementWidth: 50,
    shoulderWidth: 20,
    safetyAreaHalfWidth: 81,
    ofaHalfWidth: 186,
    wingtipClearance: 44,
  },
  4: {
    tdg: 4,
    label: 'TDG-4',
    adgRange: 'ADG IV (757, 767, C-17)',
    pavementWidth: 75,
    shoulderWidth: 25,
    safetyAreaHalfWidth: 118,
    ofaHalfWidth: 259,
    wingtipClearance: 72,
  },
  5: {
    tdg: 5,
    label: 'TDG-5',
    adgRange: 'ADG V (777, 747, C-5)',
    pavementWidth: 75,
    shoulderWidth: 35,
    safetyAreaHalfWidth: 140,
    ofaHalfWidth: 320,
    wingtipClearance: 80,
  },
  6: {
    tdg: 6,
    label: 'TDG-6',
    adgRange: 'ADG VI (A380)',
    pavementWidth: 100,
    shoulderWidth: 40,
    safetyAreaHalfWidth: 171,
    ofaHalfWidth: 386,
    wingtipClearance: 97,
  },
  7: {
    tdg: 7,
    label: 'TDG-7',
    adgRange: 'ADG VII (future heavy)',
    pavementWidth: 100,
    shoulderWidth: 40,
    safetyAreaHalfWidth: 190,
    ofaHalfWidth: 420,
    wingtipClearance: 110,
  },
}

// FAA AC 150/5300-13A — Taxilane criteria (narrower clearances than taxiways)
export interface TaxilaneCriteria {
  tdg: number
  ofaHalfWidth: number
  wingtipClearance: number
}

export const TAXILANE_CRITERIA: Record<number, TaxilaneCriteria> = {
  1: { tdg: 1, ofaHalfWidth: 79, wingtipClearance: 21 },
  2: { tdg: 2, ofaHalfWidth: 115, wingtipClearance: 26 },
  3: { tdg: 3, ofaHalfWidth: 162, wingtipClearance: 31 },
  4: { tdg: 4, ofaHalfWidth: 225, wingtipClearance: 50 },
  5: { tdg: 5, ofaHalfWidth: 276, wingtipClearance: 56 },
  6: { tdg: 6, ofaHalfWidth: 334, wingtipClearance: 66 },
  7: { tdg: 7, ofaHalfWidth: 370, wingtipClearance: 76 },
}

// ─────────────────────────────────────────────────────────
// UFC 3-260-01, Table 5-1 — Fixed-Wing Taxiway Standards
// ─────────────────────────────────────────────────────────

export type RunwayClass = 'A' | 'B'
export type ServiceBranch = 'army' | 'air_force' | 'navy_mc'

export interface UfcTaxiwayCriteria {
  /** Runway class (A or B) */
  runwayClass: RunwayClass
  /** Service branch */
  serviceBranch: ServiceBranch
  /** Display label */
  label: string
  /** Taxiway pavement width (ft) — Table 5-1, Item 1 */
  pavementWidthFt: number
  /** Total shoulder width, each side (ft) — Table 5-1, Item 2 */
  shoulderWidthFt: number
  /** Paved shoulder width (ft) — Table 5-1, Item 3 */
  pavedShoulderWidthFt: number
  /** Clearance from CL to fixed/mobile obstacles (ft) — Table 5-1, Item 10 (Taxiway Clearance Line) */
  clearanceLineFt: number
  /** Distance between parallel taxiway/taxilane centerlines (ft) — Table 5-1, Item 11 */
  parallelSpacingFt: number
  /** Parallel spacing note — "or wingspan + X ft, whichever is greater" */
  parallelSpacingNote: string
}

// UFC 3-260-01, Table 5-1 criteria by runway class × service branch
export const UFC_TAXIWAY_CRITERIA: UfcTaxiwayCriteria[] = [
  {
    runwayClass: 'A',
    serviceBranch: 'army',
    label: 'Class A — Army',
    pavementWidthFt: 50,
    shoulderWidthFt: 25,
    pavedShoulderWidthFt: 25,
    clearanceLineFt: 150,
    parallelSpacingFt: 175,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
  {
    runwayClass: 'A',
    serviceBranch: 'air_force',
    label: 'Class A — Air Force',
    pavementWidthFt: 50,
    shoulderWidthFt: 25,
    pavedShoulderWidthFt: 25,
    clearanceLineFt: 150,
    parallelSpacingFt: 175,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
  {
    runwayClass: 'A',
    serviceBranch: 'navy_mc',
    label: 'Class A — Navy/MC',
    pavementWidthFt: 40,
    shoulderWidthFt: 25,
    pavedShoulderWidthFt: 50,
    clearanceLineFt: 150,
    parallelSpacingFt: 175,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
  {
    runwayClass: 'B',
    serviceBranch: 'army',
    label: 'Class B — Army',
    pavementWidthFt: 75,
    shoulderWidthFt: 50,
    pavedShoulderWidthFt: 25,
    clearanceLineFt: 150,
    parallelSpacingFt: 187,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
  {
    runwayClass: 'B',
    serviceBranch: 'air_force',
    label: 'Class B — Air Force',
    pavementWidthFt: 75,
    shoulderWidthFt: 50,
    pavedShoulderWidthFt: 25,
    clearanceLineFt: 200,
    parallelSpacingFt: 237,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
  {
    runwayClass: 'B',
    serviceBranch: 'navy_mc',
    label: 'Class B — Navy/MC',
    pavementWidthFt: 75,
    shoulderWidthFt: 50,
    pavedShoulderWidthFt: 50,
    clearanceLineFt: 150,
    parallelSpacingFt: 237,
    parallelSpacingNote: 'or wingspan + 50 ft, whichever is greater',
  },
]

/** Look up UFC criteria for a given runway class and service branch */
export function getUfcCriteria(
  runwayClass: RunwayClass,
  serviceBranch: ServiceBranch,
): UfcTaxiwayCriteria {
  return (
    UFC_TAXIWAY_CRITERIA.find(
      c => c.runwayClass === runwayClass && c.serviceBranch === serviceBranch,
    ) ?? UFC_TAXIWAY_CRITERIA[0] // fallback to Class A Army
  )
}

// ─────────────────────────────────────────────────────────
// Unified accessor functions (work with both standards)
// ─────────────────────────────────────────────────────────

export type TaxiwayStandard = 'faa' | 'ufc'

export interface TaxiwayConfig {
  standard: TaxiwayStandard
  // FAA fields
  tdg?: number | null
  taxiwayType?: 'taxiway' | 'taxilane'
  // UFC fields
  runwayClass?: RunwayClass | null
  serviceBranch?: ServiceBranch | null
}

/** Get the obstacle clearance half-width from centerline (ft) for any standard */
export function getClearanceHalfWidth(config: TaxiwayConfig): number {
  if (config.standard === 'ufc') {
    const rc = config.runwayClass || 'A'
    const sb = config.serviceBranch || 'air_force'
    return getUfcCriteria(rc, sb).clearanceLineFt
  }
  // FAA
  return getOFAHalfWidth(config.tdg ?? 3, config.taxiwayType ?? 'taxiway')
}

/** Get the safety area half-width (FAA only — UFC has no separate safety area) */
export function getSafetyHalfWidth(config: TaxiwayConfig): number | null {
  if (config.standard === 'ufc') return null // UFC Table 5-1 has no separate safety area
  return getSafetyAreaHalfWidth(config.tdg ?? 3)
}

/** Get display label for a taxiway's clearance standard */
export function getClearanceLabel(config: TaxiwayConfig): string {
  if (config.standard === 'ufc') {
    const rc = config.runwayClass || 'A'
    const sb = config.serviceBranch || 'air_force'
    const c = getUfcCriteria(rc, sb)
    return `${c.label} — ${c.clearanceLineFt}ft clearance line`
  }
  const tdg = config.tdg ?? 3
  const type = config.taxiwayType ?? 'taxiway'
  const ofa = getOFAHalfWidth(tdg, type) * 2
  const safety = getSafetyAreaHalfWidth(tdg) * 2
  return `TDG-${tdg} — OFA ${ofa}ft / Safety ${safety}ft`
}

// ─────────────────────────────────────────────────────────
// Legacy accessor functions (FAA TDG — kept for compatibility)
// ─────────────────────────────────────────────────────────

/** Get the OFA half-width for a given FAA TDG and type */
export function getOFAHalfWidth(tdg: number, type: 'taxiway' | 'taxilane' = 'taxiway'): number {
  if (type === 'taxilane') {
    return TAXILANE_CRITERIA[tdg]?.ofaHalfWidth ?? TAXILANE_CRITERIA[3].ofaHalfWidth
  }
  return TAXIWAY_CRITERIA[tdg]?.ofaHalfWidth ?? TAXIWAY_CRITERIA[3].ofaHalfWidth
}

/** Get the safety area half-width for a given FAA TDG */
export function getSafetyAreaHalfWidth(tdg: number): number {
  return TAXIWAY_CRITERIA[tdg]?.safetyAreaHalfWidth ?? TAXIWAY_CRITERIA[3].safetyAreaHalfWidth
}

/** Get full FAA criteria for a TDG */
export function getTaxiwayCriteria(tdg: number): TaxiwayCriteria {
  return TAXIWAY_CRITERIA[tdg] ?? TAXIWAY_CRITERIA[3]
}

// ─────────────────────────────────────────────────────────
// Surface definitions for obstruction evaluation display
// ─────────────────────────────────────────────────────────

export const TAXIWAY_SURFACES = {
  taxiway_ofa: {
    name: 'Taxiway Object Free Area',
    ufcRef: 'FAA AC 150/5300-13A, Table 4-1 (Taxiway Object Free Area)',
    ufcCriteria: 'No object may protrude above the taxiway elevation within the Object Free Area ({ofaWidth} ft wide for TDG-{tdg}).',
    description: 'Area centered on taxiway centerline that must be clear of objects above taxiway elevation.',
    color: '#F59E0B',
  },
  taxiway_safety_area: {
    name: 'Taxiway Safety Area',
    ufcRef: 'FAA AC 150/5300-13A, Table 4-1 (Taxiway Safety Area)',
    ufcCriteria: 'The Taxiway Safety Area ({safetyWidth} ft wide for TDG-{tdg}) must be cleared, graded, drained, and free of objects other than those required for air navigation or ground maneuvering.',
    description: 'Cleared, graded, and drained area centered on taxiway centerline.',
    color: '#FB923C',
  },
  taxiway_clearance_line: {
    name: 'Taxiway Clearance Line',
    ufcRef: 'UFC 3-260-01, Table 5-1, Item 10 (Taxiway Clearance Line)',
    ufcCriteria: 'Minimum clearance from taxiway centerline to fixed or mobile obstacles is {clearanceFt} ft for {classLabel}.',
    description: 'No fixed or mobile obstacles may be located within this distance from the taxiway centerline.',
    color: '#F59E0B',
  },
} as const
