# Local Regulations — Upload & Recurring Review

**Date:** 2026-07-16
**Status:** Design — ready for implementation
**Scope:** New "Base Regs" surface in the References area + recurring review tracking

## Summary

Base admins and airfield leadership upload **local regulations** (base OIs,
wing instructions, local supplements — PDFs) into the References area, as a
new **Base Regs** tab alongside the existing References / My Documents tabs on
`/regulations`. Every user in the required-reviewer set must re-review each
document on a per-document **monthly or quarterly** cadence. A user with any
review due sees a **red action-required dot** on the Reference Library sidebar
entry — the same dot mechanics the platform already uses for pending reviews
(the Read File / QRC chain). Leadership gets per-document compliance
visibility (who has / hasn't reviewed this cycle) and a PDF export.

Users: AMOPS and NAMO review; Airfield Managers / NAMO / base admins upload
and run compliance; civilian Part 139 bases get the same module (local SOPs
follow the identical rhythm). Why now: bases track "read the new OI" on paper
initial sheets that go stale on re-publication, and Glidepath already has both
halves of the machinery (versioned uploads + recurring review status) in
separate modules — they only need combining.

## Regulatory basis

No paragraph-level citation is made in this spec: the regulatory research
could not fetch DAFMAN 13-204 Volume 2 (or any mirror) end-to-end, so **no
verified paragraph numbers exist to cite**. What can be said honestly: DAFMAN
13-204 Volume 2 (*Airfield Management*) governs AM publications currency
generally, and the read-and-initial continuity file is standard AM practice
(already acknowledged in the Read File design,
`docs/superpowers/specs/2026-06-22-read-file-module-design.md`). No source —
even at search-snippet level — mandates a **monthly or quarterly**
local-regulation review cadence; the only snippet-verified periodic reviews
are the CFETP 1C7X1 *annual* training-pubs review and the quarterly Airfield
Operations Board under DAFMAN 13-204 V1. The cadence is therefore positioned
as **locally configurable policy**, not a cited mandate; module copy must not
claim a DAFMAN requirement. All paragraph-level questions live in
§Assumptions & open questions.

## Current state

Two existing systems each hold half of this feature; neither holds both.

**Read File module** (one-time acknowledgment, no recurrence):

- `supabase/migrations/2026062101_read_file_tables.sql` — `read_files`
  (versioned rows, `version INT` bumped on replace) +
  `read_file_acknowledgments` with `UNIQUE(read_file_id, user_id,
  acknowledged_version)` (:41-42): **one ack per user per version, ever**.
  Acks immutable (no UPDATE/DELETE policies, :99); insert policy hardened in
  `2026062104_read_file_ack_version_check.sql` so `acknowledged_version` must
  equal the file's live `version`.
- `lib/supabase/read-files.ts` — `computeUnacknowledged` (:52-60) has **no
  time dimension**; `replaceReadFile` (:234-269) optimistic-locks on
  `version`; `fetchReadFileReviewers` (:144-174) builds the roster from
  `base_members` ∩ `profiles.role IN READ_FILE_READER_ROLES` (:11-13).
- `supabase/migrations/2026062102_read_file_storage.sql` — private bucket,
  path `{base_id}/{timestamp}-{filename}`, storage RLS = base access on the
  first path segment + permission key.

**QRC monthly review** (recurrence, no uploads):

- `supabase/migrations/2026050300_qrc_monthly_reviews.sql` — immutable
  insert-per-review rows with a version snapshot
  (`template_updated_at_at_review`); re-reviewing inserts a fresh row.
  `2026050400_bases_qrc_review_interval.sql` — `bases.qrc_review_interval`
  `'monthly'|'quarterly'`, explicitly **base-wide, no per-item override**.
- `lib/qrc/monthly-review-status.ts` — pure `getMonthlyReviewStatus` (:27-51):
  `never | overdue | updated | current`, `INTERVAL_DAYS = { monthly: 30,
  quarterly: 90 }` (:3), **`updated` wins over `overdue`** (:44-48).
- `app/(app)/qrc/page.tsx` :126-128, :189 — the "due" count (never + overdue +
  updated) renders as the Reviews **tab count inside /qrc**. The QRC *sidebar*
  red dot means "active emergency execution" (`sidebar-nav.tsx:454-465`), not
  "review due" — the sidebar red-dot-for-pending-reviews pattern is the **Read
  File dot** (`sidebar-nav.tsx:509-522`, plus the :555-559 "{n} to review"
  label). That is the chain this feature mirrors.

**Badge plumbing** — `hooks/use-sidebar-badge-counts.ts`: permission-gated
count fetchers (:107-111 for readFile), realtime subscriptions filtered
`base_id=eq.` (:173-181), the `glidepath:badges-refresh` event bridge
(:201-205), 60 s poll, focus/visibilitychange; `total` feeds section-header
aggregation (`sidebar-nav.tsx:628-652`, red > amber > green).

**References area** — `app/(app)/regulations/page.tsx` (sidebar "Reference
Library", ALWAYS_ON per `lib/modules-config.ts:347`, gated `regulations:view`
in `sidebar-nav.tsx:133`) already has the tab structure the owner sketched:
`type Tab = 'regulations' | 'my-docs'` (page.tsx:60), rendered :108-112. My
Documents is **per-user private** storage (`lib/userDocuments.ts`,
`user-uploads` bucket, RLS `auth.uid() = user_id`) — there is **no base-scoped
shared-document tab today**, no tab counts, and no upload path into the public
`regulation-pdfs` bucket (official seeded regs only).

**What does not exist:** recurring cadence on any document table; a per-doc
interval column; a due-count fetcher with a time dimension; a Base Regs tab;
a badge on `/regulations`.

## Design

### Core decision: sibling tables, not a `read_files` extension

New tables `local_regulations` + `local_regulation_reviews` modeled on
`read_files` + `qrc_monthly_reviews`, **not** a retrofit of `read_files`:

1. **Migration risk.** Acks are immutable audit rows under
   `UNIQUE(read_file_id, user_id, acknowledged_version)` plus the hardened
   version-equality policy (2026062104). Recurrence needs repeated rows per
   version — dropping that unique index, or overloading `version` bumps to
   mean "cadence elapsed", corrupts the existing read-and-initial audit
   meaning and every consumer of it (badge, report, tests/read-files.test.ts).
2. **UX separation.** Read File = one-time "read and initial this policy
   letter" (Airfield Management section); Base Regs = "stay current on
   standing local regulations" (Reference). One page answering two compliance
   questions with different lifecycles would confuse both.
3. **Zero backfill.** No data migration, no change to existing ack rows; the
   modules can diverge (rosters, permissions, cadence) later without coupling.

### Placement: third tab on `/regulations`

Per the owner's sketch ("alongside My Documents"), Base Regs is a third tab:
`'regulations' | 'my-docs' | 'base-regs'`. The tab label carries a red
due-count chip — the in-page analog of the QRC Reviews tab count. Deep link
via `?tab=base-regs`. Because `/regulations` is ALWAYS_ON, the tab
**self-gates**: rendered only when `enabledModules.includes('local_regs')` &&
`has(PERM.LOCAL_REGS_VIEW)`.

### Review status semantics (QRC parity)

Per user, per document — pure function mirroring `getMonthlyReviewStatus`:

- `never` — no review row from this user.
- `updated` — doc `version` > the user's latest `version_at_review` (PDF
  replaced since their last review). **Wins over overdue.**
