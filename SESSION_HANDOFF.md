# Session Handoff

**Date:** 2026-07-16 (second session this date — follows the two-repo audit)
**Branch:** `claude/fable-glidepath-feature-plans-b5l97k` — **NOT main.** This
was a remote (cloud) session pinned to a designated branch; **2 commits**
(`2f382ca`, `7314c88`), **pushed**; tree clean (this handoff is the only
modified file). Docs-only session — zero product code, zero migrations.
`glidepath-site`: untouched.
**Build:** re-verified at wrap (fresh container, `npm ci` first): tsc ✓ ·
lint 0 errors · vitest **1232 passed | 22 skipped** (the RLS/pentest suites
skip here — no `.env.local` in a fresh clone; CI runs them) · `npm run build`
✓ (middleware 80.8 kB).
**HEAD:** `7314c88` (airfield-app); `glidepath-site` still @ `2cefa19`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied. Specs pre-assign ranges `20260716xx` — planned filenames only,
nothing created.

---

## What shipped this session

A planning session, not a build session: **seven implementation-ready design
specs** (~3,600 lines) under `docs/superpowers/specs/`, produced by
multi-agent workflows (research → write → adversarial verify → fix), every
codebase claim spot-checked against the repo and every regulatory citation
traced to a read document or explicitly flagged unverified. The specs are
self-contained — a cold session can implement any of them without this
conversation's context.

### Six feature specs + index (`2f382ca`)

From the owner's feature list (voice-transcribed; ambiguities resolved by
Q&A): obstruction manual coordinate entry (DD/DMS/DDM/MGRS smart-parse →
existing `flyToPoint`/`handlePointSelected` pipeline; zero migrations) ·
Part 77 surface polygons (rendering-layer gap — the engine already switches
sets, the map doesn't) · Flight Planning Room Check (standalone module,
SCN-patterned per owner) · local regulations recurring review (extends the
read-files design with cadence + QRC-parity red dot) · NAMO/NAMT report tool
(per-user activity matrix; attribution audit found gaps, specs FK migrations
and per-domain coverage-start labeling instead of silently-wrong counts) ·
43 Check log (DAFI 13-213 airfield driving spot check, AOB PDF export).
`2026-07-16-feature-plans-index.md` carries the build order; migration
number ranges are pre-assigned per spec so build order can't collide.
Verification: 128/129 spot-checks passed; the one real find (a Part 77
approach-surface width contradicting `lib/calculations/obstructions.ts`) was
fixed and re-verified.

### Surface-set expansion + Part 77 lettering resolution (`7314c88`)

Owner follow-up: the obstruction tool only supports AF Class B; make the
standard selectable — AF Class A, AF Class B, Army Class B, ICAO Annex 14,
FAA Part 77 — in the base-config Runways step. The spec models this as
*family + per-runway variant* (`obstruction_surface_set` gains only
`icao_annex14`; UFC variants ride the dormant `runway_class` column, FAA
rides `faa_approach_type`, ICAO adds code-number/approach-class/strip-width
columns), so **zero data rewrites** and saved evaluations keep their meaning.
Sources: owner-uploaded 14 CFR Part 77 + 139 PDFs (read directly), UFC
3-260-01 2019 C3 and ICAO Annex 14 Vol I Ed 7 via the owner's Google Drive
connector (the container's network policy 403s direct downloads — see
Lessons). Where extraction failed (UFC glossary: Class A conical/outer
horizontal), dimensions are dashed PLACEHOLDERs, never guessed. Also
resolved the Part 77 spec's open lettering question against the eCFR PDF —
and found two real product bugs in the process (see Known issues).

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Still latest; nothing new this session |
| `20260716xx` ranges (60–62, 20–29, 30–39, 40–49, 50–59) | Planned only | Pre-assigned in the seven specs; renumber to implementation date when built |

## Bugs fixed during the session

None — docs-only session. Bugs *found* (not fixed) are in Known issues.

## Lessons from this session

