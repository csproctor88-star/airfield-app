# Session Handoff

**Date:** 2026-07-16 (sessions 2 + 3 + 4, merged — this handoff covers all three)
**Branch:** `main`. Session 2 (local): **3 commits** (`ebf0a062`, `d87a71ee`,
`97240391`) + `glidepath-site` `8ed439e`/`9dd00ad`. Session 3 (remote, spec
planning): **3 commits** (`2f382ca`, `7314c88`, `41407bf`), merged at
`f7004cbc`. Session 4 (local, KFAR bugfix): **1 commit** (`a18946ab`, rebased
onto the spec merge). All **pushed**; tree clean.
**Build:** re-verified at session-4 wrap on the merged tree: tsc ✓ · lint 0
errors · vitest **1261 passed | 0 skipped** (140 files — +2 invariant tests
this session) · `npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `a18946ab` (airfield-app); `glidepath-site` @ `9dd00ad` (in sync,
tsc + lint re-verified session 4).
**DB:** migration `2026071600_seed_airfield_status_rows` **applied
2026-07-16** (backfill + trigger, verified: 64/64 bases covered). CI for
`glidepath-site` @ `9dd00ad` verified **green** via the GitHub API.

---

## What shipped (all sessions)

Session 2 closed out the audit backlog on `main` (Supabase type regen,
fan-out silent-error sweep, outage-event bookend) and ran a four-pass
marketing-site review with tier-1/2 execution. Session 3 was a planning
session on a side branch: **seven implementation-ready design specs**
(~3,600 lines) under `docs/superpowers/specs/`, merged to `main`. Session 4
ran down a live production bug reported from Hector ANG Base (KFAR) — the
airfield status board would not save — and found it was fleet-wide: **37 of
64 bases** had no `airfield_status` row.

### Session 4 — airfield_status seeding + wizard import staleness (`a18946ab`)

KFAR reported "Could not save the airfield status change" on every status
board write. Root cause: `airfield_status` began life as a single-row global
table (2026022201); the multi-base conversion (2026022301) made it
one-row-per-base but never added a creation hook. The only programmatic
seeding path was a best-effort, error-swallowed client insert buried in the
setup wizard's **Import All** flow — per-runway imports, and any base whose
setup skipped that path, got nothing. `updateAirfieldStatus` bails when its
row lookup comes back empty, so every save on a rowless base failed. 37
bases were affected, including the whole 2026-07-08 ANG batch, Holloman, and
KDRA (the civilian-capture demo airport).

Fix, DB side (migration `2026071600`, **applied + verified**): backfill a
default row for every rowless base, plus an `AFTER INSERT ON bases` trigger
(`bases_seed_airfield_status`, SECURITY DEFINER, `ON CONFLICT DO NOTHING`)
so every future base is seeded regardless of creation path. The fix was live
fleet-wide the moment it applied — no deploy needed. The wizard's redundant
insert is removed; `seed-test-accounts.mjs` teardown now deletes the
auto-seeded row before the base (plain NO ACTION FK) and surfaces
base-delete errors instead of swallowing them.

Fix, wizard side (rides the next deploy): the owner also hit imported
runways not appearing until a hard refresh. `RunwayTab` and `SimpleListTab`
froze their context prop into mount-time local state and mutations never
refreshed the installation context — the tabs unmount on step change, so a
remount re-seeded from the stale context and imports vanished. Now both tabs
re-seed local state when the context updates, and every successful mutation
(import one / import all / add / edit / delete / adjust-on-map, area
add/delete) writes through `refreshCurrentInstallation()`. The autosave pill
also registers deletes/updates/adjusts now — those handlers never called
`markSaved`, so the pill claimed "No changes yet" after real (instant)
saves, which read as a save failure. New env-gated invariant test asserts
each RLS fixture base has exactly one `airfield_status` row — the fixtures
are created via plain `bases` INSERT, so the test fails if the seed trigger
is ever dropped.

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
| `2026071600_seed_airfield_status_rows.sql` | **Applied 2026-07-16** | Backfills `airfield_status` for the 37 rowless bases + `AFTER INSERT ON bases` seed trigger. Verified: 64/64 covered, 0 missing. |
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Prior latest |
| `20260716xx` ranges (20–29, 30–39, 40–49, 50–59, 60–62; 16–19 partially used) | Planned only | Pre-assigned in the seven specs; renumber to implementation date when built (note `2026071600` is now taken) |

## Bugs fixed during the sessions

| Symptom | Root cause | Commit |
|---|---|---|
| "Could not save the airfield status change" (KFAR — actually 37 bases) | No `airfield_status` row; only seeding path was a best-effort, error-swallowed wizard insert inside Import All | `a18946ab` |
| Imported runways/areas vanish until a full page reload | Wizard tabs froze the context prop into mount-time state; mutations never refreshed the context, remounts re-seeded stale | `a18946ab` |
| Autosave pill says "No changes yet" after deleting/editing runways | delete/update/adjust handlers never called `markSaved` (saves were instant and real) | `a18946ab` |
| Failed dashboard-board writes toast `[object Object]` | `friendlyError(error)` passed the PostgrestError object, not `.message` | `ebf0a062` |
| PPR reopen destroys prior denial reason + coordination outcomes | preserving snapshot remark unchecked, rows reset anyway | `d87a71ee` |
| Two "active" records possible (parking plans; field-condition reports) | clear-active / supersede-prior secondary writes fire-and-forget | `d87a71ee` |
| `waivers.attachment_count` never updates | counter read `data` from a `head:true` query (always null) | `d87a71ee` |
| AFM default-message widget toasts success on failed save | installation-context writer swallowed the DB error | `d87a71ee` |
| Outage timeline never closes when a linked discrepancy completes | completion restored the feature but wrote no `resolved` event | `97240391` |

## Lessons from the sessions

- **Per-base singleton tables need a DB-level creation hook.** A client-side
  best-effort insert as the only seeding path fails silently and unevenly —
  `airfield_status` ran ~5 months with 37/64 bases save-broken. When a table
  is UPDATE-only from the app, ask: what guarantees the row exists?
- **The wizard's `useState(prop)` mount-freeze pattern loses writes on
  remount.** Tabs unmount on step change; if mutations don't write through
  to the installation context, a remount re-seeds from stale data. Fixed in
  RunwayTab/SimpleListTab; ShopsTab/ArffTab share the pattern (see debt).
- **A trigger that auto-seeds child rows changes delete semantics** —
  `seed-test-accounts.mjs` teardown broke silently until the child delete
  was added (NO ACTION FK). Audit teardown paths when adding seed triggers.
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
  connector's `read_file_content`, or chat-attached PDFs.
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

New (session 4):

| Item | Severity | Notes |
|---|---|---|
| ShopsTab / ArffTab still use the frozen-prop pattern | low | Same `useState(prop)` mount-freeze fixed in RunwayTab/SimpleListTab (`a18946ab`); context-fed but mutations don't write through. Not user-reported; fix opportunistically with the same recipe. |

Carried forward:

| Item | Severity | Notes |
|---|---|---|
| NIPR uploads blocked by DISA CBII | info (closed) | Field-tested 2026-07-16; block is the Menlo isolation layer, pre-JS. Proxy plan parked; owner not pursuing. Downloads work on AFNet. Don't re-propose. |
| 2 now-unused exported types | low | `SmsCommunication`, `ClearanceContext`; harmless. |
| Hero redline strings | med | Owner preview pass owed (`lib/home-content.ts` / `lib/cascades.ts`). |
| Anonymous-submission gap 2026-07-02..14 | info | Owner decides if outreach warranted. |
| reports "hgjhj" resolution row | low | Drop-in swap when the demo row is cleaned. |
| Demo user on Demo AFB | med | Civilian capture blocker; "prep KDRA" is step 0 (`docs/references/civilian-capture-plan.md`). KDRA's missing `airfield_status` row was fixed by the session-4 backfill. |
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
  the new CSP before promoting. (CI for `9dd00ad` verified green in
  session 4 — the preview CSP check is the remaining gate.)

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
   migrations early so per-user data accrues. Note `2026071600` is now taken
   by the airfield_status migration — shift spec-assigned numbers as needed.
3. **glidepath-site: owner preview-checks the CSP**, then promotes (CI
   already verified green for `9dd00ad`).
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
airfield-app @ a18946ab (re-verified at session-4 wrap, local): tsc ✓ ·
  lint 0 errors · vitest 1261 passed | 0 skipped (140 files — +2
  airfield_status invariant tests) · build ✓ · shared First Load JS 106 kB ·
  middleware 80.8 kB. No route-size changes (session 4 touched one page +
  a migration).
glidepath-site @ 9dd00ad: tsc ✓ · lint 0/0 · vitest 155 passed · build ✓
  (session 2 wrap); tsc + lint re-verified session 4; CI green (GitHub API).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-16 (session 4) | KFAR status-board save bug: 37/64 bases had no `airfield_status` row — fleet-wide backfill + `AFTER INSERT ON bases` seed trigger (migration `2026071600`, applied, live immediately) · setup-wizard import staleness fixed (context write-through + prop re-seed in RunwayTab/SimpleListTab) · autosave pill now registers deletes/updates · seed-script teardown FK fix · +2 invariant tests. |
| **Unreleased** | 2026-07-16 (spec planning, merged) | Seven implementation specs in `docs/superpowers/specs/` (manual coordinates, Part 77 polygons, FPR Check, local regs review, NAMO/NAMT report, 43 Check log, multi-standard surface sets) · Part 77 §77.19 lettering resolved from eCFR PDF · Class B criteria mis-sourcing discovered. No product code. |
| **Unreleased** | 2026-07-16 (late) | Cleanup follow-ups + marketing-site review. airfield-app: Supabase type regen (43 `as any` casts removed, `[object Object]` toast bug fixed) · fan-out silent-error sweep (27 sites, +5 guard tests: PPR-reopen data loss, two-active-record bugs, dead attachment-count) · resolved-outage-event on discrepancy completion. glidepath-site: 4-pass grading brief + SEO/security tier-1/2 (un-orphaned 50 module pages, canonicals, CSP + security headers, SoftwareApplication/BreadcrumbList JSON-LD). NIPR uploads closed as DISA-CBII-blocked, not pursuing. |
| **Unreleased** | 2026-07-16 | Two-repo code audit (7 parallel agents) + remediation: `send-pdf-email` rate-limited, silent-lost-inspection + false-success write paths fixed, cross-tenant PPR notify scoped, middleware allowlist tightened · dead code removed · glidepath-site copy guard extended · RLS security-test suite wired up (5 CI secrets; 0 skipped). |
| **Unreleased** | 2026-07-15 (late) | Base-config taxiway step no longer freezes on survey-grade imports (Portland RDP decimation) · NIPR upload block diagnosed + proxy plan on file. |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched (all sessions)

### New files
- `supabase/migrations/2026071600_seed_airfield_status_rows.sql` — backfill +
  seed trigger (applied).
- `docs/superpowers/specs/2026-07-16-feature-plans-index.md` — start here:
  build order + blockers — plus the seven `2026-07-16-*-design.md` specs.
- `tests/fanout-error-guards.test.ts` — regression guards for the fan-out
  sweep.

### Modified files (airfield-app)
- `app/(app)/base-config/setup/page.tsx` — wizard state sync + markSaved
  wiring + redundant insert removal (session 4).
- `supabase/seed-test-accounts.mjs` — teardown deletes the auto-seeded
  `airfield_status` row first (session 4).
- `lib/supabase/types.ts` (regen + manual narrowings) + ~14 de-casted files
  (session 2).
- Fan-out fixes across `app/(app)/{page,infrastructure,inspections,parking}`,
  `components/discrepancies/modals.tsx`, `lib/installation-context.tsx`,
  ~13 `lib/supabase/*`, `lib/{userDocuments,base-setup-quick-setup}.ts`
  (session 2).

### Modified files (glidepath-site, session 2)
- `components/modules/stack-section-card.tsx`, `app/**` metadata,
  `next.config.ts` (headers), `app/layout.tsx` + `lib/og.ts` +
  `app/sitemap.ts` + `components/modules/module-page.tsx`, 8 OG PNGs.

### Outside the repos
- `~/.claude/.../memory/project_nipr_upload_proxy.md` — DISA CBII field-test
  result + owner decision not to pursue.
