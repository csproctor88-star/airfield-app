# 43 Check Log — Airfield Driving Spot Check (DAFI 13-213)

**Date:** 2026-07-16
**Status:** Draft for review
**Owner decision of record:** "43 Check" is the owner's local shorthand for the airfield
driving spot check under DAFI 13-213 (owner confirmed). Its own log under Airfield
Management with a Start-Check flow — architecture decision (standalone vs. `/checks` check
type) delegated to this spec and made in §Design.

---

## Summary

A per-base Airfield Driving Spot Check log at `/driving-checks`. AM Ops personnel
conducting random enforcement checks of the airfield driving program tap **Start 43 Check**,
fill a mobile-first form — driver identification + AF Form 483 verification, vehicle
identification, a locally-editable pass/discrepancy item list (FOD tire check, radio
procedures, escort compliance, serviceability), location, outcome, notes — and log it with
actor + timestamp. A filterable history (date range, result, checker) sits below, and a
date-range PDF export produces an Airfield Operations Board-ready summary: check count,
pass rate, common discrepancies, and a by-checker table.

Users: AM Ops conduct checks; NAMO / AFM / base admins manage the item list and run the AOB
report; read-only/safety view. USAF-only in v1 (DAFI 13-213 is a USAF publication), opt-in
per base (`defaultEnabled: false`). Why now: spot checks today live on paper logs and
free-text Events Log entries — no structured record, no pass-rate trend, nothing
packageable for the AOB. Contractors already tracks AF Form 483 credentials for escorts
(`lib/supabase/contractors.ts:20-21`) but nothing records the *enforcement* side.

## Regulatory basis

DAFI 13-213, *Airfield Driving*, is the governing publication (existence and e-publishing
URL confirmed via search results; the PDF itself was unfetchable through the research
environment's egress proxy — every content claim below derives from search-engine extracts
of the official PDF and wing supplements, not a direct read). Per house regulatory-honesty
rules, **no DAFI paragraph number is cited anywhere in this spec or in-app**; every
paragraph-level claim is deferred to §Assumptions & open questions.

Consistent across extracts (paraphrased; all re-listed in §Assumptions for verification):

1. AM conducts **random spot checks** for enforcement/compliance of the airfield driving
   program → ad-hoc Start-Check flow, many-per-day cardinality.
2. The core item: the driver **possesses a valid AF Form 483** (Airfield Driving Competency
   Card); operating without one is an airfield driving violation → the 483-status field
   anchors the form and the `violation` outcome derivation.
3. Spot-check log entries capture **name, rank, squadron, office symbol, phone, AF Form 483
   valid/expired, POV pass number, location on airfield, violation (as applicable)** → the
   typed columns in §Data model.
4. Enforced-during-checks items: **two-way radio contact with tower (or a radio-equipped
   escort) in the CMA**; **FOD tire check** departing unpaved surfaces. These appear as
   driving-program rules, *not* a verified itemized spot-check checklist → the item list
   ships as locally-editable proposed defaults.
5. The baseline DAFI sets **no numeric quota**; frequency is a wing/base-supplement matter →
   no schedule, no "missed check" state.
6. Documentation: annotated on the **AF Form 3616 or electronic equivalent** plus a
   spot-check log; results briefed at the Airfield Operations Board per wing supplements →
   the Events Log write and the AOB export, both phrased in-app as product intent.

## Current state

- **No driving spot check exists anywhere.** The checks module's 9 types are hardcoded
  (`CheckType` union, `lib/supabase/types.ts:9967`; `CHECK_TYPE_CONFIG`,
  `lib/constants.ts:327-336`; DB CHECK constraint last extended in
  `2026042907_add_construction_other_check_types.sql`) and none concerns driver enforcement.
  `/checks` is the conduct form itself (`app/(app)/checks/page.tsx`, ~1.7k LOC of per-type
  conditional JSX); completed rows land in `airfield_checks` with a type-shaped JSONB `data`
  column (`CheckRow`, `lib/supabase/checks.ts:22-42`).
