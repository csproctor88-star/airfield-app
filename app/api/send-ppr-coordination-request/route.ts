export const maxDuration = 30

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { formatPprColumnValue } from '@/lib/supabase/ppr'
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
 *  doesn't kill the email. */
function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

/** Case-insensitive de-dupe so a coordinator who is both a Glidepath
 *  member and a manually-added external email is only emailed once. */
function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of emails) {
    const k = e.trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(e.trim())
  }
  return out
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

    const { entryId, agencyIds, reminder } = (await request.json()) as {
      entryId?: string
      agencyIds?: string[]
      reminder?: boolean
    }
    if (!entryId || !Array.isArray(agencyIds) || agencyIds.length === 0) {
      return NextResponse.json({ error: 'Missing entryId or agencyIds' }, { status: 400 })
    }

    const reader = serviceKey ? createServiceClient(url, serviceKey) : sb

    const { data: entry, error: entryErr } = await reader
      .from('ppr_entries')
      .select('id, base_id, ppr_number, requester_name, requester_email, requester_phone, arrival_date, column_values, notes')
      .eq('id', entryId)
      .single<{
        id: string
        base_id: string
        ppr_number: string
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

    // AUTHORIZATION (H-1): entry read via service role (RLS bypass) — gate on
    // ppr:triage (the permission triagePprEntry requires) plus base access, so
    // this agency-blast can't be fired by a read-only / kiosk account.
    const authorized = await callerCanActOnPpr(reader, user.id, entry.base_id, PPR_EMAIL_PERMS.coordinationRequest)
    if (!authorized) {
      return NextResponse.json({ error: 'You do not have permission to send this PPR notification.' }, { status: 403 })
    }
    const withinLimits = await checkRateLimits(reader, [
      { bucket: `ppr-email:user:${user.id}`, max: 60, windowSeconds: 300 },
      { bucket: `ppr-email:entry:${entry.id}`, max: 12, windowSeconds: 3600 },
    ])
    if (!withinLimits) {
      return NextResponse.json({ error: 'Too many PPR notifications sent — please wait a moment and try again.' }, { status: 429 })
    }

    const { data: base } = await reader
      .from('bases')
      .select('name, amops_email')
      .eq('id', entry.base_id)
      .single<{ name: string; amops_email: string | null }>()
    if (!base) {
      return NextResponse.json({ error: 'Base not found' }, { status: 404 })
    }

    // Column labels for the body. column_type is needed so time
    // columns render as HHMM Z (matching the in-app slim Log + the
    // PDF), not the raw stored "15:00" or "1500".
    const { data: columns } = await reader
      .from('ppr_columns')
      .select('id, column_name, column_type, sort_order')
      .eq('base_id', entry.base_id)
      .order('sort_order', { ascending: true })
    const colRows: { id: string; column_name: string; column_type: string }[] =
      ((columns ?? []) as { id: string; column_name: string; column_type: string }[]) || []

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

    // Union manually-added external emails (recipients with no Glidepath account).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: extEmails } = await (reader as any)
      .from('ppr_agency_emails')
      .select('agency_id, email')
      .in('agency_id', agencyIds)
    for (const row of (extEmails || []) as { agency_id: string; email: string | null }[]) {
      const email = (row.email || '').trim()
      if (!email) continue
      const list = recipientsByAgency.get(row.agency_id) ?? []
      list.push(email)
      recipientsByAgency.set(row.agency_id, list)
    }

    const valuesHtml = colRows
      .map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = formatPprColumnValue(c as any, (entry.column_values || {})[c.id])
        if (!v) return null
        return `<tr><td style="padding:4px 10px;color:#666;">${escapeHtml(c.column_name)}</td><td style="padding:4px 10px;font-weight:600;">${escapeHtml(v)}</td></tr>`
      })
      .filter(Boolean)
      .join('')

    const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
    const safeBase = escapeHtml(base.name)
    const replyTo = validReplyTo(base.amops_email)
    const safePpr = escapeHtml(entry.ppr_number)
    const safeArrival = escapeHtml(entry.arrival_date)
    const safeRequester = escapeHtml(
      [entry.requester_name, entry.requester_email, entry.requester_phone].filter(Boolean).join(' — ') || 'Internal request',
    )

    // Deep links to glidepathops.com get quarantined by Defender for
    // Office 365 (used by most DoD tenants) because the domain isn't on
    // the recipient's Safe Links allowlist. Strip the CTA button and
    // direct recipients to log in normally. The sidebar pending-count
    // badge surfaces the new coord row on next sign-in.

    const sent: { agency_id: string; recipient_count: number }[] = []
    const skipped: { agency_id: string; reason: string }[] = []

    for (const aid of agencyIds) {
      const recipients = dedupeEmails(recipientsByAgency.get(aid) ?? [])
      const agencyName = agencyMap.get(aid) ?? 'Unknown agency'
      if (recipients.length === 0) {
        skipped.push({ agency_id: aid, reason: 'no_coordinators' })
        continue
      }

      const safeAgency = escapeHtml(agencyName)

      // Build text/plain alternative for better deliverability scoring.
      // Mirrors the html body without markup.
      const textValues = colRows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c) => ({ name: c.column_name, value: formatPprColumnValue(c as any, (entry.column_values || {})[c.id]) }))
        .filter((row) => row.value)
        .map((row) => `${row.name}: ${row.value}`)
        .join('\n')

      const introText = reminder
        ? `Reminder: a Prior Permission Required (PPR) request at ${base.name} is still awaiting coordination from ${agencyName}. Please review and respond.`
        : `A Prior Permission Required (PPR) request at ${base.name} has been routed to ${agencyName} for coordination.`

      const textBody = [
        introText,
        '',
        `PPR number: ${entry.ppr_number}`,
        `Requester: ${entry.requester_name || entry.requester_email || 'Internal request'}`,
        `Arrival date: ${entry.arrival_date}`,
        textValues,
        entry.notes ? `\nNotes: ${entry.notes}` : '',
        '',
        'Sign in to Glidepath and open the PPR module to review and respond.',
        '',
        `You're receiving this because you're listed as a coordinator for ${agencyName} at ${base.name}. Ask AMOPS or your base admin to update coordinators in Base Setup.`,
      ].filter((line) => line !== '').join('\n')

      const { error } = await getResend().emails.send({
        from: fromLabel,
        to: recipients,
        replyTo,
        cc: replyTo ? [replyTo] : undefined,
        subject: reminder
          ? `${base.name} PPR — coordination still needed (${agencyName})`
          : `${base.name} PPR coordination requested — ${agencyName}`,
        html: `
          ${reminder
            ? `<p><strong>Reminder:</strong> a Prior Permission Required (PPR) request at ${safeBase} is still awaiting coordination from <strong>${safeAgency}</strong>. Please review and respond.</p>`
            : `<p>A Prior Permission Required (PPR) request at ${safeBase} has been routed to <strong>${safeAgency}</strong> for coordination.</p>`}
          <p><strong>PPR number:</strong> <span style="font-family:monospace;">${safePpr}</span></p>
          <p><strong>Requester:</strong> ${safeRequester}</p>
          <p><strong>Arrival date:</strong> ${safeArrival}</p>
          ${valuesHtml ? `<table style="border-collapse:collapse;margin-top:8px;">${valuesHtml}</table>` : ''}
          ${entry.notes ? `<p><strong>Notes:</strong> ${escapeHtml(entry.notes)}</p>` : ''}
          <p>Sign in to Glidepath and open the PPR module to review and respond.</p>
          <p style="color:#888;font-size:12px;">
            You're receiving this because you're listed as a coordinator for <strong>${safeAgency}</strong> at <strong>${safeBase}</strong>.
            Ask AMOPS or your base admin to update coordinators in Base Setup.
          </p>
        `,
        text: textBody,
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
