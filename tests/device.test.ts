import { describe, it, expect, afterEach, vi } from 'vitest'
import { isMobileDevice } from '@/lib/device'

// ─── Device detection ───
// iPadOS 13+ Safari reports a desktop-class UA (platform "MacIntel", no "iPad"
// token) but exposes touch points — the canonical iPad tell. PDFs in an
// <iframe> only render their first page on iOS/iPadOS WebKit, so these devices
// must be detected to fall back to the native viewer.

afterEach(() => vi.unstubAllGlobals())

const stub = (nav: Record<string, unknown> | undefined) => vi.stubGlobal('navigator', nav)

describe('isMobileDevice', () => {
  it('detects iPadOS 13+ (desktop-class UA: MacIntel + touch points)', () => {
    stub({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit Safari', platform: 'MacIntel', maxTouchPoints: 5 })
    expect(isMobileDevice()).toBe(true)
  })

  it('detects iPhone (UA token)', () => {
    stub({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', platform: 'iPhone', maxTouchPoints: 5 })
    expect(isMobileDevice()).toBe(true)
  })

  it('detects Android', () => {
    stub({ userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome', platform: 'Linux armv8l', maxTouchPoints: 5 })
    expect(isMobileDevice()).toBe(true)
  })

  it('returns false for a desktop Mac with no touch screen', () => {
    stub({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', platform: 'MacIntel', maxTouchPoints: 0 })
    expect(isMobileDevice()).toBe(false)
  })

  it('returns false for a Windows desktop', () => {
    stub({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome', platform: 'Win32', maxTouchPoints: 0 })
    expect(isMobileDevice()).toBe(false)
  })

  it('returns false when navigator is unavailable (SSR)', () => {
    stub(undefined)
    expect(isMobileDevice()).toBe(false)
  })
})
