export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Public-facing PPR submission confirmation. Called immediately after
 * a successful submit_public_ppr_request RPC. Deliberately omits the
 * PPR number — the request hasn't been approved yet, and if AMOPS
 * denies it the requester would have a stale reference. The approval
 * email (from /api/send-ppr-approval) is the first place the PPR
 * number is shared externally.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Server not configured — RESEND_API_KEY missing' }, { status: 500 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, '')
    if (!url || !(serviceKey || anonKey)) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const { baseId, requesterEmail, requesterName } = (await request.json()) as {
      baseId?: string
      requesterEmail?: string
      requesterName?: string
    }

    if (!baseId || !requesterEmail || !requesterName) {
      return NextResponse.json({ error: 'Missing baseId, requesterEmail, or requesterName' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(requesterEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Service key bypasses RLS so we can fetch the base name and reply-to.
    // This route is reachable by anon (no auth required for public submit),
    // but it's still a server-only path. Treat the lookup as read-only.
    const sb = createClient(url, serviceKey || anonKey!)
    const { data: base } = await sb
      .from('bases')
      .select('name, amops_email')
      .eq('id', baseId)
      .single<{ name: string; amops_email: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    const fromLabel = `${base.name} AMOPS via Glidepath <info@glidepathops.com>`
    const safeName = escapeHtml(requesterName)
    const safeBase = escapeHtml(base.name)

    const { error } = await getResend().emails.send({
      from: fromLabel,
      to: requesterEmail,
      replyTo: base.amops_email || undefined,
      subject: `${base.name} PPR request received`,
      html: `
        <p>Hello ${safeName},</p>
        <p>${safeBase} Airfield Management Operations (AMOPS) has received your Prior Permission Required (PPR) request.</p>
        <p>Your request is now pending review. You will receive a separate email with your assigned PPR number once it is approved.
           If your request is denied or further information is needed, AMOPS will reach out to you directly.</p>
        ${base.amops_email ? `<p>Questions? Reply to this email or contact AMOPS at <a href="mailto:${escapeHtml(base.amops_email)}">${escapeHtml(base.amops_email)}</a>.</p>` : ''}
        <p style="color:#888;font-size:12px;">Sent from Glidepath Airfield Management.</p>
      `,
    })

    if (error) {
      console.error('[send-ppr-confirmation] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-ppr-confirmation] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
