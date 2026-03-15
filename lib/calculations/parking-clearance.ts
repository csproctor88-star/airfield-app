// UFC 3-260-01 Table 6-1a A/AF Clearance Engine
// Calculates wingtip clearance requirements and violations for parking plans
// Reference: UFC 3-260-01 (4 Feb 2019, Change 3, 4 Feb 2026)

import { offsetPoint, distanceFt, bearing, normalizeBearing, pointToSegmentDistanceFt, type LatLon } from './geometry'
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

// ── UFC 3-260-01 Table 6-1a A/AF Wingtip Clearances ──
// All clearances from Table 6-1a, Items 4-8

/** Apron area context — determines which UFC Item applies */
export type ApronContext =
  | 'parking'              // Item 4(P): Standard parking apron
  | 'parking_transient'    // Item 4(P): Transient apron (C-5/C-17)
  | 'parking_kc_refuel'    // Item 4(P): KC-10/KC-46/KC-135 refueling ops
  | 'interior_taxilane'    // Item 5(I): Interior taxilane
  | 'peripheral_taxilane'  // Item 6(T): Peripheral taxilane
  | 'peripheral_transient' // Item 6(T): Peripheral taxilane, transient apron

/** KC refueling aircraft designations */
const KC_REFUEL_AIRCRAFT = ['KC-10', 'KC-46', 'KC-135']

/** Check if an aircraft name matches a KC refueling aircraft */
export function isKcRefuelAircraft(aircraftName: string | null): boolean {
  if (!aircraftName) return false
  const upper = aircraftName.toUpperCase()
  return KC_REFUEL_AIRCRAFT.some(kc => upper.startsWith(kc))
}

/** Clearance detail — returned by getWingtipClearanceDetail() */
export type ClearanceDetail = {
  clearance_ft: number
  ufc_item: string    // e.g., "Item 4(P)"
  description: string // e.g., "Parking apron, WS ≥ 110ft"
}

/** Get wingtip clearance with UFC reference per Table 6-1a */
export function getWingtipClearanceDetail(
  wingspanFt: number,
  context: ApronContext = 'parking',
  aircraftName?: string | null,
): ClearanceDetail {
  const large = wingspanFt >= 110 // 33.5m threshold

  // Item 4(P) — Wingtip clearance of parked aircraft
  if (context === 'parking' || context === 'parking_transient' || context === 'parking_kc_refuel') {
    // KC refueling override: applies regardless of context if aircraft is KC type
    if (context === 'parking_kc_refuel' || (aircraftName && isKcRefuelAircraft(aircraftName))) {
      return {
        clearance_ft: 25,
        ufc_item: 'Item 4(P)',
        description: 'KC-10/KC-46/KC-135 refueling ops',
      }
    }
    // Transient C-5/C-17
    if (context === 'parking_transient') {
      return {
        clearance_ft: 25,
        ufc_item: 'Item 4(P)',
        description: 'Transient apron (C-5/C-17), para 6-5.9',
      }
    }
    // Standard parking
    return {
      clearance_ft: large ? 20 : 10,
      ufc_item: 'Item 4(P)',
      description: large ? 'WS ≥ 110ft' : 'WS < 110ft',
    }
  }

  // Item 5(I) — Wingtip clearance on interior taxilanes
  if (context === 'interior_taxilane') {
    return {
      clearance_ft: 20,
      ufc_item: 'Item 5(I)',
      description: large
        ? 'Interior taxilane (WS ≥ 110ft — see Note 1 for reductions)'
        : 'Interior taxilane, WS < 110ft',
    }
  }

  // Item 6(T) — Wingtip clearance on peripheral taxilanes
  if (context === 'peripheral_taxilane' || context === 'peripheral_transient') {
    if (context === 'peripheral_transient') {
      return {
        clearance_ft: 25,
        ufc_item: 'Item 6(T)',
        description: 'Peripheral taxilane, transient apron',
      }
    }
    return {
      clearance_ft: large ? 50 : 30,
      ufc_item: 'Item 6(T)',
      description: large
        ? 'Peripheral taxilane, WS ≥ 110ft'
        : 'Peripheral taxilane, WS < 110ft',
    }
  }

  // Default: parking
  return {
    clearance_ft: large ? 20 : 10,
    ufc_item: 'Item 4(P)',
    description: large ? 'WS ≥ 110ft' : 'WS < 110ft',
  }
}

