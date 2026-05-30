# Records Export — Design Spec

> **Status:** Approved design (2026-05-29). Next step: implementation plan (writing-plans).
> **Supersedes the emphasis of** `docs/Backup_And_Data_Export_Plan.md` (the original
> "Backup & Data Export" plan). That doc's survival-mode design is the reference; this
> spec re-aims it at **records export for Air Force records disposition + the
> "leaving Glidepath" scenario**, and drops the restore/backup framing.

---

## 1. Purpose & goals

Produce **standalone, human-usable, reviewable documents** from a base's Glidepath
data that can be **used and filed outside Glidepath**. Two drivers:

1. **Survivability** — if the unit is told to stop using Glidepath, the records remain
   viewable, separate, and reviewable on any computer with no server and no internet.
2. **Air Force records disposition** — exporting records is required to meet AF records
   management obligations. The app produces the documents; the user / Base Records
   Manager files each where the **AF Records Disposition Schedule (RDS, in AFRIMS)**
   requires.

### Success criteria
- An admin/AFM can, in a few clicks, produce a single ZIP of filable records for a
  chosen **date range** or **all-time**.
- Each record series is a **separate, reviewable artifact** (PDF + Excel), organized by
  module, openable in any standard tool.
- The bundle includes a **read-only interactive viewer** (opens from `file://`) and a
  **tamper-evident audit cover** (SHA-256 of every file).
- Nothing fabricated: no invented RDS table/rule numbers, retention periods, or reg text.

### Non-goals (explicitly out of scope)
- Restore tooling (re-importing into Glidepath).
- RDS table/rule tagging or retention metadata inside the app — the user files records
  per the RDS themselves.
