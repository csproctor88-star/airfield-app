import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}))

describe('middleware auth gate', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('redirects unauthenticated requests to /login', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest(new URL('https://app.test/dashboard'))
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated access to /login', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest(new URL('https://app.test/login'))
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  // Guard: the anonymous public-write server hops (3f5e4dbe) must bypass the
  // cookie auth gate — each route rate-limits itself. Without these entries
  // the middleware 307s the POST to /login and the public form dies with
  // "Submission failed" (the M-6 forgot-password failure mode; regressed for
  // 12 days on the PPR / safety-report / feedback forms, 2026-07-02..14).
  it('lets anonymous public-write API posts through', async () => {
    const { middleware } = await import('@/middleware')
    for (const path of ['/api/public/ppr-request', '/api/public/safety-report', '/api/public/feedback']) {
      const req = new NextRequest(new URL(`https://app.test${path}`), { method: 'POST' })
      const res = await middleware(req)
      expect(res.status, `${path} must not be auth-gated`).toBe(200)
    }
  })

  it('still gates non-public API routes', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest(new URL('https://app.test/api/admin/users'))
    const res = await middleware(req)
    expect(res.status).toBe(307)
  })
})
