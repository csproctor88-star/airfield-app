export const maxDuration = 15

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { formatPprColumnValue, isSummaryColumn } from '@/lib/supabase/ppr'
import { notifyCoordinatingAgencies, notifyInfoOnlyRecipients } from '@/lib/ppr-agency-notify'
import { buildPprInvite } from '@/lib/ppr-ics'
import { callerCanActOnPpr, PPR_EMAIL_PERMS } from '@/lib/ppr-authorize'
import { checkRateLimits } from '@/lib/rate-limit'

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
      .select('id, base_id, ppr_number, status, requester_name, requester_email, requester_phone, arrival_date, column_values, notes')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
        status: string
        requester_name: string | null
        requester_email: string | null
        requester_phone: string | null
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

    // AUTHORIZATION (H-1): the entry was read with the service-role client
    // (RLS bypass), so gate explicitly on the same permission + base access
    // the in-app Approve action requires. Without this, any authenticated
    // account (read-only, kiosk) could trigger this send for any entry id.
    const authorized = await callerCanActOnPpr(reader, user.id, entry.base_id, PPR_EMAIL_PERMS.approval)
    if (!authorized) {
      return NextResponse.json({ error: 'You do not have permission to send this PPR notification.' }, { status: 403 })
    }
    // Defense-in-depth: cap how fast an authorized account can loop the send.
    const withinLimits = await checkRateLimits(reader, [
      { bucket: `ppr-email:user:${user.id}`, max: 60, windowSeconds: 300 },
      { bucket: `ppr-email:entry:${entry.id}`, max: 12, windowSeconds: 3600 },
    ])
    if (!withinLimits) {
      return NextResponse.json({ error: 'Too many PPR notifications sent — please wait a moment and try again.' }, { status: 429 })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email, icao')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null; icao: string | null }>()

    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Columns drive both the requester email body and the calendar-invite
    // descriptor — fetched once regardless of whether there's a public
    // requester (internal PPRs still notify coordinating agencies, and an
    // opted-in group can want the invite even for an internal PPR).
    const { data: columns } = await reader
      .from('ppr_columns')
      .select('id, column_name, column_type, info_text, sort_order')
      .eq('base_id', entry.base_id)
      .order('sort_order', { ascending: true })

    const colRows: { id: string; column_name: string; column_type: string; info_text: string | null }[] =
      ((columns ?? []) as { id: string; column_name: string; column_type: string; info_text: string | null }[]) || []

    // Calendar invites, built once. Guarded — a build failure must never
    // block the emails. REQUEST (Accept/Decline, requester = attendee) →
    // the requester's email; PUBLISH (add-to-calendar, no attendee) →
    // opted-in coordinating groups via notifyCoordinatingAgencies.
    const descriptor = colRows
      .filter((c) => isSummaryColumn(c.column_name))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c) => formatPprColumnValue(c as any, (entry.column_values || {})[c.id]))
      .filter(Boolean)
      .join(' • ') || (entry.requester_name ?? 'Transient aircraft')
    let requesterInvite: { filename: string; content: Buffer; contentType: string } | undefined
    let agencyInvite: { filename: string; content: Buffer; contentType: string } | undefined
    try {
      // Full PPR detail for the event body — mirrors the email content so
      // the calendar item shows everything: arrival date, requester
      // contact, and every column value (formatted like the slim Log / PDF).
      const inviteDetails: { label: string; value: string }[] = [
        { label: 'Arrival date', value: entry.arrival_date },
      ]
      const requesterLine = [entry.requester_name, entry.requester_email, entry.requester_phone]
        .filter(Boolean).join(' — ')
      if (requesterLine) inviteDetails.push({ label: 'Requester', value: requesterLine })
      for (const c of colRows.filter((c) => c.column_type !== 'info_only')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = formatPprColumnValue(c as any, (entry.column_values || {})[c.id])
        if (v) inviteDetails.push({ label: c.column_name, value: v })
      }

      const common = {
        entryId: entry.id, pprNumber: entry.ppr_number, baseName: base.name,
        baseIcao: base.icao, arrivalDate: entry.arrival_date, summary: descriptor,
        requesterName: entry.requester_name, organizerEmail: 'info@glidepathops.com',
        amopsEmail: base.amops_email, notes: entry.notes, dtstamp: new Date(),
        details: inviteDetails,
      }
      if (entry.requester_email) {
        const inv = buildPprInvite({ ...common, requesterEmail: entry.requester_email, method: 'REQUEST' })
        requesterInvite = { filename: inv.filename, content: inv.content, contentType: inv.contentType }
      }
      const pub = buildPprInvite({ ...common, method: 'PUBLISH' })
      agencyInvite = { filename: pub.filename, content: pub.content, contentType: pub.contentType }
    } catch (e) {
      console.error('[send-ppr-approval] invite build failed:', e)
    }

    // Internal-create PPRs (no public requester) skip the requester email
    // but STILL notify the coordinating agencies below.
    if (entry.requester_email) {

    const valuesHtml = colRows
      .filter((c) => c.column_type !== 'info_only')
      .map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = formatPprColumnValue(c as any, (entry.column_values || {})[c.id])
        if (!v) return null
        return `<tr><td style="padding:4px 10px;color:#666;">${escapeHtml(c.column_name)}</td><td style="padding:4px 10px;font-weight:600;">${escapeHtml(v)}</td></tr>`
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
      cc: replyTo ? [replyTo] : undefined,
      attachments: requesterInvite ? [requesterInvite] : undefined,
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
    }

    // Best-effort: also notify every agency that coordinated on this PPR.
    // Fire-and-forget after the requester email — agency failures shouldn't
    // surface as a route-level error since the primary recipient was emailed.
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
      outcome: 'approved',
      inviteAttachment: agencyInvite,
    })

    // Best-effort: blast the approval email to info-only recipient groups
    // (ppr_agencies.notify_only) — standing distribution, not coordinators.
    const infoOnlyResult = await notifyInfoOnlyRecipients({
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
      inviteAttachment: agencyInvite,
    })

    return NextResponse.json({ success: true, agencies: agencyResult, infoOnly: infoOnlyResult })
  } catch (err) {
    console.error('[send-ppr-approval] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
