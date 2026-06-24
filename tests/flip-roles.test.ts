import { describe, it, expect } from 'vitest'
import {
  rolesForSlot, nextSlot, canSignSlot,
  type SignoffState, type FlipRole,
} from '@/lib/flip/roles'

const empty: SignoffState = { custodian_signed_at: null, namo_signed_at: null, afm_signed_at: null }
const custDone: SignoffState = { custodian_signed_at: '2026-06-23T00:00:00Z', namo_signed_at: null, afm_signed_at: null }
const namoDone: SignoffState = { custodian_signed_at: '2026-06-23T00:00:00Z', namo_signed_at: '2026-06-23T01:00:00Z', afm_signed_at: null }
const allDone: SignoffState = { custodian_signed_at: 'x', namo_signed_at: 'x', afm_signed_at: 'x' }

describe('rolesForSlot', () => {
  it('custodian slot accepts custodian or alternate', () => {
    expect(rolesForSlot('custodian')).toEqual(['custodian', 'alternate'])
  })
  it('namo slot accepts only namo', () => {
    expect(rolesForSlot('namo')).toEqual(['namo'])
  })
  it('afm slot accepts only afm', () => {
    expect(rolesForSlot('afm')).toEqual(['afm'])
  })
})

describe('nextSlot — sequential order', () => {
  it('empty → custodian first', () => expect(nextSlot(empty)).toBe('custodian'))
  it('custodian signed → namo next', () => expect(nextSlot(custDone)).toBe('namo'))
  it('namo signed → afm next', () => expect(nextSlot(namoDone)).toBe('afm'))
  it('all signed → null', () => expect(nextSlot(allDone)).toBeNull())
})

describe('canSignSlot — gates by turn AND role', () => {
  const cust: FlipRole[] = ['custodian']
  const alt: FlipRole[] = ['alternate']
  const namo: FlipRole[] = ['namo']
  const afm: FlipRole[] = ['afm']

  it('custodian can sign custodian slot when it is its turn', () => {
    expect(canSignSlot(cust, 'custodian', empty)).toBe(true)
  })
  it('alternate can also sign the custodian slot', () => {
    expect(canSignSlot(alt, 'custodian', empty)).toBe(true)
  })
  it('NAMO cannot sign before custodian (out of sequence)', () => {
    expect(canSignSlot(namo, 'namo', empty)).toBe(false)
  })
  it('NAMO can sign once custodian is done', () => {
    expect(canSignSlot(namo, 'namo', custDone)).toBe(true)
  })
  it('AFM cannot sign before NAMO', () => {
    expect(canSignSlot(afm, 'afm', custDone)).toBe(false)
  })
  it('AFM signs last, after NAMO', () => {
    expect(canSignSlot(afm, 'afm', namoDone)).toBe(true)
  })
  it('wrong role cannot sign even on its turn', () => {
    expect(canSignSlot(cust, 'namo', custDone)).toBe(false)
  })
  it('a user with multiple roles is allowed if any matches', () => {
    expect(canSignSlot(['custodian', 'afm'] as FlipRole[], 'afm', namoDone)).toBe(true)
  })
})
