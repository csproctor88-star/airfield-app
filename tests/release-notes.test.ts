import { describe, it, expect } from 'vitest'
import {
  compareVersions,
  isNewerVersion,
  unseenReleaseNotes,
  RELEASE_NOTES,
} from '@/lib/release-notes'

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('2.32.0', '2.32.0')).toBe(0)
  })

  it('returns 1 when left is newer (patch, minor, major)', () => {
    expect(compareVersions('2.32.1', '2.32.0')).toBe(1)
    expect(compareVersions('2.33.0', '2.32.0')).toBe(1)
    expect(compareVersions('3.0.0', '2.99.99')).toBe(1)
  })

  it('returns -1 when left is older', () => {
    expect(compareVersions('2.31.0', '2.32.0')).toBe(-1)
    expect(compareVersions('1.99.99', '2.0.0')).toBe(-1)
  })

  it('treats missing trailing segments as 0', () => {
    expect(compareVersions('2.32', '2.32.0')).toBe(0)
    expect(compareVersions('2.32.0', '2.32')).toBe(0)
    expect(compareVersions('2.33', '2.32.5')).toBe(1)
  })

  it('compares numerically, not lexicographically', () => {
    expect(compareVersions('2.10.0', '2.9.0')).toBe(1)
    expect(compareVersions('2.9.0', '2.10.0')).toBe(-1)
  })

  it('handles leading zeros and non-numeric garbage by treating as 0', () => {
    expect(compareVersions('2.32.0', '2.032.0')).toBe(0)
    expect(compareVersions('2.xx.0', '2.0.0')).toBe(0)
  })
})

describe('isNewerVersion', () => {
  it('returns true when lastSeen is null or undefined (first-time user)', () => {
    expect(isNewerVersion('2.32.0', null)).toBe(true)
    expect(isNewerVersion('2.32.0', undefined)).toBe(true)
  })

  it('returns false when lastSeen matches current', () => {
    expect(isNewerVersion('2.32.0', '2.32.0')).toBe(false)
  })

  it('returns false when lastSeen is newer than current (should not normally happen)', () => {
    expect(isNewerVersion('2.31.0', '2.32.0')).toBe(false)
  })

  it('returns true when current is newer than lastSeen', () => {
    expect(isNewerVersion('2.32.0', '2.31.0')).toBe(true)
  })
})

describe('unseenReleaseNotes', () => {
  it('returns all notes when lastSeen is null', () => {
    const notes = unseenReleaseNotes(null)
    expect(notes.length).toBe(RELEASE_NOTES.length)
  })

  it('returns empty when lastSeen matches the newest release', () => {
    const latest = RELEASE_NOTES[0].version
    expect(unseenReleaseNotes(latest)).toEqual([])
  })

  it('returns only newer releases when lastSeen is in the middle', () => {
    // simulate: user has seen v2.31, should see v2.32 only
    const notes = unseenReleaseNotes('2.31.0')
    expect(notes.every(n => compareVersions(n.version, '2.31.0') > 0)).toBe(true)
    expect(notes.some(n => n.version === '2.31.0')).toBe(false)
  })

  it('returns every release when lastSeen predates the oldest entry', () => {
    const notes = unseenReleaseNotes('0.0.1')
    expect(notes.length).toBe(RELEASE_NOTES.length)
  })
})