- `overdue` — `daysSinceReview > INTERVAL_DAYS[reg.review_interval]` (30 / 90,
  day-based like QRC — not calendar-month).
- `current` — otherwise.

**Due** = `never | updated | overdue`. **Re-upload resets the review cycle:
yes.** Replacing the PDF bumps `version`; every user immediately flips to
`updated` regardless of when they last reviewed, and their next review
re-stamps `version_at_review` and restarts the interval clock from
`reviewed_at`. This matches both the Read File replace semantics and QRC's
"updated beats overdue" rule — a new edition must be re-read now, not at the
next cycle boundary.

### User flow (open PDF → attest)

Each active document row shows: title + filename (click opens a 5-minute
signed URL in a new tab), version (`v{n}` when > 1), interval pill, and
**Your status** — green `✓ Reviewed {date}` when current, or a red/amber pill
(`Never reviewed` / `Updated — review required` / `Overdue`) with a **"Mark
reviewed"** button. Soft gate: the button enables only after the user opens
the document during the current page session (client-side affordance —
commented as not a security control). Marking reviewed inserts an immutable
review row (user, timestamp, `version_at_review`, initials snapshot), toasts
via Sonner, dispatches `glidepath:badges-refresh`, and flips the row without
a reload.

### Manager flow

Visible with `local_regs:manage`: **Add regulation** (title, optional
description, interval radio, PDF attach — PDF only, 25 MB cap), **Replace**
(new PDF → version bump under the optimistic version lock),
**Archive/Restore** (archived docs drop off due counts and the badge, stay in
compliance history), per-row **interval select** (changing interval never
touches review rows — status recomputes live), per-doc **"Reviewed X/Y this
cycle"** chip and **Compliance** expandable (roster partition:
reviewed-this-cycle with date/initials vs outstanding), and the **Compliance
report** PDF button. PII/CUI banner reused verbatim from
`app/(app)/read-file/page.tsx:129-141`.