- **SCN is the standalone-log structural template** (owner precedent, reused by the sibling
  FPR spec `2026-07-16-flight-planning-room-check-design.md`): single 'use client' page
  (`app/(app)/scn/page.tsx`), CRUD module with row types + pure `summarizeCheck`
  (`lib/supabase/scn.ts`), config + check + denormalized per-item results tables
  (`2026042001_scn_daily_check.sql` — header documents the `agency_name` snapshot
  rationale), month PDF (`lib/scn-pdf.ts:78` returns `{ doc, filename }`). Note
  `scn.ts:236-249` calls `logActivity` from the CRUD module — that predates the current
  house rule; this spec hoists the call to the page handler (FPR spec does the same).
- **Contractors already tracks AF Form 483 for escorts**: `airfield_contractors` carries
  `af_form_483` and `af_form_483_expiration` (`lib/supabase/contractors.ts:20-21`), fetched
  via `fetchActiveContractors(baseId)` (:51). Nothing links a field check to those records.
- **Module enablement / nav / permissions**: `bases.enabled_modules TEXT[]`
  (`2026042000_enabled_modules.sql`) + registry `lib/modules-config.ts` (`ModuleKey` :4-29,
  `WizardStepKey` :33-50, SCN entry :165-174); nav gating in
  `components/layout/sidebar-nav.tsx` (`ICON_MAP` :80-90, `HREF_TO_VIEW_PERM` :107-147)
  with the hand-synced `HREF_PERMISSION` map in `app/(app)/more/page.tsx:364`.
  Permission-matrix RLS exemplar: read_file migrations `2026062100`–`2026062101`. Latest
  applied migration: `2026071300_configurable_shifts.sql`. `useInstallation()`
  (`lib/installation-context.tsx`) exposes `areas` — used for location suggestions.

## Design

### Architecture decision: standalone module, not a new `airfield_checks` check type

**Decision: standalone module (SCN-shaped), tables of its own.**

1. **The record shape doesn't fit `airfield_checks`.** A spot check is a per-driver-encounter
   record whose driver/vehicle/483/outcome fields must be *queried* — the history filters
   (result, checker) and the AOB report (pass rate, common discrepancies, by-checker) need
   typed columns, not per-type JSONB in `data` (`lib/supabase/checks.ts:29`). Every existing
   check type is an *area/condition* record; none carries subject-person identity.
2. **Reuse buys less than it costs.** The checks machinery would contribute drafts, the
   offline write queue, photos/comments, and history/detail pages — but requires extending
   the `CheckType` union + DB CHECK constraint + `CheckDraft` + another conditional block in
   the 1.7k-LOC `checks/page.tsx`, and drags along irrelevant machinery (`airfield_status`
   side effects, `display_id`, area multi-select). Photos are out of scope in v1 and the
   offline queue is an open question — the two most valuable reuse items aren't needed yet.
3. **Owner precedent.** The owner picked standalone-like-SCN for the FPR check and described
   this one as "its own log under Airfield Management with a start-check flow" — same shape.

One deliberate divergence from SCN/FPR: **no natural key** (`UNIQUE (base_id, check_date,
…)`). Spot checks are random and unbounded per day — plain inserts, like an event log.

### Entry point and page layout

`/driving-checks`, visible when the `driving_checks` module is enabled and the user holds
`driving_checks:view`. Sidebar entry **Driving Spot Checks** in the Daily Operations section
next to `/contractors`; also on `/more`. Page, top to bottom:

1. **Header** — "Airfield Driving Spot Checks", subtitle chip "43 Check" (the local
   shorthand stays discoverable), primary **Start 43 Check** button
   (`has(PERM.DRIVING_CHECKS_WRITE)` only).
2. **Stat strip** — count, pass rate, violations for the filtered range (client-side
   `computeAobStats`, the same pure function the PDF uses).
3. **History list** with filters — date range (default last 30 days), result
   (All / Pass / Discrepancy / Violation), checker (distinct checkers in the fetched range).
   Rows: date (`formatScnHistoryDate` idiom, `scn/page.tsx:30`) + Zulu time, driver name +
   unit, AF Form 483 badge (green Valid / amber Expired / red None), result chip, checker
   initials; expand to full detail (driver/vehicle fields, per-item table with notes,
   violation description) with Edit / Delete for writers.
4. **Export card** — start/end date pickers + "Export AOB Report (PDF)".

