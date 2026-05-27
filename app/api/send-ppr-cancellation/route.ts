export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { notifyCoordinatingAgencies } from '@/lib/ppr-agency-notify'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Same shape check used on the approval / denial / confirmation / coordination
 *  routes — Resend rejects sends entirely on a malformed replyTo. */
function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

/**
 * Cancellation email — sent to the public requester when the PPR is
 * canceled (soft-cancel via cancelPprEntry). Authenticated route;
 * gated upstream on ppr:write. Looks up the entry, validates
 * status='canceled', and emails the requester with the cancellation
 * reason. Internally-created PPRs (no requester_email) are a no-op
 * success — same pattern as the denial / approval routes.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Server not configured — RESEND_API_KEY missing' }, { status: 500 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const cookieStore = cookies()
    const sb = createServerClient(url, anonKey, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await sb.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { entryId } = (await request.json()) as { entryId?: string }
    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const reader = serviceKey ? createServiceClient(url, serviceKey) : sb
    const { data: entry, error: entryErr } = await reader
      .from('ppr_entries')
      .select('id, base_id, ppr_number, status, requester_name, requester_email, arrival_date, cancellation_reason')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
        status: string
        requester_name: string | null
        requester_email: string | null
        arrival_date: string
        cancellation_reason: string | null
      }>()

    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    if (entry.status !== 'canceled') {
      return NextResponse.json({ error: `Entry status is ${entry.status}, not canceled` }, { status: 400 })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Internal-create PPRs (no public requester) skip the requester
    // email but STILL notify coordinating agencies below if any
    // coord rows exist on the entry.
    if (entry.requester_email) {
    const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
    const safeName = escapeHtml(entry.requester_name || 'Aircrew')
    const safeBase = escapeHtml(base.name)
    const safePpr = escapeHtml(entry.ppr_number)
    const safeArrival = escapeHtml(entry.arrival_date)
    const safeReason = escapeHtml(entry.cancellation_reason || 'No reason provided.')
    const replyTo = validReplyTo(base.amops_email)

    const { error } = await getResend().emails.send({
      from: fromLabel,
      to: entry.requester_email,
      replyTo,
      cc: replyTo ? [replyTo] : undefined,
      subject: `${base.name} PPR ${entry.ppr_number} CANCELED — Arrival ${entry.arrival_date}`,
      html: `
        <p>Hello ${safeName},</p>
        <p>Your Prior Permission Required (PPR) <strong>${safePpr}</strong> at ${safeBase} for arrival on <strong>${safeArrival}</strong> has been <strong style="color:#475569;">canceled</strong>.</p>
        <div style="margin-top:12px;padding:10px 14px;background:#f1f5f9;border-left:4px solid #94a3b8;border-radius:4px;">
          <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
            Reason for cancellation
          </div>
          <div style="font-size:14px;color:#222;white-space:pre-wrap;">${safeReason}</div>
        </div>
        <p style="margin-top:14px;">If this cancellation was unexpected or you would like to submit a new request, please contact AMOPS.</p>
        ${replyTo
          ? `<p>Contact AMOPS at <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a> with any questions or concerns.</p>`
          : '<p>Contact AMOPS with any questions or concerns.</p>'}
        <p style="color:#888;font-size:12px;">Do not reply to this email — replies are unmonitored.</p>
      `,
    })

    if (error) {
      console.error('[send-ppr-cancellation] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    }

    const agencyResult = await notifyCoordinatingAgencies({
      reader,
      resend: getResend(),
      entry: {
        id: entry.id,
        base_id: entry.base_id,
        ppr_number: entry.ppr_number,
        arrival_date: entry.arrival_date,
        requester_name: entry.requester_name,
      },
      base: { name: base.name, amops_email: base.amops_email },
      outcome: 'canceled',
      reason: entry.cancellation_reason,
    })

    return NextResponse.json({ success: true, agencies: agencyResult })
  } catch (err) {
    console.error('[send-ppr-cancellation] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
