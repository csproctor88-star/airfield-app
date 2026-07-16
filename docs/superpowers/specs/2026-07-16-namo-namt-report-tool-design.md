# NAMO/NAMT Report Tool — Design

- **Date:** 2026-07-16
- **Status:** Approved design (owner-confirmed title: "NAMO/NAMT Report Tool")
- **Module:** Reports & Analytics (`/reports`)
- **Migration range assigned:** `2026071640`–`2026071649` (bump to the actual implementation date when applied)

## Summary

A report under Reports & Analytics that answers "who did what, and how much, over a period":
select one or more data domains (wildlife sightings, wildlife strikes, airfield checks,
inspections, discrepancies reported, QRC initiations, QRC completions, daily-review
sign-offs, PPR entries), pick a date range, and get **counts broken down by individual
user** — e.g. how many BASH sightings SrA Smith logged, how many inspections she
completed, how many QRCs she initiated.

Audience: AFM/DAFM (ops oversight), NAMO (NCOIC, Airfield Management Operations) and
NAMT (NCOIC, Airfield Management Training) for training-currency and workload visibility,
plus base admins; on civilian Part 139 bases, the airport manager / ops supervisor
equivalents. Output: on-screen matrix (users × selected domains, with totals), per-user
drill-down of the underlying records, PDF export, Excel export, and email delivery via
the existing PDF-email flow.

Why now: attribution data already exists for almost every domain (uuid actor columns are
written on every create path), but nothing aggregates it — leadership currently counts
rows by hand or not at all. One small migration closes the only real attribution gap
(airfield checks).

## Regulatory basis

This tool is a **management-insight report, not a compliance record**. No DAFMAN/DAFI/UFC
paragraph is cited as requiring it, and none is asserted here. The domains it counts are
the platform's existing regulatory modules (checks/inspections/discrepancies under
DAFMAN 13-204; BASH under DAFMAN 91-212; QRC under AFMAN 91-203 — publication-level
mapping per the project's Regulatory Context table). Whether NAMO/NAMT duty descriptions
in the current DAFMAN 13-204 publication reference per-person activity tracking is
**unverified** — see Assumptions & open questions. The report must not claim regulatory
mandate in its UI or PDF header.

## Current state

**Reports stack.** Each report is a page under `app/(app)/reports/<slug>/page.tsx` linked
from the `REPORT_CARDS` array in `app/(app)/reports/page.tsx:14-20`; the hub also has a
preset (7d/30d/90d/6mo/1yr) + custom From/To date selector (`reports/page.tsx:22-28,
127-158`). The canonical report flow is `app/(app)/reports/daily/page.tsx:41-122`: picker
→ local-day→UTC boundary conversion (lines 63-69) → fetch → preview → `generate…Pdf(data,
opts)` returning `{ doc, filename }` → `doc.save(filename)`, plus email via
`EmailPdfModal` (`components/ui/email-pdf-modal.tsx`) and `sendPdfViaEmail`
(`lib/email-pdf.ts` → `app/api/send-pdf-email/route.ts`). Multi-domain aggregation
precedent is `lib/reports/analytics-data.ts` — a `Promise.all` fan-out of plain
supabase-js selects filtered by `base_id` + date range, grouped in TypeScript. Excel
precedent is `lib/excel-export.ts` — `createStyledWorkbook()` (dynamic `import('exceljs')`,
lines 42-48) + `addStyledSheet(wb, name, columns, rows)` (lines 51-90). Shared PDF chrome
lives in `lib/pdf-utils.ts` (`createPdf`, header/footer helpers).

**Per-domain actor attribution (verified):**

