// Geodesic coordinate math for obstruction evaluation
// Used to compute distances, bearings, and surface polygon coordinates
// relative to runway geometry at Selfridge ANGB (KMTC).

const EARTH_RADIUS_M = 6371000
const FT_TO_M = 0.3048
const M_TO_FT = 3.28084
const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

export type LatLon = { lat: number; lon: number }

// ---------------------------------------------------------------------------
// Core geodesic helpers
// ---------------------------------------------------------------------------

/** Offset a point by a given bearing (degrees true) and distance (feet). */
export function offsetPoint(origin: LatLon, bearingDeg: number, distanceFt: number): LatLon {
  const d = distanceFt * FT_TO_M / EARTH_RADIUS_M // angular distance in radians
  const brng = bearingDeg * DEG_TO_RAD
  const lat1 = origin.lat * DEG_TO_RAD
  const lon1 = origin.lon * DEG_TO_RAD

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  )
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    )

  return { lat: lat2 * RAD_TO_DEG, lon: lon2 * RAD_TO_DEG }
}

/** Haversine distance between two points, returned in feet. */
export function distanceFt(a: LatLon, b: LatLon): number {
  const lat1 = a.lat * DEG_TO_RAD
  const lat2 = b.lat * DEG_TO_RAD
  const dLat = (b.lat - a.lat) * DEG_TO_RAD
  const dLon = (b.lon - a.lon) * DEG_TO_RAD

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return c * EARTH_RADIUS_M * M_TO_FT
}

/** Initial bearing (degrees true) from a → b. */
export function bearing(a: LatLon, b: LatLon): number {
  const lat1 = a.lat * DEG_TO_RAD
  const lat2 = b.lat * DEG_TO_RAD
  const dLon = (b.lon - a.lon) * DEG_TO_RAD

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360
}

/** Normalize a bearing to 0-360. */
export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360
}

// ---------------------------------------------------------------------------
// Runway-relative coordinate system
// ---------------------------------------------------------------------------

export type RunwayGeometry = {
  end1: LatLon       // threshold 01
  end2: LatLon       // threshold 19
  midpoint: LatLon
  bearingDeg: number // true bearing from end1 → end2
  lengthFt: number
  widthFt: number
}

/** Derive runway geometry from the INSTALLATION constants. */
export function getRunwayGeometry(runway: {
  end1: { latitude: number; longitude: number }
  end2: { latitude: number; longitude: number }
  length_ft: number
  width_ft: number
  true_heading?: number
}): RunwayGeometry {
  const end1: LatLon = { lat: runway.end1.latitude, lon: runway.end1.longitude }
  const end2: LatLon = { lat: runway.end2.latitude, lon: runway.end2.longitude }
  // Use published FAA true heading when available; fall back to computed bearing
  const brg = runway.true_heading ?? bearing(end1, end2)

  return {
    end1,
    end2,
    midpoint: {
      lat: (end1.lat + end2.lat) / 2,
      lon: (end1.lon + end2.lon) / 2,
    },
    bearingDeg: brg,
    lengthFt: runway.length_ft,
    widthFt: runway.width_ft,
  }
}

// ---------------------------------------------------------------------------
// Point → runway relationship
// ---------------------------------------------------------------------------

export type RunwayRelation = {
  /** Perpendicular distance from runway centerline (feet). Always positive. */
  distanceFromCenterline: number
  /** Signed along-track distance from runway midpoint (feet).
   *  Positive = toward end2, negative = toward end1. */
  alongTrackFromMidpoint: number
  /** Distance from the nearest threshold (feet). */
  distanceFromNearestThreshold: number
  /** Distance from the nearest end of the primary surface (200 ft past threshold). */
  distanceFromNearestPrimaryEnd: number
  /** Which side of the runway: 'left' or 'right' looking from end1 → end2. */
  side: 'left' | 'right'
  /** Is the point within the primary surface rectangle? */
  withinPrimary: boolean
  /** Which end is closer: 'end1' or 'end2'. */
  nearerEnd: 'end1' | 'end2'
}

/**
 * Given a point and runway geometry, compute the spatial relationship.
 * Uses a local tangent-plane projection for accuracy at airfield scale.
 */
