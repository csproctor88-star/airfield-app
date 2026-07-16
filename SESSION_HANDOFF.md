# Session Handoff

**Date:** 2026-07-16 (sessions 2 + 3, merged — this handoff covers both)
**Branch:** `main`. Session 2 (local): **3 commits** (`ebf0a062`, `d87a71ee`,
`97240391`) + `glidepath-site` `8ed439e`/`9dd00ad`. Session 3 (remote, spec
planning on `claude/fable-glidepath-feature-plans-b5l97k`): **3 commits**
(`2f382ca`, `7314c88`, `41407bf`), merged to `main` at wrap; tree clean.
**Build:** re-verified on the merged tree: tsc ✓ · lint 0 errors · vitest
**1237 passed | 22 skipped** of 1259 (the RLS/pentest suites skip in the
remote container — no `.env.local` in a fresh clone; CI runs them; session 2
ran the full 1259 | 0 locally) · `npm run build` ✓ (middleware 80.8 kB).
**HEAD:** the merge commit (parents `41407bf` spec branch · `f6df5e0` main);
`glidepath-site` @ `9dd00ad`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied. The specs pre-assign `20260716xx` ranges — planned filenames only.

---

## What shipped (both sessions)

Session 2 closed out the audit backlog on `main` (Supabase type regen,
fan-out silent-error sweep, outage-event bookend) and ran a four-pass
marketing-site review with tier-1/2 execution. Session 3 was a planning
session on a side branch: **seven implementation-ready design specs**
(~3,600 lines) under `docs/superpowers/specs/`, produced by multi-agent
workflows (research → write → adversarial verify → fix), now merged to
`main`.

### Session 2 — Supabase type regen + cast removal (`ebf0a062`)

`lib/supabase/types.ts` regenerated via `gen types --linked` (was missing
`email_broadcasts`, `marketing_leads`, three `bases` columns); all 43
`supabase as any` casts removed. The de-casting surfaced real defects, all
fixed: `dashboard-boards` toasted `[object Object]` on failed writes
(PostgrestError object passed to `friendlyError`), several `?? null` args to
`?: string` RPC params, orphaned eslint-disables. The file's two manual
narrowings (`bases.airport_type`, `obstruction_surface_set` → the
`lib/airport-mode.ts` unions) are re-applied and documented in a header —
preserve them on the next regen.

### Session 2 — Fan-out silent-error sweep (`d87a71ee`, `97240391`)

27 sites across 20 files, fixed by proportionality: abort/rollback where
silence corrupts records (PPR reopen, field-condition supersede, waiver
review stamps, FLIP timeline seed, `setActivePlan`, clear-then-reinsert
upserts, inspection-template rebuild); toast where the operator can act
(outage-event timeline writes, ARFF/runway status logs, discrepancy status
modal); throw where callers already try/catch (installation-context writers,
`userDocuments` ready-flip); log where drift is display-only
(`photo_count`, AMTR catalog stamp). Bonus: `waivers.attachment_count` never
updated (`head:true` query read `.data`, always null) — replaced with an
exact-count recount. `97240391` adds the missing `resolved` outage event
when completing a linked discrepancy (cancel/delete branch deliberately
left without a bookend — owner call if parity wanted). +5 guard tests in
`tests/fanout-error-guards.test.ts`.

### Session 2 — glidepath-site review + tier-1/2 (`8ed439e`, `9dd00ad`)

Four-pass grading brief — **Codebase B+ · Security B+ · SEO C+ · Overall B**
(artifact: `https://claude.ai/code/artifact/70fb86a9-8aa6-48b6-b1f1-3dadb9c1e06b`).
Executed the mechanical tier: un-orphaned the 50 module pages (real anchors
under the dialog UX), canonicals on all 10 static pages, brand de-dupe +
title trims, tight CSP + security headers in `next.config.ts`,
`SoftwareApplication`/`WebSite`/`BreadcrumbList` JSON-LD, sitemap
`lastModified`. NIPR upload proxy closed as **not-doing** — field test proved
a DISA CBII (Menlo) browser-isolation block that no app-side proxy can fix;
owner is not pursuing an exception. Don't re-propose.