### The Start 43 Check form (modal, mobile-first)

Conducted curbside from a phone; single column, large touch targets (SCN's `minHeight: 60`
status buttons), minimal typing.

- **Driver identification** — name (required), rank, unit/squadron, office symbol, phone.
  Optional **"Look up contractor"** search (over `fetchActiveContractors`) prefills name,
  company-as-unit, phone, and the AF Form 483 expiration on file, and stores `contractor_id`
  — *link, don't duplicate*: contractors remains the credential record; the spot check
  snapshots what was verified in the field.
- **AF Form 483 verification** — required segmented control **Valid / Expired / Not in
  possession / None issued**, plus optional card expiration date as observed.
- **Vehicle** — type (Government / Contractor / POV / Other), vehicle ID (registration /
  USAF number), POV pass number (shown when type = POV).
- **Check items** — one row per active `driving_check_items` row, 3-state buttons
  **Pass / Discrepancy / N/A**. Discrepancy opens a required-notes dialog (SCN OOS idiom,
  `scn/page.tsx:134`); save is blocked while a Discrepancy row has empty notes. Quick-fill
  "Mark All Pass". Optional per-item `guidance` renders as a muted subline.
- **Location** — required text input with a datalist of `areas` from `useInstallation()`
  (free text still allowed — "Taxiway A near EOR").
- **Outcome** — computed live by `deriveOverallResult`, shown as a preview chip:
  **Violation** when 483 status ≠ valid *or* the explicit "Airfield driving violation"
  checkbox is set (description required when checked); else **Discrepancy** when any item
  is a discrepancy; else **Pass**. Stored, not just derived at read time, so filters and
  report queries stay cheap.
- **Notes** + an Events Log preview line rendering `summarizeDrivingCheck` output.

On save: insert check + item results, toast (Sonner), then the **page handler** (never the
CRUD module — house rule) writes the Events Log entry:
`logActivity('completed', 'driving_check', check.id, undefined, { details: summary.toUpperCase() }, baseId)`
— e.g. `AIRFIELD DRIVING SPOT CHECK — SSGT SNUFFY, 100 ARW/SE — AF FORM 483 VALID — PASS
(TAXIWAY A)`. This is the AF Form 3616 "electronic equivalent" documentation behavior
(unverified claim; §Assumptions), mirroring SCN/FPR completion entries.

### Edge cases

- **No check items configured** → the form still works: driver identity + 483 + location are
  the regulatory core; the items section shows an info banner linking admins to Base Setup →
  Driving Check Items. (Deliberately weaker than SCN's hard block — a 483-only spot check is
  still a valid check.)
- **Contractor lookup shows an expired 483 on file** → prefill pre-selects "Expired"; the
  checker confirms/overrides from the physical card.
- **Contractor later deleted** → `contractor_id` is `ON DELETE SET NULL`; snapshots persist.
- **Item list edited after checks exist** → history untouched: results snapshot `item_label`
  (SCN `agency_name` denormalization rationale, `2026042001_scn_daily_check.sql` header).
- **Same driver checked twice in a day** → allowed; these are random checks.
- **Edit after save** → writers can edit (typo fixes); update rewrites item results. No
  sign-off semantics — a log, not a certified review.

## Data model & migrations

Two migrations in the assigned range **2026071650–2026071659**. *Numbers get bumped to the
actual implementation date when built.* No storage bucket, no RPC, no `enabled_modules`
backfill (module ships `defaultEnabled: false`; admins opt in at `/base-config/modules` — if
the owner later flips the default, add an `array_append` backfill per
`2026062103_read_file_enable_module.sql`).

### `2026071650_driving_check_permissions.sql`

