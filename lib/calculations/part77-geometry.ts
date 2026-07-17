// FAA 14 CFR Part 77 §77.19 plan-view surface polygons.
//
// Pure geometry: turns a runway's geometry + the per-approach-type dimensions
// held in `getPart77Surfaces` (lib/calculations/obstructions.ts) into the
// GeoJSON-style [lon, lat] rings the obstruction map component draws. No UI,
// no I/O, no map-component coupling — every dimension is supplied by the
// caller's `criteria`, never baked into a builder body.
//
// Coordinate convention matches the rest of lib/calculations/geometry.ts:
// each vertex is a [lon, lat] pair and every ring is closed (first vertex
// repeated). Arcs reuse `generateStadiumPolygon`, whose arc centers already
// sit 200 ft beyond each runway end — exactly the §77.19 construction (the
// primary surface extends 200 ft past the runway, and the horizontal-surface
// arcs are struck from the center of each primary-surface end).

import {
  offsetPoint,
  normalizeBearing,
  generateStadiumPolygon,
  type LatLon,
  type RunwayGeometry,
} from './geometry'
import { getPart77Surfaces, type FaaApproachType } from './obstructions'

// §77.19 invariants shared by every approach type (they are NOT per-type
// dimensions, so they are not carried in the per-builder `criteria`):
//   • the primary surface extends 200 ft past each runway end, and
//   • the transitional surface rises 7:1 to the 150-ft horizontal surface,
//     giving a fixed 1,050-ft ground band (150 ft × 7).
const PART77_PRIMARY_EXTENSION_FT = 200
const PART77_HORIZONTAL_HEIGHT_FT = 150
const PART77_TRANSITIONAL_SLOPE = 7
// Thin visual marker (rendering width only) for the precision slope-change line.
const SEGMENT_BREAK_THICKNESS_FT = 60

/** Shared feature shape — matches buildSurfacePolygons' output in the map component. */
export type SurfacePolygonFeature = {
  id: string
  coords: [number, number][]
  rwyIndex: number
}

export type Part77RunwayInput = {
  geometry: RunwayGeometry
  approachType?: FaaApproachType | null // NULL → non_utility_non_precision_low
}

// ---------------------------------------------------------------------------
// §77.19(c) Primary surface
// ---------------------------------------------------------------------------

/** §77.19(c): rectangle at per-type half-width, +200 ft past each end. */
export function generatePart77PrimaryPolygon(
  rwy: RunwayGeometry,
  criteria: { halfWidth: number; extension: number },
): [number, number][] {
  const { halfWidth, extension } = criteria
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  const ext1 = offsetPoint(rwy.end1, revBearing, extension)
  const ext2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  const p1 = offsetPoint(ext1, perpL, halfWidth)
  const p2 = offsetPoint(ext1, perpR, halfWidth)
  const p3 = offsetPoint(ext2, perpR, halfWidth)
  const p4 = offsetPoint(ext2, perpL, halfWidth)

  return [
    [p1.lon, p1.lat], [p2.lon, p2.lat],
    [p3.lon, p3.lat], [p4.lon, p4.lat],
    [p1.lon, p1.lat],
  ]
}

// ---------------------------------------------------------------------------
// §77.19(d) Approach trapezoids
// ---------------------------------------------------------------------------

/** One approach trapezoid, flaring uniformly from the primary-surface end. */
function buildApproachTrapezoid(
  end: LatLon,
  outwardBearing: number,
  criteria: { innerHalfWidth: number; outerHalfWidth: number; length: number },
  extensionFt: number,
): [number, number][] {
  const { innerHalfWidth, outerHalfWidth, length } = criteria
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)

  const start = offsetPoint(end, outwardBearing, extensionFt) // primary-surface end
  const far = offsetPoint(end, outwardBearing, extensionFt + length)

  const p1 = offsetPoint(start, perpL, innerHalfWidth)
  const p2 = offsetPoint(start, perpR, innerHalfWidth)
  const p3 = offsetPoint(far, perpR, outerHalfWidth)
  const p4 = offsetPoint(far, perpL, outerHalfWidth)

  return [
    [p1.lon, p1.lat], [p2.lon, p2.lat],
    [p3.lon, p3.lat], [p4.lon, p4.lat],
    [p1.lon, p1.lat],
  ]
}

/** §77.19(d): trapezoid per end from the primary-surface end (inner HW = primary HW). */
export function generatePart77ApproachPolygons(
  rwy: RunwayGeometry,
  criteria: { innerHalfWidth: number; outerHalfWidth: number; length: number },
  extensionFt: number = PART77_PRIMARY_EXTENSION_FT,
): { end1: [number, number][]; end2: [number, number][] } {
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  return {
    end1: buildApproachTrapezoid(rwy.end1, revBearing, criteria, extensionFt),
    end2: buildApproachTrapezoid(rwy.end2, rwy.bearingDeg, criteria, extensionFt),
  }
}

