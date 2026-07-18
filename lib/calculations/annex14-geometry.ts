// ICAO Annex 14 Vol I (7th Ed.) plan-view surface polygons.
//
// Pure geometry: turns a runway's geometry + its per-runway (classification,
// code number) variant into the GeoJSON-style [lon, lat] rings the obstruction
// map draws. Mirrors part77-geometry.ts's module shape: builders emit the shared
// `SurfacePolygonFeature` { id, coords, rwyIndex }, import only exported
// primitives from ./geometry, and pull every dimension from annex14-criteria.ts.
//
// Coordinate convention matches the rest of lib/calculations/geometry.ts: each
// vertex is [lon, lat] and every ring is closed (first vertex repeated). All
// criteria dimensions are METRES; they are converted to feet via M_TO_FT at this
// boundary (the geometry primitives take feet) — the single conversion boundary.

import {
  offsetPoint,
  normalizeBearing,
  generateStadiumPolygon,
  type LatLon,
  type RunwayGeometry,
} from './geometry'
import {
  getAnnex14Criteria,
  ANNEX14_DEFAULT_VARIANT,
  M_TO_FT,
  type Annex14SurfaceCriteria,
  type IcaoApproachClassification,
  type IcaoCodeNumber,
} from './annex14-criteria'
import type { SurfacePolygonFeature } from './part77-geometry'

export type { SurfacePolygonFeature } from './part77-geometry'

/** Per-runway input for the ICAO builder. Every variant field is optional; a
 *  NULL/absent classification or code falls back to ANNEX14_DEFAULT_VARIANT
 *  (the engine-matching fallback idiom Part 77 uses). `stripWidthM` sets the
 *  transitional lower edge; when absent the builder uses the runway edge (the
 *  page surfaces "approximate — strip width not configured" from the null). */
export type Annex14RunwayInput = {
  geometry: RunwayGeometry
  classification?: IcaoApproachClassification | null
  codeNumber?: IcaoCodeNumber | null
  stripWidthM?: number | null
}

// ---------------------------------------------------------------------------
// §4.1.7–4.1.10 Approach surface (plan view)
// ---------------------------------------------------------------------------

/** Plan-view length of an approach column = its printed total, else (single-
 *  section columns with no total) the sum of its section lengths. The sides
 *  diverge uniformly over this whole length — piecewise slopes don't change the
 *  plan-view footprint, so it's one polygon per end. */
function approachPlanLengthM(approach: Annex14SurfaceCriteria['approach']): number {
  return approach.totalLengthM ?? approach.sections.reduce((sum, s) => sum + s.lengthM, 0)
}

/** One approach trapezoid: inner edge at `distFromThresholdM` beyond the
 *  threshold (width `innerEdgeM`), diverging at `divergencePct` per side over
 *  the plan-view length. */
function buildApproachTrapezoid(
  end: LatLon,
  outwardBearing: number,
  approach: Annex14SurfaceCriteria['approach'],
): [number, number][] {
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)

  const planLengthM = approachPlanLengthM(approach)
  const innerHalfFt = (approach.innerEdgeM / 2) * M_TO_FT
  const outerHalfFt = innerHalfFt + planLengthM * (approach.divergencePct / 100) * M_TO_FT

  const start = offsetPoint(end, outwardBearing, approach.distFromThresholdM * M_TO_FT)
  const far = offsetPoint(end, outwardBearing, (approach.distFromThresholdM + planLengthM) * M_TO_FT)

  const p1 = offsetPoint(start, perpL, innerHalfFt)
  const p2 = offsetPoint(start, perpR, innerHalfFt)
  const p3 = offsetPoint(far, perpR, outerHalfFt)
  const p4 = offsetPoint(far, perpL, outerHalfFt)

  return [
    [p1.lon, p1.lat], [p2.lon, p2.lat],
    [p3.lon, p3.lat], [p4.lon, p4.lat],
    [p1.lon, p1.lat],
  ]
}

