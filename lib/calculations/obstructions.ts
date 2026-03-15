// UFC 3-260-01 Obstruction Evaluation Engine
// Evaluates an object against all imaginary surfaces defined in
// UFC 3-260-01, Chapter 3, plus APZ I/II land-use zones per
// DoD Instruction 4165.57, using actual runway geometry.
// Supports multiple runway classes (B, Army_B) via surface-criteria lookup.

import {
  type LatLon,
  type RunwayGeometry,
  getRunwayGeometry,
  pointToRunwayRelation,
  distanceFt,
  offsetPoint,
  normalizeBearing,
  pointToPolylineDistanceFt,
} from './geometry'
import { getSurfaceCriteria, type SurfaceCriteria } from './surface-criteria'
import {
  getOFAHalfWidth,
  getSafetyAreaHalfWidth,
  getTaxiwayCriteria,
  TAXIWAY_SURFACES,
} from './taxiway-criteria'

// ---------------------------------------------------------------------------
// Surface display metadata — UFC references, names, colors, descriptions
// Numeric criteria are looked up dynamically by runway class.
// ---------------------------------------------------------------------------

export const IMAGINARY_SURFACES = {
  clear_zone: {
    name: 'Runway Clear Zone',
    criteria: { halfWidth: 1500, length: 3000, maxHeight: 0 },
    ufcRef: 'UFC 3-260-01, Chapter 3 & Appendix B, Section 13; DoD Instruction 4165.57, Table 1 (Runway Clear Zone)',
    ufcCriteria: 'The clear zone must remain essentially obstruction free. No fixed or non-frangible objects permitted within {length} ft x {width} ft from each runway end unless meeting B13 permissible deviation criteria.',
    description: 'Obstruction-free zone extending 3,000 ft from each runway threshold, 3,000 ft wide.',
    color: '#EC4899',
  },
  graded_area: {
    name: 'Graded Portion of Clear Zone',
    criteria: { halfWidth: 1500, length: 1000, maxHeight: 0 },
    ufcRef: 'UFC 3-260-01, Chapter 3 & Appendix B, Section 13 (Graded Portion of Clear Zone)',
    ufcCriteria: 'The graded portion ({length} ft from runway end, {width} ft wide) must be rough graded and obstruction free. No above-ground fixed obstacles, structures, rigid poles, towers, or non-frangible equipment permitted.',
    description: 'Rough-graded, obstruction-free portion of the clear zone extending 1,000 ft from each threshold, 3,000 ft wide.',
    color: '#F43F5E',
  },
  primary: {
    name: 'Primary Surface',
    criteria: { halfWidth: 1000, extension: 200, maxHeight: 0 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 1 (Primary Surface)',
    ufcCriteria: 'No object may protrude above the primary surface elevation (runway elevation) within {halfWidth} ft of centerline and {extension} ft beyond each runway end.',
    description: 'No objects permitted above runway elevation within the primary surface boundaries.',
    color: '#EF4444',
  },
  approach_departure: {
    name: 'Approach-Departure Clearance Surface',
    criteria: { slope: 50, innerHalfWidth: 1000, outerHalfWidth: 2550, length: 25000 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 2 (Approach-Departure Clearance Surface)',
    ufcCriteria: 'No object may penetrate the 50:1 approach-departure clearance surface extending {length} ft from the primary surface end.',
    description: '50:1 slope extending from each end of the primary surface.',
    color: '#F97316',
  },
  inner_horizontal: {
    name: 'Inner Horizontal Surface',
    criteria: { height: 150, radius: 13120 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 4 (Inner Horizontal Surface)',
    ufcCriteria: 'No object may protrude above 150 ft above the established airfield elevation within a {radius} ft radius of the runway ends.',
    description: '150 ft above established airfield elevation within {radius} ft.',
    color: '#22C55E',
  },
  conical: {
    name: 'Conical Surface',
    criteria: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 5 (Conical Surface)',
    ufcCriteria: 'No object may penetrate the 20:1 conical surface extending 7,000 ft outward from the inner horizontal surface boundary.',
    description: '20:1 slope outward from inner horizontal to 500 ft AGL.',
    color: '#3B82F6',
  },
  outer_horizontal: {
    name: 'Outer Horizontal Surface',
    criteria: { height: 500, radius: 42250 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 6 (Outer Horizontal Surface)',
    ufcCriteria: 'No object may protrude above 500 ft above the established airfield elevation within a {radius} ft radius of the runway ends.',
    description: '500 ft above established airfield elevation within {radius} ft.',
    color: '#8B5CF6',
  },
  transitional: {
    name: 'Transitional Surface',
    criteria: { slope: 7, primaryHalfWidth: 1000 },
    ufcRef: 'UFC 3-260-01, Table 3-7, Item 3 (Transitional Surface)',
    ufcCriteria: 'No object may penetrate the 7:1 transitional surface extending from the primary surface and approach-departure surface edges to the inner horizontal surface height (150 ft).',
    description: '7:1 slope from primary/approach edges to inner horizontal height.',
    color: '#EAB308',
  },
  apz_i: {
    name: 'APZ I (Accident Potential Zone I)',
    criteria: { halfWidth: 1500, length: 5000, startOffset: 3000 },
    ufcRef: 'DoD Instruction 4165.57, Table 1 (APZ I)',
    ufcCriteria: 'APZ I — High accident risk zone. Only very low-density uses allowed: agriculture, grazing, open space, surface parking (no structures), roads with minimal traffic, and essential utility corridors. No residential, schools, hospitals, assembly uses, or high-occupancy facilities permitted.',
    description: 'High accident risk zone extending 5,000 ft beyond the clear zone, 3,000 ft wide.',
    color: '#D946EF',
  },
  apz_ii: {
    name: 'APZ II (Accident Potential Zone II)',
    criteria: { halfWidth: 1500, length: 7000, startOffset: 8000 },
    ufcRef: 'DoD Instruction 4165.57, Table 1 (APZ II)',
    ufcCriteria: 'APZ II — Moderate accident risk zone. Low-density commercial/industrial allowed: warehouses with low personnel density, open storage yards, and some limited community facilities (case-by-case). Residential strongly discouraged. High-density or high-occupancy uses prohibited.',
    description: 'Moderate accident risk zone extending 7,000 ft beyond APZ I, 3,000 ft wide.',
    color: '#A78BFA',
  },
} as const

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type SurfaceEvaluation = {
  surfaceKey: string
  surfaceName: string
  isWithinBounds: boolean
  maxAllowableHeightAGL: number
  maxAllowableHeightMSL: number
  obstructionTopMSL: number
  violated: boolean
  penetrationFt: number
  ufcReference: string
  ufcCriteria: string
  color: string
  runwayLabel?: string
  // Calculation transparency fields
  baselineElevation?: number   // The elevation used as the surface baseline (threshold or airfield)
  baselineLabel?: string       // Human label, e.g. "RWY 06L threshold" or "Airfield elevation"
  calculationBreakdown?: string // Step-by-step formula, e.g. "539.1 ft + 12,500 ft / 50 = 789.1 ft MSL"
}

export type ObstructionAnalysis = {
  // Location data
  point: LatLon
  groundElevationMSL: number
  obstructionHeightAGL: number
  obstructionTopMSL: number

  // Runway relationship
  distanceFromCenterline: number
  alongTrackFromMidpoint: number
  nearerEnd: 'end1' | 'end2'
  side: 'left' | 'right'

  // Surface evaluations
  surfaces: SurfaceEvaluation[]
  hasViolation: boolean
  controllingSurface: SurfaceEvaluation | null
  violatedSurfaces: SurfaceEvaluation[]

  // Waiver guidance
  waiverGuidance: string[]

  // Multi-runway: label for which runway this analysis applies to
  runwayLabel?: string
}

export type MultiRunwayAnalysis = {
  // Per-runway results
  perRunway: { runwayLabel: string; analysis: ObstructionAnalysis }[]

  // Merged summary
  point: LatLon
  groundElevationMSL: number
  obstructionHeightAGL: number
  obstructionTopMSL: number
  hasViolation: boolean
  controllingSurface: SurfaceEvaluation | null
  violatedSurfaces: SurfaceEvaluation[]
  waiverGuidance: string[]
}

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

/**
 * Determine the distance from the nearest primary-surface end center
 * along the extended centerline axis. This is used for approach-departure
 * surface height calculations.
 */
function distanceFromNearestPrimaryEndCenter(
  point: LatLon,
  rwy: RunwayGeometry,
): { distance: number; end: 'end1' | 'end2' } {
  const extension = 200
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  const primaryEnd1 = offsetPoint(rwy.end1, revBearing, extension)
  const primaryEnd2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  const d1 = distanceFt(point, primaryEnd1)
  const d2 = distanceFt(point, primaryEnd2)

  return d1 <= d2
    ? { distance: d1, end: 'end1' }
    : { distance: d2, end: 'end2' }
}

/**
 * Determine if a point is within the stadium-shaped boundary used by
 * inner horizontal, conical, and outer horizontal surfaces.
 * The stadium is formed by arcs of `radius` around each primary surface end,
 * connected by tangent lines parallel to the centerline.
 */
function distanceFromStadiumCenter(
  point: LatLon,
  rwy: RunwayGeometry,
): number {
  // The stadium is the Minkowski sum of the runway's primary-end segment
  // with a circle of the given radius. The "distance to stadium" is just
  // the distance to the nearest point on the segment between the two
  // primary-surface end centers.
  const extension = 200
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  const primaryEnd1 = offsetPoint(rwy.end1, revBearing, extension)
  const primaryEnd2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  const relation = pointToRunwayRelation(point, rwy)

  // If the point projects onto the segment between the two primary ends,
  // the distance is just the perpendicular distance from centerline.
  const halfPrimaryLength = rwy.lengthFt / 2 + extension
  if (Math.abs(relation.alongTrackFromMidpoint) <= halfPrimaryLength) {
    return relation.distanceFromCenterline
  }

  // Otherwise, the distance is to the nearer primary-end center
  const d1 = distanceFt(point, primaryEnd1)
  const d2 = distanceFt(point, primaryEnd2)
  return Math.min(d1, d2)
}

/**
 * Full obstruction evaluation against all UFC 3-260-01 imaginary surfaces.
 * Surface dimensions are determined by `runwayClass` (defaults to 'B').
 */
export function evaluateObstruction(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  rwy: RunwayGeometry,
  airfieldElevMSL = 580,
  runwayClass = 'B',
): ObstructionAnalysis {
  const runway = rwy
  const airfieldElev = airfieldElevMSL
  const criteria = getSurfaceCriteria(runwayClass)
  const groundElev = groundElevationMSL ?? airfieldElev
  const obstructionTopMSL = groundElev + obstructionHeightAGL
  const heightAboveField = obstructionTopMSL - airfieldElev

  const relation = pointToRunwayRelation(point, runway)
  const stadiumDist = distanceFromStadiumCenter(point, runway)

  // Helper: format a number with commas
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

  // Airfield baseline label
  const airfieldBaselineLabel = 'Airfield elevation'

  const surfaces: SurfaceEvaluation[] = []

  // Helper: along-track distances from each threshold (positive = beyond threshold, away from runway)
  const halfLength = runway.lengthFt / 2
  const beyondEnd1 = Math.max(0, -(relation.alongTrackFromMidpoint + halfLength))
  const beyondEnd2 = Math.max(0, relation.alongTrackFromMidpoint - halfLength)

  // --- 1. Primary Surface ---
  {
    const c = criteria.primary
    const isWithin = relation.withinPrimary
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'primary',
      surfaceName: IMAGINARY_SURFACES.primary.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.primary.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.primary.ufcCriteria
        .replace('{halfWidth}', String(c.halfWidth))
        .replace('{extension}', String(c.extension)),
      color: IMAGINARY_SURFACES.primary.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 2. Approach-Departure Clearance Surface ---
  // Per UFC 3-260-01, the approach-departure surface rises at 50:1 from the
  // threshold (primary surface end) elevation. When per-threshold elevations
  // are provided via RunwayGeometry, use the nearer threshold's elevation as
  // the baseline; otherwise fall back to the airfield-wide elevation.
  {
    const c = criteria.approach_departure
    // Distance from nearest primary surface end along extended centerline
    const primaryEndInfo = distanceFromNearestPrimaryEndCenter(point, runway)
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd

    // Is the point within the approach-departure zone?
    // It must be beyond the primary surface end and within the trapezoidal boundary.
    const beyondPrimary = !relation.withinPrimary && distAlongApproach > 0
    const withinLength = distAlongApproach <= c.length

    // The trapezoid width expands linearly
    const widthAtDistance =
      c.innerHalfWidth +
      (distAlongApproach / c.length) * (c.outerHalfWidth - c.innerHalfWidth)
    const withinWidth = relation.distanceFromCenterline <= widthAtDistance

    const isWithin = beyondPrimary && withinLength && withinWidth

    // Use the threshold elevation of the nearer runway end as the surface baseline
    const thresholdElev = primaryEndInfo.end === 'end1'
      ? (runway.end1ElevationMSL ?? airfieldElev)
      : (runway.end2ElevationMSL ?? airfieldElev)

    const nearerDesignator = primaryEndInfo.end === 'end1'
      ? runway.end1Designator
      : runway.end2Designator

    const usedThreshold = primaryEndInfo.end === 'end1'
      ? runway.end1ElevationMSL !== undefined
      : runway.end2ElevationMSL !== undefined

    const thresholdLabel = nearerDesignator
      ? `RWY ${nearerDesignator} threshold`
      : usedThreshold
        ? `Nearest threshold (${primaryEndInfo.end})`
        : 'Airfield elevation (threshold not set)'

    const maxHeightAboveThreshold = distAlongApproach / c.slope
    const maxMSL = thresholdElev + maxHeightAboveThreshold
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'approach_departure',
      surfaceName: IMAGINARY_SURFACES.approach_departure.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.approach_departure.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.approach_departure.ufcCriteria
        .replace('{length}', String(c.length).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
      color: IMAGINARY_SURFACES.approach_departure.color,
      baselineElevation: thresholdElev,
      baselineLabel: thresholdLabel,
      calculationBreakdown: `${fmt(thresholdElev)} ft (${thresholdLabel}) + ${fmt(distAlongApproach)} ft / ${c.slope} (slope) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 3. Transitional Surface ---
  // Per UFC 3-260-01 Para 3-1.6, the transitional surface extends from the edges
  // of both the primary surface AND the approach-departure clearance surface,
  // outward and upward at 7:1 to the inner horizontal surface height (150 ft).
  {
    const c = criteria.transitional
    const ac = criteria.approach_departure
    const primaryHalfWidth = c.primaryHalfWidth
    const maxTransitionalExtent = 150 * c.slope // 1050 ft

    // Case A: Along the primary surface (point is abeam the primary surface rectangle)
    const distFromPrimaryEdge = Math.max(0, relation.distanceFromCenterline - primaryHalfWidth)
    const withinPrimaryTransitional =
      distFromPrimaryEdge > 0 &&
      distFromPrimaryEdge <= maxTransitionalExtent &&
      relation.withinPrimary === false &&
      Math.abs(relation.alongTrackFromMidpoint) <= (runway.lengthFt / 2 + 200)

    // Case B: Along the approach-departure surface edges
    // The approach trapezoid expands linearly from innerHalfWidth to outerHalfWidth.
    // The transitional applies to the sides of this trapezoid up to 150 ft height,
    // which corresponds to 7,500 ft along the approach (150 * 50 = 7,500).
    const approachCutoff = 150 * ac.slope // 7,500 ft — beyond here height >= 150 ft
    const distAlongApproach = relation.distanceFromNearestPrimaryEnd
    const beyondPrimary = !relation.withinPrimary && distAlongApproach > 0
    const withinApproachCutoff = distAlongApproach <= approachCutoff

    // Width of approach trapezoid at this point's along-track distance
    const approachEdgeHalfWidth = beyondPrimary
      ? ac.innerHalfWidth +
        (distAlongApproach / ac.length) * (ac.outerHalfWidth - ac.innerHalfWidth)
      : primaryHalfWidth

    const distFromApproachEdge = beyondPrimary
      ? Math.max(0, relation.distanceFromCenterline - approachEdgeHalfWidth)
      : Infinity

    const withinApproachTransitional =
      beyondPrimary &&
      withinApproachCutoff &&
      distFromApproachEdge > 0 &&
      distFromApproachEdge <= maxTransitionalExtent

    const isWithin = withinPrimaryTransitional || withinApproachTransitional

    // Use the smaller distance from edge (more restrictive = lower allowable height)
    const distFromEdge = Math.min(
      withinPrimaryTransitional ? distFromPrimaryEdge : Infinity,
      withinApproachTransitional ? distFromApproachEdge : Infinity,
    )

    const maxHeightAboveField = isWithin ? distFromEdge / c.slope : 0
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'transitional',
      surfaceName: IMAGINARY_SURFACES.transitional.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.transitional.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.transitional.ufcCriteria,
      color: IMAGINARY_SURFACES.transitional.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: isWithin
        ? `${fmt(airfieldElev)} ft (airfield elev) + ${fmt(distFromEdge)} ft / ${criteria.transitional.slope} (slope) = ${fmt(maxMSL)} ft MSL`
        : undefined,
    })
  }

  // --- 4. Inner Horizontal Surface ---
  // Excludes areas already governed by primary, approach-departure, or transitional.
  {
    const c = criteria.inner_horizontal
    const inMoreSpecificSurface = surfaces.some(
      (s) => s.isWithinBounds && (s.surfaceKey === 'primary' || s.surfaceKey === 'approach_departure' || s.surfaceKey === 'transitional'),
    )
    const isWithin = stadiumDist <= c.radius && !inMoreSpecificSurface
    const maxMSL = airfieldElev + c.height
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'inner_horizontal',
      surfaceName: IMAGINARY_SURFACES.inner_horizontal.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.inner_horizontal.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.inner_horizontal.ufcCriteria
        .replace('{radius}', String(c.radius).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
      color: IMAGINARY_SURFACES.inner_horizontal.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.height} ft (fixed height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 5. Conical Surface ---
  {
    const c = criteria.conical
    const innerR = criteria.inner_horizontal.radius
    const distFromInnerH = Math.max(0, stadiumDist - innerR)
    const isWithin = stadiumDist > innerR && distFromInnerH <= c.horizontalExtent
    const maxHeightAboveField = c.baseHeight + distFromInnerH / c.slope
    const maxMSL = airfieldElev + maxHeightAboveField
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'conical',
      surfaceName: IMAGINARY_SURFACES.conical.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: Math.max(0, maxAGL),
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.conical.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.conical.ufcCriteria,
      color: IMAGINARY_SURFACES.conical.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.baseHeight} ft (base) + ${fmt(distFromInnerH)} ft / ${c.slope} (slope) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- 6. Outer Horizontal Surface ---
  {
    const c = criteria.outer_horizontal
    const innerR = criteria.inner_horizontal.radius
    const conicalExtent = criteria.conical.horizontalExtent
    const conicalOuterR = innerR + conicalExtent
    const isWithin = stadiumDist > conicalOuterR && stadiumDist <= c.radius
    const maxMSL = airfieldElev + c.height
    const maxAGL = maxMSL - groundElev
    const violated = isWithin && obstructionTopMSL > maxMSL

    surfaces.push({
      surfaceKey: 'outer_horizontal',
      surfaceName: IMAGINARY_SURFACES.outer_horizontal.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.outer_horizontal.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.outer_horizontal.ufcCriteria
        .replace('{radius}', String(c.radius).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
      color: IMAGINARY_SURFACES.outer_horizontal.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${c.height} ft (fixed height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- Clear Zone (both ends) ---
  // Listed after height-restriction surfaces so it appears at the bottom of analysis results.
  {
    const c = criteria.clear_zone
    const withinEnd1 = beyondEnd1 > 0 && beyondEnd1 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > 0 && beyondEnd2 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'clear_zone',
      surfaceName: IMAGINARY_SURFACES.clear_zone.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.clear_zone.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.clear_zone.ufcCriteria
        .replace('{length}', String(c.length).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        .replace('{width}', String(c.halfWidth * 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
      color: IMAGINARY_SURFACES.clear_zone.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- Graded Portion of Clear Zone (both ends) ---
  {
    const c = criteria.graded_area
    const withinEnd1 = beyondEnd1 > 0 && beyondEnd1 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > 0 && beyondEnd2 <= c.length && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    const maxAGL = c.maxHeight // 0 ft
    const maxMSL = airfieldElev + maxAGL
    const violated = isWithin && obstructionTopMSL > maxMSL
    surfaces.push({
      surfaceKey: 'graded_area',
      surfaceName: IMAGINARY_SURFACES.graded_area.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: maxAGL,
      maxAllowableHeightMSL: maxMSL,
      obstructionTopMSL,
      violated,
      penetrationFt: violated ? obstructionTopMSL - maxMSL : 0,
      ufcReference: IMAGINARY_SURFACES.graded_area.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.graded_area.ufcCriteria
        .replace('{length}', String(c.length).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
        .replace('{width}', String(c.halfWidth * 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
      color: IMAGINARY_SURFACES.graded_area.color,
      baselineElevation: airfieldElev,
      baselineLabel: airfieldBaselineLabel,
      calculationBreakdown: `${fmt(airfieldElev)} ft (airfield elev) + ${maxAGL} ft (max height) = ${fmt(maxMSL)} ft MSL`,
    })
  }

  // --- APZ I (Accident Potential Zone I) ---
  // Land-use zone, no height restriction. 3,000–8,000 ft from threshold, 3,000 ft wide.
  {
    const c = criteria.apz_i
    const withinEnd1 = beyondEnd1 > c.startOffset && beyondEnd1 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > c.startOffset && beyondEnd2 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    surfaces.push({
      surfaceKey: 'apz_i',
      surfaceName: IMAGINARY_SURFACES.apz_i.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: -1,
      maxAllowableHeightMSL: -1,
      obstructionTopMSL,
      violated: false,
      penetrationFt: 0,
      ufcReference: IMAGINARY_SURFACES.apz_i.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.apz_i.ufcCriteria,
      color: IMAGINARY_SURFACES.apz_i.color,
    })
  }

  // --- APZ II (Accident Potential Zone II) ---
  // Land-use zone, no height restriction. 8,000–15,000 ft from threshold, 3,000 ft wide.
  {
    const c = criteria.apz_ii
    const withinEnd1 = beyondEnd1 > c.startOffset && beyondEnd1 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const withinEnd2 = beyondEnd2 > c.startOffset && beyondEnd2 <= (c.startOffset + c.length) && relation.distanceFromCenterline <= c.halfWidth
    const isWithin = withinEnd1 || withinEnd2
    surfaces.push({
      surfaceKey: 'apz_ii',
      surfaceName: IMAGINARY_SURFACES.apz_ii.name,
      isWithinBounds: isWithin,
      maxAllowableHeightAGL: -1,
      maxAllowableHeightMSL: -1,
      obstructionTopMSL,
      violated: false,
      penetrationFt: 0,
      ufcReference: IMAGINARY_SURFACES.apz_ii.ufcRef,
      ufcCriteria: IMAGINARY_SURFACES.apz_ii.ufcCriteria,
      color: IMAGINARY_SURFACES.apz_ii.color,
    })
  }

  // --- Aggregate results ---
  const violatedSurfaces = surfaces.filter((s) => s.violated)
  const hasViolation = violatedSurfaces.length > 0

  // Controlling surface = the one with the lowest max allowable height
  // among height-restricted surfaces the point is within.
  // Land-use zones (APZ I/II, maxAllowableHeightMSL === -1) are excluded.
  const applicableSurfaces = surfaces.filter((s) => s.isWithinBounds && s.maxAllowableHeightMSL !== -1)
  const controllingSurface = applicableSurfaces.length > 0
    ? applicableSurfaces.reduce((min, s) =>
        s.maxAllowableHeightMSL < min.maxAllowableHeightMSL ? s : min,
      )
    : null

  // --- Waiver guidance ---
  const waiverGuidance: string[] = []
  if (hasViolation) {
    waiverGuidance.push(
      'OBSTRUCTION VIOLATION DETECTED — The following actions are required:',
    )
    waiverGuidance.push(
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
    )
    waiverGuidance.push(
      '2. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding any obstruction that may affect flying operations, approach/departure procedures, or instrument procedures.',
    )
    waiverGuidance.push(
      '3. Submit a work order to CES and coordinate with the BCE to request a Permanent or Temporary Airspace Criteria Waiver.',
    )
    for (const vs of violatedSurfaces) {
      waiverGuidance.push(
        `4. ${vs.surfaceName} violation (${vs.penetrationFt.toFixed(1)} ft penetration) — Reference: ${vs.ufcReference}`,
      )
    }
  }

  return {
    point,
    groundElevationMSL: groundElev,
    obstructionHeightAGL,
    obstructionTopMSL,
    distanceFromCenterline: relation.distanceFromCenterline,
    alongTrackFromMidpoint: relation.alongTrackFromMidpoint,
    nearerEnd: relation.nearerEnd,
    side: relation.side,
    surfaces,
    hasViolation,
    controllingSurface,
    violatedSurfaces,
    waiverGuidance,
  }
}

/**
 * Evaluate an obstruction against ALL runways at an airfield.
 * Returns per-runway results plus a merged summary with the most restrictive
 * controlling surface across all runways.
 */
export function evaluateObstructionAllRunways(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  runwayGeometries: { label: string; geometry: RunwayGeometry }[],
  airfieldElevMSL = 580,
  runwayClass = 'B',
): MultiRunwayAnalysis {
  const perRunway = runwayGeometries.map(({ label, geometry }) => {
    const analysis = evaluateObstruction(
      point,
      obstructionHeightAGL,
      groundElevationMSL,
      geometry,
      airfieldElevMSL,
      runwayClass,
    )
    // Tag each surface evaluation with the runway label
    for (const s of analysis.surfaces) {
      s.runwayLabel = label
    }
    analysis.runwayLabel = label
    return { runwayLabel: label, analysis }
  })

  const groundElev = groundElevationMSL ?? airfieldElevMSL
  const obstructionTopMSL = groundElev + obstructionHeightAGL

  // Merge: any violation across any runway
  const hasViolation = perRunway.some((r) => r.analysis.hasViolation)

  // Collect all violated surfaces across all runways
  const violatedSurfaces = perRunway.flatMap((r) => r.analysis.violatedSurfaces)

  // Controlling surface = the most restrictive (lowest max allowable height)
  // across all runways
  const allApplicable = perRunway.flatMap((r) =>
    r.analysis.surfaces.filter((s) => s.isWithinBounds && s.maxAllowableHeightMSL !== -1),
  )
  const controllingSurface = allApplicable.length > 0
    ? allApplicable.reduce((min, s) =>
        s.maxAllowableHeightMSL < min.maxAllowableHeightMSL ? s : min,
      )
    : null

  // Merge waiver guidance
  const waiverGuidance: string[] = []
  if (hasViolation) {
    waiverGuidance.push(
      'OBSTRUCTION VIOLATION DETECTED — The following actions are required:',
    )
    waiverGuidance.push(
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
    )
    waiverGuidance.push(
      '2. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding any obstruction that may affect flying operations, approach/departure procedures, or instrument procedures.',
    )
    waiverGuidance.push(
      '3. Submit a work order to CES and coordinate with the BCE to request a Permanent or Temporary Airspace Criteria Waiver.',
    )
    for (const vs of violatedSurfaces) {
      waiverGuidance.push(
        `4. ${vs.surfaceName} violation on RWY ${vs.runwayLabel} (${vs.penetrationFt.toFixed(1)} ft penetration) — Reference: ${vs.ufcReference}`,
      )
    }
  }

  return {
    perRunway,
    point,
    groundElevationMSL: groundElev,
    obstructionHeightAGL,
    obstructionTopMSL,
    hasViolation,
    controllingSurface,
    violatedSurfaces,
    waiverGuidance,
  }
}

/**
 * Quick surface identification — which surface zone does this point fall in?
 * Returns the name of the controlling (most restrictive) surface.
 * Supports single or multiple runways.
 */
export function identifySurface(
  point: LatLon,
  rwy: RunwayGeometry | RunwayGeometry[],
  airfieldElevMSL = 580,
  runwayClass = 'B',
): string {
  const runways = Array.isArray(rwy) ? rwy : [rwy]
  // Evaluate against each runway, find the most restrictive surface
  let bestSurface: SurfaceEvaluation | null = null
  let bestLandUse: SurfaceEvaluation | null = null

  for (const runway of runways) {
    const analysis = evaluateObstruction(point, 0, null, runway, airfieldElevMSL, runwayClass)
    if (analysis.controllingSurface) {
      if (!bestSurface || analysis.controllingSurface.maxAllowableHeightMSL < bestSurface.maxAllowableHeightMSL) {
        bestSurface = analysis.controllingSurface
      }
    }
    if (!bestLandUse) {
      const landUseZone = analysis.surfaces.find((s) => s.isWithinBounds && s.maxAllowableHeightMSL === -1)
      if (landUseZone) bestLandUse = landUseZone
    }
  }

  if (bestSurface) return bestSurface.surfaceName
  if (bestLandUse) return bestLandUse.surfaceName
  return 'Outside all surfaces'
}

// ---------------------------------------------------------------------------
// Taxiway surface evaluation (UFC 3-260-01, Table 3-1)
// ---------------------------------------------------------------------------

export type TaxiwayGeometry = {
  id: string
  designator: string
  taxiwayType: 'taxiway' | 'taxilane'
  tdg: number
  centerline: LatLon[]
}

export type TaxiwaySurfaceEvaluation = {
  taxiwayId: string
  taxiwayDesignator: string
  distanceFromCenterlineFt: number
  surfaceKey: 'taxiway_ofa' | 'taxiway_safety_area'
  surfaceName: string
  isWithinBounds: boolean
  violated: boolean
  ufcReference: string
  ufcCriteria: string
  color: string
  halfWidthFt: number
}

/**
 * Evaluate an obstruction against all taxiway surfaces.
 * Returns evaluations for each taxiway's OFA and Safety Area.
 */
export function evaluateObstructionTaxiways(
  point: LatLon,
  taxiways: TaxiwayGeometry[],
): TaxiwaySurfaceEvaluation[] {
  const results: TaxiwaySurfaceEvaluation[] = []

  for (const tw of taxiways) {
    if (tw.centerline.length < 2) continue

    const dist = pointToPolylineDistanceFt(point, tw.centerline)
    const criteria = getTaxiwayCriteria(tw.tdg)
    const ofaHalf = getOFAHalfWidth(tw.tdg, tw.taxiwayType)
    const safetyHalf = getSafetyAreaHalfWidth(tw.tdg)

    // OFA evaluation
    const inOFA = dist <= ofaHalf
    results.push({
      taxiwayId: tw.id,
      taxiwayDesignator: tw.designator,
      distanceFromCenterlineFt: Math.round(dist),
      surfaceKey: 'taxiway_ofa',
      surfaceName: `TWY ${tw.designator} Object Free Area`,
      isWithinBounds: inOFA,
      violated: inOFA,
      ufcReference: TAXIWAY_SURFACES.taxiway_ofa.ufcRef,
      ufcCriteria: TAXIWAY_SURFACES.taxiway_ofa.ufcCriteria
        .replace('{ofaWidth}', String(ofaHalf * 2))
        .replace('{tdg}', String(tw.tdg)),
      color: TAXIWAY_SURFACES.taxiway_ofa.color,
      halfWidthFt: ofaHalf,
    })

    // Safety Area evaluation
    const inSafety = dist <= safetyHalf
    results.push({
      taxiwayId: tw.id,
      taxiwayDesignator: tw.designator,
      distanceFromCenterlineFt: Math.round(dist),
      surfaceKey: 'taxiway_safety_area',
      surfaceName: `TWY ${tw.designator} Safety Area`,
      isWithinBounds: inSafety,
      violated: inSafety,
      ufcReference: TAXIWAY_SURFACES.taxiway_safety_area.ufcRef,
      ufcCriteria: TAXIWAY_SURFACES.taxiway_safety_area.ufcCriteria
        .replace('{safetyWidth}', String(safetyHalf * 2))
        .replace('{tdg}', String(tw.tdg)),
      color: TAXIWAY_SURFACES.taxiway_safety_area.color,
      halfWidthFt: safetyHalf,
    })
  }

  return results
}
