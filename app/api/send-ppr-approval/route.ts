export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

let _resend: Resend | null = null
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Resend rejects sends entirely on a malformed replyTo. Trim and
 *  do a permissive shape check so any garbage in bases.amops_email
 *  (whitespace, typo, leftover newline) doesn't kill the email. */
function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

/**
 * Approval email — sent to the public requester once a PPR is approved.
 * Authenticated route — any user with `ppr:approve` (AFM, NAMO, AMOPS,
 * base_admin, sys_admin) can trigger. Looks up the entry by id, validates
 * status='approved', then sends a Resend email from "{Base} AMOPS via
 * Glidepath" with the PPR number, requester's column data, and a reply-to
 * set to the base's amops_email if configured. The "AMOPS" in the from
 * line is the office name, not the role of whoever clicked Approve.
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

    // Authenticate caller via cookie session.
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

    // Service-role read so we can pull the entry + base regardless of RLS,
    // since this is invoked just after the approve mutation lands.
    const reader = serviceKey ? createServiceClient(url, serviceKey) : sb
    const { data: entry, error: entryErr } = await reader
      .from('ppr_entries')
      .select('id, base_id, ppr_number, status, requester_name, requester_email, arrival_date, column_values, notes')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
        status: string
        requester_name: string | null
        requester_email: string | null
        arrival_date: string
        column_values: Record<string, string> | null
        notes: string | null
      }>()

    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
    if (entry.status !== 'approved') {
      return NextResponse.json({ error: `Entry status is ${entry.status}, not approved` }, { status: 400 })
    }
    if (!entry.requester_email) {
      // Internal create: no public requester to email. Treat as no-op success.
      return NextResponse.json({ success: true, skipped: 'no_requester_email' })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Pull human-readable column names for the email body. We fetch
    // column_type + info_text so we can split the rendering: regular
    // columns get the value table, info_only columns get rendered as
    // their own boxed section so the requester sees airfield hours,
    // restrictions, etc. on the approval too.
    const { data: columns } = await reader
      .from('ppr_columns')
      .select('id, column_name, column_type, info_text, sort_order')
      .eq('base_id', entry.base_id)
      .order('sort_order', { ascending: true })

    const colRows: { id: string; column_name: string; column_type: string; info_text: string | null }[] =
      ((columns ?? []) as { id: string; column_name: string; column_type: string; info_text: string | null }[]) || []

    const valuesHtml = colRows
      .filter((c) => c.column_type !== 'info_only')
      .map((c) => {
        const v = (entry.column_values || {})[c.id]
        if (!v) return null
        return `<tr><td style="padding:4px 10px;color:#666;">${escapeHtml(c.column_name)}</td><td style="padding:4px 10px;font-weight:600;">${escapeHtml(String(v))}</td></tr>`
      })
      .filter(Boolean)
      .join('')

    const infoHtml = colRows
      .filter((c) => c.column_type === 'info_only' && (c.info_text || '').trim())
      .map((c) => `
        <div style="margin-top:12px;padding:10px 14px;background:#f4f4f4;border-radius:6px;">
          <div style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
            ${escapeHtml(c.column_name)}
          </div>
          <div style="font-size:14px;color:#222;white-space:pre-wrap;">${escapeHtml(c.info_text!)}</div>
        </div>
      `)
      .join('')

    const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
    const safeName = escapeHtml(entry.requester_name || 'Aircrew')
    const safeBase = escapeHtml(base.name)
    const safePpr = escapeHtml(entry.ppr_number)
    const safeArrival = escapeHtml(entry.arrival_date)
    const replyTo = validReplyTo(base.amops_email)

    const { error } = await getResend().emails.send({
      from: fromLabel,
      to: entry.requester_email,
      replyTo,
      subject: `${base.name} PPR APPROVED — ${entry.ppr_number}`,
      html: `
        <p>Hello ${safeName},</p>
        <p>Your Prior Permission Required (PPR) request to ${safeBase} has been <strong style="color:#22c55e;">approved</strong>.</p>
        <p style="font-size:18px;background:#f4f4f4;padding:10px 14px;border-radius:6px;">
          <span style="color:#666;font-size:12px;display:block;">PPR NUMBER</span>
          <strong style="font-family:monospace;">${safePpr}</strong>
        </p>
        <p><strong>Arrival date:</strong> ${safeArrival}</p>
        ${valuesHtml ? `<table style="border-collapse:collapse;margin-top:8px;">${valuesHtml}</table>` : ''}
        ${entry.notes ? `<p><strong>Notes:</strong> ${escapeHtml(entry.notes)}</p>` : ''}
        ${infoHtml}
        ${replyTo
          ? `<p>Contact AMOPS at <a href="mailto:${escapeHtml(replyTo)}">${escapeHtml(replyTo)}</a> with any questions or concerns.</p>`
          : ''}
        <p style="color:#888;font-size:12px;">Do not reply to this email — replies are unmonitored.</p>
      `,
    })

    if (error) {
      console.error('[send-ppr-approval] Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[send-ppr-approval] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