### Session 3 — six feature specs + index (`2f382ca`)

From the owner's feature list: obstruction manual coordinate entry
(DD/DMS/DDM/MGRS smart-parse → existing `flyToPoint`/`handlePointSelected`
pipeline; zero migrations) · Part 77 surface polygons (rendering-layer gap —
the engine already switches sets, the map doesn't) · Flight Planning Room
Check (standalone module, SCN-patterned per owner) · local regulations
recurring review (extends the read-files design with per-doc cadence +
QRC-parity red dot) · NAMO/NAMT report tool (per-user activity matrix; the
attribution audit found gaps, so it specs FK migrations and per-domain
coverage-start labeling instead of silently-wrong counts) · 43 Check log
(DAFI 13-213 airfield driving spot check, AOB PDF export).
`2026-07-16-feature-plans-index.md` carries the build order; migration
number ranges are pre-assigned per spec so build order can't collide.
Verification: 128/129 codebase spot-checks passed; the one real find (a
Part 77 approach-surface width contradicting
`lib/calculations/obstructions.ts`) was fixed and re-verified.

### Session 3 — surface-set expansion + Part 77 lettering (`7314c88`)

Owner follow-up: make the obstruction standard selectable — AF Class A,
AF Class B, Army Class B, ICAO Annex 14, FAA Part 77 — in the base-config
Runways step. Modeled as *family + per-runway variant*
(`obstruction_surface_set` gains only `icao_annex14`; UFC variants ride the
dormant `runway_class` column, FAA rides `faa_approach_type`, ICAO adds
code-number/approach-class/strip-width columns) → **zero data rewrites**,
saved evaluations keep their meaning. Sources: owner-uploaded 14 CFR
Part 77 + 139 PDFs, UFC 3-260-01 2019 C3 and ICAO Annex 14 Vol I Ed 7 via
the owner's Google Drive connector. Where extraction failed (UFC glossary:
Class A conical/outer horizontal), dimensions are dashed PLACEHOLDERs, never
guessed. Resolved the Part 77 spec's §77.19 lettering question against the
eCFR PDF and found two real product bugs doing it (see Known issues).

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Still latest; nothing new either session |
| `20260716xx` ranges (16–19 unused, 20–29, 30–39, 40–49, 50–59, 60–62) | Planned only | Pre-assigned in the seven specs; renumber to implementation date when built |

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Failed dashboard-board writes toast `[object Object]` | `friendlyError(error)` passed the PostgrestError object, not `.message` | `ebf0a062` |
| PPR reopen destroys prior denial reason + coordination outcomes | preserving snapshot remark unchecked, rows reset anyway | `d87a71ee` |
| Two "active" records possible (parking plans; field-condition reports) | clear-active / supersede-prior secondary writes fire-and-forget | `d87a71ee` |
| `waivers.attachment_count` never updates | counter read `data` from a `head:true` query (always null) | `d87a71ee` |
| AFM default-message widget toasts success on failed save | installation-context writer swallowed the DB error | `d87a71ee` |
| Outage timeline never closes when a linked discrepancy completes | completion restored the feature but wrote no `resolved` event | `97240391` |

## Lessons from the sessions

- **Removing `as any` casts is a bug-finding technique, not just cleanup.**
  Regenerate the type, delete the casts, read the tsc fallout.
- **The checked-at-primary-write / silent-on-fan-out smell is now fully
  swept** (27 sites). Fix future ones by proportionality — abort/rollback if
  silence corrupts a record, toast if the operator can act, throw if a caller
  has try/catch, log if drift is display-only.
- **`head:true` Supabase count queries return `{ count, error }`, not
  `{ data }`.**
- **NIPR uploads are a DISA CBII (browser-isolation) block, not a network
  block.** No app-side fix possible; owner not pursuing an exception.
  (project memory)
- **glidepath-site's terminology guard scans `app/**` source including
  comments** — keep new comments em-dash-free in that repo.
- **Remote-session network policy blocks arbitrary hosts** (`wbdg.org`,
  Drive download hosts → CONNECT 403) even though WebSearch works. Working
  retrieval paths for owner documents: the authenticated Google Drive
  connector's `read_file_content`, or chat-attached PDFs (land on local
  disk, readable page-by-page).
