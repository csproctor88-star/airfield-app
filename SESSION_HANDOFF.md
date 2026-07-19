# Session Handoff

> **2026-07-19 — rulings, Modifications & Exemptions module, mobile polish,
> status-board layout engine (session 9).** Interactive, home machine, spans
> 2026-07-18 evening → 07-19. **9 commits** (`34797542`..`1615c9b9`), **all
> PUSHED**, tree clean and level with origin. Build green on the final tree:
> tsc ✓ · lint 0 errors · vitest **1784 passed | 24 skipped** (179 files) ·
> build ✓ (`/` 28.7 kB · 241 kB First Load; `/modifications-exemptions`
> 15.2 kB · 196 kB). **8 migrations (2026071800–2026071902) APPLIED to the
> linked DB** and verified by their header queries; `types.ts` regenerated
> twice via its documented splice procedure — the first regen also caught
> silent session-7 drift (`airfield_driver_licenses`, `bases.distance_unit`,
> `driving_checks.driver_483_number` were absent from generated types).
>
> Shipped:
> - **Permission rulings** (`34797542`, applied + live-verified): `atc`
>   loses `fpr:view`; civilian × FPR confirmed already-none (recorded in the
>   migration header, no statement); `majcom_rfm` trued up to its full
>   every-`:view` contract — owner picked "all six" including `fpr`/`amtr`.
>   Root cause: the 2026042202 one-time `LIKE '%:view'` seed never covered
>   later keys; a time-accurate replay audit found the drift the static
>   matrix test structurally masks (full-catalogue SELECT resolution + two
>   unparsed statement shapes — noted in the test's comments).
> - **Modifications & Exemptions module** (`adb085a8` spec → `fb76f0eb`) —
>   civilian Part 139 tracker at `/modifications-exemptions` for MOS
>   (FAA Order 5300.1G, Appendix A category picker, 5-yr design expiry,
>   ¶12.b ALP-table register), §139.111 exemption petitions (§11.81 field
>   map, ARFF §139.111(b) path w/ 120-day rule, §11.101 60-day
>   reconsideration, annual reviews answering Form 5280-4 "Justification
>   Still Valid"), and §139.113 deviations (14-day RADM clock). Every
>   regulatory value transcribed from the owner's four PDFs into gitignored
>   `docs/references/part139-mos-exemptions-verified.md` (note: 5280.5D
>   internally disagrees 3-vs-2-yr max exemption term — the module stores
>   letter dates, never a hardcoded term). Owner ruled "all recommended" on
>   the spec's six open questions. Default-on for civilian bases
>   (backfilled); grants include explicit `majcom_rfm`/`read_only` per the
>   drift lesson. Manual `27_modifications_exemptions.md`.
> - **Modal token fix** (`ed528997`) — the new form styled panels with
>   `--color-bg-1/-2`, names that don't exist in `globals.css`; invalid
>   `var()` unsets background → transparent dialog over the page. Mapped to
>   the real tokens (`bg-surface`, `bg-inset`, `bg-surface-solid`) and
>   modal z to the house 1000.
> - **Mobile form-overflow polish** (`c79828da`) — one bug class from five
>   owner screenshots: controls inside fixed grids / non-wrapping flex rows
>   can't shrink below intrinsic width (iOS date inputs worst). Fixed the
>   five + two found proactively (ACSI cover fields, FLIP change-card) +
>   a global ≤767px guard (`input/select/textarea { min-width:0;
>   max-width:100% }`) beside the existing 16px iOS rule. AMTR untouched
>   (desktop banner).
> - **Status-board layout engine** (three steps in one day):
>   `c6dace7d` NAVAID uniformity (labels ellipsize so badges align flush;
>   section cards stretch equal-height) + the datetime-local dialog
>   overflow fix + reorder-only layout v1. `cfc3c359` dashboard-style
>   drag + resize on the dashboard's 24-col/40px geometry — react-grid-layout
>   loads ONLY in edit mode (dynamic import; `/` stays 241 kB vs
>   /dashboard's 454), viewers render a pure CSS grid, phones stack in
>   reading order, and — owner's anti-choppiness rule — edits buffer in
>   local state with exactly ONE server write on explicit Save (no
>   breakpoint variants either; that reflow was part of the dashboard's
>   original jank). `1615c9b9` every block movable: Personnel,
>   Construction/Closures, Misc Info, and the PPR panel join the same grid
>   as equal sections; the old two-zone look survives only as the
>   never-saved default (pixel-identical). Gate: new
>   `airfield_status:manage_layout` granted to exactly the admin tier
>   (airfield_manager/namo/base_admin/sys_admin — deliberately not amops),
>   enforced in RLS on `status_board_layouts` (rects JSONB + derived
>   `section_order`).
>
> Cleared: session-7's parking touch long-press (owner verified on device).
> **Owner QA on the promoted build:** Mods & Exemptions pass on a civilian
> base (one record of each type, annual review, PDF attachment, register +
> detail PDFs) · status board arrange/resize/save on desktop, amops sees no
> Edit button, phone shows stacked order · re-check the five mobile-overflow
> screenshots. Open next: **glidepath-site `modifications-exemptions` page
> registration** (owner reviews site copy; its `regulation: null` can now
> cite verified §139.111 / Order 5300.1G) · **Part 139 cert-audit resume**
> (session-6 task 6, Task 2.5c) · long-running carryover unchanged.

> **2026-07-18 — twin-bug fix waves + site H1 pass (session 8).** Interactive.
> **2 app commits** (`ae55b046`, `cb074af1`) + **1 glidepath-site commit**
> (`381c3cb`), **all PUSHED**, both trees clean and level with origin. Build
> green on the final tree: tsc ✓ · lint 0 errors · vitest **1755 passed**
> (174 files) · build ✓ (/scn 10.8 kB · 195 kB First Load; /read-file 9.8 kB
> · 190 kB; middleware 80.8 kB unchanged). **Zero migrations.** Clears queued
> items 2, 4, and 5 from the session-6 task list below.
>
> Shipped:
> - **SCN twin-bug fix wave** (`ae55b046`) — the FPR fix wave (`83890e54`)
>   ported back to the template it was cloned from. History Edit no longer
>   rewrites TODAY's check (date threads through a pure `buildScnSavePayload`
>   and renders in the modal); edit drafts preserve removed-agency snapshot
>   rows (`buildScnAgencyDrafts` appends unconsumed prior results); quick-fill
>   clears stale OOS notes; "Cancel OOS" restores the pre-dialog status;
>   history sorts newest-first (`sortScnHistory`); `scn-pdf` em-dash
>   sanitization, and its "Controller OI" heading/column now reads "OI" /
>   "Logged by" (terminology: never "controller"). 14 new tests.
> - **Read File archived-report fix** (`cb074af1`) — mirror of `17c1ade9`:
>   the review report gains an "Archived (history)" section via a shared
>   per-file renderer, excluded from the stat box, with an explicit count
>   line; the page now passes the archived list; generator text sanitized.
>   4 new tests including a raw-PDF content assertion.
> - **glidepath-site module H1 pass** (`381c3cb`, owner-approved with no
>   edits) — optional `h1` on `ModuleEntry`, rendered as `h1 ?? name` on the
>   module detail page only; 30 keyworded headlines (18 military / 12
>   civilian, every bare acronym spelled out), 20 pages keep their name.
>   Breadcrumb/pager/track index keep short names; metaTitles + OG images
>   untouched (no OG regen). Guards: civilian h1 never "Airfield", h1 ≠
>   name, render + fallback tests. Site gates green (tsc ✓ · 158 tests ·
>   ESLint 0 · build ✓). Review doc: `OneDrive/Claude Code - Reference
>   Documents/Module H1 Pass Review 2026-07-18.{md,html}`.
>
> Cleared: session 7's corrupted-runway owner action (owner ruling: it was
> test data on a demo base — nothing to restore). Still open from session 7:
> parking touch long-press verify on a real device. Noticed on the site:
> `lib/modules/civilian/modifications-exemptions.ts` is fully authored but
> registered nowhere (never renders) — looks deliberately unshipped; owner
> decision queued, no action taken.

> **2026-07-18 — units + multi-standard parking (session 7).** Owner-driven,
> interactive. **10 commits** (`bf842e19`..`de99f7cc`), **all PUSHED**, tree
> clean and level with origin. Build green throughout: tsc ✓ · vitest **1713
> passed** · `npm run build` ✓. **2 migrations APPLIED to the linked DB**
> (`2026071772_bases_distance_unit`, `2026071773_usafe_32_1007_surface_set`).
> **Current HEAD: `de99f7cc`.**
>
> Shipped:
> - **Base ft/m preference** — `bases.distance_unit` (default `'ft'`); new
>   `lib/distance-units.ts` is the single feet↔unit boundary. Dimensions stay
>   STORED in feet everywhere; only display/input convert (feet is the identity
>   case, so US bases are unchanged bar thousands separators). Toggle on Base
>   Config › Runways. Applied across runway config (dims/elevations/import
>   preview), the obstruction tool + saved detail + history + PDF, and parking.
> - **Multi-standard parking clearance** — the engine now follows the base's
>   obstruction standard instead of always UFC: UFC wingtip (unchanged) · ICAO
>   Annex 14 §3.13.6 code-letter stand clearance · USAFE 32-1007 (UFC values in
>   metric + 32-1007 refs) · FAA AC 150/5300-13B Table 4-1 ADG wingtip
>   (taxilane vs taxiway). `getClearanceDetail()` is the single injection point;
>   `parkingStandardForBase()` resolves the standard. Apron-context selector,
>   sidebar reference, and PDF are all standard-aware (ICAO hides the context
>   selector; FAA relabels it). Values transcribed from the owner's source PDFs
>   and locked in `tests/parking-clearance.test.ts` (17 tests).
> - **USAFE-AFAFRICA 32-1007** added as a 4th selectable base standard
>   (`bases.obstruction_surface_set`). `getSurfaceSet` normalizes it →
>   `icao_annex14` for OBSTRUCTION (saved evals never store it; that CHECK is
>   intentionally unchanged); only parking reads the raw value to stay distinct
>   from civil ICAO.
> - Fixes: parking touch long-press "adjust" (12 px jitter threshold so the
>   aircraft context menu survives finger micro-movement — **owner to verify on
>   a device**); **runway-dimension corruption** when toggling ft/m with an
>   add/edit form open (both forms now FREEZE their unit at open, so load + save
>   round-trip in one unit).
>
> Source PDFs (ICAO Annex 14, USAFE 32-1007, FAA AC 150/5300-13B) live in
> `OneDrive/Claude Code - Reference Documents`; extraction trick saved in the
> `regulatory-reference-pdfs` memory. Deferred (owner OK'd / not requested):
> parking manual presets stay UFC feet values shown in metric; the FAA sidebar
> reference rows show published feet even on a metric base.

> **2026-07-17 — maintenance follow-up (post session 6).** Machine re-sync,
> not app development. The home clone was fast-forwarded `a97d9171` → v2.32.0
> tree, `glidepath-site` was cloned fresh into `~/glidepath-site`, and the
> redundant `OneDrive/airfield-app` clone was removed (OneDrive + `.git` is a
> corruption risk). `start-session` / `wrap-session` were updated for
> multi-machine sync — `start-session` now `git pull --ff-only`s before reading
> this file; `wrap-session` commits + pushes on exit behind a confirmation.
> Committed `8caeb733` (skill markdown only, **no app code changed**), pushed.
> **Current HEAD: `8caeb733`.**
> Heads-up for next session: (1) `node_modules` predates the fast-forward
> (2026-02-27) — run `npm install` before any `tsc`/`build`/`vitest`, or checks
> will fail on dependency mismatch, not on your work. (2) Untracked
> `public/glidepath_vector.svg` is a stray local asset (backed up to
> `../airfield-app-local-assets-backup/`) — safe to ignore or delete. The
> session-6 handoff below remains the authoritative dev state.

**Date:** 2026-07-17 (session 6 — overnight autonomous run, owner asleep)
**Branch:** `main`. **34 commits** this session (`90360dff`..`b3457a1b`),
**all PUSHED** (owner-authorized; `82170800..b3457a1b` → origin/main); tree
clean, level with origin. Owner monitors CI and owns the promote.
**Build:** verified on the final tree: tsc ✓ · lint 0 errors · vitest
**1731 passed | 0 skipped** (170 files — +363 tests / +26 test files this
session) · `npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `b3457a1b`. (The last three commits landed post-wrap: the owner
supplied the ICAO Annex 14 PDF, unblocking the arm the overnight run had
skipped — see the ICAO subsection below. The owner also removed the
superpowers plugin from `~/.claude/settings.json` mid-session; future
sessions plan directly, per memory.)
**DB:** **all 14 migrations APPLIED 2026-07-17** (owner-run via the `!`
one-liner after the permission layer correctly refused my unattended
attempts). One apply-time fix: `2026071741`'s backfill hit a 23503 FK
violation on an orphaned `saved_by_id` (deleted profile) — made orphan-safe
with an `EXISTS (profiles)` guard; exactly 1 completed check keeps
`completed_by_id` NULL and falls to the report's "Former user" fallback by
design. Verification query confirmed every expected count (30 new RLS
policies, 9 permission keys, 66-base local_regs backfill, realtime
publication membership, 342 checks backfilled, ICAO columns + widened
CHECKs + nullable runway_class). `lib/supabase/types.ts` regenerated
post-apply per its documented GENERATED+MANUAL procedure (purely additive
diff; hand-narrowings re-applied). Latest applied:
`2026071762_obstruction_evaluations_runway_class_nullable`.

---

## What shipped this session

Six features built end-to-end via subagent-driven development (per-task
implementer/reviewer subagents, per-task model selection, adversarial final
review per feature). Every commit passed the four-gate check (tsc / lint /
full vitest / build); every feature's final review verdict is **"Ready to
merge: Yes"** after its fix wave. Per-feature SDD ledgers with full review
history live untracked in `.superpowers/sdd/progress-*.md`;
`overnight-wrap-notes.md` there is the condensed morning checklist.

### Surface-set expansion (`90360dff`..`732daa4a`, 12 commits)

The owner-ruled UFC corrections shipped: encoded Class B criteria corrected
to the verified Table 3-7 values (inner horizontal 13,120 → 7,500 ft; ADCS
remodeled as one 50,000-ft trapezoid flaring 2,000 → 16,000 ft with the
horizontal portion capped at EAE + 500 ft — the owner's 25,100-ft worked
example is a passing test; outer horizontal 44,500 ft), a verified
**Air Force Class A (IFR)** criteria entry, and **Army Class B** corrected
from its false byte-copy of AF (500-ft half-widths). The evaluator caps ADCS
height at EAE + 500 at both interpolation sites; the five UFC map builders
are criteria-parameterized so each class draws at its real dimensions; a new
`lib/calculations/surface-standards.ts` registry powers a **4-standard
what-if picker** on /obstructions (AF A / AF B / Army B / FAA Part 77) with
class-aware save (`runway_class` NULL for Part 77 rows — requires migration
`2026071762` before deploy), edit-mode (set, class) pinning, and a
**Surface Evaluation Standard card** in Base Configuration → Runways that
writes the base set + all runway classes with a confirm. PDF/history/export
print a resolved Surface Standard label (never "Class null"); the §77.19
subsection lettering debt is fixed repo-wide ((a) Horizontal … (e)
Transitional); all ten UFC `ufcRef` citations were corrected to
reference-supported items during the final-review fix wave. The ICAO Annex 14 arm was skipped overnight
(the planning session never recorded the Table 4-1/4-2 transcription, and
encoding it from model memory would violate the no-fabrication rule) — then
**unblocked and built post-wrap** when the owner supplied the Annex 14 Vol I
7th Ed. PDF:

### ICAO Annex 14 arm (`24f90355`, `7a01609c` — post-wrap)

Tables 4-1/4-2/1-1 and the §4.1/§4.2/§3.4 rules were transcribed from the
owner's PDF with two independent extractions agreeing cell-for-cell
(binding source: `docs/references/icao-annex14-verified.md`, untracked like
its UFC sibling). `24f90355` landed the engine: `annex14-criteria.ts`
(metres as published, single `M_TO_FT` boundary; CAT II/III × code 1/2
throws; the as-printed CAT I code-1,2 column — no horizontal section,
3 000 m @ 2.5% then 12 000 m @ 3% — is encoded and test-locked),
`annex14-geometry.ts` (approach trapezoids, inner-horizontal stadium,
conical ring, strip-or-runway-edge transitionals, take-off climb that goes
PARALLEL after reaching final width per §4.1.26), the evaluator arm with
per-section piecewise approach heights, and the registry's fifth standard.
`7a01609c` wired the UI: per-runway `icao_*` variant plumbing on
/obstructions (exactly the `faa_approach_type` pattern), a14 map layer
toggles, detail-page legend, PDF label + phase-2 caveat, and wizard ICAO
selectors (Code Number / Approach Classification / Strip Width with §3.4
hint defaults). Phase 1 honesty per the spec: inner approach, inner
transitional, and balked landing are NOT evaluated — the CAT I–III caveat
renders on the page and PDF. One documented judgment call: the PDF's caveat
prints for every ICAO row (saved rows don't persist the classification, so
precision-only gating isn't re-derivable there); the on-page caveat is
precisely precision-gated. Every encoded value traces to the reference doc
("NATO requirements" per the owner's request — the standard itself is ICAO
Annex 14, which NATO airfields apply, and the in-app label stays
"ICAO Annex 14" per the approved spec).

### NAMO/NAMT attribution groundwork (`66e9a46e`)

Phase A of the report tool, landed early so history accrues from apply-day:
staged permission `reports:user_activity` (leadership-only; amops excluded
by design), `airfield_checks.completed_by_id` with a deterministic same-row
backfill from `saved_by_id` (verified sound: drafts are deleted, never
promoted, so `saved_by_id` on completed rows is always the completer), NOT
VALID profile FKs on the QRC/wildlife actor columns, and `createCheck` now
writes `completed_by_id` (the offline `check_file` path inherits it).

### Flight Planning Room Check module (`4e71bdac`..`83890e54`, 6 commits)

New opt-in USAF module at `/fpr`, SCN-patterned: per-shift today cards from
`getActiveShifts`, a 3-state check modal (Satisfactory / Issue / N/A,
required issue notes, quick-fill), 30-day history, monthly PDF, a Base Setup
wizard checklist tab with editable per-base items ("suggested starting
point" seeds — no DAFMAN citations anywhere per the regulatory-honesty
stance), and a manual page. Saves route through the **offline queue**
(`fpr_save`, upsert by (base, date, shift) so replay is idempotent) with the
AF Form 3616 Events Log entry written by the queue handler after actual
persistence — deliberately not by the CRUD module (house rule) nor at
enqueue time. The final review caught an SCN-inherited **Critical**: editing
a historical check rewrote *today's* natural key. Fixed (modal carries its
check's date), along with snapshot-preserving edit drafts and a
retriable-save reclassification. **SCN shares the same three bugs verbatim
and still needs its own fix wave** (Known issues).

### Airfield Driving Spot Check module (`dcf3c74a`..`18cefa42`, 4 commits)

The former "483 Check log", renamed per the owner's 2026-07-17 ruling —
"Airfield Driving Spot Check" everywhere user-facing ("43 Check" survives
only as search keywords). New opt-in USAF module at `/driving-checks`:
Start Spot Check mobile modal (driver identification + contractor lookup
prefill from `airfield_contractors`, AF Form 483 segmented verification,
vehicle incl. POV pass, locally-editable check items with required
discrepancy notes, location datalist from base areas, live computed outcome
with a violation flag requiring description), filterable history + stat
strip, an AOB-ready date-range PDF (pass rate, common discrepancies,
by-checker table), wizard items tab, manual page. It is an unbounded event
log (plain inserts, no natural key) with typed driver columns. Review fixes
worth knowing: `updateDrivingCheck` structurally cannot reassign checker
attribution (a typo fix by another user no longer moves checks between
AOB by-checker rows), and create/update assemble their return from insert
responses (no re-fetch → no duplicate-on-transient-retry window).

### Local Regulations Review module (`ad4d31af`..`17c1ade9`, 5 commits)

"Base Regs" — a third tab on `/regulations` (deep-linkable, self-gated):
base admins upload local regulation PDFs (25 MB, PDF-only, versioned with
an optimistic replace lock); a required-reviewer roster re-reviews each doc
on a per-doc monthly/quarterly day-based cadence with QRC-parity status
semantics (`updated` beats `overdue`; re-upload resets everyone's cycle —
enforced by an RLS version-equality insert policy from inception, plus a
base_id-pin hardening added while the migration was still staged); a red
due-dot rides the Reference Library sidebar entry (gated on module
enablement AND permission — /regulations is ALWAYS_ON, so the permission
alone would strand an unclearable dot); attests route through the offline
queue with stale-version drains failing NonRetriable *by design* (the doc
changed; the user must re-review the new edition — surfaced with honest
"updated to a new edition" copy, not a permission error). The compliance
PDF includes an **Archived (history)** section (the final review caught
archived docs vanishing from the report the spec promised they'd stay in).
The staged tables migration also adds both tables to the
`supabase_realtime` publication (guarded DO-blocks) — without it the
promised realtime badge would silently never fire.

### NAMO/NAMT Report Tool (`392e6ade`..`1c66209b`, 4 commits)

The report UI over Phase A's attribution: `/reports/user-activity` behind
the staged `reports:user_activity` permission (pre-apply, everyone sees the
access notice — correct). Nine-domain picker (per-domain checkboxes disabled
with a "requires view access" note when the viewer lacks that module's view
permission), users × domains matrix with Unlinked ("unlinked" chip) and
Unattributed ("Former user") sections, drill-down from memory, coverage
footnotes ("N record(s) … lack per-user attribution" — worded to match what
the count actually measures), landscape PDF + Excel (Summary + per-domain
drill-down sheets) + EmailPdfModal delivery, all consuming only the
snapshotted generated data so exports can never desync from the preview.
The data layer **throws on any domain fetch failure** rather than rendering
silent zeros — a leadership count is all-or-nothing. Final-review fixes:
a cleared date input could brick Generate (stuck spinner), and the two
DATE-column domains (strikes, daily reviews) counted one extra calendar day
because day-strings were sliced from UTC boundaries — the picker's local day
strings are now threaded through, and the test that had locked the wrong
behavior in was rewritten with both-direction UTC± assertions.

## Migrations status

**All 14 STAGED, none applied.** Apply in this order with
`npx supabase db query --linked --file supabase/migrations/<file>` (never
`db push`), then run each file's header verification queries, then
regenerate `lib/supabase/types.ts` (retires the session's additive
hand-patches and untyped-client idioms).

| File | Status | What it does |
|---|---|---|
| `2026071720_fpr_permissions.sql` | Applied 2026-07-17 | fpr:view/write/manage_checklist + grants (note: atc gets view — confirm) |
| `2026071721_fpr_tables.sql` | Applied 2026-07-17 | fpr_checklist_items / fpr_checks / fpr_check_results + matrix RLS |
| `2026071730_local_regs_permissions.sql` | Applied 2026-07-17 | local_regs:view/manage + grants (civilian-roster broadening left open — see header) |
| `2026071731_local_regs_tables.sql` | Applied 2026-07-17 | local_regulations / local_regulation_reviews + version-equality & base-pinned RLS + realtime publication membership |
| `2026071732_local_regs_storage.sql` | Applied 2026-07-17 | private `local-regulations` bucket + path-scoped policies |
| `2026071733_local_regs_enable_module.sql` | Applied 2026-07-17 | **owner-row UPDATE**: enabled_modules backfill (module is default-on) |
| `2026071740_namo_namt_report_permission.sql` | Applied 2026-07-17 | reports:user_activity + leadership grants (civilian grants flagged in header — confirm) |
| `2026071741_checks_completed_by_id.sql` | Applied 2026-07-17 | completed_by_id + deterministic backfill + partial index — **apply before deploying** (createCheck writes it) |
| `2026071742_attribution_profile_fks.sql` | Applied 2026-07-17 | NOT VALID profile FKs on QRC/wildlife actor columns |
| `2026071750_driving_check_permissions.sql` | Applied 2026-07-17 | driving_checks:view/write/manage_items + grants (no kiosk/atc — driver PII) |
| `2026071751_driving_check_tables.sql` | Applied 2026-07-17 | driving_check_items / driving_checks / driving_check_results + matrix RLS |
| `2026071760_surface_set_icao_annex14.sql` | Applied 2026-07-17 | widen surface-set CHECKs to include icao_annex14 — **now live-code-required** (the ICAO arm shipped post-wrap) |
| `2026071761_runways_icao_classification.sql` | Applied 2026-07-17 | nullable icao_* columns on base_runways — **now live-code-required** (wizard writes them) |
| `2026071762_obstruction_evaluations_runway_class_nullable.sql` | Applied 2026-07-17 | runway_class nullable + CHECK widened to A/B/Army_B (name-independent DO-block drop) — **apply before deploying** (Part 77 saves write NULL; Army what-if saves violate the old CHECK) |

## Bugs fixed during the session

All caught by the review loop before any user saw them; listed because each
is a class future sessions should watch for.

| Symptom | Root cause | Commit |
|---|---|---|
| Save after switching the what-if standard could persist Class-B numbers labeled Class A | picker change never invalidated `multiAnalysis`; save columns derived from live state, results from the last run | `caab85e3` |
| Edits never persisted `runway_class` (and would have silently reclassified legacy rows once classes mattered) | `updateObstructionEvaluation` never accepted the column; edit-load pinned the set but not the class | `11efbad7` |
| Editing a historical FPR check overwrote today's check + logged a false completion | modal discarded the edited check's date; save hardcoded `todayZuluDate()` (SCN-inherited) | `83890e54` |
| FPR edit after a template change silently dropped snapshot rows | draft builder seeded from active items only; delete-and-rewrite then removed orphans | `83890e54` |
| A typo fix by another user moved a driving check between AOB by-checker rows | update path routed attribution through the shared payload builder | `351dccd3` |
| Transient re-fetch failure after a committed driving-check save could duplicate the check on queue retry | post-insert re-fetch error classified retriable on a no-natural-key INSERT | `351dccd3` |
| Disabling the Local Regs module left a stuck, unclearable red sidebar dot | badge gated on permission only; /regulations is ALWAYS_ON so the dot has no module-gated nav item to hide with | `527516e1` |
| Archived local regs vanished from the compliance report the UI promised they'd stay in | report passed active docs only | `17c1ade9` |
| Clearing a date input bricked the report Generate button (stuck spinner) | boundary conversion threw outside the try, after `setLoading(true)` | `1c66209b` |
| Wildlife-strike / daily-review counts included one extra calendar day | DATE-column day-strings sliced from UTC boundaries, not the picker's local days; a test locked the bug in | `1c66209b` |

## Lessons from this session

- **The per-task + final-review loop earns its cost**: ten bugs above, all
  invisible to tsc/tests-as-written, several in compliance-record paths.
  The final reviews (fable) caught cross-task classes the per-task reviews
  structurally could not (SCN-inheritance, always-on-nav interactions,
  test-locked wrong behavior).
- **Unattended sessions cannot touch the prod DB** — the permission
  classifier blocks it, correctly. The staged-files + morning-apply pattern
  worked well; migrations got extra hardening precisely because they were
  still editable at review time (name-independent constraint drops,
  realtime publication membership, base-pinned RLS).
- **"Mirror the sibling" propagates bugs as faithfully as features.** FPR
  inherited SCN's history-edit bug; DSC nearly inherited FPR's re-fetch
  pattern minus the upsert that made it safe; read-file's archived-report
  gap resurfaced in Local Regs. When cloning a module, diff the template's
  known defects first (SCN fix wave is now queued debt).
- **A test can lock a bug in** — the DATE-boundary test asserted the wrong
  day and read as coverage. Boundary tests need both-direction (UTC±)
  fixtures.
- **Repo RLS suites are live-DB integration tests**, not SQL replays —
  they cannot cover staged tables; static SQL-parsing guards are the
  staged-phase substitute, live coverage extends post-apply.
- Two transient agent API 500s and one Windows build-worker crash
  (0xC0000142) — all recovered by resume/re-run; nothing environmental
  outstanding.

## Known issues / tech debt

New this session (details in the module ledgers):

| Item | Severity | Notes |
|---|---|---|
| Graded-area (clear zone) widths unverified | med | Army graded half-width clamped to 500 as a consistency bound; map polygon still draws legacy 500 ft for all classes (default-off layer). Owner supplies Table 3-5 → one pass closes criteria + evaluator + map. |
| Platform read-RLS posture | info | Domain tables' SELECT policies are base-access-only (the 2026042203-06 matrix swap converted writes); per-domain :view gating is UI-level. Pre-existing, not a regression — worth a deliberate read-policy pass someday. |
| FPR/LR queued-save UI gaps | low | No "pending sync" card state (FPR); Base Regs tab has the WRITE_COMMITTED listener but FPR's today card doesn't mark queued saves. |
| majcom_rfm x driving checks | decision | Sees driver-named Events Log lines via activity_log:view but lacks driving_checks:view — grant or accept. |
| Driver-PII retention on driving_checks | decision | Spec open question; fold into Records disposition work. |
| getUser() per badge tick | low | local-regs + read-file both do an auth roundtrip per refresh; swap to session-derived id (auth-quota history). |
| UA base-switch export mislabel | low | Switching bases after Generate exports old data under the new base's header (daily-report parity); clear data on installation change. |
| Assorted per-module minors | low | Ledgered per module: picker outside-tap dismissal on the DSC phone form, expand-key collisions, em-dash/copy nits, zero-render "—" vs "0", 0-runway UFC pick, revert-toast phrasing, etc. |

Carried forward (unchanged): picker flip re-initializes the obstruction map
(pan/zoom lost) · entry-input polish bundle · evaluator transitional
`approachCutoff` unification · ShopsTab/ArffTab frozen-prop pattern · NIPR
uploads (closed) · hero redline strings · demo user on Demo AFB / KDRA
prep · proof band empty · NAVAID marker dials · QRC draft flow · demo seeds
`shift_name_*` · track-page SEO · civilian tenant status chips · status-page
weather race · account-deactivation live sessions · Selfridge 1098 dedup ·
2 unused exported types · reports "hgjhj" row · anonymous-submission gap.
Resolved and dropped: picker-note copy (`970994ea`), §77.19 `ufcRef`
lettering (`10381d8c`), encoded Class B criteria conflict (`90360dff`),
SCN twin-bug fix wave (`ae55b046`, 2026-07-18), read-file archived-report
gap (`cb074af1`, 2026-07-18).

## Next session tasks

1. **REMAINING OWNER STEPS** (migrations ✅ · types ✅ · push ✅)
   1. Watch CI, then promote when ready. On the promoted build, the named
      manual checks: 20-user NAMO/NAMT PDF render · one live report email ·
      ICAO quick-pass (wizard → ICAO standard on a test base → code 4 /
      CAT I runway → five a14 layers + caveat + PDF Surface Standard row).
   2. Post-apply follow-up: extend the live RLS suites for the fpr_*,
      driving_check_*, and local_reg* tables (ledgered); manual QA scripts
      live in each spec's §Testing (visual PDF render of a 20-user
      NAMO/NAMT report + one live Resend email are the named pre-promote
      checks).
   3. Rulings when convenient: atc fpr:view grant, civilian grants in
      `2026071740`, civilian roster for local_regs, majcom_rfm ×
      driving checks, FPR pending-sync card state.
2. **SCN twin-bug fix wave — DONE 2026-07-18** (`ae55b046`, session 8).
3. **ICAO Annex 14 — DONE post-wrap** (`24f90355` + `7a01609c`). Remaining
   ICAO phase-2 (deferred by spec, unchanged): inner approach / inner
   transitional / balked landing surfaces, code-letter-F 155 m widths, the
   1 800 m take-off variant, §4.2.9/17 variable horizontal section. Manual
   QA for the new arm: wizard → set ICAO on a test base → configure code 4
   / precision CAT I → 5 a14 layers draw, caveat note renders, evaluation
   names Annex 14 surfaces, PDF Surface Standard row + caveat correct.
4. **read-file archived-report pass — DONE 2026-07-18** (`cb074af1`,
   session 8).
5. **glidepath-site: module H1 pass — DONE 2026-07-18** (`381c3cb`,
   owner-approved, session 8). The rest of the site tier-2 list is
   unchanged: /about expansion, clip compression, scoped DB credential,
   demo-route tests, `regulation.cites` render-or-delete.
6. **Part 139 cert-audit resume** — from `.superpowers/sdd/progress.md`
   Task 2.5c (owner decision recorded 2026-07-07: additive migration for
   civilian cover fields), then 2.6, then phases 3-6.
7. **USAFE-AFAFRICA Instruction 32-1007 runway type** — implement USAFE-AFAFRICA
   Instruction 32-1007 as a selectable runway / airfield surface-evaluation type
   for USAF airfields in Europe and Africa (owner request 2026-07-17). Source PDF
   staged at `OneDrive/Claude Code - Reference Documents/usafe-afafricai32-1007.pdf`.

### Long-running carryover
Hero + coverage redline pass · SEO / rich-results · deferred audit items ·
Next 16 · civilian capture day ("prep KDRA") — owner-scheduled, unchanged.

## Build snapshot
```
airfield-app @ 7a01609c (verified post-ICAO, local): tsc ✓ · lint 0 errors ·
  vitest 1731 passed | 0 skipped (170 files — +363 tests: annex14-criteria,
  annex14-geometry, surface-criteria,
  surface-standards, ufc-surface-geometry, fpr-*, driving-check-*,
  local-regs, user-activity-* new; obstruction-evaluation, export-table-
  specs, write-queue-handlers, permission-matrix-roles, modules-config
  extended) · build ✓ · shared First Load JS 106 kB · middleware 80.8 kB.
  New routes: /fpr 8.48 kB · 198 kB First Load; /driving-checks 12.9 kB ·
  203 kB; /reports/user-activity 15.1 kB · 204 kB. Changed: /obstructions
  19.8 kB · 214 kB (from 20.2/211 — registry split); /regulations 21 kB ·
  232 kB (Base Regs tab).
glidepath-site @ 9dd00ad: untouched this session.
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-18 (session 8) | SCN twin-bug fix wave (FPR fixes ported back to the template) · Read File archived-report fix (Local Regs mirror) · glidepath-site module H1 keyword pass (30 pages, owner-approved). 2 app commits + 1 site commit, zero migrations, pushed. |
| **Unreleased** | 2026-07-18 (session 7) | Base ft/m distance-unit preference (`lib/distance-units.ts`) · multi-standard parking clearance (UFC / ICAO / USAFE 32-1007 / FAA ADG) · USAFE 32-1007 as 4th base standard · runway ft/m-toggle corruption fix. 10 commits, 2 migrations applied. |
| **Unreleased** | 2026-07-19 (session 9) | Permission rulings applied (atc/majcom) · Modifications & Exemptions civilian module (verified-PDF regulatory base, 4 migrations) · mobile form-overflow polish · status-board grid layout engine (drag + resize, every block movable, base-admin only, buffered saves). 9 commits, 8 migrations applied, +75 tests. Pushed. |
| **Unreleased** | 2026-07-17 (session 6, overnight + post-wrap) | Seven features, review-gated: surface-set expansion (Class A + corrected Class B/Army B + base standard selector) · **ICAO Annex 14 fifth standard** (owner-supplied PDF, dual-extraction-verified values, 5-standard picker) · FPR Check module · Airfield Driving Spot Check module (renamed per owner) · Local Regulations Review (Base Regs) · NAMO/NAMT attribution + Report Tool. 34 commits, all 14 migrations applied + types regenerated, +363 tests. Pushed. |
| **Unreleased** | 2026-07-17 (session 5) | Obstruction manual coordinate entry · FAA Part 77 surface polygons · three §77.19 criteria corrections · UFC Table 3-7 verified + owner rulings — surface-set expansion unblocked. 20 commits, zero migrations. |
| **Unreleased** | 2026-07-16 (session 4) | KFAR status-board save bug: fleet-wide airfield_status backfill + seed trigger (migration `2026071600`, applied) · setup-wizard import staleness fixed · autosave pill registers deletes/updates. |
| **Unreleased** | 2026-07-16 (spec planning) | Seven implementation specs · Part 77 §77.19 lettering resolved · Class B criteria mis-sourcing discovered. |
| **Unreleased** | 2026-07-16 (late) | Supabase type regen · fan-out silent-error sweep · glidepath-site 4-pass review + SEO/security · NIPR uploads closed. |
| **Unreleased** | 2026-07-16 | Two-repo code audit + remediation · RLS security-test suite wired. |
| **Unreleased** | 2026-07-15 (late) | Taxiway-step freeze fix (RDP decimation) · NIPR proxy plan (superseded). |
| **Unreleased** | 2026-07-13 | Configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP; PPR calendar; AMTR 803/1098; C2IMERA; WWA expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files
- `lib/calculations/surface-standards.ts` — 4-standard registry (options,
  labels, resolveStandard/Label, per-set legend/layers/builders).
- `lib/supabase/fpr.ts` · `lib/fpr-default-items.ts` · `lib/fpr-pdf.ts` ·
  `app/(app)/fpr/page.tsx` · `components/base-setup/fpr-checklist-tab.tsx`
- `lib/supabase/driving-checks.ts` · `lib/driving-check-default-items.ts` ·
  `lib/driving-check-pdf.ts` · `app/(app)/driving-checks/page.tsx` ·
  `components/base-setup/driving-check-items-tab.tsx`
- `lib/local-regs/review-status.ts` · `lib/supabase/local-regulations.ts` ·
  `lib/local-regs-review-pdf.ts` · `components/local-regs/base-regs-tab.tsx`
- `lib/reports/user-activity-data.ts` · `user-activity-pdf.ts` ·
  `user-activity-excel.ts` · `app/(app)/reports/user-activity/page.tsx` ·
  `components/reports/user-activity-matrix.tsx`
- `docs/manual/24_flight_planning_room.md` · `25_driving_spot_check.md` ·
  `26_local_regulations.md`
- 14 staged migrations (table above).

### Modified files
- `lib/calculations/surface-criteria.ts` / `obstructions.ts` /
  `geometry.ts` — corrected criteria, EAE+500 cap, class-aware surface
  info, criteria-driven builders.
- `app/(app)/obstructions/page.tsx` + `[id]/page.tsx` +
  `components/obstructions/airfield-map-google.tsx` — picker, pinning,
  registry wiring, standard labels.
- `app/(app)/base-config/setup/page.tsx` — standard card + two wizard tabs.
- `lib/sync/handlers.ts` — fpr_save / driving_check_save/_update /
  local_reg_review handlers (Events Log writes live here, post-persist).
- `lib/supabase/checks.ts` (completed_by_id) · `lib/permissions.ts` ·
  `lib/modules-config.ts` · `lib/sidebar-config.ts` ·
  `components/layout/sidebar-nav.tsx` · `app/(app)/more/page.tsx` ·
  `hooks/use-sidebar-badge-counts.ts` · `app/(app)/regulations/page.tsx` ·
  `app/(app)/reports/page.tsx` · `docs/manual/18_reports_analytics.md` ·
  `docs/manual/README.md` · `lib/supabase/types.ts` (additive hand-patches
  pending regen).
