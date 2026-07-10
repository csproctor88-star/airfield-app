import { describe, it, expect, vi, beforeEach } from 'vitest'

// Deliverability guard for the two password-related transactional emails.
//
// Regression context: both the admin reset and the self-service forgot-password
// emails once shipped a branded dark card with a gradient "Reset Password" CTA
// button that deep-linked to glidepathops.com. Defender for Office 365
// quarantines styled deep-link emails on .mil tenants, so the reset never
// reached the user (see memory: .mil email deliverability). These tests lock
// the invariant: NO clickable http(s) anchor in either email (mailto is fine),
// admin reset carries a temp password with no URL at all, and forgot-password
// renders its reset URL as plain text.

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  emailSend: vi.fn(),
  updatePasswordArg: undefined as unknown,
  profileUpdateArg: undefined as unknown,
  state: {
    callerRole: 'sys_admin',
    callerBase: 'base-1',
    targetBase: 'base-1',
    targetEmail: 'user@example.mil',
    targetName: 'Test User',
  },
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: h.getUser } }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimits: async () => true,
  getClientIp: () => '1.2.3.4',
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: h.emailSend }
  },
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: { user: { id, email: h.state.targetEmail } },
          error: null,
        }),
        updateUserById: async (_id: string, attrs: unknown) => {
          h.updatePasswordArg = attrs
          return { data: { user: { id: _id } }, error: null }
        },
        generateLink: async () => ({
          data: { properties: { hashed_token: 'HT', verification_type: 'recovery' } },
          error: null,
        }),
      },
    },
    from() {
      const b: Record<string, unknown> = {
        _sel: null as string | null,
        select(cols: string) {
          b._sel = cols
          return b
        },
        eq() {
          return b
        },
        single: async () =>
          typeof b._sel === 'string' && b._sel.includes('role')
            ? { data: { id: 'u1', role: h.state.callerRole, primary_base_id: h.state.callerBase }, error: null }
            : { data: { primary_base_id: h.state.targetBase, name: h.state.targetName }, error: null },
        update(vals: unknown) {
          h.profileUpdateArg = vals
          return { eq: async () => ({ error: null }) }
        },
      }
      return b
    },
  }),
}))

const HTTP_ANCHOR = /<a\s+href=["']https?:/i

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.RESEND_API_KEY = 'resend'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://app.glidepathops.com'
  h.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  h.emailSend.mockResolvedValue({ data: {}, error: null })
  h.updatePasswordArg = undefined
  h.profileUpdateArg = undefined
  h.state.callerRole = 'sys_admin'
  h.state.callerBase = 'base-1'
  h.state.targetBase = 'base-1'
  h.state.targetEmail = 'user@example.mil'
  h.state.targetName = 'Test User'
})

describe('POST /api/admin/reset-password (temp-password, link-free)', () => {
  async function call(body: unknown) {
    const { POST } = await import('@/app/api/admin/reset-password/route')
    const res = await POST(
      new Request('http://localhost/api/admin/reset-password', { method: 'POST', body: JSON.stringify(body) }),
    )
    return { status: res.status, json: await res.json() }
  }

  it('emails a temp password with no clickable link and forces a password change', async () => {
    const { status, json } = await call({ userId: 'target-1' })
    expect(status).toBe(200)
    expect(json.tempPassword).toBeTruthy()
    expect(json.emailSent).toBe(true)

    expect(h.emailSend).toHaveBeenCalledTimes(1)
    const email = (h.emailSend.mock.calls[0] as unknown[])[0] as { from: string; html: string; text: string }
    expect(email.from).toBe('Glidepath <info@glidepathops.com>')
    // No URLs at all — the temp password replaces the recovery link entirely.
    expect(email.html).not.toContain('https://')
    expect(email.html).not.toContain('http://')
    expect(email.text).not.toContain('https://')
    // No branded CTA button remnants.
    expect(email.html).not.toMatch(HTTP_ANCHOR)
    expect(email.html).not.toMatch(/linear-gradient/i)
    // The temp password is in the body so the recipient can sign in.
    expect(email.html).toContain(json.tempPassword)

    // Password was actually reset and the change gate was set.
    expect(h.updatePasswordArg).toEqual({ password: json.tempPassword })
    expect(h.profileUpdateArg).toEqual({ must_change_password: true })
  })

  it('403s a base admin resetting a user at a different installation', async () => {
    h.state.callerRole = 'base_admin'
    h.state.callerBase = 'base-A'
    h.state.targetBase = 'base-B'
    const { status } = await call({ userId: 'target-1' })
    expect(status).toBe(403)
    expect(h.emailSend).not.toHaveBeenCalled()
  })
})

describe('POST /api/forgot-password (link kept, de-branded)', () => {
  async function call(body: unknown) {
    const { POST } = await import('@/app/api/forgot-password/route')
    const res = await POST(
      new Request('http://localhost/api/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    )
    return { status: res.status, json: await res.json() }
  }

  it('renders the reset URL as plain text, not a clickable anchor', async () => {
    const { status } = await call({ email: 'user@example.mil' })
    expect(status).toBe(200)

    expect(h.emailSend).toHaveBeenCalledTimes(1)
    const email = (h.emailSend.mock.calls[0] as unknown[])[0] as { from: string; html: string; text: string }
    expect(email.from).toBe('Glidepath <info@glidepathops.com>')
    // The reset URL must be present (link flow preserved) but ONLY as text.
    expect(email.html).toContain('/auth/confirm?token_hash=HT')
    expect(email.html).not.toMatch(HTTP_ANCHOR)
    expect(email.html).not.toMatch(/linear-gradient/i)
    // Plain-text alternative carries the URL too.
    expect(email.text).toContain('/auth/confirm?token_hash=HT')
  })
})
