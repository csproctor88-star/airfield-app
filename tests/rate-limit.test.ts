import { describe, it, expect, vi } from 'vitest'
import { getClientIp, checkRateLimits, type RateLimitRule } from '@/lib/rate-limit'
import type { SupabaseClient } from '@supabase/supabase-js'

// Minimal fake of the bits checkRateLimits uses: a single rpc() method.
function fakeAdmin(rpc: (fn: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc } as unknown as SupabaseClient
}

const rules: RateLimitRule[] = [
  { bucket: 'ep:email:a@b.mil', max: 3, windowSeconds: 900 },
  { bucket: 'ep:ip:1.2.3.4', max: 20, windowSeconds: 3600 },
]

describe('getClientIp', () => {
  it('takes the first IP from x-forwarded-for', () => {
    const req = new Request('https://x', { headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('https://x', { headers: { 'x-real-ip': '8.8.8.8' } })
    expect(getClientIp(req)).toBe('8.8.8.8')
  })

  it('returns "unknown" when no proxy headers are present', () => {
    expect(getClientIp(new Request('https://x'))).toBe('unknown')
  })
})

describe('checkRateLimits', () => {
  it('allows when every rule is under its limit', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    const ok = await checkRateLimits(fakeAdmin(rpc), rules)
    expect(ok).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith('check_rate_limit', {
      p_bucket: 'ep:email:a@b.mil',
      p_max: 3,
      p_window_seconds: 900,
    })
  })

  it('denies (false) as soon as a rule is exceeded, and stops checking', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: false, error: null })
    const ok = await checkRateLimits(fakeAdmin(rpc), rules)
    expect(ok).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1) // short-circuits on first denial
  })

  it('fails open (allows) when the RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } })
    const ok = await checkRateLimits(fakeAdmin(rpc), rules)
    expect(ok).toBe(true)
  })
})
