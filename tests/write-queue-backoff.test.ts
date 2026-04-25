import { describe, it, expect } from 'vitest'
import {
  BACKOFF_CAP_MS,
  MAX_ATTEMPTS,
  hasExhaustedRetries,
  isReadyForRetry,
  nextRetryDelayMs,
} from '@/lib/sync/backoff'

describe('nextRetryDelayMs', () => {
  it('returns 0 when no attempts have been made yet', () => {
    expect(nextRetryDelayMs(0)).toBe(0)
  })

  it('doubles each attempt', () => {
    expect(nextRetryDelayMs(1)).toBe(1000)
    expect(nextRetryDelayMs(2)).toBe(2000)
    expect(nextRetryDelayMs(3)).toBe(4000)
    expect(nextRetryDelayMs(4)).toBe(8000)
    expect(nextRetryDelayMs(5)).toBe(16000)
  })

  it('caps at the configured ceiling so a stale queue does not wait an hour', () => {
    expect(nextRetryDelayMs(20)).toBe(BACKOFF_CAP_MS)
    expect(nextRetryDelayMs(99)).toBe(BACKOFF_CAP_MS)
  })
})

describe('isReadyForRetry', () => {
  it('is ready when no attempt has happened yet', () => {
    expect(isReadyForRetry(0, null)).toBe(true)
    // Defensive: lastAttemptAt is null even though attempts > 0 — treat as ready
    expect(isReadyForRetry(3, null)).toBe(true)
  })

  it('blocks retries inside the backoff window', () => {
    const lastAttempt = new Date('2026-04-25T12:00:00Z').toISOString()
    // attempts=2 → 2s window. 1s in: not ready.
    const now = new Date('2026-04-25T12:00:01Z').getTime()
    expect(isReadyForRetry(2, lastAttempt, now)).toBe(false)
  })

  it('allows retries once the backoff window has elapsed', () => {
    const lastAttempt = new Date('2026-04-25T12:00:00Z').toISOString()
    // attempts=2 → 2s window. 3s later: ready.
    const now = new Date('2026-04-25T12:00:03Z').getTime()
    expect(isReadyForRetry(2, lastAttempt, now)).toBe(true)
  })
})

describe('hasExhaustedRetries', () => {
  it('returns false below the cap', () => {
    expect(hasExhaustedRetries(0)).toBe(false)
    expect(hasExhaustedRetries(MAX_ATTEMPTS - 1)).toBe(false)
  })

  it('returns true at and above the cap', () => {
    expect(hasExhaustedRetries(MAX_ATTEMPTS)).toBe(true)
    expect(hasExhaustedRetries(MAX_ATTEMPTS + 1)).toBe(true)
  })
})