| Domain | Table | Actor column(s) | FK to profiles | Date column |
|---|---|---|---|---|
| Wildlife sightings | `wildlife_sightings` | `observed_by_id UUID` + `observed_by TEXT` | **no FK** (columns exist since `2026031400_create_wildlife_tables.sql:36-37`; both written by `components/wildlife/sighting-form.tsx:226-227`) | `observed_at` (timestamptz) |
| Wildlife strikes | `wildlife_strikes` | `reported_by_id UUID` + `reported_by TEXT` | **no FK** (`2026031400…sql:110-111`; written by `components/wildlife/strike-form.tsx:264-265`) | `strike_date` (**DATE**, cf. `analytics-data.ts:340-341`) |
| Airfield checks | `airfield_checks` | `completed_by TEXT` (free-text "Rank First Last", `app/(app)/checks/page.tsx:100-104,568`); `saved_by_id UUID` gets `auth.uid()` on create (`lib/supabase/checks.ts:70-87`) but is draft-save-named and also written by draft saves (`checks.ts:455,485`) | **no uuid "completed by" column** — the gap this spec fixes | `completed_at`; `status = 'completed'` (`checks.ts:35,181`) |
| Inspections | `inspections` | `inspector_id UUID` + `completed_by_id UUID` (both set from `auth.uid()` at create, `lib/supabase/inspections.ts:148-202`), plus `*_name` text | FK → profiles | `completed_at` (set at create, `inspections.ts:197`); `status='completed'` |
| Discrepancies | `discrepancies` | `reported_by UUID` (set from `auth.uid()`, `lib/supabase/discrepancies.ts:148-186`) | FK → profiles **ON DELETE SET NULL** (embed `reporter:reported_by(name, rank, operating_initials)`, `discrepancies.ts:77,108`) | `created_at` |
| QRC | `qrc_executions` | `opened_by UUID` / `closed_by UUID` from `auth.uid()` (`lib/supabase/qrc.ts:144-158, 305-320`) | **no FK** (`2026030700_create_qrc_module.sql:37,40`) | `opened_at` / `closed_at` + `status='closed'` |
| Daily reviews | `daily_reviews` | five `*_signed_by UUID` slots (`day_amsl/swing_amsl/mid_amsl/namo/afm`) | FK → profiles; batch name lookup via `fetchSignersForRows` (`lib/supabase/daily-reviews.ts:243-266`) | `review_date` (DATE) |
| PPR | `ppr_entries` | `created_by UUID` | FK → profiles (embed used in `lib/supabase/ppr.ts`) | `created_at` |

**What does NOT exist:** no per-user aggregation anywhere (no RPC, view, or report groups
by user); no `completed_by_id` on `airfield_checks`; no profiles FK on the QRC/wildlife
uuid columns (so PostgREST embeds are unavailable there — batch `.in('id', …)` lookup is
the house pattern, `daily-reviews.ts:243-266`). `app/api/user-emails` is a transactional
email route, **not** a user-directory API — display names come from `profiles` directly.
NOTAMs have a `created_by` FK but rows come from the FAA sync route and the create page
is a non-persisting stub — per-user NOTAM counts would be meaningless (scoped out).

**Permissions/nav:** `reports:view` / `reports:export` exist (`lib/permissions.ts:133-134`).
`/reports` is in `ALWAYS_ON_HREFS` (`lib/modules-config.ts:346`) — report sub-pages need
no sidebar entry, no `enabled_modules` key, and no wizard step.

## Design

**Entry point.** A new card in `REPORT_CARDS` on `/reports`: title "NAMO/NAMT Report
Tool", description "Activity counts by individual user across selected modules.", icon
`Users` (lucide), href `/reports/user-activity`. The card renders only when the viewer
holds the new `reports:user_activity` permission (see Access control) — `REPORT_CARDS`
gains an optional `perm` field and the hub filters on it.

**Page flow** (`/reports/user-activity`, modeled on `reports/daily/page.tsx`):

1. **Picker state.** Date presets (Last 7 / 30 / 90 days, Month-to-date, FY-to-date) +
   custom From/To `<input type="date">` (end ≥ start, `max=today`, validated with a
   Sonner toast). Local days convert to UTC boundaries exactly like
   `reports/daily/page.tsx:63-69`. Below the range: **domain checkboxes** (all nine
   domains, all checked by default). A domain checkbox is rendered **disabled with a
   "requires <module> view access" note** when the viewer lacks that domain's `:view`
   permission — this prevents RLS from silently returning zero rows and the report
   showing wrong counts. A toggle "Include personnel with zero activity" (default off)
   adds active base members with no counted records as all-zero rows.
