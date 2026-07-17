import { describe, it, expect } from 'vitest'
import {
  getAirportType,
  isCivilian,
  isUsaf,
  getRoleLabel,
  isRoleVisible,
  getTerm,
  getRegSource,
  getSurfaceSet,
  type AirportType,
} from '@/lib/airport-mode'

const usafBase = { airport_type: 'usaf' as AirportType }
const faaBase  = { airport_type: 'faa_part139' as AirportType }

describe('getAirportType', () => {
  it('defaults null/undefined to usaf', () => {
    expect(getAirportType(null)).toBe('usaf')
    expect(getAirportType(undefined)).toBe('usaf')
  })
  it('accepts a base-like object', () => {
    expect(getAirportType(usafBase)).toBe('usaf')
    expect(getAirportType(faaBase)).toBe('faa_part139')
  })
  it('accepts a raw airport_type string', () => {
    expect(getAirportType('usaf')).toBe('usaf')
    expect(getAirportType('faa_part139')).toBe('faa_part139')
  })
  it('returns usaf for a base whose airport_type is missing or invalid', () => {
    expect(getAirportType({})).toBe('usaf')
    expect(getAirportType({ airport_type: null })).toBe('usaf')
  })
})

describe('isCivilian / isUsaf', () => {
  it('split the universe correctly', () => {
    expect(isCivilian(usafBase)).toBe(false)
    expect(isUsaf(usafBase)).toBe(true)
    expect(isCivilian(faaBase)).toBe(true)
    expect(isUsaf(faaBase)).toBe(false)
  })
  it('treats null/undefined as USAF', () => {
    expect(isUsaf(null)).toBe(true)
    expect(isCivilian(undefined)).toBe(false)
  })
})

describe('getRoleLabel', () => {
  it('translates the manager role per mode', () => {
    expect(getRoleLabel('airfield_manager', usafBase)).toBe('Airfield Manager')
    expect(getRoleLabel('airfield_manager', faaBase)).toBe('Airport Operations Manager')
  })
  it('translates AMOPS / CES / NAMO per mode', () => {
    expect(getRoleLabel('amops', faaBase)).toBe('Ops Specialist')
    expect(getRoleLabel('ces', faaBase)).toBe('Airport Maintenance')
    expect(getRoleLabel('namo', faaBase)).toBe('Operations Supervisor')
  })
  it('hides majcom_rfm in civilian mode', () => {
    expect(getRoleLabel('majcom_rfm', usafBase)).toBe('MAJCOM / RFM')
    expect(getRoleLabel('majcom_rfm', faaBase)).toBe('')
    expect(isRoleVisible('majcom_rfm', faaBase)).toBe(false)
  })
  it('hides civilian-only roles in USAF mode', () => {
    expect(getRoleLabel('accountable_executive', usafBase)).toBe('')
    expect(getRoleLabel('sms_manager', usafBase)).toBe('')
    expect(getRoleLabel('accountable_executive', faaBase)).toBe('Accountable Executive')
    expect(isRoleVisible('sms_manager', faaBase)).toBe(true)
  })
  it('returns humanized fallback for unknown roles', () => {
    expect(getRoleLabel('weather_officer', usafBase)).toBe('Weather Officer')
  })
  it('returns empty for null/undefined role', () => {
    expect(getRoleLabel(null, usafBase)).toBe('')
    expect(getRoleLabel(undefined, faaBase)).toBe('')
  })
})

describe('getTerm', () => {
  it('translates form names', () => {
    expect(getTerm('form_505', usafBase)).toBe('AF Form 505 (Waiver)')
    expect(getTerm('form_505', faaBase)).toBe('Modification to Standards')
    expect(getTerm('form_483', faaBase)).toBe('SIDA Badge')
  })
  it('translates org units', () => {
    expect(getTerm('maintenance_full', usafBase)).toBe('Civil Engineer Squadron')
    expect(getTerm('maintenance_full', faaBase)).toBe('Airport Maintenance')
  })
  it('translates shift slot labels', () => {
    expect(getTerm('shift_day', usafBase)).toBe('Day Shift AMSL')
    expect(getTerm('shift_day', faaBase)).toBe('Day Shift Lead')
  })
  it('translates regulatory anchors', () => {
    expect(getTerm('primary_reg', usafBase)).toBe('DAFMAN 13-204')
    expect(getTerm('primary_reg', faaBase)).toBe('14 CFR Part 139')
    expect(getTerm('obstruction_reg', faaBase)).toBe('14 CFR Part 77')
  })
})

describe('getRegSource', () => {
  it('USAF sees USAF + UFC + ICAO + dual', () => {
    expect(getRegSource(usafBase).sort()).toEqual(['both', 'icao', 'ufc', 'usaf'])
  })
  it('Civilian sees FAA + ICAO + dual (no UFC, no USAF)', () => {
    expect(getRegSource(faaBase).sort()).toEqual(['both', 'faa', 'icao'])
  })
})

describe('getSurfaceSet', () => {
  it('falls back to UFC for USAF default and Part 77 for civilian default', () => {
    expect(getSurfaceSet(usafBase)).toBe('ufc_3_260_01')
    expect(getSurfaceSet(faaBase)).toBe('faa_part77')
  })
  it('honors explicit obstruction_surface_set on the base', () => {
    expect(getSurfaceSet({ airport_type: 'usaf', obstruction_surface_set: 'faa_part77' })).toBe('faa_part77')
    expect(getSurfaceSet({ airport_type: 'faa_part139', obstruction_surface_set: 'ufc_3_260_01' })).toBe('ufc_3_260_01')
  })
  it('resolves a configured ICAO Annex 14 base (no longer narrowed away)', () => {
    expect(getSurfaceSet({ airport_type: 'usaf', obstruction_surface_set: 'icao_annex14' })).toBe('icao_annex14')
    expect(getSurfaceSet({ airport_type: 'faa_part139', obstruction_surface_set: 'icao_annex14' })).toBe('icao_annex14')
  })
  it('never defaults to ICAO — an unset base takes the mode default', () => {
    expect(getSurfaceSet({ airport_type: 'usaf' })).toBe('ufc_3_260_01')
    expect(getSurfaceSet({ airport_type: 'faa_part139' })).toBe('faa_part77')
  })
  it('defaults null to UFC', () => {
    expect(getSurfaceSet(null)).toBe('ufc_3_260_01')
  })
})
