import { describe, it, expect } from 'vitest'
import {
  isModuleEnabled,
  isWizardStepEnabled,
  isStepDone,
  isModuleSetupComplete,
  getModulesByCategory,
  modulesForAirport,
  moduleAppliesToAirport,
  TYPICAL_BASE_PRESET,
  type SetupProgress,
} from '@/lib/modules-config'

describe('isModuleEnabled', () => {
  it('always-on hrefs return true regardless of enabledModules', () => {
    expect(isModuleEnabled('/', [])).toBe(true)
    expect(isModuleEnabled('/dashboard', [])).toBe(true)
    expect(isModuleEnabled('/settings/base-setup/modules', [])).toBe(true)
    expect(isModuleEnabled('/help', null)).toBe(true)
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

  it('honors airport_type to hide USAF-only modules on civilian bases', () => {
    // SCN and AMTR are USAF-only — hidden on civilian airports even when the
    // module key is in enabledModules. (ACSI is now dual-mode: it renders as
    // the Part 139 Annual Inspection on civilian bases — see the next test.)
    expect(isModuleEnabled('/scn',  ['scn'],  'usaf')).toBe(true)
    expect(isModuleEnabled('/scn',  ['scn'],  'faa_part139')).toBe(false)
    expect(isModuleEnabled('/amtr', ['amtr'], 'usaf')).toBe(true)
    expect(isModuleEnabled('/amtr', ['amtr'], 'faa_part139')).toBe(false)
  })

  it('dual-applicable modules surface in both modes', () => {
    expect(isModuleEnabled('/checks',        ['checks'],        'usaf')).toBe(true)
    expect(isModuleEnabled('/checks',        ['checks'],        'faa_part139')).toBe(true)
    expect(isModuleEnabled('/discrepancies', ['discrepancies'], 'faa_part139')).toBe(true)
    expect(isModuleEnabled('/wildlife',      ['wildlife'],      'faa_part139')).toBe(true)
    // ACSI opened to civilian mode (renders as the Part 139 Annual Inspection).
    expect(isModuleEnabled('/acsi',          ['acsi'],          'usaf')).toBe(true)
    expect(isModuleEnabled('/acsi',          ['acsi'],          'faa_part139')).toBe(true)
  })

  it('omitting airport_type preserves prior behavior (back-compat)', () => {
    // Existing call sites that haven't been updated continue to work
    // the same way they did before the dual-mode change.
    expect(isModuleEnabled('/scn',  ['scn'])).toBe(true)
    expect(isModuleEnabled('/amtr', ['amtr'])).toBe(true)
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

  it('gates AEP/SCN setup steps by airport_type', () => {
    // aepagencies → aep (civilian only); scnagencies → scn (USAF only).
    // The base-config rail desynced because it called this WITHOUT airport_type,
    // which fails open and leaked the AEP step onto USAF.
    expect(isWizardStepEnabled('aepagencies', ['aep'], 'usaf')).toBe(false)
    expect(isWizardStepEnabled('aepagencies', ['aep'], 'faa_part139')).toBe(true)
    expect(isWizardStepEnabled('scnagencies', ['scn'], 'usaf')).toBe(true)
    expect(isWizardStepEnabled('scnagencies', ['scn'], 'faa_part139')).toBe(false)
  })

  it('fails open on airport_type when omitted — why callers must pass a pre-filtered list', () => {
    expect(isWizardStepEnabled('aepagencies', ['aep'])).toBe(true)
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

// USAF-only modules (hidden on civilian bases) and the Part 139-only
// modules (hidden on USAF bases). These lists gate the Base Configuration
// module selector — widening either silently re-clutters the other mode's UI.
const USAF_ONLY: string[] = ['scn', 'amtr', 'fpr', 'driving_checks']
const PART139_ONLY: string[] = ['sms', 'training_part139', 'aep', 'field_conditions', 'whmp']
const SHARED_SAMPLE: string[] = ['acsi', 'checks', 'discrepancies', 'qrc', 'wildlife']

describe('moduleAppliesToAirport', () => {
  it('USAF-only modules apply to usaf, not faa_part139', () => {
    for (const k of USAF_ONLY) {
      expect(moduleAppliesToAirport(k as never, 'usaf')).toBe(true)
      expect(moduleAppliesToAirport(k as never, 'faa_part139')).toBe(false)
    }
  })

  it('Part 139-only modules apply to faa_part139, not usaf', () => {
    for (const k of PART139_ONLY) {
      expect(moduleAppliesToAirport(k as never, 'faa_part139')).toBe(true)
      expect(moduleAppliesToAirport(k as never, 'usaf')).toBe(false)
    }
  })

  it('shared modules apply to both modes', () => {
    for (const k of SHARED_SAMPLE) {
      expect(moduleAppliesToAirport(k as never, 'usaf')).toBe(true)
      expect(moduleAppliesToAirport(k as never, 'faa_part139')).toBe(true)
    }
  })

  it('fails open when airport type is unknown', () => {
    expect(moduleAppliesToAirport('sms' as never, null)).toBe(true)
    expect(moduleAppliesToAirport('scn' as never, undefined)).toBe(true)
  })
})

describe('modulesForAirport', () => {
  it('hides Part 139-only modules on USAF bases', () => {
    const keys = modulesForAirport('usaf').map(m => m.key)
    for (const k of PART139_ONLY) expect(keys).not.toContain(k)
    for (const k of USAF_ONLY) expect(keys).toContain(k)
  })

  it('hides USAF-only modules on civilian bases', () => {
    const keys = modulesForAirport('faa_part139').map(m => m.key)
    for (const k of USAF_ONLY) expect(keys).not.toContain(k)
    for (const k of PART139_ONLY) expect(keys).toContain(k)
  })

  it('returns every module when airport type is unknown (fail open)', () => {
    const keys = modulesForAirport(null).map(m => m.key)
    for (const k of [...USAF_ONLY, ...PART139_ONLY]) expect(keys).toContain(k)
  })
})

describe('getModulesByCategory airport gating', () => {
  it('drops Part 139-only modules from a USAF catalog', () => {
    const flat = Object.values(getModulesByCategory('usaf')).flat().map(m => m.key)
    for (const k of PART139_ONLY) expect(flat).not.toContain(k)
    expect(flat).toContain('amtr')
  })

  it('drops USAF-only modules from a civilian catalog', () => {
    const flat = Object.values(getModulesByCategory('faa_part139')).flat().map(m => m.key)
    for (const k of USAF_ONLY) expect(flat).not.toContain(k)
    expect(flat).toContain('sms')
  })

  it('returns all modules with no airport type (backward compatible)', () => {
    const flat = Object.values(getModulesByCategory()).flat().map(m => m.key)
    for (const k of [...USAF_ONLY, ...PART139_ONLY]) expect(flat).toContain(k)
  })
})