```sql
-- Airfield Driving Spot Check ("43 Check", DAFI 13-213) — permission keys + role grants.
-- Mirror these keys in lib/permissions.ts (PERM.DRIVING_CHECKS_*).
INSERT INTO permissions (key, label, category, description) VALUES
  ('driving_checks:view',         'View Driving Spot Checks',   'driving_checks', 'Open /driving-checks and read the check history and item list'),
  ('driving_checks:write',        'Log Driving Spot Checks',    'driving_checks', 'Start, complete, edit, and delete driving spot checks'),
  ('driving_checks:manage_items', 'Manage Driving Check Items', 'driving_checks', 'Edit the per-base spot-check item list')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin: the all-permissions seed ran once, before these keys existed — re-grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'driving_checks:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin tier full grants; line users conduct checks (mirrors amops scn:view/write);
-- oversight roles view.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (VALUES ('driving_checks:view'), ('driving_checks:write'), ('driving_checks:manage_items')) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'driving_checks:view'), ('amops', 'driving_checks:write'),
  ('read_only', 'driving_checks:view'), ('safety', 'driving_checks:view')
ON CONFLICT (role, permission_key) DO NOTHING;
```

### `2026071651_driving_check_tables.sql`

```sql
-- Per-base spot-check item list (locally-editable proposed defaults; scn_agencies pattern).
CREATE TABLE IF NOT EXISTS driving_check_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  guidance   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_check_items_base ON driving_check_items(base_id, sort_order);

-- One row per spot check (no natural key — random checks, unbounded per day).
-- Driver columns are typed (not JSONB) because filters and the AOB report query them;
-- the field set follows the DAFI 13-213 spot-check log list (§Assumptions).
CREATE TABLE IF NOT EXISTS driving_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  checked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  driver_name           TEXT NOT NULL,
  driver_rank           TEXT, driver_unit TEXT, driver_office_symbol TEXT, driver_phone TEXT,
  contractor_id         UUID REFERENCES airfield_contractors(id) ON DELETE SET NULL,
  form_483_status       TEXT NOT NULL CHECK (form_483_status IN ('valid', 'expired', 'not_in_possession', 'none')),
  form_483_expires      DATE,
  vehicle_type          TEXT CHECK (vehicle_type IN ('government', 'contractor', 'pov', 'other')),
  vehicle_id            TEXT, pov_pass_number TEXT,
  location              TEXT NOT NULL,
  overall_result        TEXT NOT NULL CHECK (overall_result IN ('pass', 'discrepancy', 'violation')),
  violation_description TEXT,
  notes                 TEXT,
  completed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_oi       TEXT,
  completed_by_name     TEXT,  -- snapshot; feeds the by-checker report table
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_checks_base_time   ON driving_checks(base_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_driving_checks_base_result ON driving_checks(base_id, overall_result);

-- Per-item result snapshot. item_label denormalized ON PURPOSE (scn_check_results
-- pattern): item-list edits never corrupt completed checks.
CREATE TABLE IF NOT EXISTS driving_check_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id   UUID NOT NULL REFERENCES driving_checks(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES driving_check_items(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('pass', 'discrepancy', 'na')),
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_check_results_check ON driving_check_results(check_id);

ALTER TABLE driving_check_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_checks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_check_results ENABLE ROW LEVEL SECURITY;

-- driving_check_items: read on :view, mutate on :manage_items.
CREATE POLICY "driving_check_items_select" ON driving_check_items FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:view'));
CREATE POLICY "driving_check_items_insert" ON driving_check_items FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
-- ..._update (USING + WITH CHECK) and ..._delete (USING): identical
-- base-access + 'driving_checks:manage_items' predicate.

-- driving_checks: read on :view, log/edit/delete on :write.
CREATE POLICY "driving_checks_select" ON driving_checks FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:view'));
CREATE POLICY "driving_checks_insert" ON driving_checks FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:write'));
-- ..._update (USING + WITH CHECK) and ..._delete (USING): identical
-- base-access + 'driving_checks:write' predicate.

-- driving_check_results: base-scoped via the parent check (scn_check_results pattern,
-- 2026042205). SELECT requires :view; INSERT/UPDATE/DELETE require :write — all four
-- through the same EXISTS-parent shape:
CREATE POLICY "driving_check_results_select" ON driving_check_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM driving_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'driving_checks:view')));
-- ..._insert (WITH CHECK), ..._update (USING), ..._delete (USING): same EXISTS
-- with 'driving_checks:write'.
```

## Access control