/** Simple getter — returns just the clearance value */
export function getWingtipClearance(
  wingspanFt: number,
  context: ApronContext = 'parking',
  aircraftName?: string | null,
): number {
  return getWingtipClearanceDetail(wingspanFt, context, aircraftName).clearance_ft
}

/** Item 7(C) — Distance from peripheral taxilane CL to apron boundary */
export function getApronBoundaryClearance(wingspanFt: number): ClearanceDetail {
  const large = wingspanFt >= 110
  return {
    clearance_ft: large ? 37.5 : 25,
    ufc_item: 'Item 7(C)',
    description: large
      ? 'Peripheral taxilane CL to apron boundary, WS ≥ 110ft'
      : 'Peripheral taxilane CL to apron boundary, WS < 110ft',
  }
}

/** Item 8 — Clear distance around aircraft during fueling */
export function getFuelingSafetyClearance(type: 'vent' | 'pressurized'): ClearanceDetail {
  if (type === 'pressurized') {
    return {
      clearance_ft: 50,
      ufc_item: 'Item 8',
      description: 'Pressurized fuel servicing component (T.O. 00-25-172)',
    }
  }
  return {
    clearance_ft: 25,
    ufc_item: 'Item 8',
    description: 'Aircraft fuel vent outlets (T.O. 00-25-172)',
  }
}

/** Item 15 — Clearance from apron boundary to fixed/mobile obstacles */
export function getObstacleClearanceDescription(wingspanFt: number, context: ApronContext): ClearanceDetail {
  // Per Item 15: 0.5 × wingspan + wingtip clearance (Item 5 or 6) - distance from CL to boundary (Item 7)
  // Simplified: we use the same wingtip clearance as the selected context
  const detail = getWingtipClearanceDetail(wingspanFt, context)
  return {
    clearance_ft: detail.clearance_ft,
    ufc_item: detail.ufc_item,
    description: detail.description,
  }
}

/** UI labels for context selector */
export const APRON_CONTEXT_LABELS: Record<ApronContext, string> = {
  parking: 'Item 4(P) — Parking Apron',
  parking_transient: 'Item 4(P) — Transient Apron (C-5/C-17)',
  parking_kc_refuel: 'Item 4(P) — KC Refueling Operations',
  interior_taxilane: 'Item 5(I) — Interior Taxilane',
  peripheral_taxilane: 'Item 6(T) — Peripheral Taxilane',
  peripheral_transient: 'Item 6(T) — Peripheral Taxilane (Transient)',
}

/** Short labels for compact display */
export const APRON_CONTEXT_SHORT: Record<ApronContext, string> = {
  parking: 'Parking (P)',
  parking_transient: 'Transient (P)',
  parking_kc_refuel: 'KC Refuel (P)',
  interior_taxilane: 'Interior (I)',
  peripheral_taxilane: 'Peripheral (T)',
  peripheral_transient: 'Periph Trans (T)',
}

// Keep old function signature for compatibility
export type ClearanceContext = 'taxiway' | 'apron' | 'reduced'

export function getDefaultClearance(adg: ADGGroup, context: ClearanceContext = 'apron'): number {
  const wsThreshold = ADG_RANGES.find(r => r.group === adg)?.maxWingspan ?? 100
  const large = wsThreshold >= 110
  switch (context) {
    case 'taxiway': return large ? 50 : 30
    case 'apron': return large ? 20 : 10
    case 'reduced': return large ? 20 : 10
    default: return large ? 20 : 10
  }
}

// ── UFC 3-260-01 Table 6-1a — Complete Reference ──
// All 16 items with descriptions and applicability notes

export type Table6_1aItem = {
  item: number
  letter: string
  title: string
  description: string
  values: string
  applicable_to_2d: boolean  // Whether the item applies to a 2D parking layout tool
}

