# Session Handoff

**Date:** 2026-06-01
**Branch:** `main` — **pushed.** `origin/main` == local (0 ahead); v2.34.0 is
deployed (Vercel deploys on push).
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓
(728 pass / 75 files).
**HEAD:** `7453a3bc`

---

## What shipped this session

One theme: **cut and shipped v2.34.0.** The bulk of the work was bringing the
in-app **Help & Training** guide to parity with the module set the release
announces — seven new module guides + airport-type gating + verified
screenshots. Along the way a real gap surfaced (AMTR was hidden on 35 of 41
USAF bases) and got a data backfill, the AMTR guide gained an off-network Excel
import procedure, and the session closed by bumping the version, rebuilding the
What's New modal as scannable grouped sections, dating the CHANGELOG, and
pushing everything to production.

### Training-guide coverage + airport-type gating (`acd60f66` spec → `52ac12cd`, `9f639e62`, `d172fdbd`, `a35b84fa`, `e40d7782`, `8b779d4b` plan)

The `/help` guide (`MODULES` in `lib/training/modules.ts`) had guides for the 27
established modules but none for what v2.34 announces. Added seven full
`ModuleRef` guides — **AMTR, Records Export, SMS, §139.303 Training, AEP, Field
Conditions, WHMP** — with content sourced by reading each module's actual
implementation (no fabricated reg text; every citation already existed in code).
Added `appliesTo?: AirportType[]` to `ModuleRef` + a `moduleRefAppliesToAirport`
helper mirroring `lib/modules-config.ts`; the help page (`app/(app)/help/page.tsx`)
now filters the grid, the count pill, the reviewed denominator, and the Module
Reference PDF by `currentInstallation.airport_type`. Existing ACSI/SCN gated
USAF-only too. `tests/training-modules-gating.test.ts` locks the gating so a
future edit can't leak a civilian guide onto USAF bases. Built via
brainstorm→spec→plan→subagent-driven execution with two-stage (spec + quality)
review per unit.

### Screenshots wired into all 7 guides (`07e0e8ce`, `a6f08469`, `148abf35`)

17 screenshots copied into `public/training/` and captioned. Captions were
verified **against the actual images**, not the planning doc — which caught a
fabricated `amtr_1` caption (claimed table columns JQS% / Formal% / Last
Inspection that aren't in the image) and a "five-column grid" imprecision, both
corrected. User recaptured the §139.303 Training set (cleaner Topics / Roster /
Compliance / member-Records shots, banner-free) → swapped in, added a 4th. Records
Export shot added once the user supplied it. Records Export is the only guide
that briefly shipped text-only.

### AMTR hidden on 35/41 USAF bases — `enabled_modules` backfill (`8cc2d329`, migration `2026062000`)

User reported AMTR missing from the sidebar. Root cause: AMTR was added to the
module catalog after most bases' `enabled_modules` arrays were already set, and
`lib/installation-context.tsx` only falls back to "all modules" when
`enabled_modules` is `null` — a non-null array missing `amtr` silently hides it
(`isModuleEnabled` → false). Query confirmed 35 of 41 USAF bases affected (only
Air Force Academy + a few had it). Wrote an additive, idempotent backfill
(`array_append` guarded by containment), applied it to the linked DB, and
verified **41/41** USAF bases now carry `amtr`. Migration file committed as the
record.

### AMTR off-network Excel import procedure + multi-workflow (`62983725`)

Added a dedicated **"Importing an existing AFFSA Excel training record (must be
done off the AFNET)"** numbered procedure to the AMTR guide: copy each sheet
into a fresh workbook one at a time, exclude the Formal Training sheet, strip all
PII/CUI (SSNs etc.), email to a non-AFNET account, upload over commercial
internet (AFNET blocks non-AFNET uploads); manual transcription still works on
the AFNET. Plus a reinforcing FAQ. To carry two procedures, `ModuleRef.workflow`
now accepts `WorkflowDef | WorkflowDef[]` and the detail renderer maps over them
— the 14 single-workflow guides are unchanged.

### Stale banner removed + v2.34 builder refreshed (`9e887d3d`, `2bc1be9a`)

