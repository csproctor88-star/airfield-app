/**
 * Daily AMTR notification reconcile.
 *
 * Triggered by Vercel cron (vercel.json) at 12:00 UTC. For every base with
 * AMTR members, recomputes due/overdue (1098+RAT → training team) and
 * missing-trainee-signature items (JQS/1098/797/623A → trainee), upserts the
 * matching amtr_notifications (idempotent on recipient_user_id,dedupe_key),
 * and dismisses any non-dismissed training_due / signature_required rows whose
 * underlying item is no longer due / now signed.
 *
 * Auth: Bearer CRON_SECRET. Service-role Supabase client (bypasses RLS to scan
 * every base and write/dismiss notifications).
 */

export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { type InspectionScanData } from '@/lib/amtr/inspection-engine'
import { buildMemberNotifs, signerUidsFromRoles, type ReconcileNotif } from '@/lib/amtr/reconcile'

type Row = Record<string, unknown>

// Vercel cron invokes the path with GET; POST is kept for manual testing.
export async function GET(request: Request) { return handler(request) }
export async function POST(request: Request) { return handler(request) }

async function handler(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '')
  if (!url || !serviceKey) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const supabase = createClient(url, serviceKey)
  const today = new Date().toISOString().slice(0, 10)

  // All AMTR members, grouped by base.
  const { data: members, error: memErr } = await supabase
    .from('amtr_members').select('id, base_id, user_id, full_name, status')
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 })
  const byBase = new Map<string, Row[]>()
  for (const m of (members ?? []) as Row[]) {
    const b = String(m.base_id)
    const arr = byBase.get(b) ?? []
    arr.push(m)
    byBase.set(b, arr)
  }

  let created = 0, resolved = 0
  const errors: { base: string; error: string }[] = []

  for (const [baseId, baseMembers] of Array.from(byBase.entries())) {
    try {
      // Bulk-fetch everything the two compute functions need, base-scoped.
      // Paginate: Supabase caps a single request at 1000 rows, and a base's
      // jqs_progress routinely exceeds that — an un-paginated fetch silently
      // truncates, making every member past row 1000 look entirely unsigned.
      const fetchAll = async (table: string): Promise<Row[]> => {
        const out: Row[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase
            .from(table).select('*').eq('base_id', baseId).range(from, from + 999)
          if (error) throw new Error(`${table}: ${error.message}`)
          out.push(...((data ?? []) as Row[]))
          if (!data || data.length < 1000) break
        }
        return out
      }
      const { data: rolesData } = await supabase
        .from('amtr_role_assignments').select('user_id, role').eq('base_id', baseId)
      const [
        jqsCat, jqsProg, r1098Cat, r1098Prog, ratCat, ratProg,
        e623a, items797, qualCat, qualProg,
      ] = await Promise.all([
        fetchAll('amtr_jqs_catalog'), fetchAll('amtr_jqs_progress'),
        fetchAll('amtr_1098_catalog'), fetchAll('amtr_1098_progress'),
        fetchAll('amtr_rat_catalog'), fetchAll('amtr_rat_progress'),
        fetchAll('amtr_623a'), fetchAll('amtr_797'),
        fetchAll('amtr_qual_catalog'), fetchAll('amtr_qual_progress'),
      ])
      const roleAssignments = ((rolesData ?? []) as { user_id: string; role: string }[])
      const signerUids = signerUidsFromRoles(roleAssignments)

      // Group member-scoped rows by member_id.
      const group = (rows: Row[]) => {
        const map = new Map<string, Row[]>()
        for (const r of rows) {
          const k = String(r.member_id)
          const arr = map.get(k) ?? []; arr.push(r); map.set(k, arr)
        }
        return map
      }
      const jqsP = group(jqsProg), r1098P = group(r1098Prog), ratP = group(ratProg)
      const e623aP = group(e623a), items797P = group(items797), qualP = group(qualProg)

      const notifs: ReconcileNotif[] = []
      const liveKeys = new Set<string>()

      for (const m of baseMembers) {
        const memberId = String(m.id)
        const d: InspectionScanData = {
          member: m,
          roleAssignments,
          jqsCatalog: jqsCat, jqsProgress: jqsP.get(memberId) ?? [],
          r1098Catalog: r1098Cat, r1098Progress: r1098P.get(memberId) ?? [],
          ratCatalog: ratCat, ratProgress: ratP.get(memberId) ?? [],
          e623a: e623aP.get(memberId) ?? [], items797: items797P.get(memberId) ?? [],
          items803: [], milestoneCatalog: [], formalCatalog: [], formalProgress: [],
          qualCatalog: qualCat, qualProgress: qualP.get(memberId) ?? [],
          transcribedRowIds: [],
          today,
        }
        const { notifs: memberNotifs, liveKeys: memberLive } = buildMemberNotifs(d, baseId, signerUids)
        notifs.push(...memberNotifs)
        memberLive.forEach((k) => liveKeys.add(k))
      }

      // Declarative reconcile: every currently-owed item must have an ACTIVE
      // notification. Upsert with dismissed_at:null and update-on-conflict so an
      // item that was resolved (dismissed) and is owed again gets REVIVED — the
      // old ignoreDuplicates left dismissed rows permanently blocking re-notify.
      for (let i = 0; i < notifs.length; i += 500) {
        const chunk = notifs.slice(i, i + 500).map((n) => ({ ...n, dismissed_at: null }))
        const { error } = await supabase
          .from('amtr_notifications')
          .upsert(chunk as never, { onConflict: 'recipient_user_id,dedupe_key' })
        if (error) throw new Error(`upsert: ${error.message}`)
      }
      created += notifs.length

      // Resolve: DELETE any reconcile notification (active OR dismissed) whose
      // item is no longer owed, so the list always equals current reality and no
      // stale/dismissed row lingers to block a future re-notify. Paginate — a
      // base can hold well over 1000 rows.
      const existing: { id: string; recipient_user_id: string; dedupe_key: string | null }[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error: exErr } = await supabase
          .from('amtr_notifications')
          .select('id, recipient_user_id, dedupe_key')
          .eq('base_id', baseId)
          .in('kind', ['training_due', 'signature_required', 'trainer_signature_required'])
          .range(from, from + 999)
        if (exErr) throw new Error(`existing: ${exErr.message}`)
        existing.push(...((data ?? []) as { id: string; recipient_user_id: string; dedupe_key: string | null }[]))
        if (!data || data.length < 1000) break
      }
      const stale = existing
        .filter((r) => r.dedupe_key && !liveKeys.has(`${r.recipient_user_id}::${r.dedupe_key}`))
        .map((r) => r.id)
      for (let i = 0; i < stale.length; i += 500) {
        const chunk = stale.slice(i, i + 500)
        const { error } = await supabase
          .from('amtr_notifications')
          .delete()
          .in('id', chunk)
        if (error) throw new Error(`resolve: ${error.message}`)
        resolved += chunk.length
      }
    } catch (e) {
      errors.push({ base: baseId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ ok: true, bases: byBase.size, created, resolved, errors })
}
