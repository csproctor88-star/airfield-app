# Records Export — Phase 2b Implementation Plan (uniform table modules)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fan the proven PDF framework out to four uniform table modules — Inspections, Checks, Obstructions, Personnel/Contractors — by adding a `TableModuleSpec` and a fetch wire for each. No engine changes.

**Architecture:** Each module becomes a pure `TableModuleSpec` (columns + `getDate` + `toRow`) in a dedicated `lib/export/export-table-specs.ts`, consumed by the existing `buildTableModuleFiles`. The Discrepancies spec moves there too so all specs live in one place and `export-pdf.ts` holds only the engine. `export-data.ts` gains a fetch per module (unwrapping the `{data,error}` modules).

**Tech Stack:** TypeScript strict, jsPDF (via the 2a generator), Vitest + jsdom.

**Scope note:** 2b of Phase 2 (`docs/superpowers/specs/2026-05-29-records-export-design.md`). Deferred to later increments: Wildlife + Daily Reviews (need a sub-name + a new fetch-all), Events Log/PPR/SCN (reuse existing rich generators), SMS/AEP (civilian multi-kind), and per-record Waivers/ACSI/Training (2c).

**Field reference (verified from the live CRUD modules):**
- `fetchInspections(baseId?)→InspectionRow[]`; fields incl. `display_id, inspection_type, inspector_name, inspection_date, status, completion_percent, created_at`.
- `fetchChecks(baseId?)→{data: CheckRow[]; error}`; fields incl. `display_id, check_type, areas: string[], completed_by, completed_at, status, photo_count, created_at`.
- `fetchObstructionEvaluations(baseId?)→ObstructionRow[]`; fields incl. `display_id, description, object_height_agl: number, runway_class, has_violation: boolean, controlling_surface, created_at`.
- `fetchContractors(baseId?)→ContractorRow[]`; fields incl. `company_name, callsign, work_description, status, start_date, end_date, af_form_483_expiration, created_at`.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `lib/export/export-table-specs.ts` | Create | All `TableModuleSpec`s: discrepancies (moved) + inspections, checks, obstructions, personnel |
| `lib/export/export-pdf.ts` | Modify | Remove `DISCREPANCIES_SPEC` + its helpers (moved out); keep the engine |
| `tests/export-pdf.test.ts` | Modify | Import `DISCREPANCIES_SPEC` from the new specs file |
| `tests/export-table-specs.test.ts` | Create | toRow + path assertions per module |
| `lib/export/export-data.ts` | Modify | Fetch the four modules (unwrap `fetchChecks`) |

---

## Task 1: Create `export-table-specs.ts` with all four new specs (+ move Discrepancies)

