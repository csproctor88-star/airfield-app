# Records Export — Phase 2a Implementation Plan (PDF framework)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the reusable PDF-export framework (an in-memory `ExportFile[]` producer) and prove it end-to-end on the Discrepancies module in all three output modes — all-time aggregate, date-range aggregate, and monthly split.

**Architecture:** A pure orchestrator (`buildTableModuleFiles`) filters a module's records by an `ExportPeriod`, then either renders one aggregate PDF or one PDF per month via a single generic "records table" generator built on `lib/pdf-utils.ts`. PDFs become `{ path, bytes }` via `doc.output('arraybuffer')`, ready for the Phase 4 packager. This phase wires only Discrepancies; Phase 2b fans out the remaining table modules as config, and 2c adds the per-record modules (Waivers/ACSI).

**Tech Stack:** jsPDF + jspdf-autotable (client-side), TypeScript strict, Vitest + jsdom (jsPDF runs in the test env — the repo already has PDF smoke tests).

**Scope note:** First increment of Phase 2 from `docs/superpowers/specs/2026-05-29-records-export-design.md`. Output modes per spec §6: `all-time` / `range` (aggregate) and `monthly` split.

---

## File Structure

| File | Create/Modify | Responsibility |
|---|---|---|
| `lib/export/export-modules.ts` | Modify | Rename base strategy `'monthly'` → `'table'` (a table module's mode is chosen at export time) |
| `tests/export-modules.test.ts` | Modify | Update the strategy assertions |
| `lib/export/export-file.ts` | Create | `ExportFile` type + `pdfToExportFile(doc, path)` |
| `lib/export/export-records-table-pdf.ts` | Create | Generic records-table PDF generator |
| `lib/export/export-pdf.ts` | Create | `OutputMode`, `buildTableModuleFiles`, `periodSubtitle`, the Discrepancies table spec |
| `lib/export/export-data.ts` | Create | Thin per-module record fetch (Discrepancies for 2a) |
| `tests/export-file.test.ts` | Create | bytes-from-jsPDF test |
| `tests/export-records-table-pdf.test.ts` | Create | generator smoke test |
| `tests/export-pdf.test.ts` | Create | orchestrator filter/group/path tests (injected data) |

---

## Task 1: Rename the registry strategy `monthly` → `table`

A table module's output (aggregate vs monthly) is chosen by the user at export time, so the per-module base strategy is just "table".

**Files:** Modify `lib/export/export-modules.ts`, `tests/export-modules.test.ts`

- [ ] **Step 1: Update the test first**

In `tests/export-modules.test.ts`, change the monthly assertion block to:

```typescript
  it('sets Discrepancies and Events Log as table PDFs', () => {
    for (const key of ['discrepancies', 'events_log']) {
      expect(EXPORT_MODULES.find((x) => x.key === key)?.pdfStrategy, key).toBe('table')
    }
  })
```

And update the valid-strategies set test:

```typescript
  it('uses only valid pdf strategies', () => {
    const valid = new Set(['per_record', 'table', 'excluded'])
    for (const m of EXPORT_MODULES) {
      expect(valid.has(m.pdfStrategy)).toBe(true)
    }
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-modules.test.ts`
Expected: FAIL — modules still carry `'monthly'`.

- [ ] **Step 3: Update the registry**

In `lib/export/export-modules.ts`:
- Change the type: `export type PdfStrategy = 'per_record' | 'table' | 'excluded'`
- In the JSDoc comment block, change the `'monthly'` line to:
  `//   'table'      → rendered as a records table; output mode (aggregate vs monthly`
  `//                  split) is chosen per export (see export-pdf.ts OutputMode)`
- Replace every `pdfStrategy: 'monthly'` with `pdfStrategy: 'table'` (12 rows:
  discrepancies, inspections, checks, obstructions, events_log, daily_reviews, wildlife,
  ppr, personnel, scn, sms, aep).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-modules.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → exit 0.
```bash
git add lib/export/export-modules.ts tests/export-modules.test.ts
git commit -m "refactor(exports): rename module strategy monthly -> table (mode is per-export)"
```

---

## Task 2: `ExportFile` + bytes from a jsPDF doc

**Files:** Create `lib/export/export-file.ts`, `tests/export-file.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/export-file.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { jsPDF } from 'jspdf'
import { pdfToExportFile } from '@/lib/export/export-file'

describe('pdfToExportFile', () => {
  it('returns the given path and real PDF bytes', () => {
    const doc = new jsPDF()
    doc.text('hello', 10, 10)
    const file = pdfToExportFile(doc, 'documents/Test.pdf')
    expect(file.path).toBe('documents/Test.pdf')
    expect(file.bytes).toBeInstanceOf(Uint8Array)
    expect(file.bytes.length).toBeGreaterThan(0)
    // PDF magic bytes "%PDF"
    expect(Array.from(file.bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-file.test.ts`
Expected: FAIL — cannot resolve `@/lib/export/export-file`.

- [ ] **Step 3: Implement**

Create `lib/export/export-file.ts`:

```typescript
// Records Export — the unit the packager bundles into the ZIP.
import type { jsPDF } from 'jspdf'

export interface ExportFile {
  /** Path inside the ZIP, e.g. 'documents/Discrepancies.pdf' */
  path: string
  bytes: Uint8Array
}

/** Convert a finished jsPDF document into an ExportFile at the given ZIP path. */
export function pdfToExportFile(doc: jsPDF, path: string): ExportFile {
  const arrayBuffer = doc.output('arraybuffer')
  return { path, bytes: new Uint8Array(arrayBuffer) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-file.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-file.ts tests/export-file.test.ts
git commit -m "feat(exports): add ExportFile + pdfToExportFile (bytes from jsPDF)"
```

---

## Task 3: Generic records-table PDF generator

**Files:** Create `lib/export/export-records-table-pdf.ts`, `tests/export-records-table-pdf.test.ts`

Built on `lib/pdf-utils.ts` (which exports `createPdf`, `drawBaseHeader`, `drawReportTitle`, `drawStatBox`, `drawFooter`, `tableStyles`). Modeled on `lib/events-log-pdf.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/export-records-table-pdf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateRecordsTablePdf } from '@/lib/export/export-records-table-pdf'

describe('generateRecordsTablePdf', () => {
  it('produces a jsPDF doc with at least one page for populated rows', () => {
    const doc = generateRecordsTablePdf({
      title: 'Discrepancies',
      subtitle: '2026-01',
      baseName: 'Test AAF',
      baseIcao: 'KTST',
      columns: ['ID', 'Status', 'Title'],
      rows: [
        ['DSC-1', 'open', 'Crack'],
        ['DSC-2', 'closed', 'Light out'],
      ],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
    const bytes = new Uint8Array(doc.output('arraybuffer'))
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46])
  })

  it('handles an empty rows array without throwing', () => {
    const doc = generateRecordsTablePdf({
      title: 'Discrepancies',
      columns: ['ID', 'Status', 'Title'],
      rows: [],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-records-table-pdf.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

Create `lib/export/export-records-table-pdf.ts`:

```typescript
// Records Export — generic "records table" PDF.
// One reusable generator for every table module; the caller supplies the
// column headers and pre-stringified rows. Aggregate mode calls this once over
// all rows; monthly mode calls it once per month bucket.
import autoTable from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
} from '@/lib/pdf-utils'