### Edge cases & mobile

- Archive mid-cycle: leaves due counts instantly; restore resumes from
  existing rows. Interval change quarterly→monthly may flip users straight to
  `overdue` — intended; the select confirms first.
- Double review inside one window: allowed (insert-only, no unique
  constraint); latest row wins. Concurrent replace: optimistic `version` lock
  (0 rows updated → "someone else replaced it, reload"), as `replaceReadFile`.
- A user outside the reviewer roster holding `local_regs:view` via override
  can review; the compliance report folds their rows in defensively (Read File
  pattern) but they never drive the Y denominator.
- Mobile: stacked card list under 720 px (read-file responsive treatment);
  `/more` shows the due count on the Reference Library entry.

## Data model & migrations

Four migrations, `2026071630`–`2026071633`. **Numbers get bumped to the actual
implementation date** (latest applied: `2026071300_configurable_shifts.sql`).

### `2026071630_local_regs_permissions.sql`

```sql
INSERT INTO permissions (key, label, category, description) VALUES
  ('local_regs:view',   'View / Review Base Regs', 'local_regs', 'Open the Base Regs tab, read local regulations, and record recurring reviews'),
  ('local_regs:manage', 'Manage Base Regs',        'local_regs', 'Upload, replace, archive local regulations, set review intervals, and run the compliance report')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin's all-permissions seed predates these keys; grant explicitly.
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'local_regs:%'
ON CONFLICT (role, permission_key) DO NOTHING;
-- airfield_manager / namo / base_admin: both keys (CROSS JOIN VALUES pattern
-- from 2026062100_read_file_permissions.sql:28-32); amops: 'local_regs:view'
-- only. All grants ON CONFLICT (role, permission_key) DO NOTHING.
```

### `2026071631_local_regs_tables.sql`

