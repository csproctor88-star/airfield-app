// UFC 3-260-01 Obstruction Evaluation Engine
// Evaluates an object against all 6 imaginary surfaces defined in
// UFC 3-260-01, Chapter 3, using actual runway geometry.

import { INSTALLATION } from '@/lib/constants'
import {
  type LatLon,
  type RunwayGeometry,
  getRunwayGeometry,
  pointToRunwayRelation,
  distanceFt,
  offsetPoint,
  normalizeBearing,
} from './geometry'

// ---------------------------------------------------------------------------
// Surface criteria — UFC 3-260-01, Sec 3-15 & Table 3-7 (Class B)
// ---------------------------------------------------------------------------

export const IMAGINARY_SURFACES = {
  primary: {
    name: 'Primary Surface',
    criteria: { halfWidth: 1000, extension: 200, maxHeight: 0 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may protrude above the primary surface elevation (runway elevation) within {halfWidth} ft of centerline and {extension} ft beyond each runway end.',
    description: 'No objects permitted above runway elevation within the primary surface boundaries.',
    color: '#EF4444',
  },
  approach_departure: {
    name: 'Approach-Departure Clearance Surface',
    criteria: { slope: 50, innerHalfWidth: 1000, outerHalfWidth: 2550, length: 25000 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may penetrate the 50:1 approach-departure clearance surface extending {length} ft from the primary surface end.',
    description: '50:1 slope extending from each end of the primary surface.',
    color: '#F97316',
  },
  inner_horizontal: {
    name: 'Inner Horizontal Surface',
    criteria: { height: 150, radius: 13120 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may protrude above 150 ft above the established airfield elevation within a {radius} ft radius of the runway ends.',
    description: '150 ft above established airfield elevation within {radius} ft.',
    color: '#22C55E',
  },
  conical: {
    name: 'Conical Surface',
    criteria: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may penetrate the 20:1 conical surface extending 7,000 ft outward from the inner horizontal surface boundary.',
    description: '20:1 slope outward from inner horizontal to 500 ft AGL.',
    color: '#3B82F6',
  },
  outer_horizontal: {
    name: 'Outer Horizontal Surface',
    criteria: { height: 500, radius: 42250 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may protrude above 500 ft above the established airfield elevation within a {radius} ft radius of the runway ends.',
    description: '500 ft above established airfield elevation within {radius} ft.',
    color: '#8B5CF6',
  },
  transitional: {
    name: 'Transitional Surface',
    criteria: { slope: 7, primaryHalfWidth: 1000 },
    ufcRef: 'UFC 3-260-01, Sec 3-15 & Table 3-7',
    ufcCriteria: 'No object may penetrate the 7:1 transitional surface extending from the primary surface and approach-departure surface edges to the inner horizontal surface height (150 ft).',
    description: '7:1 slope from primary/approach edges to inner horizontal height.',
    color: '#EAB308',
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
}

// ---------------------------------------------------------------------------
// Evaluation engine
// ---------------------------------------------------------------------------

function getDefaultRunwayGeometry(): RunwayGeometry {
  const rwy = INSTALLATION.runways[0]
  return getRunwayGeometry(rwy)
}

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
 * Full obstruction evaluation against all 6 UFC 3-260-01 imaginary surfaces.
 */
export function evaluateObstruction(
  point: LatLon,
  obstructionHeightAGL: number,
  groundElevationMSL: number | null,
  rwy?: RunwayGeometry,
): ObstructionAnalysis {
  const runway = rwy || getDefaultRunwayGeometry()
  const airfieldElev = INSTALLATION.elevation_msl
  const groundElev = groundElevationMSL ?? airfieldElev
  const obstructionTopMSL = groundElev + obstructionHeightAGL
  const heightAboveField = obstructionTopMSL - airfieldElev

  const relation = pointToRunwayRelation(point, runway)
  const stadiumDist = distanceFromStadiumCenter(point, runway)

  const surfaces: SurfaceEvaluation[] = []

  // --- 1. Primary Surface ---
  {
    const c = IMAGINARY_SURFACES.primary.criteria
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
    })
  }

  // --- 2. Approach-Departure Clearance Surface ---
  {
    const c = IMAGINARY_SURFACES.approach_departure.criteria
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
    const maxHeightAboveField = distAlongApproach / c.slope
    const maxMSL = airfieldElev + maxHeightAboveField
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
    })
  }

  // --- 3. Transitional Surface ---
  // Per UFC 3-260-01 Para 3-1.6, the transitional surface extends from the edges
  // of both the primary surface AND the approach-departure clearance surface,
  // outward and upward at 7:1 to the inner horizontal surface height (150 ft).
  {
    const c = IMAGINARY_SURFACES.transitional.criteria
    const ac = IMAGINARY_SURFACES.approach_departure.criteria
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
    })
  }

  // --- 4. Inner Horizontal Surface ---
  // Excludes areas already governed by primary, approach-departure, or transitional.
  {
    const c = IMAGINARY_SURFACES.inner_horizontal.criteria
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
    })
  }

  // --- 5. Conical Surface ---
  {
    const c = IMAGINARY_SURFACES.conical.criteria
    const innerR = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
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
    })
  }

  // --- 6. Outer Horizontal Surface ---
  {
    const c = IMAGINARY_SURFACES.outer_horizontal.criteria
    const innerR = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
    const conicalExtent = IMAGINARY_SURFACES.conical.criteria.horizontalExtent
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
    })
  }

  // --- Aggregate results ---
  const violatedSurfaces = surfaces.filter((s) => s.violated)
  const hasViolation = violatedSurfaces.length > 0

  // Controlling surface = the one with the lowest max allowable height
  // among surfaces the point is within.
  const applicableSurfaces = surfaces.filter((s) => s.isWithinBounds)
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
 * Quick surface identification — which surface zone does this point fall in?
 * Returns the name of the controlling (most restrictive) surface.
 */
export function identifySurface(point: LatLon, rwy?: RunwayGeometry): string {
  const runway = rwy || getDefaultRunwayGeometry()
  const analysis = evaluateObstruction(point, 0, null, runway)
  return analysis.controllingSurface?.surfaceName ?? 'Outside all surfaces'
}
