import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock state (vi.hoisted so the mock factories may reference it).
const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  batchSend: vi.fn(),
  emailSend: vi.fn(),
  insert: vi.fn(),
  state: { callerRole: 'sys_admin', recipientRows: [] as Array<{ email: string; name: string }> },
}))

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser: h.getUser } }) }))
vi.mock('resend', () => ({
  Resend: class {
    batch = { send: h.batchSend }
    emails = { send: h.emailSend }
  },
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      if (table === 'email_broadcasts') return { insert: h.insert }
      // profiles: caller lookup uses .eq('id').single(); recipient query awaits.
      const builder: Record<string, unknown> = {
        select() { return builder },
        eq(col: string) {
          if (col === 'id') {
            return { single: async () => ({ data: { role: h.state.callerRole, email: 'admin@x.com', name: 'Admin' } }) }
          }
          return builder
        },
        in() { return builder },
        then(resolve: (v: { data: unknown; error: null }) => void) {
          resolve({ data: h.state.recipientRows, error: null })
        },
      }
      return builder
    },
  }),
}))

async function callRoute(body: unknown) {
  const { POST } = await import('@/app/api/admin/broadcast-email/route')
  const res = await POST(
    new Request('http://localhost/api/admin/broadcast-email', { method: 'POST', body: JSON.stringify(body) }),
  )
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  process.env.RESEND_API_KEY = 'resend'
  h.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  h.batchSend.mockResolvedValue({ data: {}, error: null })
  h.insert.mockResolvedValue({ error: null })
  h.state.callerRole = 'sys_admin'
  h.state.recipientRows = [{ email: 'a@x.com', name: 'A' }, { email: 'b@x.com', name: 'B' }]
})

describe('POST /api/admin/broadcast-email', () => {
  it('403s a non-sys_admin caller', async () => {
    h.state.callerRole = 'base_admin'
    const { status } = await callRoute({ mode: 'count' })
    expect(status).toBe(403)
  })

  it('count returns the resolved recipient count', async () => {
    const { status, json } = await callRoute({ mode: 'count' })
    expect(status).toBe(200)
    expect(json.recipientCount).toBe(2)
  })

  it('send batches emails, writes an audit row, and returns the tally', async () => {
    const { status, json } = await callRoute({ mode: 'send', subject: 'Hi', body: 'Body' })
    expect(status).toBe(200)
    expect(h.batchSend).toHaveBeenCalledTimes(1)
    expect(h.batchSend.mock.calls[0][0]).toHaveLength(2) // one email per recipient
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(json).toMatchObject({ recipientCount: 2, sent: 2, failed: 0 })
  })

  it('send 400s when no recipients match', async () => {
    h.state.recipientRows = []
    const { status } = await callRoute({ mode: 'send', subject: 'Hi', body: 'Body' })
    expect(status).toBe(400)
  })

  it('rejects an off-allowlist from with 400', async () => {
    const { status } = await callRoute({ mode: 'send', subject: 'S', body: 'B', from: 'evil@attacker.com' })
    expect(status).toBe(400)
  })

  it('sends from the chosen allowlisted sender with matching reply-to', async () => {
    await callRoute({ mode: 'send', subject: 'S', body: 'B', from: 'chris@glidepathops.com' })
    const firstEmail = h.batchSend.mock.calls[0][0][0]
    expect(firstEmail.from).toBe('Chris Proctor <chris@glidepathops.com>')
    expect(firstEmail.replyTo).toBe('chris@glidepathops.com')
  })
})
