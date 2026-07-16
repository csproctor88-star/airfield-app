# Flight Planning Room Check Module — Design Spec

**Date:** 2026-07-16
**Status:** Draft for review
**Owner decision of record:** standalone module "similar to SCN daily checks" — not a new
`airfield_checks` check type, not a FLIP sub-feature.

---

## Summary

A per-shift Flight Planning Room (FPR) check log at `/fpr`. Base admins define a per-base
checklist (FLIP currency, charts, forms availability, NOTAM display, etc.) in the Base Setup
wizard; AM Ops / NAMO line users start a check for their shift, mark each item
Satisfactory / Issue / N/A, and log it. Completion builds a reviewable 30-day history, writes
an Events Log (AF Form 3616-equivalent) entry, and exports a monthly PDF log suitable for
AOB packaging. USAF-only in v1 (`appliesTo: ['usaf']`, same as SCN), opt-in per base via the
`enabled_modules` pattern (`defaultEnabled: false`, like FLIP).

Why now: the FLIP Management module (spec `2026-06-23-flip-management-design.md`) covers the
FLIPs Continuity Binder but has no facility/room-check capability; bases currently document
the FPR check as a free-text Events Log entry with no checklist, no per-item record, and no
exportable history.

## Regulatory basis

DAFMAN 13-204 Volume 2 ("Airfield Management") could not be fetched during research (egress
proxy blocked e-publishing.af.mil); the items below rest on search-snippet evidence from
official base 13-204 instructions, a USAF Airfield Management Services PWS, and the AM Ops
community wiki. Per house regulatory-honesty rules, **no DAFMAN paragraph number is cited for
the FPR check requirement itself** — every paragraph-level claim is deferred to
§Assumptions & open questions.

Verified by snippet (source noted; wording paraphrased):

1. AM must develop procedures to check the Flight Planning Room for **accuracy, currency and
   availability of materials (FLIPs, charts, forms) during each shift**, with each check
   **documented on the AF Form 3616** (Daily Record of Facility Operation). *(AM Ops wiki
   snippet; current DAFMAN paragraph number unverified.)* This drives: per-shift check
   cadence, locally-developed (i.e. admin-editable) checklist, and the Events Log write on
   completion.
2. AM must maintain an up-to-date Flight Planning Room and Airfield Status Display IAW
   DAFMAN 13-204V2 including a complete set of current DoD aeronautical publications;
   **electronic media is permitted for all items including FLIPs**. *(USAF AM Services PWS
   FA3099-22-Q-0011 snippet.)*
3. Airfield inspection/check results are documented and briefed at the next quarterly
   Airfield Operations Board. *(Base 13-204 instruction snippets.)* This drives the monthly
   PDF export being date-range-based so quarters can be packaged.

The "develop procedures" phrasing means the checklist content is **locally determined** — so
the default items shipped with this module are proposed seeds, editable per base, and are
flagged as assumptions (§Assumptions), never presented in-app as regulatory text.

## Current state

