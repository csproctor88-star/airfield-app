import { describe, it, expect } from 'vitest'
import { buildDrivingCheckFields, type UpdateDrivingCheckInput } from '@/lib/supabase/driving-checks'

// buildDrivingCheckFields is the FULL update-payload source for
// updateDrivingCheck (which adds only `updated_at`). The invariant these
// tests lock: an EDIT never carries checker attribution — completed_by /
// completed_by_oi / completed_by_name are set once, at create time, by
// createDrivingCheck layering them on top of this builder. Before the fix
// the shared payload builder wrote all three on every save, so a typo fix
// by another user silently moved the check between checkers' rows in the
// by-checker AOB report (computeAobStats groups on those columns).

const BASE_INPUT: UpdateDrivingCheckInput = {
  driverName: '  Snuffy  ',
  driverRank: 'SSgt',
  driverUnit: '100 ARW/SE',
  form483Status: 'valid',
  location: '  Taxiway A  ',
  overallResult: 'pass',
  items: [],
}

describe('buildDrivingCheckFields (attribution invariant)', () => {
  it('never emits attribution or base-scope keys — the update payload cannot reassign the checker', () => {
    // Even a caller that smuggles attribution-shaped extras past the type
    // system (UpdateDrivingCheckInput omits them) must not see them emitted.
    const smuggled = {
      ...BASE_INPUT,
      operatingInitials: 'ZZ',
      completedByName: 'Impostor',
    } as UpdateDrivingCheckInput
    const fields = buildDrivingCheckFields(smuggled)
    const keys = Object.keys(fields)
    expect(keys).not.toContain('completed_by')
    expect(keys).not.toContain('completed_by_oi')
    expect(keys).not.toContain('completed_by_name')
    expect(keys).not.toContain('base_id')
  })

  it('emits exactly the non-attribution check columns (checked_at only when provided)', () => {
    const fields = buildDrivingCheckFields(BASE_INPUT)
    expect(Object.keys(fields).sort()).toEqual([
      'contractor_id',
      'driver_name',
      'driver_office_symbol',
      'driver_phone',
      'driver_rank',
      'driver_unit',
      'form_483_expires',
      'form_483_status',
      'location',
      'notes',
      'overall_result',
      'pov_pass_number',
      'vehicle_id',
      'vehicle_type',
      'violation_description',
    ])
  })

  it('omits checked_at when not provided so an edit preserves the original check time', () => {
    expect(buildDrivingCheckFields(BASE_INPUT)).not.toHaveProperty('checked_at')
  })

  it('includes checked_at when explicitly provided', () => {
    const fields = buildDrivingCheckFields({ ...BASE_INPUT, checkedAt: '2026-07-17T10:00:00Z' })
    expect(fields.checked_at).toBe('2026-07-17T10:00:00Z')
  })

  it('trims strings and nulls empty optionals', () => {
    const fields = buildDrivingCheckFields({ ...BASE_INPUT, driverPhone: '   ' })
    expect(fields.driver_name).toBe('Snuffy')
    expect(fields.location).toBe('Taxiway A')
    expect(fields.driver_phone).toBeNull()
    expect(fields.driver_office_symbol).toBeNull()
  })
})
