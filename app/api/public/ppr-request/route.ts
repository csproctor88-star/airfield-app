import { NextResponse } from 'next/server'
import { getAnonClient } from '@/lib/admin/role-checks'
import { publicWriteRateLimit } from '@/lib/public-rate-limit'

// Server-side wrapper for the anonymous public PPR request submission.
//
// Previously the browser called rpc('submit_public_ppr_request') directly with
// the anon key — no server hop, so nothing throttled it. This route adds an
// IP + base rate limit in front and then calls the SAME SECURITY DEFINER RPC
// with an anon client (behaviorally identical to the old browser call; the RPC
// enforces its own column scoping). The limiter uses the service-role client
// internally (that RPC isn't granted to anon).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    base_id?: string
    requester_name?: string
    requester_email?: string
    requester_phone?: string
    arrival_date?: string
    column_values?: Record<string, string>
    notes?: string | null
  } | null

  const baseId = body?.base_id
  if (!baseId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const limited = await publicWriteRateLimit(request, 'ppr-public', baseId)
  if (limited) return limited

  const anon = getAnonClient()
  if (!anon) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (anon as any).rpc('submit_public_ppr_request', {
    p_base_id: baseId,
    p_requester_name: body?.requester_name ?? '',
    p_requester_email: body?.requester_email ?? '',
    p_requester_phone: body?.requester_phone ?? '',
    p_arrival_date: body?.arrival_date ?? null,
    p_column_values: body?.column_values ?? {},
    p_notes: body?.notes ?? null,
  })

  if (error) {
    console.error('[public/ppr-request] submit failed:', error.message)
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
