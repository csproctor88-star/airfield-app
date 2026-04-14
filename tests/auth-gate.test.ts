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
})
