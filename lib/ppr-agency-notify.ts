/**
 * Server-only helper. Sends outcome notification emails to every
 * member of every agency that had a coordination row on a PPR.
 *
 * Called from the three terminal-status email routes (approval,
 * denial, cancellation) so the coordinating agencies see what
 * happened to the PPR they signed off on, not just the requester.
 *
 * The fan-out mirrors `send-ppr-coordination-request`: one email
 * per agency, all that agency's members on the To line. Agencies
 * with no members are skipped silently and counted. PPRs that
 * never went through coordination (no coord rows — pre-coordinated,
 * manual-pending, public still-in-triage) trip the early return.
 *
 * Errors are logged and counted but do not throw — the call sites
 * are fire-and-forget after the requester email already landed.
 */

import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AgencyNotifyOutcome = 'approved' | 'denied' | 'canceled'

export type AgencyNotifyEntry = {
  id: string
  base_id: string
  ppr_number: string
  arrival_date: string
  requester_name: string | null
}

export type AgencyNotifyBase = {
  name: string
  amops_email: string | null
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function validReplyTo(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return undefined
  return trimmed
}

const OUTCOME_LABEL: Record<AgencyNotifyOutcome, string> = {
  approved: 'APPROVED',
  denied: 'DENIED',
  canceled: 'CANCELED',
}

const OUTCOME_ACCENT: Record<AgencyNotifyOutcome, { color: string; bg: string; border: string; subjectWord: string }> = {
  approved: { color: '#22c55e', bg: '#f0fdf4', border: '#22c55e', subjectWord: 'APPROVED' },
  denied:   { color: '#dc2626', bg: '#fef2f2', border: '#dc2626', subjectWord: 'DENIED' },
  canceled: { color: '#475569', bg: '#f1f5f9', border: '#94a3b8', subjectWord: 'CANCELED' },
}

export async function notifyCoordinatingAgencies(args: {
  reader: SupabaseClient
  resend: Resend
  entry: AgencyNotifyEntry
  base: AgencyNotifyBase
  outcome: AgencyNotifyOutcome
  reason?: string | null
}): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { reader, resend, entry, base, outcome, reason } = args

  // 1. Find every distinct agency that had a coord row on this entry.
  const { data: coordRows, error: coordErr } = await reader
    .from('ppr_coordination')
    .select('agency_id')
    .eq('entry_id', entry.id)
    .not('agency_id', 'is', null)

  if (coordErr) {
    console.error('[notifyCoordinatingAgencies] coord lookup failed:', coordErr.message)
    return { sent: 0, skipped: 0, reason: 'coord_lookup_failed' }
  }

  const agencyIds = Array.from(
    new Set(
      ((coordRows ?? []) as { agency_id: string | null }[])
        .map((r) => r.agency_id)
        .filter((v): v is string => Boolean(v)),
    ),
  )

  if (agencyIds.length === 0) {
    // No coordination ever happened — nothing to notify.
    return { sent: 0, skipped: 0, reason: 'no_coordinating_agencies' }
  }

  // 2. Resolve agency names (for subject + body) and members (for recipients).
  const { data: agencies } = await reader
    .from('ppr_agencies')
    .select('id, agency_name')
    .in('id', agencyIds)

  const agencyMap = new Map<string, string>(
    ((agencies ?? []) as { id: string; agency_name: string }[]).map((a) => [a.id, a.agency_name]),
  )

  // ppr_agency_members isn't in the generated types — same any-cast shape
  // the coord-request route uses.
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

  // 3. Build the per-email content. Subject + accent vary by outcome.
  // Deep links to glidepathops.com get quarantined by Defender for
  // Office 365 (DoD tenants). No CTA button — recipients log in to
  // Glidepath normally to see the updated state.
  const accent = OUTCOME_ACCENT[outcome]
  const outcomeWord = OUTCOME_LABEL[outcome]
  const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
  const replyTo = validReplyTo(base.amops_email)
  const safeBase = escapeHtml(base.name)
  const safePpr = escapeHtml(entry.ppr_number)
  const safeArrival = escapeHtml(entry.arrival_date)
  const safeRequester = escapeHtml(entry.requester_name || 'Internal request')

  const reasonBlock = (outcome === 'denied' || outcome === 'canceled') && reason && reason.trim()
    ? `
      <div style="margin-top:12px;padding:10px 14px;background:${accent.bg};border-left:4px solid ${accent.border};border-radius:4px;">
        <div style="font-size:11px;font-weight:700;color:${accent.color};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">
          Reason for ${outcome === 'denied' ? 'denial' : 'cancellation'}
        </div>
        <div style="font-size:14px;color:#222;white-space:pre-wrap;">${escapeHtml(reason)}</div>
      </div>`
    : ''

  // 4. Send one email per agency. Errors per-agency are logged + counted
  //    but never throw, since the requester email already succeeded.
  let sent = 0
  let skipped = 0

  for (const aid of agencyIds) {
    const recipients = recipientsByAgency.get(aid) ?? []
    const agencyName = agencyMap.get(aid) ?? 'Unknown agency'

    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    const safeAgency = escapeHtml(agencyName)

    const textBody = [
      `A Prior Permission Required (PPR) request at ${base.name} that ${agencyName} coordinated on has been ${outcomeWord.toLowerCase()}.`,
      '',
      `PPR number: ${entry.ppr_number}`,
      `Requester: ${entry.requester_name || 'Internal request'}`,
      `Arrival date: ${entry.arrival_date}`,
      (outcome === 'denied' || outcome === 'canceled') && reason?.trim()
        ? `\nReason for ${outcome === 'denied' ? 'denial' : 'cancellation'}: ${reason.trim()}`
        : '',
      '',
      `You're receiving this because you're listed as a coordinator for ${agencyName} at ${base.name}. Ask AMOPS or your base admin to update coordinators in Base Setup.`,
    ].filter((line) => line !== '').join('\n')

    try {
      const { error } = await resend.emails.send({
        from: fromLabel,
        to: recipients,
        replyTo,
        cc: replyTo ? [replyTo] : undefined,
        subject: `${base.name} PPR ${outcomeWord} — ${entry.ppr_number} (${agencyName})`,
        html: `
          <p>A Prior Permission Required (PPR) request at ${safeBase} that <strong>${safeAgency}</strong> coordinated on has been <strong style="color:${accent.color};">${outcomeWord.toLowerCase()}</strong>.</p>
          <p><strong>PPR number:</strong> <span style="font-family:monospace;">${safePpr}</span></p>
          <p><strong>Requester:</strong> ${safeRequester}</p>
          <p><strong>Arrival date:</strong> ${safeArrival}</p>
          ${reasonBlock}
          <p style="color:#888;font-size:12px;margin-top:18px;">
            You're receiving this because you're listed as a coordinator for <strong>${safeAgency}</strong> at <strong>${safeBase}</strong>.
            Ask AMOPS or your base admin to update coordinators in Base Setup.
          </p>
        `,
        text: textBody,
      })

      if (error) {
        console.error(`[notifyCoordinatingAgencies] Resend error for agency ${aid} (${outcome}):`, error.message)
        skipped += 1
        continue
      }
      sent += 1
    } catch (e) {
      console.error(`[notifyCoordinatingAgencies] send threw for agency ${aid} (${outcome}):`, e)
      skipped += 1
    }
  }

  return { sent, skipped }
}
