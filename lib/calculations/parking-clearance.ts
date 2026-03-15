// UFC 3-260-01 Table 6-1 Aircraft Parking Clearance Engine
// Calculates wingtip clearance requirements and violations for parking plans

import { offsetPoint, distanceFt, type LatLon } from './geometry'
import type { ParkingSpot, ParkingObstacle } from '../supabase/parking'

// ── ADG Classification (UFC 3-260-01 Table 3-1) ──
// Retained for display / reference — clearances use 110ft threshold per Table 6-1

export type ADGGroup = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI'

const ADG_RANGES: { group: ADGGroup; maxWingspan: number }[] = [
  { group: 'I', maxWingspan: 49 },
  { group: 'II', maxWingspan: 79 },
  { group: 'III', maxWingspan: 118 },
  { group: 'IV', maxWingspan: 171 },
  { group: 'V', maxWingspan: 214 },
  { group: 'VI', maxWingspan: 262 },
]

export function getADGFromWingspan(wingspanFt: number): ADGGroup {
  for (const r of ADG_RANGES) {
    if (wingspanFt < r.maxWingspan) return r.group
  }
  return 'VI'
}

// ── UFC 3-260-01 Table 6-1 Wingtip Clearances ──

/** Apron/ramp area type determines which clearance column to use */
export type ApronContext =
  | 'parking'              // Item 4: Parking apron ("P")
  | 'parking_transient'    // Item 4: Transient apron parking (C-5/C-17 = 25ft)
  | 'parking_kc_refuel'    // Item 4: KC-10/KC-135 fuel load change (50ft)
  | 'interior_taxilane'    // Item 5: Interior/secondary peripheral taxilane ("I")
  | 'taxilane_transient'   // Item 5: Transient apron taxilane (25ft)
  | 'through_taxilane'     // Item 6: Through/primary peripheral taxilane ("T")

/** Get the required wingtip clearance per UFC 3-260-01 Table 6-1 */
export function getWingtipClearance(wingspanFt: number, context: ApronContext = 'parking'): number {
  const large = wingspanFt >= 110  // 33.5m threshold

  switch (context) {
    // Item 4 — Parking Apron ("P")
    case 'parking':
      return large ? 20 : 10
    case 'parking_transient':
      return large ? 25 : 10
    case 'parking_kc_refuel':
      return 50

    // Item 5 — Interior / Secondary Peripheral Taxilane ("I")
    case 'interior_taxilane':
      return large ? 30 : 20
    case 'taxilane_transient':
      return 25

    // Item 6 — Through / Primary Peripheral Taxilane ("T")
    case 'through_taxilane':
      return large ? 50 : 30

    default:
      return large ? 20 : 10
  }
}

/** Simplified context labels for UI display */
export const APRON_CONTEXT_LABELS: Record<ApronContext, string> = {
  parking: 'Parking Apron',
  parking_transient: 'Transient Apron',
  parking_kc_refuel: 'KC Refueling',
  interior_taxilane: 'Interior Taxilane',
  taxilane_transient: 'Transient Taxilane',
  through_taxilane: 'Through Taxilane',
}

// Keep old function signature for compatibility but delegate to new logic
export type ClearanceContext = 'taxiway' | 'apron' | 'reduced'

export function getDefaultClearance(adg: ADGGroup, context: ClearanceContext = 'apron'): number {
  // Map old ADG-based contexts to Table 6-1 wingspan-based approach
  // Use the ADG max wingspan threshold to determine which bracket
  const wsThreshold = ADG_RANGES.find(r => r.group === adg)?.maxWingspan ?? 100
  const large = wsThreshold >= 110

  switch (context) {
    case 'taxiway': return large ? 50 : 30  // Through taxilane
    case 'apron': return large ? 20 : 10     // Parking apron
    case 'reduced': return large ? 20 : 10   // Same as parking (no "reduced" in Table 6-1)
    default: return large ? 20 : 10
  }
}

// ── Spot with Aircraft data ──

export type SpotWithAircraft = ParkingSpot & {
  wingspan_ft: number
  length_ft: number
}

// ── Clearance Result ──

