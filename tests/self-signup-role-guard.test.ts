import { describe, it, expect } from 'vitest'
import { sanitizeSelfSignupRole, SELF_SIGNUP_EXCLUDED_ROLES } from '@/lib/admin/role-checks'

// Guards the self-signup privilege-escalation fix: the public, unauthenticated
// signup endpoint must never let a caller assign themselves a privileged role.
// If someone adds a new admin-tier role, add it to SELF_SIGNUP_EXCLUDED_ROLES
// (and this test will remind them by failing the escalation cases below).
describe('sanitizeSelfSignupRole', () => {
  it('coerces privileged roles to read_only', () => {
    for (const role of SELF_SIGNUP_EXCLUDED_ROLES) {
      const r = sanitizeSelfSignupRole(role)
      expect(r.role).toBe('read_only')
      expect(r.coerced).toBe(true)
    }
  })

  it('coerces sys_admin and base_admin specifically (escalation guard)', () => {
    expect(sanitizeSelfSignupRole('sys_admin').role).toBe('read_only')
    expect(sanitizeSelfSignupRole('base_admin').role).toBe('read_only')
  })

  it('coerces unknown / malformed roles to read_only', () => {
    expect(sanitizeSelfSignupRole('superuser').role).toBe('read_only')
    expect(sanitizeSelfSignupRole('').role).toBe('read_only')
    expect(sanitizeSelfSignupRole(undefined).role).toBe('read_only')
    expect(sanitizeSelfSignupRole(null).role).toBe('read_only')
    expect(sanitizeSelfSignupRole({ role: 'sys_admin' }).role).toBe('read_only')
  })

  it('passes through legitimate self-service roles unchanged', () => {
    for (const role of ['read_only', 'amops', 'airfield_manager', 'ces', 'safety', 'ppr'] as const) {
      const r = sanitizeSelfSignupRole(role)
      expect(r.role).toBe(role)
      expect(r.coerced).toBe(false)
    }
  })
})