export function pointToRunwayRelation(point: LatLon, rwy: RunwayGeometry): RunwayRelation {
  // Convert everything to a local XY coordinate system (feet)
  // Origin = runway midpoint, X = along runway (end1→end2), Y = perpendicular
  const cosLat = Math.cos(rwy.midpoint.lat * DEG_TO_RAD)
  const ftPerDegLat = EARTH_RADIUS_M * DEG_TO_RAD * M_TO_FT
  const ftPerDegLon = ftPerDegLat * cosLat

  // Runway bearing in radians (from end1 to end2)
  const brng = rwy.bearingDeg * DEG_TO_RAD

  // Helper: lat/lon → local XY (runway-aligned frame)
  function toLocal(p: LatLon): { x: number; y: number } {
    const dN = (p.lat - rwy.midpoint.lat) * ftPerDegLat
    const dE = (p.lon - rwy.midpoint.lon) * ftPerDegLon
    // Rotate to runway-aligned axes
    const x = dN * Math.cos(brng) + dE * Math.sin(brng)   // along-track
    const y = -dN * Math.sin(brng) + dE * Math.cos(brng)  // cross-track
    return { x, y }
  }

  const pLocal = toLocal(point)
  const halfLength = rwy.lengthFt / 2
  const primaryExtension = 200 // ft past each threshold per UFC 3-260-01
  const primaryHalfWidth = 1000

  const distFromCL = Math.abs(pLocal.y)
  const side: 'left' | 'right' = pLocal.y < 0 ? 'left' : 'right'

  const distFromEnd1 = pLocal.x + halfLength // distance from end1 threshold along track
  const distFromEnd2 = halfLength - pLocal.x // distance from end2 threshold along track

  const nearerEnd = distFromEnd1 <= distFromEnd2 ? 'end1' : 'end2'
  const distFromNearestThreshold = Math.min(Math.max(0, -distFromEnd1), Math.max(0, -distFromEnd2))
    || Math.min(
      Math.abs(pLocal.x) <= halfLength ? 0 : Math.min(Math.abs(distFromEnd1), Math.abs(distFromEnd2)),
      distFromCL, // just a fallback
    )

  // Distance from threshold is 0 if you're abeam the runway, otherwise it's
  // how far past the threshold you are along the extended centerline.
  const beyondEnd1 = Math.max(0, -(pLocal.x + halfLength)) // how far past end1
  const beyondEnd2 = Math.max(0, pLocal.x - halfLength)     // how far past end2
  const minBeyondThreshold = nearerEnd === 'end1' ? beyondEnd1 : beyondEnd2

  // Distance from primary surface end (200 ft past each threshold)
  const beyondPrimary1 = Math.max(0, -(pLocal.x + halfLength + primaryExtension))
  const beyondPrimary2 = Math.max(0, pLocal.x - halfLength - primaryExtension)
  const distFromNearestPrimaryEnd = nearerEnd === 'end1' ? beyondPrimary1 : beyondPrimary2

  // Within primary surface rectangle
  const withinPrimaryLong = Math.abs(pLocal.x) <= halfLength + primaryExtension
  const withinPrimaryLat = distFromCL <= primaryHalfWidth
  const withinPrimary = withinPrimaryLong && withinPrimaryLat

  return {
    distanceFromCenterline: distFromCL,
    alongTrackFromMidpoint: pLocal.x,
    distanceFromNearestThreshold: minBeyondThreshold,
    distanceFromNearestPrimaryEnd: distFromNearestPrimaryEnd,
    side,
    withinPrimary,
    nearerEnd,
  }
}

// ---------------------------------------------------------------------------
// Surface polygon generation (GeoJSON for map display)
// ---------------------------------------------------------------------------

/** Generate a rectangle polygon along the runway axis. */
export function generateRunwayPolygon(rwy: RunwayGeometry): [number, number][] {
  const halfWidth = rwy.widthFt / 2
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)

  const p1 = offsetPoint(rwy.end1, perpL, halfWidth)
  const p2 = offsetPoint(rwy.end1, perpR, halfWidth)
  const p3 = offsetPoint(rwy.end2, perpR, halfWidth)
  const p4 = offsetPoint(rwy.end2, perpL, halfWidth)

  return [
    [p1.lon, p1.lat], [p2.lon, p2.lat],
    [p3.lon, p3.lat], [p4.lon, p4.lat],
    [p1.lon, p1.lat], // close ring
  ]
}

