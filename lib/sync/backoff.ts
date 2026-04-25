/**
 * Exponential backoff for write-queue retries.
 *
 * Per spec (docs/Offline_Write_Queue_Spec.md): "retry with exponential
 * backoff on transient failures (3 attempts max, capped at 5 minutes)."
 *
 * We bump max attempts to 5 so a flaky reconnect window doesn't burn
 * three retries inside the first minute and immediately give up.
 */

export const MAX_ATTEMPTS = 5
export const BACKOFF_CAP_MS = 5 * 60 * 1000

const BASE_DELAY_MS = 1000

/**
 * Delay before retry attempt N, given the count of attempts already made.
 *
 *   attempts=1 → 1s   (just failed first try)
 *   attempts=2 → 2s
 *   attempts=3 → 4s
 *   attempts=4 → 8s
 *   attempts=5 → 16s
 *
 * Capped at BACKOFF_CAP_MS so a long-paused queue doesn't wait an hour
 * before the next attempt when the user reopens the app.
 *
 * Pure function — easy to test, no Date.now() inside.
 */
export function nextRetryDelayMs(attempts: number): number {
  if (attempts < 1) return 0
  const delay = BASE_DELAY_MS * Math.pow(2, attempts - 1)
  return Math.min(delay, BACKOFF_CAP_MS)
}

/**
 * Whether enough time has elapsed since the last attempt to try again.
 *
 * Drainer calls this before re-executing a queued write. If a write
 * just failed 500ms ago, we shouldn't retry it on the very next
 * online event — that's effectively a tight loop.
 */
export function isReadyForRetry(
  attempts: number,
  lastAttemptAt: string | null,
  now: number = Date.now(),
): boolean {
  if (attempts === 0 || lastAttemptAt === null) return true
  const elapsed = now - new Date(lastAttemptAt).getTime()
  return elapsed >= nextRetryDelayMs(attempts)
}

/**
 * Whether a write has hit its retry cap and should be marked `failed`.
 */
export function hasExhaustedRetries(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS
}
