import { describe, it, expect } from 'vitest'
import {
  isModuleEnabled,
  isWizardStepEnabled,
  isStepDone,
  isModuleSetupComplete,
  TYPICAL_BASE_PRESET,
  type SetupProgress,
} from '@/lib/modules-config'

describe('isModuleEnabled', () => {
  it('always-on hrefs return true regardless of enabledModules', () => {
    expect(isModuleEnabled('/', [])).toBe(true)
    expect(isModuleEnabled('/dashboard', [])).toBe(true)
    expect(isModuleEnabled('/settings/base-setup/modules', [])).toBe(true)
    expect(isModuleEnabled('/training', null)).toBe(true)
  })

  it('sub-paths of always-on hrefs return true', () => {
    expect(isModuleEnabled('/reports/lighting', [])).toBe(true)
    expect(isModuleEnabled('/settings/users', [])).toBe(true)
  })

  it('returns true when the module for the href is enabled', () => {
    expect(isModuleEnabled('/scn', ['scn'])).toBe(true)
    expect(isModuleEnabled('/discrepancies', ['discrepancies', 'scn'])).toBe(true)
  })

  it('returns false when the module for the href is not enabled', () => {
    expect(isModuleEnabled('/scn', ['discrepancies'])).toBe(false)
    expect(isModuleEnabled('/wildlife', [])).toBe(false)
  })

  it('handles module sub-paths (e.g. /discrepancies/new)', () => {
    expect(isModuleEnabled('/discrepancies/new', ['discrepancies'])).toBe(true)
    expect(isModuleEnabled('/discrepancies/abc123', [])).toBe(false)
  })

  it('fails open for unknown hrefs so unrelated pages are not hidden', () => {
    expect(isModuleEnabled('/something-unmapped', [])).toBe(true)
    expect(isModuleEnabled('/future-feature', ['discrepancies'])).toBe(true)
  })

  it('treats null/undefined enabledModules as nothing enabled (but fails open for unknown hrefs)', () => {
    expect(isModuleEnabled('/scn', null)).toBe(false)
    expect(isModuleEnabled('/scn', undefined)).toBe(false)
  })
})

describe('isWizardStepEnabled', () => {
  it('core wizard steps are always enabled', () => {
    expect(isWizardStepEnabled('runways', [])).toBe(true)
    expect(isWizardStepEnabled('taxiways', [])).toBe(true)
    expect(isWizardStepEnabled('areas', null)).toBe(true)
    expect(isWizardStepEnabled('arff', null)).toBe(true)
    expect(isWizardStepEnabled('facilities', [])).toBe(true)
  })

  it('module-gated steps are enabled only when their module is on', () => {
    expect(isWizardStepEnabled('scnagencies', ['scn'])).toBe(true)
    expect(isWizardStepEnabled('scnagencies', [])).toBe(false)
    expect(isWizardStepEnabled('qrc', ['qrc'])).toBe(true)
    expect(isWizardStepEnabled('qrc', ['scn'])).toBe(false)
  })

  it('steps not mapped to any module fail open', () => {
    expect(isWizardStepEnabled('statusboards', [])).toBe(true)
  })
})

describe('isStepDone', () => {
  it('returns true when status is complete', () => {
    const progress: SetupProgress = { runways: { status: 'complete' } }
    expect(isStepDone('runways', progress)).toBe(true)
  })

  it('returns true when status is skipped', () => {
    const progress: SetupProgress = { qrc: { status: 'skipped' } }
    expect(isStepDone('qrc', progress)).toBe(true)
  })

  it('returns false when status is in_progress', () => {
    const progress: SetupProgress = { runways: { status: 'in_progress' } }
    expect(isStepDone('runways', progress)).toBe(false)
  })

  it('returns false when step has no entry', () => {
    expect(isStepDone('runways', {})).toBe(false)
    expect(isStepDone('runways', null)).toBe(false)
    expect(isStepDone('runways', undefined)).toBe(false)
  })
})

describe('isModuleSetupComplete', () => {
  it('returns true for modules with no setup steps', () => {
    expect(isModuleSetupComplete('checks', {})).toBe(true)
    expect(isModuleSetupComplete('parking', null)).toBe(true)
    expect(isModuleSetupComplete('waivers', undefined)).toBe(true)
  })

  it('returns true when all required setup steps are complete or skipped', () => {
    const progress: SetupProgress = {
      navaids: { status: 'complete' },
      lighting: { status: 'skipped' },
    }
    expect(isModuleSetupComplete('infrastructure', progress)).toBe(true)
  })

  it('returns false when any required step is missing', () => {
    // infrastructure requires navaids + lighting
    const progress: SetupProgress = { navaids: { status: 'complete' } }
    expect(isModuleSetupComplete('infrastructure', progress)).toBe(false)
  })

  it('returns false when a required step is still in_progress', () => {
    const progress: SetupProgress = {
      navaids: { status: 'complete' },
      lighting: { status: 'in_progress' },
    }
    expect(isModuleSetupComplete('infrastructure', progress)).toBe(false)
  })

  it('returns true for unknown modules (defensive fallback)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isModuleSetupComplete('totally-fake' as any, {})).toBe(true)
  })
})

describe('TYPICAL_BASE_PRESET', () => {
  it('omits modules whose defaultEnabled is false (e.g. feedback)', () => {
    expect(TYPICAL_BASE_PRESET).not.toContain('feedback')
  })

  it('includes the core day-to-day modules', () => {
    expect(TYPICAL_BASE_PRESET).toContain('checks')
    expect(TYPICAL_BASE_PRESET).toContain('discrepancies')
    expect(TYPICAL_BASE_PRESET).toContain('scn')
  })
})
