export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { checkRateLimits, getClientIp } from '@/lib/rate-limit'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Returns a Resend-safe replyTo string, or undefined if the input
 * doesn't look like an email. Resend rejects the entire send with a
 * 422 if replyTo is malformed, so any garbage in `bases.amops_email`
 * (whitespace, typo, leftover newline) takes down the whole email.
 * Be permissive on the regex — Resend itself does the strict check.
 */
function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
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

    // Throttle abuse — this fires a branded email to an arbitrary
    // requesterEmail after a public submit, with no auth. Generous limits so
    // a legitimate single submit is never blocked. Fails open if the limiter
    // errors, so a confirmation email is never lost to a limiter hiccup.
    const ip = getClientIp(request)
    const allowed = await checkRateLimits(sb, [
      { bucket: `ppr-confirm:email:${requesterEmail.toLowerCase()}`, max: 5, windowSeconds: 3600 },
      { bucket: `ppr-confirm:ip:${ip}`, max: 20, windowSeconds: 3600 },
    ])
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    const { data: base } = await sb
      .from('bases')
      .select('name, amops_email')
      .eq('id', baseId)
      .single<{ name: string; amops_email: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Fetch info_only columns flagged for the public form so the
    // requester sees airfield hours, restrictions, etc. inline in
    // the confirmation email. show_on_form replaced is_public in
    // migration 2026042905_ppr_per_surface_flags.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: infoCols } = await (sb as any)
      .from('ppr_columns')
      .select('column_name, info_text, sort_order')
      .eq('base_id', baseId)
      .eq('column_type', 'info_only')
      .eq('show_on_form', true)
      .order('sort_order', { ascending: true })

    const infoHtml = ((infoCols ?? []) as { column_name: string; info_text: string | null }[])
      .filter(c => (c.info_text || '').trim())
      .map(c => `
        <div style="margin-top:12px;padding:10px 14px;background:#f4f4f4;border-radius:6px;">
          <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
            ${escapeHtml(c.column_name)}
          </div>
          <div style="font-size:14px;color:#222;white-space:pre-wrap;">${escapeHtml(c.info_text!)}</div>
        </div>
      `)
      .join('')

    const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
    const safeName = escapeHtml(requesterName)
    const safeBase = escapeHtml(base.name)
    const replyTo = validReplyTo(base.amops_email)

    const { error } = await getResend().emails.send({
      from: fromLabel,
      to: requesterEmail,
      replyTo,
      cc: replyTo ? [replyTo] : undefined,
      subject: `${base.name} PPR request received`,
      html: `
        <p>Hello ${safeName},</p>
        <p>${safeBase} Airfield Management Operations (AMOPS) has received your Prior Permission Required (PPR) request.</p>
        <p>Your request is now pending review. You will receive a separate email with your assigned PPR number once it is approved.
           If your request is denied or further information is needed, AMOPS will reach out to you directly.</p>
        ${infoHtml}
        ${replyTo ? `<p>Contact AMOPS at <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a> with any questions or concerns.</p>` : ''}
        <p style="color:#888;font-size:12px;">Do not reply to this email — replies are unmonitored.</p>
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