**Files:** Create `lib/export/export-table-specs.ts`; Modify `lib/export/export-pdf.ts`, `tests/export-pdf.test.ts`; Create `tests/export-table-specs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/export-table-specs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildTableModuleFiles } from '@/lib/export/export-pdf'
import {
  INSPECTIONS_SPEC,
  CHECKS_SPEC,
  OBSTRUCTIONS_SPEC,
  PERSONNEL_SPEC,
} from '@/lib/export/export-table-specs'

const ctx = { baseName: 'Test AAF', baseIcao: 'KTST', period: { kind: 'all_time' as const }, outputMode: 'aggregate' as const }

describe('INSPECTIONS_SPEC', () => {
  it('maps a row to the right column count and aggregate path', () => {
    const row = { display_id: 'INSP-1', inspection_type: 'airfield', inspector_name: 'MSgt Doe', inspection_date: '2026-01-04', status: 'completed', completion_percent: 100, created_at: '2026-01-04T00:00:00Z' }
    expect(INSPECTIONS_SPEC.toRow(row)).toHaveLength(INSPECTIONS_SPEC.columns.length)
    expect(INSPECTIONS_SPEC.toRow(row)).toContain('100%')
    const files = buildTableModuleFiles([row], INSPECTIONS_SPEC, ctx)
    expect(files.map((f) => f.path)).toEqual(['documents/Inspections.pdf'])
  })
})

describe('CHECKS_SPEC', () => {
  it('joins areas and counts photos', () => {
    const row = { display_id: 'AC-1', check_type: 'fod', areas: ['RW05', 'TWY A'], completed_by: 'SrA Roe', completed_at: '2026-01-05T00:00:00Z', status: 'completed', photo_count: 3, created_at: '2026-01-05T00:00:00Z' }
    const cells = CHECKS_SPEC.toRow(row)
    expect(cells).toHaveLength(CHECKS_SPEC.columns.length)
    expect(cells).toContain('RW05, TWY A')
    expect(cells).toContain('3')
    expect(buildTableModuleFiles([row], CHECKS_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Checks.pdf'])
  })
})

describe('OBSTRUCTIONS_SPEC', () => {
  it('renders violation as Yes/No and height with units', () => {
    const row = { display_id: 'OBST-1', description: 'Crane', object_height_agl: 120, runway_class: 'PA', has_violation: true, controlling_surface: 'Approach', created_at: '2026-01-06T00:00:00Z' }
    const cells = OBSTRUCTIONS_SPEC.toRow(row)
    expect(cells).toHaveLength(OBSTRUCTIONS_SPEC.columns.length)
    expect(cells).toContain('Yes')
    expect(cells).toContain('120 ft')
    expect(buildTableModuleFiles([row], OBSTRUCTIONS_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Obstructions.pdf'])
  })
})

describe('PERSONNEL_SPEC', () => {
  it('falls back to em-dash for null fields', () => {
    const row = { company_name: 'Acme', callsign: null, work_description: 'Paving', status: 'active', start_date: '2026-01-02', end_date: null, af_form_483_expiration: null, created_at: '2026-01-02T00:00:00Z' }
    const cells = PERSONNEL_SPEC.toRow(row)
    expect(cells).toHaveLength(PERSONNEL_SPEC.columns.length)
    expect(cells.filter((c) => c === '—').length).toBeGreaterThanOrEqual(3)
    expect(buildTableModuleFiles([row], PERSONNEL_SPEC, ctx).map((f) => f.path)).toEqual(['documents/Personnel.pdf'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-table-specs.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/export-table-specs`.

- [ ] **Step 3: Create the specs file**

Create `lib/export/export-table-specs.ts`:

