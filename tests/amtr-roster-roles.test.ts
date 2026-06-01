import { describe, it, expect } from 'vitest'
import { AMTR_ROSTER_ROLES, isAmtrRosterRole } from '@/lib/amtr/roster-roles'

describe('AMTR roster role scoping', () => {
  it('scopes the roster to exactly the four airfield-management roles', () => {
    expect([...AMTR_ROSTER_ROLES].sort()).toEqual(
      ['airfield_manager', 'amops', 'base_admin', 'namo'],
    )
  })

  it('auto-rosters airfield-management personnel', () => {
    for (const role of ['airfield_manager', 'namo', 'amops', 'base_admin']) {
      expect(isAmtrRosterRole(role)).toBe(true)
    }
  })

  // Roster guard — these roles must NEVER be auto-added to a training
  // roster. Read-only / safety / ATC / CES / PPR / kiosk base members are
  // not airfield-management trainees; sys_admin can view and manage the
  // program but is not a trainee. Widening this set silently pulls
  // non-AM personnel — and their individual training progress — onto the
  // roster, which is exactly the privacy boundary migration 2026052400
  // tightened. Do not loosen without a deliberate decision.
  it('never auto-rosters non-airfield-management or platform roles', () => {
    for (const role of [
      'read_only', 'safety', 'atc', 'ces', 'ppr', 'airfield_status',
      'majcom_rfm', 'sys_admin',
    ]) {
      expect(isAmtrRosterRole(role)).toBe(false)
    }
  })

  it('treats null / undefined / unknown roles as not rostered', () => {
    expect(isAmtrRosterRole(null)).toBe(false)
    expect(isAmtrRosterRole(undefined)).toBe(false)
    expect(isAmtrRosterRole('')).toBe(false)
    expect(isAmtrRosterRole('nonsense')).toBe(false)
  })
})
