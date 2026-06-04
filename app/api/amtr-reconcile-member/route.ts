/**
 * On-sign per-member reconcile. Called by amtrSign/amtrReopen right after a
 * signature changes, so the member's notifications update immediately instead
 * of waiting for the daily cron. Runs the SAME logic as the fleet cron
 * (lib/amtr/reconcile.buildMemberNotifs), scoped to one member.
 *
 * Auth: the caller's cookie session must be able to read the member (RLS). The
 * actual writes use a service-role client because trainer_signature_required
 * fans out to other recipients.
 */

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient as createUserClient } from '@/lib/supabase/server'
import { buildMemberNotifs, signerUidsFromRoles, type ReconcileNotif } from '@/lib/amtr/reconcile'
import type { InspectionScanData } from '@/lib/amtr/inspection-engine'

type Row = Record<string, unknown>
const SIGNABLE = new Set(['amtr_jqs_progress', 'amtr_1098_progress', 'amtr_rat_progress', 'amtr_623a', 'amtr_797'])

export async function POST(request: Request) {
  const userClient = createUserClient()
  if (!userClient) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // The generated Database type doesn't cover every amtr_* table / dynamic
  // table name, so query through a loosely-typed view of the RLS-scoped client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uc = userClient as any

  let body: { memberId?: string; table?: string; rowId?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  // Resolve the member: explicit memberId, or derive it from the signed row.
  let memberId: string | undefined = body.memberId
  if (!memberId && body.table && body.rowId && SIGNABLE.has(body.table)) {
    const { data } = await uc.from(body.table).select('member_id').eq('id', body.rowId).single()
    memberId = (data as { member_id?: string } | null)?.member_id
  }
  if (!memberId) return NextResponse.json({ error: 'No member' }, { status: 400 })

  // Access check via the caller's session (RLS scopes to bases they can see).
  const { data: member } = await uc
    .from('amtr_members').select('id, base_id, user_id, full_name, status').eq('id', memberId).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const m = member as { id: string; base_id: string; user_id: string | null; full_name: string; status: string }
  const baseId = m.base_id

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !serviceKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  const admin = createServiceClient(url, serviceKey)
  const today = new Date().toISOString().slice(0, 10)

  // One member's data: base catalogs + role assignments + this member's progress.
  const baseTbl = (t: string) => admin.from(t).select('*').eq('base_id', baseId)
  const memberTbl = (t: string) => admin.from(t).select('*').eq('member_id', memberId)
  const [roles, jqsCat, jqsProg, r1098Cat, r1098Prog, ratCat, ratProg, e623a, items797, qualCat, qualProg, transcribed] =
    await Promise.all([
      admin.from('amtr_role_assignments').select('user_id, role').eq('base_id', baseId),
      baseTbl('amtr_jqs_catalog'), memberTbl('amtr_jqs_progress'),
      baseTbl('amtr_1098_catalog'), memberTbl('amtr_1098_progress'),
      baseTbl('amtr_rat_catalog'), memberTbl('amtr_rat_progress'),
      memberTbl('amtr_623a'), memberTbl('amtr_797'),
      baseTbl('amtr_qual_catalog'), memberTbl('amtr_qual_progress'),
      admin.from('amtr_audit_log').select('row_id').eq('member_id', memberId).eq('action', 'transcribe'),
    ])
  const roleAssignments = ((roles.data ?? []) as { user_id: string; role: string }[])
  const transcribedRowIds = ((transcribed.data ?? []) as { row_id: string | null }[])
    .map((r) => r.row_id).filter((x): x is string => !!x)

  const d: InspectionScanData = {
    member: m as unknown as Row,
    roleAssignments,
    jqsCatalog: (jqsCat.data ?? []) as Row[], jqsProgress: (jqsProg.data ?? []) as Row[],
    r1098Catalog: (r1098Cat.data ?? []) as Row[], r1098Progress: (r1098Prog.data ?? []) as Row[],
    ratCatalog: (ratCat.data ?? []) as Row[], ratProgress: (ratProg.data ?? []) as Row[],
    e623a: (e623a.data ?? []) as Row[], items797: (items797.data ?? []) as Row[],
    items803: [], milestoneCatalog: [], formalCatalog: [], formalProgress: [],
    qualCatalog: (qualCat.data ?? []) as Row[], qualProgress: (qualProg.data ?? []) as Row[],
    transcribedRowIds,
    today,
  }

  const { notifs, liveKeys } = buildMemberNotifs(d, baseId, signerUidsFromRoles(roleAssignments))

  // Upsert owed (revive dismissed), then delete this member's stale reconcile rows.
  if (notifs.length) {
    const rows = notifs.map((n: ReconcileNotif) => ({ ...n, dismissed_at: null }))
    const { error } = await admin.from('amtr_notifications')
      .upsert(rows as never, { onConflict: 'recipient_user_id,dedupe_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data: existing } = await admin
    .from('amtr_notifications')
    .select('id, recipient_user_id, dedupe_key')
    .eq('member_id', memberId)
    .in('kind', ['training_due', 'signature_required', 'trainer_signature_required'])
  const stale = ((existing ?? []) as { id: string; recipient_user_id: string; dedupe_key: string | null }[])
    .filter((r) => r.dedupe_key && !liveKeys.has(`${r.recipient_user_id}::${r.dedupe_key}`))
    .map((r) => r.id)
  if (stale.length) {
    const { error } = await admin.from('amtr_notifications').delete().in('id', stale)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, owed: notifs.length, resolved: stale.length })
}
