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
import {
  dueItemsForMember, traineeSignatureGaps, type InspectionScanData,
} from '@/lib/amtr/inspection-engine'
import { buildTrainingDue, buildSignatureRequired } from '@/lib/amtr/notifications'

type Row = Record<string, unknown>
const FORM_LABEL: Record<string, string> = {
  jqs: 'JQS-CFETP', '1098': 'DAF 1098', '797': 'DAF 797', '623a': 'DAF 623A',
}

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

  type Notif = {
    base_id: string; recipient_user_id: string; member_id: string
    kind: string; body: string; target_tab: string; target_item_id: string; dedupe_key: string
  }
  let created = 0, resolved = 0
  const errors: { base: string; error: string }[] = []

  for (const [baseId, baseMembers] of Array.from(byBase.entries())) {
    try {
      // Bulk-fetch everything the two compute functions need, base-scoped.
      const t = (table: string) => supabase.from(table).select('*').eq('base_id', baseId)
      const [
        roles, jqsCat, jqsProg, r1098Cat, r1098Prog, ratCat, ratProg,
        e623a, items797, qualCat, qualProg,
      ] = await Promise.all([
        supabase.from('amtr_role_assignments').select('user_id, role').eq('base_id', baseId),
        t('amtr_jqs_catalog'), t('amtr_jqs_progress'),
        t('amtr_1098_catalog'), t('amtr_1098_progress'),
        t('amtr_rat_catalog'), t('amtr_rat_progress'),
        t('amtr_623a'), t('amtr_797'),
        t('amtr_qual_catalog'), t('amtr_qual_progress'),
      ])
      const roleAssignments = ((roles.data ?? []) as { user_id: string; role: string }[])
      const teamUids = Array.from(new Set(
        roleAssignments.filter((a) => a.role === 'trainer' || a.role === 'namt' || a.role === 'afm').map((a) => a.user_id),
      ))

      // Group member-scoped rows by member_id.
      const group = (rows: Row[] | null) => {
        const map = new Map<string, Row[]>()
        for (const r of rows ?? []) {
          const k = String(r.member_id)
          const arr = map.get(k) ?? []; arr.push(r); map.set(k, arr)
        }
        return map
      }
      const jqsP = group(jqsProg.data), r1098P = group(r1098Prog.data), ratP = group(ratProg.data)
      const e623aP = group(e623a.data), items797P = group(items797.data), qualP = group(qualProg.data)

      const notifs: Notif[] = []
      const liveKeys = new Set<string>()

      for (const m of baseMembers) {
        const memberId = String(m.id)
        const traineeUid = m.user_id ? String(m.user_id) : null

        const d: InspectionScanData = {
          member: m,
          roleAssignments,
          jqsCatalog: (jqsCat.data ?? []) as Row[], jqsProgress: jqsP.get(memberId) ?? [],
          r1098Catalog: (r1098Cat.data ?? []) as Row[], r1098Progress: r1098P.get(memberId) ?? [],
          ratCatalog: (ratCat.data ?? []) as Row[], ratProgress: ratP.get(memberId) ?? [],
          e623a: e623aP.get(memberId) ?? [], items797: items797P.get(memberId) ?? [],
          items803: [], milestoneCatalog: [], formalCatalog: [], formalProgress: [],
          qualCatalog: (qualCat.data ?? []) as Row[], qualProgress: qualP.get(memberId) ?? [],
          transcribedRowIds: [],
          today,
        }

        // Due/overdue → trainee + team.
        for (const item of dueItemsForMember(d)) {
          const draft = buildTrainingDue(item.itemName, item.dueISO, item.itemId, item.tab)
          const recipients = new Set<string>(teamUids)
          if (traineeUid) recipients.add(traineeUid)
          for (const uid of Array.from(recipients)) {
            const dedupe_key = `${draft.dedupe_key}:${uid}`
            liveKeys.add(`${uid}::${dedupe_key}`)
            notifs.push({ base_id: baseId, recipient_user_id: uid, member_id: memberId, kind: draft.kind, body: draft.body, target_tab: draft.target_tab, target_item_id: draft.target_item_id, dedupe_key })
          }
        }

        // Missing trainee signature → trainee only.
        if (traineeUid) {
          for (const gap of traineeSignatureGaps(d)) {
            const draft = buildSignatureRequired(FORM_LABEL[gap.tab] ?? gap.tab, gap.itemName, gap.tab, gap.itemId)
            liveKeys.add(`${traineeUid}::${draft.dedupe_key}`)
            notifs.push({ base_id: baseId, recipient_user_id: traineeUid, member_id: memberId, kind: draft.kind, body: draft.body, target_tab: draft.target_tab, target_item_id: draft.target_item_id, dedupe_key: draft.dedupe_key })
          }
        }
      }

      // Upsert (idempotent; never resurrects a dismissed row).
      for (let i = 0; i < notifs.length; i += 500) {
        const chunk = notifs.slice(i, i + 500)
        const { error } = await supabase
          .from('amtr_notifications')
          .upsert(chunk as never, { onConflict: 'recipient_user_id,dedupe_key', ignoreDuplicates: true })
        if (error) throw new Error(`upsert: ${error.message}`)
      }
      created += notifs.length

      // Auto-resolve: dismiss non-dismissed reconcile notifications whose item
      // is no longer in the live set.
      const { data: existing, error: exErr } = await supabase
        .from('amtr_notifications')
        .select('id, recipient_user_id, dedupe_key')
        .eq('base_id', baseId)
        .in('kind', ['training_due', 'signature_required'])
        .is('dismissed_at', null)
      if (exErr) throw new Error(`existing: ${exErr.message}`)
      const stale = ((existing ?? []) as { id: string; recipient_user_id: string; dedupe_key: string | null }[])
        .filter((r) => r.dedupe_key && !liveKeys.has(`${r.recipient_user_id}::${r.dedupe_key}`))
        .map((r) => r.id)
      for (let i = 0; i < stale.length; i += 500) {
        const chunk = stale.slice(i, i + 500)
        const { error } = await supabase
          .from('amtr_notifications')
          .update({ dismissed_at: new Date().toISOString() } as never)
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