| Key | Grants | Held by (seed) |
|---|---|---|
| `driving_checks:view` | Open `/driving-checks`, read history + item list | sys_admin, airfield_manager, namo, base_admin, amops, read_only, safety |
| `driving_checks:write` | Start/complete/edit/delete checks | sys_admin, airfield_manager, namo, base_admin, amops |
| `driving_checks:manage_items` | Edit the item list (wizard tab) | sys_admin, airfield_manager, namo, base_admin |

Naming follows the SCN precedent (`scn:view` / `scn:write` / `scn:manage_agencies`,
`lib/permissions.ts:55-57`) and the older-USAF `:view` convention (not the newer civilian
`:read`). Mirror as `PERM.DRIVING_CHECKS_VIEW / _WRITE / _MANAGE_ITEMS`. Kiosk roles
(`airfield_status`, `atc`) and `ces` get no grant — enforcement records identify individual
drivers and don't belong on kiosk displays. UI gates writes on
`has(PERM.DRIVING_CHECKS_WRITE)`; RLS remains the real enforcement. The contractor lookup
reads `airfield_contractors` under the existing `contractors:view` RLS — users without it
simply don't see the lookup (hide on failed/empty fetch).

## lib/ modules & API surface

No new route handlers — Supabase client + RLS throughout.

**`lib/supabase/driving-checks.ts`** (new; modeled on `lib/supabase/scn.ts`; `any`-cast
client for untyped tables per `lib/supabase/read-files.ts:4-5`):

```ts
export type Form483Status = 'valid' | 'expired' | 'not_in_possession' | 'none'
export type DrivingItemStatus = 'pass' | 'discrepancy' | 'na'
export type DrivingCheckResult = 'pass' | 'discrepancy' | 'violation'
// FORM_483_LABELS, DRIVING_RESULT_LABELS, DRIVING_RESULT_COLORS (success/warning/danger tokens)

export type DrivingCheckItemRow   // mirrors driving_check_items columns
export type DrivingCheckRow       // mirrors driving_checks columns
export type DrivingCheckResultRow // mirrors driving_check_results columns
export type DrivingCheckWithResults = DrivingCheckRow & { results: DrivingCheckResultRow[] }

// Pure, unit-tested:
export function deriveOverallResult(form483: Form483Status, items: Array<{ status: DrivingItemStatus }>, violationFlag: boolean): DrivingCheckResult
export function summarizeDrivingCheck(check: DrivingCheckWithResults): string
export type AobStats = {
  total: number; passRate: number | null; discrepancyCount: number; violationCount: number
  commonDiscrepancies: Array<{ label: string; count: number }>          // desc by count, label tiebreak
  byChecker: Array<{ name: string; oi: string | null; total: number; passRate: number | null; violations: number }>
}
export function computeAobStats(checks: DrivingCheckWithResults[]): AobStats  // feeds stat strip AND the PDF

// Item-list CRUD (wizard tab), mutations returning { error: string | null }:
export async function fetchDrivingCheckItems(baseId: string, activeOnly?: boolean): Promise<DrivingCheckItemRow[]>
// createDrivingCheckItem(baseId, label, guidance?) · updateDrivingCheckItem(id, patch) · reorderDrivingCheckItems(orderedIds)
// deleteDrivingCheckItem(id) · seedDefaultDrivingCheckItems(baseId)  // seeds lib/driving-check-default-items.ts

// Checks (event log — plain insert, no upsert):
export async function fetchDrivingChecksInRange(baseId: string, startIso: string, endIso: string): Promise<DrivingCheckWithResults[]>
export async function createDrivingCheck(input: { baseId: string; /* all form fields */ items: Array<{ item_id: string | null; item_label: string; status: DrivingItemStatus; notes?: string | null; sort_order: number }> }): Promise<{ data: DrivingCheckWithResults | null; error: string | null }>
export async function updateDrivingCheck(id: string, input: /* same minus baseId */): Promise<{ data: DrivingCheckWithResults | null; error: string | null }>  // rewrites results (scn.ts:182-231 idiom)
export async function deleteDrivingCheck(id: string): Promise<{ error: string | null }>
```

`createDrivingCheck` / `updateDrivingCheck` do **not** call `logActivity` — the page handler
does (§Design). Contractor lookup reuses `fetchActiveContractors` from
`@/lib/supabase/contractors` — no new contractor code, no duplicated credential storage.

