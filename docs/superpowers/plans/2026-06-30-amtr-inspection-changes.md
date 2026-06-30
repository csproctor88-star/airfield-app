# AMTR Inspection & 1098 Completion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AMTR records-inspection scan period-aware (no future-month false positives), let inspectors edit each discrepancy's detail + corrective action, write a template-driven 623a entry on completion, and auto-complete a 1098 item (stamp completion + roll the due date) when the Cert Official signs.

**Architecture:** Pure date/period logic lands in `lib/amtr/status.ts` and a new `lib/amtr/inspection-623a.ts`, both unit-tested. The scan engine and the `completeAmtrInspection` data layer consume those pures. UI edits touch the inspect page and the 1098 tab. No schema migrations — the inspection `items` column is JSONB and the new fields are additive.

**Tech Stack:** Next.js 14 / React 18 / TypeScript (strict), Supabase, Vitest. Spec: `docs/superpowers/specs/2026-06-30-amtr-inspection-changes-design.md`.

**Conventions:** `npx tsc --noEmit` and `npx vitest run` must pass; commits are gated on `npm run build` (RC 0). Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `lib/amtr/status.ts` | date/currency pures | Add `parseTaskMonth`, `recurringPeriodElapsed`; tweak `dueStatus` |
| `lib/amtr/inspection-engine.ts` | scan rules | Rule 6.3 gains the period gate |
| `lib/amtr/inspection-623a.ts` | compose the 623a comment | **New** pure module |
| `lib/supabase/amtr-inspections.ts` | inspection CRUD + types | Add fields + `normalizeInspectionItem`; use `buildInspection623aComment` |
| `app/(app)/amtr/[memberId]/inspect/page.tsx` | inspect UI | Editable detail + corrective-action fields |
| `components/amtr/form1098-tab.tsx` | 1098 tab | `completeItem` extraction; certifier-sign completion; always-recompute |
| `tests/amtr-status.test.ts` | status pures | New cases |
| `tests/amtr-inspection-engine.test.ts` | scan | New 6.3 cases |
| `tests/amtr-inspection-623a.test.ts` | 623a composer | **New** |
| `tests/amtr-inspection-item.test.ts` | item normalize | **New** |

---

## Task 1: Period helpers in `status.ts`

**Files:**
- Modify: `lib/amtr/status.ts`
- Test: `tests/amtr-status.test.ts`

- [ ] **Step 1: Write failing tests** — append inside the top-level `describe('AMTR status engine', …)` block in `tests/amtr-status.test.ts`, after the `computeNextDue` block:

```ts
  describe('parseTaskMonth', () => {
    it('parses a full month name anywhere in the task', () => {
      expect(parseTaskMonth('June Monthly Proficiency Test')).toBe(6)
      expect(parseTaskMonth('December Monthly Proficiency Test')).toBe(12)
    })
    it('is case-insensitive', () => {
      expect(parseTaskMonth('january monthly proficiency test')).toBe(1)
    })
    it('returns null when no month is present', () => {
      expect(parseTaskMonth('Airfield Driving')).toBeNull()
      expect(parseTaskMonth('')).toBeNull()
      expect(parseTaskMonth(null)).toBeNull()
    })
  })

  describe('recurringPeriodElapsed', () => {
    it('Monthly: a fully-elapsed past month is elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'May Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
    it('Monthly: the current month is NOT elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'June Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(false)
    })
    it('Monthly: a future month is NOT elapsed', () => {
      expect(recurringPeriodElapsed({ task: 'September Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(false)
    })
    it('Monthly with an unparseable name falls back to elapsed=true (strict presence check)', () => {
      expect(recurringPeriodElapsed({ task: 'Recurring Prof Test #4', frequency: 'Monthly', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
    it('Annual: the current year is NOT elapsed, a past year is', () => {
      expect(recurringPeriodElapsed({ task: 'AFFSA Annual', frequency: 'Annual', year_label: '2026' }, '2026-06-30')).toBe(false)
      expect(recurringPeriodElapsed({ task: 'AFFSA Annual', frequency: 'Annual', year_label: '2025' }, '2026-06-30')).toBe(true)
    })
    it('unknown / As Required falls back to elapsed=true (strict)', () => {
      expect(recurringPeriodElapsed({ task: 'X', frequency: 'As Required', year_label: '2026' }, '2026-06-30')).toBe(true)
    })
  })
```