- **SCN is the structural template** (owner mandate). `app/(app)/scn/page.tsx` is a single
  'use client' page: today-cards per check type (`TodayCheckCard`, :515), a check modal with
  per-row 3-state status buttons (`AgencyRow`, :610), required-notes dialog for the bad state
  (OOS dialog, :452), quick-fill button (:356), Events Log preview (`SummaryPreview`, :672),
  30-day history with expandable rows (`HistoryRow`, :696), and a month-picker PDF export
  (:191-211). `lib/supabase/scn.ts` holds row types (:27-59), Zulu-date helper (:62),
  fetchers, an upsert-by-natural-key `saveCheck` that deletes and rewrites child results
  (:182-231), a pure `summarizeCheck` (:151), and a `logActivity` call on completion
  (:236-249). Schema: `supabase/migrations/2026042001_scn_daily_check.sql` — config table
  `scn_agencies`, check table `scn_checks` with `UNIQUE (base_id, check_date, check_type)`,
  results table `scn_check_results` with **denormalized `agency_name`** ("so historical
  checks survive agency renames or deletions", header comment). RLS was swapped to the
  permission matrix in `2026042205_swap_status_shift_scn_qrc_feedback_rls.sql`.
- **Module enablement**: `bases.enabled_modules TEXT[]` (`2026042000_enabled_modules.sql`)
  + registry `lib/modules-config.ts` (`ModuleKey` union :4-28, `WizardStepKey` :33-49,
  SCN entry :165-174 with `setupSteps: ['scnagencies']`, `appliesTo: ['usaf']`). Nav gating
  via `isModuleEnabled` in `components/layout/sidebar-nav.tsx:269-284`, `bottom-nav.tsx:72`,
  `app/(app)/more/page.tsx`.
- **Admin-editable per-base list content lives in the setup wizard**:
  `app/(app)/base-config/setup/page.tsx` `WIZARD_STEPS` (:89-107) renders inline tab
  components — `ShiftChecklistTab`, `QrcTemplatesTab`, `ScnAgenciesTab` (:408). The page is
  already ~6.3k LOC; research flags it as a hotspot.
- **Permission matrix**: scaffold `2026042200_permission_matrix_scaffold.sql`; SCN keys
  `scn:view` / `scn:write` / `scn:manage_agencies` (:66-68), amops granted view+write
  (:187-188). Newest full-module exemplar: read_file migrations `2026062100`–`2026062103`.
- **Configurable shifts** (`2026071300_configurable_shifts.sql`, `lib/shifts.ts`): bases run
  1–3 shifts with fixed internal keys `day`/`swing`/`mid` and renameable labels;
  `getActiveShifts(base)` / `getShiftLabel(base, key)` are the single source of truth.
- **What does NOT exist**: no FPR checklist or check log anywhere; FLIP
  (`lib/supabase/flip.ts`, `lib/supabase/flip-storage.ts`) covers publications continuity
  only — no room/facility check; the checks module (`airfield_checks`) has no data-driven
  checklist type (all 9 types hardcoded, `lib/supabase/types.ts:9967`,
  `lib/constants.ts:327-336`).

## Design

**Entry point:** `/fpr`, visible when the `fpr` module is enabled and the user holds
`fpr:view`. Sidebar entry "Flight Planning Room" in the daily-ops section next to `/scn`;
also on `/more` for mobile.

**Today view (default):** one `TodayCheckCard` per active shift, derived from
`getActiveShifts(currentInstallation)` — a 1-shift base sees one card, a 3-shift base sees
three. Card states mirror SCN: amber left-border "Not yet completed this shift" with a
Start Check button (writers only), green "Complete" with the summary line, completed-at
Zulu time, operating initials, and Re-run / Edit + Delete actions.

**Check modal (execution UX):** mirrors the SCN modal one-for-one.
- Header: shift label + Zulu date + attribution (operating initials from profile).
- One row per **active** checklist item (from `fpr_checklist_items`, `is_active`, ordered by
  `sort_order`), each with 3-state buttons: **Satisfactory / Issue / N/A**. Optional
  per-item `guidance` text renders as a muted subline.
- Selecting **Issue** opens a required-notes dialog (mirrors the SCN OOS dialog): the check
  cannot be saved while an Issue row has empty notes.
- Quick-fill "Mark All Satisfactory" button, hidden when everything is already satisfactory.
- Overall notes textarea + **Events Log preview** rendering `summarizeFprCheck` output.
- Save is an upsert on `(base_id, check_date, shift)` — re-opening the modal for a completed
  check edits it in place (SCN's Re-run/Edit idiom).

**Edge cases:**
- **No items configured** → warning banner + Start disabled, linking admins to
  Base Setup → FPR Checklist (mirrors SCN's no-agencies banner, `scn/page.tsx:249-259`).
- **Template edited after checks exist** → history is untouched: results snapshot
  `item_label` (see Data model). Items deactivated/deleted no longer appear in *new* checks
  but render normally in history and PDFs.
- **Shift count reduced** → historical checks for now-inactive shifts still render;
  `getShiftLabel` resolves any key regardless of the current count. Today view only shows
  cards for currently active shifts.
- **Multiple users, same shift** → last save wins on the natural key; the upsert rewrites
  results atomically enough for this low-contention log (accepted, same as SCN).

**History:** "Past 30 Days" list below the cards; each row shows date (Today / Yesterday /
"Mon, Jul 14"), shift chip (labeled via `getShiftLabel`), "All satisfactory" (green) or
"N issue(s)" (amber), and initials; expands to the full per-item result table with notes,
plus Edit/Delete for writers.

**Mobile:** the page is card-and-modal based like SCN, already phone-friendly; status buttons
keep SCN's `minHeight: 60` touch targets. Entry via `/more`.

**Admin editing UI:** a new wizard step **FPR Checklist** in `/base-config/setup` — this is
where every per-base list editor lives today (shift checklist, QRC, SCN agencies), so admins
will look there. Per the research recommendation, the tab is an **extracted component**
(`components/base-setup/fpr-checklist-tab.tsx`) rather than another inline block in the
6.3k-LOC setup page. Features, modeled on `ShiftChecklistTab` + `ScnAgenciesTab`: add item
(label + optional guidance), inline rename, reorder (sort_order up/down), active toggle
(soft delete), hard delete with confirm, and a **"Load default checklist"** button that
inserts the proposed seed items from `lib/fpr-default-items.ts` when the list is empty
(mirrors QRC's "import 25 defaults" idiom). Every write toasts on error (Sonner).

**Events Log (AF Form 3616) write:** on successful save, the **page's completion handler**
(not the CRUD module) calls `logActivity('completed', 'fpr', check.id, undefined,
{ details: summarizeFprCheck(check).toUpperCase() }, baseId)`. This is the documented-check
requirement, mirroring SCN's completion entry (`lib/supabase/scn.ts:236-249`) — but the call
is deliberately hoisted out of `lib/supabase/fpr.ts` so the CRUD module itself never touches
`activity_log`, honoring the house rule while preserving the compliance behavior. Summary
examples: `Day Shift Flight Planning Room check complete — all items satisfactory` /
`… — issues: Enroute charts (superseded edition on rack), N/A: Printer/forms stock`.

## Data model & migrations

Two migrations in the assigned range. **Note: numbers `202607162x` get bumped to the actual
implementation date when built.** No storage bucket, no RPC (no signature semantics — a
completed check is editable/deletable by writers, same as SCN).

### `2026071620_fpr_permissions.sql`

```sql
-- Flight Planning Room Check — permission keys + role grants.
-- Mirror these keys in lib/permissions.ts (PERM).
INSERT INTO permissions (key, label, category, description) VALUES
  ('fpr:view',             'View Flight Planning Room Checks', 'ops', 'Open /fpr and read check history'),
  ('fpr:write',            'Log FPR Checks',                   'ops', 'Start, complete, edit, and delete FPR checks'),
  ('fpr:manage_checklist', 'Manage FPR Checklist',             'ops', 'Edit the per-base FPR checklist template')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin gets everything (must re-grant explicitly; the all-permissions seed ran once).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'fpr:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- Admin-tier roles: full grants.
INSERT INTO role_permissions (role, permission_key)
SELECT r.role, p.key
FROM (VALUES ('airfield_manager'), ('namo'), ('base_admin')) AS r(role)
CROSS JOIN (VALUES ('fpr:view'), ('fpr:write'), ('fpr:manage_checklist')) AS p(key)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Line users conduct checks (mirrors amops scn:view/scn:write).
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'fpr:view'), ('amops', 'fpr:write'),
  ('read_only', 'fpr:view'), ('safety', 'fpr:view'), ('atc', 'fpr:view')
ON CONFLICT (role, permission_key) DO NOTHING;
```

### `2026071621_fpr_tables.sql`

```sql
-- Template items (per-base config; mirror of scn_agencies / shift_checklist_items).
CREATE TABLE IF NOT EXISTS fpr_checklist_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  guidance   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpr_items_base ON fpr_checklist_items(base_id, sort_order);

-- One row per completed/edited check. One check per base+Zulu date+shift.
CREATE TABLE IF NOT EXISTS fpr_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id         UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  check_date      DATE NOT NULL,
  shift           TEXT NOT NULL CHECK (shift IN ('day', 'swing', 'mid')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_oi TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, check_date, shift)
);
CREATE INDEX IF NOT EXISTS idx_fpr_checks_base_date ON fpr_checks(base_id, check_date DESC);

-- Per-item result snapshot. item_label is denormalized ON PURPOSE (see scn_check_results):
-- template edits/renames/deletes never corrupt completed checks.
CREATE TABLE IF NOT EXISTS fpr_check_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id   UUID NOT NULL REFERENCES fpr_checks(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES fpr_checklist_items(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('satisfactory', 'issue', 'na')),
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fpr_check_results_check ON fpr_check_results(check_id);

ALTER TABLE fpr_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpr_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpr_check_results   ENABLE ROW LEVEL SECURITY;

-- fpr_checklist_items: read on fpr:view, mutate on fpr:manage_checklist.
CREATE POLICY "fpr_checklist_items_select" ON fpr_checklist_items FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:view'));
CREATE POLICY "fpr_checklist_items_insert" ON fpr_checklist_items FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));
CREATE POLICY "fpr_checklist_items_update" ON fpr_checklist_items FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));
CREATE POLICY "fpr_checklist_items_delete" ON fpr_checklist_items FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:manage_checklist'));

-- fpr_checks: read on fpr:view, log/edit/delete on fpr:write.
CREATE POLICY "fpr_checks_select" ON fpr_checks FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:view'));
CREATE POLICY "fpr_checks_insert" ON fpr_checks FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));
CREATE POLICY "fpr_checks_update" ON fpr_checks FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));
CREATE POLICY "fpr_checks_delete" ON fpr_checks FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'fpr:write'));

-- fpr_check_results: base-scoped via the parent check (scn_check_results pattern,
-- 2026042205:143-176).
CREATE POLICY "fpr_check_results_select" ON fpr_check_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:view')));
CREATE POLICY "fpr_check_results_insert" ON fpr_check_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
CREATE POLICY "fpr_check_results_update" ON fpr_check_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
CREATE POLICY "fpr_check_results_delete" ON fpr_check_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM fpr_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'fpr:write')));
```

**Snapshot-vs-reference decision:** results **snapshot the item label** and keep a nullable
`item_id` FK (`ON DELETE SET NULL`). This is exactly the SCN `agency_name` denormalization
(migration header, `2026042001_scn_daily_check.sql`) and beats the alternatives: full
template versioning (QRC-style JSONB template copies) is overkill for a flat single-list
checklist, and a hard FK-only reference would corrupt or cascade-delete history when admins
edit the template. Admin edits therefore only affect checks started after the edit.

**No enabled_modules backfill migration:** the module ships `defaultEnabled: false` (the
brief says bases opt in), so existing bases correctly don't get it; admins toggle it at
`/base-config/modules`. If the owner later flips the default, add an `array_append` backfill
per `2026062103_read_file_enable_module.sql`.

## Access control

| Key | Grants | Held by (seed) |
|---|---|---|
| `fpr:view` | Open `/fpr`, read checks/history/template | sys_admin, airfield_manager, namo, base_admin, amops, read_only, safety, atc |
| `fpr:write` | Start/complete/edit/delete checks | sys_admin, airfield_manager, namo, base_admin, amops |
| `fpr:manage_checklist` | Edit the checklist template (wizard tab) | sys_admin, airfield_manager, namo, base_admin |

Naming follows the SCN precedent (`scn:view` / `scn:write` / `scn:manage_agencies`) and the
older-USAF-module `:view` convention (not the newer civilian `:read`). Mirror all three as
`PERM.FPR_VIEW / FPR_WRITE / FPR_MANAGE_CHECKLIST` in `lib/permissions.ts` next to the SCN
block (:55-57). UI gating: page write actions on `has(PERM.FPR_WRITE)`, wizard tab edit on
the existing `canEdit = has(PERM.BASE_SETUP_WRITE)` gate plus RLS enforcing
`fpr:manage_checklist` server-side. Role visibility: kiosk roles (`airfield_status`) never
see the module (no grant); `ces` gets nothing in v1.

## lib/ modules & API surface

No new route handlers — all reads/writes go through Supabase client + RLS.

**`lib/supabase/fpr.ts`** (new; modeled on `lib/supabase/scn.ts`, `any`-cast client for
untyped tables per `lib/supabase/read-files.ts:4-5`):

```ts
export type FprItemStatus = 'satisfactory' | 'issue' | 'na'
export const FPR_STATUS_LABELS: Record<FprItemStatus, string>
export const FPR_STATUS_COLORS: Record<FprItemStatus, string>   // success / warning-or-danger / muted tokens
export type FprChecklistItemRow = { id; base_id; label; guidance: string | null; sort_order; is_active; created_at; updated_at }
export type FprCheckRow = { id; base_id; check_date; shift: ShiftKey; started_at; completed_at; completed_by; completed_by_oi; notes; created_at }
export type FprCheckResultRow = { id; check_id; item_id: string | null; item_label; status: FprItemStatus; notes; sort_order; created_at }
export type FprCheckWithResults = FprCheckRow & { results: FprCheckResultRow[] }

export function todayZuluDate(): string                          // same as scn.ts:62
export function summarizeFprCheck(check: FprCheckWithResults, shiftLabel: string): string   // pure; unit-tested

export async function fetchFprChecklistItems(baseId: string, activeOnly?: boolean): Promise<FprChecklistItemRow[]>
export async function createFprChecklistItem(baseId: string, label: string, guidance?: string | null): Promise<{ error: string | null }>
export async function updateFprChecklistItem(id: string, patch: Partial<Pick<FprChecklistItemRow, 'label' | 'guidance' | 'is_active'>>): Promise<{ error: string | null }>
export async function reorderFprChecklistItems(orderedIds: string[]): Promise<{ error: string | null }>
export async function deleteFprChecklistItem(id: string): Promise<{ error: string | null }>
export async function seedDefaultFprItems(baseId: string): Promise<{ error: string | null }>  // inserts lib/fpr-default-items.ts

export async function fetchTodayFprChecks(baseId: string, dateZulu?: string): Promise<FprCheckWithResults[]>
export async function fetchFprChecksInRange(baseId: string, startDate: string, endDate: string): Promise<FprCheckWithResults[]>
export async function saveFprCheck(input: {
  baseId: string; checkDate: string; shift: ShiftKey
  operatingInitials?: string | null; notes?: string | null
  items: Array<{ item_id: string | null; item_label: string; status: FprItemStatus; notes?: string | null; sort_order: number }>
}): Promise<{ data: FprCheckWithResults | null; error: string | null }>   // upsert by (base_id, check_date, shift); delete+rewrite results (scn.ts:182-231 idiom)
export async function deleteFprCheck(id: string): Promise<{ error: string | null }>
```

`saveFprCheck` does **not** call `logActivity` — the page handler does (see Design). No other
`lib/supabase/*` file changes.

**`lib/fpr-default-items.ts`** (new): `export const FPR_DEFAULT_ITEMS: Array<{ label: string;
guidance?: string }>` — the proposed seeds (see Assumptions), with a file-header comment
stating they are locally-editable proposals, not DAFMAN text.

## UI components & pages

| Path | Change |
|---|---|
| `app/(app)/fpr/page.tsx` | **New.** 'use client' page mirroring `app/(app)/scn/page.tsx` structure: per-shift `TodayCheckCard` grid (cards from `getActiveShifts`), check modal with `FprItemRow` 3-state buttons + issue-notes dialog + quick-fill + `SummaryPreview`, 30-day `HistoryRow` list, month-picker PDF export. Uses `useInstallation()`, `usePermissions()`, Sonner toasts, lucide icons, `LoadingState` / `EmptyState`. |
| `components/base-setup/fpr-checklist-tab.tsx` | **New.** `FprChecklistTab` (kebab-case file, PascalCase component per current convention despite legacy PascalCase neighbors): item CRUD + reorder + active toggle + "Load default checklist"; calls `markSaved?.('fprchecklist')`. Modeled on `ShiftChecklistTab` / `ScnAgenciesTab` behavior. |
| `app/(app)/base-config/setup/page.tsx` | Add `WIZARD_STEPS` entry `{ key: 'fprchecklist', label: 'FPR Checklist', required: false, … }` and render block `{step.key === 'fprchecklist' && <FprChecklistTab … />}` next to the scnagencies block (:408). Light touch only — the tab body lives in the extracted component. |
| `lib/permissions.ts` | Add `FPR_VIEW / FPR_WRITE / FPR_MANAGE_CHECKLIST`. |
| `lib/modules-config.ts` | Add `'fpr'` to `ModuleKey`, `'fprchecklist'` to `WizardStepKey`, and a `MODULES` entry (see Integration). |
| `lib/sidebar-config.ts` | Add `{ name: 'Flight Planning Room', href: '/fpr', iconName: 'BookOpenCheck', keywords: ['FPR', 'flight planning', 'FLIP check'] }`; place `/fpr` beside `/scn` in the daily-ops section of `DEFAULT_SIDEBAR_CONFIG`. |
| `components/layout/sidebar-nav.tsx` | Register `BookOpenCheck` in `ICON_MAP` (:80-90 — unregistered names silently render Home); add `'/fpr': 'fpr:view'` to `HREF_TO_VIEW_PERM` (:107-147). |
| `app/(app)/more/page.tsx` | Add the `/fpr` entry + `HREF_PERMISSION['/fpr'] = 'fpr:view'` (hand-synced with the sidebar map). |
| `lib/supabase/fpr.ts` · `lib/fpr-default-items.ts` · `lib/fpr-pdf.ts` | New (see lib/ and PDF sections). |

All imports via `@/` alias; all new files kebab-case.

## Exports & PDF

**`lib/fpr-pdf.ts`** (new, client-side jsPDF + jspdf-autotable, dynamic-imported from the
page like `scn/page.tsx:194`):

```ts
export function generateFprMonthlyPdf(input: {
  monthYyyyMm: string
  checks: FprCheckWithResults[]
  shiftLabels: Record<ShiftKey, string>   // resolved via getShiftLabel at call time
  baseName?: string
}): { doc: jsPDF; filename: string }      // filename: `fpr-check-log-${monthYyyyMm}.pdf`
```

Layout (simpler than SCN's agency×day matrix because up to 3 checks/day exist): portrait
letter, header "Flight Planning Room Check Log — <Month Year>" + totals line, then a
chronological autotable — Date | Shift | Completed (Zulu) | Initials | Result
("All satisfactory" or "N issue(s)") — with footnote rows listing each issue's item label +
notes (SCN footnote idiom). No regulatory paragraph citation in the footer (unverified);
footer text: "Flight Planning Room checks per locally developed procedures under
DAFMAN 13-204 Volume 2." Text through `sanitizePdfText`.

## Integration

- **`lib/modules-config.ts` `MODULES` entry:** `key: 'fpr'`, `label: 'Flight Planning Room
  Check'`, `category: 'core-ops'`, `hrefs: ['/fpr']`, `setupSteps: ['fprchecklist']`,
  `defaultEnabled: false`, `appliesTo: ['usaf']`. Description/useCase copy must not assert a
  specific DAFMAN paragraph (contrast the SCN entry which cites one — that citation predates
  the regulatory-honesty rule and is not a license here).
- **Enablement:** base admins toggle "Flight Planning Room Check" at `/base-config/modules`
  (writes `bases.enabled_modules` via `updateEnabledModules`,
  `lib/installation-context.tsx:206-221`). Nav/`/more`/bottom-nav visibility follows
  automatically through `isModuleEnabled`; the wizard step appears via
  `isWizardStepEnabled` + the ModuleDef's `setupSteps`.
- **Wizard step:** `'fprchecklist'`, optional (`required: false` — the module is opt-in);
  completion recorded through `markSaved?.('fprchecklist')` → `bases.setup_progress`.
- **Badges/red-dot:** none in v1 — SCN ships without one, and "shift check not yet done" is
  already surfaced by the amber today-card. If wanted later, add a permission-gated count to
  `hooks/use-sidebar-badge-counts.ts` + both render maps (documented parallel-map debt).
- **Events Log:** completion entries appear on `/activity` with `entity_type 'fpr'`
  (read-only integration; the Activity page renders `metadata.details` generically).
- **FLIP cross-reference:** the default "FLIP currency" item's guidance text links to `/flip`
  when that module is enabled. Data stays fully separate.

## Implementation sequence

1. **Migrations + PERM mirror** — `2026071620_fpr_permissions.sql`,
   `2026071621_fpr_tables.sql`, `lib/permissions.ts` keys. *Verify:* apply migrations
   individually against the linked DB; confirm policies via `pg_policies`; `npx tsc --noEmit`.
2. **CRUD lib + defaults + summary** — `lib/supabase/fpr.ts`, `lib/fpr-default-items.ts`,
   unit tests for `summarizeFprCheck` and the results-snapshot mapping. *Verify:*
   `npx vitest run tests/fpr-*.test.ts` green.
3. **Module/nav registration** — `lib/modules-config.ts`, `lib/sidebar-config.ts`,
   `sidebar-nav.tsx` (ICON_MAP + HREF_TO_VIEW_PERM), `more/page.tsx`. *Verify:* with the
   module toggled off the nav shows nothing; toggled on, `/fpr` appears for a user with
   `fpr:view` and not for a kiosk role.
4. **`/fpr` page** — today cards, modal, history, Events Log write from the completion
   handler. *Verify:* full manual pass on a 1-shift and a 3-shift test base; confirm the
   `/activity` entry text; `npm run build` clean.
5. **Wizard tab** — `components/base-setup/fpr-checklist-tab.tsx` + setup-page wiring.
   *Verify:* seed defaults, rename an item, complete a check, rename again → history and PDF
   still show the label as-of-completion.
6. **PDF export** — `lib/fpr-pdf.ts` + page wiring. *Verify:* generate a month with mixed
   shifts/issues; check `{ doc, filename }` contract and footnote rendering.
7. **Docs** — `docs/manual/` page + capabilities doc mention (follow-up, non-blocking).

## Testing

**Vitest (tests/):**
- `tests/fpr-summary.test.ts` — `summarizeFprCheck`: all-satisfactory, single issue with/
  without notes, multiple issues, N/A-only exclusions, shift label interpolation.
- `tests/fpr-results-snapshot.test.ts` — the pure draft→results mapper: labels snapshotted,
  `item_id` carried, sort order preserved, inactive items excluded from new drafts.
- `tests/fpr-pdf.test.ts` — `generateFprMonthlyPdf` returns `{ doc, filename }`, filename
  format, doesn't throw on empty month / issue footnotes (mirrors existing pdf smoke tests).
- `tests/fpr-shift-cards.test.ts` — today-card derivation from `getActiveShifts` for counts
  1/2/3 and a historical `mid` check on a base reduced to 1 shift.

**RLS/isolation (manual SQL checks post-migration, matching repo practice — no automated
RLS harness exists):** as an `amops` user: can select+insert `fpr_checks`, cannot insert
`fpr_checklist_items`; as `read_only`: select only everywhere; cross-base user: zero rows
from all three tables; `fpr_check_results` unreachable when the parent check's base is
inaccessible.

**Manual QA script:** enable module on a test base → wizard: load defaults, add/rename/
deactivate/reorder items → as amops on mobile viewport: start Day Shift check, set one item
to Issue (verify save blocked until notes), quick-fill the rest, save → verify today card
flips green, `/activity` entry appears, history row expands correctly → edit the check
(Re-run) → delete it → export the month PDF → disable the module and confirm nav entries and
wizard step disappear.

## Assumptions & open questions

**Unverified regulatory claims (all phrased for verification against the current
DAFMAN 13-204 Volume 2 publication on e-publishing.af.mil — none may be cited in-app):**
1. The per-shift FPR check requirement ("accuracy, currency and availability of materials…
   documented on the AF IMT 3616") — wording sourced from a community-wiki snippet, likely
   originating in the legacy AFI 13-204 series. **Verify the current paragraph number and
   exact wording**; the module's per-shift cadence and Events Log write assume it stands.
2. Whether the current manual prescribes any specific checklist items or a minimum item set
   for the FPR check. The design assumes "develop procedures" = locally determined content.
3. Whether the FPR check requirement sits near the Airfield Status Display requirement
   (a PWS cites "AFMAN 13-204V2, 4.4" for the display) — plausible, unverified, and unused.
4. The current DAFMAN 13-204V2 edition date (one snippet says 20 Sep 2024 — unconfirmed).

**Proposed default checklist items (`lib/fpr-default-items.ts`) — seeds only, flagged in the
wizard as "suggested starting point, edit for local procedures":** FLIP products current
(correct edition/cycle posted); enroute/terminal charts current and complete; flight plan
forms (DD 175 / DD 1801) stocked; NOTAM display current; airfield diagram posted and
current; weather briefing access functional; planning-area computers/printer operational;
publications (local in-flight guides) current. **Each item is an assumption to verify
against local practice and the current manual — none carries a citation.**

**Open questions:**
1. Should an Issue result offer one-tap creation of a linked discrepancy (`/discrepancies`)?
   Deferred; notes-only in v1.
2. Does any base need per-item completed-by attribution (shift-checklist-style responses
   with identity) rather than one completer per check? v1 assumes one completer, per SCN.
3. Civilian Part 139 applicability: is a generalized "ops room check" wanted
   (`appliesTo: ['usaf','faa_part139']` + mode-aware labels)? v1 is USAF-only.
4. Should missed shifts (day ends with no check) be surfaced on `/daily-reviews` or the
   dashboard? v1 relies on the amber today-card only.
5. Offline write queue: SCN saves directly; checks use the queue. v1 mirrors SCN (direct
   save + toast). Confirm whether flight-line connectivity justifies queueing `saveFprCheck`.

## Out of scope

- Signature/sign-off chains, SECURITY DEFINER RPCs, or CAC-signature semantics — this is a
  log like SCN, not a certified review (Daily Reviews already covers shift certification).
- Photos, file uploads, or a storage bucket.
- Sidebar badge / push reminders for missed checks.
- Reports/analytics dataset integration (`lib/dashboard/analytics/*`) and Excel export.
- Any change to the checks module (`airfield_checks`), FLIP module data, or QRC.
- Automatic discrepancy creation from Issue results.
- Marketing-site (`glidepath-site`) module-list copy and `docs/manual/` content beyond the
  follow-up noted in the sequence.