**`lib/driving-check-default-items.ts`** (new):
`export const DRIVING_CHECK_DEFAULT_ITEMS: Array<{ label: string; guidance?: string }>` —
proposed seeds (§Assumptions), file-header comment stating they are locally-editable
proposals, not DAFI text.

## UI components & pages

| Path | Change |
|---|---|
| `app/(app)/driving-checks/page.tsx` | **New.** 'use client' page: header + Start 43 Check, stat strip, filterable history with expandable rows, export card, and the check-form modal (driver / 483 / vehicle / items / location / outcome / notes with live result preview). Uses `useInstallation()` (`installationId`, `areas`), `usePermissions()`, Sonner toasts, lucide icons, `LoadingState` / `EmptyState` (`@/components/ui/…`). Events Log write in the save handler. |
| `components/base-setup/driving-check-items-tab.tsx` | **New.** `DrivingCheckItemsTab`: item CRUD + reorder + active toggle + "Load default items" when empty (QRC import-defaults idiom); calls `markSaved?.('drivingcheckitems')`. Modeled on `ScnAgenciesTab` / `ShiftChecklistTab`. |
| `app/(app)/base-config/setup/page.tsx` | Add `WIZARD_STEPS` entry `{ key: 'drivingcheckitems', label: 'Driving Check Items', required: false, … }` and a render block next to the scnagencies block (:408). Light touch — tab body lives in the extracted component. |
| `lib/permissions.ts` | Add `DRIVING_CHECKS_VIEW / DRIVING_CHECKS_WRITE / DRIVING_CHECKS_MANAGE_ITEMS` next to the SCN block (:55-57). |
| `lib/modules-config.ts` | Add `'driving_checks'` to `ModuleKey`, `'drivingcheckitems'` to `WizardStepKey`, and a `MODULES` entry (§Integration). |
| `lib/sidebar-config.ts` | Add `{ name: 'Driving Spot Checks', href: '/driving-checks', iconName: 'Car', keywords: ['43 check', 'spot check', 'airfield driving', 'DAFI 13-213', 'AF Form 483'] }`; place `/driving-checks` after `/contractors` in the Daily Operations section of `DEFAULT_SIDEBAR_CONFIG` (:118). |
| `components/layout/sidebar-nav.tsx` | Register `Car` in `ICON_MAP` (:80-90 — unregistered names silently render Home); add `'/driving-checks': 'driving_checks:view'` to `HREF_TO_VIEW_PERM` (:107-147). |
| `app/(app)/more/page.tsx` | Add the `/driving-checks` entry + `HREF_PERMISSION['/driving-checks'] = 'driving_checks:view'` (:364 — hand-synced with the sidebar map). |
| `lib/supabase/driving-checks.ts` · `lib/driving-check-default-items.ts` · `lib/driving-check-pdf.ts` | New (see lib/ and PDF sections). |

All new files kebab-case, component names PascalCase, imports via `@/` alias only.

## Exports & PDF

**`lib/driving-check-pdf.ts`** (new; client-side jsPDF + jspdf-autotable, dynamic-imported
from the page like `scn/page.tsx`; text through `sanitizePdfText` from `@/lib/pdf-utils`):

```ts
export function generateDrivingCheckReportPdf(input: {
  startDate: string; endDate: string            // YYYY-MM-DD (inclusive)
  checks: DrivingCheckWithResults[]
  stats: AobStats                               // from computeAobStats — single source with the UI
  baseName?: string; baseIcao?: string
}): { doc: jsPDF; filename: string }            // `driving-spot-check-report-${startDate}_${endDate}.pdf`
```

Portrait letter: header ("Airfield Driving Spot Check Report (43 Check Log)", base
name/ICAO, period) → summary band (total, pass rate, discrepancies, violations) →
**Common discrepancies** autotable (item label × count; violations with descriptions) →
**By checker** autotable (name, initials, checks, pass rate, violations) → chronological
log autotable (Date/Time Z | Driver | Unit | AF 483 | Vehicle | Location | Result |
Checker) with footnote rows for violation descriptions and discrepancy notes (SCN footnote
idiom). Footer: "Airfield driving spot checks conducted under DAFI 13-213, Airfield
Driving, and the local wing supplement." — publication cited by name only, **no paragraph
number** (unverified; §Assumptions). The report is *marketed* as AOB-ready; the AOB-briefing
linkage itself is unverified and not asserted in the document.

