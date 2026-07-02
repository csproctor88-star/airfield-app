import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin/role-checks'
import { checkRateLimits, getClientIp } from '@/lib/rate-limit'

/**
 * IP + base throttle for the anonymous public-write API routes
 * (PPR request, safety report, feedback). These forms have no auth and,
 * before this, POSTed straight from the browser to SECURITY DEFINER RPCs
 * with nothing to rate-limit them — a script could submit without bound.
 *
 * Returns `null` when the request may proceed, or a ready-to-return 429
 * NextResponse when a bucket is exceeded.
 *
 * Three dimensions per surface:
 *   - `<prefix>:ip:<ip>`            — one host flooding across bases
 *   - `<prefix>:base:<baseId>`      — a targeted flood at one base
 *   - `<prefix>:ip-base:<ip>:<b>`   — burst spam of one base from one host
 *
 * Fails OPEN: if the service-role client is unavailable (no key configured)
 * or the limiter RPC errors (handled inside checkRateLimits), the request is
 * allowed. A broken limiter must never take down a public submission path —
 * occasional under-throttling beats locking out a legitimate aircrew.
 */
export async function publicWriteRateLimit(
  request: Request,
  prefix: string,
  baseId: string,
): Promise<NextResponse | null> {
  const admin = getAdminClient()
  if (!admin) return null // no SUPABASE_SERVICE_ROLE_KEY — fail open

  const ip = getClientIp(request)
  const allowed = await checkRateLimits(admin, [
    { bucket: `${prefix}:ip:${ip}`, max: 10, windowSeconds: 3600 },
    { bucket: `${prefix}:base:${baseId}`, max: 60, windowSeconds: 3600 },
    { bucket: `${prefix}:ip-base:${ip}:${baseId}`, max: 5, windowSeconds: 600 },
  ])
  if (allowed) return null

  return NextResponse.json(
    { error: 'Too many requests. Please wait a few minutes and try again.' },
    { status: 429 },
  )
}
