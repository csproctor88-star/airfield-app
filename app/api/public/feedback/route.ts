import { NextResponse } from 'next/server'
import { getAnonClient } from '@/lib/admin/role-checks'
import { publicWriteRateLimit } from '@/lib/public-rate-limit'
import type { Json } from '@/lib/supabase/types'

// Server-side wrapper for the anonymous public feedback submission.
//
// Unlike PPR / safety report, feedback is a direct INSERT into customer_feedback
// (anon INSERT is allowed by that table's RLS), not a SECURITY DEFINER RPC. We
// reproduce the same insert here with an anon client after an IP + base rate
// limit. The client had only a bypassable localStorage cooldown before.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    base_id?: string
    name?: string | null
    email?: string | null
    organization?: string | null
    overall_rating?: number | null
    comments?: string | null
    responses?: Record<string, unknown>
  } | null

  const baseId = body?.base_id
  if (!baseId) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const limited = await publicWriteRateLimit(request, 'feedback-public', baseId)
  if (limited) return limited

  const anon = getAnonClient()
  if (!anon) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  const { error } = await anon.from('customer_feedback').insert({
    base_id: baseId,
    name: body?.name || null,
    email: body?.email || null,
    organization: body?.organization || null,
    overall_rating: body?.overall_rating || null,
    comments: body?.comments || null,
    responses: (body?.responses || {}) as Json,
  })

  if (error) {
    console.error('[public/feedback] submit failed:', error.message)
    return NextResponse.json({ error: error.message || 'Submission failed' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