## Integration

- **`lib/modules-config.ts` `MODULES` entry:** `key: 'driving_checks'`, `label: 'Driving
  Spot Checks (43 Check)'`, `category: 'compliance'`, description/useCase copy citing
  DAFI 13-213 by name only, `hrefs: ['/driving-checks']`, `setupSteps:
  ['drivingcheckitems']`, `defaultEnabled: false`, `appliesTo: ['usaf']`.
- **Enablement:** toggle at `/base-config/modules` (writes `bases.enabled_modules` via
  `updateEnabledModules`, `lib/installation-context.tsx:206-221`); sidebar / `/more` /
  bottom-nav visibility follows automatically through `isModuleEnabled`, the wizard step via
  `isWizardStepEnabled` + the ModuleDef's `setupSteps`, completion via
  `markSaved?.('drivingcheckitems')` → `bases.setup_progress`.
- **Badges/red-dot:** none — spot checks are ad hoc with no quota in the baseline DAFI, so
  there is no "overdue" state. (If wing-supplement quotas are modeled later, add a
  permission-gated count to `hooks/use-sidebar-badge-counts.ts` + both render maps.)
- **Events Log:** completion entries appear on `/activity` with `entity_type
  'driving_check'` (the Activity page renders `metadata.details` generically).
- **Contractors:** the lookup reads `airfield_contractors` (`contractors:view` RLS);
  expanded history rows for contractor-linked checks deep-link to `/contractors`. No writes.

## Implementation sequence

1. **Migrations + PERM mirror** — `2026071650…`, `2026071651…`, `lib/permissions.ts` keys.
   *Verify:* apply against the linked DB; confirm policies via `pg_policies`;
   `npx tsc --noEmit`.
2. **CRUD lib + defaults + pure functions** — `lib/supabase/driving-checks.ts`,
   `lib/driving-check-default-items.ts` + unit tests. *Verify:* `npx vitest run
   tests/driving-check-*.test.ts` green.
3. **Module/nav registration** — `lib/modules-config.ts`, `lib/sidebar-config.ts`,
   `sidebar-nav.tsx` (ICON_MAP + HREF_TO_VIEW_PERM), `more/page.tsx`. *Verify:* module off →
   no nav anywhere; on → visible with `driving_checks:view`, absent for a kiosk role and on
   a civilian (faa_part139) base.
4. **`/driving-checks` page** — form modal, stat strip, history + filters, Events Log write
   from the save handler. *Verify:* manual pass on a phone viewport; `/activity` entry;
   discrepancy item blocks save until notes; `npm run build` clean.
5. **Wizard tab** — `components/base-setup/driving-check-items-tab.tsx` + setup-page wiring.
   *Verify:* seed defaults, rename an item, log a check, rename again → history shows the
   as-of-check label.
6. **PDF export** — `lib/driving-check-pdf.ts` + export card. *Verify:* a period with
   passes, discrepancies, and a violation renders all four tables; `{ doc, filename }`
   contract; empty period doesn't throw.
7. **Docs** — `docs/manual/` page + capabilities-doc mention (follow-up, non-blocking).

## Testing

**Vitest (tests/):**
- `driving-check-derive.test.ts` — `deriveOverallResult` matrix: valid-483/all-pass → pass;
  one discrepancy → discrepancy; each non-valid 483 status → violation; violation flag
  overrides pass; N/A-only and empty item arrays.
- `driving-check-summary.test.ts` — `summarizeDrivingCheck`: pass, discrepancy with item
  labels, violation with description, missing rank/unit gracefully omitted.
- `driving-check-stats.test.ts` — `computeAobStats`: pass-rate math and null on empty,
  common-discrepancy ranking + ties, by-checker grouping (same oi, different name
  snapshot), violation counting.
- `driving-check-pdf.test.ts` — returns `{ doc, filename }`, filename format, doesn't throw
  on an empty period or non-ASCII notes (via `sanitizePdfText`).