/** §4.1.7: approach trapezoid off each threshold. */
export function generateAnnex14ApproachPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): { end1: [number, number][]; end2: [number, number][] } {
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  return {
    end1: buildApproachTrapezoid(rwy.end1, revBearing, criteria.approach),
    end2: buildApproachTrapezoid(rwy.end2, rwy.bearingDeg, criteria.approach),
  }
}

// ---------------------------------------------------------------------------
// §4.1.25–4.1.27 Take-off climb surface (plan view)
// ---------------------------------------------------------------------------

/** One take-off climb surface: diverges from `innerEdgeM` at `divergencePct`
 *  per side to `finalWidthM`, then continues PARALLEL at the final width for the
 *  remainder of `lengthM` (§4.1.26(b) — NOT a uniform flare to the far end). */
function buildTakeoffClimb(
  end: LatLon,
  outwardBearing: number,
  toc: Annex14SurfaceCriteria['takeoffClimb'],
): [number, number][] {
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)

  const innerHalfM = toc.innerEdgeM / 2
  const finalHalfM = toc.finalWidthM / 2
  // Along-track distance (from the inner edge) at which the sides reach the
  // final half-width; beyond it the sides run parallel.
  const flareLenM = (finalHalfM - innerHalfM) / (toc.divergencePct / 100)

  const d0Ft = toc.distFromEndM * M_TO_FT
  const d1Ft = (toc.distFromEndM + flareLenM) * M_TO_FT
  const d2Ft = (toc.distFromEndM + toc.lengthM) * M_TO_FT
  const innerHalfFt = innerHalfM * M_TO_FT
  const finalHalfFt = finalHalfM * M_TO_FT

  const s0 = offsetPoint(end, outwardBearing, d0Ft)
  const s1 = offsetPoint(end, outwardBearing, d1Ft)
  const s2 = offsetPoint(end, outwardBearing, d2Ft)

  const innerL = offsetPoint(s0, perpL, innerHalfFt)
  const innerR = offsetPoint(s0, perpR, innerHalfFt)
  const flareR = offsetPoint(s1, perpR, finalHalfFt)
  const farR = offsetPoint(s2, perpR, finalHalfFt)
  const farL = offsetPoint(s2, perpL, finalHalfFt)
  const flareL = offsetPoint(s1, perpL, finalHalfFt)

  return [
    [innerL.lon, innerL.lat],
    [innerR.lon, innerR.lat],
    [flareR.lon, flareR.lat],
    [farR.lon, farR.lat],
    [farL.lon, farL.lat],
    [flareL.lon, flareL.lat],
    [innerL.lon, innerL.lat],
  ]
}

/** §4.1.25: take-off climb surface off each runway end (each end presumed
 *  usable for take-off; clearways not modeled — Table 4-2 footnote b deferred). */
export function generateAnnex14TakeoffClimbPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): { end1: [number, number][]; end2: [number, number][] } {
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  return {
    end1: buildTakeoffClimb(rwy.end1, revBearing, criteria.takeoffClimb),
    end2: buildTakeoffClimb(rwy.end2, rwy.bearingDeg, criteria.takeoffClimb),
  }
}

// ---------------------------------------------------------------------------
// §4.1.4–4.1.6 Inner horizontal + §4.1.1–4.1.3 Conical (stadium construction)
// ---------------------------------------------------------------------------

/** §4.1.5: inner horizontal stadium at `radiusM`. §4.1.5's "need not necessarily
 *  be circular" note sanctions the stadium reuse. */
export function generateAnnex14InnerHorizontalPolygon(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): [number, number][] {
  return generateStadiumPolygon(rwy, criteria.innerHorizontal.radiusM * M_TO_FT)
}

/** §4.1.2: conical stadium — the horizontal run of the conical is heightM ÷
 *  (slopePct/100) (rise/slope), added to the inner-horizontal radius. Computed,
 *  never hardcoded. */
