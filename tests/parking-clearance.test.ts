import { describe, it, expect } from 'vitest'
import {
  getADGFromWingspan,
  getWingtipClearanceDetail,
  getClearanceDetail,
  getIcaoCodeLetter,
  parkingStandardForBase,
  apronContextsForStandard,
  isKcRefuelAircraft,
} from '@/lib/calculations/parking-clearance'

describe('parking clearance (UFC 3-260-01)', () => {
  it('classifies ADG by wingspan', () => {
    expect(getADGFromWingspan(40)).toBe('I')
    expect(getADGFromWingspan(95)).toBe('III')
    expect(getADGFromWingspan(200)).toBe('V')
    expect(getADGFromWingspan(300)).toBe('VI')
  })

  it('identifies KC refueling aircraft', () => {
    expect(isKcRefuelAircraft('KC-135R')).toBe(true)
    expect(isKcRefuelAircraft('C-17A')).toBe(false)
    expect(isKcRefuelAircraft(null)).toBe(false)
  })

  it('returns KC-10/46/135 override clearance regardless of context', () => {
    const d = getWingtipClearanceDetail(131, 'parking', 'KC-46A')
    expect(d.clearance_ft).toBe(25)
    expect(d.ufc_item).toBe('Item 4(P)')
  })
})

describe('parking clearance — standard-aware', () => {
  const M_PER_FT = 0.3048

  it('ICAO code letter by wingspan (Annex 14 Table 1-1)', () => {
    expect(getIcaoCodeLetter(40)).toBe('A')
    expect(getIcaoCodeLetter(100)).toBe('C')
    expect(getIcaoCodeLetter(150)).toBe('D')
    expect(getIcaoCodeLetter(250)).toBe('F')
  })

  it('ICAO §3.13.6 stand clearance by code letter (3/4.5/7.5 m, stored as feet)', () => {
    expect(getClearanceDetail(40, 'parking', null, 'icao').clearance_ft).toBeCloseTo(3 / M_PER_FT, 2)
    expect(getClearanceDetail(100, 'parking', null, 'icao').clearance_ft).toBeCloseTo(4.5 / M_PER_FT, 2)
    expect(getClearanceDetail(250, 'parking', null, 'icao').clearance_ft).toBeCloseTo(7.5 / M_PER_FT, 2)
    expect(getClearanceDetail(100, 'parking', null, 'icao').ufc_item).toBe('Annex 14 §3.13.6 (Code C)')
  })

  it('FAA AC 150/5300-13B wingtip clearance by ADG (taxilane vs taxiway)', () => {
    expect(getClearanceDetail(40, 'parking', null, 'faa').clearance_ft).toBe(15)            // ADG I taxilane
    expect(getClearanceDetail(100, 'interior_taxilane', null, 'faa').clearance_ft).toBe(20) // ADG III taxilane
    expect(getClearanceDetail(40, 'peripheral_taxilane', null, 'faa').clearance_ft).toBe(20) // ADG I taxiway
    expect(getClearanceDetail(40, 'parking', null, 'faa').ufc_item).toBe('AC 150/5300-13B Table 4-1 (ADG I)')
  })

  it('USAFE 32-1007 keeps UFC values, relabels the citation', () => {
    const ufc = getClearanceDetail(40, 'parking', null, 'ufc')
    const usafe = getClearanceDetail(40, 'parking', null, 'usafe_32_1007')
    expect(usafe.clearance_ft).toBe(ufc.clearance_ft)
    expect(usafe.ufc_item).toBe('USAFE 32-1007 / NATO (Item 4(P))')
  })

  it('resolves the parking standard from the base', () => {
    expect(parkingStandardForBase({ obstruction_surface_set: 'faa_part77' })).toBe('faa')
    expect(parkingStandardForBase({ obstruction_surface_set: 'icao_annex14' })).toBe('icao')
    expect(parkingStandardForBase({ obstruction_surface_set: 'usafe_32_1007' })).toBe('usafe_32_1007')
    expect(parkingStandardForBase({ obstruction_surface_set: 'ufc_3_260_01' })).toBe('ufc')
    expect(parkingStandardForBase(null)).toBe('ufc')
  })

  it('hides the apron-context selector for ICAO; trims it for FAA', () => {
    expect(apronContextsForStandard('icao')).toHaveLength(0)
    expect(apronContextsForStandard('faa')).toHaveLength(4)
    expect(apronContextsForStandard('ufc')).toHaveLength(6)
  })
})
