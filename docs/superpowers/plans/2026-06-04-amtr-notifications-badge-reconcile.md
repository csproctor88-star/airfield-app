# AMTR Notifications — Badge + Daily Fleet Reconcile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an amber `/amtr` sidebar badge that mirrors the current user's non-dismissed AMTR notifications, backed by a daily service-role cron that reconciles due/overdue (1098+RAT → training team) and missing-trainee-signature items (JQS/1098/797/623A → trainee) fleet-wide, with auto-resolve.

**Architecture:** Two pure, unit-tested compute functions live in `lib/amtr/inspection-engine.ts` (reusing its private signing-rule predicates so they can't drift). A new Vercel cron route assembles per-base data with a service-role client, runs the functions per member, upserts notifications (idempotent), and dismisses stale ones. The badge reuses the existing `useSidebarBadgeCounts` + `sidebar-nav` machinery.

**Tech Stack:** Next.js 14 route handler, `@supabase/supabase-js` service-role client, Vercel cron (`vercel.json`), vitest. Reuses `lib/amtr/status.ts` (`dueStatus`, `ratApplies`) and `lib/amtr/notifications.ts` builders.

---

## Spec reference

`docs/superpowers/specs/2026-06-04-amtr-notifications-badge-reconcile-design.md`

## File structure

- **Modify** `supabase/migrations/2026062009_amtr_signature_required_kind.sql` (new) — extend the `kind` CHECK.
- **Modify** `lib/supabase/amtr.ts` — add `'signature_required'` to `AmtrNotificationKind`; add `fetchAmtrNotificationCount()`.
- **Modify** `lib/amtr/notifications.ts` — add `buildSignatureRequired()`.
- **Modify** `lib/amtr/inspection-engine.ts` — add `dueItemsForMember()` + `traineeSignatureGaps()` (+ a small import).
- **Create** `tests/amtr-reconcile-core.test.ts` — unit tests for both functions.
- **Create** `app/api/amtr-due-reconcile/route.ts` — the cron.
- **Modify** `vercel.json` — add the cron schedule.
- **Modify** `hooks/use-sidebar-badge-counts.ts` — add `amtr` count + realtime.
- **Modify** `components/layout/sidebar-nav.tsx` — amber dot + label + section rollup.
- **Modify** `components/amtr/notification-center.tsx` — `KIND_COLOR` entry + fire `badges-refresh` on dismiss.

---

## Task 1: Migration — add `signature_required` notification kind

**Files:**
- Create: `supabase/migrations/2026062009_amtr_signature_required_kind.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add 'signature_required' (trainee-owed signature, fired by the daily
-- reconcile) to the amtr_notifications kind CHECK. Additive (expand) change.
ALTER TABLE amtr_notifications DROP CONSTRAINT IF EXISTS amtr_notifications_kind_check;
ALTER TABLE amtr_notifications ADD CONSTRAINT amtr_notifications_kind_check
  CHECK (kind IN
    ('training_due','signoff','entry_623a','item_797_added','signature_797','signature_required'));
```

- [ ] **Step 2: Apply to the linked DB**

Run: `npx supabase db query --linked --file supabase/migrations/2026062009_amtr_signature_required_kind.sql`
Expected: JSON with `"rows": []` and exit code 0.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026062009_amtr_signature_required_kind.sql
git commit -m "AMTR: add signature_required notification kind (CHECK constraint)"
```

---

## Task 2: Type + KIND_COLOR for the new kind

**Files:**
- Modify: `lib/supabase/amtr.ts:54-55`
- Modify: `components/amtr/notification-center.tsx:11-17`

- [ ] **Step 1: Extend the union**

In `lib/supabase/amtr.ts`, change:

```ts
export type AmtrNotificationKind =
  | 'training_due' | 'signoff' | 'entry_623a' | 'item_797_added' | 'signature_797'
```

to:

```ts
export type AmtrNotificationKind =
  | 'training_due' | 'signoff' | 'entry_623a' | 'item_797_added' | 'signature_797'
  | 'signature_required'
```

- [ ] **Step 2: Add the color**

In `components/amtr/notification-center.tsx`, change the `KIND_COLOR` map to add the new key:

```ts
const KIND_COLOR: Record<string, string> = {
  training_due: 'var(--color-warning)',
  signoff: 'var(--color-success)',
  entry_623a: 'var(--color-danger)',
  item_797_added: 'var(--color-accent)',
  signature_797: 'var(--color-danger)',
  signature_required: 'var(--color-danger)',
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/amtr.ts components/amtr/notification-center.tsx
git commit -m "AMTR: signature_required kind type + notification color"
```

---

## Task 3: `buildSignatureRequired` notification builder

**Files:**
- Modify: `lib/amtr/notifications.ts` (add after `build797Signature`, ~line 82)

- [ ] **Step 1: Add the builder**

```ts
/** Trainee-owed signature on a form item (fired by the daily reconcile).
 *  formLabel is the human form name, e.g. "DAF 1098". */
export function buildSignatureRequired(
  formLabel: string, itemName: string, tab: string, itemId: string,
): NotificationDraft {
  return {
    kind: 'signature_required',
    body: `Signature required – ${formLabel} – ${itemName}`,
    target_tab: tab,
    target_item_id: itemId,
    dedupe_key: `signature_required:${tab}:${itemId}`,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/amtr/notifications.ts
git commit -m "AMTR: buildSignatureRequired notification draft"
```

---

## Task 4: Pure compute functions in the inspection engine

**Files:**
- Modify: `lib/amtr/inspection-engine.ts` (imports near top + new exports at end of file)
- Test: `tests/amtr-reconcile-core.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/amtr-reconcile-core.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dueItemsForMember, traineeSignatureGaps } from '@/lib/amtr/inspection-engine'
import type { InspectionScanData } from '@/lib/amtr/inspection-engine'

type Row = Record<string, unknown>

// Build InspectionScanData with only the fields a test needs; everything else
// defaults to empty so the unused engine inputs don't matter here.
function scan(over: Partial<InspectionScanData>): InspectionScanData {
  return {
    member: { user_id: 'u1', status: 'Active' },
    roleAssignments: [],
    jqsCatalog: [], jqsProgress: [],
    r1098Catalog: [], r1098Progress: [],
    ratCatalog: [], ratProgress: [],
    e623a: [], items797: [], items803: [],
    milestoneCatalog: [], formalCatalog: [], formalProgress: [],
    qualCatalog: [], qualProgress: [],
    transcribedRowIds: [],
    today: '2026-06-04',
    ...over,
  } as InspectionScanData
}

describe('dueItemsForMember', () => {
  it('flags an overdue 1098 item', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }],
      r1098Progress: [{ catalog_id: 'c1', last_completed: '2025-01-01', next_due: '2026-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR', dueISO: '2026-01-01' },
    ])
  })

  it('does not flag a 1098 item due far in the future', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }],
      r1098Progress: [{ catalog_id: 'c1', last_completed: '2026-05-01', next_due: '2027-05-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([])
  })

  it('skips RAT for exempt member statuses (Contractor)', () => {
    const d = scan({
      member: { user_id: 'u1', status: 'Contractor' },
      ratCatalog: [{ id: 'r1', course: 'Active Threat' }],
      ratProgress: [{ catalog_id: 'r1', due: '2026-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([])
  })

  it('flags an overdue RAT item for an Active member', () => {
    const d = scan({
      ratCatalog: [{ id: 'r1', course: 'Active Threat' }],
      ratProgress: [{ catalog_id: 'r1', due: '2026-01-01', completed: '2025-01-01' }],
    })
    expect(dueItemsForMember(d)).toEqual([
      { tab: 'rat', itemId: 'r1', itemName: 'Active Threat', dueISO: '2026-01-01' },
    ])
  })
})

describe('traineeSignatureGaps', () => {
  it('flags a started 797 item missing trainee initials', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: '' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '797', itemId: 'a1', itemName: 'Taxi signals' },
    ])
  })

  it('does not flag a 797 item the trainee already signed', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'Taxi signals', start_date: '2026-05-01', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })

  it('flags a manual 623A entry missing trainee initials but skips transcribed/source-linked', () => {
    const d = scan({
      e623a: [
        { id: 'e1', entry_type: 'Counseling', trainee_initials: '' },                 // flag
        { id: 'e2', entry_type: 'Old', trainee_initials: '', transcribed: true },      // skip (historical)
        { id: 'e3', entry_type: 'Auto', trainee_initials: '', source_table: 'amtr_1098_progress' }, // skip (source-linked)
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '623a', itemId: 'e1', itemName: 'Counseling' },
    ])
  })

  it('flags a required JQS core task missing trainee initials, respecting skill level', () => {
    const d = scan({
      // Member is 5-level (attained skill_level qual).
      qualCatalog: [{ id: 'q5', category: 'skill_level', name: '1C751 Skill Level' }],
      qualProgress: [{ catalog_id: 'q5', attained: true }],
      jqsCatalog: [
        { id: 'j1', kind: 'task', required: true, core_cert: '5', number: '1.1' }, // 5-level → applies
        { id: 'j2', kind: 'task', required: true, core_cert: '7', number: '2.1' }, // 7-level → above skill, ignore
      ],
      jqsProgress: [],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: 'jqs', itemId: 'j1', itemName: '1.1' },
    ])
  })

  it('flags a completed-and-due 1098 row missing trainee initials, not a future-due one', () => {
    const d = scan({
      r1098Catalog: [{ id: 'c1', task: 'CPR' }, { id: 'c2', task: 'AED' }],
      r1098Progress: [
        { catalog_id: 'c1', start_date: '2025-01-01', last_completed: '2025-01-01', next_due: '2026-01-01', trainee_initials: '' }, // due → flag
        { catalog_id: 'c2', start_date: '2026-05-01', last_completed: '2026-05-01', next_due: '2027-05-01', trainee_initials: '' }, // future → skip
      ],
    })
    expect(traineeSignatureGaps(d)).toEqual([
      { tab: '1098', itemId: 'c1', itemName: 'CPR' },
    ])
  })

  it('returns no gaps for a fully-signed current member', () => {
    const d = scan({
      items797: [{ id: 'a1', task: 'X', start_date: '2026-05-01', trainee_initials: 'RS' }],
      e623a: [{ id: 'e1', entry_type: 'Y', trainee_initials: 'RS' }],
    })
    expect(traineeSignatureGaps(d)).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/amtr-reconcile-core.test.ts`
Expected: FAIL — `dueItemsForMember`/`traineeSignatureGaps` are not exported.

- [ ] **Step 3: Add the import to the engine**

In `lib/amtr/inspection-engine.ts`, find the existing top-of-file imports and add (if not already importing from `./status`):

```ts
import { dueStatus, parseDate, ratApplies } from './status'
```

- [ ] **Step 4: Implement the two functions**

Append to the end of `lib/amtr/inspection-engine.ts`. These reuse the module-private `has`, `live`, `label`, `coreCertLevel` helpers and the exported `highestSkillLevel`:

```ts
// ─────────────────────────────────────────────────────────────
// Reconcile inputs for the daily notification cron. Pure; co-located
// with the inspection scan so the signing rules can't drift from it.
// ─────────────────────────────────────────────────────────────

export type DueItem = { tab: '1098' | 'rat'; itemId: string; itemName: string; dueISO: string }
export type TraineeSigGap = { tab: 'jqs' | '1098' | '797' | '623a'; itemId: string; itemName: string }

/** Due-soon / overdue recurring items (1098 + RAT) for a member. Mirrors the
 *  reconcile in form1098-tab.tsx / rat-tab.tsx. RAT is skipped for exempt
 *  statuses (Civilian / Contractor / Separated). */
export function dueItemsForMember(d: InspectionScanData): DueItem[] {
  const out: DueItem[] = []
  const today = parseDate(d.today) ?? new Date()

  const name1098 = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
  for (const p of d.r1098Progress) {
    const due = (p.next_due as string | null) ?? null
    if (!due) continue
    const s = dueStatus({ dueDate: due, completedDate: (p.last_completed as string) ?? '' }, today)
    if (s === 'due_soon' || s === 'overdue') {
      out.push({ tab: '1098', itemId: String(p.catalog_id), itemName: name1098.get(String(p.catalog_id)) ?? String(p.catalog_id), dueISO: String(due) })
    }
  }

  if (ratApplies(String(d.member.status ?? ''))) {
    const nameRat = new Map(d.ratCatalog.map((c) => [String(c.id), String(c.course ?? c.id)]))
    for (const p of d.ratProgress) {
      const due = (p.due as string | null) ?? null
      if (!due) continue
      const s = dueStatus({ dueDate: due, completedDate: (p.completed as string) ?? '' }, today)
      if (s === 'due_soon' || s === 'overdue') {
        out.push({ tab: 'rat', itemId: String(p.catalog_id), itemName: nameRat.get(String(p.catalog_id)) ?? String(p.catalog_id), dueISO: String(due) })
      }
    }
  }
  return out
}

/** Items awaiting the TRAINEE's initials across JQS / 1098 / 797 / 623A,
 *  honoring the same eligibility filters the inspection scan applies. The
 *  certifier transcribe-waiver does NOT apply here — the engine still requires
 *  trainee initials on transcribed rows; only 623A historical/source-linked
 *  entries are excluded entirely (as in scan rule 4.1). */
export function traineeSignatureGaps(d: InspectionScanData): TraineeSigGap[] {
  const out: TraineeSigGap[] = []
  const skill = highestSkillLevel(d.qualCatalog, d.qualProgress)
  const futureDue = (v: unknown): boolean => has(v) && String(v).slice(0, 10) > d.today

  // JQS — required core tasks at/below the member's skill level.
  const jqsProgByCat = new Map(d.jqsProgress.map((p) => [String(p.catalog_id), p]))
  for (const c of live(d.jqsCatalog)) {
    if (c.kind === 'section' || !c.required || !has(c.core_cert)) continue
    const lvl = coreCertLevel(c.core_cert)
    if (!(skill == null || lvl == null || lvl <= skill)) continue
    const p = jqsProgByCat.get(String(c.id))
    if (!p || !has(p.trainee_initials)) out.push({ tab: 'jqs', itemId: String(c.id), itemName: label(c) })
  }

  // 1098 — completed AND currently-due rows.
  const name1098 = new Map(d.r1098Catalog.map((c) => [String(c.id), String(c.task ?? c.id)]))
  for (const p of d.r1098Progress) {
    if (!(has(p.start_date) && has(p.last_completed) && !futureDue(p.next_due))) continue
    if (!has(p.trainee_initials)) out.push({ tab: '1098', itemId: String(p.catalog_id), itemName: name1098.get(String(p.catalog_id)) ?? String(p.catalog_id) })
  }

  // 797 — started items.
  for (const r of d.items797) {
    if (!(has(r.start_date) || has(r.complete_date))) continue
    if (!has(r.trainee_initials)) out.push({ tab: '797', itemId: String(r.id), itemName: label(r) })
  }

  // 623A — manual, non-transcribed entries.
  for (const e of d.e623a) {
    if (has(e.source_table) || e.transcribed === true) continue
    if (!has(e.trainee_initials)) out.push({ tab: '623a', itemId: String(e.id), itemName: String(e.entry_type ?? e.form_date ?? e.id) })
  }

  return out
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/amtr-reconcile-core.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `parseDate`/`dueStatus`/`ratApplies` was already imported, remove the duplicate import line.)

- [ ] **Step 7: Commit**

```bash
git add lib/amtr/inspection-engine.ts tests/amtr-reconcile-core.test.ts
git commit -m "AMTR: pure dueItemsForMember + traineeSignatureGaps for reconcile"
```

---

## Task 5: Fleet reconcile cron route

**Files:**
- Create: `app/api/amtr-due-reconcile/route.ts`
- Modify: `vercel.json`

Reference pattern: `app/api/training-expiry-digest/route.ts` (auth + service client).

- [ ] **Step 1: Write the route**

Create `app/api/amtr-due-reconcile/route.ts`:

```ts
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

export async function POST(request: Request) {
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
          for (const uid of recipients) {
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
```

- [ ] **Step 2: Add the cron schedule**

In `vercel.json`, add a third entry to the `crons` array (after `annual-review-digest`):

```json
    {
      "path": "/api/amtr-due-reconcile",
      "schedule": "0 12 * * *"
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add app/api/amtr-due-reconcile/route.ts vercel.json
git commit -m "AMTR: daily fleet notification reconcile cron"
```

---

## Task 6: Notification count fetch

**Files:**
- Modify: `lib/supabase/amtr.ts` (add after `fetchAmtrNotifications`, ~line 613)

- [ ] **Step 1: Add the count helper**

```ts
/** Count of the current user's non-dismissed AMTR notifications (RLS scopes
 *  the table to recipient_user_id = auth.uid()). Used by the sidebar badge. */
export async function fetchAmtrNotificationCount(): Promise<number> {
  const supabase = db()
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('amtr_notifications')
    .select('id', { count: 'exact', head: true })
    .is('dismissed_at', null)
  if (error) {
    console.error('Failed to count AMTR notifications:', error.message)
    return 0
  }
  return count ?? 0
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/amtr.ts
git commit -m "AMTR: fetchAmtrNotificationCount for sidebar badge"
```

---

## Task 7: Wire the badge into `useSidebarBadgeCounts`

**Files:**
- Modify: `hooks/use-sidebar-badge-counts.ts`

- [ ] **Step 1: Add the import**

Near the other `fetch*Count` imports (top of file):

```ts
import { fetchAmtrNotificationCount } from '@/lib/supabase/amtr'
```

- [ ] **Step 2: Add state**

After `const [discrepanciesPendingVerification, setDiscrepanciesPendingVerification] = useState(0)`:

```ts
  const [amtrNotifications, setAmtrNotifications] = useState(0)
```

- [ ] **Step 3: Fetch in `refresh()`**

After the `DISCREPANCIES_CLOSE` block inside `refresh()`:

```ts
    if (has(PERM.AMTR_VIEW)) {
      tasks.push(fetchAmtrNotificationCount().then(setAmtrNotifications))
    } else {
      setAmtrNotifications(0)
    }
```

- [ ] **Step 4: Subscribe to realtime**

In the realtime `useEffect`, add another `.on(...)` before `.subscribe(...)`. The table isn't base-filterable per-recipient here, so refresh on any change to it:

```ts
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amtr_notifications' },
        () => refresh(),
      )
```

- [ ] **Step 5: Expose the count**

Change the return aggregation at the bottom:

```ts
  const ppr = pprTriage + pprApproval + pprCoord
  const qrc = qrcActive
  const discrepancies = discrepanciesPendingVerification
  const amtr = amtrNotifications
  const total = ppr + qrc + discrepancies + amtr

  return { ppr, qrc, discrepancies, amtr, total }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add hooks/use-sidebar-badge-counts.ts
git commit -m "AMTR: surface notification count in sidebar badge hook"
```

---

## Task 8: Amber dot + label in the sidebar nav

**Files:**
- Modify: `components/layout/sidebar-nav.tsx` (dot block ~471, label block ~493, section rollup ~565)

- [ ] **Step 1: Add the AMTR dot**

Immediately after the Discrepancies dot block (the one closing at ~line 471, before `</span>`), add:

```tsx
          {/* AMTR training-notification dot — current user's non-dismissed
              amtr_notifications. Amber: "training action needed". */}
          {href === '/amtr' && badgeCounts.amtr > 0 && !active && (
            <span style={{
              position: 'absolute', top: -4, right: -6,
              width: isOpen ? 16 : 14, height: isOpen ? 16 : 14,
              borderRadius: '50%', background: 'var(--color-warning)', color: '#fff',
              fontSize: 9, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, boxShadow: '0 0 6px rgba(245,158,11,0.5)',
            }}>
              {badgeCounts.amtr > 9 ? '9+' : badgeCounts.amtr}
            </span>
          )}
```

- [ ] **Step 2: Add the expanded label**

After the Discrepancies expanded-label block (~line 493):

```tsx
        {isOpen && href === '/amtr' && badgeCounts.amtr > 0 && !active && (
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-warning)', marginLeft: 'auto' }}>
            {badgeCounts.amtr} to action
          </span>
        )}
```

- [ ] **Step 3: Include AMTR in the section-header rollup**

Find the section badge sum (~line 565):

```tsx
      (section.items.includes('/ppr') ? badgeCounts.ppr : 0)
      + (section.items.includes('/qrc') ? badgeCounts.qrc : 0)
      + (section.items.includes('/discrepancies') ? badgeCounts.discrepancies : 0)
```

Add a line:

```tsx
      + (section.items.includes('/amtr') ? badgeCounts.amtr : 0)
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar-nav.tsx
git commit -m "AMTR: amber notification dot + label in sidebar"
```

---

## Task 9: Instant badge refresh on dismiss

**Files:**
- Modify: `components/amtr/notification-center.tsx` (the `dismiss` handler, ~line 38)

- [ ] **Step 1: Fire the badge-refresh event after dismiss**

Change:

```ts
  const dismiss = async (id: string) => {
    await dismissAmtrNotification(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
  }
```

to:

```ts
  const dismiss = async (id: string) => {
    await dismissAmtrNotification(id)
    setItems((prev) => prev.filter((n) => n.id !== id))
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/amtr/notification-center.tsx
git commit -m "AMTR: refresh sidebar badge instantly on notification dismiss"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all pass (existing + 12 new in `amtr-reconcile-core`).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: exit 0, route list includes `ƒ /api/amtr-due-reconcile`.

- [ ] **Step 3: Manual cron smoke test (post-deploy)**

After the changes deploy to Vercel preview/prod, invoke the route once with the secret and confirm the JSON summary:

```bash
curl -X POST https://<deploy-host>/api/amtr-due-reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```
Expected: `{ "ok": true, "bases": <n>, "created": <n>, "resolved": <n>, "errors": [] }`. Then open `/amtr` as a user with due/overdue or unsigned items and confirm the amber dot + the Notifications section both show, and dismissing clears the dot.

- [ ] **Step 4: Final commit (if any verification fixups)**

```bash
git add -A
git commit -m "AMTR: notification badge + reconcile verification fixups"
```

---

## Notes for the implementer

- `db()` in `lib/supabase/amtr.ts` is the existing client-side Supabase getter (returns null when unconfigured → helpers no-op). The cron does NOT use it; it builds its own service-role client (see Task 5), exactly like `training-expiry-digest`.
- `InspectionScanData` requires `items803/milestoneCatalog/formalCatalog/formalProgress` fields that the two compute functions don't read — the cron passes `[]` for them (Task 5). Don't fetch those tables.
- Neither compute function uses `transcribedRowIds` (the certifier transcribe-waiver doesn't affect trainee signatures), so the cron passes `[]` and skips the `amtr_audit_log` query.
- The `entry_623a` kind stays in the CHECK list for any historical rows but is superseded by `signature_required`; no new code fires it.