Add the two names to the import at the top of the test file:

```ts
import {
  computeNextDue, dueStatus, ratApplies, complianceTone, statusTone,
  parseTaskMonth, recurringPeriodElapsed,
} from '@/lib/amtr/status'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/amtr-status.test.ts`
Expected: FAIL — `parseTaskMonth`/`recurringPeriodElapsed` are not exported.

- [ ] **Step 3: Implement the helpers** — add to `lib/amtr/status.ts` after `computeNextDue` (before `dueStatus`):

```ts
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]

/** Calendar month 1–12 parsed from a task label, or null when none present. */
export function parseTaskMonth(task: string | null | undefined): number | null {
  if (!task) return null
  const lower = task.toLowerCase()
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (new RegExp(`\\b${MONTH_NAMES[i]}\\b`).test(lower)) return i + 1
  }
  return null
}

/** Last calendar day of {year}-{month} (1-based) as YYYY-MM-DD. */
function monthEndIso(year: number, month: number): string {
  // Date.UTC month is 0-based; day 0 → last day of the prior 0-based month,
  // which is the last day of the 1-based `month`.
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

const YEAR_RECURRENCES = new Set(['Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Triennial'])

/**
 * Whether a recurring catalog item's period has fully elapsed as of `today`
 * (YYYY-MM-DD) — i.e. we now *expect* a documented record. Monthly items use
 * their named month within `year_label`; other recognized recurrences use the
 * year. Items whose period can't be derived (renamed monthly rows, unknown /
 * As Required frequency) return true so the scan keeps a strict presence check.
 */
export function recurringPeriodElapsed(
  item: { task?: string | null; frequency?: string | null; year_label?: string | null },
  today: string,
): boolean {
  const year = Number(String(item.year_label ?? '').slice(0, 4)) || Number(today.slice(0, 4))
  const freq = item.frequency ?? ''
  if (freq === 'Monthly') {
    const month = parseTaskMonth(item.task)
    if (month == null) return true            // renamed row → strict fallback
    return monthEndIso(year, month) < today   // month fully elapsed
  }
  if (YEAR_RECURRENCES.has(freq)) {
    return `${year}-12-31` < today
  }
  return true                                 // unknown / As Required → strict
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/amtr-status.test.ts`
Expected: PASS (all, including the pre-existing `dueStatus`/`computeNextDue` cases).

- [ ] **Step 5: Build + commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/status.ts tests/amtr-status.test.ts
git commit -m "feat(amtr): add parseTaskMonth + recurringPeriodElapsed period helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Period-aware rule 6.3 in the scan engine

**Files:**
- Modify: `lib/amtr/inspection-engine.ts:244-253`
- Test: `tests/amtr-inspection-engine.test.ts`

- [ ] **Step 1: Write failing tests** — append inside `describe('runInspectionScan', …)` in `tests/amtr-inspection-engine.test.ts`:

```ts
  it('1098_all_documented: future and current months are not flagged as missing', () => {
    // today defaults to 2026-06-02 in baseData. Catalog has Jan (past), June
    // (current), Sep (future) monthly rows, none with a progress row.
    const r1098Catalog = [
      { id: 'k1', task: 'January Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' },
      { id: 'k2', task: 'June Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' },
      { id: 'k3', task: 'September Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' },
    ]
    const r = runInspectionScan(baseData({ r1098Catalog, r1098Progress: [] }))
    expect(r['1098_all_documented'].auto).toBe('no')           // January is overdue
    const text = r['1098_all_documented'].findings.join(' ')
    expect(text).toContain('January')
    expect(text).not.toContain('June')                          // current month
    expect(text).not.toContain('September')                     // future month
  })

  it('1098_all_documented: yes when every elapsed item has a progress row', () => {
    const r1098Catalog = [{ id: 'k1', task: 'January Monthly Proficiency Test', frequency: 'Monthly', year_label: '2026' }]
    const r1098Progress = [{ id: 'p1', catalog_id: 'k1' }]
    expect(runInspectionScan(baseData({ r1098Catalog, r1098Progress }))['1098_all_documented'].auto).toBe('yes')
  })

  it('1098_all_documented: a renamed monthly row with no record is still flagged (strict fallback)', () => {
    const r1098Catalog = [{ id: 'k1', task: 'Recurring Prof Test #4', frequency: 'Monthly', year_label: '2026' }]
    const r = runInspectionScan(baseData({ r1098Catalog, r1098Progress: [] }))
    expect(r['1098_all_documented'].auto).toBe('no')
    expect(r['1098_all_documented'].findings.join(' ')).toContain('Recurring Prof Test #4')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts -t 1098_all_documented`
Expected: FAIL — June and September are currently included in the findings.

- [ ] **Step 3: Implement the gate** — in `lib/amtr/inspection-engine.ts`, add `recurringPeriodElapsed` to the existing `status` import (the file already imports from `./status`), then change rule 6.3 (currently lines 244-253):

```ts
// 6.3 — every elapsed 1098 catalog item has a progress row
{
  const catalog = live(d.r1098Catalog)
  if (catalog.length === 0) set('1098_all_documented', 'na')
  else {
    const documented = new Set(d.r1098Progress.map((p) => String(p.catalog_id)))
    const missing = catalog
      .filter((c) => !documented.has(String(c.id)))
      .filter((c) => recurringPeriodElapsed(c as { task?: string | null; frequency?: string | null; year_label?: string | null }, d.today))
      .map((c) => String(c.task ?? c.id))
    set('1098_all_documented', missing.length ? 'no' : 'yes', summarize(missing, '1098 requirement(s) with no record'))
  }
}
```

(Find the current `import { … } from './status'` line and add `recurringPeriodElapsed` to it. If the engine does not yet import from `./status`, add `import { recurringPeriodElapsed } from './status'` near the other imports.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/amtr-inspection-engine.test.ts`
Expected: PASS (new cases + all existing engine cases).

- [ ] **Step 5: Build + commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/inspection-engine.ts tests/amtr-inspection-engine.test.ts
git commit -m "fix(amtr): scan rule 6.3 only flags 1098 records for elapsed periods

Future and current-month monthly proficiency tests no longer reported as
missing. Renamed/unknown rows keep the strict presence check.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `dueStatus` — completed items with a near-future due read Complete

**Files:**
- Modify: `lib/amtr/status.ts` (the `dueStatus` future-due branch)
- Test: `tests/amtr-status.test.ts`

- [ ] **Step 1: Write failing tests** — append inside the `describe('dueStatus', …)` block in `tests/amtr-status.test.ts`:

```ts
    it('a completed item whose next due is within the due-soon window reads complete (not due_soon)', () => {
      // Regression guard: a freshly-completed Monthly item (next due ~30 days out)
      // must show Complete, not Due Soon. Locks the loosened invariant.
      expect(dueStatus({ dueDate: '2026-06-10', completedDate: '2026-05-10' }, today)).toBe('complete')
    })
    it('an uncompleted item within the due-soon window still reads due_soon', () => {
      expect(dueStatus({ dueDate: '2026-06-10' }, today)).toBe('due_soon')
    })
```

(`today` is `2026-05-20` in this block; due `2026-06-10` is 21 days out — inside `DUE_SOON_DAYS`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/amtr-status.test.ts -t "due-soon window reads complete"`
Expected: FAIL — currently returns `'due_soon'` because the due-soon check precedes the completion check.

- [ ] **Step 3: Implement** — in `lib/amtr/status.ts`, change the future-due branch of `dueStatus` (currently lines 76-77):

```ts
    if (delta <= DUE_SOON_DAYS) return 'due_soon'
    return completed ? 'complete' : 'upcoming'
```

to:

```ts
    if (completed) return 'complete'   // current cycle satisfied; next due is in the future
    if (delta <= DUE_SOON_DAYS) return 'due_soon'
    return 'upcoming'
```

Also update the doc comment above `dueStatus` (the `- due_soon:` line) to read:
`* - due_soon: due within DUE_SOON_DAYS and not yet completed for this cycle`.

- [ ] **Step 4: Run the full status + dependent suites**

Run: `npx vitest run tests/amtr-status.test.ts tests/amtr-rollup.test.ts tests/amtr-report-rows.test.ts tests/amtr-reconcile-core.test.ts`
Expected: PASS. If any pre-existing assertion expected `due_soon` for an item that also carries a completion date, that assertion encoded the old behavior — update it to `complete` (this is the intended change). Note any such edits in the commit body.

- [ ] **Step 5: Build + commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/status.ts tests/amtr-status.test.ts
git commit -m "fix(amtr): completed item with a near-future due reads Complete, not Due Soon

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Inspection item fields + normalizer

**Files:**
- Modify: `lib/supabase/amtr-inspections.ts` (type + new pure helper)
- Test: `tests/amtr-inspection-item.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `tests/amtr-inspection-item.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeInspectionItem, type InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

const base: InspectionItemResponse = { item_number: '6.3', status: 'no', auto: 'no', findings: ['Jan', 'Mar'], note: '' }

describe('normalizeInspectionItem', () => {
  it('seeds detail from findings when absent', () => {
    expect(normalizeInspectionItem(base).detail).toBe('Jan · Mar')
  })
  it('keeps an existing edited detail', () => {
    expect(normalizeInspectionItem({ ...base, detail: 'edited' }).detail).toBe('edited')
  })
  it('migrates a legacy note into correctiveAction', () => {
    expect(normalizeInspectionItem({ ...base, note: 'counseled' }).correctiveAction).toBe('counseled')
  })
  it('prefers an explicit correctiveAction over the legacy note', () => {
    expect(normalizeInspectionItem({ ...base, note: 'old', correctiveAction: 'new' }).correctiveAction).toBe('new')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/amtr-inspection-item.test.ts`
Expected: FAIL — `normalizeInspectionItem` is not exported.

- [ ] **Step 3: Implement** — in `lib/supabase/amtr-inspections.ts`, extend the type and add the helper. Replace the `InspectionItemResponse` type (lines 12-18) with:

```ts
export type InspectionItemResponse = {
  item_number: string
  status: 'yes' | 'no' | 'na' | null
  auto: 'yes' | 'no' | 'na' | null
  findings: string[]            // raw auto findings — immutable audit source
  detail?: string               // editable finding text (seeded from findings)
  correctiveAction?: string     // inspector corrective action
  note?: string                 // deprecated: read on load, migrated to correctiveAction
}

/** Fill detail/correctiveAction for back-compat with rows saved before these fields. */
export function normalizeInspectionItem(it: InspectionItemResponse): InspectionItemResponse {
  return {
    ...it,
    detail: it.detail ?? (it.findings ?? []).join(' · '),
    correctiveAction: it.correctiveAction ?? it.note ?? '',
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/amtr-inspection-item.test.ts`
Expected: PASS.

- [ ] **Step 5: Build + commit**

```bash
npx tsc --noEmit
npm run build
git add lib/supabase/amtr-inspections.ts tests/amtr-inspection-item.test.ts
git commit -m "feat(amtr): inspection item gains editable detail + correctiveAction fields

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Inspect page — editable detail + Corrective Action UI

**Files:**
- Modify: `app/(app)/amtr/[memberId]/inspect/page.tsx`

This is a UI change verified by `tsc` + `build`; there is no unit harness for the page.

- [ ] **Step 1: Import the normalizer** — add `normalizeInspectionItem` to the existing import from `@/lib/supabase/amtr-inspections` near the top of the file.

- [ ] **Step 2: Seed detail/correctiveAction on load** — in `load()` (around lines 146-156), change the built-item mapping so prior items are normalized and fresh items seed `detail` from findings:

```ts
    const built: InspectionItemResponse[] = cl.filter((r) => r.kind === 'item').map((r) => {
      const s = r.auto_key ? scan[r.auto_key as keyof typeof scan] : undefined
      const ex = prior.get(r.item_number)
      const findings = s?.findings ?? []
      if (ex) {
        return normalizeInspectionItem({
          item_number: r.item_number,
          status: ex.status,
          auto: s?.auto ?? null,
          findings,                                   // refresh auto findings
          detail: ex.detail ?? findings.join(' · '),  // keep an edited detail; else reseed
          correctiveAction: ex.correctiveAction ?? ex.note ?? '',
        })
      }
      return {
        item_number: r.item_number,
        status: s?.auto ?? null,
        auto: s?.auto ?? null,
        findings,
        detail: findings.join(' · '),
        correctiveAction: '',
      }
    })
```

- [ ] **Step 3: Generalize the field setter** — replace `setItemNote` (lines 186-188) with a generic field setter:

```ts
  const setItemField = (item_number: string, field: 'detail' | 'correctiveAction', value: string) => {
    setItems((prev) => { const next = prev.map((it) => it.item_number === item_number ? { ...it, [field]: value } : it); queueSave(next, notes); return next })
  }
```

- [ ] **Step 4: Replace the findings display + note textarea** — in the item render (lines 363-389), replace the read-only findings `div` and the comment IIFE with an editable Detail textarea and a labelled Corrective Action textarea:

```tsx
                      {resp && (resp.detail !== undefined || resp.findings.length > 0) && (
                        <div style={{ marginLeft: 42, marginTop: 6 }}>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', marginBottom: 2 }}>⚠ Findings</div>
                          <textarea className="input-dark" rows={2}
                            placeholder="Finding detail…"
                            style={{ width: '100%', resize: 'vertical', fontSize: 'var(--fs-xs)' }}
                            value={resp.detail ?? resp.findings.join(' · ')}
                            disabled={status === 'completed' || !canWrite}
                            onChange={(e) => setItemField(it.item_number, 'detail', e.target.value)} />
                        </div>
                      )}
                      {resp && resp.auto != null && (
                        <div style={{ marginLeft: 42, marginTop: 2, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>auto-suggested: {resp.auto.toUpperCase()}</div>
                      )}
                      {resp && resp.auto == null && (
                        <div style={{ marginLeft: 42, marginTop: 2, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>manual review — no automated check for this item</div>
                      )}
                      {(() => {
                        const showCa = resp?.status === 'no' || !!resp?.correctiveAction || commentOpen.has(it.item_number)
                        if (!showCa) {
                          return (status !== 'completed' && canWrite) ? (
                            <button onClick={() => setCommentOpen((p) => { const n = new Set(p); n.add(it.item_number); return n })}
                              style={{ marginLeft: 42, marginTop: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-accent)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                              + Add corrective action
                            </button>
                          ) : null
                        }
                        return (
                          <div style={{ marginLeft: 42, marginTop: 6 }}>
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 2 }}>Corrective Action</div>
                            <textarea className="input-dark" rows={2}
                              placeholder="Corrective action taken / planned…"
                              style={{ width: '100%', resize: 'vertical', fontSize: 'var(--fs-xs)' }}
                              value={resp?.correctiveAction ?? ''} disabled={status === 'completed' || !canWrite}
                              onChange={(e) => setItemField(it.item_number, 'correctiveAction', e.target.value)} />
                          </div>
                        )
                      })()}
```

- [ ] **Step 5: Verify build + type-check, then commit**

```bash
npx tsc --noEmit
npm run build
git add "app/(app)/amtr/[memberId]/inspect/page.tsx"
git commit -m "feat(amtr): editable finding detail + Corrective Action per inspection item

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `buildInspection623aComment` composer

**Files:**
- Create: `lib/amtr/inspection-623a.ts`
- Test: `tests/amtr-inspection-623a.test.ts` (new)

- [ ] **Step 1: Write the failing test** — create `tests/amtr-inspection-623a.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildInspection623aComment } from '@/lib/amtr/inspection-623a'
import type { InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

const item = (over: Partial<InspectionItemResponse>): InspectionItemResponse => ({
  item_number: '6.3', status: 'no', auto: 'no', findings: [], ...over,
})

describe('buildInspection623aComment', () => {
  it('uses the recordsInspection template header + cite', () => {
    const out = buildInspection623aComment({ inspectionDate: '2026-06-30', inspectorName: 'SMSgt Proctor', items: [] })
    expect(out).toContain('Monthly Training Records Inspection')
    expect(out).toContain('IAW DAFMAN 13-204v2 Para 2.6.2.8')
    expect(out).toContain('Inspection Date: 2026-06-30')
    expect(out).toContain('Inspector: SMSgt Proctor')
  })
  it('reads "No discrepancies noted." with zero gaps', () => {
    expect(buildInspection623aComment({ inspectionDate: '2026-06-30', items: [item({ status: 'yes' })] }))
      .toContain('No discrepancies noted.')
  })
  it('lists item number, detail, and corrective action for each gap', () => {
    const out = buildInspection623aComment({
      inspectionDate: '2026-06-30',
      items: [
        item({ item_number: '6.3', status: 'no', detail: 'missing Jan, Mar Proficiency Test', correctiveAction: 'counseled; due by 15th' }),
        item({ item_number: '4.1', status: 'yes' }),
      ],
    })
    expect(out).toContain('Discrepancies (1):')
    expect(out).toContain('6.3 — missing Jan, Mar Proficiency Test')
    expect(out).toContain('Corrective Action: counseled; due by 15th')
    expect(out).not.toContain('4.1')   // only gaps listed
  })
  it('falls back to findings when detail is absent', () => {
    const out = buildInspection623aComment({ inspectionDate: '2026-06-30', items: [item({ status: 'no', findings: ['A', 'B'] })] })
    expect(out).toContain('6.3 — A · B')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/amtr-inspection-623a.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement** — create `lib/amtr/inspection-623a.ts`:

```ts
import { COMMENT_TEMPLATES } from './reference-data'
import type { InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

/**
 * Compose the NAMT/Certifier 623a comment for a completed records inspection,
 * using the recordsInspection DAFMAN template header and listing each
 * discrepancy's item number, detail, and corrective action.
 */
export function buildInspection623aComment(input: {
  inspectionDate: string
  inspectorName?: string | null
  items: InspectionItemResponse[]
}): string {
  const tpl = COMMENT_TEMPLATES.find((t) => t.key === 'recordsInspection')
  const header = tpl ? `(${tpl.label} — IAW ${tpl.cite})` : '(Monthly Training Records Inspection)'
  const gaps = input.items.filter((it) => it.status === 'no')

  const lines: string[] = [header, '', `Inspection Date: ${input.inspectionDate}`]
  if (input.inspectorName) lines.push(`Inspector: ${input.inspectorName}`)
  lines.push('')

  if (gaps.length === 0) {
    lines.push('No discrepancies noted.')
  } else {
    lines.push(`Discrepancies (${gaps.length}):`)
    for (const g of gaps) {
      const detail = (g.detail ?? (g.findings ?? []).join(' · ')).trim()
      lines.push(`${g.item_number} — ${detail || 'discrepancy noted'}`)
      const ca = (g.correctiveAction ?? g.note ?? '').trim()
      if (ca) lines.push(`      Corrective Action: ${ca}`)
    }
  }
  return lines.join('\n')
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/amtr-inspection-623a.test.ts`
Expected: PASS.

- [ ] **Step 5: Build + commit**

```bash
npx tsc --noEmit
npm run build
git add lib/amtr/inspection-623a.ts tests/amtr-inspection-623a.test.ts
git commit -m "feat(amtr): compose records-inspection 623a comment from template + gaps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire the composer into `completeAmtrInspection`

**Files:**
- Modify: `lib/supabase/amtr-inspections.ts:104-131`

- [ ] **Step 1: Import the composer** — add to the imports at the top of `lib/supabase/amtr-inspections.ts`:

```ts
import { buildInspection623aComment } from '@/lib/amtr/inspection-623a'
```

- [ ] **Step 2: Replace the summary string** — in `completeAmtrInspection`, replace the `const summary = …` line (line 114) with:

```ts
  const summary = buildInspection623aComment({
    inspectionDate: input.inspection_date,
    inspectorName: input.completed_by_name,
    items: input.items,
  })
```

(The existing `namt_comment: summary` upsert is unchanged.)

- [ ] **Step 3: Type-check + run inspection tests**

Run: `npx tsc --noEmit && npx vitest run tests/amtr-inspection-623a.test.ts tests/amtr-inspection-item.test.ts`
Expected: PASS, no type errors. (Confirms no circular-import breakage — `inspection-623a` imports the `InspectionItemResponse` type from `amtr-inspections` as a type-only import, so there is no runtime cycle.)

- [ ] **Step 4: Build + commit**

```bash
npm run build
git add lib/supabase/amtr-inspections.ts
git commit -m "feat(amtr): completed inspection writes a detailed template-based 623a entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 1098 certifier-sign completion + always-recompute

**Files:**
- Modify: `components/amtr/form1098-tab.tsx`

UI/logic change verified by `tsc` + `build`. `computeNextDue` (the recompute primitive) is already unit-tested.

- [ ] **Step 1: Add `completeItem`** — in `form1098-tab.tsx`, immediately before `setField` (line 276), add a reusable completion writer that stamps the completion date, recomputes the due (always — no manual-override guard), and runs the later-year rollover seeding:

```ts
  // Mark a 1098 item complete: stamp last_completed, recompute next_due from
  // frequency (clearing any manual override), and seed next year's row when the
  // computed due lands in a later, already-open catalog year. Does NOT reload —
  // the caller decides when to refresh.
  const completeItem = async (catId: string, freq: string, completedDate: string) => {
    const value = completedDate || ''
    const nextDue = value ? computeNextDue(value, freq) : null
    const { error } = await upsertAmtrRow(
      'amtr_1098_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year,
        last_completed: value || null, next_due: nextDue, next_due_manual: false },
      { onConflict: 'member_id,catalog_id,year_label' },
    )
    if (error) { toast.error(error); return }
    if (value && nextDue) {
      const nextYear = String(new Date(`${String(nextDue).slice(0, 10)}T00:00:00Z`).getUTCFullYear())
      if (Number(nextYear) > Number(year)) {
        const thisYearCat = yearCatalog.find((c) => String(c.id) === catId)
        if (thisYearCat) {
          const nextYearCatRows = catalog.filter((c) => String(c.year_label) === nextYear)
          const target = nextYearCatRows.find((c) => String(c.task) === String(thisYearCat.task))
          if (target) {
            const existsNext = progress.some((x) => String(x.year_label) === nextYear && String(x.catalog_id) === String(target.id))
            if (!existsNext) {
              const { error: rolloverErr } = await upsertAmtrRow(
                'amtr_1098_progress',
                { base_id: installationId, member_id: memberId, catalog_id: String(target.id), year_label: nextYear, next_due: nextDue },
                { onConflict: 'member_id,catalog_id,year_label' },
              )
              if (rolloverErr) { toast.error(rolloverErr); return }
            }
          }
        }
      }
    }
  }
```

- [ ] **Step 2: Route the manual `last_completed` edit through `completeItem`** — in `setField` (lines 276-331), replace the whole `last_completed`-handling logic so a manual date edit always recomputes (dropping the `next_due_manual` guard at line 283 and the inline rollover block at lines 294-329). Change the body of `setField` to:

```ts
  const setField = async (catId: string, freq: string, field: string, value: string) => {
    if (field === 'last_completed') {
      await completeItem(catId, freq, value)
      onChange()
      return
    }
    const patch: Row = { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year, [field]: value || null }
    if (field === 'next_due') {
      // Manual edit of the due date flips the override flag so completion
      // recompute is the only thing that clears it (via completeItem).
      patch.next_due_manual = !!value
    }
    const { error } = await upsertAmtrRow('amtr_1098_progress', patch, { onConflict: 'member_id,catalog_id,year_label' })
    if (error) { toast.error(error); return }
    onChange()
  }
```

- [ ] **Step 3: Auto-complete on Cert Official signature** — in `signCell`, extend the `sign(...)` `onSigned` callback (lines 458-462) so a certifier sign-off completes the item. Preserve an already-entered completion date if present (the trainee/manager may have recorded the real date); otherwise stamp today:

```ts
                    await sign('amtr_1098_progress', rid, slot, async () => {
                      if (slot === 'certifier') {
                        const today = new Date().toISOString().slice(0, 10)
                        await completeItem(catId, freq, (p?.last_completed as string) || today)
                      }
                      if (slot !== 'trainee' && member.user_id) {
                        const draft: NotificationDraft = buildSignoff(member.full_name, slot as AmtrRole, 'DAF 1098', String(c.task), catId, '1098')
                        await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...draft })
                      }
                    }, {
```

(The parent `sign` calls `loadTab()` right after `onSigned`, so the row re-keys and the status pill flips to Complete without a manual refresh.)

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build compiles. (`p`, `c`, `catId`, `freq`, `year`, `yearCatalog`, `catalog`, `progress`, `installationId`, `memberId`, `member`, `computeNextDue`, `upsertAmtrRow` are all already in scope at these sites.)

- [ ] **Step 5: Commit**

```bash
git add components/amtr/form1098-tab.tsx
git commit -m "fix(amtr): Cert Official signature auto-completes a 1098 item

Stamps the completion (preserving an entered date), recomputes the due date
from frequency, and rolls the status to Complete without a manual refresh.
Manual Last Completed edits now always recompute the due date.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full-suite gate + manual smoke checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all pass (the session baseline was 1032 pass / 112 files; expect that plus the new cases).

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean compile, build success (RC 0).

- [ ] **Step 3: Record the manual smoke checklist** (run after the user promotes the build — do not promote):
  - Open a member's record-inspection mid-year → no future/current-month proficiency tests appear in the 6.3 "missing record" findings; a past month with no record still appears.
  - Edit a discrepancy's Finding detail and fill its Corrective Action; reload the draft → both persist.
  - Complete the inspection → open the generated 623a "Monthly Training Records Inspection" entry → NAMT comment shows the template header, item numbers, edited details, and corrective actions; a clean record reads "No discrepancies noted."
  - On the 1098 tab, Cert Official-sign a recurring item that is not yet due → Last Completed stamps, Due rolls forward by frequency, status flips to Complete with no page refresh.
  - Manually type a Last Completed date on another item → Due recomputes immediately (even if a manual due override was previously set).

---

## Self-review notes

- **Spec coverage:** Part 1 → Tasks 1-2; Part 2 → Tasks 4-5; Part 3 → Tasks 6-7; Part 4 → Tasks 3 (dueStatus) + 8 (completion). All four spec parts mapped.
- **Type consistency:** `InspectionItemResponse` (with `detail?`/`correctiveAction?`) defined in Task 4 is consumed identically in Tasks 5, 6, 7. `completeItem(catId, freq, completedDate)`, `setItemField(item_number, field, value)`, `buildInspection623aComment({inspectionDate, inspectorName, items})`, `recurringPeriodElapsed(item, today)`, `parseTaskMonth(task)` signatures are used consistently across tasks.
- **Refinement vs spec:** Task 8 preserves an already-entered `last_completed` on certifier sign rather than unconditionally overwriting with today (avoids clobbering a real recorded completion date); the spec's "= today" applies when no date is present.
