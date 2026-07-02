import { NextResponse } from 'next/server'
import { getAnonClient } from '@/lib/admin/role-checks'
import { publicWriteRateLimit } from '@/lib/public-rate-limit'

// Server-side wrapper for the anonymous public safety report submission.
// Adds an IP + base rate limit in front of the existing SECURITY DEFINER RPC
// (submit_safety_report_public), which is still called with an anon client so
// behavior is identical to the prior browser call. Returns the report_code the
// RPC mints so the form can show it.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    base_id?: string
    category?: string
    description?: string
    occurred_at?: string | null
    location_text?: string | null
    immediate_action?: string | null
    reporter_name?: string | null
    reporter_email?: string | null
    reporter_phone?: string | null
    reporter_role?: string | null
  } | null

  const baseId = body?.base_id
  if (!baseId || !body?.description?.trim()) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const limited = await publicWriteRateLimit(request, 'safety-public', baseId)
  if (limited) return limited

  const anon = getAnonClient()
  if (!anon) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (anon as any).rpc('submit_safety_report_public', {
    p_base_id: baseId,
    p_category: body?.category ?? 'other',
    p_description: body.description.trim(),
    p_occurred_at: body?.occurred_at ?? null,
    p_location_text: body?.location_text ?? null,
    p_immediate_action: body?.immediate_action ?? null,
    p_reporter_name: body?.reporter_name ?? null,
    p_reporter_email: body?.reporter_email ?? null,
    p_reporter_phone: body?.reporter_phone ?? null,
    p_reporter_role: body?.reporter_role ?? null,
  })

  if (error) {
    console.error('[public/safety-report] submit failed:', error.message)
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 400 })
  }

  const reportCode = (data as { report_code?: string } | null)?.report_code ?? null
  return NextResponse.json({ ok: true, report_code: reportCode })
}