export interface RecordsTablePdfOptions {
  /** Module label, e.g. 'Discrepancies' */
  title: string
  /** Optional subtitle, e.g. a month ('2026-01') or date range */
  subtitle?: string
  baseName?: string | null
  baseIcao?: string | null
  columns: string[]
  /** Pre-stringified rows; each inner array aligns with `columns` */
  rows: string[][]
}

export function generateRecordsTablePdf(opts: RecordsTablePdfOptions): jsPDF {
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: opts.baseName, baseIcao: opts.baseIcao })
  y = drawReportTitle(ctx, y, { title: opts.title.toUpperCase(), subtitle: opts.subtitle })
  y = drawStatBox(ctx, y, [{ label: 'Total Records', value: String(opts.rows.length) }])

  if (opts.rows.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No records in the selected period.', margin, y)
  } else {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [opts.columns],
      body: opts.rows,
      didDrawPage: () => drawFooter(ctx),
    })
  }

  return doc
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-records-table-pdf.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-records-table-pdf.ts tests/export-records-table-pdf.test.ts
git commit -m "feat(exports): add generic records-table PDF generator"
```

---

## Task 4: Orchestrator + Discrepancies table spec

**Files:** Create `lib/export/export-pdf.ts`, `tests/export-pdf.test.ts`

`buildTableModuleFiles` is pure (given records) so it is fully unit-testable. It filters by period, then renders aggregate (one file) or monthly (one file per bucket).

- [ ] **Step 1: Write the failing test**

Create `tests/export-pdf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildTableModuleFiles, periodSubtitle, DISCREPANCIES_SPEC } from '@/lib/export/export-pdf'

type Row = { display_id: string; status: string; type: string; title: string; location_text: string; assigned_shop: string | null; work_order_number: string | null; created_at: string; reporter?: { name: string | null; rank: string | null } | null }