export const TABLE_6_1A_ITEMS: Table6_1aItem[] = [
  {
    item: 1,
    letter: '',
    title: 'Size and Configuration',
    description: 'Aprons are individually designed to support specific aircraft uses. Dimensions determined by number/type of aircraft, function of apron, maneuvering characteristics, jet blast, unit integrity, site characteristics, and comprehensive plan objectives.',
    values: 'Variable — design aircraft wingspan/length',
    applicable_to_2d: true,
  },
  {
    item: 2,
    letter: 'W',
    title: 'Parking Space Width',
    description: 'Width of individual parking space perpendicular to aircraft longitudinal axis.',
    values: 'Design aircraft wingspan + 2× wingtip clearance (Item 4)',
    applicable_to_2d: true,
  },
  {
    item: 3,
    letter: 'L',
    title: 'Parking Space Length',
    description: 'Length of individual parking space parallel to aircraft longitudinal axis.',
    values: 'Design aircraft length',
    applicable_to_2d: true,
  },
  {
    item: 4,
    letter: 'P',
    title: 'Wingtip Clearance — Parked Aircraft',
    description: 'Minimum distance between wingtips of adjacent parked aircraft on the apron. See also DAFMAN 32-1084.',
    values: '10 ft (WS < 110 ft) · 20 ft (WS ≥ 110 ft) · 25 ft (transient C-5/C-17, para 6-5.9) · 25 ft (KC-10/KC-46/KC-135 refuel ops)',
    applicable_to_2d: true,
  },
  {
    item: 5,
    letter: 'I',
    title: 'Wingtip Clearance — Interior Taxilane',
    description: 'Minimum wingtip clearance for aircraft taxiing on interior taxilanes (between rows of parked aircraft). WS < 110 ft, except transient aprons.',
    values: '20 ft (WS < 110 ft, except transient)',
    applicable_to_2d: true,
  },
  {
    item: 6,
    letter: 'T',
    title: 'Wingtip Clearance — Peripheral Taxilane',
    description: 'Minimum wingtip clearance for aircraft taxiing on peripheral (primary) taxilanes along apron edges. See Notes 1, 6.',
    values: '25 ft (transient) · 30 ft (WS < 110 ft) · 50 ft (WS ≥ 110 ft, except transient) · 30 ft (new AMC C-5/C-17 bases)',
    applicable_to_2d: true,
  },
  {
    item: 7,
    letter: 'C',
    title: 'Peripheral Taxilane CL to Apron Boundary',
    description: 'Distance from peripheral taxilane centerline to the outside edge of the apron boundary marking.',
    values: '25 ft (WS < 110 ft) · 37.5 ft (WS ≥ 110 ft) · 50 ft min (WS ≥ 110 ft)',
    applicable_to_2d: true,
  },
  {
    item: 8,
    letter: '',
    title: 'Clear Distance During Fueling',
    description: 'Clear distance around aircraft during fueling operations per T.O. 00-25-172 and para 6-11.1. Consider refueling ops when locating taxilanes.',
    values: '25 ft (fuel vent outlets) · 50 ft (pressurized fuel servicing component)',
    applicable_to_2d: true,
  },
  {
    item: 9,
    letter: '',
    title: 'Grades in Direction of Drainage',
    description: 'Slopes combined (lateral + transverse) to derive max slope in direction of drainage. No grade changes within aircraft block dimensions (Air Force).',
    values: 'Min 0.5% · Max 1.5%',
    applicable_to_2d: false,
  },
  {
    item: 10,
    letter: '',
    title: 'Width of Shoulders',
    description: 'Total width including paved and unpaved shoulders.',
    values: 'Class A: 25 ft · Class B: 50 ft (or 25 ft for B-52/C-5/E-4/747)',
    applicable_to_2d: false,
  },
  {
    item: 11,
    letter: '',
    title: 'Paved Width of Shoulders',
    description: 'Paved portion of shoulder width.',
    values: 'Class A: N/A · Class B: 50 ft',
    applicable_to_2d: false,
  },
  {
    item: 12,
    letter: '',
    title: 'Longitudinal Grade of Shoulders',
    description: 'Longitudinal grade of apron shoulders.',
    values: 'Variable — conform to abutting primary pavement',
    applicable_to_2d: false,
  },
  {
    item: 13,
    letter: '',
    title: 'Transverse Grade of Paved Shoulder',
    description: 'Transverse slope of paved shoulder surface.',
    values: 'Min 1.5% · Max 2.0% (B-52 airfields) or Min 2.0% · Max 4.0%',
    applicable_to_2d: false,
  },
  {
    item: 14,
    letter: '',
    title: 'Transverse Grade of Unpaved Shoulders',
    description: 'Unpaved shoulders graded for positive drainage away from paved surfaces.',
    values: '40 mm (1.5 in) drop-off at edge, Min 2.0% Max 4.0%',
    applicable_to_2d: false,
  },
  {
    item: 15,
    letter: '',
    title: 'Clearance from Apron Boundary to Obstacles',
    description: 'Compute: 0.5 × wingspan of most demanding aircraft + wingtip clearance (Item 5 or 6) − distance from taxilane CL to apron boundary (Item 7). Clear of all fixed/mobile obstacles. Light poles not allowed without waiver.',
    values: 'Variable — derived from Items 5/6/7 and aircraft wingspan',
    applicable_to_2d: true,
  },
  {
    item: 16,
    letter: '',
    title: 'Grades in Cleared Area Beyond Shoulders',
    description: 'Grades in the cleared area beyond paved and unpaved shoulders to fixed/mobile obstacles.',
    values: '40 mm drop-off at edge, Min 2% Max 10%',
    applicable_to_2d: false,
  },
]

// ── Spot with Aircraft data ──

export type SpotWithAircraft = ParkingSpot & {
  wingspan_ft: number
  length_ft: number
  pivot_point_ft: number  // nose-to-nose-gear distance; 0 = center-based placement
}

/**
 * Compute the aircraft center position from a nose gear block location.
 * The spot stores the nose gear block position. The aircraft center is offset
 * backward (opposite of heading) by half the fuselage length minus the pivot distance.
 * pivot_point_ft = distance from nose tip to nose gear.
 * Offset = length/2 - pivot_point_ft (moves center behind the nose gear).
 */
export function getAircraftCenter(
  noseGearLon: number,
  noseGearLat: number,
  headingDeg: number,
  lengthFt: number,
  pivotPointFt: number,
): { lon: number; lat: number } {
  if (pivotPointFt <= 0) return { lon: noseGearLon, lat: noseGearLat }
  // Distance from nose gear to aircraft center = (length/2) - pivotPointFt
  const offsetFt = lengthFt / 2 - pivotPointFt
  if (Math.abs(offsetFt) < 0.1) return { lon: noseGearLon, lat: noseGearLat }
  // Offset is backward from heading (add 180°)
  const backBearing = (headingDeg + 180) % 360
  const result = offsetPoint({ lat: noseGearLat, lon: noseGearLon }, backBearing, offsetFt)
  return { lon: result.lon, lat: result.lat }
}

/** Get the true aircraft center for a spot (accounting for nose gear offset) */
export function spotCenter(spot: SpotWithAircraft): LatLon {
  const c = getAircraftCenter(spot.longitude, spot.latitude, spot.heading_deg, spot.length_ft, spot.pivot_point_ft)
  return { lat: c.lat, lon: c.lon }
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
  ufc_item: string    // e.g., "Item 4(P)"
  ufc_desc: string    // e.g., "Parking apron, WS ≥ 110ft"
}

// ── Wingtip geometry helpers ──

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

export function generateClearanceZonePolygon(
  spot: SpotWithAircraft,
  clearanceFt: number
): [number, number][] {
  const center: LatLon = spotCenter(spot)
  const halfLen = spot.length_ft / 2
  const halfSpan = spot.wingspan_ft / 2 + clearanceFt
  const headingRad = (spot.heading_deg * Math.PI) / 180

  // Helper: rotate local (x=lateral, y=forward) → map coords and project
  const project = (lx: number, ly: number): [number, number] => {
    const rx = lx * Math.cos(headingRad) + ly * Math.sin(headingRad)
    const ry = -lx * Math.sin(headingRad) + ly * Math.cos(headingRad)
    const dist = Math.sqrt(rx * rx + ry * ry)
    const bearing = (90 - Math.atan2(ry, rx) * 180 / Math.PI + 360) % 360
    const pt = offsetPoint(center, bearing, dist)
    return [pt.lon, pt.lat]
  }

  // Simple rectangle: clearance extends laterally from wingtips only
  // No extra clearance fore/aft — just the aircraft length
  return [
    project(halfSpan, halfLen),   // right-nose
    project(halfSpan, -halfLen),  // right-tail
    project(-halfSpan, -halfLen), // left-tail
    project(-halfSpan, halfLen),  // left-nose
    project(halfSpan, halfLen),   // close
  ]
}