```sql
CREATE TABLE local_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  review_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (review_interval IN ('monthly', 'quarterly')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX local_regulations_base_active_idx ON local_regulations(base_id, is_archived, created_at DESC);

-- Immutable insert-per-review rows (qrc_monthly_reviews shape); NO unique
-- index on (regulation_id, user_id, …) — re-reviewing inserts a fresh row.
CREATE TABLE local_regulation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  regulation_id UUID NOT NULL REFERENCES local_regulations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version_at_review INT NOT NULL,
  initials_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX local_regulation_reviews_lookup_idx ON local_regulation_reviews(base_id, user_id, regulation_id, reviewed_at DESC);
CREATE INDEX local_regulation_reviews_base_idx ON local_regulation_reviews(base_id, regulation_id);

ALTER TABLE local_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_regulation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "local_regulations_select" ON local_regulations
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'local_regs:view'));
-- "local_regulations_insert" (FOR INSERT … WITH CHECK), "…_update"
-- (FOR UPDATE … USING + WITH CHECK), "…_delete" (FOR DELETE … USING) are the
-- same expression with 'local_regs:manage' (the 2026062101 read_files shape).

-- SELECT with :view so compliance visibility can read all rows at the base.
CREATE POLICY "local_regulation_reviews_select" ON local_regulation_reviews
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'local_regs:view'));

-- Own row only; version_at_review server-validated against the live doc
-- version from day one (the 2026062104 hardening built in, not patched
-- later). The subselect runs under the inserter's RLS.
CREATE POLICY "local_regulation_reviews_insert" ON local_regulation_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'local_regs:view')
    AND version_at_review = (SELECT version FROM local_regulations WHERE id = regulation_id)
  );
-- No UPDATE/DELETE policies — reviews are immutable (CASCADE on doc delete).
```

### `2026071632_local_regs_storage.sql`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('local-regulations', 'local-regulations', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {base_id}/{timestamp}-{safeName} — first segment is the
-- base UUID (the 2026062102 read-files pattern).
CREATE POLICY "local_regs_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'local-regulations'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'local_regs:view'));
-- "local_regs_storage_insert" (FOR INSERT … WITH CHECK) and
-- "local_regs_storage_delete" (FOR DELETE … USING) are identical except the
-- permission key is 'local_regs:manage'.
```

### `2026071633_local_regs_enable_module.sql`

```sql
-- enabled_modules is a frozen text[] snapshot; defaultEnabled only affects
-- new bases (the known systemic gap the read_file backfill also closed).
UPDATE bases
SET enabled_modules = array_append(enabled_modules, 'local_regs')
WHERE NOT ('local_regs' = ANY(COALESCE(enabled_modules, '{}')));
```

## Access control

| Key | Grants | Held by |
|---|---|---|
| `local_regs:view` | see the Base Regs tab + badge, open PDFs, record reviews | `airfield_manager`, `namo`, `amops`, `base_admin`, `sys_admin` |
| `local_regs:manage` | upload, replace, archive, set interval, compliance report | `airfield_manager`, `namo`, `base_admin`, `sys_admin` |

`:view`/`:manage` follows the Read File action-naming style (this module is
its sibling; the newer `:read` style stays with civilian modules).
`read_only`, `atc`, `safety`, and kiosk roles get neither key — they see the
References and My Documents tabs but no Base Regs tab and no badge.
**Required-reviewer roster** (the compliance "Y" and outstanding set) =
`base_members` ∩ `profiles.role IN ['airfield_manager','namo','amops',
'base_admin','sys_admin']` — a new `LOCAL_REGS_REVIEWER_ROLES` constant kept
deliberately identical to `READ_FILE_READER_ROLES`
(`lib/supabase/read-files.ts:11-13`); roster reads `profiles.role`, not the
drifted `base_members.role` (same bug-avoidance as `fetchReadFileReviewers`).
Mirror both keys as `PERM.LOCAL_REGS_VIEW` / `PERM.LOCAL_REGS_MANAGE` in
`lib/permissions.ts` — `tests/permission-keys-drift.test.ts` fails otherwise.

## lib/ modules & API surface

No new route handlers — all access is client-side Supabase under RLS.

**`lib/local-regs/review-status.ts`** (new, pure — the generalized
`getMonthlyReviewStatus`; all inputs are `Pick<>`-narrowed row shapes so the
helpers unit-test without DB types):

```ts
export const INTERVAL_DAYS = { monthly: 30, quarterly: 90 } as const
export type RegReviewInterval = keyof typeof INTERVAL_DAYS
export type RegReviewState = 'never' | 'overdue' | 'updated' | 'current'

