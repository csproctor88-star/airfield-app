# Session Handoff

**Date:** 2026-07-16
**Branch:** `main`. **2 commits** this session (`e075aa5b`, `9d7dd85e`),
**pushed**; tree clean (this handoff is the only modified file).
`glidepath-site`: **1 commit** (`2cefa19`), pushed.
**Build:** re-verified at wrap: tsc ✓ · lint 0 errors · vitest **1254 passed |
0 skipped** (138 files — the 16 RLS tests now execute locally, see below) ·
`npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `9d7dd85e` (airfield-app); `glidepath-site` @ `2cefa19`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied. Live writes this session: re-ran `supabase/seed-test-accounts.mjs`
(reset the password on the three `__TEST_RLS__` fixture users — additive, no
real data touched).

---

## What shipped this session

A thorough two-repo **code audit** (seven parallel read-only agents: dead
code, slop, client correctness, API/security, tests, migrations across
airfield-app; whole-repo on glidepath-site), then acted on the findings across
three commits and wired up the dormant RLS security-test suite. Both repos
were already unusually disciplined — the real findings were a handful of
genuine correctness/security defects plus accumulated dead weight, not slop.

### Security + correctness fixes (`e075aa5b`)

Findings verified against the code, then fixed:

- **`send-pdf-email` was an unthrottled relay.** The `pdfBase64` branch let
  any authenticated principal (incl. the shared kiosk / `read_only` account)
  send an arbitrary attachment to an arbitrary recipient from the verified
  `info@glidepathops.com` domain with no rate limit. The branch is the
  legitimate path for client-generated report PDFs, so added per-user +
  per-recipient `check_rate_limit` (service-role, fails open) rather than
  removing it.
- **A filed inspection could be silently lost.** On the no-draft filing path
  (`inspections/page.tsx`), `createInspection`'s `error` was dropped; on
  failure the flow cleared the draft and toasted "completed & filed" anyway.
  Now checks the error, keeps the draft, and stops.
- **False-success writes.** base-config Import All / Unlink All reported
  success even on a total RLS denial; `duplicateParkingPlan` returned the plan
  on a child-copy failure, producing a silently empty/partial duplicate of a
  persistent record. Now surface failures (Import/Unlink) and roll the plan
  back on copy failure (duplicate).
- **Cross-tenant PPR notification leak.** `send-ppr-coordination-request` and
  `ppr-agency-notify` resolved client-supplied `agencyIds` with no base scope,
  so a triager at base A could pass base B's agency IDs and email B's
  coordinators. Scoped every agency lookup to `entry.base_id`.
- **Middleware allowlist too broad.** `startsWith('/feedback')` also exempted
  the *authenticated* staff feedback page; anchored `/feedback` and
  `/ppr-request` to their `<baseId>` children. Replaced the blanket
  `/api/public/` prefix with explicit per-route entries (fail-safe: a future
  route under that namespace is gated by default). Added a regression test
  pinning the public-form-vs-staff-page split.

### Dead-code cleanup (`9d7dd85e`)

Every symbol re-verified with word-boundary grep + caller tracing before
removal — the audit over-reported ~14 symbols that were actually live via
internal callers; those were kept.

- `lib/tours/pages/*` (28 files, ~900 LOC): the retired per-page app-tour step
  library (tours retired for `/training`); plus dead `listTours` /
  `listToursForPath`.
- `components/ui/{card,stat,section-header}.tsx`: never-adopted UI-refresh-v2
  primitives. `components/amtr/reports/date-range-bar.tsx`: unused component.
- ~50 dead exports across `lib/supabase/*` and `lib/*`.
- Orphaned deps removed: `zod`, `pdf-parse`, `clsx` (its only user was the
  removed `utils.ts` `cn`); lockfile re-synced.
- Two orphaned logo PNGs.
- `CLAUDE.md` drift: Next 14→15, React 18→19, jsPDF 4.1→4.2, dropped the
  phantom `xlsx`/SheetJS row, corrected route-handler / migration / CRUD /
  PDF-generator counts.

### glidepath-site cleanup (`2cefa19`)

- Terminology guard extended to copy hardcoded in `app/**` (the citation-guard
  blind spot — page metadata was unscanned); +12 tests.
- OG generator palette resynced to `tailwind.config.ts` tokens (font swap to
  Barlow Condensed + Public Sans deferred — see tech debt).
- Removed dead `SHIPPED_PAGE_COUNT` export and `.chip-amber` CSS; docs fixed.

### RLS security-test suite wired up (no code — infra)

The audit's one real gap: the 16 cross-base isolation + pentest-remediation
tests (plus 6 in `permission-rpcs` / `rls-smoke`) skipped **everywhere** —
locally (no `TEST_RLS_*` in `.env.local`) and in CI (the 5 secrets in
`ci.yml` were never set), so multi-tenant isolation was guarded by tests that
ran nowhere while CI stayed green. The `__TEST_RLS__` fixtures already existed
(seeded 2026-05-29) but the creds were gone from `.env.local`. Re-ran
`seed-test-accounts.mjs` (idempotent — reused the existing bases/users, reset
their password, rewrote the three `TEST_RLS_*` values); the suite now runs
locally (**1254 passed, 0 skipped**). Owner added the 5 GitHub Actions secrets,
so **CI now executes the RLS suite on every push**.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Latest migration; nothing new this session |

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| A filed daily inspection silently lost; UI still says "completed & filed" | `createInspection` `error` dropped on the no-draft filing path; draft cleared + success toast regardless | `e075aa5b` |
| Base-config Import All / parking duplicate report success on failure | Unchecked fan-out writes; final toast unconditional | `e075aa5b` |
| Base A triager can email base B's PPR coordinators | client `agencyIds` resolved with no `base_id` scope | `e075aa5b` |
| Staff `/feedback` page reachable unauthenticated | `startsWith('/feedback')` also matched the authenticated route | `e075aa5b` |
| Any authed user can send arbitrary PDF to any recipient via `info@glidepathops.com` | `send-pdf-email` base64 branch had no rate limit / authz | `e075aa5b` |

## Lessons from this session

- **grep-based dead-table detection is unreliable in this repo.** AMTR tables
  are read via the dynamic registry helper `fetchAmtrByBase(cfg.table, baseId)`
  where the table name is a variable, so live tables have zero literal
  `.from('…')` refs. The audit mislabeled 5 live/seeded tables (`amtr_qtp`,
  `amtr_qtp_lessons`, `amtr_quals`, `daily_review_slots`,
  `discrepancy_statuses`) as droppable; owner caught it with app screenshots.
  Never drop a table from a static grep. (saved as a project memory)
- **"App doesn't read table X" ≠ "X is empty."** Legacy tables can still hold
  pre-migration data (the live Qualifications UI reads `amtr_qual_catalog`, but
  the old `amtr_quals` may hold original entries). Any DROP needs a read-only
  `SELECT count(*)` + owner confirmation first.
- **Audit subagents over-report dead code.** ~14 of ~65 flagged symbols were
  live via internal callers. Always re-verify with caller tracing + tsc before
  deleting; delegate the deletion to a subagent that gates on tsc.
- **The dominant correctness smell here is checked-at-primary-write,
  silent-on-fan-out** — primary records surface errors; the secondary writes
  they trigger (status pushes, outage events, counters, audit logs, child-row
  copies) are fire-and-forget. Fixed the worst; a tail remains (tech debt).

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| ~25 remaining fan-out silent-error sites | med | Lower-severity tail of the "silent-on-fan-out" class: inspection-templates non-atomic rebuild, `markInop`/`markOperational` outage-event writes, ARFF/runway status logs, denormalized `photo_count` counters, installation-context OOO/closed-message writes, waiver review-date writes. Deferred as a focused follow-up. |
| Stale generated Supabase `Database` type | med | 43 `supabase as any` casts un-type insert/update payloads on write paths; regenerate via `supabase gen types` (needs DB access) then delete the casts. |
| OG font regen (glidepath-site) | low | Generator palette fixed, but still renders Archivo vs the site's Barlow Condensed + Public Sans. Needs `@fontsource/barlow-condensed` + `@fontsource/public-sans` added, then `npm run og:images` (rewrites 60 brand PNGs) — an owner visual call. |
| The 5 "dead tables" are NOT dead | info | `amtr_qtp`/`_lessons`/`quals`, `daily_review_slots`, `discrepancy_statuses` back live features / hold seeded data. Do not drop. (project memory) |
| 2 now-unused exported types | low | `SmsCommunication`, `ClearanceContext` left in place after their callers were removed; harmless. |
| NIPR/AFNet uploads blocked | med | Carry: diagnosed; proxy plan at `~/.claude/plans/2026-07-15-nipr-upload-proxy.md`. Blocked on owner's airfield-diagram field test, then execution go. |
| Hero redline strings | med | Carry: owner preview pass owed on the "See it happen ↓" CTA, coverage band title split, the three ↳ automation lines, the dialect ethos pair (`lib/home-content.ts` / `lib/cascades.ts`). |
| Anonymous-submission gap 2026-07-02..14 | info | Carry: owner decides if outreach warranted. |
| reports "hgjhj" resolution row | low | Carry: owner accepted; drop-in swap when the demo row is cleaned. |
| Demo user on Demo AFB | med | Carry: civilian capture blocker; "prep KDRA" is step 0 (`docs/references/civilian-capture-plan.md`). |
| Proof band empty | med | Carry: testimonials + permissions owed by owner; null-hidden. |
| NAVAID marker-sizing dials · QRC draft flow · demo seeds `shift_name_*` · `modifications-exemptions` gated · track-page SEO · cosmetic (blank line in 51 site files) | low | Carry, unchanged. |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |

## Next session tasks

1. **Confirm CI runs the RLS suite green.** The 5 GitHub secrets were added
   this session; the next push to `main` will execute the RLS/pentest suites
   in the CI "Test" step instead of skipping. Owner monitors CI.
2. **NIPR upload proxy — field test, then execute.** Owner tests the
   airfield-diagram upload from an AFNet machine, then execute
   `~/.claude/plans/2026-07-15-nipr-upload-proxy.md` task-by-task. Design
   proceeds regardless of test outcome.
3. **Portland taxiway fix — owner spot-check on the promoted build**
   (base-config taxiway step should open and zoom smoothly at Portland).
4. **Civilian capture day** (owner-scheduled): owner says "prep KDRA" → run
   the pre-flight in `docs/references/civilian-capture-plan.md`.
5. **Hero + coverage redline pass** on the live homepage (carryover).
6. **Optional cleanup follow-ups:** the ~25 fan-out silent-error tail; the OG
   font regen (owner visual call); regenerate the Supabase `Database` type to
   delete the 43 `as any` casts.
7. **Part 139 cert-inspection audit build** — resume from
   `.superpowers/sdd/progress.md` when the owner wants it.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ 9d7dd85e (re-verified at wrap): tsc ✓ · lint 0 errors ·
  vitest 1254 passed | 0 skipped (138 files — RLS creds now in .env.local, so
  the previously-skipped 16 execute) · build ✓ · middleware 80.8 kB.
glidepath-site @ 2cefa19: tsc ✓ · lint 0/0 · vitest 155 passed · build ✓.
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-16 | Two-repo code audit (7 parallel agents) + remediation: `send-pdf-email` rate-limited, silent-lost-inspection + false-success write paths fixed, cross-tenant PPR notify scoped, middleware allowlist tightened · dead code removed (retired tour library, ~50 unused exports, `zod`/`pdf-parse`/`clsx`) · glidepath-site copy guard extended + OG palette resync · RLS security-test suite wired up (5 CI secrets, fixtures re-seeded; suite now runs, 0 skipped). |
| **Unreleased** | 2026-07-15 (late) | Base-config taxiway step no longer freezes on survey-grade imports (Portland: ~11k vertex markers dropped, RDP render decimation) · NIPR upload block diagnosed + proxy plan on file. |
| **Unreleased** | 2026-07-15 | glidepath-site military track media-complete · airfield-app: no code changes. |
| **Unreleased** | 2026-07-14 (late) | Military homepage cascade complete · airfield-app: 12-day anonymous public-form outage fixed (middleware allowlist). |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### Modified files
- `app/api/send-pdf-email/route.ts`, `app/api/send-ppr-coordination-request/route.ts`,
  `lib/ppr-agency-notify.ts`, `middleware.ts`, `tests/auth-gate.test.ts` —
  security fixes.
- `app/(app)/inspections/page.tsx`, `app/(app)/base-config/setup/page.tsx`,
  `app/(app)/parking/page.tsx`, `lib/supabase/parking.ts` — correctness fixes.
- `CLAUDE.md`, `package.json` + ~30 `lib/**` files — dead-code cleanup.

### Outside the repo
- `~/.claude/.../memory/project_audit_dead_tables_false_positive.md` — **new**;
  records that the 5 "dead tables" are live/seeded, never drop.