// ── Wingtip-to-wingtip clearance check ──

/** Sample points along an aircraft's bounding rectangle perimeter */
function getAircraftPerimeterPoints(spot: SpotWithAircraft): LatLon[] {
  const center: LatLon = spotCenter(spot)
  const halfLen = spot.length_ft / 2
  const halfWS = spot.wingspan_ft / 2
  const h = spot.heading_deg
  const leftB = (h - 90 + 360) % 360
  const rightB = (h + 90) % 360
  const tailB = (h + 180) % 360

  const pts: LatLon[] = []
  // 4 corners
  const nose = offsetPoint(center, h, halfLen)
  const tail = offsetPoint(center, tailB, halfLen)
  pts.push(
    offsetPoint(nose, leftB, halfWS),
    offsetPoint(nose, rightB, halfWS),
    offsetPoint(tail, rightB, halfWS),
    offsetPoint(tail, leftB, halfWS),
  )
  // Midpoints of each edge (wing leading/trailing edges, wingtips)
  pts.push(nose, tail)
  pts.push(offsetPoint(center, leftB, halfWS))
  pts.push(offsetPoint(center, rightB, halfWS))
  // Quarter points along the long edges for better coverage
  const qNose = offsetPoint(center, h, halfLen / 2)
  const qTail = offsetPoint(center, tailB, halfLen / 2)
  pts.push(
    offsetPoint(qNose, leftB, halfWS),
    offsetPoint(qNose, rightB, halfWS),
    offsetPoint(qTail, leftB, halfWS),
    offsetPoint(qTail, rightB, halfWS),
  )
  return pts
}

export function checkWingtipClearance(
  spotA: SpotWithAircraft,
  spotB: SpotWithAircraft,
  apronContext: ApronContext = 'parking'
): ClearanceResult {
  // Sample points along each aircraft's outline and measure distance
  // to the other aircraft's bounding rectangle
  const ptsA = getAircraftPerimeterPoints(spotA)
  const ptsB = getAircraftPerimeterPoints(spotB)

  const distances: number[] = []
  for (const pt of ptsA) distances.push(distanceToAircraftRect(spotB, pt))
  for (const pt of ptsB) distances.push(distanceToAircraftRect(spotA, pt))

  const minDistance = Math.min(...distances)

  // Get clearance detail for each aircraft (includes KC-refuel auto-detect)
  const detailA = spotA.clearance_ft != null
    ? { clearance_ft: spotA.clearance_ft, ufc_item: 'Manual', description: 'Manual override' }
    : getWingtipClearanceDetail(spotA.wingspan_ft, apronContext, spotA.aircraft_name)
  const detailB = spotB.clearance_ft != null
    ? { clearance_ft: spotB.clearance_ft, ufc_item: 'Manual', description: 'Manual override' }
    : getWingtipClearanceDetail(spotB.wingspan_ft, apronContext, spotB.aircraft_name)

  // Use the more restrictive clearance requirement
  const governing = detailA.clearance_ft >= detailB.clearance_ft ? detailA : detailB

  let status: ClearanceResult['status'] = 'ok'
  if (minDistance < governing.clearance_ft) {
    status = 'violation'
  } else if (minDistance < governing.clearance_ft * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(minDistance * 10) / 10,
    required_ft: governing.clearance_ft,
    status,
    aircraft_a: spotA.aircraft_name || 'Aircraft',
    aircraft_b: spotB.aircraft_name || 'Aircraft',
    spot_a_id: spotA.id,
    spot_b_id: spotB.id,
    ufc_item: governing.ufc_item,
    ufc_desc: governing.description,
  }
}

// ── Obstacle clearance check ──