export type ClearanceResult = {
  distance_ft: number
  required_ft: number
  status: 'ok' | 'warning' | 'violation'
  aircraft_a: string
  aircraft_b?: string
  spot_a_id: string
  spot_b_id?: string
  obstacle_id?: string
}

// ── Wingtip geometry helpers ──

/** Get the two wingtip positions for an aircraft at a given location/heading */
export function getWingtipPositions(
  center: LatLon,
  headingDeg: number,
  wingspanFt: number
): { left: LatLon; right: LatLon } {
  const halfSpan = wingspanFt / 2
  const leftBearing = (headingDeg - 90 + 360) % 360
  const rightBearing = (headingDeg + 90) % 360
  return {
    left: offsetPoint(center, leftBearing, halfSpan),
    right: offsetPoint(center, rightBearing, halfSpan),
  }
}

/** Get the nose and tail positions */
export function getNoseTailPositions(
  center: LatLon,
  headingDeg: number,
  lengthFt: number
): { nose: LatLon; tail: LatLon } {
  const halfLen = lengthFt / 2
  return {
    nose: offsetPoint(center, headingDeg, halfLen),
    tail: offsetPoint(center, (headingDeg + 180) % 360, halfLen),
  }
}

/** Get all 4 corner points of an aircraft bounding box */
export function getAircraftCorners(
  center: LatLon,
  headingDeg: number,
  wingspanFt: number,
  lengthFt: number
): LatLon[] {
  const { nose, tail } = getNoseTailPositions(center, headingDeg, lengthFt)
  const halfSpan = wingspanFt / 2
  const leftBearing = (headingDeg - 90 + 360) % 360
  const rightBearing = (headingDeg + 90) % 360

  return [
    offsetPoint(nose, leftBearing, halfSpan),
    offsetPoint(nose, rightBearing, halfSpan),
    offsetPoint(tail, rightBearing, halfSpan),
    offsetPoint(tail, leftBearing, halfSpan),
  ]
}

// ── Clearance zone polygon (for map rendering) ──

/** Generate a clearance ellipse (approximated as 64-segment polygon) around an aircraft */
export function generateClearanceZonePolygon(
  spot: SpotWithAircraft,
  clearanceFt: number
): [number, number][] {
  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }
  const totalWidth = spot.wingspan_ft / 2 + clearanceFt
  const totalLength = spot.length_ft / 2 + clearanceFt
  const segments = 64
  const coords: [number, number][] = []

  for (let i = 0; i <= segments; i++) {
    const angle = (2 * Math.PI * i) / segments
    // Ellipse in local frame, then rotate by heading
    const localX = totalLength * Math.cos(angle) // along-track
    const localY = totalWidth * Math.sin(angle) // cross-track
    // Rotate by heading
    const headingRad = (spot.heading_deg * Math.PI) / 180
    const rotX = localX * Math.cos(headingRad) - localY * Math.sin(headingRad)
    const rotY = localX * Math.sin(headingRad) + localY * Math.cos(headingRad)
    // Convert to bearing + distance
    const dist = Math.sqrt(rotX * rotX + rotY * rotY)
    // bearing: 0 = north (up), but atan2 gives 0 = east, so rotate -90
    const mapBearing = (90 - Math.atan2(rotY, rotX) * 180 / Math.PI + 360) % 360
    const pt = offsetPoint(center, mapBearing, dist)
    coords.push([pt.lon, pt.lat])
  }

  return coords
}

// ── Wingtip-to-wingtip clearance check ──