export function generateAnnex14ConicalPolygon(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): [number, number][] {
  const { conical, innerHorizontal } = criteria
  const conicalExtentM = conical.heightM / (conical.slopePct / 100)
  return generateStadiumPolygon(rwy, (innerHorizontal.radiusM + conicalExtentM) * M_TO_FT)
}

// ---------------------------------------------------------------------------
// §4.1.13–4.1.16 Transitional surface
// ---------------------------------------------------------------------------

/** §4.1.13: transitional bands along each side of the strip (or the runway edge
 *  when the strip width isn't configured), from the lower edge outward by the
 *  horizontal run to the inner-horizontal plane: (45 m − 0) ÷ slopePct. */
export function generateAnnex14TransitionalPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
  stripWidthM?: number | null,
): { left: [number, number][]; right: [number, number][] } {
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)

  // Lower edge: the strip edge when configured, else the runway edge (the page
  // flags the runway-edge case as approximate from the null strip width).
  const lowerHalfFt = stripWidthM != null ? (stripWidthM / 2) * M_TO_FT : rwy.widthFt / 2
  // Horizontal run to reach the inner-horizontal height (45 m) at the slope.
  const runFt = (criteria.innerHorizontal.heightM / (criteria.transitional.slopePct / 100)) * M_TO_FT
  const outerHalfFt = lowerHalfFt + runFt

  function buildSide(perpBearing: number): [number, number][] {
    const inner1 = offsetPoint(rwy.end1, perpBearing, lowerHalfFt)
    const inner2 = offsetPoint(rwy.end2, perpBearing, lowerHalfFt)
    const outer2 = offsetPoint(rwy.end2, perpBearing, outerHalfFt)
    const outer1 = offsetPoint(rwy.end1, perpBearing, outerHalfFt)
    return [
      [inner1.lon, inner1.lat],
      [inner2.lon, inner2.lat],
      [outer2.lon, outer2.lat],
      [outer1.lon, outer1.lat],
      [inner1.lon, inner1.lat],
    ]
  }

  return { left: buildSide(perpL), right: buildSide(perpR) }
}

// ---------------------------------------------------------------------------
// §4.1.17–4.1.20 Inner transitional surface (precision approach only)
// ---------------------------------------------------------------------------

/** §4.1.17: a steeper transitional surface closer to the runway, rising from the
 *  strip edge (or runway edge when the strip width isn't configured) to the inner
 *  horizontal at the inner-transitional slope — a narrower band than the regular
 *  transitional. Precision approach only (null otherwise). Simplification: drawn
 *  along the strip; the §4.1.18 lower edge that steps in to the inner-approach /
 *  balked-landing widths near the ends is a documented further refinement. */
export function generateAnnex14InnerTransitionalPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
  stripWidthM?: number | null,
): { left: [number, number][]; right: [number, number][] } | null {
  if (!criteria.innerTransitional) return null
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)

  const lowerHalfFt = stripWidthM != null ? (stripWidthM / 2) * M_TO_FT : rwy.widthFt / 2
  const runFt = (criteria.innerHorizontal.heightM / (criteria.innerTransitional.slopePct / 100)) * M_TO_FT
  const outerHalfFt = lowerHalfFt + runFt

  function buildSide(perpBearing: number): [number, number][] {
    const inner1 = offsetPoint(rwy.end1, perpBearing, lowerHalfFt)
    const inner2 = offsetPoint(rwy.end2, perpBearing, lowerHalfFt)
    const outer2 = offsetPoint(rwy.end2, perpBearing, outerHalfFt)
    const outer1 = offsetPoint(rwy.end1, perpBearing, outerHalfFt)
    return [
      [inner1.lon, inner1.lat],
      [inner2.lon, inner2.lat],
      [outer2.lon, outer2.lat],
      [outer1.lon, outer1.lat],
      [inner1.lon, inner1.lat],
    ]
  }

  return { left: buildSide(perpL), right: buildSide(perpR) }
}