function distanceToAircraftRect(spot: SpotWithAircraft, obsPt: LatLon): number {
  const center: LatLon = spotCenter(spot)
  const dLon = obsPt.lon - center.lon
  const dLat = obsPt.lat - center.lat
  const eastFt = dLon * 111319.9 * Math.cos(center.lat * Math.PI / 180) * 3.28084
  const northFt = dLat * 111319.9 * 3.28084
  const headingRad = (spot.heading_deg * Math.PI) / 180
  const localAlong = eastFt * Math.sin(headingRad) + northFt * Math.cos(headingRad)
  const localCross = eastFt * Math.cos(headingRad) - northFt * Math.sin(headingRad)
  const halfLen = spot.length_ft / 2
  const halfWS = spot.wingspan_ft / 2
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
  const halfW = (obstacle.width_ft || 50) / 2
  const halfL = (obstacle.length_ft || 50) / 2
  const rot = obstacle.rotation_deg || 0
  const bCorners = [
    offsetPoint(offsetPoint(obsCenter, rot, halfL), (rot + 90) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, rot, halfL), (rot - 90 + 360) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, (rot + 180) % 360, halfL), (rot - 90 + 360) % 360, halfW),
    offsetPoint(offsetPoint(obsCenter, (rot + 180) % 360, halfL), (rot + 90) % 360, halfW),
  ]
  let minDist = Infinity
  for (const bc of bCorners) {
    minDist = Math.min(minDist, distanceToAircraftRect(spot, bc))
  }
  minDist = Math.min(minDist, distanceToAircraftRect(spot, obsCenter))
  return minDist
}

function pointToCircleDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  const obsCenter: LatLon = { lat: obstacle.latitude, lon: obstacle.longitude }
  const radius = obstacle.radius_ft || 0
  const rectDist = distanceToAircraftRect(spot, obsCenter)
  return Math.max(0, rectDist - radius)
}

function pointToLineDistance(spot: SpotWithAircraft, obstacle: ParkingObstacle): number {
  if (!obstacle.line_coords || obstacle.line_coords.length < 2) {
    return pointToPointDistance(spot, obstacle)
  }
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

  const detail = spot.clearance_ft != null
    ? { clearance_ft: spot.clearance_ft, ufc_item: 'Manual', description: 'Manual override' }
    : getWingtipClearanceDetail(spot.wingspan_ft, apronContext, spot.aircraft_name)

  let status: ClearanceResult['status'] = 'ok'
  if (distance < detail.clearance_ft) {
    status = 'violation'
  } else if (distance < detail.clearance_ft * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(distance * 10) / 10,
    required_ft: detail.clearance_ft,
    status,
    aircraft_a: spot.aircraft_name || 'Aircraft',
    aircraft_b: obstacle.name || 'Obstacle',
    spot_a_id: spot.id,
    obstacle_id: obstacle.id,
    ufc_item: detail.ufc_item,
    ufc_desc: detail.description,
  }
}

// ── Taxilane clearance (Items 5, 6, 7) ──

/** Taxilane data needed for clearance checks — defined inline to avoid circular deps */
export type TaxilaneForCheck = {
  id: string
  name: string | null
  taxilane_type: 'interior' | 'peripheral'
  design_wingspan_ft: number | null
  line_coords: [number, number][]
  is_transient: boolean
}

/** Compute the required taxilane envelope half-width */
export function getTaxilaneEnvelopeHalfWidth(
  taxilane: TaxilaneForCheck
): { halfWidth: number; detail: ClearanceDetail } {
  const designWingspan = taxilane.design_wingspan_ft ?? 100

  // Determine apron context from taxilane type + transient flag
  let context: ApronContext
  if (taxilane.taxilane_type === 'interior') {
    context = 'interior_taxilane'
  } else if (taxilane.is_transient) {
    context = 'peripheral_transient'
  } else {
    context = 'peripheral_taxilane'
  }

  const detail = getWingtipClearanceDetail(designWingspan, context)
  const halfWidth = 0.5 * designWingspan + detail.clearance_ft

  return { halfWidth, detail }
}

