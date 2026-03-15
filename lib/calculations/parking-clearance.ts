// UFC 3-260-01 Aircraft Parking Clearance Engine
// Calculates wingtip clearance requirements and violations for parking plans

import { offsetPoint, distanceFt, type LatLon } from './geometry'
import type { ParkingSpot, ParkingObstacle } from '../supabase/parking'

// ── ADG Classification (UFC 3-260-01 Table 3-1) ──

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

// ── Wingtip Clearance Requirements (UFC 3-260-01 Table 3-8) ──

type ClearanceTable = { taxiway: number; apron: number; reduced: number }

const CLEARANCE_TABLE: Record<ADGGroup, ClearanceTable> = {
  I:   { taxiway: 20, apron: 15, reduced: 10 },
  II:  { taxiway: 26, apron: 20, reduced: 10 },
  III: { taxiway: 34, apron: 25, reduced: 15 },
  IV:  { taxiway: 40, apron: 25, reduced: 15 },
  V:   { taxiway: 53, apron: 25, reduced: 15 },
  VI:  { taxiway: 66, apron: 25, reduced: 15 },
}

export type ClearanceContext = 'taxiway' | 'apron' | 'reduced'

export function getDefaultClearance(adg: ADGGroup, context: ClearanceContext = 'apron'): number {
  return CLEARANCE_TABLE[adg][context]
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
    const bearing = (Math.atan2(rotY, rotX) * 180 / Math.PI + 360) % 360
    // bearing: 0 = north (up), but atan2 gives 0 = east, so rotate -90
    const mapBearing = (90 - Math.atan2(rotY, rotX) * 180 / Math.PI + 360) % 360
    const pt = offsetPoint(center, mapBearing, dist)
    coords.push([pt.lon, pt.lat])
  }

  return coords
}

// ── Wingtip-to-wingtip clearance check ──

export function checkWingtipClearance(
  spotA: SpotWithAircraft,
  spotB: SpotWithAircraft
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

  // Required clearance: use the higher ADG requirement between the two aircraft
  const adgA = getADGFromWingspan(spotA.wingspan_ft)
  const adgB = getADGFromWingspan(spotB.wingspan_ft)
  const defaultA = spotA.clearance_ft ?? getDefaultClearance(adgA)
  const defaultB = spotB.clearance_ft ?? getDefaultClearance(adgB)
  const required = Math.max(defaultA, defaultB)

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

function pointToPointDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }
  const obsPt: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  const tips = getWingtipPositions(center, spot.heading_deg, spot.wingspan_ft)
  const nt = getNoseTailPositions(center, spot.heading_deg, spot.length_ft)

  return Math.min(
    distanceFt(tips.left, obsPt),
    distanceFt(tips.right, obsPt),
    distanceFt(nt.nose, obsPt),
    distanceFt(nt.tail, obsPt),
  )
}

function pointToBuildingDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }
  const obsCenter: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  const tips = getWingtipPositions(center, spot.heading_deg, spot.wingspan_ft)
  const nt = getNoseTailPositions(center, spot.heading_deg, spot.length_ft)

  const aircraftPoints = [tips.left, tips.right, nt.nose, nt.tail]

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

  // Minimum distance: any aircraft point to any building corner
  let minDist = Infinity
  for (const ap of aircraftPoints) {
    for (const bc of bCorners) {
      minDist = Math.min(minDist, distanceFt(ap, bc))
    }
    // Also check distance to building center minus half-diagonal
    const diagFt = Math.sqrt(halfW * halfW + halfL * halfL)
    const toCenterDist = distanceFt(ap, obsCenter)
    minDist = Math.min(minDist, Math.max(0, toCenterDist - diagFt))
  }

  return minDist
}

function pointToCircleDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }
  const obsCenter: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  const tips = getWingtipPositions(center, spot.heading_deg, spot.wingspan_ft)
  const nt = getNoseTailPositions(center, spot.heading_deg, spot.length_ft)
  const radius = obstacle.radius_ft || 0

  const aircraftPoints = [tips.left, tips.right, nt.nose, nt.tail]
  let minDist = Infinity
  for (const ap of aircraftPoints) {
    const d = distanceFt(ap, obsCenter) - radius
    minDist = Math.min(minDist, Math.max(0, d))
  }
  return minDist
}

function pointToLineDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  if (!obstacle.line_coords || obstacle.line_coords.length < 2) {
    return pointToPointDistance(spot, obstacle)
  }

  const center: LatLon = { lat: spot.latitude, lon: spot.longitude }
  const tips = getWingtipPositions(center, spot.heading_deg, spot.wingspan_ft)
  const nt = getNoseTailPositions(center, spot.heading_deg, spot.length_ft)
  const aircraftPoints = [tips.left, tips.right, nt.nose, nt.tail]

  let minDist = Infinity
  for (const ap of aircraftPoints) {
    for (const coord of obstacle.line_coords) {
      const linePt: LatLon = { lat: coord[1], lon: coord[0] }
      minDist = Math.min(minDist, distanceFt(ap, linePt))
    }
  }
  return minDist
}

export function checkObstacleClearance(
  spot: SpotWithAircraft,
  obstacle: ParkingObstacle
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

  const adg = getADGFromWingspan(spot.wingspan_ft)
  const required = spot.clearance_ft ?? getDefaultClearance(adg)

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
  obstacles: ParkingObstacle[]
): ClearanceResult[] {
  const results: ClearanceResult[] = []

  // Check all aircraft pairs
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const result = checkWingtipClearance(spots[i], spots[j])
      if (result.status !== 'ok') {
        results.push(result)
      }
    }
  }

  // Check aircraft vs obstacles
  for (const spot of spots) {
    for (const obstacle of obstacles) {
      const result = checkObstacleClearance(spot, obstacle)
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
  obstacles: ParkingObstacle[]
): ClearanceResult[] {
  const results: ClearanceResult[] = []

  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      results.push(checkWingtipClearance(spots[i], spots[j]))
    }
  }

  for (const spot of spots) {
    for (const obstacle of obstacles) {
      results.push(checkObstacleClearance(spot, obstacle))
    }
  }

  return results
}