- Cloud retention / auto-upload of exports (v2 candidate).
- A `base_backups` incremental-tracking table (the original plan's centerpiece) — user-
  picked date ranges make the export **stateless**.
- Bundled DoD regulation PDFs and the continuity-to-paper guide.

---

## 2. Regulatory context (sourced, for design grounding — not reproduced as reg text)

- **AFI 33-322, Records Management and Information Governance Program** (23 Mar 2020;
  DAFGM 2025-01, 26 Jun 2025) + **AFMAN 33-363, Management of Records** govern AF records.
- Records are **disposed IAW the AF Records Disposition Schedule (RDS), in AFRIMS**
  (stated in **DAFMAN 13-204V1**).
- **OMB M-23-07 / NARA**: electronic records are the federal default; NARA stopped
  accepting hardcopy temporary/permanent records after **30 Jun 2024 (T-0)** — a clean
  electronic export is the correct artifact.
- AFI 33-322 requires **segregation of records by disposition (T-1)** → the export is
  organized **by record series / module**.
- The **per-module RDS table/rule + retention is NOT publicly enumerable** (AFRIMS is
  access-controlled). The app does not store or guess it; the user/RM owns that mapping.

---

## 3. Architecture — five units

Each unit has one purpose, a defined interface, and is independently testable.

| Unit | File | Responsibility | Reuses |
|---|---|---|---|
| Scope resolver | `lib/export/export-scope.ts` | Given `{baseId, period}` (all-time \| `{from,to}`), resolve the records to include per module, applying each module's **natural-date** filter. Owns the module registry. | `lib/supabase/*` CRUD |
| Manifest/integrity | `lib/export/export-manifest.ts` | Build manifest + audit-cover data: per-module counts, date basis, generator version, signing user, **SHA-256 of every file** (sorted by path). | — |
| PDF doc layer | `lib/export/export-pdf.ts` | Drive the three PDF strategies (per-record / monthly / aggregate) per the module map. | the 20 `lib/*-pdf.ts` (+ a few new lightweight aggregate generators) |
| Excel layer | `lib/export/export-excel.ts` | Per-module workbooks + one master workbook. | `lib/excel-export.ts` |
| Viewer builder | `lib/export/export-viewer.ts` | Emit the self-contained `file://` HTML app with data inlined. | `lib/render-lucide-svg.ts` |
| Packager | `lib/export/export-packager.ts` | Assemble the organized ZIP, hash, name, trigger download; progress callbacks. | JSZip |

Page: `app/(app)/settings/exports/page.tsx`. CRUD/permission helpers follow existing
patterns (`createClient()` null-check, `friendlyError()`).

---

## 4. Module → PDF strategy map

Each module has a **base PDF strategy** (`per_record` / `table` / `excluded`). The
**period/output mode** (all-time · date-range · monthly split — §6) is chosen by the user
per export and only affects `table` modules. Every **included** module also gets **one
Excel workbook**. The optional raw-data JSON sidecar covers **all base-scoped tables**.

| Strategy | Modules | Output |
|---|---|---|
| **Per-record PDF** | Waivers (AF 505), ACSI, Civilian §139.303 Training (civilian mode only) | One PDF per record: `documents/Waivers/AF505-####.pdf`, `documents/ACSI/<year>.pdf`, `documents/Training/<record>.pdf`. Period only filters which records are included. |
| **Table (records list)** | Discrepancies, Inspections, Airfield Checks, Obstructions, Events Log, Daily Reviews, Wildlife, PPR, Personnel/Contractors, SCN, SMS, AEP | Rendered as a records table. **All-time / date-range** → one aggregate PDF `documents/<Module>.pdf`. **Monthly split** → one PDF per month `documents/<Module>/YYYY-MM.pdf`. Grouped by status within the table where applicable (e.g. Discrepancies → open / in-progress / completed). |
| **Excluded (own export)** | AMTR Training Record | Not produced here — the AMTR module's existing Excel records-export covers it; the cover sheet directs the user there. |

The same generic "records table" generator serves both aggregate and monthly: aggregate =
one call over all filtered rows; monthly = `groupByMonth` then one call per bucket.

- **Date filtering & monthly bucketing** use each module's natural date (e.g.
  Discrepancies by `created_at`, Daily Reviews by `review_date`, Events by `created_at`).
  In monthly mode, empty months produce no file; in aggregate mode, an empty module
  produces no file (and is listed as a gap on the cover sheet).
- **AMTR is excluded from the generated documents** (no PDF, no Excel, not in the master
  workbook). The `00-START-HERE.pdf` cover notes: "AMTR training records: export via the
  AMTR module." (AMTR tables still appear in the optional raw-data JSON sidecar, which is
  the comprehensive "everything" grab — so all-time exports lose nothing.)
- Civilian §139.303 Training PDFs appear **only when the base is civilian**
  (`appliesTo: faa_part139`); on military bases that module is absent.

**Generator reuse vs. new:** per-record reuses existing generators (`generateWaiverPdf`,
`generateAcsiPdf`). Some table modules already have aggregate generators that take an
array (`generateEventsLogPdf(rows[])`, `generatePprPdf(entries[])`, `generatePersonnelPdf`,
`generateScnMonthlyPdf`) — reuse them for the aggregate mode. The rest are served by ONE
generic "records table" generator (`lib/pdf-utils.ts` + autotable) driven by a per-module
column config — far cheaper than bespoke per-module generators.

---

## 5. Output structure (ZIP)