export function getRegReviewStatus(
  reg: Pick<LocalRegulationRow, 'version' | 'review_interval'>,
  latestReview: Pick<LocalRegReviewRow, 'reviewed_at' | 'version_at_review'> | null | undefined,
  now?: Date,
): { state: RegReviewState; reviewedAt: string | null; daysSinceReview: number | null }

/** IDs of active regs whose status for this user is never|updated|overdue. */
export function computeDueRegIds(regs, myReviews, now?): string[]

/** Roster partition for one reg's current cycle (compliance table + PDF). */
export function partitionCompliance(reg, roster, reviewsForReg, now?):
  { reviewed: Map<string, { reviewed_at: string; initials: string | null }>; outstanding: string[] }
```

**`lib/supabase/local-regulations.ts`** (new — clone of
`lib/supabase/read-files.ts`; `any`-cast client per the house pattern;
exported hand-written row types `LocalRegulationRow` / `LocalRegReviewRow` /
`LocalRegReviewer`):

- `fetchLocalRegs(baseId)` · `fetchMyRegReviews(baseId)` (all rows; callers
  reduce to latest-per-reg) · `fetchAllRegReviews(baseId)` ·
  `fetchLocalRegReviewers(baseId)` · `fetchDueLocalRegCount(baseId)`
  (= `computeDueRegIds(...).length`, the badge fetcher) ·
  `getLocalRegUrl(storagePath)` (5-min signed URL)
- `addLocalReg(baseId, file, { title, description?, reviewInterval })` —
  PDF-only + 25 MB validation, storage-orphan cleanup on row-insert failure
- `replaceLocalReg(row, file)` — optimistic `version` lock, superseded-object
  cleanup (exact `replaceReadFile` shape)
- `setLocalRegArchived(id, archived)` · `setLocalRegInterval(id, interval)` ·
  `reviewLocalReg(baseId, regulationId, version)` (inserts the review row with
  the user's `operating_initials` snapshot)

## UI components & pages

| File | Change |
|---|---|
| `app/(app)/regulations/page.tsx` | Extend `Tab` union with `'base-regs'`; render the tab button (with red due-count chip) only when module enabled + `has(PERM.LOCAL_REGS_VIEW)`; honor `?tab=base-regs`; mount `BaseRegsTab` |
| `components/local-regs/base-regs-tab.tsx` | **New** — `BaseRegsTab`: doc table/cards, status pills, open-then-attest flow, PII/CUI banner, add/replace/archive dialogs, interval select, per-doc compliance expandable, report button. Pattern-matched to `app/(app)/read-file/page.tsx`; Sonner toasts; lucide icons (`BookMarked`, `CheckCircle2`, `RefreshCw`, `ShieldAlert`, `Upload`, `FileDown`) |
| `lib/permissions.ts` | Add `LOCAL_REGS_VIEW` / `LOCAL_REGS_MANAGE` under a `// Local Regulations (Base Regs)` section comment |
| `lib/modules-config.ts` | Add `'local_regs'` to `ModuleKey`; `ModuleDef` `{ key: 'local_regs', label: 'Local Regulations', category: 'compliance', hrefs: [], setupSteps: [], defaultEnabled: true }` (both airport modes; `hrefs: []` because the surface is a self-gated tab on the always-on `/regulations` route) |
| `lib/sidebar-config.ts` | Append `'base regs'`, `'local regulations'`, `'OI'` to the `/regulations` nav item `keywords` so nav search finds the tab |
| `hooks/use-sidebar-badge-counts.ts` | New `localRegsDue` count (see Integration) |
| `components/layout/sidebar-nav.tsx` | New dot + label blocks for `/regulations`; section aggregation |
| `app/(app)/more/page.tsx` | `badgeFor('/regulations')` returns the due count |

All new files kebab-case, components PascalCase, imports via `@/`.

## Exports & PDF

