import { describe, it, expect } from 'vitest'
import {
  checkWingtipClearance,
  checkObstacleClearance,
  findAllViolations,
  type SpotWithAircraft,
} from '@/lib/calculations/parking-clearance'
import type { ParkingObstacle } from '@/lib/supabase/parking'

// Locks in the UFC 3-260-01 aircraft-spacing geometry in
// lib/calculations/parking-clearance.ts. Previously only 3 trivial lookup
// helpers were tested; the actual collision math (which decides whether parked
// aircraft are safely separated) had no coverage, so a regression could report
// "clear" when wingtips actually overlap. We use a manual clearance_ft override
// so the *required* distance is deterministic (25 ft) and assert the measured
// distance + ok/warning/violation verdict.

// Feet-per-degree at the equator, matching the engine's own projection
// (111319.9 m/deg × 3.28084 ft/m). Placing spots this way keeps our fixtures
// numerically consistent with distanceToAircraftRect().
const FT_PER_DEG = 111319.9 * 3.28084

/** A 40 ft × 40 ft aircraft (halfspan 20 ft), nose north, placed `eastFt` east of the prime meridian at the equator. */
function spotAt(eastFt: number, id: string): SpotWithAircraft {
  return {
    id,
    plan_id: 'p1',
    base_id: 'b1',
    aircraft_name: 'TestJet',
    latitude: 0,
    longitude: eastFt / FT_PER_DEG,
    heading_deg: 0,
    wingspan_ft: 40,
    length_ft: 40,
    pivot_point_ft: 0,
    clearance_ft: 25, // manual override → required_ft is exactly 25, context-independent
  } as unknown as SpotWithAircraft
}

describe('checkWingtipClearance', () => {
  it('reports OK when the wingtip gap comfortably exceeds the requirement', () => {
    // centers 100 ft apart, halfspans 20+20 → ~60 ft gap, well over the 25 ft req
    const r = checkWingtipClearance(spotAt(0, 'a'), spotAt(100, 'b'))
    expect(r.status).toBe('ok')
    expect(r.required_ft).toBe(25)
    expect(r.distance_ft).toBeGreaterThan(55)
    expect(r.distance_ft).toBeLessThan(65)
  })

  it('reports a VIOLATION when wingtips are closer than the requirement', () => {
    // centers 64 ft apart → ~24 ft gap, under the 25 ft req
    const r = checkWingtipClearance(spotAt(0, 'a'), spotAt(64, 'b'))
    expect(r.status).toBe('violation')
    expect(r.distance_ft).toBeLessThan(25)
  })

  it('reports a WARNING in the buffer band just above the requirement', () => {
    // centers 66 ft apart → ~26 ft gap: ≥ 25 but < 25×1.1 (27.5)
    const r = checkWingtipClearance(spotAt(0, 'a'), spotAt(66, 'b'))
    expect(r.status).toBe('warning')
  })

  it('reports a VIOLATION (distance ~0) when two aircraft overlap', () => {
    const r = checkWingtipClearance(spotAt(0, 'a'), spotAt(10, 'b'))
    expect(r.status).toBe('violation')
    expect(r.distance_ft).toBe(0)
  })
})

describe('findAllViolations', () => {
  it('returns only the non-clear pairs, leaving safely-spaced aircraft out', () => {
    const spots = [spotAt(0, 'a'), spotAt(64, 'b'), spotAt(2000, 'c')]
    // a–b overlap (violation); a–c and b–c are far apart (ok)
    const results = findAllViolations(spots, [])
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('violation')
    expect([results[0].spot_a_id, results[0].spot_b_id].sort()).toEqual(['a', 'b'])
  })

  it('returns nothing when every aircraft is safely separated', () => {
    const spots = [spotAt(0, 'a'), spotAt(500, 'b'), spotAt(1000, 'c')]
    expect(findAllViolations(spots, [])).toHaveLength(0)
  })
})

describe('checkObstacleClearance (point obstacle)', () => {
  function pointObstacleAt(eastFt: number): ParkingObstacle {
    return {
      id: 'o1',
      name: 'Light Cart',
      obstacle_type: 'point',
      latitude: 0,
      longitude: eastFt / FT_PER_DEG,
    } as unknown as ParkingObstacle
  }

  it('is OK when the obstacle clears the aircraft by more than the requirement', () => {
    // obstacle 60 ft east of center → ~40 ft from the 20 ft halfspan edge
    const r = checkObstacleClearance(spotAt(0, 'a'), pointObstacleAt(60))
    expect(r.status).toBe('ok')
    expect(r.distance_ft).toBeGreaterThan(35)
  })

  it('is a VIOLATION when the obstacle is inside the required clearance', () => {
    // obstacle 40 ft east → ~20 ft from the wing edge, under the 25 ft req
    const r = checkObstacleClearance(spotAt(0, 'a'), pointObstacleAt(40))
    expect(r.status).toBe('violation')
    expect(r.distance_ft).toBeLessThan(25)
  })
})