2. **Generate → preview.** `fetchUserActivityData(...)` (below) → matrix table: one row
   per user, one column per selected domain, plus a **Total** column and a **Totals**
   footer row. Sort: total desc, then name asc. Rows are grouped into three sections
   when applicable: linked users (resolved profiles), *Unlinked names* (free-text-only
   attribution, rendered verbatim with an "unlinked" chip), and a single *Unattributed*
   row (records with neither uuid nor name, or a uuid with no surviving profile —
   labeled "Former user" when a uuid exists but the profile is gone).
3. **Drill-down.** Clicking a user row expands an inline panel listing that user's
   records per domain: label (display_id or species/QRC title), date, and a link to the
   record where a detail route exists (`/discrepancies/[id]`, `/inspections/[id]`,
   `/checks/[id]`). This is free: the data module already fetched id + label + timestamp
   per row for counting, so drill-down renders from memory — no second fetch.
4. **Coverage honesty.** For each selected domain whose *attribution coverage start*
   (see data module) is later than the selected range start, the preview and both
   exports render a footnote: "⚠ <Domain>: per-user attribution begins <date>; N record(s)
   in range are counted under Unlinked/Unattributed." Never silently under-report.
5. **Exports.** Buttons: Download PDF, Download Excel, Email PDF — all gated on
   `reports:export`. Email uses the existing `EmailPdfModal` + `sendPdfViaEmail` flow
   with `defaultPdfEmail` prefill from `useInstallation()`.

**Edge cases.**
- **DATE vs timestamptz:** `strike_date` and `review_date` are DATE columns — filter with
  local-day strings (`isoStart.slice(0,10)`), matching `analytics-data.ts:340-341`; all
  other domains filter timestamptz on the UTC boundaries.
- **QRC double counting is intentional:** "QRC initiated" (by `opened_by` on `opened_at`)
  and "QRC completed" (by `closed_by` on `closed_at`, `status='closed'`) are separate
  columns; a QRC opened before the range but closed inside it counts only as a completion.
- **Daily reviews:** each non-null `*_signed_by` slot on a row whose `review_date` falls
  in range counts one sign-off for that signer (a user can earn up to 2/day, e.g. AMSL +
  NAMO slots).
- **Drafts:** checks and inspections count only `status='completed'` rows; check drafts
  (`status='draft'`) are never counted.
- **Zero-selection:** Generate disabled until ≥1 enabled domain is checked.
- **Mobile:** the matrix lives in an `overflow-x: auto` container with a sticky first
  (user) column; the drill-down panel stacks vertically.
- **Empty result:** render the matrix shell with the Totals row of zeros plus "No
  attributed activity in this range" — still exportable (useful as a gap report).

## Data model & migrations

No new tables (so no new-table RLS surface). Three additive migrations:

**`2026071640_namo_namt_report_permission.sql`** — new permission key + grants, copying
the `2026062100_read_file_permissions.sql` idiom:

```sql
INSERT INTO permissions (key, label, category, description) VALUES
  ('reports:user_activity', 'NAMO/NAMT Report Tool', 'reports',
   'Run per-user activity counts across modules (users × domains matrix)')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin's all-permissions seed predates this key; grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', 'reports:user_activity'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Ops/training leadership + admins. amops deliberately excluded: the report
-- ranks individual output and is a leadership tool.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, 'reports:user_activity'
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin'),
             ('accountable_executive'), ('ops_supervisor')) AS r(role)
ON CONFLICT (role, permission_key) DO NOTHING;
```

**`2026071641_checks_completed_by_id.sql`** — close the airfield-checks attribution gap:

```sql
-- airfield_checks.completed_by is free text and saved_by_id is draft-save-named.
-- Add a real "who completed it" uuid, populated going forward by createCheck().
ALTER TABLE airfield_checks
  ADD COLUMN IF NOT EXISTS completed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Deterministic same-row copy (NOT a fuzzy historic backfill): on completed rows,
-- saved_by_id was captured from auth.uid() at creation (lib/supabase/checks.ts:70-87),
-- so it is the completer for every in-app completed check since the column existed.
UPDATE airfield_checks
SET completed_by_id = saved_by_id
WHERE status = 'completed' AND completed_by_id IS NULL AND saved_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airfield_checks_completed_by
  ON airfield_checks (base_id, completed_by_id) WHERE status = 'completed';
```