```typescript
// Records Export — per-module table specs.
// Each spec is pure data: which columns, the natural date, and how to turn a
// row into stringified cells. Consumed by buildTableModuleFiles (export-pdf.ts).
import { EXPORT_MODULES } from './export-modules'
import type { TableModuleSpec } from './export-pdf'

function mod(key: string) {
  const m = EXPORT_MODULES.find((x) => x.key === key)
  if (!m) throw new Error(`Records Export: unknown module "${key}"`)
  return m
}

const dash = (v: string | null | undefined): string => (v == null || v === '' ? '—' : v)
const dateOnly = (v: string | null | undefined): string => (v ? v.slice(0, 10) : '—')
const yesNo = (v: boolean | null | undefined): string => (v ? 'Yes' : 'No')

// ── Discrepancies (moved from export-pdf.ts) ─────────────────
interface DiscrepancyLike {
  display_id: string
  status: string
  type: string
  title: string
  location_text: string
  assigned_shop: string | null
  work_order_number: string | null
  created_at: string
  reporter?: { name: string | null; rank: string | null } | null
}

function reporterLabel(r: DiscrepancyLike['reporter']): string {
  if (!r || !r.name) return '—'
  return r.rank ? `${r.rank} ${r.name}` : r.name
}

export const DISCREPANCIES_SPEC: TableModuleSpec<DiscrepancyLike> = {
  module: mod('discrepancies'),
  columns: ['ID', 'Date', 'Status', 'Type', 'Title', 'Location', 'Shop', 'WO #', 'Reported By'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    dateOnly(r.created_at),
    r.status,
    r.type,
    r.title,
    r.location_text,
    dash(r.assigned_shop),
    dash(r.work_order_number),
    reporterLabel(r.reporter),
  ],
}

// ── Inspections ──────────────────────────────────────────────
interface InspectionLike {
  display_id: string
  inspection_type: string
  inspector_name: string | null
  inspection_date: string
  status: string
  completion_percent: number
  created_at: string
}

export const INSPECTIONS_SPEC: TableModuleSpec<InspectionLike> = {
  module: mod('inspections'),
  columns: ['ID', 'Type', 'Inspector', 'Inspection Date', 'Status', 'Complete', 'Logged'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    r.inspection_type,
    dash(r.inspector_name),
    dateOnly(r.inspection_date),
    r.status,
    `${r.completion_percent}%`,
    dateOnly(r.created_at),
  ],
}

// ── Checks ───────────────────────────────────────────────────
interface CheckLike {
  display_id: string
  check_type: string
  areas: string[]
  completed_by: string | null
  completed_at: string | null
  status: string
  photo_count: number
  created_at: string
}

export const CHECKS_SPEC: TableModuleSpec<CheckLike> = {
  module: mod('checks'),
  columns: ['ID', 'Type', 'Areas', 'Completed By', 'Completed', 'Status', 'Photos'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    r.check_type,
    r.areas.join(', '),
    dash(r.completed_by),
    dateOnly(r.completed_at),
    r.status,
    String(r.photo_count),
  ],
}

// ── Obstructions ─────────────────────────────────────────────
interface ObstructionLike {
  display_id: string | null
  description: string | null
  object_height_agl: number
  runway_class: string
  has_violation: boolean
  controlling_surface: string | null
  created_at: string
}

export const OBSTRUCTIONS_SPEC: TableModuleSpec<ObstructionLike> = {
  module: mod('obstructions'),
  columns: ['ID', 'Description', 'Height AGL', 'Runway Class', 'Violation', 'Surface', 'Logged'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    dash(r.display_id),
    dash(r.description),
    `${r.object_height_agl} ft`,
    r.runway_class,
    yesNo(r.has_violation),
    dash(r.controlling_surface),
    dateOnly(r.created_at),
  ],
}

// ── Personnel / Contractors ──────────────────────────────────
interface ContractorLike {
  company_name: string
  callsign: string | null
  work_description: string
  status: string
  start_date: string
  end_date: string | null
  af_form_483_expiration: string | null
  created_at: string
}

export const PERSONNEL_SPEC: TableModuleSpec<ContractorLike> = {
  module: mod('personnel'),
  columns: ['Company', 'Callsign', 'Work', 'Status', 'Start', 'End', 'AF 483 Exp'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.company_name,
    dash(r.callsign),
    r.work_description,
    r.status,
    dateOnly(r.start_date),
    dateOnly(r.end_date),
    dateOnly(r.af_form_483_expiration),
  ],
}
```

- [ ] **Step 4: Remove the moved code from `export-pdf.ts`**

In `lib/export/export-pdf.ts`, delete the entire "Discrepancies spec" section at the bottom: the `DiscrepancyLike` interface, `reporterLabel`, the `discrepanciesModule` const, and the `DISCREPANCIES_SPEC` export. Also remove the now-unused `EXPORT_MODULES` import if present (keep the `ExportModule` type import — `TableModuleSpec` uses it). Run `npx tsc --noEmit` and fix any unused-import error it surfaces.

- [ ] **Step 5: Update the existing test import**

In `tests/export-pdf.test.ts`, change the import line so `DISCREPANCIES_SPEC` comes from the new file:

```typescript
import { buildTableModuleFiles, periodSubtitle } from '@/lib/export/export-pdf'
import { DISCREPANCIES_SPEC } from '@/lib/export/export-table-specs'
```

- [ ] **Step 6: Run both test files + type-check**

