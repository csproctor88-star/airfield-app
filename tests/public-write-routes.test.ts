import { describe, it, expect, beforeEach, vi } from 'vitest'

// Exercises the three anonymous public-write API routes end-to-end through the
// real publicWriteRateLimit + checkRateLimits helpers, with the Supabase admin
// (limiter) and anon (submit) clients faked. Locks the invariants that matter:
//   - a missing base_id is rejected 400 (needed for the per-base bucket)
//   - a limiter denial returns 429 and the submit never runs
//   - the limiter fails open when no service-role client is configured
//   - the browser payload is mapped onto the exact RPC / insert shape
const { state } = vi.hoisted(() => ({
  state: {
    adminNull: false,
    limitAllowed: true,
    submitError: null as null | { message: string },
    submitData: null as unknown,
    calls: {
      limitBuckets: [] as string[],
      rpc: [] as Array<{ fn: string; args: Record<string, unknown> }>,
      insert: [] as Array<{ table: string; row: Record<string, unknown> }>,
    },
  },
}))

function resetState() {
  state.adminNull = false
  state.limitAllowed = true
  state.submitError = null
  state.submitData = null
  state.calls.limitBuckets = []
  state.calls.rpc = []
  state.calls.insert = []
}

vi.mock('@/lib/admin/role-checks', () => ({
  // Service-role client — used only by the limiter (check_rate_limit RPC).
  getAdminClient: () =>
    state.adminNull
      ? null
      : {
          rpc: async (_fn: string, args: { p_bucket: string }) => {
            state.calls.limitBuckets.push(args.p_bucket)
            return { data: state.limitAllowed, error: null }
          },
        },
  // Anon client — used for the actual submit (RPC or insert).
  getAnonClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.calls.rpc.push({ fn, args })
      return { data: state.submitData, error: state.submitError }
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        state.calls.insert.push({ table, row })
        return { error: state.submitError }
      },
    }),
  }),
}))

async function callRoute(
  modPath: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const mod = await import(modPath)
  const req = new Request('https://app.test/api/public', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '9.9.9.9' },
    body: JSON.stringify(body),
  })
  const res = await mod.POST(req)
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

beforeEach(resetState)

describe('POST /api/public/ppr-request', () => {
  const path = '@/app/api/public/ppr-request/route'
  const good = {
    base_id: 'base-1',
    requester_name: 'Jane Doe',
    requester_email: 'jane@example.com',
    requester_phone: '555-123-4567',
    arrival_date: '2026-07-10',
  }

  it('rejects a missing base_id with 400', async () => {
    const { status } = await callRoute(path, { requester_name: 'x' })
    expect(status).toBe(400)
    expect(state.calls.rpc).toHaveLength(0)
  })

  it('throttles all three dimensions then submits on the happy path', async () => {
    const { status, json } = await callRoute(path, good)
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(state.calls.limitBuckets).toEqual([
      'ppr-public:ip:9.9.9.9',
      'ppr-public:base:base-1',
      'ppr-public:ip-base:9.9.9.9:base-1',
    ])
    expect(state.calls.rpc[0].fn).toBe('submit_public_ppr_request')
    expect(state.calls.rpc[0].args).toMatchObject({
      p_base_id: 'base-1',
      p_requester_name: 'Jane Doe',
      p_column_values: {}, // defaulted when omitted
      p_notes: null,
    })
  })

  it('returns 429 and does NOT submit when a bucket is exceeded', async () => {
    state.limitAllowed = false
    const { status, json } = await callRoute(path, good)
    expect(status).toBe(429)
    expect(json.error).toMatch(/too many requests/i)
    expect(state.calls.rpc).toHaveLength(0)
  })

  it('fails open (submits) when no service-role client is configured', async () => {
    state.adminNull = true
    const { status } = await callRoute(path, good)
    expect(status).toBe(200)
    expect(state.calls.limitBuckets).toHaveLength(0)
    expect(state.calls.rpc).toHaveLength(1)
  })

  it('surfaces a submit failure as 400', async () => {
    state.submitError = { message: 'module disabled' }
    const { status, json } = await callRoute(path, good)
    expect(status).toBe(400)
    expect(json.error).toBe('module disabled')
  })
})

describe('POST /api/public/safety-report', () => {
  const path = '@/app/api/public/safety-report/route'
  const good = { base_id: 'base-2', category: 'wildlife', description: '  bird strike  ' }

  it('rejects a missing description with 400', async () => {
    const { status } = await callRoute(path, { base_id: 'base-2' })
    expect(status).toBe(400)
    expect(state.calls.rpc).toHaveLength(0)
  })

  it('submits, trims the description, and returns the report_code', async () => {
    state.submitData = { report_code: 'SR-2026-014' }
    const { status, json } = await callRoute(path, good)
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true, report_code: 'SR-2026-014' })
    expect(state.calls.rpc[0].fn).toBe('submit_safety_report_public')
    expect(state.calls.rpc[0].args).toMatchObject({
      p_base_id: 'base-2',
      p_category: 'wildlife',
      p_description: 'bird strike',
    })
  })

  it('returns 429 without submitting when throttled', async () => {
    state.limitAllowed = false
    const { status } = await callRoute(path, good)
    expect(status).toBe(429)
    expect(state.calls.rpc).toHaveLength(0)
  })
})

describe('POST /api/public/feedback', () => {
  const path = '@/app/api/public/feedback/route'
  const good = { base_id: 'base-3', name: 'Anon', overall_rating: 5, comments: 'great' }

  it('rejects a missing base_id with 400', async () => {
    const { status } = await callRoute(path, { comments: 'hi' })
    expect(status).toBe(400)
    expect(state.calls.insert).toHaveLength(0)
  })

  it('inserts into customer_feedback on the happy path', async () => {
    const { status, json } = await callRoute(path, good)
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(state.calls.insert[0].table).toBe('customer_feedback')
    expect(state.calls.insert[0].row).toMatchObject({
      base_id: 'base-3',
      overall_rating: 5,
      comments: 'great',
    })
  })

  it('returns 429 without inserting when throttled', async () => {
    state.limitAllowed = false
    const { status } = await callRoute(path, good)
    expect(status).toBe(429)
    expect(state.calls.insert).toHaveLength(0)
  })

  it('fails open (inserts) when no service-role client is configured', async () => {
    state.adminNull = true
    const { status } = await callRoute(path, good)
    expect(status).toBe(200)
    expect(state.calls.limitBuckets).toHaveLength(0)
    expect(state.calls.insert).toHaveLength(1)
  })
})
