import { describe, it, expect } from 'vitest'
import {
  calculateComponentOutage,
  calculateSystemHealth,
  detectAdjacentViolation,
  detectConsecutiveViolation,
  resolveEdgeThreshold,
  resolveComponentThreshold,
  RUNWAY_EDGE_CAT_II_III_OUTAGE_PCT,
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

// ── CAT II/III runway edge lights (AC 150/5340-26C Table A-8) ──
// CAT I runways tolerate 15% out (85% on); CAT II/III require 95% on (5% out).
// The engine keys this off lighting_systems.is_cat_ii_iii, tightening the
// runway_edge 'overall' component at calc time via resolveEdgeThreshold.
describe('resolveEdgeThreshold — CAT II/III edge-light tightening', () => {
  const edge15 = () => comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 15, allowable_outage_text: '15% out (85% must be on)' })

  it('tightens the runway_edge overall component from 15% to 5% when CAT II/III', () => {
    const r = resolveEdgeThreshold({ system_type: 'runway_edge', is_cat_ii_iii: true } as never, edge15())
    expect(r.allowable_outage_pct).toBe(RUNWAY_EDGE_CAT_II_III_OUTAGE_PCT)
    expect(r.allowable_outage_pct).toBe(5)
    expect(r.allowable_outage_text).toContain('95%')
  })

  it('leaves the component unchanged when the system is not CAT II/III', () => {
    const r = resolveEdgeThreshold({ system_type: 'runway_edge', is_cat_ii_iii: false } as never, edge15())
    expect(r.allowable_outage_pct).toBe(15)
  })

  it('leaves non-runway_edge systems unchanged even when flagged CAT II/III', () => {
    const twy = comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 15 })
    const r = resolveEdgeThreshold({ system_type: 'taxiway_edge', is_cat_ii_iii: true } as never, twy)
    expect(r.allowable_outage_pct).toBe(15)
  })

  it('is idempotent — a component already at 5% is not re-touched', () => {
    const edge5 = comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 5 })
    const r = resolveEdgeThreshold({ system_type: 'runway_edge', is_cat_ii_iii: true } as never, edge5)
    expect(r.allowable_outage_pct).toBe(5)
  })
})

describe('calculateSystemHealth — CAT II/III edge lights end-to-end', () => {
  const edgeSystem = (catIIIII: boolean) => ({
    id: 's1', name: 'RWY 09 Edge', system_type: 'runway_edge',
    runway_or_taxiway: '09/27', is_precision: true, is_cat_ii_iii: catIIIII,
  } as unknown as LightingSystem)
  const overallEdge = () => comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 15 })

  it('flags a CAT II/III runway U/S at 8% out (over the 5% tolerance)', () => {
    const health = calculateSystemHealth(edgeSystem(true), [overallEdge()], line(25, [0, 1]), 'faa') // 8% out
    expect(health.components[0].allowablePct).toBe(5)
    expect(health.status).toBe('inoperative')
  })

  it('the SAME 8% out is within limits on a CAT I runway (15% tolerance)', () => {
    const health = calculateSystemHealth(edgeSystem(false), [overallEdge()], line(25, [0, 1]), 'faa') // 8% out
    expect(health.components[0].allowablePct).toBe(15)
    expect(health.status).toBe('degraded')
  })

  it('a CAT II/III runway stays within limits at 4% out (under the 5% tolerance)', () => {
    const health = calculateSystemHealth(edgeSystem(true), [overallEdge()], line(25, [0]), 'faa') // 4% out
    expect(health.components[0].allowablePct).toBe(5)
    expect(health.exceededComponents).toHaveLength(0)
  })
})

// ── ICAO Annex 14 §10.5.7 CAT II/III resolution ──
// ICAO baselines are the CAT I / general objective; §10.5.7 tightens edge &
// threshold to 95% (5% out) and LOOSENS runway end lights to 75% (25% out) for
// a CAT II/III runway. Only under the ICAO standard — the values differ from FAA.
describe('resolveComponentThreshold — ICAO §10.5.7 vs FAA/DAFMAN', () => {
  const sys = (type: string, cat: boolean) => ({ system_type: type, is_cat_ii_iii: cat }) as never
  const overall = (pct: number | null) => comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: pct })

  it('ICAO CAT II/III tightens runway edge 15% -> 5%', () => {
    expect(resolveComponentThreshold('icao', sys('runway_edge', true), overall(15)).allowable_outage_pct).toBe(5)
  })
  it('ICAO CAT II/III tightens threshold 15% -> 5% (95% serviceable)', () => {
    expect(resolveComponentThreshold('icao', sys('threshold', true), overall(15)).allowable_outage_pct).toBe(5)
  })
  it('ICAO CAT II/III LOOSENS runway end lights 15% -> 25% (75% serviceable)', () => {
    expect(resolveComponentThreshold('icao', sys('end_lights', true), overall(15)).allowable_outage_pct).toBe(25)
  })
  it('does NOT apply ICAO threshold/end adjustments under the FAA standard', () => {
    expect(resolveComponentThreshold('faa', sys('threshold', true), overall(15)).allowable_outage_pct).toBe(15)
    expect(resolveComponentThreshold('faa', sys('end_lights', true), overall(15)).allowable_outage_pct).toBe(15)
  })
  it('leaves CAT I (non-flagged) ICAO components unchanged', () => {
    expect(resolveComponentThreshold('icao', sys('threshold', false), overall(15)).allowable_outage_pct).toBe(15)
  })
  it('leaves DAFMAN components untouched entirely', () => {
    expect(resolveComponentThreshold('dafman', sys('runway_edge', true), overall(15)).allowable_outage_pct).toBe(15)
  })
})

describe('calculateSystemHealth — ICAO CAT II/III end-to-end', () => {
  const thlSys = (cat: boolean) => ({ id: 's1', name: 'RWY 27 THL', system_type: 'threshold', runway_or_taxiway: '27', is_precision: true, is_cat_ii_iii: cat }) as unknown as LightingSystem
  const endSys = (cat: boolean) => ({ id: 's2', name: 'RWY 27 END', system_type: 'end_lights', runway_or_taxiway: '27', is_precision: true, is_cat_ii_iii: cat }) as unknown as LightingSystem
  const overall = () => comp({ id: 'c1', component_type: 'overall', allowable_outage_pct: 15 })

  it('flags a CAT II/III threshold U/S at 8% out (over the 5% objective)', () => {
    const h = calculateSystemHealth(thlSys(true), [overall()], line(25, [0, 1]), 'icao') // 8%
    expect(h.components[0].allowablePct).toBe(5)
    expect(h.status).toBe('inoperative')
  })
  it('a CAT II/III runway end stays within limits at 20% out (75% objective)', () => {
    const h = calculateSystemHealth(endSys(true), [overall()], line(25, [0, 1, 2, 3, 4]), 'icao') // 20%
    expect(h.components[0].allowablePct).toBe(25)
    expect(h.exceededComponents).toHaveLength(0)
  })
  it('the ICAO tightening does not apply under the FAA standard', () => {
    const h = calculateSystemHealth(thlSys(true), [overall()], line(25, [0, 1]), 'faa') // 8%
    expect(h.components[0].allowablePct).toBe(15)
    expect(h.status).toBe('degraded')
  })
})
