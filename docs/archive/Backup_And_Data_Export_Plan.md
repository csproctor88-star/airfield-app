# Backup & Data Export — Plan

> **Status:** Approved for build (complete-survivability scope). Execution started 2026-05-29.
> **Drafted:** 2026-05-06 · **Revision 2:** 2026-05-29
> **Scope:** Two related features — (1) per-base manual backup with incremental support; (2) full data export designed for the "Glidepath ceases to exist" scenario.

---

## Revision 2 (2026-05-29) — decisions locked + live-schema refresh

This block supersedes the stale parts below where they conflict. The body (format
rationale, manifest schema, engine pseudocode, UX, survival layers) still stands as
the design reference.

### Decisions (resolved with the user)

1. **Permissions** — `backups:read` / `backups:write` granted to `sys_admin`,
   `base_admin`, **and `airfield_manager`** (AFMs need ad-hoc backups before audits).
2. **Cloud retention** — **deferred to v2.** v1 is pure download-and-keep.
   **Drop the `storage_path` column** from `base_backups` (open question #2 → resolved).
3. **Restore tooling** — **kept *possible*, not built now.** Manifest retains
   `format_version` + `schema_revision`; `deletions.json` + chronological windows
   preserved so a future importer can consume the format. No restore UI in this work
   (open question #6 → resolved).
4. **Reg/reference material** — **citations + checksums index, NOT bundled DoD reg
   PDFs** (distribution rights unconfirmed; aligns with the "never ship questionable
   reg content" rule). `reference/Regulation-Index.pdf` lists reg name + version +
   citation + checksum (open question #4 → resolved).
5. **PDF/A** — polish-tier, **not v1-blocking** (open question #3 → resolved).

### Live-schema reality (the big delta)

The original `TABLE_SPECS` assumed ~30 tables. The **live schema (introspected
2026-05-29) has 111 base-scoped tables** + 26 FK-reached/global. The doc predates
AMTR (~35 tables), SMS (~12), AEP (~5), §139.303 Training, WHMP, Field Conditions,
and `page_view_daily`. Consequences:

- **JSON + photos backup = comprehensive (all 111 base-scoped tables).** This is the
  restore-ready record and it's cheap.
- **Watermark-less tables (14) → full-snapshot every backup, not windowed.** These
  have neither `updated_at` nor `created_at`: `amtr_1098_progress`, `amtr_803`,
  `amtr_formal_progress`, `amtr_jqs_progress`, `amtr_milestone_progress`,
  `amtr_quals`, `amtr_qtp_lessons`, `amtr_rat_progress`, `annual_review_digest_log`,
  `customer_feedback`, `page_view_daily`, `training_digest_log`, `training_renewals`,
  `user_documents`. The original engine assumed every table has a watermark — it does
  not. `TableSpec` gains a `snapshotAlways: true` mode.
- **FK-reached tables (no `base_id`) need a parent join** (`waiver_reviews` →
  `waivers`, `aep_comms_check_results` → `aep_comms_checks`,
  `shift_checklist_responses` → `shift_checklists`, `base_inspection_items/sections`
  → `base_inspection_templates`, `field_condition_thirds` → `field_condition_reports`,
  `inspection_item_system_links` → `inspections`, `lighting_system_components` →
  `lighting_systems`, `scn_check_results` → `scn_checks`, `user_document_pages` /
  `pdf_text_pages` / `pdf_extraction_status` → `user_documents`, `ppr_coordination` →
  `ppr_entries`, `waiver_attachments`/`waiver_coordination`/`waiver_criteria` →
  `waivers`).
- **Exclude (global/shared/ephemeral):** `regulations`, `permissions`,
  `role_permissions`, `outage_rule_templates`, `discrepancy_statuses`,
  `rate_limit_hits`. `profiles` → denormalized references only (`{id, name, rank,
  operating_initials}`), no PII. User-scoped cross-base tables
  (`user_permission_overrides`, `user_regulation_pdfs`, `user_documents` and their
  page children) are **per-user, not per-base** — include only rows whose owner is a
  member of the base, flagged for review during Phase 1.
- **Survival artifacts (PDF / Excel / HTML viewer) cover the ~15 operationally
  meaningful modules only**, NOT all 111 tables. The JSON layer is the completeness
  guarantee; the artifact layer is the human/compliance experience.

### Revised estimate

Original: 8–11 sessions. With 111 tables (vs 30), the watermark-less + FK-join
handling, and the viewer, realistic range is **12–16 sessions**. Building the
accurate `TABLE_SPECS` (with FK joins + snapshot-always flags) is Phase 1's first
task and is non-trivial on its own.

---

## Part 1 — Manual Backup Feature

Per-base, on-demand export of "everything" with incremental support. Output is a single `.zip` archive the user downloads and stores wherever they want; metadata about each backup is kept in a new `base_backups` table so the next incremental knows what window to cover. No automatic uploads to cloud retention in v1 — pure download-and-keep.

### Format: ZIP archive of JSON + photos

JSON preserves nullability, JSONB nesting, ISO timestamps, and arbitrary new columns. Photos as binary in their original format. A manifest at the root makes the bundle self-describing. ZIP gives single-file delivery + ~70% compression on JSON.

```
glidepath-backup-KBCV-incremental-2026-05-06-a3f2.zip
├── manifest.json                ← backup metadata, format version, hash
├── README.md                    ← human-readable overview generated from manifest
├── tables/
│   ├── bases.json               ← the base config row + JSONB fields
│   ├── airfield_checks.json     ← rows updated in window
│   ├── check_comments.json
│   ├── inspections.json
│   ├── inspection_items.json
│   ├── acsi_inspections.json
│   ├── acsi_items.json
│   ├── discrepancies.json
│   ├── status_updates.json
│   ├── infrastructure_features.json
│   ├── outage_events.json
│   ├── parking_*.json           ← 5 parking tables
│   ├── obstruction_*.json
│   ├── qrc_*.json
│   ├── shift_checklist_state.json
│   ├── wildlife_*.json
│   ├── waivers.json + waiver_reviews.json
│   ├── ppr_*.json
│   ├── customer_feedback.json + customer_feedback_columns.json
│   ├── scn_records.json + scn_agencies.json
│   ├── daily_reviews.json
│   ├── contractors.json
│   ├── airfield_status_log.json + arff_status_log.json + runway_status_log.json + navaid_status_log.json
│   └── activity_log.json
├── photos/                      ← binary, keyed by storage_path
│   ├── discrepancies/<uuid>/<file>
│   ├── checks/<uuid>/<file>
│   ├── inspections/<uuid>/<file>
│   ├── acsi/<uuid>/<file>
│   └── airfield-diagrams/<file>
└── deletions.json               ← reconstructed from activity_log, action='deleted'
```

**Why JSON-in-ZIP wins**
- Forward-compatible: schema changes don't break the file format
- Inspectable: unzip + jq + read in a text editor
- Restorable: any ETL tool consumes JSON (`COPY ... FROM STDIN`, Python scripts, etc.)
- Cross-platform: no Windows/Mac/Linux issues
- Single-file deliverable: one click downloads everything
- Hashable: SHA-256 of the ZIP for tamper detection
- Compressible: JSON compresses well (level 6 → ~70-80% reduction)
- Photos preserved as-is

**Why not other formats**
- Excel: JSONB collapses, dates coerce, can't embed photos.
- SQL dump: needs server-side `pg_dump`; doesn't fit a client-side button.
- CSV: lossy on JSONB and arrays; relational integrity hard.
- PDF: read-only audit-trail style — useful as a *secondary* output for compliance, not as the canonical backup format.

### Manifest schema

```json
{
  "format_version": "1.0",
  "glidepath_version": "2.34.0",
  "schema_revision": "2026050500",
  "backup_id": "uuid-...",
  "previous_backup_id": "uuid-...",
  "base": { "id": "...", "icao": "KBCV", "name": "Brookley AAF" },
  "type": "incremental",
  "from_timestamp": "2026-05-01T00:00:00Z",
  "to_timestamp": "2026-05-06T22:30:00Z",
  "created_at": "2026-05-06T22:30:00Z",
  "created_by": { "id": "...", "name": "MSgt Proctor" },
  "row_counts": {
    "airfield_checks": 14,
    "discrepancies": 3,
    "photos": 42,
    "deletions": 1
  },
  "tables_included": ["..."],
  "manifest_hash": "sha256:..."
}
```

The `manifest_hash` is the SHA-256 of every other file in the archive (sorted by path) — tamper detection. Restore tooling rejects archives with a wrong hash.

### Database

```sql
-- supabase/migrations/<ts>_base_backups.sql
CREATE TABLE base_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('full', 'incremental')),
  from_timestamp TIMESTAMPTZ,           -- NULL for type=full
  to_timestamp TIMESTAMPTZ NOT NULL,    -- the snapshot cutoff
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  filename TEXT NOT NULL,
  file_size_bytes BIGINT,
  row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  manifest_hash TEXT NOT NULL,
  notes TEXT
);
CREATE INDEX idx_base_backups_base_created ON base_backups(base_id, created_at DESC);

ALTER TABLE base_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "base_backups_read"  ON base_backups FOR SELECT
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'backups:read'));
CREATE POLICY "base_backups_write" ON base_backups FOR INSERT WITH CHECK
  (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'backups:write'));
CREATE POLICY "base_backups_delete" ON base_backups FOR DELETE
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'backups:write'));
```

Two new permission keys: `backups:read`, `backups:write`. Granted to `sys_admin` and `base_admin` by default; consider granting `airfield_manager` for ad-hoc backups before audits.

The metadata table never holds the file itself. The user keeps the ZIP locally. If they lose the file, they still have the row — it knows the cutoff timestamp the next incremental needs.

### Incrementality

**Watermark per table.** Most operational tables have `updated_at`; a few only have `created_at`. The engine knows which column to scan against per table. Rows where `watermark >= from_timestamp AND watermark < to_timestamp` get included.

**`from_timestamp`** = the previous backup's `to_timestamp` (read from `base_backups`). For the first / full backup, it's NULL → scan everything.

**`to_timestamp`** = `now()` captured once, used for all queries in the run. Concurrent writes after the cutoff are deferred to the next backup.

**Deletions.** Timestamp scans can't see deleted rows. The engine reconstructs them by querying `activity_log` for `action='deleted' AND created_at IN window`, writing each as `{ entity_type, entity_id, deleted_at, deleted_by }` into `deletions.json`. The app already logs deletions through `logActivity()`, so no additional schema work needed. Restore tooling consults `deletions.json` to know what to remove.

**Photos** use the same window scan against the `photos` table's `created_at`, then download each from the Storage bucket and embed at `photos/<storage_path>`.

### Worked examples

**Example 1 — first backup ever for KBCV.**

User clicks "Create Full Backup" in Settings. Engine:
1. `from = NULL`, `to = 2026-05-06T22:30:00Z`
2. For each of ~30 tables, fetches all rows for `base_id = KBCV.id`
3. Fetches all photos for the base from the bucket
4. Skips `deletions.json` (full backup — nothing to mark)
5. Writes manifest, zips, hashes, records row in `base_backups`, downloads to user

Result: `glidepath-backup-KBCV-full-2026-05-06-a3f2.zip` (~340 MB, mostly photos)

**Example 2 — incremental five days later.**

`from = 2026-05-06T22:30:00Z` (previous `to_timestamp`), `to = 2026-05-11T18:15:00Z`.

The query for `airfield_checks` becomes:
```sql
SELECT * FROM airfield_checks
WHERE base_id = $1 AND updated_at >= $from AND updated_at < $to
```

`tables/airfield_checks.json` contains 7 rows (the FOD/PTD checks completed those days). `photos/` has just the photos created in that window. `deletions.json` has 2 rows (one discrepancy was deleted, one personnel record was). Total ~12 MB.

**Example 3 — user lost the second incremental.**

User has full from May 6, incremental from May 11, **lost** incremental from May 14, has incremental from May 17. Restore from these would have a hole.

The UI flags this: the backup history list shows "Last full: 11 days ago — consider creating a new full backup." A "Create Full Backup" option is always present so the user can re-baseline whenever they want.

### Engine pseudocode

```typescript
// lib/backup-engine.ts

interface TableSpec {
  tableName: string
  watermarkColumn: 'updated_at' | 'created_at'
  baseIdColumn: string | null    // null when reached via FK
  parentJoin?: { via: string; through: string } // e.g. check_comments via check_id through airfield_checks
}

const TABLE_SPECS: TableSpec[] = [
  { tableName: 'bases', watermarkColumn: 'updated_at', baseIdColumn: 'id' },
  { tableName: 'airfield_checks', watermarkColumn: 'updated_at', baseIdColumn: 'base_id' },
  { tableName: 'check_comments', watermarkColumn: 'created_at', baseIdColumn: null,
    parentJoin: { via: 'check_id', through: 'airfield_checks' } },
  // ...30 entries
]

async function createBackup(baseId: string, type: 'full' | 'incremental', userId: string) {
  // 1. Resolve window
  const lastBackup = type === 'incremental' ? await fetchLastBackup(baseId) : null
  if (type === 'incremental' && !lastBackup) throw 'No prior backup — create a full backup first'
  const fromTs = lastBackup?.to_timestamp ?? null
  const toTs = new Date().toISOString()

  // 2. Open zip, init counts
  const zip = new JSZip()
  const counts: Record<string, number> = {}

  // 3. Walk tables, write each as <name>.json
  for (const spec of TABLE_SPECS) {
    onProgress(`Exporting ${spec.tableName}…`)
    const rows = await fetchTableRows(spec, baseId, fromTs, toTs)
    counts[spec.tableName] = rows.length
    if (rows.length > 0) zip.file(`tables/${spec.tableName}.json`, JSON.stringify(rows))
  }

  // 4. Photos — query, download, embed
  onProgress('Bundling photos…')
  const photos = await fetchPhotosInWindow(baseId, fromTs, toTs)
  for (const p of photos) {
    const blob = await supabase.storage.from('photos').download(p.storage_path)
    zip.file(`photos/${p.storage_path}`, blob)
  }
  counts.photos = photos.length

  // 5. Deletions reconstructed from activity_log
  if (type === 'incremental') {
    const deletions = await fetchDeletionsInWindow(baseId, fromTs, toTs)
    zip.file('deletions.json', JSON.stringify(deletions))
    counts.deletions = deletions.length
  }

  // 6. Manifest + README
  const manifest = buildManifest({ baseId, type, fromTs, toTs, userId, counts, lastBackup })
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('README.md', renderReadme(manifest))

  // 7. Generate, hash, record, download
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const hash = await sha256OfBlob(blob)
  const filename = `glidepath-backup-${baseIcao}-${type}-${toTs.slice(0, 10)}-${shortId(hash)}.zip`
  await supabase.from('base_backups').insert({
    base_id: baseId, type,
    from_timestamp: fromTs, to_timestamp: toTs,
    filename, file_size_bytes: blob.size,
    row_counts: counts, manifest_hash: hash,
    created_by: userId,
  })
  saveAs(blob, filename)
}
```

### UX

**Where:** new tab `/settings/backups` (or section within `/settings`), gated by `backups:read`.

**Layout:**

```
┌── Backups & Data Export ────────────────────────────────────┐
│                                                              │
│  Your last full backup was 12 days ago.  [Create Full]       │
│  Quick incremental: covers since May 6.   [Create Incremental] │
│                                                              │
│  History                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Date         Type          Range          Size  Rows │    │
│  │ 2026-05-11   Incremental   5d window     12 MB  73   │ 🗑  │
│  │ 2026-05-06   Full          all-time     341 MB 8.4K  │ 🗑  │
│  │ 2026-04-29   Full          all-time     298 MB 7.9K  │ 🗑  │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Retention: keep all backups · [Bulk delete older than __]   │
└──────────────────────────────────────────────────────────────┘
```

**Progress modal during creation** — shows the current table being exported, photos progress (n/total + cumulative MB), allows cancel. Cancel discards the partial ZIP and doesn't write to `base_backups`.

**Warnings:**
- "No prior backup found — your first backup must be a full backup."
- "Last full backup was 30+ days ago — consider creating a new one to keep restore reliable."
- "Estimated size: ~340 MB. This may take 2-5 minutes." (for full backups)

**Manual delete:** removes the row from `base_backups`. Doesn't delete the local file (we never had it). If the user deletes the most recent backup, the next incremental's `from_timestamp` is the new "last" — gaps just become longer windows on future backups.

### Edge cases

- **Concurrent backup runs.** Two clicks → two ZIPs. Cheap and harmless. Both record rows in `base_backups`, both have valid `to_timestamp`s, the *next* incremental uses the latest one.
- **Browser memory ceiling.** JSZip holds the archive in memory. Tested fine to ~500 MB on modern browsers; beyond that it can OOM. Mitigation: full backup over ~250 MB suggests "incremental from now on" via the UI; v2 could move ZIP generation server-side via an Edge Function.
- **Photo download failures.** Storage 403 / network drop. Engine retries each failure 3× then logs to `manifest.failures[]`. Backup still completes; restore tooling re-fetches missing photos by storage_path.
- **Schema migration between backups.** Each manifest pins `schema_revision`. Restore tooling has a migration map (e.g., 2026050500 → current); incremental restore replays in chronological order.
- **Deleted base.** When a `base` is hard-deleted, `ON DELETE CASCADE` removes all child rows including `base_backups` rows. The user's local ZIP files remain.
- **PostgREST row limits.** `fetchTableRows` paginates with the same cursor pattern shipped on activity_log (`.range()` + 1000 page size). Required because some tables (activity_log on busy bases) can exceed 1000 rows in a single window.
- **Reference data.** `regulations` / `aircraft` catalog are global — backup excludes them since restoring would clobber other bases' shared data. Only the per-base `bases.discrepancy_type_shop_map` JSONB (which lives on the base row) gets included.
- **User profiles.** Backup includes referenced user IDs as `{id, name, rank, operating_initials}` denormalized into a `tables/profiles_referenced.json` so the rows resolve even if profiles change later. Doesn't include emails / EDIPIs (PII control).

### Phasing — Manual Backup core

**Phase 1 — Foundation (one session, ~3-4h)**
- Migration: `base_backups` table + RLS + permission keys
- `lib/supabase/backups.ts` — CRUD: `fetchBackups(baseId)`, `recordBackup(...)`, `deleteBackup(id)`, `fetchLastBackup(baseId)`
- `lib/backup-engine.ts` — table specs + fetch loop, JSON-only output (no photos yet)
- New page: `app/(app)/settings/backups/page.tsx` with Create + history list
- Permission matrix update for `backups:read` / `backups:write`
- Sidebar entry under Settings

**Phase 2 — Photos & full bundle (one session)**
- JSZip integration
- Photo enumeration + download from Storage
- Airfield-diagrams + obstruction-photos + email-temp paths
- Manifest finalization + README generation
- SHA-256 hashing
- Progress modal with per-table + per-photo status

**Phase 3 — Incremental + retention (one session)**
- Type toggle (full vs incremental)
- `from_timestamp` resolution from prior backup
- Deletion reconstruction from activity_log
- "Last full was N days ago" warning
- Bulk-delete-older-than control

### Files affected (Phase 1+2+3)

- `supabase/migrations/<ts>_base_backups.sql` — new
- `supabase/migrations/<ts>_backups_permission_keys.sql` — adds the two permission rows
- `lib/supabase/backups.ts` — new (~150 LOC)
- `lib/backup-engine.ts` — new (~350 LOC, the meat)
- `lib/backup-table-specs.ts` — new (~30-row config table)
- `lib/backup-readme.ts` — new (renders human-readable README from manifest, ~80 LOC)
- `app/(app)/settings/backups/page.tsx` — new (~400 LOC: history list + creation modal + progress)
- `lib/supabase/types.ts` — `BaseBackupRow` type
- `lib/permissions.ts` — register `backups:read` / `backups:write` keys
- `lib/sidebar-config.ts` — add Backups under Settings
- `package.json` — add `jszip` (~150KB gz, well-maintained)
- `CHANGELOG.md` + version bump

---

## Part 2 — Survivability Mode (Glidepath Ceases to Exist)

Original Phase 1–3 above optimizes for **data portability** (restore into another Glidepath instance). Survivability mode optimizes for **data survivability** — Glidepath disappears, users still need to view, print, and operate. The format has to bridge from a database export to artifacts that work on any computer in 2046 with no internet.

Three new layers on top of what's already planned:

1. **Per-entity PDFs** — every form, contract-grade, printable
2. **Excel sidecars + master workbook** — open in any version of Excel
3. **Self-contained offline HTML viewer** — `file://` browser, no server, no internet

Plus reference materials, a continuity guide, and reorganized photos.

### Updated ZIP layout

```
glidepath-backup-KBCV-full-2026-05-06.zip
├── manifest.json                          ← unchanged
├── README.md                              ← unchanged
├── tables/                                ← JSON, unchanged (restore path)
├── photos/                                ← original UUIDs, unchanged (restore path)
├── deletions.json                         ← unchanged
│
├── viewer/                                ← NEW — open viewer/index.html in any browser
│   ├── index.html                         ← double-click to use
│   ├── app.js                             ← vanilla JS or Alpine, all inline
│   ├── styles.css
│   └── data.js                            ← window.GLIDEPATH_BACKUP = {...}
│
├── documents/                             ← NEW — generated PDFs
│   ├── 00-Cover-Audit-Summary.pdf         ← legal cover sheet, hash table
│   ├── 01-Events-Log.pdf                  ← AF Form 3616 equivalent
│   ├── 02-Daily-Reviews.pdf               ← signed shift reviews
│   ├── 03-Discrepancies/<DSC-####>.pdf    ← one per row
│   ├── 04-Inspections/<INSP-####>.pdf
│   ├── 05-Checks/<CHK-####>.pdf
│   ├── 06-ACSI/<year>.pdf
│   ├── 07-Waivers/<AF505-####>.pdf
│   ├── 08-Obstructions/<OBST-####>.pdf
│   ├── 09-PPRs/<PPR-####>.pdf
│   ├── 10-Wildlife-Log.pdf                ← BASH sightings + strikes
│   ├── 11-Personnel.pdf                   ← contractor history + AF Form 483s
│   └── 12-SCN-PCAS-Tests.pdf
│
├── spreadsheets/                          ← NEW — Excel for human use
│   ├── 00-Master-Workbook.xlsx            ← one sheet per module, denormalized
│   ├── Discrepancies.xlsx
│   ├── Checks.xlsx
│   ├── Inspections.xlsx
│   ├── Events-Log.xlsx
│   ├── Personnel.xlsx
│   ├── Wildlife.xlsx
│   ├── Waivers.xlsx
│   └── Obstructions.xlsx
│
├── photos-organized/                      ← NEW — human-navigable mirror
│   ├── Discrepancies/DSC-0042/2026-04-15_pavement-crack-NW.jpg
│   ├── Inspections/INSP-2026-0145/...
│   └── photos-manifest.csv                ← original_path → organized_path → parent
│
├── reference/                             ← NEW — keep operating without us
│   ├── Regulations/                       ← DAFMAN 13-204, UFC 3-260-01, AFMAN 91-203, AF Form 505/483/3616
│   ├── QRC-Procedures.pdf                 ← all 25 QRCs, paper-runnable
│   ├── Aircraft-Catalog.pdf               ← silhouettes + parking specs
│   └── Wildlife-Species-Reference.pdf
│
└── continuity-guide/                      ← NEW — fall-back-to-paper playbook
    ├── README-FIRST.pdf                   ← read if Glidepath has disappeared
    ├── Per-Module-Paper-Process.pdf       ← which AF Form replaces each module
    └── Excel-Templates/                   ← blank, ready to start typing into
        ├── Discrepancy-Tracker.xlsx
        ├── Check-Log.xlsx
        ├── Events-Log.xlsx
        ├── Daily-Review-Signoff.xlsx
        └── Wildlife-Log.xlsx
```

### The HTML viewer (centerpiece)

The difference between "users have JSON files" and "users have a working tool."

**Behavior**

Double-click `viewer/index.html` → opens in default browser → identical look to Glidepath but read-only. Sidebar mirrors current modules. Click Discrepancies → see the same table. Click a row → detail view with all fields, comments, photos. Search bar across the top hits everything. Print button on each detail view produces a clean printable page. CSV export buttons on every list.

No internet required. No npm install required. Works on any OS with any browser, including air-gapped networks.

**Implementation constraints**

- All data inline as `window.GLIDEPATH_BACKUP = {...}` in `data.js`. Cannot use `fetch()` because `file://` blocks it in Chrome/Firefox.
- All CSS / fonts / icons inline (no CDN). Lucide icons get inlined as SVG strings (precedent: `lib/render-lucide-svg.ts`).
- Photos load via relative paths — `<img src="../photos-organized/Discrepancies/DSC-0042/...jpg">` works on `file://`.
- No build step in the deployed artifact. Source can be vanilla JS or Alpine.js. React/Next is too heavy.
- Target ~500 KB for code, plus data (typically 5–50 MB inlined).

**Recommended stack**: Alpine.js (~15 KB) + Tailwind via CDN inlined as a CSS file + vanilla JS. Familiar to anyone who's touched Glidepath, low maintenance burden.

**What it renders**: every module from the Glidepath sidebar, in a read-only view that mirrors the live app's columns and grouping. Click-through navigation. Search across actor / OI / details / display IDs / titles, same fields the server-side search hits today.

### Per-entity PDFs

Reuse the 12 existing generators (`lib/check-pdf.ts`, `lib/discrepancy-pdf.ts`, etc.). For a full backup, the engine iterates every row and generates the corresponding PDF, names it `<display_id>.pdf`, and bundles into `documents/<module>/`. These are the same outputs the Air Force already accepts.

For multi-row aggregate logs (Events Log, Daily Reviews, Wildlife Log), use a single multi-page PDF with autoTable.

**Cover / Audit Summary** is the legal opening document. 5–10 pages, includes:
- "This backup is the original electronic record of [Base] Airfield Operations from [date] to [date]"
- Module-by-module counts and date ranges
- SHA-256 hash of every file in the archive (tamper detection)
- Generation timestamp + Glidepath version + signing user
- Compliance reference per module ("These records satisfy DAFMAN 13-204v2 §X.X")
- Print + sign block for the Airfield Manager

### Excel sidecars

Reuse `lib/excel-export.ts` (already used in 13 places). Per-module workbooks plus one master workbook with every module on its own sheet. Excel is the universal "I just need to look at this in a list" tool.

### Reference materials

What the unit needs to keep operating after Glidepath goes dark:

- **Regulation PDFs** — the regs Glidepath references (DAFMAN 13-204v1/v2, UFC 3-260-01, AFMAN 91-203, AF Form 505 / 483 / 3616). These are public DoD documents; bundle copies. Caveat: confirm distribution rights before shipping; alternative is to include a links + versions list with checksums.
- **QRC Procedures PDF** — all 25 QRC checklists in one printable document, organized by category. The unit can keep paper copies on the wall.
- **Aircraft Catalog** — silhouettes + parking dimensions for every aircraft in the system.
- **Wildlife Species Reference** — the 270+ species the system tracks, with photos and identification notes.

### Continuity-of-operations guide

A short PDF that opens with: *"If Glidepath stops working, here's how to keep airfield operations going."* Per-module fallback section:

```
DISCREPANCIES
  Replace with: AF Form 1297 + tracking spreadsheet
  Template: continuity-guide/Excel-Templates/Discrepancy-Tracker.xlsx
  Process: log new discrepancies on the form, transfer to the spreadsheet
           weekly, archive forms by month.

CHECKS
  Replace with: pre-printed checklist (attached at end of this guide)
  Process: ...

EVENTS LOG
  Replace with: AF Form 3616 (CAC signature requirement applies if no waiver)
  Process: ...
```

Plus blank Excel templates pre-populated with the right columns mirroring the JSON schema.

### Photos: human-organized mirror

The `photos/` folder uses UUIDs (good for restore, useless for browsing). Add `photos-organized/` as a parallel tree:

```
photos-organized/
├── Discrepancies/DSC-0042/2026-04-15_photo_1_pavement-crack.jpg
├── Inspections/INSP-2026-0145/2026-05-01_photo_3_lighting-bar-08L.jpg
├── ACSI/2026/2026-03-20_photo_2_runway-marking-fade.jpg
└── photos-manifest.csv  (original_path, organized_path, parent_type, parent_id, caption)
```

The CSV is the bridge — a forensic auditor can verify any photo's provenance.

### Format longevity

- **PDF/A** — the archival PDF profile. Same content, guaranteed to render the same in 50 years. jsPDF has limited PDF/A support; we'd add it where feasible (the cover document and Events Log are highest priority for archival quality). Not all generators need it — operational discrepancy PDFs being slightly less archival is acceptable.
- **Hash everything** — the cover document's tamper-detection hash table covers every file. Any future inspector can verify nothing was altered post-export.
- **Self-describing manifest** — already in the plan. Includes format_version + glidepath_version + schema_revision so a future tool knows what it's looking at.

### Phasing — Survivability additions

Original Phase 1–3 (data portability for restore) **unchanged**. Add:

| Phase | What | Sessions |
|---|---|---|
| 4 | Per-entity PDFs + cover document | 1 |
| 5 | Excel sidecars + master workbook | 1 |
| 6 | HTML viewer (read-only browser app) | 2–3 |
| 7 | Reference materials + continuity guide | 1 |
| 8 | Photo reorganization mirror | 0.5 |

**Total survival-mode add: ~5–7 sessions on top of the original 3–4.**

### Recommended cuts

You don't have to ship all of this at once. Three viable cuts:

**Minimum viable survival** (~+2 sessions): Phase 4 (per-entity PDFs) + Phase 5 (Excel sidecars). 80% of the survivability story for 25% of the work. Users can print every form and open every spreadsheet; they lose interactive search.

**Full paper-fallback** (~+3 sessions): Add Phase 7 + Phase 8. Now the unit also has a continuity guide and properly organized photos. Still no interactive viewer.

**Complete survivability** (~+6 sessions): Add Phase 6. The HTML viewer is the experience-changer — it turns the backup from "files" into "a working app you can open without us." Worth it if you genuinely expect the system might disappear and want users to land softly.

If commercial viability of Glidepath is a question (the trademark issue in the tech-debt list hints at this), the complete survivability path is also a meaningful **trust signal** to leadership: "your data isn't held hostage by the vendor."

### Total scope

- Original plan: 3-4 sessions for Phase 1-3.
- With survival additions: 5-7 additional sessions.
- Grand total: 8-11 focused sessions.

---

## Open questions to resolve before implementation

1. **Permission matrix for `backups:read` / `backups:write`** — which roles by default? sys_admin and base_admin are obvious; should airfield_manager have it?
2. **Cloud retention** — defer to v2 or never? If never, drop the `storage_path` column from `base_backups`.
3. **PDF/A** — investigate jsPDF support and whether it's a v1 requirement or a polish item.
4. **Regulation PDF distribution rights** — confirm we can bundle the actual reg text, or fall back to citations + checksums.
5. **Browser memory ceiling for full backups** — at what size do we hit OOM? Real-world testing on a base with hundreds of MB of photos.
6. **Restore tooling** — is it ever going to be built? If yes, the format spec needs versioning discipline. If never, simpler.

---

*Drafted during the 2026-05-06 session as a parking spot for future implementation. The lazy-load + server-side search + compound index work that shipped this session is not part of this plan — that was a separate Events Log refresh.*