// ---------------------------------------------------------------------------
// §77.19(e) Transitional bands
// ---------------------------------------------------------------------------

/** §77.19(e): 7:1 bands along primary + approach edges up to 150 ft.
 *  approachCutoffFt = 150 × approach slope (7,500 ft for precision's 50:1 first segment). */
export function generatePart77TransitionalPolygons(
  rwy: RunwayGeometry,
  criteria: {
    primaryHalfWidth: number
    approachSlope: number
    approachInnerHalfWidth: number
    approachOuterHalfWidth: number
    approachLength: number
  },
): { left: [number, number][]; right: [number, number][] } {
  const {
    primaryHalfWidth,
    approachSlope,
    approachInnerHalfWidth,
    approachOuterHalfWidth,
    approachLength,
  } = criteria

  const transitionalExtent = PART77_HORIZONTAL_HEIGHT_FT * PART77_TRANSITIONAL_SLOPE // 1,050 ft
  const extension = PART77_PRIMARY_EXTENSION_FT
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  // Primary-surface ends (200 ft past each threshold).
  const ext1 = offsetPoint(rwy.end1, revBearing, extension)
  const ext2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  // Along the approach the edge itself keeps rising, so the transitional band
  // only runs to the station where the approach edge reaches 150 ft
  // (height = distance / slope = 150 → 150 × slope), clamped to the approach
  // length in case a short (e.g. 5,000-ft) approach ends first.
  const approachCutoff = Math.min(PART77_HORIZONTAL_HEIGHT_FT * approachSlope, approachLength)

  // Approach half-width at the cutoff station (uniform inner→outer flare).
  const widthAtCutoff =
    approachInnerHalfWidth +
    (approachCutoff / approachLength) * (approachOuterHalfWidth - approachInnerHalfWidth)

  const cutoff1 = offsetPoint(rwy.end1, revBearing, extension + approachCutoff)
  const cutoff2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension + approachCutoff)

  function buildSide(perpBearing: number): [number, number][] {
    // Inner edge: approach cutoff (end1) → primary edge → approach cutoff (end2).
    const aInner1 = offsetPoint(cutoff1, perpBearing, widthAtCutoff)
    const pInner1 = offsetPoint(ext1, perpBearing, primaryHalfWidth)
    const pInner2 = offsetPoint(ext2, perpBearing, primaryHalfWidth)
    const aInner2 = offsetPoint(cutoff2, perpBearing, widthAtCutoff)

    // Outer edge: inner edge pushed out by the 1,050-ft transitional band.
    const aOuter1 = offsetPoint(cutoff1, perpBearing, widthAtCutoff + transitionalExtent)
    const pOuter1 = offsetPoint(ext1, perpBearing, primaryHalfWidth + transitionalExtent)
    const pOuter2 = offsetPoint(ext2, perpBearing, primaryHalfWidth + transitionalExtent)
    const aOuter2 = offsetPoint(cutoff2, perpBearing, widthAtCutoff + transitionalExtent)

    return [
      [aInner1.lon, aInner1.lat],
      [pInner1.lon, pInner1.lat],
      [pInner2.lon, pInner2.lat],
      [aInner2.lon, aInner2.lat],
      [aOuter2.lon, aOuter2.lat],
      [pOuter2.lon, pOuter2.lat],
      [pOuter1.lon, pOuter1.lat],
      [aOuter1.lon, aOuter1.lat],
      [aInner1.lon, aInner1.lat],
    ]
  }

  return { left: buildSide(perpL), right: buildSide(perpR) }
}

// ---------------------------------------------------------------------------
// §77.19(a)/(b) Horizontal + Conical stadiums
// ---------------------------------------------------------------------------

/** §77.19(a): horizontal-surface stadium at the per-runway arc radius. */
export function generatePart77HorizontalPolygon(rwy: RunwayGeometry, radiusFt: number): [number, number][] {
  return generateStadiumPolygon(rwy, radiusFt)
}

/** §77.19(b): conical-surface stadium — horizontal radius + conical horizontal extent. */
export function generatePart77ConicalPolygon(
  rwy: RunwayGeometry,
  radiusFt: number,
  extentFt: number,
): [number, number][] {
  return generateStadiumPolygon(rwy, radiusFt + extentFt)
}

// ---------------------------------------------------------------------------
// Precision slope-change marker (50:1 → 40:1)
// ---------------------------------------------------------------------------

