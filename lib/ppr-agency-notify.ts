/**
 * Server-only helper. Sends notification emails to every member of every
 * agency that coordinated on a PPR.
 *
 * Used for the three terminal-status routes (approval, denial, cancellation)
 * so coordinating agencies see what happened to the PPR they signed off on,
 * and for the `updated` outcome (send-ppr-update) so they get the latest
 * details when AMOPS edits a PPR after coordination — informational only, not
 * a re-coordination.
 *
 * The fan-out mirrors `send-ppr-coordination-request`: one email per agency,
 * all that agency's members on the To line. Agencies with no members are
 * skipped silently and counted. For the terminal outcomes the agency set is
 * derived from the coordination rows; for `updated` the caller passes the
 * specific `agencyIds` AMOPS chose in the send dialog.
 *
 * Errors are logged and counted but never throw — call sites are fire-and-
 * forget after the user's own action already succeeded.
 *
 * NOTE: email HTML uses literal hex colors on purpose — recipient mail clients
 * can't resolve CSS variables, so emails (like PDFs) stay theme-independent.
 */

import type { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PprChange } from '@/lib/ppr-changes'

export type AgencyNotifyOutcome = 'approved' | 'denied' | 'canceled' | 'updated'

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
  updated: 'UPDATED',
}

const OUTCOME_ACCENT: Record<AgencyNotifyOutcome, { color: string; bg: string; border: string }> = {
  approved: { color: '#22c55e', bg: '#f0fdf4', border: '#22c55e' },
  denied:   { color: '#dc2626', bg: '#fef2f2', border: '#dc2626' },
  canceled: { color: '#475569', bg: '#f1f5f9', border: '#94a3b8' },
  updated:  { color: '#2563eb', bg: '#eff6ff', border: '#3b82f6' },
}

const blank = (s: string) => (s && s.length ? s : '(blank)')

/**
 * Pure builder for a single coordinating-agency email. Returns subject + HTML +
 * plain-text. No I/O, so it's unit-testable. Deep links are intentionally
 * omitted (Defender for Office 365 / .mil Safe Links quarantine).
 */
export function buildAgencyEmail(args: {
  base: AgencyNotifyBase
  entry: AgencyNotifyEntry
  agencyName: string
  outcome: AgencyNotifyOutcome
  reason?: string | null
  changes?: PprChange[]
  currentDetails?: { label: string; value: string }[]
}): { subject: string; html: string; text: string } {
  const { base, entry, agencyName, outcome, reason, changes, currentDetails } = args
  const accent = OUTCOME_ACCENT[outcome]
  const outcomeWord = OUTCOME_LABEL[outcome]
  const safeBase = escapeHtml(base.name)
  const safePpr = escapeHtml(entry.ppr_number)
  const safeArrival = escapeHtml(entry.arrival_date)
  const safeRequester = escapeHtml(entry.requester_name || 'Internal request')
  const safeAgency = escapeHtml(agencyName)

  const subject = `${base.name} PPR ${outcomeWord} — ${entry.ppr_number} (${agencyName})`

  const introText = outcome === 'updated'
    ? `A Prior Permission Required (PPR) request at ${base.name} that ${agencyName} coordinated on has been updated by AMOPS. This is for your awareness — no action needed.`
    : `A Prior Permission Required (PPR) request at ${base.name} that ${agencyName} coordinated on has been ${outcomeWord.toLowerCase()}.`
  const introHtml = outcome === 'updated'
    ? `<p>A Prior Permission Required (PPR) request at ${safeBase} that <strong>${safeAgency}</strong> coordinated on has been <strong style="color:${accent.color};">updated</strong> by AMOPS. This is for your awareness — no action needed.</p>`
    : `<p>A Prior Permission Required (PPR) request at ${safeBase} that <strong>${safeAgency}</strong> coordinated on has been <strong style="color:${accent.color};">${outcomeWord.toLowerCase()}</strong>.</p>`

  const reasonText = (outcome === 'denied' || outcome === 'canceled') && reason?.trim()
    ? `\nReason for ${outcome === 'denied' ? 'denial' : 'cancellation'}: ${reason.trim()}`
    : ''
  const reasonHtml = (outcome === 'denied' || outcome === 'canceled') && reason?.trim()
    ? `<div style="margin-top:12px;padding:10px 14px;background:${accent.bg};border-left:4px solid ${accent.border};border-radius:4px;">
        <div style="font-size:11px;font-weight:700;color:${accent.color};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Reason for ${outcome === 'denied' ? 'denial' : 'cancellation'}</div>
        <div style="font-size:14px;color:#222;white-space:pre-wrap;">${escapeHtml(reason.trim())}</div>
      </div>`
    : ''

  const hasChanges = outcome === 'updated' && changes && changes.length > 0
  const changesText = hasChanges
    ? '\nWhat changed:\n' + changes!.map((c) => `  • ${c.label}: ${blank(c.from)} → ${blank(c.to)}`).join('\n')
    : ''
  const changesHtml = hasChanges
    ? `<div style="margin-top:12px;padding:10px 14px;background:${accent.bg};border-left:4px solid ${accent.border};border-radius:4px;">
        <div style="font-size:11px;font-weight:700;color:${accent.color};text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">What changed</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;color:#222;">${changes!.map((c) => `<li><strong>${escapeHtml(c.label)}:</strong> ${escapeHtml(blank(c.from))} &rarr; ${escapeHtml(blank(c.to))}</li>`).join('')}</ul>
      </div>`
    : ''

  const hasDetails = currentDetails && currentDetails.length > 0
  const detailsText = hasDetails
    ? '\nCurrent request details:\n' + currentDetails!.map((d) => `  ${d.label}: ${d.value}`).join('\n')
    : ''
  const detailsHtml = hasDetails
    ? `<div style="margin-top:12px;">
        <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">Current request details</div>
        <table style="font-size:14px;color:#222;border-collapse:collapse;">${currentDetails!.map((d) => `<tr><td style="padding:2px 12px 2px 0;color:#555;">${escapeHtml(d.label)}</td><td style="padding:2px 0;">${escapeHtml(d.value)}</td></tr>`).join('')}</table>
      </div>`
    : ''

  const text = [
    introText,
    '',
    `PPR number: ${entry.ppr_number}`,
    `Requester: ${entry.requester_name || 'Internal request'}`,
    `Arrival date: ${entry.arrival_date}`,
    reasonText,
    changesText,
    detailsText,
    '',
    `You're receiving this because you're listed as a coordinator for ${agencyName} at ${base.name}. Ask AMOPS or your base admin to update coordinators in Base Setup.`,
  ].filter((line) => line !== '').join('\n')

  const html = `
    ${introHtml}
    <p><strong>PPR number:</strong> <span style="font-family:monospace;">${safePpr}</span></p>
    <p><strong>Requester:</strong> ${safeRequester}</p>
    <p><strong>Arrival date:</strong> ${safeArrival}</p>
    ${reasonHtml}
    ${changesHtml}
    ${detailsHtml}
    <p style="color:#888;font-size:12px;margin-top:18px;">
      You're receiving this because you're listed as a coordinator for <strong>${safeAgency}</strong> at <strong>${safeBase}</strong>.
      Ask AMOPS or your base admin to update coordinators in Base Setup.
    </p>
  `

  return { subject, html, text }
}