**RLS/isolation (manual SQL checks post-migration — matching repo practice; no automated
RLS harness exists):** `amops` can select+insert `driving_checks`/`driving_check_results`
but not insert `driving_check_items`; `read_only` select-only everywhere; cross-base user
gets zero rows from all three tables; `driving_check_results` unreachable when the parent
check's base is inaccessible; `atc` (no grant) gets zero rows even with base access.

**Manual QA script:** enable module on a USAF test base → wizard: load defaults,
edit/reorder → as amops on a phone: Start 43 Check → contractor lookup prefill → set 483
Expired (result preview flips to Violation, description required) → set an item to
Discrepancy (save blocked until notes) → save → toast, `/activity` entry, history + stat
strip update → filter by result/checker/date → edit then delete the check → export a range
PDF → disable the module → nav entries and wizard step disappear.

## Assumptions & open questions

**Unverified regulatory claims — all to be verified against the current DAFI 13-213 (and
local wing supplement) on e-publishing.af.mil; none may be cited in-app or in the PDF:**
1. The AM random-spot-check duty and its paragraph number (one search extract said 2.11).
2. The spot-check log field list (name, rank, squadron, office symbol, phone, 483
   valid/expired, POV pass number, location, violation) and the Attachment 9 log format —
   the schema is built on it; verify Attachment 9's actual columns and reconcile.
3. AF Form 3616 (or electronic equivalent) annotation of spot checks — drives the Events
   Log write.
4. Violation routing (AFM, Wing ADPM, AOF/CC, unit commander, unit ADPM) and quarterly
   WADPM reporting — not implemented in v1; verify before building notifications.
5. Spot-check results briefed at the Airfield Operations Board — plausible from wing
   supplements + DAFMAN 13-204 AOB context, unverified from a fetched document; the export
   is labeled AOB-ready as product intent only.
6. Current DAFI 13-213 edition/date — unconfirmed; verify before quoting a version.
7. "43 Check" is not an official AF term (nothing in any source) — treated as owner-local
   shorthand per the owner's confirmation; the UI keeps the formal name primary.

**Proposed default check items — locally-editable seeds flagged in the wizard as "suggested
starting point, edit for local procedures"; the first two derive from extract-level
driving-program rules, the rest are sensible defaults with no regulatory basis claimed:**
two-way radio operational / correct frequency or radio-equipped escort (CMA ops); FOD tire
check when departing unpaved surfaces; vehicle beacon/lighting operational; seat belts in
use; speed limit compliance; vehicle serviceability (brakes, glass, leaks); driver knowledge
of tower light-gun signals; escort procedures complied with.

**Open questions:**
1. Should a Discrepancy/Violation offer one-tap creation of a linked `/discrepancies`
   record or an email to the AFM/ADPM (Resend)? Deferred; notes + Events Log only in v1.
2. Offline write queue: checks queues writes, SCN saves direct. Spot checks happen where
   connectivity is worst — v1 mirrors SCN (direct save + error toast), but this is the
   strongest candidate module for adopting the queue. Owner call.
3. Photo capture (vehicle/card) via the shared `photos` bucket? Out of scope v1.
4. Wing supplements set local quotas (e.g. X checks/month) — should base config accept a
   target and the stat strip show progress? Deferred pending supplement review.
5. Civilian Part 139 applicability: is a generalized mode (`appliesTo` both + relabeled 483
   field) wanted? v1 USAF-only.
6. Should `driver_name`/`driver_phone` retention be bounded (enforcement records about
   individuals)? No platform-wide retention policy exists; flag for the owner.

## Out of scope

- Airfield driving *program* management: AF Form 483 issuance, driver testing/training
  curriculum, competency-card lifecycle (the contractors module keeps escort-credential
  tracking; this module only records enforcement encounters).
- Violation adjudication workflow, notifications/routing to AFM/ADPM/unit commanders.
- Photos, storage buckets, sidebar badge, dashboards/analytics datasets, Excel export.
- Quota/frequency tracking against wing-supplement targets.
- Any change to the checks module (`airfield_checks`), contractors data model, or SCN/FPR.
- Marketing-site (`glidepath-site`) module-list copy and `docs/manual/` content beyond the
  follow-up noted in the sequence.
