# Records Export — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for the Records Export feature — register the `exports:read`/`exports:write` permission, build the pure-logic scope layer (module registry + period resolution + month bucketing), and ship a permission-gated `/settings/exports` page shell.

**Architecture:** A new `lib/export/` directory holds the export logic. Phase 1 delivers only the pure, DB-free pieces (a static module registry + deterministic date functions, fully unit-tested) plus a client page that gates on the new permission and renders the three-step form scaffold (Generate is disabled until Phase 4). No data is fetched or packaged yet.

**Tech Stack:** Next.js 14 App Router (client components), TypeScript (strict), Supabase Postgres + RLS permission matrix, Vitest + jsdom for tests.

**Scope note:** This is the first of several phase plans for the feature designed in `docs/superpowers/specs/2026-05-29-records-export-design.md`. Phases 2–7 (PDF layer, Excel layer, packager, photos, viewer, sidecar) each get their own plan.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `supabase/migrations/2026061900_exports_permission_keys.sql` | Create | Register `exports:read`/`exports:write`; grant to admin + AFM tier roles |
| `lib/permissions.ts` | Modify | Mirror the two new keys in the `PERM` constant |
| `lib/export/export-modules.ts` | Create | Static module registry: per-module key, label, PDF strategy, applicability |
| `lib/export/export-period.ts` | Create | Pure date logic: quick-period resolution, range membership, month bucketing |
| `tests/export-period.test.ts` | Create | Unit tests for `export-period.ts` |
| `tests/export-modules.test.ts` | Create | Unit tests for the registry shape/invariants |
| `app/(app)/settings/exports/page.tsx` | Create | Permission-gated page shell with the three-step form scaffold |
| `components/layout/sidebar-nav.tsx` | Modify | Add `/settings/exports` → `exports:read` to `HREF_TO_VIEW_PERM` |

---

## Task 1: Register the export permission keys

**Files:**
- Create: `supabase/migrations/2026061900_exports_permission_keys.sql`
- Modify: `lib/permissions.ts` (add to the `PERM` object)

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/2026061900_exports_permission_keys.sql`. Modeled on `2026052000_amtr_permissions.sql`. Grants to the AFM-tier roles (`airfield_manager`, `namo` — the AFM-equivalent — and `base_admin`) plus `sys_admin`.

```sql
-- Records Export permission keys.
-- exports:read  → see and configure the /settings/exports page
-- exports:write → generate/download an export (records leave the app as files)
-- Granted to sys_admin + the AFM-tier roles (airfield_manager, namo, base_admin).
-- Uses the permission matrix (permissions + role_permissions). No dropped helpers.

