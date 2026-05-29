import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// -- Hoisted mock state ----------------------------------------------------
// vi.mock() calls are hoisted above imports, so anything they reference must
// also be hoisted. We expose a mutable `state` object that tests reassign
// per-case to control what the mocked Supabase admin / ssr clients return.
const { state } = vi.hoisted(() => ({
  state: {
    baseRow: null as null | { id: string; name: string; icao: string },
    kioskToken: null as string | null,
    signIn: [] as Array<{ error: { message: string } | null }>,
    createUser: {
      data: null as null | { user: { id: string } },
      error: null as null | { message: string },
    },
    calls: {
      baseIlike: [] as string[],
      signInWithPassword: [] as Array<{ email: string; password: string }>,
      createUser: [] as Array<Record<string, unknown>>,
      profilesUpdate: [] as Array<{ id: string; status: string }>,
      cookieSet: [] as Array<{ name: string; value: string }>,
    },
  },
}))

function resetState() {
  state.baseRow = null
  state.kioskToken = null
  state.signIn = []
  state.createUser = { data: null, error: null }
  state.calls.baseIlike = []
  state.calls.signInWithPassword = []
  state.calls.createUser = []
  state.calls.profilesUpdate = []
  state.calls.cookieSet = []
}

// Admin client (service role) — used for base lookup, createUser, profile update.
vi.mock('@/lib/admin/role-checks', () => ({
  getAdminClient: () => ({
    from(table: string) {
      if (table === 'bases') {
        return {
          select: () => ({
            ilike: (_col: string, val: string) => {
              state.calls.baseIlike.push(val)
              return { maybeSingle: async () => ({ data: state.baseRow, error: null }) }
            },
          }),
          // kiosk_enabled flag flips on generate/disable — not exercised here.
          update: () => ({ eq: async () => ({ error: null }) }),
        }
      }
      if (table === 'base_kiosk_tokens') {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: async () => ({
                data: state.kioskToken ? { token: state.kioskToken } : null,
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === 'profiles') {
        return {
          update: (patch: { status: string }) => ({
            eq: async (_col: string, val: string) => {
              state.calls.profilesUpdate.push({ id: val, status: patch.status })
              return { error: null }
            },
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
    auth: {
      admin: {
        createUser: async (payload: Record<string, unknown>) => {
          state.calls.createUser.push(payload)
          if (state.createUser.error) {
            return { data: null, error: state.createUser.error }
          }
          return { data: state.createUser.data, error: null }
        },
      },
    },
  }),
}))

// getSupabaseConfig returns the anon config the route uses to build the
// cookie-bound createServerClient for signInWithPassword.
vi.mock('@/lib/utils', () => ({
  getSupabaseConfig: () => ({ url: 'https://example.supabase.co', key: 'anon-key' }),
}))

// next/headers cookies() — the route only uses getAll() (none needed for
// these tests) and setAll is wired through the NextResponse we return.
vi.mock('next/headers', () => ({
  cookies: () => ({ getAll: () => [] }),
}))

// createServerClient — we only exercise auth.signInWithPassword. Each call
// pops the next queued result from state.signIn so tests can model
// "fail → succeed" for the auto-provision path.
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void } }) => ({
    auth: {
      signInWithPassword: async (creds: { email: string; password: string }) => {
        state.calls.signInWithPassword.push(creds)
        // Simulate the @supabase/ssr setAll that writes cookies onto the
        // NextResponse held by the route handler.
        opts.cookies.setAll([{ name: 'sb-test', value: 'session', options: {} }])
        const next = state.signIn.shift() ?? { error: null }
        state.calls.cookieSet.push({ name: 'sb-test', value: 'session' })
        return next
      },
    },
  }),
}))

// -- Tests -----------------------------------------------------------------

async function callKiosk(
  icao: string,
  search: string,
): Promise<{ status: number; location: string | null; errorCode: string | null }> {
  const { GET } = await import('@/app/kiosk/[icao]/route')
  const req = new NextRequest(new URL(`https://app.test/kiosk/${icao}${search}`))
  const res = await GET(req, { params: { icao } })
  const location = res.headers.get('location')
  const errorCode = location ? new URL(location).searchParams.get('error') : null
  return { status: res.status, location, errorCode }
}

describe('kiosk route — /kiosk/<icao>', () => {
  const savedPassword = process.env.KIOSK_PASSWORD

  beforeEach(() => {
    resetState()
    process.env.KIOSK_PASSWORD = 'kiosk-password-xyz'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  afterEach(() => {
    if (savedPassword === undefined) delete process.env.KIOSK_PASSWORD
    else process.env.KIOSK_PASSWORD = savedPassword
  })

  describe('input validation', () => {
    it('rejects an ICAO that is too short', async () => {
      const { status, errorCode } = await callKiosk('KK', '?token=abc')
      expect(status).toBe(307)
      expect(errorCode).toBe('kiosk_invalid_icao')
    })

    it('rejects an ICAO with special characters', async () => {
      const { errorCode } = await callKiosk('KS-M', '?token=abc')
      expect(errorCode).toBe('kiosk_invalid_icao')
    })

    it('rejects when KIOSK_PASSWORD is not set', async () => {
      delete process.env.KIOSK_PASSWORD
      const { errorCode } = await callKiosk('KSMF', '?token=abc')
      expect(errorCode).toBe('kiosk_not_configured')
    })

    it('rejects when no token query param is supplied', async () => {
      const { errorCode } = await callKiosk('KSMF', '')
      expect(errorCode).toBe('kiosk_token_required')
    })
  })

  describe('base lookup', () => {
    it('rejects when the base is not found', async () => {
      state.baseRow = null
      const { errorCode } = await callKiosk('KXXX', '?token=abc')
      expect(errorCode).toBe('kiosk_base_not_found')
    })

    it('uppercases the ICAO before lookup', async () => {
      state.baseRow = null
      await callKiosk('ksmf', '?token=abc')
      expect(state.calls.baseIlike[0]).toBe('KSMF')
    })

    it('rejects when the base has a null kiosk_token (disabled)', async () => {
      state.baseRow = { id: 'base-1', name: 'Test', icao: 'KSMF' }
      state.kioskToken = null
      const { errorCode } = await callKiosk('KSMF', '?token=abc')
      expect(errorCode).toBe('kiosk_disabled')
    })

    it('rejects when the token does not match', async () => {
      state.baseRow = { id: 'base-1', name: 'Test', icao: 'KSMF' }
      state.kioskToken = 'correct-token'
      const { errorCode } = await callKiosk('KSMF', '?token=wrong-token')
      expect(errorCode).toBe('kiosk_token_mismatch')
    })

    it('rejects when the provided token is a length-mismatched prefix', async () => {
      // Constant-time compare short-circuits on length before timingSafeEqual.
      state.baseRow = { id: 'base-1', name: 'Test', icao: 'KSMF' }
      state.kioskToken = 'correct-token'
      const { errorCode } = await callKiosk('KSMF', '?token=correct')
      expect(errorCode).toBe('kiosk_token_mismatch')
    })
  })

  describe('happy path — account already exists', () => {
    it('signs in directly and redirects to /', async () => {
      state.baseRow = { id: 'base-1', name: 'Selfridge', icao: 'KMTC' }
      state.kioskToken = 'good-token'
      state.signIn = [{ error: null }]
      const { status, location } = await callKiosk('KMTC', '?token=good-token')
      expect(status).toBe(307)
      expect(new URL(location!).pathname).toBe('/')
      expect(state.calls.signInWithPassword).toHaveLength(1)
      expect(state.calls.signInWithPassword[0]).toEqual({
        email: 'kiosk-kmtc@glidepathops.com',
        password: 'kiosk-password-xyz',
      })
      // No auto-provisioning needed.
      expect(state.calls.createUser).toHaveLength(0)
      expect(state.calls.profilesUpdate).toHaveLength(0)
    })
  })

  describe('auto-provision path — account does not exist', () => {
    it('creates the user, flips status to active, then signs in', async () => {
      state.baseRow = { id: 'base-1', name: 'Selfridge', icao: 'KMTC' }
      state.kioskToken = 'good-token'
      state.signIn = [
        { error: { message: 'Invalid login credentials' } },
        { error: null },
      ]
      state.createUser = { data: { user: { id: 'new-user-id' } }, error: null }

      const { status, location } = await callKiosk('KMTC', '?token=good-token')

      expect(status).toBe(307)
      expect(new URL(location!).pathname).toBe('/')
      expect(state.calls.signInWithPassword).toHaveLength(2)
      expect(state.calls.createUser).toHaveLength(1)

      const created = state.calls.createUser[0]
      expect(created).toMatchObject({
        email: 'kiosk-kmtc@glidepathops.com',
        password: 'kiosk-password-xyz',
        email_confirm: true,
      })
      const meta = created.user_metadata as Record<string, unknown>
      expect(meta.role).toBe('airfield_status')
      expect(meta.primary_base_id).toBe('base-1')

      expect(state.calls.profilesUpdate).toEqual([
        { id: 'new-user-id', status: 'active' },
      ])
    })

    it('fails cleanly when createUser returns an error (e.g. rotated password)', async () => {
      state.baseRow = { id: 'base-1', name: 'Selfridge', icao: 'KMTC' }
      state.kioskToken = 'good-token'
      state.signIn = [{ error: { message: 'Invalid login credentials' } }]
      state.createUser = { data: null, error: { message: 'User already registered' } }

      const { errorCode } = await callKiosk('KMTC', '?token=good-token')
      expect(errorCode).toBe('kiosk_auth_failed')
      // Should not attempt a retry sign-in after createUser fails.
      expect(state.calls.signInWithPassword).toHaveLength(1)
      expect(state.calls.profilesUpdate).toHaveLength(0)
    })

    it('fails cleanly when the retry sign-in still errors after provisioning', async () => {
      state.baseRow = { id: 'base-1', name: 'Selfridge', icao: 'KMTC' }
      state.kioskToken = 'good-token'
      state.signIn = [
        { error: { message: 'Invalid login credentials' } },
        { error: { message: 'Invalid login credentials' } },
      ]
      state.createUser = { data: { user: { id: 'new-user-id' } }, error: null }

      const { errorCode } = await callKiosk('KMTC', '?token=good-token')
      expect(errorCode).toBe('kiosk_auth_failed')
      expect(state.calls.signInWithPassword).toHaveLength(2)
      expect(state.calls.profilesUpdate).toHaveLength(1)
    })
  })
})
