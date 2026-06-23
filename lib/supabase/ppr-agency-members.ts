import { createClient } from './client'
import { friendlyError } from '@/lib/utils'

function db() {
  return createClient()
}

export type PprAgencyMember = {
  id: string
  agency_id: string
  user_id: string
  base_id: string
  created_at: string
}

export type PprAgencyMemberWithProfile = PprAgencyMember & {
  name: string
  rank: string | null
  email: string
}

/** Fetch agency-member rows for a single agency, joined to profiles. */
export async function fetchAgencyMembers(agencyId: string): Promise<PprAgencyMemberWithProfile[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('ppr_agency_members')
    .select('*, profiles:user_id(name, rank, email)')
    .eq('agency_id', agencyId)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    ...(row as unknown as PprAgencyMember),
    name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
    rank: (row.profiles as { rank?: string } | null)?.rank || null,
    email: (row.profiles as { email?: string } | null)?.email || '',
  }))
}

/** Bulk overwrite the membership of an agency with the given user_ids. */
export async function setAgencyMembers(
  agencyId: string,
  baseId: string,
  userIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  // Wipe and rewrite rather than diff — handful of users per agency,
  // and a clean replace keeps RLS auditable. Any failure leaves the
  // table in a consistent state because the delete is idempotent.
  const { error: delErr } = await supabase
    .from('ppr_agency_members')
    .delete()
    .eq('agency_id', agencyId)
  if (delErr) return { ok: false, error: friendlyError(delErr.message) }

  if (userIds.length === 0) return { ok: true }

  const rows = userIds.map((uid) => ({
    agency_id: agencyId,
    user_id: uid,
    base_id: baseId,
  }))
  const { error: insErr } = await supabase
    .from('ppr_agency_members')
    .insert(rows)
  if (insErr) return { ok: false, error: friendlyError(insErr.message) }

  return { ok: true }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** External (non-Glidepath-account) email recipients for one agency. */
export async function fetchAgencyExternalEmails(agencyId: string): Promise<string[]> {
  const supabase = db()
  if (!supabase) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('ppr_agency_emails')
    .select('email')
    .eq('agency_id', agencyId)
    .order('email', { ascending: true })
  if (error || !data) return []
  return (data as { email: string }[]).map((r) => r.email).filter(Boolean)
}

/** Bulk overwrite an agency's external email list. Emails are trimmed,
 *  lowercased, de-duped, and shape-validated; invalid entries are dropped. */
export async function setAgencyExternalEmails(
  agencyId: string,
  baseId: string,
  emails: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db()
  if (!supabase) return { ok: false, error: 'Supabase not configured' }

  const cleaned = Array.from(
    new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e)),
    ),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { error: delErr } = await sb.from('ppr_agency_emails').delete().eq('agency_id', agencyId)
  if (delErr) return { ok: false, error: friendlyError(delErr.message) }

  if (cleaned.length === 0) return { ok: true }

  const rows = cleaned.map((email) => ({ agency_id: agencyId, base_id: baseId, email }))
  const { error: insErr } = await sb.from('ppr_agency_emails').insert(rows)
  if (insErr) return { ok: false, error: friendlyError(insErr.message) }
  return { ok: true }
}

/** Returns the list of base members usable as a coordinator picker. */
export async function fetchPprCoordinatorPicker(baseId: string): Promise<{ user_id: string; name: string; rank: string | null; email: string; role: string }[]> {
  const supabase = db()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('base_members')
    .select('user_id, role, profiles:user_id(name, rank, email)')
    .eq('base_id', baseId)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map((row) => ({
    user_id: row.user_id as string,
    role: (row.role as string) || '',
    name: (row.profiles as { name?: string } | null)?.name || 'Unknown',
    rank: (row.profiles as { rank?: string } | null)?.rank || null,
    email: (row.profiles as { email?: string } | null)?.email || '',
  }))
}

/** Per-user pending-coordination count: rows in pending status whose
 *  agency the user is a member of, scoped to a base. Used by the
 *  sidebar badge hook. */
export async function fetchPendingCoordinationCountForUser(
  baseId: string,
  userId: string,
): Promise<number> {
  const supabase = db()
  if (!supabase) return 0

  // Step 1 — find the agency_ids this user is a member of in this base.
  const { data: memberships } = await supabase
    .from('ppr_agency_members')
    .select('agency_id')
    .eq('base_id', baseId)
    .eq('user_id', userId)

  const agencyIds = ((memberships || []) as { agency_id: string }[]).map((m) => m.agency_id)
  if (agencyIds.length === 0) return 0

  // Step 2 — count pending coord rows on those agencies whose parent
  // entry is still in `pending_coordination` for this base. Two-step
  // because postgrest doesn't support a join-based count cleanly.
  const { data: entries } = await supabase
    .from('ppr_entries')
    .select('id')
    .eq('base_id', baseId)
    .eq('status', 'pending_coordination')
  const entryIds = ((entries || []) as { id: string }[]).map((e) => e.id)
  if (entryIds.length === 0) return 0

  const { count } = await supabase
    .from('ppr_coordination')
    .select('id', { count: 'exact', head: true })
    .in('entry_id', entryIds)
    .in('agency_id', agencyIds)
    .eq('status', 'pending')

  return count ?? 0
}

/** Per-agency coordinator counts for a base. Used by the triage modal
 *  to surface the "no coordinators — email will be skipped" warning at
 *  the moment AMOPS is choosing routing. Returns a map of agency_id →
 *  member count, including zero entries for agencies with no members. */
export async function fetchAgencyCoordinatorCounts(
  baseId: string,
): Promise<Record<string, number>> {
  const supabase = db()
  if (!supabase) return {}
  const counts: Record<string, number> = {}

  const { data } = await supabase
    .from('ppr_agency_members')
    .select('agency_id')
    .eq('base_id', baseId)
  for (const row of (data || []) as { agency_id: string }[]) {
    counts[row.agency_id] = (counts[row.agency_id] || 0) + 1
  }

  // External emails also count as recipients — an agency with only
  // manually-added emails should NOT show the "no coordinators" warning.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ext } = await (supabase as any)
    .from('ppr_agency_emails')
    .select('agency_id')
    .eq('base_id', baseId)
  for (const row of (ext || []) as { agency_id: string }[]) {
    counts[row.agency_id] = (counts[row.agency_id] || 0) + 1
  }

  return counts
}

/** Fetch the email recipients for a set of agencies. Used by the
 *  triage email path. */
export async function fetchAgencyMemberEmails(agencyIds: string[]): Promise<{ agency_id: string; email: string }[]> {
  const supabase = db()
  if (!supabase || agencyIds.length === 0) return []
  const { data } = await supabase
    .from('ppr_agency_members')
    .select('agency_id, profiles:user_id(email)')
    .in('agency_id', agencyIds)

  return ((data || []) as Record<string, unknown>[])
    .map((row) => ({
      agency_id: row.agency_id as string,
      email: (row.profiles as { email?: string } | null)?.email || '',
    }))
    .filter((r) => r.email)
}