- **Remote-session network policy blocks arbitrary hosts** (`wbdg.org`,
  `drive.usercontent.google.com` → CONNECT 403) even though WebSearch works.
  The retrieval path that works for owner documents: the authenticated
  Google Drive connector's `read_file_content` (runs claude.ai-side), or the
  owner attaching PDFs directly to chat (they land on local disk, readable
  page-by-page).
- **The verified-vs-placeholder discipline pays for itself.** Reading UFC
  Table 3-7 from the actual document exposed that the app's encoded Class B
  inner-horizontal radius (13,120 ft ≈ 4,000 m) is almost certainly the
  *ICAO* value, not the UFC 7,500 ft — a mis-sourcing no web-search research
  pass had caught.
- **Specs on a side branch are invisible to main-branch sessions.** Until
  the branch merges, a session starting cold on `main` won't see the specs
  or this handoff revision.

## Known issues / tech debt

New this session (all found during spec research; fixes are specced, not applied):

| Item | Severity | Notes |
|---|---|---|
| Encoded UFC Class B criteria conflict with UFC 3-260-01 Table 3-7 | **high — owner decision** | Code: inner horizontal 13,120 ft (≈4,000 m, the ICAO value) vs verified 7,500 ft; ADCS model also conflicts (25,000 ft / 2,550 outer half-width vs verified 50,000 ft / 16,000-ft end width). Correcting changes all future evaluation results at every base. Surface-set expansion spec §13 item 2. |
| `ufcRef` §77.19 lettering wrong in code | med | eCFR PDF confirms (a) Horizontal (b) Conical (c) Primary (d) Approach (e) Transitional; code's citation strings disagree. Display-only, but it's on user-facing result cards. Fix specced in the expansion spec. |
| Obstruction coords hardcoded °N/°W | low | `app/(app)/obstructions/page.tsx:593` + `lib/obstruction-pdf.ts:92-93` render every point as N/W regardless of hemisphere. Fix ships with the manual-coordinates spec. |

Carried forward (unchanged from the 2026-07-16 audit session):

| Item | Severity | Notes |
|---|---|---|
| ~25 remaining fan-out silent-error sites | med | Inspection-templates non-atomic rebuild, `markInop`/`markOperational` outage events, ARFF/runway status logs, `photo_count` counters, installation-context OOO writes, waiver review-date writes. |
| Stale generated Supabase `Database` type | med | 43 `supabase as any` casts; regenerate via `supabase gen types`, then delete casts. |
| OG font regen (glidepath-site) | low | Needs `@fontsource/barlow-condensed` + `@fontsource/public-sans`, then `npm run og:images`; owner visual call. |
| The 5 "dead tables" are NOT dead | info | `amtr_qtp`/`_lessons`/`quals`, `daily_review_slots`, `discrepancy_statuses` — do not drop. (project memory) |
| 2 now-unused exported types | low | `SmsCommunication`, `ClearanceContext`; harmless. |
| NIPR/AFNet uploads blocked | med | Proxy plan at `~/.claude/plans/2026-07-15-nipr-upload-proxy.md`; blocked on owner field test. |
| Hero redline strings | med | Owner preview pass owed (`lib/home-content.ts` / `lib/cascades.ts`). |
| Anonymous-submission gap 2026-07-02..14 | info | Owner decides if outreach warranted. |
| reports "hgjhj" resolution row | low | Drop-in swap when demo row is cleaned. |
| Demo user on Demo AFB | med | Civilian capture blocker; "prep KDRA" is step 0. |
| Proof band empty | med | Testimonials + permissions owed by owner; null-hidden. |
| NAVAID marker-sizing dials · QRC draft flow · demo seeds `shift_name_*` · `modifications-exemptions` gated · track-page SEO · cosmetic blank line (51 site files) | low | Carry, unchanged. |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |

## Next session tasks

1. **Merge the spec branch.** The seven specs live only on
   `claude/fable-glidepath-feature-plans-b5l97k`. Owner call: PR or direct
   merge to `main`. Until then, main-branch sessions can't see them.
