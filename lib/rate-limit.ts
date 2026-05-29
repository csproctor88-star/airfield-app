import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Best-guess client IP from a request's proxy headers. On Vercel,
 * `x-forwarded-for` is set to a comma-separated list with the client first.
 * Falls back to `x-real-ip`, then a literal sentinel so callers always have a
 * stable bucket key (all unknown-IP callers share one bucket — acceptable for
 * an abuse throttle).
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export type RateLimitRule = {
  /** Stable key for this dimension, e.g. `forgot-password:email:foo@bar.mil`. */
  bucket: string
  /** Max hits allowed within the window before requests are denied. */
  max: number
  /** Sliding-window length in seconds. */
  windowSeconds: number
}

/**
 * Check a set of rate-limit rules via the `check_rate_limit` Postgres RPC.
 * Returns true if the request is within every rule's limit, false if any rule
 * is exceeded (caller should respond 429).
 *
 * **Fails open:** if the RPC errors (limiter table missing, DB hiccup), the
 * request is allowed. For password-reset / email endpoints, occasionally
 * under-throttling beats locking legitimate users out because the limiter
 * broke.
 *
 * Pass a service-role client — the RPC is not granted to anon.
 */
export async function checkRateLimits(
  admin: SupabaseClient,
  rules: RateLimitRule[],
): Promise<boolean> {
  for (const rule of rules) {
    const { data, error } = await admin.rpc('check_rate_limit', {
      p_bucket: rule.bucket,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) {
      // Fail open for this rule — don't let a limiter failure block the user.
      console.warn('[rate-limit] check failed, allowing:', error.message)
      continue
    }
    if (data === false) return false
  }
  return true
}