RLS is unchanged — existing `airfield_checks` policies already cover the new column
(matrix policies gate row access, not columns).

**`2026071642_attribution_profile_fks.sql`** — integrity + typegen for the FK-less uuid
columns (the report itself uses batch lookup and does not depend on these):

```sql
-- NOT VALID: tolerate any pre-existing orphan uuids; validates new writes only.
ALTER TABLE qrc_executions
  ADD CONSTRAINT qrc_executions_opened_by_fkey
  FOREIGN KEY (opened_by) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE qrc_executions
  ADD CONSTRAINT qrc_executions_closed_by_fkey
  FOREIGN KEY (closed_by) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE wildlife_sightings
  ADD CONSTRAINT wildlife_sightings_observed_by_id_fkey
  FOREIGN KEY (observed_by_id) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE wildlife_strikes
  ADD CONSTRAINT wildlife_strikes_reported_by_id_fkey
  FOREIGN KEY (reported_by_id) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
```

(Wrap each in a `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL $$` guard or check
`pg_constraint` first, per the idempotency style of `2026071300_configurable_shifts.sql`.)

**Attribution coverage constants** (encoded in the data module, rendered as footnotes):
wildlife sightings/strikes — uuid columns since `2026031400` (module launch → full
coverage; nulls only where the session lookup failed); QRC — since `2026030700` (module
launch → full coverage); airfield checks — uuid coverage from `2026030300` (when
`saved_by_id` appeared) via the backfill copy, authoritative `completed_by_id` from
migration `2026071641` forward; inspections / discrepancies / daily reviews / PPR — actor
FK columns are original to their tables (coverage = full history; confirm during
implementation and set the constant to `null` = "no footnote" where true).

## Access control

- **New key:** `reports:user_activity` (mirrored as `PERM.REPORTS_USER_ACTIVITY` in
  `lib/permissions.ts`, grouped under the "Reporting / activity" section comment).
- **Who gets it (role presets):** `sys_admin`, `airfield_manager`, `namo`, `base_admin`;
  civilian: `accountable_executive`, `ops_supervisor`. NOT granted to `amops`, `ces`,
  `safety`, `atc`, `read_only`, kiosk roles — the report effectively ranks individual
  airmen's output and is restricted to leadership. Per-user overrides
  (`user_permission_overrides`) let an AFM grant it to a specific NAMT whose account
  holds a different role.
- **Page gate:** the page checks `has(PERM.REPORTS_USER_ACTIVITY)` (pattern:
  `app/(app)/read-file/page.tsx:40-41`) and renders an access notice otherwise; the hub
  card is hidden without it. RLS remains the real enforcement — all reads go through the
  domain tables' existing matrix SELECT policies.
- **Per-domain read dependency:** counting a domain requires that domain's `:view`
  permission (`checks:view`, `inspections:view`, `discrepancies:view`, `qrc:view`,
  `wildlife:view`, `daily_reviews:view`, `ppr:view`) because the client reads those
  tables under RLS. The UI disables domains the viewer can't read (never silent zeros).
- **Exports:** PDF/Excel/email buttons additionally require `reports:export`
  (`lib/permissions.ts:134`).

## lib/ modules & API surface

No new API routes (all client-side, like every other report; email reuses
`app/api/send-pdf-email/route.ts`).

**`lib/reports/user-activity-data.ts`** (new):

