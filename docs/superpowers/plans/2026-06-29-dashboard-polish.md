# Dashboard Polish Implementation Plan (centered tiles · DnD link reorder · AMTR consolidation)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** center metric-tile content; drag-and-drop reorder in the Links widget; consolidate the 5 AMTR widgets into one "AMTR" widget with a 9-report dropdown (incl. 4 new reports).

**Spec:** `docs/superpowers/specs/2026-06-29-dashboard-polish-design.md`. **No DB migration.**

## Verified reference facts
- Registry `lib/dashboard/registry.tsx`: `TableWidget` imported (line 4); `tableWidget(meta, descriptor)` helper (8-19) → `kind:'table'`, `Component: (p) => <TableWidget descriptor={d} config={p.config} onConfigChange={p.onConfigChange} />`, `ConfigForm: (p) => <TableConfigForm {...p} descriptor={d} />`. AMTR entries at 192-228 (`amtr` Currency tableWidget, `amtr-kpis` native, `amtr-overdue`/`amtr-due-soon`/`amtr-inspections` tableWidget). Imports: `amtrDescriptor`(31), `amtrOverdueDescriptor, amtrDueSoonDescriptor`(32), `amtrInspectionsDescriptor`(33), `AmtrKpisWidget`(52). `TitleConfigForm` imported.
- `lib/dashboard/widget-registry.ts`: `WidgetMeta` (7-17) has type/kind/title/description/defaultSize/minSize/permission?/moduleHref?/icon?. `listAvailableWidgets(metas, has, moduleEnabled)` (42-51) filters `(!m.permission||has) && (!m.moduleHref||moduleEnabled)`. `WidgetProps {config, editing, onConfigChange?}`; `WidgetConfigProps {config, onSave, onCancel}`. `WidgetDef extends WidgetMeta`.
- `TableWidget` props: `{descriptor, config, onConfigChange?}` (no `editing`).
- `lib/amtr/rollup.ts`: `buildMemberRollup(input): MemberRollup`, `complianceCounts(items:{dueDate?,completedDate?}[], required, today?): ComplianceCounts={required,complete,dueSoon,overdue,pct}`, `buildUnitKpis`. `MemberRollup` has memberId,name,grade,status,jqsRequired,jqsDone,jqsPct,formalRequired,formalDone,formalPct,overdueCount,dueSoonCount,lastUpdated.
- `/amtr/reports/page.tsx` fetch refs: `fetchAmtrMembers(base)`, `fetchAmtrByBase<Row>(table, base, orderBy?)`. Progress rollup: jqsRequired=`jqsCat.filter(c=>c.kind==='item').length`, formalRequired=`formalCat.length`, jqsDone=`jqsProg.filter(member).filter(r=>r.complete_date||r.certifier_initials).length`, formalDone=`formalProg.filter(member).filter(r=>r.complete_date).length`; 1098 prog `next_due`/`last_completed`, rat prog `due`/`completed`; `dueStatus(...)` overdue/due_soon counts; `ratApplies(status)`. Compliance: per catalog row, items = applicable members' progress (`p.catalog_id===c.id && r.member_id===m.id`), `complianceCounts(items, applicable.length)`; 1098 name `c.task`, rat `c.course`, both `c.frequency`. Tables: `amtr_jqs_catalog`,`amtr_jqs_progress`,`amtr_formal_catalog`,`amtr_formal_progress`,`amtr_1098_catalog`,`amtr_1098_progress`,`amtr_rat_catalog`,`amtr_rat_progress`.
- `lib/supabase/amtr.ts`: `AmtrMember {id, user_id:string|null, full_name, grade:string|null, status, ...}`. `fetchAmtrNotifications()` → self-scoped (dismissed_at null), `AmtrNotification {id, member_id, kind, body, target_tab, target_item_id, created_at, dismissed_at, ...}`; `kind` includes `'signature_required'|'trainer_signature_required'`.
- `lib/amtr/report-rows.ts` has `buildDueItemRows(members, p1098, pRat, cat1098, catRat, today?): DueItemRow[]` (DueItemRow: id, memberId, memberName, grade, itemName, type:'1098'|'RAT', dueDate, status:DueStatus, daysUntilDue). Existing descriptor template: `lib/dashboard/table/descriptors/amtr-due-items.tsx` (`useAllDueItems` fetch + `amtrOverdueDescriptor`/`amtrDueSoonDescriptor`). `TableWidgetDescriptor<Row>` (`lib/dashboard/table/types.ts`): columns?/useColumns?, filters, extras?, row, footerHref?, newHref?, summary?, useRows(config,reloadNonce?)→{rows,loading}.
- DnD pattern: `components/amtr/simple-catalog-editor.tsx` — `dragIdx`/`overIdx` state; grip `<span draggable onDragStart={()=>setDragIdx(idx)} onDragEnd={...}>`; row `onDragOver={e=>{e.preventDefault(); setOverIdx(idx)}} onDrop={()=>{reorder(dragIdx, idx); reset}}`; drop-indicator via `borderTop` when `overIdx===idx`.
- Centering targets (current): report-* + feedback = root `flex column height:100%`; metric header row `alignItems:'flex-end'` (left); content area `flex:1, flexDirection:column, justifyContent:'center'` (vertical only); footer row `justifyContent:'flex-end'`. `amtr-kpis-widget`: metric row `alignItems:'flex-end', flex:1` + footer flex-end. `last-check-widget`: root `<Link>` `display:flex, alignItems:'center', height:100%` (no footer). `inspection-status-widget`: root `<Link style={display:'block'}>` with two `row(...)` blocks (no footer).