**`lib/local-regs-review-pdf.ts`** (new) — client-side jsPDF + autotable:
`generateLocalRegsReviewPdf(input: { baseName?, baseIcao?, regs, reviewers,
reviews, generatedAtIso }): Promise<{ doc: jsPDF; filename: string }>`
(the `{ doc, filename }` convention). Layout mirrors
`lib/read-file-review-pdf.ts`: per document — title, version, interval, upload
date — then the roster table marking each required reviewer
`Reviewed ({initials} · {date})` for the current cycle (via
`partitionCompliance`) or **OUTSTANDING**, plus per-doc and overall summary
counts; out-of-roster review rows fold in defensively. Filename
`local-regs-review-{icao}-{yyyy-mm-dd}.pdf`. Button on the Base Regs tab,
gated `local_regs:manage`. No Excel export at launch.

## Integration

- **Badge chain** (the "red dot exactly like the pending-review dot"):
  `hooks/use-sidebar-badge-counts.ts` gets `localRegsDue` — in `refresh()`
  call `fetchDueLocalRegCount(installationId)` gated on
  `has(PERM.LOCAL_REGS_VIEW)` (mirror :107-111), add realtime subscriptions on
  both new tables with `filter: base_id=eq.${installationId}` (mirror
  :173-181), include in `total`. `sidebar-nav.tsx` copies the read-file
  blocks: red dot (`var(--color-danger)`, glow `0 0 6px rgba(239,68,68,0.5)`,
  `9+` clamp, suppressed while active) for `href === '/regulations' &&
  badgeCounts.localRegsDue > 0` (:509-522 pattern), the expanded-rail
  `"{n} to review"` label (:555-559), and `sectionLocalRegs` in the section
  aggregate's **red** priority bucket (:630-652) so the Reference header
  inherits the dot. `/more` `badgeFor('/regulations')` returns the count.
  `BaseRegsTab` dispatches `glidepath:badges-refresh` after every review /
  upload / replace / archive success (the read-file contract, page.tsx:75).
- **Module enablement** — `'local_regs'` in `ModuleKey` + `MODULES`
  (`defaultEnabled: true`, both modes) + the backfill migration; the tab
  self-gates on `enabledModules` from `useInstallation()`. Toggleable in the
  Base Configuration module selector; **no wizard step** (`setupSteps: []`).
- **No new sidebar item** — the surface rides the existing Reference Library
  entry; `HREF_TO_VIEW_PERM` and `/more` `HREF_PERMISSION` are unchanged
  (`/regulations` stays gated by `regulations:view`).

## Implementation sequence

1. **Migrations + PERM mirror** — the four migrations (applied individually
   via `db query --linked --file`, never `db push`) + `PERM.LOCAL_REGS_*`.
   Verify: `tests/permission-keys-drift.test.ts` green; no-manage insert into
   `local_regulations` denied; stale-`version_at_review` review insert denied.
2. **lib layer** — `lib/local-regs/review-status.ts` +
   `lib/supabase/local-regulations.ts` + `tests/local-regs.test.ts`. Verify:
   `npx vitest run tests/local-regs.test.ts` green; `npx tsc --noEmit`.
3. **Base Regs tab** — `components/local-regs/base-regs-tab.tsx` +
   `regulations/page.tsx` wiring + module registration. Verify manually:
   upload → open → attest flips status; replace flips everyone to `Updated`;
   archive drops due counts; tab hidden for `read_only` and when the module
   is disabled.
4. **Badge chain** — `use-sidebar-badge-counts.ts`, `sidebar-nav.tsx`,
   `more/page.tsx`. Verify: dot appears within seconds of another user's
   upload (realtime), clears instantly after attest, Reference section header
   aggregates, `/more` count matches.
5. **Compliance PDF** — `lib/local-regs-review-pdf.ts` + report button.
   Verify: partition matches on-screen chips; `{ doc, filename }` shape; add
   to `tests/pdf-generators-smoke.test.ts` if it enumerates generators.
