import { describe, it, expect } from 'vitest'
import { MODULES, moduleRefAppliesToAirport } from '@/lib/training/modules'

// Locks the airport-type gating so a future edit can't silently un-gate a
// civilian guide onto USAF bases (or vice versa), and so the new guides keep
// their intended visibility.
describe('training guide airport-type gating', () => {
  const byId = (id: string) => {
    const m = MODULES.find(x => x.id === id)
    if (!m) throw new Error(`guide not found: ${id}`)
    return m
  }

  it('marks the USAF-only guides usaf-only', () => {
    for (const id of ['acsi', 'scn', 'amtr']) {
      expect(byId(id).appliesTo).toEqual(['usaf'])
    }
  })

  it('marks the civilian Part 139 guides faa_part139-only', () => {
    for (const id of ['sms', 'training-part139', 'aep', 'field-conditions', 'whmp']) {
      expect(byId(id).appliesTo).toEqual(['faa_part139'])
    }
  })

  it('leaves dual-mode guides ungated', () => {
    expect(byId('records-export').appliesTo).toBeUndefined()
    expect(byId('discrepancies').appliesTo).toBeUndefined()
  })

  it('helper hides USAF-only guides on civilian bases and vice versa', () => {
    const amtr = byId('amtr')
    const sms = byId('sms')
    const exp = byId('records-export')

    expect(moduleRefAppliesToAirport(amtr, 'usaf')).toBe(true)
    expect(moduleRefAppliesToAirport(amtr, 'faa_part139')).toBe(false)

    expect(moduleRefAppliesToAirport(sms, 'faa_part139')).toBe(true)
    expect(moduleRefAppliesToAirport(sms, 'usaf')).toBe(false)

    // Dual-mode guide shows on both; unknown airport type fails open.
    expect(moduleRefAppliesToAirport(exp, 'usaf')).toBe(true)
    expect(moduleRefAppliesToAirport(exp, 'faa_part139')).toBe(true)
    expect(moduleRefAppliesToAirport(amtr, null)).toBe(true)
  })

  it('every new guide id is present exactly once', () => {
    for (const id of ['amtr', 'records-export', 'sms', 'training-part139', 'aep', 'field-conditions', 'whmp']) {
      expect(MODULES.filter(m => m.id === id)).toHaveLength(1)
    }
  })
})
