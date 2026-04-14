import { describe, it, expect } from 'vitest'
import { getAlertTier, type SystemHealth } from '@/lib/outage-rules'

function makeHealth(overrides: Partial<SystemHealth>): SystemHealth {
  return {
    systemId: 's1',
    systemName: 'Test',
    systemType: 'runway_edge',
    runwayOrTaxiway: null,
    isPrecision: false,
    status: 'operational',
    components: [],
    totalFeatures: 0,
    inoperativeFeatures: 0,
    overallOutagePct: 0,
    worstComponent: null,
    exceededComponents: [],
    approachingComponents: [],
    ...overrides,
  }
}

describe('getAlertTier', () => {
  it('returns black when system inoperative', () => {
    expect(getAlertTier(makeHealth({ status: 'inoperative' }))).toBe('black')
  })

  it('returns red when any component exceeded', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getAlertTier(makeHealth({ exceededComponents: [{} as any] }))).toBe('red')
  })

  it('returns yellow when any component approaching', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getAlertTier(makeHealth({ approachingComponents: [{} as any] }))).toBe('yellow')
  })

  it('returns green when all operational', () => {
    expect(getAlertTier(makeHealth({}))).toBe('green')
  })
})