```ts
export type UserActivityDomain =
  | 'wildlife_sightings' | 'wildlife_strikes' | 'checks' | 'inspections'
  | 'discrepancies' | 'qrc_opened' | 'qrc_closed' | 'daily_review_signoffs' | 'ppr'

export interface DomainDef {          // registry, one entry per domain
  key: UserActivityDomain
  label: string                       // column header
  viewPerm: string                    // PERM key required to include it
  coverageStart: string | null        // ISO date attribution begins, null = full history
}
export const USER_ACTIVITY_DOMAINS: DomainDef[]

export interface ActivityRecordRef { id: string; label: string; ts: string; href: string | null }
export interface UserActivityRow {
  kind: 'profile' | 'unlinked' | 'unattributed'
  key: string                         // profile id | normalized name | 'unattributed'
  display: string                     // "Rank Name (OI)" via formatSigner-style composition
  counts: Record<UserActivityDomain, number>
  total: number
  records: Partial<Record<UserActivityDomain, ActivityRecordRef[]>>   // drill-down
}
export interface UserActivityData {
  rows: UserActivityRow[]
  totals: Record<UserActivityDomain, number>
  coverageNotes: { domain: UserActivityDomain; coverageStart: string; affected: number }[]
}

export async function fetchUserActivityData(
  baseId: string, startIso: string, endIso: string,
  domains: UserActivityDomain[],
  opts?: { includeZeroActivity?: boolean },
): Promise<UserActivityData>

// Pure + exported for vitest:
export function buildActivityMatrix(raw: RawDomainRow[], profiles: Map<string, SignerInfo>,
  domains: UserActivityDomain[]): UserActivityData
export function actorKeyFor(uuid: string | null, name: string | null):
  { kind: 'profile' | 'unlinked' | 'unattributed'; key: string }
```

Implementation notes: `Promise.all` fan-out per selected domain (mirrors
`analytics-data.ts:77-129`), each select fetching only `id`, the actor column(s), the
date column, a label column, and any status filter — always `.eq('base_id', baseId)`.
Daily reviews fetch all five `*_signed_by` slots and emit one raw row per non-null slot.
After the fan-out, ONE batched `profiles.select('id, name, rank, operating_initials')
.in('id', allUuids)` resolves display names (mirrors `fetchSignersForRows`,
`lib/supabase/daily-reviews.ts:243-266`; reuse its `SignerInfo` + `formatSigner`).
Grouping precedence: uuid → profile row (or "Former user" bucket if the profile vanished);
uuid null + non-empty free-text name → unlinked bucket keyed on
`name.trim().toLowerCase()`; else unattributed. Zero-activity personnel (opt-in) come
from active base members (`base_members` joined to `profiles`, excluding kiosk/service
roles `airfield_status`, `atc`, `ppr`, `read_only`).

**`lib/reports/user-activity-pdf.ts`** (new): `generateUserActivityPdf(data:
UserActivityData, opts: { baseName?, baseIcao?, startDate, endDate, generatedBy, domains
}): { doc: jsPDF; filename: string }` — landscape letter via `createPdf` from
`@/lib/pdf-utils`, standard base header, one autotable (Users × domains + Total), totals
footer row, coverage footnotes, standard generated-by/Zulu footer. Filename:
`namo-namt-report_{ICAO|base}_{start}_{end}.pdf`.

**`lib/reports/user-activity-excel.ts`** (new): `buildUserActivityWorkbook(data, opts):
Promise<ExcelJS.Workbook>` using `createStyledWorkbook` + `addStyledSheet` from
`@/lib/excel-export`: sheet 1 "Summary" = the matrix; one sheet per selected domain
listing the drill-down records (user, label, date). Download in-page via
`workbook.xlsx.writeBuffer()` → Blob, same as existing Excel exports
(`app/(app)/discrepancies/page.tsx` precedent).

**`lib/supabase/checks.ts`** (changed): `createCheck` writes `completed_by_id:
completedById` alongside `saved_by_id` (`checks.ts:77-88`); `CheckRow` type gains
`completed_by_id: string | null`. The offline write-queue `check_file` path executes
`createCheck` client-side, so queued checks inherit the fix.

## UI components & pages

| File | Change |
|---|---|
| `app/(app)/reports/user-activity/page.tsx` | **New** — picker (range presets + custom, domain checkboxes, zero-activity toggle), preview matrix, drill-down expansion, PDF/Excel/email actions. `'use client'`; consumes `useInstallation()` + `usePermissions()`. |
| `components/reports/user-activity-matrix.tsx` | **New** — `UserActivityMatrix` presentational component (sticky first column, `overflow-x: auto`, section grouping, expandable rows). Kept separate for testability. |
| `app/(app)/reports/page.tsx` | Add the card to `REPORT_CARDS` with a `perm: 'reports:user_activity'` field; filter cards through `usePermissions().has` before render. |
| `lib/permissions.ts` | Add `REPORTS_USER_ACTIVITY: 'reports:user_activity'`. |
| `lib/reports/user-activity-data.ts` · `user-activity-pdf.ts` · `user-activity-excel.ts` | **New** — per §lib/ modules. |
| `lib/supabase/checks.ts` | Write `completed_by_id` on create. |

