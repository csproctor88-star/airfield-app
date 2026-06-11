import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Best-guess client IP from a request's proxy headers.
 *
 * SECURITY (M-4): prefer platform-set headers a client cannot forge. The
 * leftmost `x-forwarded-for` token is fully attacker-controlled (a client can
 * prepend any value), so keying a per-IP throttle off it lets an attacker
 * mint a fresh bucket per request and bypass the limit. On Vercel,
 * `x-vercel-forwarded-for` and `x-real-ip` are set by the edge to the true
 * client address and are not spoofable, so we use those first and only fall
 * back to the LAST (closest-proxy) `x-forwarded-for` hop off-platform.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get('x-vercel-forwarded-for')?.trim()
  if (vercel) return vercel.split(',')[0]!.trim()

  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real

  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((h) => h.trim()).filter(Boolean)
    if (hops.length) return hops[hops.length - 1]!
  }
  return 'unknown'
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
