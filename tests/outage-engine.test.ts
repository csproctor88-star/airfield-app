import { describe, it, expect } from 'vitest'
import {
  calculateComponentOutage,
  calculateSystemHealth,
  detectAdjacentViolation,
  detectConsecutiveViolation,
} from '@/lib/outage-rules'
import type { InfrastructureFeature, LightingSystem, LightingSystemComponent } from '@/lib/supabase/types'

// These tests lock in the DAFMAN 13-204v2 Table A3.1 outage math in
// lib/outage-rules.ts — the engine that decides whether a lighting outage has
// crossed a regulatory limit (and thus requires a NOTAM / CE / TERPS action).
// Before this file only the cosmetic getAlertTier() wrapper was tested, so a
// regression in the real math would silently produce confident-but-wrong
// "within limits" answers. Each block is one worked regulatory example.

// ── Fixture factories (only the fields the engine reads matter) ──

let seq = 0
function feat(overrides: Partial<InfrastructureFeature>): InfrastructureFeature {
  seq += 1
  return {
    id: `f${seq}`,
    status: 'operational',
    latitude: 0,
    longitude: 0,
    bar_group_id: null,
    system_component_id: 'c1',
    ...overrides,
  } as unknown as InfrastructureFeature
}

function comp(overrides: Partial<LightingSystemComponent>): LightingSystemComponent {
  return {
    id: 'c1',
    label: 'Edge Lights',
    component_type: 'edge',
    allowable_outage_pct: null,
    allowable_outage_count: null,
    allowable_outage_consecutive: null,
    allowable_no_adjacent: false,
    is_zero_tolerance: false,
    allowable_outage_text: null,
    requires_notam: false,
    requires_ce_notification: false,
    requires_system_shutoff: false,
    requires_terps_notification: false,
    requires_obstruction_notam_attrs: false,
    notam_text_template: null,
    q_code: null,
    ...overrides,
  } as unknown as LightingSystemComponent
}

/** N features along a west→east line; `inopIdx` marks which (by index) are inoperative. */
function line(n: number, inopIdx: number[] = [], extra: Partial<InfrastructureFeature> = {}): InfrastructureFeature[] {
  return Array.from({ length: n }, (_, i) =>
    feat({ longitude: i, latitude: 0, status: inopIdx.includes(i) ? 'inoperative' : 'operational', ...extra }),
  )
}

describe('calculateComponentOutage — percentage threshold', () => {
  it('is within limits at exactly the allowable percent (10% allowed, 10% out)', () => {
    const features = line(20, [0, 1]) // 2 of 20 = 10%
    const r = calculateComponentOutage(comp({ allowable_outage_pct: 10 }), features)
    expect(r.outagePct).toBe(10)
    expect(r.isExceeded).toBe(false)
    // 10% sits in the "approaching" band (>= allowable-5 with some outage)
    expect(r.isApproaching).toBe(true)
  })

  it('is exceeded one light past the allowable percent (10% allowed, 15% out)', () => {
    const features = line(20, [0, 1, 2]) // 3 of 20 = 15%
    const r = calculateComponentOutage(comp({ allowable_outage_pct: 10 }), features)
    expect(r.outagePct).toBe(15)
    expect(r.isExceeded).toBe(true)
  })
})

describe('calculateComponentOutage — zero tolerance', () => {
  it('is exceeded by a single inoperative light regardless of percentage', () => {
    const features = line(50, [7]) // 1 of 50 = 2%
    const r = calculateComponentOutage(comp({ is_zero_tolerance: true }), features)
    expect(r.isZeroTolerance).toBe(true)
    expect(r.isExceeded).toBe(true)
  })

  it('is not exceeded when zero-tolerance and everything is operational', () => {
    const r = calculateComponentOutage(comp({ is_zero_tolerance: true }), line(10))
    expect(r.isExceeded).toBe(false)
  })
})

describe('calculateComponentOutage — bar-out rule (DAFMAN: a 5-lamp bar is out at 3+ inop)', () => {
  it('counts a bar as out when 3 of its lamps are inoperative', () => {
    const bar = line(5, [0, 1, 2], { bar_group_id: 'bar1' })
    const r = calculateComponentOutage(comp({ allowable_outage_count: 0 }), bar)
    expect(r.totalBars).toBe(1)
    expect(r.barsOut).toBe(1)
    // bars-out (1) exceeds the allowable count (0)
    expect(r.isExceeded).toBe(true)
  })

  it('does NOT count a bar as out at only 2 inop lamps', () => {
    const bar = line(5, [0, 1], { bar_group_id: 'bar1' })
    const r = calculateComponentOutage(comp({ allowable_outage_count: 0 }), bar)
    expect(r.totalBars).toBe(1)
    expect(r.barsOut).toBe(0)
    expect(r.isExceeded).toBe(false)
  })
})

