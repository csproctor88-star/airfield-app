// UFC 3-260-01 Surface Criteria by Runway Class
// Class B: Table 3-7 (Air Force)
// Army Class B: Table 3-8 (Army)

export interface SurfaceCriteria {
  clear_zone: { halfWidth: number; length: number; maxHeight: number }
  graded_area: { halfWidth: number; length: number; maxHeight: number }
  primary: { halfWidth: number; extension: number; maxHeight: number }
  approach_departure: { slope: number; innerHalfWidth: number; outerHalfWidth: number; length: number }
  inner_horizontal: { height: number; radius: number }
  conical: { slope: number; horizontalExtent: number; baseHeight: number }
  outer_horizontal: { height: number; radius: number }
  transitional: { slope: number; primaryHalfWidth: number }
  apz_i: { halfWidth: number; length: number; startOffset: number }
  apz_ii: { halfWidth: number; length: number; startOffset: number }
}

// UFC 3-260-01, Table 3-7 — Class B (Air Force)
const CLASS_B: SurfaceCriteria = {
  clear_zone:         { halfWidth: 1500, length: 3000, maxHeight: 0 },
  graded_area:        { halfWidth: 1500, length: 1000, maxHeight: 0 },
  primary:            { halfWidth: 1000, extension: 200, maxHeight: 0 },
  approach_departure: { slope: 50, innerHalfWidth: 1000, outerHalfWidth: 2550, length: 25000 },
  inner_horizontal:   { height: 150, radius: 13120 },
  conical:            { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
  outer_horizontal:   { height: 500, radius: 42250 },
  transitional:       { slope: 7, primaryHalfWidth: 1000 },
  apz_i:              { halfWidth: 1500, length: 5000, startOffset: 3000 },
  apz_ii:             { halfWidth: 1500, length: 7000, startOffset: 8000 },
}

// UFC 3-260-01, Table 3-8 — Army Class B
// Same surface geometry as Air Force Class B per UFC 3-260-01 §3-15.
// Army uses identical imaginary surface dimensions for Class B runways;
// differences are in operational procedures and waivers, not geometry.
const ARMY_CLASS_B: SurfaceCriteria = {
  clear_zone:         { halfWidth: 1500, length: 3000, maxHeight: 0 },
  graded_area:        { halfWidth: 1500, length: 1000, maxHeight: 0 },
  primary:            { halfWidth: 1000, extension: 200, maxHeight: 0 },
  approach_departure: { slope: 50, innerHalfWidth: 1000, outerHalfWidth: 2550, length: 25000 },
  inner_horizontal:   { height: 150, radius: 13120 },
  conical:            { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
  outer_horizontal:   { height: 500, radius: 42250 },
  transitional:       { slope: 7, primaryHalfWidth: 1000 },
  apz_i:              { halfWidth: 1500, length: 5000, startOffset: 3000 },
  apz_ii:             { halfWidth: 1500, length: 7000, startOffset: 8000 },
}

export const SURFACE_CRITERIA: Record<string, SurfaceCriteria> = {
  B: CLASS_B,
  Army_B: ARMY_CLASS_B,
}

export function getSurfaceCriteria(runwayClass: string): SurfaceCriteria {
  const criteria = SURFACE_CRITERIA[runwayClass]
  if (!criteria) {
    console.warn(`Unknown runway class "${runwayClass}", falling back to Class B`)
    return CLASS_B
  }
  return criteria
}