All new files kebab-case; components PascalCase; imports via `@/…` only; Tailwind +
Sonner + lucide-react per house UI stack.

## Exports & PDF

- PDF: `lib/reports/user-activity-pdf.ts`, client-side jsPDF + jspdf-autotable, returns
  `{ doc, filename }` (house rule; exemplar `lib/scn-pdf.ts:78,257-258`). Landscape to
  fit up to 9 domain columns + Total; if >7 columns are selected, shrink to 8pt and
  truncate long names with full names in the Excel export.
- Excel: `lib/reports/user-activity-excel.ts` via `createStyledWorkbook` /
  `addStyledSheet` (`lib/excel-export.ts:42-90`) — Summary matrix + per-domain detail
  sheets.
- Email: existing flow — generate `{ doc, filename }`, open `EmailPdfModal`
  (`components/ui/email-pdf-modal.tsx`), send via `sendPdfViaEmail` (`lib/email-pdf.ts`)
  → `/api/send-pdf-email` (cookie-auth, Resend, rate-limited).
- Both exports repeat the coverage footnotes and the Unlinked/Unattributed rows — the
  exported artifact must be exactly as honest as the screen.

## Integration

- **Nav:** none needed beyond the `REPORT_CARDS` entry — `/reports` is in
  `ALWAYS_ON_HREFS` (`lib/modules-config.ts:346`) and sub-paths are covered by the
  sub-path matcher (`modules-config.ts:403`). No `lib/sidebar-config.ts`,
  `HREF_TO_VIEW_PERM`, or `/more` changes; no new `ModuleKey`, no `enabled_modules`
  backfill migration, no base-config wizard step.
- **Badges:** none — this is a pull report with no pending-work semantics.
- **Docs:** add a short section to `docs/manual/` (reports chapter) during
  implementation wrap-up.

## Implementation sequence

1. **Migrations + PERM mirror** — apply `2026071640` (permission) and `2026071641`
   (checks `completed_by_id` + backfill copy); add `PERM.REPORTS_USER_ACTIVITY`; update
   `createCheck` to write `completed_by_id`. *Verify:* `npx tsc --noEmit`; SQL check
   that `SELECT count(*) FROM airfield_checks WHERE status='completed' AND
   completed_by_id IS DISTINCT FROM saved_by_id` returns 0 post-backfill; create a check
   in dev and confirm `completed_by_id` populates.
2. **FK integrity migration** — apply `2026071642` (NOT VALID FKs). *Verify:* migration
   applies on a DB containing pre-existing QRC/wildlife rows; new inserts with a bogus
   uuid are rejected.
3. **Data module** — `user-activity-data.ts` with the domain registry and pure
   `buildActivityMatrix` / `actorKeyFor`. *Verify:* vitest unit tests (below) green.
4. **Page + matrix component + hub card** — picker, preview, drill-down, permission
   gates. *Verify:* manual QA script steps 1–6; `npm run build` clean.
5. **PDF generator** — *Verify:* visual review of a sample PDF (2 users × 9 domains and
   a 20-user render); smoke test no-throw.
6. **Excel + email delivery** — *Verify:* workbook opens clean in Excel; email arrives
   via the dev Resend key.
7. **Docs + wrap** — manual section, `docs/` capabilities touch-up. *Verify:*
   `npm run lint`, `npm run test`, `npm run build` all green.

Each step is independently shippable; commits go straight to `main` per project practice.

## Testing

**Vitest (tests/):**
- `user-activity-matrix.test.ts` — `buildActivityMatrix`: uuid grouping; free-text
  fallback bucketing (case/whitespace normalization); unattributed bucket; "Former user"
  when a uuid has no profile; totals row/column math; sort order; zero-activity row
  injection; daily-review slot fan-out (one row per non-null slot, max 2 per user/day).
