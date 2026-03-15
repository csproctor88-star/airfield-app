// UFC 3-260-01 Taxiway Clearance Criteria by Taxiway Design Group (TDG)
//
// Source: UFC 3-260-01, Table 3-1 (Taxiway Dimensional Standards)
// TDG is determined by cockpit-to-main-gear distance and main gear width.
//
// All dimensions in feet, measured from taxiway centerline unless noted.

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

// UFC 3-260-01, Table 3-1 — Taxiway Design Standards
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

// Taxilane criteria — narrower clearances than taxiways
// UFC 3-260-01, Table 3-1 footnotes / Taxilane standards
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

/** Get the OFA half-width for a given TDG and type */
export function getOFAHalfWidth(tdg: number, type: 'taxiway' | 'taxilane' = 'taxiway'): number {
  if (type === 'taxilane') {
    return TAXILANE_CRITERIA[tdg]?.ofaHalfWidth ?? TAXILANE_CRITERIA[3].ofaHalfWidth
  }
  return TAXIWAY_CRITERIA[tdg]?.ofaHalfWidth ?? TAXIWAY_CRITERIA[3].ofaHalfWidth
}

/** Get the safety area half-width for a given TDG */
export function getSafetyAreaHalfWidth(tdg: number): number {
  return TAXIWAY_CRITERIA[tdg]?.safetyAreaHalfWidth ?? TAXIWAY_CRITERIA[3].safetyAreaHalfWidth
}

/** Get full criteria for a TDG */
export function getTaxiwayCriteria(tdg: number): TaxiwayCriteria {
  return TAXIWAY_CRITERIA[tdg] ?? TAXIWAY_CRITERIA[3]
}

// Taxiway surface definitions for obstruction evaluation display
export const TAXIWAY_SURFACES = {
  taxiway_ofa: {
    name: 'Taxiway Object Free Area',
    ufcRef: 'UFC 3-260-01, Table 3-1 (Taxiway Object Free Area)',
    ufcCriteria: 'No object may protrude above the taxiway elevation within the Object Free Area ({ofaWidth} ft wide for TDG-{tdg}).',
    description: 'Area centered on taxiway centerline that must be clear of objects above taxiway elevation.',
    color: '#F59E0B',
  },
  taxiway_safety_area: {
    name: 'Taxiway Safety Area',
    ufcRef: 'UFC 3-260-01, Table 3-1 (Taxiway Safety Area)',
    ufcCriteria: 'The Taxiway Safety Area ({safetyWidth} ft wide for TDG-{tdg}) must be cleared, graded, drained, and free of objects other than those required for air navigation or ground maneuvering.',
    description: 'Cleared, graded, and drained area centered on taxiway centerline.',
    color: '#FB923C',
  },
} as const