- **The verified-vs-placeholder discipline pays for itself.** Reading UFC
  Table 3-7 from the actual document exposed that the app's encoded Class B
  inner-horizontal radius (13,120 ft ≈ 4,000 m) is almost certainly the
  *ICAO* value, not the UFC 7,500 ft — no web-search pass had caught it.

## Known issues / tech debt

New (session 3 spec research; fixes specced, not applied):

| Item | Severity | Notes |
|---|---|---|
| Encoded UFC Class B criteria conflict with UFC 3-260-01 Table 3-7 | **high — owner decision** | Code: inner horizontal 13,120 ft (≈4,000 m, the ICAO value) vs verified 7,500 ft; ADCS model also conflicts (25,000 ft / 2,550 outer half-width vs verified 50,000 ft / 16,000-ft end width). Correcting changes all future evaluation results at every base. Surface-set expansion spec §13 item 2. |
| `ufcRef` §77.19 lettering wrong in code | med | eCFR PDF confirms (a) Horizontal (b) Conical (c) Primary (d) Approach (e) Transitional; the code's citation strings disagree, on user-facing result cards. Fix specced in the expansion spec. |
| Obstruction coords hardcoded °N/°W | low | `app/(app)/obstructions/page.tsx:593` + `lib/obstruction-pdf.ts:92-93` render every point as N/W regardless of hemisphere. Fix ships with the manual-coordinates spec. |

Carried forward:

| Item | Severity | Notes |
|---|---|---|
| NIPR uploads blocked by DISA CBII | info (closed) | Field-tested 2026-07-16; block is the Menlo isolation layer, pre-JS. Proxy plan parked; owner not pursuing. Downloads work on AFNet. Don't re-propose. |
| 2 now-unused exported types | low | `SmsCommunication`, `ClearanceContext`; harmless. |
| Hero redline strings | med | Owner preview pass owed (`lib/home-content.ts` / `lib/cascades.ts`). |
| Anonymous-submission gap 2026-07-02..14 | info | Owner decides if outreach warranted. |
| reports "hgjhj" resolution row | low | Drop-in swap when the demo row is cleaned. |
| Demo user on Demo AFB | med | Civilian capture blocker; "prep KDRA" is step 0 (`docs/references/civilian-capture-plan.md`). |
| Proof band empty | med | Testimonials + permissions owed by owner; null-hidden. Largest outstanding glidepath-site conversion asset (brief §05). |
| NAVAID marker-sizing dials · QRC draft flow · demo seeds `shift_name_*` · track-page SEO · cosmetic (blank line in 51 site files) | low | Carry, unchanged. |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |

## glidepath-site — remaining review roadmap

The grading brief (artifact link above) holds the full plan. Tier-1 and most
tier-2 structured-data items shipped in session 2. Remaining:

- **This-month:** module H1 keyword pass (needs an `h1` field + copy
  sign-off); `/about` expansion from 148 words (owner voice); product-clip
  compression (10 MB MP4s → ≤2-3 MB) + embedding; scoped DB credential for
  the lead form (currently full service-role — security MED-2); tests for
  the demo route + rate limiter; render-or-delete the authored-but-unrendered
  `regulation.cites` fields.
- **This-quarter (traffic engine):** DAFMAN 13-204 explainer hub · Part 139
  self-inspection checklist lead magnet · operator glossary cluster ·
  military category page.
- **Owner actions:** www→apex 307 → 308 (Vercel dashboard); preview-check
  the new CSP before promoting.

## Next session tasks

1. **Owner decisions blocking the surface-set build** (expansion spec §13):
   (a) the Class B criteria audit — correct to UFC Table 3-7 values or keep
   deliberately; (b) supply the UFC appendix/glossary pages for Class A
   conical + outer horizontal (replace PLACEHOLDERs); (c) confirm the
   per-evaluation what-if picker should offer all 5 standards.
2. **Implement per the index build order**
   (`docs/superpowers/specs/2026-07-16-feature-plans-index.md`): manual
   coordinates first (small, zero-migration), then Part 77 polygons →
   surface-set expansion (after item 1), landing the NAMO/NAMT attribution
   migrations (`2026071641`–`42`) early so per-user data accrues.