INSERT INTO permissions (key, label, category, description) VALUES
  ('exports:read',  'View Records Export',     'exports', 'Open and configure the Records Export page'),
  ('exports:write', 'Generate Records Export', 'exports', 'Generate and download a records export (PDF/Excel/photos/viewer)')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- sys_admin gets everything (explicit for idempotence)
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'exports:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- AFM-tier — full export access at base
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (SELECT key FROM permissions WHERE key LIKE 'exports:%') AS p
ON CONFLICT (role, permission_key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration to the linked DB**

Per project convention (never `db push`; apply single migrations directly):

Run: `npx supabase db query --linked --file supabase/migrations/2026061900_exports_permission_keys.sql`
Expected: command exits 0 (no rows returned; these are INSERTs).

- [ ] **Step 3: Verify the keys + grants landed**

Create a throwaway file `tmp_verify_exports_perm.sql`:

```sql
SELECT rp.role, rp.permission_key
FROM role_permissions rp
WHERE rp.permission_key LIKE 'exports:%'
ORDER BY rp.permission_key, rp.role;
```

Run: `npx supabase db query --linked --file tmp_verify_exports_perm.sql`
Expected: 8 rows — `exports:read` and `exports:write` each granted to `airfield_manager`, `base_admin`, `namo`, `sys_admin`.
Then delete the temp file: `rm tmp_verify_exports_perm.sql`

- [ ] **Step 4: Mirror the keys in the `PERM` constant**

In `lib/permissions.ts`, inside the `PERM = { ... } as const` object, add an Exports block (place it near the AMTR/SMS blocks, before the closing `} as const`):

```typescript
  // Records Export
  EXPORTS_READ:                         'exports:read',
  EXPORTS_WRITE:                        'exports:write',
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/2026061900_exports_permission_keys.sql lib/permissions.ts
git commit -m "feat(exports): register exports:read/write permission keys"
```

---

## Task 2: Export module registry

**Files:**
- Create: `lib/export/export-modules.ts`
- Test: `tests/export-modules.test.ts`

The registry is the single source of truth for which modules export and how. Phase 1 needs module-level metadata only (no table-fetch wiring yet).

- [ ] **Step 1: Write the failing test**

Create `tests/export-modules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { EXPORT_MODULES, type ExportModule } from '@/lib/export/export-modules'

describe('EXPORT_MODULES registry', () => {
  it('has unique module keys', () => {
    const keys = EXPORT_MODULES.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses only valid pdf strategies', () => {
    const valid = new Set(['per_record', 'monthly', 'excluded'])
    for (const m of EXPORT_MODULES) {
      expect(valid.has(m.pdfStrategy)).toBe(true)
    }
  })

  it('marks AMTR as excluded (its own export covers it)', () => {
    const amtr = EXPORT_MODULES.find((m) => m.key === 'amtr')
    expect(amtr?.pdfStrategy).toBe('excluded')
  })

  it('sets Waivers, ACSI, and Civilian Training as per-record PDFs', () => {
    for (const key of ['waivers', 'acsi', 'training_part139']) {
      const m = EXPORT_MODULES.find((x) => x.key === key)
      expect(m, key).toBeDefined()
      expect(m?.pdfStrategy, key).toBe('per_record')
    }
  })

  it('sets Discrepancies and Events Log as monthly PDFs', () => {
    for (const key of ['discrepancies', 'events_log']) {
      expect(EXPORT_MODULES.find((x) => x.key === key)?.pdfStrategy, key).toBe('monthly')
    }
  })

  it('scopes SMS, AEP, and Civilian Training to civilian airports', () => {
    for (const key of ['sms', 'aep', 'training_part139']) {
      expect(EXPORT_MODULES.find((x) => x.key === key)?.appliesTo, key).toBe('civilian')
    }
  })

  it('every non-excluded module declares a primary date column', () => {
    for (const m of EXPORT_MODULES) {
      if (m.pdfStrategy === 'excluded') continue
      expect(typeof m.dateColumn, m.key).toBe('string')
      expect(m.dateColumn.length, m.key).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-modules.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/export-modules`.

- [ ] **Step 3: Write the registry**

Create `lib/export/export-modules.ts`:

```typescript
// Records Export — module registry.
// Single source of truth for which modules export and how. See
// docs/superpowers/specs/2026-05-29-records-export-design.md §4.
//
// pdfStrategy:
//   'per_record' → one PDF per record (Waivers, ACSI, Civilian Training)
//   'monthly'    → one PDF per calendar month, records grouped inside
//   'excluded'   → no generated PDF/Excel here (AMTR uses its own export)
//
// appliesTo:
//   'both'     → military and civilian airports
//   'civilian' → FAA Part 139 airports only (airport_type = 'faa_part139')
//   'military' → USAF airfields only
//
// dateColumn is the record's "natural date" used for date-range filtering
// and monthly bucketing. Confirmed against the live schema 2026-05-29
// (every listed table has the named column). Excluded modules omit it.

export type PdfStrategy = 'per_record' | 'monthly' | 'excluded'
export type AppliesTo = 'both' | 'civilian' | 'military'

export interface ExportModule {
  /** Stable registry key (also the documents/ + spreadsheets/ folder name source) */
  key: string
  /** Human label for the UI + cover sheet */
  label: string
  /** Folder name under documents/ and spreadsheets/ */
  folder: string
  pdfStrategy: PdfStrategy
  appliesTo: AppliesTo
  /** Natural-date column for filtering/bucketing ('' for excluded modules) */
  dateColumn: string
}

export const EXPORT_MODULES: ExportModule[] = [
  // ── Per-record PDFs ──────────────────────────────────────
  { key: 'waivers',          label: 'Waivers (AF 505)',        folder: 'Waivers',     pdfStrategy: 'per_record', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'acsi',             label: 'ACSI Inspections',        folder: 'ACSI',        pdfStrategy: 'per_record', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'training_part139', label: 'Training (§139.303)',     folder: 'Training',    pdfStrategy: 'per_record', appliesTo: 'civilian', dateColumn: 'created_at' },

  // ── Monthly-grouped PDFs ─────────────────────────────────
  { key: 'discrepancies',    label: 'Discrepancies',           folder: 'Discrepancies', pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'inspections',      label: 'Inspections',             folder: 'Inspections',   pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'checks',           label: 'Airfield Checks',         folder: 'Checks',        pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'obstructions',     label: 'Obstructions',            folder: 'Obstructions',  pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'events_log',       label: 'Events Log',              folder: 'Events-Log',    pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'daily_reviews',    label: 'Daily Reviews',           folder: 'Daily-Reviews', pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'review_date' },
  { key: 'wildlife',         label: 'Wildlife Log',            folder: 'Wildlife',      pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'ppr',              label: 'PPR',                     folder: 'PPR',           pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'personnel',        label: 'Personnel / Contractors', folder: 'Personnel',     pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'scn',              label: 'SCN Tests',               folder: 'SCN',           pdfStrategy: 'monthly', appliesTo: 'both',     dateColumn: 'created_at' },
  { key: 'sms',              label: 'SMS',                     folder: 'SMS',           pdfStrategy: 'monthly', appliesTo: 'civilian', dateColumn: 'created_at' },
  { key: 'aep',              label: 'AEP',                     folder: 'AEP',           pdfStrategy: 'monthly', appliesTo: 'civilian', dateColumn: 'created_at' },

  // ── Excluded (own export) ────────────────────────────────
  { key: 'amtr',             label: 'AMTR Training Record',    folder: 'AMTR',          pdfStrategy: 'excluded',  appliesTo: 'military', dateColumn: '' },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-modules.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-modules.ts tests/export-modules.test.ts
git commit -m "feat(exports): add module registry with PDF strategy + applicability"
```

---

## Task 3: Period resolution (quick periods + range membership)

**Files:**
- Create: `lib/export/export-period.ts`
- Test: `tests/export-period.test.ts`

All date math is done in UTC and on the `YYYY-MM-DD` portion only, so it is deterministic and timezone-independent. Functions take an explicit `now` so tests don't depend on the clock.

- [ ] **Step 1: Write the failing test**

Create `tests/export-period.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  resolveQuickPeriod,
  isInRange,
  type ExportPeriod,
} from '@/lib/export/export-period'

describe('resolveQuickPeriod', () => {
  it('this_month → first..last day of the current month', () => {
    expect(resolveQuickPeriod('this_month', new Date('2026-02-15T12:00:00Z')))
      .toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('this_month handles a 31-day month', () => {
    expect(resolveQuickPeriod('this_month', new Date('2026-01-09T00:00:00Z')))
      .toEqual({ from: '2026-01-01', to: '2026-01-31' })
  })

  it('last_month → previous month, wrapping the year', () => {
    expect(resolveQuickPeriod('last_month', new Date('2026-01-10T00:00:00Z')))
      .toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('this_quarter → calendar quarter containing now', () => {
    expect(resolveQuickPeriod('this_quarter', new Date('2026-05-20T00:00:00Z')))
      .toEqual({ from: '2026-04-01', to: '2026-06-30' })
  })

  it('this_fy → federal FY (Oct 1) start through now, mid-FY', () => {
    expect(resolveQuickPeriod('this_fy', new Date('2026-02-15T00:00:00Z')))
      .toEqual({ from: '2025-10-01', to: '2026-02-15' })
  })

  it('this_fy → when now is in Oct, FY starts that same Oct 1', () => {
    expect(resolveQuickPeriod('this_fy', new Date('2025-11-05T00:00:00Z')))
      .toEqual({ from: '2025-10-01', to: '2025-11-05' })
  })
})

describe('isInRange', () => {
  const range: ExportPeriod = { kind: 'range', from: '2026-02-01', to: '2026-02-28' }

  it('all_time is always in range', () => {
    expect(isInRange('1999-01-01T00:00:00Z', { kind: 'all_time' })).toBe(true)
  })

  it('includes boundary dates (inclusive both ends)', () => {
    expect(isInRange('2026-02-01T23:59:59Z', range)).toBe(true)
    expect(isInRange('2026-02-28T00:00:00Z', range)).toBe(true)
  })

  it('excludes dates outside the window', () => {
    expect(isInRange('2026-01-31T12:00:00Z', range)).toBe(false)
    expect(isInRange('2026-03-01T00:00:00Z', range)).toBe(false)
  })

  it('treats a null/empty date as not in a range window', () => {
    expect(isInRange(null, range)).toBe(false)
    expect(isInRange(undefined, range)).toBe(false)
  })

  it('includes a null date in an all_time export', () => {
    expect(isInRange(null, { kind: 'all_time' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-period.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/export-period`.

- [ ] **Step 3: Write the implementation**

Create `lib/export/export-period.ts`:

```typescript
// Records Export — period resolution.
// All math is UTC + date-portion only ('YYYY-MM-DD'), so it is deterministic
// and timezone-independent. ISO date strings sort lexicographically, which we
// rely on for range comparisons.

export type PeriodKind = 'all_time' | 'range'

export interface ExportPeriod {
  kind: PeriodKind
  /** inclusive 'YYYY-MM-DD' — required when kind === 'range' */
  from?: string
  /** inclusive 'YYYY-MM-DD' — required when kind === 'range' */
  to?: string
}

export type QuickPeriod = 'this_month' | 'last_month' | 'this_quarter' | 'this_fy'

function ymd(year: number, monthIndex0: number, day: number): string {
  const m = String(monthIndex0 + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

/** Last calendar day of a given (year, 0-based month). */
function lastDayOfMonth(year: number, monthIndex0: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate()
}

/** Resolve a quick-pick into an inclusive {from, to} date window. */
export function resolveQuickPeriod(kind: QuickPeriod, now: Date): { from: string; to: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth() // 0-based
  const d = now.getUTCDate()
  const today = ymd(y, m, d)

  switch (kind) {
    case 'this_month':
      return { from: ymd(y, m, 1), to: ymd(y, m, lastDayOfMonth(y, m)) }

    case 'last_month': {
      const lm = m === 0 ? 11 : m - 1
      const ly = m === 0 ? y - 1 : y
      return { from: ymd(ly, lm, 1), to: ymd(ly, lm, lastDayOfMonth(ly, lm)) }
    }

    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3 // 0,3,6,9
      const qEnd = qStart + 2
      return { from: ymd(y, qStart, 1), to: ymd(y, qEnd, lastDayOfMonth(y, qEnd)) }
    }

    case 'this_fy': {
      // Federal FY runs Oct 1 (month index 9) through Sep 30.
      const fyStartYear = m >= 9 ? y : y - 1
      return { from: ymd(fyStartYear, 9, 1), to: today }
    }
  }
}

/** True if a record's date falls within the period (all_time always true). */
export function isInRange(dateIso: string | null | undefined, period: ExportPeriod): boolean {
  if (period.kind === 'all_time') return true
  if (!dateIso) return false
  const day = dateIso.slice(0, 10) // 'YYYY-MM-DD'
  if (period.from && day < period.from) return false
  if (period.to && day > period.to) return false
  return true
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-period.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-period.ts tests/export-period.test.ts
git commit -m "feat(exports): add period resolution (quick picks + range membership)"
```

---

## Task 4: Month bucketing

**Files:**
- Modify: `lib/export/export-period.ts` (append the two functions)
- Modify: `tests/export-period.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/export-period.test.ts` (add the imports `monthBucket, groupByMonth` to the existing import from `@/lib/export/export-period`, then add this block):

```typescript
describe('monthBucket', () => {
  it('extracts YYYY-MM from an ISO timestamp', () => {
    expect(monthBucket('2026-02-14T09:30:00Z')).toBe('2026-02')
  })
  it('extracts YYYY-MM from a date-only string', () => {
    expect(monthBucket('2026-12-01')).toBe('2026-12')
  })
})

describe('groupByMonth', () => {
  it('buckets records by their date field and skips null dates', () => {
    const rows = [
      { id: 1, created_at: '2026-01-05T00:00:00Z' },
      { id: 2, created_at: '2026-01-20T00:00:00Z' },
      { id: 3, created_at: '2026-02-02T00:00:00Z' },
      { id: 4, created_at: null },
    ]
    const groups = groupByMonth(rows, (r) => r.created_at)
    expect([...groups.keys()].sort()).toEqual(['2026-01', '2026-02'])
    expect(groups.get('2026-01')!.map((r) => r.id)).toEqual([1, 2])
    expect(groups.get('2026-02')!.map((r) => r.id)).toEqual([3])
  })

  it('returns an empty map for no records', () => {
    expect(groupByMonth([], (r: { created_at: string }) => r.created_at).size).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-period.test.ts`
Expected: FAIL — `monthBucket`/`groupByMonth` not exported.

- [ ] **Step 3: Implement**

Append to `lib/export/export-period.ts`:

```typescript
/** 'YYYY-MM' bucket key for a record date. */
export function monthBucket(dateIso: string): string {
  return dateIso.slice(0, 7)
}

/**
 * Group records into 'YYYY-MM' buckets by a date accessor. Records whose
 * accessor returns null/undefined/empty are skipped (they cannot be bucketed).
 * Insertion order within each bucket is preserved.
 */
export function groupByMonth<T>(
  records: T[],
  getDate: (record: T) => string | null | undefined,
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const record of records) {
    const date = getDate(record)
    if (!date) continue
    const key = monthBucket(date)
    const bucket = out.get(key)
    if (bucket) bucket.push(record)
    else out.set(key, [record])
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-period.test.ts`
Expected: PASS (15 tests total in the file).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-period.ts tests/export-period.test.ts
git commit -m "feat(exports): add month bucketing helpers"
```

---

## Task 5: Permission-gated `/settings/exports` page shell

**Files:**
- Create: `app/(app)/settings/exports/page.tsx`
- Modify: `components/layout/sidebar-nav.tsx` (add href→perm mapping)

The page renders the three-step form scaffold from spec §6. Generate is disabled (wired in Phase 4). Access is gated on `PERM.EXPORTS_READ` using the `usePermissions()` hook. The module list is driven by the registry, filtered by the installation's airport type.

- [ ] **Step 1: Add the sidebar href→permission mapping**

In `components/layout/sidebar-nav.tsx`, inside the `HREF_TO_VIEW_PERM` object, add a line next to the other `/settings` entries:

```typescript
  '/settings/exports':  'exports:read',
```

- [ ] **Step 2: Write the page**

Create `app/(app)/settings/exports/page.tsx`:

```typescript
'use client'

import { useMemo, useState } from 'react'
import { Download, FileText, Sheet, Image as ImageIcon, MonitorPlay, Database } from 'lucide-react'
import { usePermissions, PERM } from '@/lib/permissions'
import { useInstallation } from '@/lib/installation-context'
import { EXPORT_MODULES, type ExportModule } from '@/lib/export/export-modules'
import { resolveQuickPeriod, type ExportPeriod, type QuickPeriod } from '@/lib/export/export-period'

type IncludeKey = 'pdf' | 'excel' | 'photos' | 'viewer' | 'json'

const QUICK: { key: QuickPeriod; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_fy', label: 'This FY' },
]

export default function ExportsPage() {
  const { has, loaded } = usePermissions()
  const { currentInstallation } = useInstallation()

  // Civilian airports expose SMS/AEP/§139.303 Training; military hide them.
  const isCivilian =
    (currentInstallation as { airport_type?: string } | null)?.airport_type === 'faa_part139'
  const modules = useMemo(
    () =>
      EXPORT_MODULES.filter((m) => {
        if (m.pdfStrategy === 'excluded') return false
        if (m.appliesTo === 'civilian') return isCivilian
        if (m.appliesTo === 'military') return !isCivilian
        return true
      }),
    [isCivilian],
  )

  const [periodKind, setPeriodKind] = useState<'all_time' | 'range'>('range')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [include, setInclude] = useState<Record<IncludeKey, boolean>>({
    pdf: true, excel: true, photos: true, viewer: true, json: false,
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(modules.map((m) => m.key)))

  // Phase 1 builds the period object but does not yet generate. Referenced so
  // the type stays exercised; Phase 4 wires it into the engine.
  const period: ExportPeriod =
    periodKind === 'all_time' ? { kind: 'all_time' } : { kind: 'range', from, to }
  void period

  function applyQuick(kind: QuickPeriod) {
    const { from: f, to: t } = resolveQuickPeriod(kind, new Date())
    setPeriodKind('range')
    setFrom(f)
    setTo(t)
  }

  function toggleModule(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!loaded) {
    return <div className="page-container">Loading…</div>
  }
  if (!has(PERM.EXPORTS_READ)) {
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>Records Export</div>
        <p style={{ color: 'var(--color-text-3)' }}>
          You don’t have access to Records Export. Contact your system or base administrator.
        </p>
      </div>
    )
  }

  const includeRows: { key: IncludeKey; label: string; icon: typeof FileText }[] = [
    { key: 'pdf', label: 'PDF documents', icon: FileText },
    { key: 'excel', label: 'Excel workbooks', icon: Sheet },
    { key: 'photos', label: 'Photos', icon: ImageIcon },
    { key: 'viewer', label: 'Interactive viewer', icon: MonitorPlay },
    { key: 'json', label: 'Raw data (JSON)', icon: Database },
  ]

  return (
    <div className="page-container">
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>Records Export</div>
      <p style={{ color: 'var(--color-text-3)', marginBottom: 20 }}>
        Produce filable, reviewable records (PDF, Excel, photos, viewer) you can use outside Glidepath.
      </p>

      {/* 1. Period */}
      <div className="section-label">1 · PERIOD</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0 20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" name="period" checked={periodKind === 'all_time'} onChange={() => setPeriodKind('all_time')} />
          All time — full export (the “leaving Glidepath” grab)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="radio" name="period" checked={periodKind === 'range'} onChange={() => setPeriodKind('range')} />
          Date range
        </label>
        {periodKind === 'range' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 24 }}>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
            {QUICK.map((q) => (
              <button key={q.key} type="button" className="chip" onClick={() => applyQuick(q.key)}>{q.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Include */}
      <div className="section-label">2 · INCLUDE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '8px 0 20px' }}>
        {includeRows.map(({ key, label, icon: Icon }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={include[key]}
              onChange={(e) => setInclude((p) => ({ ...p, [key]: e.target.checked }))}
            />
            <Icon size={14} color="var(--color-text-3)" />
            {label}
          </label>
        ))}
      </div>

      {/* 3. Modules */}
      <div className="section-label">3 · MODULES</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 24px' }}>
        {modules.map((m: ExportModule) => (
          <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={selected.has(m.key)} onChange={() => toggleModule(m.key)} />
            {m.label}
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary"
        disabled
        title="Generation is wired up in a later phase"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: 0.5 }}
      >
        <Download size={16} /> Generate Export
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (If `className="chip"`/`btn-primary` or CSS vars differ, they are styling-only and won't fail the type check.)

- [ ] **Step 4: Build to confirm the route compiles**

Run: `npm run build`
Expected: compiled successfully; a new static route `/settings/exports` appears in the route list.

- [ ] **Step 5: Manual smoke (reviewer)**

Run `npm run dev`, sign in as a sys_admin/AFM, navigate to `/settings/exports`. Confirm: the three-step form renders; All-time/Range toggle works; quick chips fill the date inputs; module list reflects the registry (and hides SMS/AEP/§139.303 Training on a military base); Generate is visibly disabled. Sign in as a `read_only` user → the page shows the access message.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/settings/exports/page.tsx components/layout/sidebar-nav.tsx
git commit -m "feat(exports): add permission-gated /settings/exports page shell"
```

---

## Task 6: Phase-1 verification gate

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run tests/export-period.test.ts tests/export-modules.test.ts`
Expected: PASS — 22 tests across 2 files (15 + 7).

- [ ] **Step 3: Full suite (no regressions)**

Run: `npx vitest run`
Expected: all pass; total count = prior baseline (584) + 22 new = 606, ± any unrelated drift. No failures.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiled successfully, `/settings/exports` route present.

- [ ] **Step 5: Update the design spec status note**

In `docs/superpowers/specs/2026-05-29-records-export-design.md`, under §9, mark Phase 1 done (change its row to prefix “✅”). Commit:

```bash
git add docs/superpowers/specs/2026-05-29-records-export-design.md
git commit -m "docs(exports): mark Phase 1 complete in the design spec"
```

---

## Self-Review notes (author)

- **Spec coverage (Phase 1 scope):** permission keys + grants (Task 1 ✓), module registry incl. AMTR-excluded / civilian-scoped / per-record-vs-monthly (Task 2 ✓), stateless period model incl. all-time + range + quick picks (Task 3 ✓), monthly bucketing for the monthly-PDF strategy (Task 4 ✓), gated `/settings/exports` shell with the §6 three-step UI (Task 5 ✓). Later phases (PDF/Excel/packager/photos/viewer/sidecar) are intentionally out of this plan.
- **No placeholders:** every code/SQL/test step is complete and copy-pasteable.
- **Type consistency:** `ExportPeriod`/`PeriodKind`/`QuickPeriod` defined in Task 3 and consumed unchanged in Task 5; `ExportModule` defined in Task 2 and consumed in Task 5; `PERM.EXPORTS_READ` defined in Task 1 and consumed in Task 5.
- **Watermark-less / FK-reached tables** and the full 111-table data layer are deferred to the data-sidecar phase — Phase 1's registry is module-level only, so no live-schema guard test is needed yet.
- **`namo` grant:** included as the AFM-equivalent alongside `airfield_manager`/`base_admin`; flag for the user in case they want it dropped to exactly the three named roles.