/** Thin cross-line spanning the approach width at the slope-change station. */
function buildSegmentBreak(
  end: LatLon,
  outwardBearing: number,
  criteria: { segmentLength: number; innerHalfWidth: number; outerHalfWidth: number; length: number },
  extensionFt: number,
): [number, number][] {
  const { segmentLength, innerHalfWidth, outerHalfWidth, length } = criteria
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)

  const station = extensionFt + segmentLength // along-track from the runway end
  const halfWidthAtStation =
    innerHalfWidth + (segmentLength / length) * (outerHalfWidth - innerHalfWidth)

  const back = offsetPoint(end, outwardBearing, station - SEGMENT_BREAK_THICKNESS_FT / 2)
  const front = offsetPoint(end, outwardBearing, station + SEGMENT_BREAK_THICKNESS_FT / 2)

  const p1 = offsetPoint(back, perpL, halfWidthAtStation)
  const p2 = offsetPoint(front, perpL, halfWidthAtStation)
  const p3 = offsetPoint(front, perpR, halfWidthAtStation)
  const p4 = offsetPoint(back, perpR, halfWidthAtStation)

  return [
    [p1.lon, p1.lat], [p2.lon, p2.lat],
    [p3.lon, p3.lat], [p4.lon, p4.lat],
    [p1.lon, p1.lat],
  ]
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** Assemble the full Part 77 feature list for all runways (per-runway dimensions). */
export function buildPart77SurfacePolygons(runways: Part77RunwayInput[]): SurfacePolygonFeature[] {
  const features: SurfacePolygonFeature[] = []

  for (let ri = 0; ri < runways.length; ri++) {
    const { geometry: rwy, approachType } = runways[ri]
    const set = getPart77Surfaces(approachType ?? 'non_utility_non_precision_low')

    const primaryC = set.primary.criteria
    const approachC = set.approach.criteria
    const horizontalRadius = set.horizontal.criteria.radius
    const conicalExtent = set.conical.criteria.horizontalExtent

    // Horizontal + conical stadiums (radii differ per runway category).
    features.push({ id: 'p77-horizontal', coords: generatePart77HorizontalPolygon(rwy, horizontalRadius), rwyIndex: ri })
    features.push({ id: 'p77-conical', coords: generatePart77ConicalPolygon(rwy, horizontalRadius, conicalExtent), rwyIndex: ri })

    // Transitional bands.
    const trans = generatePart77TransitionalPolygons(rwy, {
      primaryHalfWidth: set.transitional.criteria.primaryHalfWidth,
      approachSlope: approachC.slope,
      approachInnerHalfWidth: approachC.innerHalfWidth,
      approachOuterHalfWidth: approachC.outerHalfWidth,
      approachLength: approachC.length,
    })
    features.push({ id: 'p77-transitional-left', coords: trans.left, rwyIndex: ri })
    features.push({ id: 'p77-transitional-right', coords: trans.right, rwyIndex: ri })

    // Approach trapezoids.
    const approach = generatePart77ApproachPolygons(
      rwy,
      { innerHalfWidth: approachC.innerHalfWidth, outerHalfWidth: approachC.outerHalfWidth, length: approachC.length },
      primaryC.extension,
    )
    features.push({ id: 'p77-approach-end1', coords: approach.end1, rwyIndex: ri })
    features.push({ id: 'p77-approach-end2', coords: approach.end2, rwyIndex: ri })

    // Precision only: 50:1 → 40:1 slope-change cross-lines at the segment break.
    const segmentLength = approachC.segmentLength
    if (segmentLength) {
      const revBearing = normalizeBearing(rwy.bearingDeg + 180)
      const segCriteria = {
        segmentLength,
        innerHalfWidth: approachC.innerHalfWidth,
        outerHalfWidth: approachC.outerHalfWidth,
        length: approachC.length,
      }
      features.push({
        id: 'p77-segment-break-end1',
        coords: buildSegmentBreak(rwy.end1, revBearing, segCriteria, primaryC.extension),
        rwyIndex: ri,
      })
      features.push({
        id: 'p77-segment-break-end2',
        coords: buildSegmentBreak(rwy.end2, rwy.bearingDeg, segCriteria, primaryC.extension),
        rwyIndex: ri,
      })
    }

    // Primary surface (drawn last so it reads on top of the wider surfaces).
    features.push({
      id: 'p77-primary',
      coords: generatePart77PrimaryPolygon(rwy, { halfWidth: primaryC.halfWidth, extension: primaryC.extension }),
      rwyIndex: ri,
    })
  }

  return features
}