---

## Task 1: Center metric-tile content (Feature A)

**Files (modify):** `components/dashboard/widgets/{report-discrepancies,report-trends,report-aging,report-lighting,report-daily,feedback,amtr-kpis}-widget.tsx`, `last-check-widget.tsx`, `inspection-status-widget.tsx`

Per-widget flex tweaks. Footer rows stay `justifyContent:'flex-end'`. Read each file; apply:

- [ ] **report-{discrepancies,trends,aging,lighting,daily} + feedback:** on the **metric header row** add `justifyContent: 'center'` (it has `alignItems:'flex-end'`); on the **`flex:1` content area** add `alignItems: 'center'` and `textAlign: 'center'`. Leave the footer.
- [ ] **amtr-kpis-widget:** on the metric row change `alignItems: 'flex-end'` → `alignItems: 'center'` and add `justifyContent: 'center'`. Leave footer.
- [ ] **last-check-widget:** on the root `<Link>` style add `justifyContent: 'center'` (centers the icon+text horizontally; already vertically centered).
- [ ] **inspection-status-widget:** change the root `<Link>` style from `display:'block'` to `display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', height:'100%'` so the two status rows center.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(dashboard): center metric-tile widget content`.

(Visual result needs the user's smoke test — note it.)

---

## Task 2: `moveItem` pure helper + tests (Feature B)

**Files:** Create `lib/dashboard/array-move.ts`, `tests/dashboard-array-move.test.ts`

- [ ] **Test first** (`tests/dashboard-array-move.test.ts`):
```ts
import { describe, it, expect } from 'vitest'
import { moveItem } from '@/lib/dashboard/array-move'
describe('moveItem', () => {
  it('moves an element down', () => { expect(moveItem(['a','b','c'], 0, 2)).toEqual(['b','c','a']) })
  it('moves an element up', () => { expect(moveItem(['a','b','c'], 2, 0)).toEqual(['c','a','b']) })
  it('returns a no-op (copy) for from===to', () => { const a=['a','b']; const r=moveItem(a,1,1); expect(r).toEqual(['a','b']); expect(r).not.toBe(a) })
  it('no-ops on out-of-range indices', () => { expect(moveItem(['a','b'], 5, 0)).toEqual(['a','b']); expect(moveItem(['a','b'], 0, 9)).toEqual(['a','b']); expect(moveItem(['a','b'], -1, 0)).toEqual(['a','b']) })
  it('does not mutate the input', () => { const a=['a','b','c']; moveItem(a,0,2); expect(a).toEqual(['a','b','c']) })
})
```
- [ ] **Run → fail.**
- [ ] **Implement** `lib/dashboard/array-move.ts`:
```ts
/** Return a new array with the element at `from` moved to `to`. Out-of-range
 *  indices are a no-op (returns a copy). Never mutates the input. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
```
- [ ] **Run → pass.** `npx tsc --noEmit` (0). Commit `feat(dashboard): moveItem array helper`.

---

## Task 3: Drag-and-drop link reorder (Feature B)

**Files (modify):** `components/dashboard/widgets/links-widget.tsx` (`LinksConfigForm` only)

Read the file. In `LinksConfigForm`:
- [ ] Add `GripVertical` to the lucide import and `import { moveItem } from '@/lib/dashboard/array-move'`. Add state: `const [dragIdx, setDragIdx] = useState<number|null>(null); const [overIdx, setOverIdx] = useState<number|null>(null)`.
- [ ] Make each link-row `<div>` (the one rendered per `rows.map((r,i)=>...)`) a drop target: `onDragOver={(e)=>{ e.preventDefault(); if (overIdx!==i) setOverIdx(i) }} onDrop={()=>{ if (dragIdx!==null) setRows(rs=>moveItem(rs, dragIdx, i)); setDragIdx(null); setOverIdx(null) }}`, and add a drop-indicator border (e.g. `borderTop: overIdx===i && dragIdx!==null && dragIdx!==i ? '2px solid var(--color-accent)' : undefined`, `opacity: dragIdx===i ? 0.4 : 1`).
- [ ] Add a grip handle as the first child of the row's top input row: `<span draggable onDragStart={()=>setDragIdx(i)} onDragEnd={()=>{ setDragIdx(null); setOverIdx(null) }} title="Drag to reorder" style={{ cursor:'move', userSelect:'none', color:'var(--color-text-3)', display:'flex', flexShrink:0 }}><GripVertical size={15} /></span>` (mirror `simple-catalog-editor.tsx`). Only the grip is `draggable`.
- [ ] Save already persists `rows` order into `config.links` — no change. The widget renders links in array order — no change.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(dashboard): drag-and-drop reorder in the Links widget`.

---

## Task 4: Pure builders for Progress + Task Compliance reports (Feature C)

**Files (modify):** `lib/amtr/report-rows.ts`; (modify) `tests/amtr-report-rows.test.ts`

Add two pure helpers + types, reusing `buildMemberRollup`/`complianceCounts` from `lib/amtr/rollup.ts`.

- [ ] **Tests first** in `tests/amtr-report-rows.test.ts` (append): `buildProgressRows` — given members + the counts, returns rows with memberId/name/grade/jqsPct/formalPct/overdue via `buildMemberRollup` (assert % math, member order, zero-required → 0%). `buildTaskComplianceRows` — given tasks + per-task items + applicable counts, returns rows {name, freq, current `done/total`, pct} via `complianceCounts` (assert counts, RAT-exempt applicability handled by caller, empty list → []).
- [ ] **Implement** in `report-rows.ts`:
```ts
import { buildMemberRollup, complianceCounts, type MemberRollup, type ComplianceCounts } from './rollup'

export type ProgressRow = { id: string; memberId: string; memberName: string; grade: string | null; jqsPct: number; formalPct: number; overdue: number }
export function buildProgressRows(rollups: MemberRollup[]): ProgressRow[] {
  return rollups.map(r => ({ id: r.memberId, memberId: r.memberId, memberName: r.name, grade: r.grade, jqsPct: r.jqsPct, formalPct: r.formalPct, overdue: r.overdueCount }))
}

export type TaskComplianceRow = { id: string; name: string; freq: string; current: number; total: number; pct: number }
export function buildTaskComplianceRows(
  tasks: { id: string; name: string; freq: string; counts: ComplianceCounts }[],
): TaskComplianceRow[] {
  return tasks.map(t => ({ id: t.id, name: t.name, freq: t.freq, current: t.counts.complete, total: t.counts.required, pct: t.counts.pct }))
}
```
(The descriptor's `useRows` does the fetching + assembles `rollups`/`tasks`; these helpers stay pure/testable. `buildProgressRows` is a thin shape mapper; the % math is in `buildMemberRollup`. `buildTaskComplianceRows` maps `complianceCounts` output to display rows.)
- [ ] **Run tests → pass.** `npx tsc --noEmit` (0). Commit `feat(amtr): pure builders for progress + task-compliance reports`.

---

## Task 5: My Training + Pending Signatures descriptors (self-scoped) (Feature C)

**Files:** Create `lib/dashboard/table/descriptors/amtr-my-training.tsx`, `amtr-pending-signatures.tsx`

Mirror `amtr-due-items.tsx` (`useRows` hook returning `{rows, loading}`; descriptor with columns/filters/row/summary/footerHref).

- [ ] **`amtr-my-training.tsx` → `amtrMyTrainingDescriptor`:** `useRows` fetches members + `amtr_1098_progress` + `amtr_rat_progress` + `amtr_1098_catalog` + `amtr_rat_catalog` (same as `useAllDueItems`), resolves the current user via `createClient().auth.getUser()`, finds `member.user_id === user.id`, then `buildDueItemRows(members, p1098, pRat, cat1098, catRat)` filtered to `r.memberId === myMember.id && (r.status==='overdue' || r.status==='due_soon')`. If no member → empty rows. Columns: Item (`itemName`), Type, Due (`dueDate ?? '—'`, mono), Status (badge: overdue red / due soon amber), Days (`daysUntilDue`, mono right). `filters: []`. `row: { mode:'deeplink', href: r => `/amtr/${r.memberId}` }`. `summary: rows => [{ count: rows.length, label:'outstanding', tone: rows.length?'warning':'muted' }]`. `footerHref: '/amtr'`.
- [ ] **`amtr-pending-signatures.tsx` → `amtrPendingSignaturesDescriptor`:** `useRows` calls `fetchAmtrNotifications()` (already self-scoped), keeps `kind==='signature_required' || kind==='trainer_signature_required'`. Map to rows `{ id, memberId: n.member_id, item: n.body, awaiting: n.kind==='trainer_signature_required' ? 'trainer / certifier' : 'you (trainee)', when: n.created_at }`. Columns: Item, Awaiting, When (created date, mono). `filters: []`. `row: { mode:'deeplink', href: r => `/amtr/${r.memberId}` }`. `summary: rows => [{ count: rows.length, label:'awaiting your signature', tone: rows.length?'warning':'muted' }]`. `footerHref: '/amtr'`. Empty handled by the table's empty state.
- [ ] Extend `tests/dashboard-table-descriptors.test.ts` to cover both new static descriptors (unique column keys, ≥1 default column).
- [ ] **Verify:** `npx tsc --noEmit` (0), `npx vitest run` (pass), `npm run build` (compiled). Commit `feat(amtr): My Training + Pending Signatures dashboard descriptors`.

---

## Task 6: Training Progress + Task Compliance descriptors (unit) (Feature C)

**Files:** Create `lib/dashboard/table/descriptors/amtr-progress.tsx`, `amtr-compliance.tsx`

Replicate the `/amtr/reports/page.tsx` fetch logic (see reference facts) in each `useRows`.

- [ ] **`amtr-progress.tsx` → `amtrProgressDescriptor`:** `useRows` fetches members, `amtr_jqs_catalog`, `amtr_jqs_progress`(member_id), `amtr_formal_catalog`, `amtr_formal_progress`(member_id), `amtr_1098_progress`(member_id), `amtr_rat_progress`(member_id). Compute per member exactly as reports/page (jqsRequired=jqs items count, jqsDone=`complete_date||certifier_initials`, formalRequired=formal catalog length, formalDone=`complete_date`, overdue/dueSoon from `dueStatus` on 1098 `next_due`/`last_completed` + rat `due`/`completed` gated by `ratApplies`), call `buildMemberRollup(...)`, then `buildProgressRows(rollups)`. Columns: Member (`memberName`), Grade, JQS % (`jqsPct`, mono right), Formal % (`formalPct`, mono right), Overdue (`overdue`, mono right). `filters: []`. `row: deeplink /amtr/<memberId>`. `summary: rows => [{count: rows.length, label:'members'}]`. `footerHref:'/amtr/reports'`.
- [ ] **`amtr-compliance.tsx` → `amtrComplianceDescriptor`:** `useRows` fetches members, `amtr_1098_catalog`, `amtr_1098_progress`(member_id), `amtr_rat_catalog`, `amtr_rat_progress`(member_id). For each 1098 catalog row build items from applicable members (all) with `{dueDate: p?.next_due, completedDate: p?.last_completed}` and `complianceCounts(items, applicable.length)`; for each rat catalog row, applicable = members where `ratApplies(status)`, items `{dueDate: p?.due, completedDate: p?.completed}`. Assemble `tasks` ({id: c.id, name: c.task||c.course, freq: c.frequency, counts}), then `buildTaskComplianceRows(tasks)`. Columns: Task (`name`), Frequency (`freq`), Current (`r => `${r.current}/${r.total}``), % (`pct`, mono right). `filters: []`. `row: { mode:'none' }`. `footerHref:'/amtr/reports'`. `summary: rows => [{count: rows.length, label:'tasks'}]`.
- [ ] Extend `tests/dashboard-table-descriptors.test.ts` for both. **Verify** tsc/vitest/build. Commit `feat(amtr): Training Progress + Task Compliance dashboard descriptors`.

---

## Task 7: Consolidated AMTR widget (Feature C)

**Files:** Create `components/dashboard/widgets/amtr-widget.tsx`

- [ ] Implement per spec §"The consolidated widget": `AmtrWidget(props: WidgetProps)` — `report = props.config.report ?? 'currency'`; if `'kpis'` → `<AmtrKpisWidget />`; else `<TableWidget descriptor={AMTR_REPORTS[report] ?? amtrDescriptor} config={props.config} onConfigChange={props.onConfigChange} />`. `AMTR_REPORTS` maps the 8 table reports → descriptors (currency, overdue, due-soon, inspections, my-training, progress, compliance, pending-signatures) imported from their descriptor files. `AmtrReportConfigForm({config, onSave, onCancel}: WidgetConfigProps)` — Title input + Report `<select>` (9 options with labels) + Save/Cancel; `onSave({ ...config, title: title.trim() || undefined, report })`. Use the existing config-form button styling pattern (mirror `LinksConfigForm`/`TitleConfigForm`).
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(amtr): consolidated AMTR widget + report config form`.

---

## Task 8: Registry consolidation + hidden-flag palette (Feature C)

**Files (modify):** `lib/dashboard/widget-registry.ts`, `lib/dashboard/registry.tsx`

- [ ] `widget-registry.ts`: add `hidden?: boolean` to `WidgetMeta`; in `listAvailableWidgets` add `&& !m.hidden` to the filter.
- [ ] `registry.tsx`: import `AmtrWidget, AmtrReportConfigForm` from the new widget file. Replace the `'amtr'` entry with the consolidated native widget (per spec §Registry changes: `kind:'native'`, title `'AMTR'`, `Component: (p) => <AmtrWidget {...p} />`, `ConfigForm: AmtrReportConfigForm`, `permission: PERM.AMTR_VIEW`, `moduleHref:'/amtr'`, icon `GraduationCap`, sizes). Add `hidden: true` to the `amtr-kpis`, `amtr-overdue`, `amtr-due-soon`, `amtr-inspections` entries (keep them otherwise intact so existing instances still render).
- [ ] **Verify:** `npx tsc --noEmit` (0), `npx vitest run` (pass), `npm run build` (compiled). Commit `feat(amtr): consolidate AMTR into one palette widget; hide the 4 split entries`.

---

## Task 9: Full verification
- [ ] `npx vitest run` (all pass), `npx tsc --noEmit` (0), `npm run build` (RC 0). Note the manual smoke checklist (9 tiles centered; Links drag-reorder persists; palette shows ONE "AMTR"; all 9 reports render incl. self-scoped My Training + Pending Signatures; legacy `amtr-overdue`/etc. instances still render). Flag that visual centering + DnD need the user's preview test.

## Self-review
- Spec coverage: A=T1, B=T2+T3, C reports=T4-6, consolidated widget=T7, registry/hidden=T8 ✓. Pure helpers tested (T2,T4); descriptors covered by invariants (T5,T6). Types: `buildProgressRows`/`buildTaskComplianceRows`/`ProgressRow`/`TaskComplianceRow` defined T4, used T6; `AMTR_REPORTS` keys match the 8 table descriptor exports; `hidden` added T8 and used by `listAvailableWidgets`. No migration. Back-compat: `amtr` defaults to currency; 4 hidden entries still render.