const rows: Row[] = [
  { display_id: 'DSC-1', status: 'open',   type: 'Pavement', title: 'Crack',    location_text: 'RW05', assigned_shop: 'Pavements', work_order_number: 'WO1', created_at: '2026-01-10T00:00:00Z', reporter: { name: 'Doe', rank: 'MSgt' } },
  { display_id: 'DSC-2', status: 'closed', type: 'Lighting', title: 'Light out',location_text: 'TWY A', assigned_shop: 'Electric',  work_order_number: null,  created_at: '2026-02-05T00:00:00Z', reporter: null },
  { display_id: 'DSC-3', status: 'open',   type: 'Signage',  title: 'Sign bent',location_text: 'TWY B', assigned_shop: null,        work_order_number: null,  created_at: '2026-02-20T00:00:00Z', reporter: { name: 'Roe', rank: null } },
]

const ctxBase = { baseName: 'Test AAF', baseIcao: 'KTST' }

describe('periodSubtitle', () => {
  it('labels all-time', () => {
    expect(periodSubtitle({ kind: 'all_time' })).toBe('All time')
  })
  it('labels a range', () => {
    expect(periodSubtitle({ kind: 'range', from: '2026-01-01', to: '2026-03-31' }))
      .toBe('2026-01-01 → 2026-03-31')
  })
})

describe('buildTableModuleFiles — aggregate', () => {
  it('produces one PDF at documents/<folder>.pdf for all-time', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate',
    })
    expect(files.map((f) => f.path)).toEqual(['documents/Discrepancies.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('filters by range before rendering', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' }, outputMode: 'aggregate',
    })
    expect(files).toHaveLength(1) // 2 Feb rows still → one aggregate file
  })

  it('returns no files when nothing matches the range', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' }, outputMode: 'aggregate',
    })
    expect(files).toEqual([])
  })
})