Run: `npx vitest run tests/export-pdf.test.ts tests/export-table-specs.test.ts`
Expected: PASS — 11 (export-pdf: 7) + 4 (export-table-specs) = 11 total... run and confirm: export-pdf.test.ts has 7, export-table-specs.test.ts has 4 → 11 passing.
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add lib/export/export-table-specs.ts lib/export/export-pdf.ts tests/export-pdf.test.ts tests/export-table-specs.test.ts
git commit -m "feat(exports): add table specs for inspections, checks, obstructions, personnel"
```

---

## Task 2: Wire the four modules into `export-data.ts`

**Files:** Modify `lib/export/export-data.ts`

- [ ] **Step 1: Replace the file contents**

`fetchChecks` returns `{ data, error }`; the others return bare arrays. Unwrap accordingly.

```typescript
// Records Export — per-module record fetch. Thin wrappers over existing CRUD
// so the PDF/Excel layers receive typed rows. Relies on Supabase RLS + the
// explicit base_id filter, like the rest of the app.
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { fetchInspections, type InspectionRow } from '@/lib/supabase/inspections'
import { fetchChecks, type CheckRow } from '@/lib/supabase/checks'
import { fetchObstructionEvaluations, type ObstructionRow } from '@/lib/supabase/obstructions'
import { fetchContractors, type ContractorRow } from '@/lib/supabase/contractors'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
  inspections: InspectionRow[]
  checks: CheckRow[]
  obstructions: ObstructionRow[]
  personnel: ContractorRow[]
}

/** Fetch all records for the modules 2b supports, for a base. */
export async function fetchExportRecords(baseId: string | null): Promise<ModuleRecords> {
  const [discrepancies, inspections, checksResult, obstructions, personnel] = await Promise.all([
    fetchDiscrepancies(baseId),
    fetchInspections(baseId),
    fetchChecks(baseId),
    fetchObstructionEvaluations(baseId),
    fetchContractors(baseId),
  ])
  return {
    discrepancies,
    inspections,
    checks: checksResult.data,
    obstructions,
    personnel,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (Confirm each imported type/function name resolves: `InspectionRow`/`fetchInspections`, `CheckRow`/`fetchChecks`, `ObstructionRow`/`fetchObstructionEvaluations`, `ContractorRow`/`fetchContractors`. If any export name differs, fix the import only.)

- [ ] **Step 3: Commit**

```bash
git add lib/export/export-data.ts
git commit -m "feat(exports): fetch inspections, checks, obstructions, personnel for export"
```

---

## Task 3: Phase 2b verification gate

- [ ] **Step 1: Type-check** — `npx tsc --noEmit` → exit 0.
- [ ] **Step 2: New/affected tests** — `npx vitest run tests/export-table-specs.test.ts tests/export-pdf.test.ts` → 11 pass.
- [ ] **Step 3: Full suite** — `npx vitest run` → 617 (after 2a) + 4 new = 621, ± drift. No failures.
- [ ] **Step 4: Build** — `npm run build` → compiled successfully.
- [ ] **Step 5: Update spec status** — in `docs/superpowers/specs/2026-05-29-records-export-design.md` §9, note "2b done — Inspections/Checks/Obstructions/Personnel specs; Wildlife/Daily-Reviews + reuse modules (Events Log/PPR/SCN) + civilian SMS/AEP still pending". Commit:
```bash
git add docs/superpowers/specs/2026-05-29-records-export-design.md
git commit -m "docs(exports): record Phase 2b (four uniform table modules) complete"
```

---

## Self-Review notes (author)

- **Spec coverage (2b scope):** four uniform table modules added as pure specs (Task 1) + fetch wiring (Task 2). Engine untouched. Wildlife (needs sub-name), Daily Reviews (needs fetch-all), reuse modules (Events Log/PPR/SCN), per-record (Waivers/ACSI/Training), and civilian SMS/AEP are explicitly deferred.
- **No placeholders:** complete code for every spec, the data layer, and tests, using real field names verified from the CRUD modules.
- **Type consistency:** specs import `TableModuleSpec` from `export-pdf.ts`; `DISCREPANCIES_SPEC` moves to `export-table-specs.ts` and its test import is updated in lockstep (Task 1 Steps 4–5). `export-data.ts` returns the real row types; `checks` is unwrapped from `{data,error}`.
- **Risk — type name drift:** the plan names `InspectionRow`, `CheckRow`, `ObstructionRow`, `ContractorRow` and `fetchObstructionEvaluations`/`fetchContractors` from the explore pass; Task 2 Step 2 explicitly instructs fixing the import if a name differs (import-only change, no behavior).
- **`Like` interfaces vs real rows:** each spec types a structural subset; the real `*Row` from `export-data.ts` is assignable to it. Fields confirmed present on the real rows.