6. **Docs touch** — `docs/manual/` page for Base Regs. Whole-feature gate:
   `npx tsc --noEmit` + `npm run build` + `npx vitest run`.

## Testing

**Unit (`tests/local-regs.test.ts`, vitest, pure helpers only):**

- `getRegReviewStatus`: `never` with no review; boundary — exactly 30/90 days
  since review is `current`, 31/91 is `overdue` (QRC uses strict `>`); mixed
  intervals; `updated` when `version > version_at_review` even inside the
  window; `updated` wins over `overdue`.
- `computeDueRegIds`: archived excluded; per-doc interval mix; version
  mismatch counts as due; only the latest review per reg considered.
- `partitionCompliance`: reviewed vs outstanding; a review at an old version
  counts as outstanding; an out-of-roster reviewer folds into the reviewed map
  without inflating the roster.

**RLS / isolation:** extend the existing guards
(`tests/rls-cross-base-isolation.test.ts`, `tests/rls-smoke.test.ts`) to cover
both new tables: cross-base SELECT denied; non-manage INSERT into
`local_regulations` denied; review INSERT for another `user_id` denied; review
INSERT with `version_at_review ≠` live version denied; no UPDATE/DELETE path
on reviews.

**Manual QA script:** (1) base_admin uploads a quarterly PDF — reviewer-role
users' badges go red with the correct count; (2) amops opens the PDF ("Mark
reviewed" enables only after opening), attests — badge decrements, status
green; (3) AFM replaces the PDF — amops flips to `Updated`, badge returns;
(4) interval quarterly→monthly on a doc reviewed 40 days ago — `Overdue`;
(5) archive — badge clears, doc stays in report history; (6) report X/Y
matches on-screen chips; (7) `read_only` — no tab, no badge; (8) module
disabled in Base Configuration — tab and badge disappear; (9) a second base
sees none of the first base's docs.

## Assumptions & open questions

- **Regulatory (all unverified — verify against the current publications on
  e-publishing.af.mil before citing anywhere in-app):** whether DAFMAN 13-204
  V2 mandates any local-publication review cadence at all, and its paragraph
  for the read-and-initial / publications-currency practice; whether the
  quarterly AOB (DAFMAN 13-204 V1) expects local-reg currency as a briefing
  item; the current V2 edition date. The module ships with cadence framed as
  local policy, so no in-app copy cites a paragraph.
- **Day-based windows (30/90) vs calendar month/quarter** — kept day-based for
  exact QRC parity. If the owner wants calendar-period semantics, the pure
  status function is the single place to change; confirm before step 2.
- **Roster breadth** — assumed identical to `READ_FILE_READER_ROLES`. Confirm
  whether civilian Part 139 roles (`sms_manager`, `accountable_executive`, …)
  need grants on civilian bases (read_file seeds USAF roles only; the SMS/AEP
  migrations are the reference if so).
- **PDF-only uploads** — brief says PDFs; assumed enforced (unlike Read File's
  broader ACCEPT list). Confirm office formats are genuinely out.
- **Merge posture** — Read File and Base Regs coexist permanently (one-time
  ack vs recurring review); relocating Read File under References would be a
  separate design.
- **PII/CUI banner** — assumed required (commercial-cloud posture, same as
  read-file); confirm the wording stays unchanged.

## Out of scope

- No reminder emails / push notifications for overdue reviews (badge + report
  only); no Excel export; no marketing-site (`glidepath-site`) entry.
- No per-user cadence overrides, no custom intervals beyond
  monthly/quarterly, no per-document audience selection (roster is
  role-derived, base-wide).
- No full-text search / PDF text extraction for Base Regs docs (My Documents'
  pdfjs/tsvector pipeline is not reused at launch).
- No changes to the Read File module, its tables, or its acknowledgment data;
  no `types.ts` regeneration (`any`-cast client per the house pattern).
- No enforcement that the PDF was scrolled/read — the open-before-attest gate
  is a client-side affordance, not an attestation control.