2. **Owner decisions blocking the surface-set build** (expansion spec §13):
   (a) the Class B criteria audit above — correct to UFC Table 3-7 values or
   keep as-is deliberately; (b) supply the UFC appendix/glossary pages for
   Class A conical + outer horizontal to replace the PLACEHOLDERs; (c)
   confirm the per-evaluation what-if picker should offer all 5 standards.
3. **Implement per the index build order**
   (`docs/superpowers/specs/2026-07-16-feature-plans-index.md`): manual
   coordinates first (small, zero-migration), then Part 77 polygons →
   surface-set expansion (after item 2 resolves), landing the NAMO/NAMT
   attribution migrations (`2026071641`–`42`) early so per-user data accrues.
4. **Confirm CI runs the RLS suite green** (carry — secrets were added last
   session; owner monitors the next `main` push).
5. **NIPR upload proxy** — owner field test, then execute the plan (carry).
6. **Portland taxiway fix spot-check** on the promoted build (carry).
7. **Civilian capture day** — owner says "prep KDRA" (carry).
8. **Hero + coverage redline pass** (carry).
9. **Optional cleanups:** fan-out silent-error tail · Supabase type regen ·
   OG font regen (carry).
10. **Part 139 cert-inspection audit build** — resume from
    `.superpowers/sdd/progress.md` when the owner wants it (carry).

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ 7314c88 (re-verified at wrap, fresh container after npm ci):
  tsc ✓ · lint 0 errors · vitest 1232 passed | 22 skipped (135+3 files —
  RLS/pentest suites skip without .env.local creds; they run in CI and ran
  1254|0 locally last session) · build ✓ · middleware 80.8 kB.
  No route sizes changed — docs-only diff.
glidepath-site @ 2cefa19: untouched this session; last verified 2026-07-16
  (audit session): tsc ✓ · lint 0/0 · vitest 155 passed · build ✓.
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-16 (later) | Seven implementation specs on branch `claude/fable-glidepath-feature-plans-b5l97k`: manual coordinates, Part 77 polygons, FPR Check, local regs review, NAMO/NAMT report, 43 Check log, multi-standard surface sets · Part 77 §77.19 lettering resolved from eCFR PDF · Class B criteria mis-sourcing discovered. No product code. |
| **Unreleased** | 2026-07-16 | Two-repo code audit (7 parallel agents) + remediation: `send-pdf-email` rate-limited, silent-lost-inspection + false-success write paths fixed, cross-tenant PPR notify scoped, middleware allowlist tightened · dead code removed (retired tour library, ~50 unused exports, `zod`/`pdf-parse`/`clsx`) · glidepath-site copy guard extended + OG palette resync · RLS security-test suite wired up (5 CI secrets, fixtures re-seeded; suite now runs, 0 skipped). |
| **Unreleased** | 2026-07-15 (late) | Base-config taxiway step no longer freezes on survey-grade imports (Portland: ~11k vertex markers dropped, RDP render decimation) · NIPR upload block diagnosed + proxy plan on file. |
| **Unreleased** | 2026-07-15 | glidepath-site military track media-complete · airfield-app: no code changes. |
| **Unreleased** | 2026-07-14 (late) | Military homepage cascade complete · airfield-app: 12-day anonymous public-form outage fixed (middleware allowlist). |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files (all `docs/superpowers/specs/`)
- `2026-07-16-feature-plans-index.md` — start here: build order + blockers
- `2026-07-16-obstruction-manual-coordinates-design.md`
- `2026-07-16-obstruction-part77-surfaces-design.md` (later amended: §13
  lettering question resolved)
- `2026-07-16-flight-planning-room-check-design.md`
- `2026-07-16-local-regulations-review-design.md`
- `2026-07-16-namo-namt-report-tool-design.md`
- `2026-07-16-airfield-driving-spot-check-design.md`
- `2026-07-16-airfield-surface-set-expansion-design.md`

No product source files were touched.