- `user-activity-dates.test.ts` — range boundary handling: timestamptz UTC boundaries
  vs DATE-column day-string comparison (`strike_date`, `review_date`); QRC opened-before
  /closed-inside counts only as completion.
- `user-activity-coverage.test.ts` — coverage footnote emitted iff range start <
  `coverageStart` and affected count > 0.
- `user-activity-pdf.test.ts` / `user-activity-excel.test.ts` — smoke: generator returns
  `{ doc, filename }` with the expected filename shape / workbook sheet names, no throw
  on empty data.
- `reports-cards-gating.test.tsx` — hub hides the card without
  `reports:user_activity`.

**RLS/isolation:** no new tables, so no new policy tests; add one migration assertion
(dev SQL or scripted check) that `airfield_checks` INSERT/SELECT policies still pass
after the ALTER, and that a `reports:user_activity`-less role cannot see the page (UI)
while RLS still governs the underlying reads.

**Manual QA script:**
1. As AFM: open `/reports` → card visible → run a 30-day report with all domains; spot-
   check one user's sighting count against `/wildlife`.
2. As amops: card hidden; direct-nav to `/reports/user-activity` shows the access notice.
3. As a NAMO lacking `wildlife:view` (override-revoked): wildlife checkboxes disabled
   with the explanatory note; generated matrix omits those columns.
4. Log a check, complete it, re-run the report — count increments under the completer.
5. Pick a range predating 2026-03-03 — checks coverage footnote appears; unlinked
   free-text rows render with the "unlinked" chip.
6. Export PDF + Excel + email; verify totals, footnotes, and drill-down sheets match the
   screen; verify on a phone-width viewport the matrix scrolls horizontally.

## Assumptions & open questions

- **NAMO/NAMT expansions** ("NCOIC, Airfield Management Operations / Training") and any
  duty-description basis for per-person tracking — verify against the current
  DAFMAN 13-204 publication; no paragraph is cited anywhere in this feature.
- **Inspections timestamp:** this spec counts `status='completed'` on `completed_at`
  (set at create, `inspections.ts:197`); `analytics-data.ts` uses `created_at` — values
  coincide for in-app rows. Confirm no imported/legacy rows diverge.
- **ACSI and AMTR inspections** are excluded from the "Inspections" column (annual/
  training volumes would add noise); `acsi_inspections` has identical attribution
  columns (`types.ts:17-48`) if the owner wants it later.
- **Discrepancy closures/status updates** (`status_updates.updated_by`, FK embed already
  works — `daily-ops-data.ts:286`) as a tenth domain — deferred; confirm demand.
- **Obstruction evaluations** (`evaluated_by` with profile join in `daily-ops-data.ts`)
  — same, deferred.
- **Fuzzy name→profile matching** for legacy free-text rows is intentionally NOT done
  (historic backfill out of scope); is exact-normalized-name bucketing acceptable
  presentation, or should unlinked rows merge into a profile on exact `profiles.name`
  match?
- **Civilian role grants** (`accountable_executive`, `ops_supervisor`) — confirm with
  the owner; the platform's newer civilian migrations (`2026053005`, `2026060705`) are
  the seeding reference if more Part 139 roles need it.
- Coverage constants for inspections/discrepancies/daily reviews/PPR assumed "full
  history" (actor columns original to their tables) — confirm from migration history
  during implementation.

## Out of scope

- NOTAMs (rows are FAA-sync, create UI is a stub — counts would be meaningless).
- Historic attribution backfill beyond the deterministic `saved_by_id` →
  `completed_by_id` same-row copy (no fuzzy text matching of legacy rows).
- Cross-base / MAJCOM rollups (single `base_id` only, like every other report).
- Scheduled/emailed recurring delivery; server-side generation; any new API route.
- Rate/quality metrics (pass rates, response times) — counts only in v1.
- Charts/visualizations — matrix table only.
- Changes to the domains' own CRUD flows beyond the one-line `createCheck` addition; no
  `activity_log` writes anywhere (house rule).