describe('detectAdjacentViolation', () => {
  it('flags two neighbouring inoperative lights', () => {
    // positions 1 and 2 are adjacent and both out
    expect(detectAdjacentViolation(line(4, [1, 2]))).toBe(true)
  })

  it('does not flag inoperative lights separated by a working one', () => {
    // positions 0 and 2 are out, position 1 between them is on
    expect(detectAdjacentViolation(line(3, [0, 2]))).toBe(false)
  })
})

describe('detectConsecutiveViolation', () => {
  it('flags a run longer than the allowed maximum (max 2, run of 3)', () => {
    expect(detectConsecutiveViolation(line(5, [0, 1, 2]), 2)).toBe(true)
  })

  it('allows a run equal to the maximum (max 2, run of 2)', () => {
    expect(detectConsecutiveViolation(line(5, [0, 1, 3]), 2)).toBe(false)
  })
})

describe('calculateSystemHealth — status rollup', () => {
  const system = { id: 's1', name: 'RWY 05 Edge', system_type: 'runway_edge', runway_or_taxiway: '05/23', is_precision: false } as unknown as LightingSystem

  it('reports "operational" with no outages', () => {
    const c = comp({ id: 'c1', allowable_outage_pct: 10 })
    const health = calculateSystemHealth(system, [c], line(10))
    expect(health.status).toBe('operational')
    expect(health.exceededComponents).toHaveLength(0)
    expect(health.inoperativeFeatures).toBe(0)
  })

  it('reports "exceeded" when a non-overall component is over its limit', () => {
    const c = comp({ id: 'c1', component_type: 'edge', allowable_outage_pct: 10 })
    const features = line(20, [0, 1, 2, 3]) // 20% out, system_component_id 'c1'
    const health = calculateSystemHealth(system, [c], features)
    expect(health.exceededComponents).toHaveLength(1)
    expect(health.status).toBe('exceeded')
    expect(health.worstComponent?.componentId).toBe('c1')
  })

  it('reports "degraded" when there is an outage but still within limits', () => {
    const c = comp({ id: 'c1', allowable_outage_pct: 50 })
    const features = line(20, [0, 1]) // 10% out, under the 50% allowance
    const health = calculateSystemHealth(system, [c], features)
    expect(health.status).toBe('degraded')
    expect(health.inoperativeFeatures).toBe(2)
  })

  it('reports "inoperative" when the system-wide "overall" component is exceeded', () => {
    const overall = comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 10 })
    const features = line(20, [0, 1, 2, 3, 4]) // 25% out
    const health = calculateSystemHealth(system, [overall], features)
    expect(health.status).toBe('inoperative')
  })
})

// ── FAA Part 139 configuration ──
// The same data-driven engine serves civilian bases whose components are cloned
// from the FAA templates (AC 150/5340-26C thresholds, JO 7930.2U keywords). FAA
// components carry NO DAFMAN fields (q_code null, no CE/TERPS/shutoff, no
// barrette/consecutive/adjacent), so those never surface for civilian bases.
describe('FAA-configured components (14 CFR §139.311 / AC 150/5340-26C)', () => {
  // Runway edge: 85% must be on → allowable 15% out, no Q-code, no CE/TERPS.
  const faaEdge = () => comp({
    id: 'c1', component_type: 'overall', label: 'Runway Edge Lights',
    allowable_outage_pct: 15, allowable_outage_count: null,
    allowable_outage_consecutive: null, allowable_no_adjacent: false,
    is_zero_tolerance: false, requires_notam: true,
    requires_ce_notification: false, requires_system_shutoff: false,
    requires_terps_notification: false, q_code: null,
    notam_text_template: 'Runway Edge Lights (REDL) — specify runway — U/S',
  })

  it('flags U/S past the AC 150/5340-26C edge tolerance (>15% out)', () => {
    const out = calculateComponentOutage(faaEdge(), line(20, [0, 1, 2, 3])) // 20% out
    expect(out.isExceeded).toBe(true)
    expect(out.outagePct).toBe(20)
  })

  it('stays within limits at exactly 85% on (15% out)', () => {
    const out = calculateComponentOutage(faaEdge(), line(20, [0, 1, 2])) // 15% out
    expect(out.isExceeded).toBe(false)
  })

  it('carries no DAFMAN-specific outputs (Q-code / CE / TERPS / shutoff)', () => {
    const out = calculateComponentOutage(faaEdge(), line(20, [0, 1, 2, 3]))
    expect(out.qCode).toBeNull()
    expect(out.requiredActions.notifyCE).toBe(false)
    expect(out.requiredActions.notifyTerps).toBe(false)
    expect(out.requiredActions.systemShutoff).toBe(false)
    expect(out.requiredActions.notam).toBe(true)
  })

  it('honors REIL zero-tolerance (any unit out is U/S)', () => {
    const reil = comp({ id: 'c1', component_type: 'overall', label: 'REIL', is_zero_tolerance: true, requires_notam: true })
    expect(calculateComponentOutage(reil, line(4, [0])).isExceeded).toBe(true)
    expect(calculateComponentOutage(reil, line(4, [])).isExceeded).toBe(false)
  })
})
