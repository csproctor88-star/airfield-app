import { describe, it, expect } from 'vitest'
import {
  resolveArea,
  areaSortKey,
  listAreas,
  systemsForArea,
} from '@/lib/infrastructure/areas'

describe('resolveArea', () => {
  it('merges a partial RWY ref into the full runway', () => {
    expect(resolveArea('RWY 01', new Set(['RWY 01/19']))).toBe('RWY 01/19')
  })
  it('merges a bare end ref into the full runway', () => {
    expect(resolveArea('19', new Set(['RWY 01/19']))).toBe('RWY 01/19')
  })
  it('returns General for null', () => {
    expect(resolveArea(null, new Set())).toBe('General')
  })
  it('passes through a taxiway with no matching full runway', () => {
    expect(resolveArea('TWY A', new Set())).toBe('TWY A')
  })
})

describe('areaSortKey', () => {
  it('ranks full runway, single-end, taxiway, named, general', () => {
    expect(areaSortKey('RWY 01/19')).toBe(100)
    expect(areaSortKey('RWY 01')).toBe(200)
    expect(areaSortKey('TWY A')).toBe(300)
    expect(areaSortKey('East Ramp')).toBe(500)
    expect(areaSortKey('General')).toBe(900)
  })
})

const fixture = [
  { runway_or_taxiway: 'RWY 01/19' },
  { runway_or_taxiway: 'RWY 01' },
  { runway_or_taxiway: '19' },
  { runway_or_taxiway: 'TWY A' },
  { runway_or_taxiway: 'East Ramp' },
  { runway_or_taxiway: null },
]

describe('listAreas', () => {
  it('dedups the three runway refs and sorts by precedence', () => {
    expect(listAreas(fixture)).toEqual([
      'RWY 01/19',
      'TWY A',
      'East Ramp',
      'General',
    ])
  })
})

describe('systemsForArea', () => {
  it('returns the three runway-ref systems incl. partials', () => {
    expect(systemsForArea(fixture, 'RWY 01/19')).toEqual([
      { runway_or_taxiway: 'RWY 01/19' },
      { runway_or_taxiway: 'RWY 01' },
      { runway_or_taxiway: '19' },
    ])
  })
})