/** Generate a buffered polygon around a taxilane polyline centerline */
export function generateTaxilaneEnvelopePolygon(
  coords: [number, number][],
  halfWidthFt: number
): [number, number][] {
  if (coords.length < 2) return []

  const leftSide: [number, number][] = []
  const rightSide: [number, number][] = []

  for (let i = 0; i < coords.length; i++) {
    const cur: LatLon = { lat: coords[i][1], lon: coords[i][0] }

    // Compute perpendicular bearing at this vertex
    let perpBearing: number
    if (i === 0) {
      // First point — use bearing to next
      const next: LatLon = { lat: coords[i + 1][1], lon: coords[i + 1][0] }
      perpBearing = bearing(cur, next)
    } else if (i === coords.length - 1) {
      // Last point — use bearing from prev
      const prev: LatLon = { lat: coords[i - 1][1], lon: coords[i - 1][0] }
      perpBearing = bearing(prev, cur)
    } else {
      // Middle point — average bearings of adjacent segments
      const prev: LatLon = { lat: coords[i - 1][1], lon: coords[i - 1][0] }
      const next: LatLon = { lat: coords[i + 1][1], lon: coords[i + 1][0] }
      const b1 = bearing(prev, cur)
      const b2 = bearing(cur, next)
      // Average two bearings (handle wrap-around)
      const sinAvg = (Math.sin(b1 * Math.PI / 180) + Math.sin(b2 * Math.PI / 180)) / 2
      const cosAvg = (Math.cos(b1 * Math.PI / 180) + Math.cos(b2 * Math.PI / 180)) / 2
      perpBearing = ((Math.atan2(sinAvg, cosAvg) * 180 / Math.PI) + 360) % 360
    }

    const leftBearing = normalizeBearing(perpBearing - 90)
    const rightBearing = normalizeBearing(perpBearing + 90)

    const leftPt = offsetPoint(cur, leftBearing, halfWidthFt)
    const rightPt = offsetPoint(cur, rightBearing, halfWidthFt)

    leftSide.push([leftPt.lon, leftPt.lat])
    rightSide.push([rightPt.lon, rightPt.lat])
  }

  // Build polygon: left side forward + semicircular end cap at end +
  // right side backward + semicircular end cap at start + close
  const polygon: [number, number][] = []

  // Left side forward
  polygon.push(...leftSide)

  // Semicircular end cap at last vertex
  const lastPt: LatLon = { lat: coords[coords.length - 1][1], lon: coords[coords.length - 1][0] }
  const prevPt: LatLon = { lat: coords[coords.length - 2][1], lon: coords[coords.length - 2][0] }
  const endBearing = bearing(prevPt, lastPt)
  const endCapStartAngle = normalizeBearing(endBearing - 90)
  for (let i = 0; i <= 8; i++) {
    const angle = normalizeBearing(endCapStartAngle + (180 * i) / 8)
    const p = offsetPoint(lastPt, angle, halfWidthFt)
    polygon.push([p.lon, p.lat])
  }

  // Right side backward
  for (let i = rightSide.length - 1; i >= 0; i--) {
    polygon.push(rightSide[i])
  }

  // Semicircular end cap at first vertex
  const firstPt: LatLon = { lat: coords[0][1], lon: coords[0][0] }
  const nextPt: LatLon = { lat: coords[1][1], lon: coords[1][0] }
  const startBearing = bearing(firstPt, nextPt)
  const startCapStartAngle = normalizeBearing(startBearing + 90)
  for (let i = 0; i <= 8; i++) {
    const angle = normalizeBearing(startCapStartAngle + (180 * i) / 8)
    const p = offsetPoint(firstPt, angle, halfWidthFt)
    polygon.push([p.lon, p.lat])
  }

  // Close ring
  polygon.push(polygon[0])

  return polygon
}