export async function notifyCoordinatingAgencies(args: {
  reader: SupabaseClient
  resend: Resend
  entry: AgencyNotifyEntry
  base: AgencyNotifyBase
  outcome: AgencyNotifyOutcome
  reason?: string | null
  /** For `updated`: render the before→after change summary. */
  changes?: PprChange[]
  /** For `updated`: render the full current request details. */
  currentDetails?: { label: string; value: string }[]
  /** When provided (non-empty), scope recipients to these agencies instead of
   *  deriving from the entry's coordination rows. Used by send-ppr-update. */
  agencyIds?: string[]
}): Promise<{ sent: number; skipped: number; reason?: string }> {
  const { reader, resend, entry, base, outcome, reason, changes, currentDetails } = args

  // 1. Determine the agency set: explicit (update dialog) or derived from coord rows.
  let agencyIds: string[]
  if (args.agencyIds && args.agencyIds.length > 0) {
    agencyIds = Array.from(new Set(args.agencyIds.filter(Boolean)))
  } else {
    const { data: coordRows, error: coordErr } = await reader
      .from('ppr_coordination')
      .select('agency_id')
      .eq('entry_id', entry.id)
      .not('agency_id', 'is', null)

    if (coordErr) {
      console.error('[notifyCoordinatingAgencies] coord lookup failed:', coordErr.message)
      return { sent: 0, skipped: 0, reason: 'coord_lookup_failed' }
    }
    agencyIds = Array.from(
      new Set(
        ((coordRows ?? []) as { agency_id: string | null }[])
          .map((r) => r.agency_id)
          .filter((v): v is string => Boolean(v)),
      ),
    )
  }

  if (agencyIds.length === 0) {
    return { sent: 0, skipped: 0, reason: 'no_coordinating_agencies' }
  }

  // 2. Resolve agency names (subject/body) and members (recipients).
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

  const fromLabel = `${base.name} AMOPS <info@glidepathops.com>`
  const replyTo = validReplyTo(base.amops_email)

  // 3. One email per agency. Per-agency errors are logged + counted, never thrown.
  let sent = 0
  let skipped = 0

  for (const aid of agencyIds) {
    const recipients = recipientsByAgency.get(aid) ?? []
    const agencyName = agencyMap.get(aid) ?? 'Unknown agency'
    if (recipients.length === 0) {
      skipped += 1
      continue
    }

    const { subject, html, text } = buildAgencyEmail({
      base, entry, agencyName, outcome, reason, changes, currentDetails,
    })

    try {
      const { error } = await resend.emails.send({
        from: fromLabel,
        to: recipients,
        replyTo,
        cc: replyTo ? [replyTo] : undefined,
        subject,
        html,
        text,
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