describe('buildTableModuleFiles — monthly', () => {
  it('produces one PDF per month at documents/<folder>/YYYY-MM.pdf', () => {
    const files = buildTableModuleFiles(rows, DISCREPANCIES_SPEC, {
      ...ctxBase, period: { kind: 'all_time' }, outputMode: 'monthly',
    })
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/Discrepancies/2026-01.pdf',
      'documents/Discrepancies/2026-02.pdf',
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/export-pdf.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement**

Create `lib/export/export-pdf.ts`:

```typescript
// Records Export — PDF orchestration for table modules.
// Pure given the fetched records: filter by period, then render either one
// aggregate PDF or one PDF per month bucket via the generic table generator.
import { EXPORT_MODULES, type ExportModule } from './export-modules'
import { isInRange, groupByMonth, type ExportPeriod } from './export-period'
import { generateRecordsTablePdf } from './export-records-table-pdf'
import { pdfToExportFile, type ExportFile } from './export-file'

export type OutputMode = 'aggregate' | 'monthly'

export interface PdfBuildContext {
  period: ExportPeriod
  outputMode: OutputMode
  baseName?: string | null
  baseIcao?: string | null
}

/** How to turn a module's rows into a PDF table. */
export interface TableModuleSpec<T> {
  module: ExportModule
  columns: string[]
  getDate: (row: T) => string | null | undefined
  toRow: (row: T) => string[]
}

/** Human label for the aggregate PDF subtitle. */
export function periodSubtitle(period: ExportPeriod): string {
  if (period.kind === 'all_time') return 'All time'
  return `${period.from ?? '…'} → ${period.to ?? '…'}`
}

/**
 * Build the PDF ExportFile(s) for one table module. Returns [] when no records
 * fall in the period (the caller records the gap on the cover sheet).
 */
export function buildTableModuleFiles<T>(
  records: T[],
  spec: TableModuleSpec<T>,
  ctx: PdfBuildContext,
): ExportFile[] {
  const filtered = records.filter((r) => isInRange(spec.getDate(r), ctx.period))
  if (filtered.length === 0) return []
  const folder = spec.module.folder

  if (ctx.outputMode === 'monthly') {
    const out: ExportFile[] = []
    for (const [month, monthRows] of groupByMonth(filtered, spec.getDate)) {
      const doc = generateRecordsTablePdf({
        title: spec.module.label,
        subtitle: month,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
        columns: spec.columns,
        rows: monthRows.map(spec.toRow),
      })
      out.push(pdfToExportFile(doc, `documents/${folder}/${month}.pdf`))
    }
    return out
  }

  const doc = generateRecordsTablePdf({
    title: spec.module.label,
    subtitle: periodSubtitle(ctx.period),
    baseName: ctx.baseName,
    baseIcao: ctx.baseIcao,
    columns: spec.columns,
    rows: filtered.map(spec.toRow),
  })
  return [pdfToExportFile(doc, `documents/${folder}.pdf`)]
}

// ── Discrepancies spec ───────────────────────────────────────
// Minimal row shape (subset of DiscrepancyRow) the spec actually reads.
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

const discrepanciesModule = EXPORT_MODULES.find((m) => m.key === 'discrepancies')!

export const DISCREPANCIES_SPEC: TableModuleSpec<DiscrepancyLike> = {
  module: discrepanciesModule,
  columns: ['ID', 'Date', 'Status', 'Type', 'Title', 'Location', 'Shop', 'WO #', 'Reported By'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    r.created_at.slice(0, 10),
    r.status,
    r.type,
    r.title,
    r.location_text,
    r.assigned_shop ?? '—',
    r.work_order_number ?? '—',
    reporterLabel(r.reporter),
  ],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/export-pdf.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/export/export-pdf.ts tests/export-pdf.test.ts
git commit -m "feat(exports): add PDF orchestrator + Discrepancies table spec"
```

---

## Task 5: Thin data-fetch layer

**Files:** Create `lib/export/export-data.ts`

Wraps the existing CRUD fetch so the orchestrator gets typed rows. Thin by design; not unit-tested (it hits Supabase). Verified by the Phase 2a gate build.

- [ ] **Step 1: Implement**

Create `lib/export/export-data.ts`:

```typescript
// Records Export — per-module record fetch. Thin wrappers over existing CRUD
// so the PDF/Excel layers receive typed rows. Relies on Supabase RLS + the
// explicit base_id filter, like the rest of the app.
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'

export interface ModuleRecords {
  discrepancies: DiscrepancyRow[]
}

/** Fetch all records for the modules 2a supports, for a base. */
export async function fetchExportRecords(baseId: string | null): Promise<ModuleRecords> {
  const discrepancies = await fetchDiscrepancies(baseId)
  return { discrepancies }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0. (Confirm `DiscrepancyRow` is exported from `lib/supabase/discrepancies.ts` — it is, at line 14. If the import name differs, fix the import only.)

- [ ] **Step 3: Commit**

```bash
git add lib/export/export-data.ts
git commit -m "feat(exports): add thin per-module record fetch (Discrepancies)"
```

---

## Task 6: Phase 2a verification gate

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 2: New tests**

Run: `npx vitest run tests/export-file.test.ts tests/export-records-table-pdf.test.ts tests/export-pdf.test.ts tests/export-modules.test.ts`
Expected: PASS — 16 tests (1 + 2 + 6 + 7).

- [ ] **Step 3: Full suite**

Run: `npx vitest run`
Expected: all pass; 607 (Phase 1) + 9 new = 616, ± unrelated drift. No failures.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: compiled successfully (no route change this phase).

- [ ] **Step 5: Update the spec status**

In `docs/superpowers/specs/2026-05-29-records-export-design.md` §9, annotate Phase 2 as in progress (e.g. "2a done — PDF framework + Discrepancies; 2b fans out remaining table modules; 2c per-record"). Commit:

```bash
git add docs/superpowers/specs/2026-05-29-records-export-design.md
git commit -m "docs(exports): record Phase 2a (PDF framework) complete"
```

---

## Self-Review notes (author)

- **Spec coverage (2a scope):** the three output modes for table modules — all-time aggregate, range aggregate (Task 4 filter + `periodSubtitle`), monthly split (Task 4 `groupByMonth`) — proven on Discrepancies; the generic table generator (Task 3) is the single reusable renderer per spec §4; `ExportFile` (Task 2) is the packager's input unit. Per-record modules (Waivers/ACSI) and the remaining table modules are intentionally deferred to 2b/2c.
- **No placeholders:** every step has complete code/tests/commands.
- **Type consistency:** `ExportFile` (Task 2) consumed by Task 4; `ExportPeriod`/`isInRange`/`groupByMonth` reused unchanged from Phase 1; `OutputMode`/`TableModuleSpec`/`PdfBuildContext` defined in Task 4 and used in its own tests; `DISCREPANCIES_SPEC` uses a `DiscrepancyLike` subset so the test fixtures need only the read fields.
- **jsPDF in tests:** the repo runs PDF smoke tests under jsdom, so `new jsPDF()`, `autoTable`, and `doc.output('arraybuffer')` work in Vitest. If `jspdf-autotable`'s `didDrawPage` misbehaves headless, the empty-rows path (no autoTable) still covers the smoke test; investigate before weakening any assertion.
- **DiscrepancyLike vs DiscrepancyRow:** the spec reads a subset; `export-data.ts` returns the full `DiscrepancyRow[]`, which is assignable to `DiscrepancyLike[]` structurally. Confirmed fields exist on `DiscrepancyRow` (lib/supabase/discrepancies.ts:14).