/** Check wingtip clearance between two aircraft per UFC 3-260-01 Table 6-1 */
export function checkWingtipClearance(
  spotA: SpotWithAircraft,
  spotB: SpotWithAircraft,
  apronContext: ApronContext = 'parking'
): ClearanceResult {
  const centerA: LatLon = { lat: spotA.latitude, lon: spotA.longitude }
  const centerB: LatLon = { lat: spotB.latitude, lon: spotB.longitude }

  const tipsA = getWingtipPositions(centerA, spotA.heading_deg, spotA.wingspan_ft)
  const tipsB = getWingtipPositions(centerB, spotB.heading_deg, spotB.wingspan_ft)

  // Find minimum distance between any wingtip pair
  const distances = [
    distanceFt(tipsA.left, tipsB.left),
    distanceFt(tipsA.left, tipsB.right),
    distanceFt(tipsA.right, tipsB.left),
    distanceFt(tipsA.right, tipsB.right),
  ]

  // Also check wingtip-to-fuselage distances (nose/tail of other aircraft)
  const ntA = getNoseTailPositions(centerA, spotA.heading_deg, spotA.length_ft)
  const ntB = getNoseTailPositions(centerB, spotB.heading_deg, spotB.length_ft)

  distances.push(
    distanceFt(tipsA.left, ntB.nose),
    distanceFt(tipsA.left, ntB.tail),
    distanceFt(tipsA.right, ntB.nose),
    distanceFt(tipsA.right, ntB.tail),
    distanceFt(tipsB.left, ntA.nose),
    distanceFt(tipsB.left, ntA.tail),
    distanceFt(tipsB.right, ntA.nose),
    distanceFt(tipsB.right, ntA.tail),
  )

  // Also check center-to-center minus combined half-wingspans for broad proximity
  const centerDist = distanceFt(centerA, centerB)
  const combinedHalfWings = spotA.wingspan_ft / 2 + spotB.wingspan_ft / 2
  distances.push(Math.max(0, centerDist - combinedHalfWings))

  const minDistance = Math.min(...distances)

  // Required clearance: use the larger wingspan's requirement (per Table 6-1 threshold logic)
  // If either spot has a manual override, use that instead
  const reqA = spotA.clearance_ft ?? getWingtipClearance(spotA.wingspan_ft, apronContext)
  const reqB = spotB.clearance_ft ?? getWingtipClearance(spotB.wingspan_ft, apronContext)
  const required = Math.max(reqA, reqB)

  let status: ClearanceResult['status'] = 'ok'
  if (minDistance < required) {
    status = 'violation'
  } else if (minDistance < required * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(minDistance * 10) / 10,
    required_ft: required,
    status,
    aircraft_a: spotA.aircraft_name || 'Aircraft',
    aircraft_b: spotB.aircraft_name || 'Aircraft',
    spot_a_id: spotA.id,
    spot_b_id: spotB.id,
  }
}

// ── Obstacle clearance check ──

/** Minimum distance from a point to the aircraft's bounding rectangle.
 *  Transforms the obstacle into the aircraft's local coordinate frame
 *  (aligned with heading) and computes distance to the nearest edge. */
function distanceToAircraftRect(spot: SpotWithAircraft, obsPt: LatLon): number {
  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }

  // Convert obstacle position to local offsets (ft) relative to aircraft center
  const dLon = obsPt.lon - center.lon
  const dLat = obsPt.lat - center.lat
  const eastFt = dLon * 111319.9 * Math.cos(center.lat * Math.PI / 180) * 3.28084
  const northFt = dLat * 111319.9 * 3.28084

  // Rotate into aircraft-local frame (heading = 0 → nose points north)
  const headingRad = (spot.heading_deg * Math.PI) / 180
  const localAlong = eastFt * Math.sin(headingRad) + northFt * Math.cos(headingRad)   // along fuselage
  const localCross = eastFt * Math.cos(headingRad) - northFt * Math.sin(headingRad)   // across wings

  // Aircraft rectangle: half-length along fuselage, half-wingspan across
  const halfLen = spot.length_ft / 2
  const halfWS = spot.wingspan_ft / 2

  // Signed distance to nearest edge (negative = inside the rectangle)
  const dxOut = Math.max(0, Math.abs(localAlong) - halfLen)
  const dyOut = Math.max(0, Math.abs(localCross) - halfWS)

  return Math.sqrt(dxOut * dxOut + dyOut * dyOut)
}

function pointToPointDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const obsPt: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  return distanceToAircraftRect(spot, obsPt)
}

function pointToBuildingDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const obsCenter: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }

  // Building corners
  const halfW = (obstacle.width_ft || 50) / 2
  const halfL = (obstacle.length_ft || 50) / 2
  const rot = obstacle.rotation_deg || 0
  const bCorners = [
    offsetPoint(offsetPoint(obsCenter, rot, halfL), (rot + 90) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, rot, halfL), (rot - 90 + 360) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, (rot + 180) % 360, halfL), (rot - 90 + 360) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, (rot + 180) % 360, halfL), (rot + 90) % 360, halfW),
  ]

  // Check distance from each building corner to the aircraft rectangle
  let minDist = Infinity
  for (const bc of bCorners) {
    minDist = Math.min(minDist, distanceToAircraftRect(spot, bc))
  }
  // Also check building center
  minDist = Math.min(minDist, distanceToAircraftRect(spot, obsCenter))

  return minDist
}

function pointToCircleDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const obsCenter: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  const radius = obstacle.radius_ft || 0

  // Distance from nearest edge of aircraft rect to circle center, minus radius
  const rectDist = distanceToAircraftRect(spot, obsCenter)
  return Math.max(0, rectDist - radius)
}

function pointToLineDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  if (!obstacle.line_coords || obstacle.line_coords.length < 2) {
    return pointToPointDistance(spot, obstacle)
  }

  // Check each line vertex against the aircraft rectangle
  let minDist = Infinity
  for (const coord of obstacle.line_coords) {
    const linePt: LatLon = { lat: coord[1], lon: coord[0] }
    minDist = Math.min(minDist, distanceToAircraftRect(spot, linePt))
  }
  return minDist
}

export function checkObstacleClearance(
  spot: SpotWithAircraft,
  obstacle: ParkingObstacle,
  apronContext: ApronContext = 'parking'
): ClearanceResult {
  let distance: number

  switch (obstacle.obstacle_type) {
    case 'building':
      distance = pointToBuildingDistance(spot, obstacle)
      break
    case 'circle':
      distance = pointToCircleDistance(spot, obstacle)
      break
    case 'line':
      distance = pointToLineDistance(spot, obstacle)
      break
    default:
      distance = pointToPointDistance(spot, obstacle)
  }

  const required = spot.clearance_ft ?? getWingtipClearance(spot.wingspan_ft, apronContext)

  let status: ClearanceResult['status'] = 'ok'
  if (distance < required) {
    status = 'violation'
  } else if (distance < required * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(distance * 10) / 10,
    required_ft: required,
    status,
    aircraft_a: spot.aircraft_name || 'Aircraft',
    aircraft_b: obstacle.name || 'Obstacle',
    spot_a_id: spot.id,
    obstacle_id: obstacle.id,
  }
}

// ── Batch violation check ──

export function findAllViolations(
  spots: SpotWithAircraft[],
  obstacles: ParkingObstacle[],
  apronContext: ApronContext = 'parking'
): ClearanceResult[] {
  const results: ClearanceResult[] = []

  // Check all aircraft pairs
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const result = checkWingtipClearance(spots[i], spots[j], apronContext)
      if (result.status !== 'ok') {
        results.push(result)
      }
    }
  }

  // Check aircraft vs obstacles
  for (const spot of spots) {
    for (const obstacle of obstacles) {
      const result = checkObstacleClearance(spot, obstacle, apronContext)
      if (result.status !== 'ok') {
        results.push(result)
      }
    }
  }

  // Sort: violations first, then warnings
  results.sort((a, b) => {
    if (a.status === 'violation' && b.status !== 'violation') return -1
    if (a.status !== 'violation' && b.status === 'violation') return 1
    return a.distance_ft - b.distance_ft
  })

  return results
}

/** Get all clearance results (including OK) for a complete picture */
export function getAllClearanceResults(
  spots: SpotWithAircraft[],
  obstacles: ParkingObstacle[],
  apronContext: ApronContext = 'parking'
): ClearanceResult[] {
  const results: ClearanceResult[] = []

  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      results.push(checkWingtipClearance(spots[i], spots[j], apronContext))
    }
  }

  for (const spot of spots) {
    for (const obstacle of obstacles) {
      results.push(checkObstacleClearance(spot, obstacle, apronContext))
    }
  }

  return results
}