/** Generate the primary surface rectangle (wider than runway, extended 200ft past each end). */
export function generatePrimarySurfacePolygon(rwy: RunwayGeometry): [number, number][] {
  const halfWidth = 1000
  const extension = 200
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  // Extended ends
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

/** Generate clear zone rectangles (3,000 ft x 3,000 ft) at each runway end. */
export function generateClearZonePolygons(rwy: RunwayGeometry): {
  end1: [number, number][]
  end2: [number, number][]
} {
  const halfWidth = 1500
  const length = 3000
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  function buildRect(end: LatLon, outwardBearing: number): [number, number][] {
    const far = offsetPoint(end, outwardBearing, length)
    const p1 = offsetPoint(end, perpL, halfWidth)
    const p2 = offsetPoint(end, perpR, halfWidth)
    const p3 = offsetPoint(far, perpR, halfWidth)
    const p4 = offsetPoint(far, perpL, halfWidth)
    return [
      [p1.lon, p1.lat], [p2.lon, p2.lat],
      [p3.lon, p3.lat], [p4.lon, p4.lat],
      [p1.lon, p1.lat],
    ]
  }

  return {
    end1: buildRect(rwy.end1, revBearing),
    end2: buildRect(rwy.end2, rwy.bearingDeg),
  }
}

/** Generate graded area rectangles (1,000 ft x 3,000 ft wide) at each runway end. */
export function generateGradedAreaPolygons(rwy: RunwayGeometry): {
  end1: [number, number][]
  end2: [number, number][]
} {
  const halfWidth = 1500
  const length = 1000
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  function buildRect(end: LatLon, outwardBearing: number): [number, number][] {
    const far = offsetPoint(end, outwardBearing, length)
    const p1 = offsetPoint(end, perpL, halfWidth)
    const p2 = offsetPoint(end, perpR, halfWidth)
    const p3 = offsetPoint(far, perpR, halfWidth)
    const p4 = offsetPoint(far, perpL, halfWidth)
    return [
      [p1.lon, p1.lat], [p2.lon, p2.lat],
      [p3.lon, p3.lat], [p4.lon, p4.lat],
      [p1.lon, p1.lat],
    ]
  }

  return {
    end1: buildRect(rwy.end1, revBearing),
    end2: buildRect(rwy.end2, rwy.bearingDeg),
  }
}

/** Generate one approach-departure trapezoid for a given runway end. */
function generateApproachTrapezoid(
  rwy: RunwayGeometry,
  end: LatLon,
  outwardBearing: number,
): [number, number][] {
  const innerHalfWidth = 1000
  const outerHalfWidth = 2550
  const length = 25000
  const extension = 200
  const perpL = normalizeBearing(outwardBearing - 90)
  const perpR = normalizeBearing(outwardBearing + 90)

  // Start at the end of the primary surface extension
  const start = offsetPoint(end, outwardBearing, extension)
  const far = offsetPoint(end, outwardBearing, extension + length)

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

/** Generate both approach-departure trapezoids. */
export function generateApproachDeparturePolygons(
  rwy: RunwayGeometry,
): { end1: [number, number][]; end2: [number, number][] } {
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  return {
    end1: generateApproachTrapezoid(rwy, rwy.end1, revBearing),
    end2: generateApproachTrapezoid(rwy, rwy.end2, rwy.bearingDeg),
  }
}

/** Generate a stadium (discorectangle) shape — two semicircles at runway ends
 *  connected by tangent lines — for inner/outer horizontal surfaces. */
export function generateStadiumPolygon(
  rwy: RunwayGeometry,
  radiusFt: number,
  pointsPerArc: number = 48,
): [number, number][] {
  const coords: [number, number][] = []
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)
  const extension = 200 // primary surface extension

  // Center of arcs = center of each runway end (at primary surface ends)
  const center1 = offsetPoint(rwy.end1, revBearing, extension)
  const center2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  // Arc around end2 (right side, sweeping from perpR to perpL going clockwise)
  const startAngle2 = normalizeBearing(rwy.bearingDeg + 90)
  for (let i = 0; i <= pointsPerArc; i++) {
    const angle = normalizeBearing(startAngle2 - (180 * i) / pointsPerArc)
    const p = offsetPoint(center2, angle, radiusFt)
    coords.push([p.lon, p.lat])
  }

  // Arc around end1 (left side, sweeping from perpL to perpR going clockwise)
  const startAngle1 = normalizeBearing(rwy.bearingDeg - 90)
  for (let i = 0; i <= pointsPerArc; i++) {
    const angle = normalizeBearing(startAngle1 - (180 * i) / pointsPerArc)
    const p = offsetPoint(center1, angle, radiusFt)
    coords.push([p.lon, p.lat])
  }

  // Close ring
  coords.push(coords[0])
  return coords
}

/** Generate the transitional surface polygon (along sides of primary + approach surfaces).
 *  Per UFC 3-260-01 Para 3-1.6, the transitional surface extends from:
 *  - The edges of the primary surface, AND
 *  - The edges of the approach-departure clearance surface
 *  outward and upward at 7:1 to the inner horizontal surface height (150 ft). */
export function generateTransitionalPolygons(rwy: RunwayGeometry): {
  left: [number, number][]
  right: [number, number][]
} {
  const primaryHalfWidth = 1000
  const outerApproachHalfWidth = 2550
  const approachLength = 25000
  const transitionalExtent = 150 * 7 // 1,050 ft (7:1 slope to 150 ft height)
  const extension = 200
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  // Primary surface ends
  const ext1 = offsetPoint(rwy.end1, revBearing, extension)
  const ext2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  // Far ends of approach-departure trapezoids
  const far1 = offsetPoint(rwy.end1, revBearing, extension + approachLength)
  const far2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension + approachLength)

  // The transitional surface height is capped at 150 ft. Along the approach
  // trapezoid the edge widens, so at some distance the approach edge itself
  // is already at 150 ft (distance / 50 = 150 → 7,500 ft along approach).
  // Beyond that the inner horizontal takes over, so we only need the
  // transitional along the approach out to that cutoff point.
  const approachCutoff = 150 * 50 // 7,500 ft along approach where height = 150 ft

  // Width of approach trapezoid at the cutoff point
  const widthAtCutoff =
    primaryHalfWidth +
    (approachCutoff / approachLength) * (outerApproachHalfWidth - primaryHalfWidth)

  // Approach cutoff points
  const cutoff1 = offsetPoint(rwy.end1, revBearing, extension + approachCutoff)
  const cutoff2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension + approachCutoff)

  function buildSide(perpBearing: number): [number, number][] {
    // Inner edge: primary surface edge → approach edge expanding outward
    const pInner1 = offsetPoint(ext1, perpBearing, primaryHalfWidth) // primary end near end1
    const pInner2 = offsetPoint(ext2, perpBearing, primaryHalfWidth) // primary end near end2

    // Approach inner edge at cutoff
    const aInner1 = offsetPoint(cutoff1, perpBearing, widthAtCutoff)
    const aInner2 = offsetPoint(cutoff2, perpBearing, widthAtCutoff)

    // Outer edge: offset by transitional extent perpendicular to each edge segment
    const pOuter1 = offsetPoint(ext1, perpBearing, primaryHalfWidth + transitionalExtent)
    const pOuter2 = offsetPoint(ext2, perpBearing, primaryHalfWidth + transitionalExtent)
    const aOuter1 = offsetPoint(cutoff1, perpBearing, widthAtCutoff + transitionalExtent)
    const aOuter2 = offsetPoint(cutoff2, perpBearing, widthAtCutoff + transitionalExtent)

    // Trace: inner edge (end1 approach → primary end1 → primary end2 → end2 approach)
    // then outer edge in reverse
    return [
      [aInner1.lon, aInner1.lat],  // approach cutoff near end1
      [pInner1.lon, pInner1.lat],  // primary edge near end1
      [pInner2.lon, pInner2.lat],  // primary edge near end2
      [aInner2.lon, aInner2.lat],  // approach cutoff near end2
      [aOuter2.lon, aOuter2.lat],  // outer approach near end2
      [pOuter2.lon, pOuter2.lat],  // outer primary near end2
      [pOuter1.lon, pOuter1.lat],  // outer primary near end1
      [aOuter1.lon, aOuter1.lat],  // outer approach near end1
      [aInner1.lon, aInner1.lat],  // close ring
    ]
  }

  return {
    left: buildSide(perpL),
    right: buildSide(perpR),
  }
}

// ---------------------------------------------------------------------------
// Elevation API
// ---------------------------------------------------------------------------

/** Fetch ground elevation (feet MSL) from the Open-Elevation API. */
export async function fetchElevation(point: LatLon): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${point.lat},${point.lon}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const elevM = data?.results?.[0]?.elevation
    if (typeof elevM !== 'number') return null
    return Math.round(elevM * M_TO_FT * 100) / 100
  } catch {
    return null
  }
}