```
glidepath-records-KBCV-2026-01-01_to_2026-03-31.zip   (or ...-all-time.zip)
├── 00-START-HERE.pdf      audit cover: range, per-module counts + date basis,
│                          SHA-256 of every file, generated-by + when, gap notes
├── README.txt             plain-text equivalent
├── documents/             per-record + table PDFs (see §4); AMTR excluded
│     Waivers/AF505-####.pdf · ACSI/<year>.pdf · Training/<record>.pdf   (per record)
│     all-time / range → one aggregate PDF per module:
│       Discrepancies.pdf · Inspections.pdf · Checks.pdf · Obstructions.pdf
│       Events-Log.pdf · Daily-Reviews.pdf · Wildlife.pdf · PPR.pdf
│       Personnel.pdf · SCN.pdf · SMS.pdf · AEP.pdf
│     monthly split → one PDF per month per module: <Module>/YYYY-MM.pdf
├── spreadsheets/          00-Master-Workbook.xlsx + one <Module>.xlsx each
├── photos/<Module>/<record>/<date>_<label>.jpg + photos-index.csv  (provenance)
├── viewer/                index.html app.js styles.css data.js  (read-only, file://)
└── data/                  optional <module>.json raw sidecar (all base-scoped tables)
```

- Folder-per-record-series satisfies "segregation by disposition."
- Empty modules in a window are **omitted but listed in the cover sheet** (gap is explicit,
  never silent).

---

## 6. UI / UX

`/settings/exports`, gated by `exports:read`. Single screen, three steps + progress modal.

1. **Period / output mode** — three choices (user picks one):
   - `( ) All time` — one aggregate PDF per table module (all records)
   - `( ) Date range [from]→[to]` — aggregate, filtered (quick chips: This month /
     Last month / This quarter / This FY)
   - `( ) Monthly split` — one PDF per month per table module (optionally bounded by a
     range)
   The mode only affects **table modules**; **per-record** modules (Waivers, ACSI,
   Civilian Training) always emit one PDF per record regardless, with the period used
   only to filter which records are included.
2. **Include** — PDF documents · Excel workbooks · Photos · Interactive viewer ·
   Raw data (JSON, off by default).
3. **Modules** — All, or pick a subset.
   Live estimate: ~N records · ~N photos · ~size.

- **Date basis** = each module's natural date; the cover sheet states which date each
  module was filtered on, so the window is unambiguous.