/** Check parked aircraft clearance against a taxilane */
export function checkTaxilaneClearance(
  spot: SpotWithAircraft,
  taxilane: TaxilaneForCheck,
): ClearanceResult {
  const { halfWidth, detail } = getTaxilaneEnvelopeHalfWidth(taxilane)

  const center: LatLon = spotCenter(spot)

  // Get all extremity points of the parked aircraft
  const corners = getAircraftCorners(center, spot.heading_deg, spot.wingspan_ft, spot.length_ft)
  const tips = getWingtipPositions(center, spot.heading_deg, spot.wingspan_ft)
  const nt = getNoseTailPositions(center, spot.heading_deg, spot.length_ft)

  const extremities: LatLon[] = [
    ...corners,
    tips.left,
    tips.right,
    nt.nose,
    nt.tail,
  ]

  // For each extremity, compute minimum distance to the taxilane polyline
  let minDistance = Infinity
  for (const ext of extremities) {
    for (let i = 0; i < taxilane.line_coords.length - 1; i++) {
      const segStart: LatLon = { lat: taxilane.line_coords[i][1], lon: taxilane.line_coords[i][0] }
      const segEnd: LatLon = { lat: taxilane.line_coords[i + 1][1], lon: taxilane.line_coords[i + 1][0] }
      const dist = pointToSegmentDistanceFt(ext, segStart, segEnd)
      if (dist < minDistance) minDistance = dist
    }
  }

  // The aircraft violates if any extremity is within the envelope half-width
  let status: ClearanceResult['status'] = 'ok'
  if (minDistance < halfWidth) {
    status = 'violation'
  } else if (minDistance < halfWidth * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(minDistance * 10) / 10,
    required_ft: Math.round(halfWidth * 10) / 10,
    status,
    aircraft_a: spot.aircraft_name || 'Aircraft',
    aircraft_b: taxilane.name || 'Taxilane',
    spot_a_id: spot.id,
    spot_b_id: taxilane.id,
    ufc_item: detail.ufc_item,
    ufc_desc: detail.description,
  }
}

/** Check apron boundary distance from taxilane centerline (Item 7) */
export function checkApronBoundaryClearance(
  taxilane: TaxilaneForCheck,
  boundaryCoords: [number, number][],
  designWingspan: number,
): ClearanceResult {
  const requirement = getApronBoundaryClearance(designWingspan)

  let minDistance = Infinity
  for (const coord of taxilane.line_coords) {
    const pt: LatLon = { lat: coord[1], lon: coord[0] }
    for (let i = 0; i < boundaryCoords.length - 1; i++) {
      const segStart: LatLon = { lat: boundaryCoords[i][1], lon: boundaryCoords[i][0] }
      const segEnd: LatLon = { lat: boundaryCoords[i + 1][1], lon: boundaryCoords[i + 1][0] }
      const dist = pointToSegmentDistanceFt(pt, segStart, segEnd)
      if (dist < minDistance) minDistance = dist
    }
  }

  let status: ClearanceResult['status'] = 'ok'
  if (minDistance < requirement.clearance_ft) {
    status = 'violation'
  } else if (minDistance < requirement.clearance_ft * 1.1) {
    status = 'warning'
  }

  return {
    distance_ft: Math.round(minDistance * 10) / 10,
    required_ft: requirement.clearance_ft,
    status,
    aircraft_a: taxilane.name || 'Taxilane',
    aircraft_b: 'Apron Boundary',
    spot_a_id: taxilane.id,
    ufc_item: requirement.ufc_item,
    ufc_desc: requirement.description,
  }
}

// ── Batch violation check ──

export function findAllViolations(
  spots: SpotWithAircraft[],
  obstacles: ParkingObstacle[],
  apronContext: ApronContext = 'parking',
  taxilanes?: TaxilaneForCheck[]
): ClearanceResult[] {
  const results: ClearanceResult[] = []

  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const result = checkWingtipClearance(spots[i], spots[j], apronContext)
      if (result.status !== 'ok') {
        results.push(result)
      }
    }
  }

  for (const spot of spots) {
    for (const obstacle of obstacles) {
      const result = checkObstacleClearance(spot, obstacle, apronContext)
      if (result.status !== 'ok') {
        results.push(result)
      }
    }
  }

  if (taxilanes) {
    for (const spot of spots) {
      for (const taxilane of taxilanes) {
        const result = checkTaxilaneClearance(spot, taxilane)
        if (result.status !== 'ok') {
          results.push(result)
        }
      }
    }
  }

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
  apronContext: ApronContext = 'parking',
  taxilanes?: TaxilaneForCheck[]
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

  if (taxilanes) {
    for (const spot of spots) {
      for (const taxilane of taxilanes) {
        results.push(checkTaxilaneClearance(spot, taxilane))
      }
    }
  }

  return results
}
