export const maxDuration = 30

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
 *  doesn't kill the email. */
function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

/**
 * Coordination-request email — fired by triagePprEntry when a PPR is
 * routed to a set of agencies. Authenticated; any user with
 * `ppr:triage` can trigger. One email per agency is sent to the
 * coordinators on that agency. Agencies with no members are skipped
 * silently and reported back in the response so the caller can warn.
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

    const { entryId, agencyIds } = (await request.json()) as {
      entryId?: string
      agencyIds?: string[]
    }
    if (!entryId || !Array.isArray(agencyIds) || agencyIds.length === 0) {
      return NextResponse.json({ error: 'Missing entryId or agencyIds' }, { status: 400 })
    }

    const reader = serviceKey ? createServiceClient(url, serviceKey) : sb

    const { data: entry, error: entryErr } = await reader
      .from('ppr_entries')
      .select('id, base_id, ppr_number, requester_name, requester_email, requester_phone, arrival_date, arrival_eta_zulu, column_values, notes')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
        requester_name: string | null
        requester_email: string | null
        requester_phone: string | null
        arrival_date: string
        arrival_eta_zulu: string | null
        column_values: Record<string, string> | null
        notes: string | null
      }>()

    if (entryErr || !entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null }>()
    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Column labels for the body.
    const { data: columns } = await reader
      .from('ppr_columns')
      .select('id, column_name, sort_order')
      .eq('base_id', entry.base_id)
      .order('sort_order', { ascending: true })
    const colRows: { id: string; column_name: string }[] =
      ((columns ?? []) as { id: string; column_name: string }[]) || []

    // Agency labels for subject lines.
    const { data: agencies } = await reader
      .from('ppr_agencies')
      .select('id, agency_name')
      .in('id', agencyIds)
    const agencyMap = new Map<string, string>(
      ((agencies ?? []) as { id: string; agency_name: string }[]).map((a) => [a.id, a.agency_name]),
    )

    // Members per agency. ppr_agency_members isn't in the generated
    // types — drop to any cast on the query builder.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members } = await (reader as any)
      .from('ppr_agency_members')
      .select('agency_id, profiles:user_id(email)')
      .in('agency_id', agencyIds)

    const recipientsByAgency = new Map<string, string[]>()
    for (const row of (members || []) as Record<string, unknown>[]) {
      const aid = row.agency_id as string
      const email = (row.profiles as { email?: string } | null)?.email
      if (!email) continue
      const list = recipientsByAgency.get(aid) ?? []
      list.push(email)
      recipientsByAgency.set(aid, list)
    }

    const valuesHtml = colRows
      .map((c) => {
        const v = (entry.column_values || {})[c.id]
        if (!v) return null
        return `<tr><td style="padding:4px 10px;color:#666;">${escapeHtml(c.column_name)}</td><td style="padding:4px 10px;font-weight:600;">${escapeHtml(String(v))}</td></tr>`
      })
      .filter(Boolean)
      .join('')

    const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
    const safeBase = escapeHtml(base.name)
    const replyTo = validReplyTo(base.amops_email)
    const safePpr = escapeHtml(entry.ppr_number)
    const safeArrival = escapeHtml(
      entry.arrival_eta_zulu
        ? `${entry.arrival_date} · ${entry.arrival_eta_zulu.replace(':', '')}Z`
        : entry.arrival_date,
    )
    const safeRequester = escapeHtml(
      [entry.requester_name, entry.requester_email, entry.requester_phone].filter(Boolean).join(' — ') || 'Internal request',
    )

    // Drive-by Glidepath link — leave it deep-linkable to /ppr only;
    // we don't expose per-entry deep links yet.
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://glidepathops.com').replace(/\/$/, '')

    const sent: { agency_id: string; recipient_count: number }[] = []
    const skipped: { agency_id: string; reason: string }[] = []

    for (const aid of agencyIds) {
      const recipients = recipientsByAgency.get(aid) ?? []
      const agencyName = agencyMap.get(aid) ?? 'Unknown agency'
      if (recipients.length === 0) {
        skipped.push({ agency_id: aid, reason: 'no_coordinators' })
        continue
      }

      const safeAgency = escapeHtml(agencyName)
      const { error } = await getResend().emails.send({
        from: fromLabel,
        to: recipients,
        replyTo,
        subject: `${base.name} PPR coordination requested — ${agencyName}`,
        html: `
          <p>A Prior Permission Required (PPR) request at ${safeBase} has been routed to <strong>${safeAgency}</strong> for coordination.</p>
          <p style="font-size:16px;background:#f4f4f4;padding:10px 14px;border-radius:6px;">
            <span style="color:#666;font-size:12px;display:block;">PPR NUMBER</span>
            <strong style="font-family:monospace;">${safePpr}</strong>
          </p>
          <p><strong>Requester:</strong> ${safeRequester}</p>
          <p><strong>Arrival date:</strong> ${safeArrival}</p>
          ${valuesHtml ? `<table style="border-collapse:collapse;margin-top:8px;">${valuesHtml}</table>` : ''}
          ${entry.notes ? `<p><strong>Notes:</strong> ${escapeHtml(entry.notes)}</p>` : ''}
          <p style="margin-top:18px;">
            <a href="${appUrl}/ppr" style="display:inline-block;padding:10px 18px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Review the PPR</a>
          </p>
          <p style="color:#888;font-size:12px;margin-top:18px;">
            You're receiving this because you're listed as a coordinator for <strong>${safeAgency}</strong> at <strong>${safeBase}</strong>.
            Ask AMOPS or your base admin to update coordinators in Base Setup.
          </p>
          <p style="color:#888;font-size:12px;">Do not reply to this email — replies are unmonitored.</p>
        `,
      })

      if (error) {
        console.error(`[send-ppr-coordination-request] Resend error for agency ${aid}:`, error)
        skipped.push({ agency_id: aid, reason: error.message })
        continue
      }
      sent.push({ agency_id: aid, recipient_count: recipients.length })
    }

    return NextResponse.json({ success: true, sent, skipped })
  } catch (err) {
    console.error('[send-ppr-coordination-request] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected server error' },
      { status: 500 },
    )
  }
}