// ---------------------------------------------------------------------------
// §4.1.11–4.1.12 Inner approach surface (precision approach only)
// ---------------------------------------------------------------------------

/** §4.1.11–4.1.12: a rectangular portion of the approach immediately preceding
 *  the threshold — inner edge coincident with the approach inner edge
 *  (distFromThresholdM before the threshold), CONSTANT width (parallel sides,
 *  §4.1.12b), extending its own length outward. */
function buildInnerApproachRect(
  end: LatLon,
  outwardBearing: number,
  ia: NonNullable<Annex14SurfaceCriteria['innerApproach']>,
): [number, number][] {
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)
  const halfFt = (ia.widthM / 2) * M_TO_FT
  const start = offsetPoint(end, outwardBearing, ia.distFromThresholdM * M_TO_FT)
  const far = offsetPoint(end, outwardBearing, (ia.distFromThresholdM + ia.lengthM) * M_TO_FT)
  const p1 = offsetPoint(start, perpL, halfFt)
  const p2 = offsetPoint(start, perpR, halfFt)
  const p3 = offsetPoint(far, perpR, halfFt)
  const p4 = offsetPoint(far, perpL, halfFt)
  return [[p1.lon, p1.lat], [p2.lon, p2.lat], [p3.lon, p3.lat], [p4.lon, p4.lat], [p1.lon, p1.lat]]
}

/** §4.1.11: inner approach off each threshold, or null when the criteria carries
 *  no inner approach (non-precision / non-instrument). */
export function generateAnnex14InnerApproachPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): { end1: [number, number][]; end2: [number, number][] } | null {
  if (!criteria.innerApproach) return null
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  return {
    end1: buildInnerApproachRect(rwy.end1, revBearing, criteria.innerApproach),
    end2: buildInnerApproachRect(rwy.end2, rwy.bearingDeg, criteria.innerApproach),
  }
}

// ---------------------------------------------------------------------------
// §4.1.21–4.1.24 Balked landing surface (precision approach; code 3,4 encoded)
// ---------------------------------------------------------------------------

/** §4.1.21–4.1.22: a go-around surface, inner edge a specified distance AFTER the
 *  threshold (down the runway, in the departure direction), capped at the runway
 *  end (Table 4-1 footnote d "or end of runway whichever is less"), diverging each
 *  side, rising to the inner-horizontal plane (45 m) at its slope — so the plan
 *  length is that rise ÷ slope. */
function buildBalkedLanding(
  end: LatLon,
  departBearing: number,
  bl: NonNullable<Annex14SurfaceCriteria['balkedLanding']> & { distFromThresholdM: number },
  runwayLengthFt: number,
): [number, number][] {
  const perpL = normalizeBearing(departBearing - 90)
  const perpR = normalizeBearing(departBearing + 90)
  const innerDistFt = Math.min(bl.distFromThresholdM * M_TO_FT, runwayLengthFt)
  const innerHalfFt = (bl.innerEdgeM / 2) * M_TO_FT
  const planLengthFt = (45 / (bl.slopePct / 100)) * M_TO_FT
  const outerHalfFt = innerHalfFt + planLengthFt * (bl.divergencePct / 100)
  const inner = offsetPoint(end, departBearing, innerDistFt)
  const far = offsetPoint(end, departBearing, innerDistFt + planLengthFt)
  const p1 = offsetPoint(inner, perpL, innerHalfFt)
  const p2 = offsetPoint(inner, perpR, innerHalfFt)
  const p3 = offsetPoint(far, perpR, outerHalfFt)
  const p4 = offsetPoint(far, perpL, outerHalfFt)
  return [[p1.lon, p1.lat], [p2.lon, p2.lat], [p3.lon, p3.lat], [p4.lon, p4.lat], [p1.lon, p1.lat]]
}

/** §4.1.21: balked landing off each threshold (go-around in the departure
 *  direction), or null when there is no fixed distance — non-precision, or CAT I
 *  code 1,2 whose distance is "the end of strip" (footnote c, deferred). */