- **All generation is client-side** (like today's PDFs) — record data never leaves the
  browser; ZIP built in-memory, downloaded via `saveAs`.
- **Size guard**: estimate > ~250 MB → hint to narrow range or drop photos/viewer.
  Server-side generation is a v2 option.

Progress modal lists each module as it exports (✓), photo progress (n/total + MB), and a
Cancel that discards the partial ZIP.

---

## 7. Date-basis filtering & watermark-less tables

- Most tables filter on a natural date (`updated_at` / `created_at` / a domain date like
  inspection date or event date). The registry pins the column per module.
- **14 base-scoped tables have neither `updated_at` nor `created_at`** (`amtr_*_progress`,
  `amtr_quals`, `customer_feedback`, `page_view_daily`, `training_renewals`,
  `user_documents`, digests, etc.). These **cannot be windowed**:
  - **All-time export** → always included.
  - **Date-range export** → included in full (current-state snapshot) and **flagged on the
    cover sheet** as "current state, not date-filtered," so the window's meaning stays honest.
- **~12 FK-reached tables** (no `base_id`) join through a parent (`waiver_reviews`→
  `waivers`, `shift_checklist_responses`→`shift_checklists`, etc.).
- **Excluded** (global/shared/ephemeral): `regulations`, `permissions`,
  `role_permissions`, `outage_rule_templates`, `discrepancy_statuses`, `rate_limit_hits`.
  `profiles` → denormalized refs only (`{id, name, rank, operating_initials}`), no PII.

The authoritative table inventory was introspected from the live DB on 2026-05-29
(111 base-scoped tables + 26 FK/global). The scope registry is built from that, guarded
by a test that fails if a new base-scoped table appears without a registry entry.

---

## 8. Data model impact

One additive migration only:

- `supabase/migrations/<ts>_exports_permission_keys.sql` — register `exports:read` /
  `exports:write` in `permissions`; grant to `sys_admin`, `base_admin`, `airfield_manager`
  in `role_permissions`. Uses the matrix helpers (`user_has_permission` /
  `user_has_base_access`); no dropped helpers.

No `base_backups` table. (A future `export_log` audit table is a deferred option, not v1.)

---

## 9. Phasing (A-first — documents land at Phase 4)

| Phase | Deliverable | Gate |
|---|---|---|
| ✅ 1 | Permission migration · `export-modules.ts` (registry) + `export-period.ts` (date-basis + all-time/range + month bucketing) · `/settings/exports` shell | **Done 2026-05-29** — migration applied live; 607 tests pass; build green; page gated. Plan: `docs/superpowers/plans/2026-05-29-records-export-phase-1.md` |
| 2 | PDF doc layer (3 strategies) | Visual review of sample PDFs |
| ↳ 2a | **Done 2026-05-29** — PDF framework (`ExportFile`, generic records-table generator, pure `buildTableModuleFiles` orchestrator w/ aggregate + monthly + error boundary), proven on Discrepancies. 617 tests. Plan: `docs/superpowers/plans/2026-05-29-records-export-phase-2a.md` | Build green; framework unit-tested |
| ↳ 2b | **Done 2026-05-29** — four uniform table modules (Inspections, Checks, Obstructions, Personnel) as `TableModuleSpec`s in `export-table-specs.ts` + fetch wiring. 621 tests. Plan: `docs/superpowers/plans/2026-05-29-records-export-phase-2b.md` | Build green; per-spec tests |
| ↳ 2b-ii | Wildlife (sightings+strikes, needs spec sub-name) + Daily Reviews (needs a fetch-all) | per-module specs |
| ↳ 2b-iii | Reuse rich generators: Events Log (`generateEventsLogPdf`), PPR (`generatePprPdf`), SCN (`generateScnMonthlyPdf`) | adapters |
| ↳ 2d | Civilian multi-kind: SMS (~5 record kinds), AEP (~4) | per-kind specs |
| ↳ 2c | Per-record modules (Waivers, ACSI, Civilian Training) | sample PDFs |
| 3 | Excel layer (per-module + master) | Workbooks open clean |
| 4 | Packager: ZIP + `00-START-HERE.pdf` cover + SHA-256 manifest + README + progress + size guard. **End of "A" — usable export ships.** | Download/unzip real demo export; verify hashes |
| 5 | Photos: windowed enumeration, download, organized tree + provenance CSV | Photos resolve + index correct |
| 6 | Interactive `file://` HTML viewer (browse/search/print, inlined data) | Opens offline in a browser |
| 7 | Optional raw-data JSON sidecar + polish + CHANGELOG/version | Wrap |

Estimate: ~9–13 sessions.

---

## 10. Testing & error handling

**TDD** on pure logic: date-basis filtering (incl. watermark-less handling), monthly
bucketing, SHA-256 manifest hashing, filename/range formatting, registry-vs-live-schema
guard. **Smoke tests** for PDF/Excel generation (no throw). **Manual** offline open for
the viewer.

**Errors:** photo download retries 3× → `manifest.failures[]`, export still completes.
Cancel discards partial ZIP. `friendlyError()` for surfaced failures. Empty modules
omitted but noted on the cover.

---

## 11. Decisions locked (recap)

1. Permissions → sys_admin + base_admin + airfield_manager.
2. Stateless, user-picked date range + all-time (no incremental table).
3. No RDS tagging / retention metadata in-app.
4. No bundled reg PDFs (and `reference/` folder dropped entirely).
5. No restore tooling; raw JSON sidecar is optional and for "load elsewhere," not restore.
6. PDF strategy: per-record (Waivers, ACSI, Civilian §139.303 Training) · monthly
   (Discrepancies, Inspections, Checks, Obstructions, Events Log, Daily Reviews,
   Wildlife, PPR, Personnel, SCN, SMS, AEP). **AMTR excluded** (own export). Excel for
   every included module.
7. Client-side generation; ~250 MB soft ceiling with a narrow-the-scope hint.
