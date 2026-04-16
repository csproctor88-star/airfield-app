import { describe, it, expect, beforeEach } from 'vitest'
import {
  consumePauseFlag,
  isInspectionPaused,
  markInspectionPaused,
  pauseKey,
} from '@/lib/inspection-pause'

const BASE_A = 'base-a'
const BASE_B = 'base-b'

describe('pauseKey', () => {
  it('namespaces by type and installation', () => {
    expect(pauseKey('airfield', BASE_A)).toBe('glidepath_inspection_paused_airfield_base-a')
    expect(pauseKey('lighting', BASE_A)).toBe('glidepath_inspection_paused_lighting_base-a')
    expect(pauseKey('airfield', BASE_B)).toBe('glidepath_inspection_paused_airfield_base-b')
  })

  it('produces a stable key for null/undefined installation', () => {
    expect(pauseKey('airfield', null)).toBe('glidepath_inspection_paused_airfield_')
    expect(pauseKey('airfield', undefined)).toBe('glidepath_inspection_paused_airfield_')
  })
})

describe('markInspectionPaused / isInspectionPaused', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('writes the pause flag and reads it back', () => {
    expect(isInspectionPaused('airfield', BASE_A)).toBe(false)
    markInspectionPaused('airfield', BASE_A)
    expect(isInspectionPaused('airfield', BASE_A)).toBe(true)
  })

  it('does not bleed across types or bases', () => {
    markInspectionPaused('airfield', BASE_A)
    expect(isInspectionPaused('lighting', BASE_A)).toBe(false)
    expect(isInspectionPaused('airfield', BASE_B)).toBe(false)
  })
})

describe('consumePauseFlag', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns false and logs nothing when no pause flag is set', () => {
    expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
  })

  it('returns true exactly once after a pause, then false on subsequent calls', () => {
    markInspectionPaused('airfield', BASE_A)
    expect(consumePauseFlag('airfield', BASE_A)).toBe(true)
    expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
    expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
  })

  it('clears the flag after consuming so isInspectionPaused reports false', () => {
    markInspectionPaused('lighting', BASE_A)
    expect(isInspectionPaused('lighting', BASE_A)).toBe(true)
    consumePauseFlag('lighting', BASE_A)
    expect(isInspectionPaused('lighting', BASE_A)).toBe(false)
  })

  it('ignores unrelated values in storage (defensive against truthy coercion)', () => {
    window.localStorage.setItem(pauseKey('airfield', BASE_A), 'false')
    expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
    expect(window.localStorage.getItem(pauseKey('airfield', BASE_A))).toBe('false')

    window.localStorage.setItem(pauseKey('airfield', BASE_A), '1')
    expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
  })

  it('only consumes the scope that was paused', () => {
    markInspectionPaused('airfield', BASE_A)
    markInspectionPaused('lighting', BASE_A)

    expect(consumePauseFlag('airfield', BASE_A)).toBe(true)
    // Lighting flag still live
    expect(isInspectionPaused('lighting', BASE_A)).toBe(true)
    expect(consumePauseFlag('lighting', BASE_A)).toBe(true)
  })

  it('is SSR-safe — returns false when window is undefined', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error simulating SSR
    delete globalThis.window
    try {
      expect(consumePauseFlag('airfield', BASE_A)).toBe(false)
      expect(isInspectionPaused('airfield', BASE_A)).toBe(false)
    } finally {
      globalThis.window = originalWindow
    }
  })
})