`9e887d3d` removed a leftover "Phase 3a build in progress" banner from the
`/training` (§139.303) landing — the module is shipped, so the banner read as
unfinished. `2bc1be9a` updated `docs/release-2.34-notes-builder.html`: added a
Help & Training candidate item, a §139.303 banner-fix item, and de-staled the
design item/section (it still said "opt-in preview / Classic stays default" —
Classic was removed, v2 is the only look).

### v2.34.0 release (`7453a3bc`)

Version → **2.34.0** in six spots (`package.json`, `package-lock.json` root,
login footer, Settings → About, README — README also refreshed to 728 tests /
259 migrations). Dated the CHANGELOG `[2.34.0] — 2026-06-01` with the user's
curated grouped notes (replaced the incomplete `[Unreleased]` block, which only
covered Records Export + the FAA phases). Reworked the in-app **What's New**:
added a `ReleaseSection` shape (`{ title, items }[]`) and a grouped renderer in
`components/whats-new-modal.tsx`, so the 2.34 entry shows 10 scannable section
headers instead of a flat 31-bullet wall (the user's explicit ask). `highlights`
is now optional; older entries still render their flat list.

---

## Migrations status

| File | Applied | What |
|---|---|---|
| `2026062000_backfill_amtr_enabled_modules.sql` | ✅ applied live this session | Adds `amtr` to USAF bases' `enabled_modules` where missing (35 bases). Additive + idempotent; civilian bases untouched. Verified 41/41 USAF bases now carry `amtr`. |

No pending migrations. All earlier `202606xx` migrations were applied in prior
sessions.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| AMTR module missing from sidebar / More on most USAF bases | `enabled_modules` arrays predate AMTR; the context only falls back to "all modules" on `null`, not on a non-null array missing the newer key | `8cc2d329` |
| Guide screenshot caption claimed table columns not present in the image | subagent captioned from the planning doc, not the PNG (`amtr_1`) | `a6f08469` |
| `regulations` guide's "related modules" silently rendered nothing | `relatedModules: ['training']` pointed at a non-existent id (predates the new `training-part139`) | `9f639e62` |
| "X of Y reviewed" could read e.g. "8 of 6" | `reviewedCount` came from a localStorage Set spanning all airport types; `totalCount` is now the gated set | `a35b84fa` |

---

## Lessons from this session

- **New `defaultEnabled` modules don't reach existing bases.** A base with a
  non-null `enabled_modules` array never picks up a module added later — only a
  `null` array falls back to "all". Every new module in the catalog needs a
  one-time backfill (or a fallback-semantics fix) or it's invisible on every
  pre-existing base. Saved as a project memory.
- **Caption-first is non-negotiable** — verifying 15 wired captions against the
  real PNGs caught one fabricated caption that read plausibly. Always open the
  image. (Already memory `feedback_caption_screenshots_first`.)
- **The What's New builder persists selections in browser localStorage, which
  overrides the HTML file's text for *existing* items on load.** New items added
  to the file's `SECTIONS` show up; text edits to existing items don't reach a
  user who has saved state. Edit in the builder UI or Reset, not just the file.
- **The Bash tool's cwd doesn't reliably persist between calls.** A `git add`
  with a relative path missed, and `npx tsc` ran from the wrong dir and printed
  a misleading "TSC_OK" (no tsconfig → compiled nothing). Prefix git/tsc/build
  commands with `cd "C:/Users/cspro/airfield-app" && …`.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `scn` missing on 26 USAF bases | Med | Same frozen-`enabled_modules` cause as AMTR. User chose amtr-only backfill this session; SCN backfill not done. Mirror `2026062000` if wanted. |
| New `defaultEnabled` modules don't reach existing bases | Med | Systemic — see Lessons. Next module add needs a backfill, or fix the `enabled_modules` null-only fallback in `lib/installation-context.tsx`. |
| `/help/[module-id]` detail route not airport-type-gated | Low | Renders any guide id regardless of airport type; no in-app path links to a cross-mode guide today. Defensive follow-up: `notFound()` (or a notice) when `appliesTo` excludes the current type. |
| Records Export guide bullet is USAF-flavored on civilian bases | Low | Records Export shows on both modes; the "AMTR is exported from its own module" bullet references a USAF-only module on civilian bases. Cosmetic. |
| v2.34 not yet walked on the deploy | Med | What's New grouped modal (desktop + mobile), AMTR visibility on USAF bases post-backfill, and the 7 new guides + screenshots all need a real-browser pass on the Vercel deploy. |
| usr-analytics privacy disclosure | Med | Carried — per-user usage tracking still has no user-facing disclosure line. |
| `types.ts` regen deferred | Med | Carried — hand-maintained additions; full `supabase gen types` is a large diff. |
| Base-setup file extraction deferred | Med | Carried — `base-config/setup/page.tsx` ~6k LOC. |
| AMTR batch never walked in a live browser | Med | Carried. |
| Records Export photo embed unverified on deploy | Low | Carried. |
| globals.css base (v1) tokens now dead | Low | Carried — `:root` v1 tokens remain as the layer the always-on `[data-design="v2"]` overrides. |
| extended-palette hex still literal | Low | Carried — a handful of hex outside the token set weren't converted. |
| `npm audit` transitives | Low | Carried. |
| Test-account fixtures live in prod | Info | Carried — `__TEST_RLS__` bases + `rls-*@glidepath-rls-test.com`. |

---

## Next session tasks

No required next step — v2.34.0 is shipped and deployed. Sensible candidates:

1. **Walk v2.34 on the Vercel deploy** — confirm the What's New modal reads as
   grouped, scannable sections (desktop + mobile), AMTR is now visible on USAF
   bases (post-backfill), and the seven new Help & Training guides + screenshots
   render correctly with the airport-type gating.
2. **SCN backfill** (optional) — 26 USAF bases are missing `scn` for the same
   reason AMTR was; a migration mirroring `2026062000` would surface it.
3. **Fix the systemic `enabled_modules` gap** (optional) — so future modules
   reach existing bases without a per-module backfill.

### Long-running carryover (bandwidth-permitting)
- `/help/[module-id]` detail-route airport gating; the civilian-flavored Records
  Export bullet.
- usr-analytics privacy/help copy.
- `types.ts` regen; `base-config/setup` extraction; live-browser walk of AMTR.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Build: npm run build — compiled successfully.
Tests: 728 pass / 75 files (+5 this session: training-modules-gating).

Notable First Load JS (routes touched this session):
  /help                     215 kB   (5.06 kB route — airport-type gating)
  /help/[module-id]         197 kB   (6.2 kB route — multi-workflow renderer)
  /settings/exports         174 kB
First Load JS shared        91.5 kB
Middleware                  74.5 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **v2.34.0** | 2026-06-01 | Help & Training covers every module + airport-type gating; AMTR visible fleet-wide (enabled_modules backfill); FAA Part 139 civilian mode; PPR coordination + notify; Records Export; refreshed design now the only look; grouped scannable What's New |
| v2.33.0 | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes |

---

## Key files touched this session

### New files
- `tests/training-modules-gating.test.ts`
- `supabase/migrations/2026062000_backfill_amtr_enabled_modules.sql`
- `public/training/` — `amtr_1..3`, `records-export_1`, `sms_1..3`, `aep_1..3`,
  `training-part139_1..4`, `field-conditions_1..2`, `whmp_1..2` (.png)
- `docs/superpowers/specs/2026-06-01-training-guide-coverage-design.md`,
  `docs/superpowers/plans/2026-06-01-training-guide-coverage.md`

### Modified files
- `lib/training/modules.ts` (7 new guides, `appliesTo` + helper, multi-workflow,
  AMTR import procedure + FAQ)
- `app/(app)/help/page.tsx` (airport-type gating), `app/(app)/help/[module-id]/page.tsx`
  (multi-workflow renderer)
- `lib/release-notes.ts` (`ReleaseSection` + 2.34 entry),
  `components/whats-new-modal.tsx` (grouped renderer)
- `app/(app)/training/page.tsx` (banner removal)
- `CHANGELOG.md`, `README.md`, `package.json`, `app/login/page.tsx`,
  `app/(app)/settings/page.tsx` (version bump + notes)
- `docs/release-2.34-notes-builder.html` (candidate refresh)