3. **glidepath-site: verify CI green + preview-check the CSP**, then owner
   promotes.
4. **Pick the next glidepath-site tier-2/3 item** — highest-leverage: the
   DAFMAN 13-204 hub (traffic) or module H1 pass (quick, needs copy
   sign-off).
5. **Civilian capture day** (owner-scheduled): owner says "prep KDRA" → run
   `docs/references/civilian-capture-plan.md`.
6. **Hero + coverage redline pass** on the live homepage (carryover).
7. **Part 139 cert-inspection audit build** — resume from
   `.superpowers/sdd/progress.md` when the owner wants it.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ merge of 41407bf + f6df5e0 (re-verified on the merged tree,
  remote container after npm ci): tsc ✓ · lint 0 errors · vitest 1237 passed
  | 22 skipped of 1259 (RLS/pentest suites skip without .env.local creds;
  session 2 ran 1259 | 0 locally; CI runs them) · build ✓ · shared First
  Load JS 106 kB · middleware 80.8 kB. No route sizes changed by the merge
  (session 3 was docs-only).
glidepath-site @ 9dd00ad: tsc ✓ · lint 0/0 · vitest 155 passed · build ✓
  (verified at session 2 wrap).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-16 (spec planning, merged) | Seven implementation specs in `docs/superpowers/specs/` (manual coordinates, Part 77 polygons, FPR Check, local regs review, NAMO/NAMT report, 43 Check log, multi-standard surface sets) · Part 77 §77.19 lettering resolved from eCFR PDF · Class B criteria mis-sourcing discovered. No product code. |
| **Unreleased** | 2026-07-16 (late) | Cleanup follow-ups + marketing-site review. airfield-app: Supabase type regen (43 `as any` casts removed, `[object Object]` toast bug fixed) · fan-out silent-error sweep (27 sites, +5 guard tests: PPR-reopen data loss, two-active-record bugs, dead attachment-count) · resolved-outage-event on discrepancy completion. glidepath-site: 4-pass grading brief + SEO/security tier-1/2 (un-orphaned 50 module pages, canonicals, CSP + security headers, SoftwareApplication/BreadcrumbList JSON-LD). NIPR uploads closed as DISA-CBII-blocked, not pursuing. |
| **Unreleased** | 2026-07-16 | Two-repo code audit (7 parallel agents) + remediation: `send-pdf-email` rate-limited, silent-lost-inspection + false-success write paths fixed, cross-tenant PPR notify scoped, middleware allowlist tightened · dead code removed · glidepath-site copy guard extended · RLS security-test suite wired up (5 CI secrets; 0 skipped). |
| **Unreleased** | 2026-07-15 (late) | Base-config taxiway step no longer freezes on survey-grade imports (Portland RDP decimation) · NIPR upload block diagnosed + proxy plan on file. |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched (both sessions)

### New files
- `docs/superpowers/specs/2026-07-16-feature-plans-index.md` — start here:
  build order + blockers — plus the seven `2026-07-16-*-design.md` specs
  (manual coordinates, Part 77 surfaces, FPR check, local regs review,
  NAMO/NAMT report, driving spot check, surface-set expansion).
- `tests/fanout-error-guards.test.ts` — regression guards for the fan-out
  sweep.

### Modified files (airfield-app, session 2)
- `lib/supabase/types.ts` (regen + manual narrowings) + ~14 de-casted files.
- Fan-out fixes across `app/(app)/{page,infrastructure,inspections,parking}`,
  `components/discrepancies/modals.tsx`, `lib/installation-context.tsx`,
  ~13 `lib/supabase/*`, `lib/{userDocuments,base-setup-quick-setup}.ts`.

### Modified files (glidepath-site, session 2)
- `components/modules/stack-section-card.tsx`, `app/**` metadata,
  `next.config.ts` (headers), `app/layout.tsx` + `lib/og.ts` +
  `app/sitemap.ts` + `components/modules/module-page.tsx`, 8 OG PNGs.

### Outside the repos
- `~/.claude/.../memory/project_nipr_upload_proxy.md` — DISA CBII field-test
  result + owner decision not to pursue.
