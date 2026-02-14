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
  runwayClass: 'A' | 'B'
}

/** Derive runway geometry from the INSTALLATION constants. */
export function getRunwayGeometry(runway: {
  end1: { latitude: number; longitude: number }
  end2: { latitude: number; longitude: number }
  length_ft: number
  width_ft: number
  runway_class: 'A' | 'B'
}): RunwayGeometry {
  const end1: LatLon = { lat: runway.end1.latitude, lon: runway.end1.longitude }
  const end2: LatLon = { lat: runway.end2.latitude, lon: runway.end2.longitude }
  const brg = bearing(end1, end2)

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
    runwayClass: runway.runway_class,
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
  const primaryHalfWidth = rwy.runwayClass === 'A' ? 1000 : 750

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
  const halfWidth = rwy.runwayClass === 'A' ? 1000 : 750
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

/** Generate one approach-departure trapezoid for a given runway end. */
function generateApproachTrapezoid(
  rwy: RunwayGeometry,
  end: LatLon,
  outwardBearing: number,
): [number, number][] {
  const innerHalfWidth = rwy.runwayClass === 'A' ? 1000 : 750
  const outerHalfWidth = rwy.runwayClass === 'A' ? 8000 : 6625
  const length = 50000
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

/** Generate the transitional surface polygon (along sides of primary + approach surfaces). */
export function generateTransitionalPolygons(rwy: RunwayGeometry): {
  left: [number, number][]
  right: [number, number][]
} {
  const primaryHalfWidth = rwy.runwayClass === 'A' ? 1000 : 750
  const transitionalExtent = 150 * 7 // 1,050 ft (7:1 slope to 150 ft height)
  const outerHalfWidth = primaryHalfWidth + transitionalExtent
  const extension = 200
  const perpL = normalizeBearing(rwy.bearingDeg - 90)
  const perpR = normalizeBearing(rwy.bearingDeg + 90)
  const revBearing = normalizeBearing(rwy.bearingDeg + 180)

  const ext1 = offsetPoint(rwy.end1, revBearing, extension)
  const ext2 = offsetPoint(rwy.end2, rwy.bearingDeg, extension)

  // Left side (looking end1 → end2)
  const lInner1 = offsetPoint(ext1, perpL, primaryHalfWidth)
  const lInner2 = offsetPoint(ext2, perpL, primaryHalfWidth)
  const lOuter1 = offsetPoint(ext1, perpL, outerHalfWidth)
  const lOuter2 = offsetPoint(ext2, perpL, outerHalfWidth)

  // Right side
  const rInner1 = offsetPoint(ext1, perpR, primaryHalfWidth)
  const rInner2 = offsetPoint(ext2, perpR, primaryHalfWidth)
  const rOuter1 = offsetPoint(ext1, perpR, outerHalfWidth)
  const rOuter2 = offsetPoint(ext2, perpR, outerHalfWidth)

  return {
    left: [
      [lInner1.lon, lInner1.lat], [lInner2.lon, lInner2.lat],
      [lOuter2.lon, lOuter2.lat], [lOuter1.lon, lOuter1.lat],
      [lInner1.lon, lInner1.lat],
    ],
    right: [
      [rInner1.lon, rInner1.lat], [rInner2.lon, rInner2.lat],
      [rOuter2.lon, rOuter2.lat], [rOuter1.lon, rOuter1.lat],
      [rInner1.lon, rInner1.lat],
    ],
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