export function generateAnnex14BalkedLandingPolygons(
  rwy: RunwayGeometry,
  criteria: Annex14SurfaceCriteria,
): { end1: [number, number][]; end2: [number, number][] } | null {
  const bl = criteria.balkedLanding
  if (!bl || bl.distFromThresholdM == null) return null
  const fixed = { ...bl, distFromThresholdM: bl.distFromThresholdM }
  return {
    end1: buildBalkedLanding(rwy.end1, rwy.bearingDeg, fixed, rwy.lengthFt),
    end2: buildBalkedLanding(rwy.end2, normalizeBearing(rwy.bearingDeg + 180), fixed, rwy.lengthFt),
  }
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** Assemble the full Annex 14 phase-1 feature list for all runways. Each runway
 *  is dimensioned from its own (classification, code number) with the NULL →
 *  ANNEX14_DEFAULT_VARIANT fallback. Layer ids per spec §7. */
export function buildAnnex14SurfacePolygons(runways: Annex14RunwayInput[]): SurfacePolygonFeature[] {
  const features: SurfacePolygonFeature[] = []

  for (let ri = 0; ri < runways.length; ri++) {
    const { geometry: rwy, classification, codeNumber, stripWidthM } = runways[ri]
    const criteria = getAnnex14Criteria(
      classification ?? ANNEX14_DEFAULT_VARIANT.classification,
      codeNumber ?? ANNEX14_DEFAULT_VARIANT.codeNumber,
    )

    // Conical (widest) first, so it reads under the narrower surfaces.
    features.push({ id: 'a14-conical', coords: generateAnnex14ConicalPolygon(rwy, criteria), rwyIndex: ri })
    features.push({ id: 'a14-inner-horizontal', coords: generateAnnex14InnerHorizontalPolygon(rwy, criteria), rwyIndex: ri })

    const trans = generateAnnex14TransitionalPolygons(rwy, criteria, stripWidthM)
    features.push({ id: 'a14-transitional-left', coords: trans.left, rwyIndex: ri })
    features.push({ id: 'a14-transitional-right', coords: trans.right, rwyIndex: ri })

    const innerTrans = generateAnnex14InnerTransitionalPolygons(rwy, criteria, stripWidthM)
    if (innerTrans) {
      features.push({ id: 'a14-inner-transitional-left', coords: innerTrans.left, rwyIndex: ri })
      features.push({ id: 'a14-inner-transitional-right', coords: innerTrans.right, rwyIndex: ri })
    }

    const approach = generateAnnex14ApproachPolygons(rwy, criteria)
    features.push({ id: 'a14-approach-end1', coords: approach.end1, rwyIndex: ri })
    features.push({ id: 'a14-approach-end2', coords: approach.end2, rwyIndex: ri })

    // Precision-only surfaces (null for non-precision / non-instrument).
    const innerApproach = generateAnnex14InnerApproachPolygons(rwy, criteria)
    if (innerApproach) {
      features.push({ id: 'a14-inner-approach-end1', coords: innerApproach.end1, rwyIndex: ri })
      features.push({ id: 'a14-inner-approach-end2', coords: innerApproach.end2, rwyIndex: ri })
    }

    const balked = generateAnnex14BalkedLandingPolygons(rwy, criteria)
    if (balked) {
      features.push({ id: 'a14-balked-landing-end1', coords: balked.end1, rwyIndex: ri })
      features.push({ id: 'a14-balked-landing-end2', coords: balked.end2, rwyIndex: ri })
    }

    const toc = generateAnnex14TakeoffClimbPolygons(rwy, criteria)
    features.push({ id: 'a14-takeoff-climb-end1', coords: toc.end1, rwyIndex: ri })
    features.push({ id: 'a14-takeoff-climb-end2', coords: toc.end2, rwyIndex: ri })
  }

  return features
}
