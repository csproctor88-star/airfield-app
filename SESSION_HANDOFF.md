# Session Handoff

**Date:** 2026-06-30
**Branch:** `main` — **pushed, in sync with origin**.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (compiled successfully),
`npx vitest run` ✓ **1056 pass / 114 files** (was 1032 / 112).
**HEAD:** the AMTR inspection + 1098 completion series (see below).

AMTR record-inspection + 1098 changes, brainstormed → spec → plan → implemented in 8
tasks. **No DB migration** — inspection `items` is JSONB and the new fields are
additive. **Not live-smoke-tested** — promote and exercise on the preview (checklist
at the bottom).

Spec: `docs/superpowers/specs/2026-06-30-amtr-inspection-changes-design.md`
Plan: `docs/superpowers/plans/2026-06-30-amtr-inspection-changes.md`

---

## What shipped today (end state — read first)

### 0. Follow-up fix — rule 6.3 grades only the CURRENT year (real prod root cause)
- **Reported after promotion:** completed 1098 items (due 2027) still showed as
  "missing record." Root cause (verified against prod base `…0001`): the 1098
  catalog is **per-year**, and rule 6.3 enumerated **every** `year_label`. The base
  had 28 rows for **2025** and 28 for **2026**; the member worked 2026, so all 28
  **2025** rows (same task names, no progress for this member) were flagged. The
  shared names made completed items look flagged. The "28 missing" matched the 2025
  count exactly.
- **Fix** (`lib/amtr/inspection-engine.ts` rule 6.3): grade only the **current
  calendar year's** catalog (matching the 1098 tab's `currentYear = getUTCFullYear()`
  view), with a fallback to the latest non-future year when the current year isn't
  open; legacy rows with no `year_label` count as current. The period-elapsed gate
  (#1 below) is retained for within-year months. Two regression tests added.
- Note: the earlier period-gate (#1) was correct for *future months within* the
  current year, but did **not** catch *prior years* (a 2025 Annual item is
  "elapsed") — hence this second fix. Both are needed.

### 1. Period-aware records-inspection scan (no future-month false positives)
- Scan rule **6.3** (`1098_all_documented`, `lib/amtr/inspection-engine.ts`) was a pure
  presence check that flagged not-yet-occurred months (e.g. Sep–Dec in June) as
  "missing record." It now only flags items whose **period has fully elapsed**.
- New pures in `lib/amtr/status.ts`: `parseTaskMonth` (month name → 1–12) and
  `recurringPeriodElapsed(item, today)`. Monthly items use their named month within
  `year_label`; annual/other recurrences use the year. **Renamed/unparseable monthly
  rows and unknown frequencies keep the strict presence check** (per your call).
- Current month and future months are never flagged; fully-elapsed past months still are.

### 2. Editable discrepancies (Findings + Corrective Action)
- `InspectionItemResponse` gains `detail?` (editable finding text, seeded from the auto
  findings) and `correctiveAction?` (renamed from `note`); `normalizeInspectionItem`
  handles back-compat for older saved inspections.
- Inspect page (`app/(app)/amtr/[memberId]/inspect/page.tsx`): the read-only `⚠`
  findings line is now an **editable Findings textarea**, plus a labelled **Corrective
  Action** textarea (auto-shown on a No). Both autosave; both lock once completed.
- The archived inspection PDF (`lib/amtr-inspection-pdf.ts`) now shows the edited
  detail + corrective action.

### 3. Template-driven auto 623a entry on completion
- `completeAmtrInspection` previously wrote a generic `"N gap(s) noted."` line.
- New pure `lib/amtr/inspection-623a.ts` → `buildInspection623aComment` composes the
  NAMT/Certifier comment from the **recordsInspection DAFMAN template** header/cite +
  per-discrepancy `item number — detail` and `Corrective Action:` lines. Zero gaps →
  `"No discrepancies noted."` Still `entry_type: 'Monthly Training Records Inspection'`
  (satisfies scan rule 4.12).

### 4. 1098 early completion on Cert Official signature
- Root cause: signing only stamped initials; due-advance lived only in the manual
  `last_completed` edit, behind a `next_due_manual` guard, and uncontrolled inputs
  needed a refresh.
- `form1098-tab.tsx`: extracted `completeItem(catId, freq, completedDate)` (stamps
  completion, **always recomputes** `next_due`, clears the manual override, runs the
  later-year rollover). **Cert Official sign-off now auto-completes** the item
  (preserving an already-entered real date; else today) — status flips to Complete
  with no refresh (the parent `sign` reloads after `onSigned`). The existing auto-623a
  dialog on certifier sign is unchanged. Manual Last Completed edits also always
  recompute now.
- `dueStatus` tweak (`lib/amtr/status.ts`): a completed item whose next due is within
  the 30-day window now reads **Complete**, not Due Soon (so a freshly-completed
  Monthly item shows Complete). Regression-guard test added. Shared by RAT/reports/
  notifications — full suite re-run, no regressions.

---

## Migrations status

**None this session.** Everything rides in existing JSONB (`amtr_inspections.items`)
and existing 1098 columns. No pending migrations.

---

## Open follow-ups / not done

| Item | Notes |
|---|---|
| **Whole session not live-smoke-tested** | Verified via tsc/build/vitest only. |
| **Confirm FQ definition** (carried over) | Training Progress FQ = JQS 100% AND Formal 100%; does 1098/797 factor in? |
| **Selfridge 1098 duplicate rows** (carried over) | Data cleanup in the AMTR module, not widget/scan code. |
| **Inspection PDF** | Now shows detail + corrective action; layout not visually re-reviewed. |

---

## Live smoke test after promotion

- **Scan:** open a member's record inspection mid-year → 6.3 "missing record"
  findings list past months only (no current/future months); a past month with no
  record still appears; a member with everything documented for elapsed periods reads Yes.
- **Editable discrepancies:** edit a finding's detail and fill its Corrective Action;
  leave and reopen the draft → both persist.
- **623a entry:** complete the inspection → open the generated "Monthly Training
  Records Inspection" 623a → NAMT comment shows the template header, item numbers,
  edited detail, and corrective actions; a clean record reads "No discrepancies noted."
- **1098 completion:** Cert Official-sign a recurring item that's not yet due → Last
  Completed stamps, Due rolls forward by frequency, status flips to **Complete** with
  no page refresh; a freshly-completed Monthly item reads Complete (not Due Soon).
- **Manual date:** type a Last Completed date on another item → Due recomputes
  immediately, even if a manual due override had been set.

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-30 | AMTR record-inspection + 1098: scan rule 6.3 grades only the current-year catalog (fixes prior-year rows shown as missing) + period-aware months, editable discrepancy detail + corrective action, template-driven auto 623a entry, Cert Official sign auto-completes a 1098 item (+ dueStatus Complete-when-completed fix). |
| **Unreleased** | 2026-06-29 | Airfield Lighting widget family; dashboard round 2 (finer 24/40 grid, per-user default boards, AMTR Training Progress redesign, touch reorder, NOTAM wrap, settle scroll-to-top). |
| **Unreleased** | 2026-06-29 | Dashboard polish round 1: centered metric tiles; AMTR consolidated into one 9-report widget; Links drag/tap reorder. |
| **Unreleased** | 2026-06-28 | Dashboard widget refinement run on Phase 4. |
| **Unreleased** | 2026-06-27 | Phase 4 Configurable Native Widgets + customizable widget-grid dashboard. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |
