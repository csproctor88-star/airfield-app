import { describe, it, expect } from 'vitest'
import {
  effectiveRoleForRecord, canViewRecord, canSignSlot, rolesForSlot,
  canEnterData, canReopen, isRecordLocked, AMTR_ROLE_LABELS,
} from '@/lib/amtr/roles'
import type { AmtrRole } from '@/lib/supabase/amtr'

describe('AMTR role layer', () => {
  describe('effectiveRoleForRecord', () => {
    it('is trainee on your own record regardless of other roles', () => {
      expect(effectiveRoleForRecord(['afm', 'trainer'] as AmtrRole[], true)).toBe('trainee')
    })
    it('is the highest non-trainee role on others records', () => {
      expect(effectiveRoleForRecord(['trainer', 'certifier'] as AmtrRole[], false)).toBe('certifier')
      expect(effectiveRoleForRecord(['trainer', 'afm'] as AmtrRole[], false)).toBe('afm')
    })
    it('is null when only a trainee views another record', () => {
      expect(effectiveRoleForRecord(['trainee'] as AmtrRole[], false)).toBeNull()
    })
  })

  describe('canViewRecord', () => {
    it('always allows viewing your own record', () => {
      expect(canViewRecord(['trainee'] as AmtrRole[], true)).toBe(true)
    })
    it('trainee-only cannot view others records', () => {
      expect(canViewRecord(['trainee'] as AmtrRole[], false)).toBe(false)
    })
    it('trainer-or-higher can view others records', () => {
      expect(canViewRecord(['trainer'] as AmtrRole[], false)).toBe(true)
    })
  })

  describe('rolesForSlot', () => {
    it('maps a slot to its accepted roles', () => {
      expect(rolesForSlot('certifier')).toEqual(['certifier'])
      expect(rolesForSlot('evaluator')).toEqual(['trainer', 'certifier', 'namt', 'afm'])
    })
  })

  describe('canSignSlot — one signature per record', () => {
    it('allows signing a slot the caller has the role for', () => {
      expect(canSignSlot(['certifier'] as AmtrRole[], 'certifier', [])).toBe(true)
    })
    it('blocks a slot the caller lacks the role for', () => {
      expect(canSignSlot(['trainer'] as AmtrRole[], 'certifier', [])).toBe(false)
    })
    it('blocks a second slot under a different role on the same record', () => {
      // caller is both trainer and certifier, already signed as trainer
      expect(canSignSlot(['trainer', 'certifier'] as AmtrRole[], 'certifier', ['trainer'])).toBe(false)
    })
    it('allows re-signing the same slot already owned', () => {
      expect(canSignSlot(['certifier'] as AmtrRole[], 'certifier', ['certifier'])).toBe(true)
    })
    it('evaluator slot accepts any non-trainee role', () => {
      expect(canSignSlot(['namt'] as AmtrRole[], 'evaluator', [])).toBe(true)
      expect(canSignSlot(['trainee'] as AmtrRole[], 'evaluator', [])).toBe(false)
    })
  })

  describe('supervisor-driven data entry + locking', () => {
    it('canEnterData: only non-trainee effective roles enter data', () => {
      expect(canEnterData('trainer')).toBe(true)
      expect(canEnterData('afm')).toBe(true)
      expect(canEnterData('trainee')).toBe(false)
      expect(canEnterData(null)).toBe(false)
    })
    it('canReopen: only NAMT or AFM', () => {
      expect(canReopen(['namt'] as AmtrRole[])).toBe(true)
      expect(canReopen(['afm'] as AmtrRole[])).toBe(true)
      expect(canReopen(['trainer', 'certifier'] as AmtrRole[])).toBe(false)
      expect(canReopen([])).toBe(false)
    })
    it('isRecordLocked reflects locked_at', () => {
      expect(isRecordLocked({ locked_at: '2026-05-20T00:00:00Z' })).toBe(true)
      expect(isRecordLocked({ locked_at: null })).toBe(false)
      expect(isRecordLocked({})).toBe(false)
    })
    it('role labels are correctly capitalized', () => {
      expect(AMTR_ROLE_LABELS.trainee).toBe('Trainee')
      expect(AMTR_ROLE_LABELS.namt).toBe('NAMT')
      expect(AMTR_ROLE_LABELS.afm).toBe('AFM')
    })
  })
})
