import { describe, it, expect } from 'vitest'
import { PERM, resolveEffectivePermissions } from '@/lib/permissions'

// Unit tests for the pure resolver that `usePermissions` calls
// under the hood. Covers role-preset pass-through plus the two
// override behaviors the SQL helper codifies:
//   granted=TRUE  → additive grant (wins over a missing preset)
//   granted=FALSE → revoke (wins over a granted preset)

describe('resolveEffectivePermissions', () => {
  it('returns the role preset keys when there are no overrides', () => {
    const preset = [PERM.CHECKS_VIEW, PERM.CHECKS_WRITE, PERM.DISCREPANCIES_VIEW]
    const set = resolveEffectivePermissions(preset, [])
    expect(Array.from(set).sort()).toEqual([...preset].sort())
  })

  it('returns an empty set when preset + overrides are both empty', () => {
    expect(resolveEffectivePermissions([], [])).toEqual(new Set())
  })

  it('an override grant adds a key the preset does not have', () => {
    const set = resolveEffectivePermissions(
      [PERM.DISCREPANCIES_VIEW],
      [{ permission_key: PERM.DISCREPANCIES_WRITE, granted: true }],
    )
    expect(set.has(PERM.DISCREPANCIES_WRITE)).toBe(true)
    expect(set.has(PERM.DISCREPANCIES_VIEW)).toBe(true)
  })

  it('an override revoke removes a key the preset grants', () => {
    const set = resolveEffectivePermissions(
      [PERM.DISCREPANCIES_VIEW, PERM.DISCREPANCIES_WRITE, PERM.DISCREPANCIES_DELETE],
      [{ permission_key: PERM.DISCREPANCIES_DELETE, granted: false }],
    )
    expect(set.has(PERM.DISCREPANCIES_DELETE)).toBe(false)
    expect(set.has(PERM.DISCREPANCIES_WRITE)).toBe(true)
    expect(set.has(PERM.DISCREPANCIES_VIEW)).toBe(true)
  })

  it('revoke wins even when the override order is grant-then-revoke', () => {
    const set = resolveEffectivePermissions(
      [],
      [
        { permission_key: PERM.USERS_MANAGE, granted: true },
        { permission_key: PERM.USERS_MANAGE, granted: false },
      ],
    )
    expect(set.has(PERM.USERS_MANAGE)).toBe(false)
  })

  it('deduplicates repeated preset keys', () => {
    const set = resolveEffectivePermissions(
      [PERM.CHECKS_VIEW, PERM.CHECKS_VIEW, PERM.CHECKS_WRITE],
      [],
    )
    expect(set.size).toBe(2)
  })

  it('ignores override rows with no permission_key', () => {
    const set = resolveEffectivePermissions(
      [PERM.CHECKS_VIEW],
      // deliberately mimic a stray row from the wire
      [{ permission_key: '', granted: true } as { permission_key: string; granted: boolean }],
    )
    expect(Array.from(set)).toEqual([PERM.CHECKS_VIEW])
  })

  it('accepts arbitrary iterables (not just arrays) for preset keys', () => {
    const preset = new Set([PERM.CHECKS_VIEW, PERM.INSPECTIONS_VIEW])
    const set = resolveEffectivePermissions(preset, [])
    expect(Array.from(set).sort()).toEqual([PERM.CHECKS_VIEW, PERM.INSPECTIONS_VIEW].sort())
  })
})
