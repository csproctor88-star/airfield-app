import { describe, it, expect } from 'vitest'
import {
  effectiveRoleForRecord, canViewRecord, canSignSlot, slotsUserCanSign, rolesForSlot,
  canEnterData, canEnterDataOnRecord, canReopen, isRecordLocked, AMTR_ROLE_LABELS,
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

  describe('slotsUserCanSign — hierarchical authority', () => {
    it('trainee may sign only the trainee block', () => {
      expect(slotsUserCanSign(['trainee'] as AmtrRole[], false)).toEqual(new Set(['trainee']))
    })
    it('trainer may sign only the trainer block (not trainee)', () => {
      expect(slotsUserCanSign(['trainer'] as AmtrRole[], false)).toEqual(new Set(['trainer', 'evaluator']))
    })
    it('certifier may sign trainee, trainer, certifier', () => {
      expect(slotsUserCanSign(['certifier'] as AmtrRole[], false))
        .toEqual(new Set(['trainee', 'trainer', 'certifier', 'evaluator']))
    })
    it('namt may sign everything except afm', () => {
      expect(slotsUserCanSign(['namt'] as AmtrRole[], false))
        .toEqual(new Set(['trainee', 'trainer', 'certifier', 'namt', 'evaluator']))
    })
    it('afm may sign every block', () => {
      expect(slotsUserCanSign(['afm'] as AmtrRole[], false))
        .toEqual(new Set(['trainee', 'trainer', 'certifier', 'namt', 'afm', 'evaluator']))
    })
    it('own record is always trainee-only, regardless of held roles', () => {
      expect(slotsUserCanSign(['afm', 'namt'] as AmtrRole[], true)).toEqual(new Set(['trainee']))
    })
  })

  describe('canSignSlot', () => {
    it('certifier can sign trainee, trainer, and certifier on another record', () => {
      expect(canSignSlot(['certifier'] as AmtrRole[], 'trainee', false)).toBe(true)
      expect(canSignSlot(['certifier'] as AmtrRole[], 'trainer', false)).toBe(true)
      expect(canSignSlot(['certifier'] as AmtrRole[], 'certifier', false)).toBe(true)
    })
    it('trainer cannot sign the trainee block', () => {
      expect(canSignSlot(['trainer'] as AmtrRole[], 'trainee', false)).toBe(false)
      expect(canSignSlot(['trainer'] as AmtrRole[], 'trainer', false)).toBe(true)
    })
    it('namt cannot sign the afm block; afm can', () => {
      expect(canSignSlot(['namt'] as AmtrRole[], 'afm', false)).toBe(false)
      expect(canSignSlot(['afm'] as AmtrRole[], 'afm', false)).toBe(true)
    })
    it('own record: even an AFM may sign only the trainee block', () => {
      expect(canSignSlot(['afm'] as AmtrRole[], 'trainee', true)).toBe(true)
      expect(canSignSlot(['afm'] as AmtrRole[], 'certifier', true)).toBe(false)
    })
    it('evaluator slot accepts any non-trainee role', () => {
      expect(canSignSlot(['namt'] as AmtrRole[], 'evaluator', false)).toBe(true)
      expect(canSignSlot(['trainee'] as AmtrRole[], 'evaluator', false)).toBe(false)
    })
  })

  describe('supervisor-driven data entry + locking', () => {
    it('canEnterData: only non-trainee effective roles enter data', () => {
      expect(canEnterData('trainer')).toBe(true)
      expect(canEnterData('afm')).toBe(true)
      expect(canEnterData('trainee')).toBe(false)
      expect(canEnterData(null)).toBe(false)
    })
    it('canEnterDataOnRecord: NAMT may transcribe data on their own record', () => {
      expect(canEnterDataOnRecord(['namt'] as AmtrRole[], true)).toBe(true)
    })
    it('canEnterDataOnRecord: AFM may transcribe data on their own record', () => {
      expect(canEnterDataOnRecord(['afm'] as AmtrRole[], true)).toBe(true)
    })
    it('canEnterDataOnRecord: trainee/trainer/certifier still locked out of own record', () => {
      expect(canEnterDataOnRecord(['trainee'] as AmtrRole[], true)).toBe(false)
      expect(canEnterDataOnRecord(['trainer'] as AmtrRole[], true)).toBe(false)
      expect(canEnterDataOnRecord(['certifier'] as AmtrRole[], true)).toBe(false)
    })
    it('canEnterDataOnRecord: on someone else\'s record, supervisor-driven default applies', () => {
      expect(canEnterDataOnRecord(['certifier'] as AmtrRole[], false)).toBe(true)
      expect(canEnterDataOnRecord(['trainee'] as AmtrRole[], false)).toBe(false)
      expect(canEnterDataOnRecord([] as AmtrRole[], false)).toBe(false)
    })
    it('NAMT carve-out does NOT lift the signing self-cert guard', () => {
      // Hard constraint: even with the data-entry carve-out, NAMT/AFM on
      // their own record can still only sign the Trainee block. This is
      // the audit-critical line that must not regress.
      expect(slotsUserCanSign(['namt'] as AmtrRole[], true)).toEqual(new Set(['trainee']))
      expect(slotsUserCanSign(['afm'] as AmtrRole[], true)).toEqual(new Set(['trainee']))
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
