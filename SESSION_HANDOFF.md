# Session Handoff

**Date:** 2026-07-17 (session 5 — started 2026-07-16 evening)
**Branch:** `main`. **20 commits** this session (`dbdde930`..`c9c4f955`), all
**pushed**; tree clean, level with origin.
**Build:** verified at wrap on the final tree: tsc ✓ · lint 0 errors · vitest
**1368 passed | 0 skipped** (144 files — +107 tests / +4 test files this
session) · `npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `c9c4f955`.
**DB:** no new migrations — both features shipped zero-migration; latest
applied remains `2026071600_seed_airfield_status_rows`.

---

## What shipped this session

Two features built end-to-end via subagent-driven development (per-task
implementer/reviewer subagents with per-task model selection, final
whole-branch reviews), plus the complete regulatory verification that
unblocks the surface-set expansion build. Every commit passed the four-gate
check (tsc / lint / full vitest / build) before landing; both features'
final review verdicts were "Ready to merge: Yes."

### Obstruction manual coordinate entry (`dbdde930`, `d7c73f6e`, `8ffc4b11`, `6ee581cd`, `fce9abee`)

Users can now type coordinates into `/obstructions` instead of tapping the
map. `lib/calculations/coordinates.ts` is a pure auto-detecting parser
(DD / DDM / DMS / packed FAA-NOTAM / MGRS via the new zero-dep `mgrs@2.2.0`
package) plus four formatters; `components/ui/coordinate-entry-input.tsx`
is a generic smart-parse field (live format preview, specific validation
errors, Place Pin / Enter commit) designed for later reuse by
wildlife/discrepancy pickers. The page wiring reuses the existing
flyTo→pin→elevation pipeline unchanged (typed point ≡ map tap), replaces
the Selected Location coordinates cell with a DD/DMS/DDM/MGRS stack with
per-line copy — killing the hardcoded `°N`/`°W` bug there and in the PDF —
and adds a >30 NM advisory toast on typed entry. Review process caught the
formatters' 60.0-carry defect class (seconds in `formatDMS`, then the final
review caught the sibling minutes edge in `formatDDM` — a point ~9 m below
an integer degree line rendered `60.00'` that the module's own parser
rejected on copy-paste). Both fixed with carry logic + tests.

### UFC 3-260-01 verification + owner rulings (`974e95a7`, `4706f841`, `50fa4e71`, `fad18868`, `a3f4a384`, `b6d36b97` — doc-only)

The owner supplied UFC 3-260-01 **Change 3 (4 Feb 2026)** pages (Figure
3-17/3-19, Table 3-7 items 1–15, the table NOTES, glossary content) and
ruled on every open question blocking the surface-set expansion build:

- **Correct the encoded Class B criteria to the UFC values** (inner
  horizontal 13,120 → 7,500 ft — the encoded value is the ICAO 4,000 m;
  ADCS half-width schedule 1,000 → 4,500 → 8,000 ft).
- **ADCS geometry, final:** horizontal portion at **EAE + 500 ft** (item 11
  as printed, both classes); slope (50:1 B / 40:1 A) runs **from the nearest
  threshold's elevation** to EAE + 500, so its length varies per Note 4
  (owner worked example: EAE 380 / threshold 378 → 25,100 ft); total ADCS
  length **50,000 ft both classes** (Class A confirmed by the owner's
  constant-splay derivation; two earlier readings were superseded en route —
  see the reference doc's history). The evaluator already baselines the
  slope on threshold elevation (`obstructions.ts` approach_departure
  branch), so the expansion build only adds the EAE+500 horizontal cap +
  the value corrections.
- **Conical / outer horizontal (glossary, class-invariant, fixed-wing
  only):** conical 20:1 from the inner horizontal's edge, 7,000-ft extent;
  outer horizontal 500 ft × 30,000 ft beyond the conical. Derivation rule:
  no inner horizontal → no conical → no outer horizontal (Class A VFR has
  only primary + sloped ADCS + transitionals).
- **What-if picker offers all five standards** — confirmed.

Full transcription with provenance lives in
`docs/references/ufc-3-260-01-table3-7-verified.md` — **untracked**
(`docs/references/` is gitignored); the spec carries the resolution
summaries. **The surface-set expansion build has zero open blockers.**

### FAA Part 77 surface polygons (`a2ab1eab`, `675f7f2c`, `99a78a16`, `2a1cfad2`, `18ec7535`, `9dc2a250`, `392cfdc4`, `436bf1ee`, `c9c4f955`)

Civilian/Part 77 bases previously saw §77.19 numbers next to a map drawing
UFC-only surfaces at UFC dimensions. Now the obstruction map draws the
active set: per-runway §77.19 surfaces (primary, approach trapezoids
dimensioned by each runway's `faa_approach_type` with the precision
50:1→40:1 break line, transitionals, per-runway horizontal/conical
stadiums, shared runway outline) from the new pure builder module
`lib/calculations/part77-geometry.ts`; per-set legend/toggles with live
overlay swap on the picker; set-aware page header, `identifySurface`
(defaulted 5th param — existing callers untouched), and
`withinApproachDeparture` key; edit-load pins the row's `surface_set` into
state (plus an `editId` guard on the installation-reseed effect — without
it a cold edit-URL load could clobber the pinned set and *persist the
wrong `surface_set` on save*); PDF prints a Surface Set row instead of a
meaningless UFC runway class for Part 77 rows; the base-config FAA
approach selectors unlock for USAF bases whose `obstruction_surface_set`
is `faa_part77`. Prerequisite commits corrected three verified §77.19
mis-encodings in the engine criteria (approach outer width 2,000 → 3,500 ft
for non-precision >¾ mi; horizontal radius 10,000 → 5,000 ft for visual
non-utility; primary 500 → 1,000 ft + approach/transitional mirrors for the
≤¾-mi category — **the engine default for unconfigured runways**, so future
evaluations there change; that is the point). Values verified against the
live CFR (law.cornell.edu fetches, verbatim quotes in provenance comments);
a new invariant test locks approach-inner = primary across all six types.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071600_seed_airfield_status_rows.sql` | Applied 2026-07-16 | Prior latest — airfield_status backfill + seed trigger |
| (this session) | — | Both features zero-migration by design; spec-assigned ranges `20260716xx` still reserved for the remaining builds (renumber to implementation date) |

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Selected Location + PDF showed `°N/°W` for every hemisphere | hardcoded hemisphere strings, `Math.abs(lon)` | `6ee581cd` |
| formatDMS/formatDDM could render `60.0"`/`60.00'` fields their own parser rejects | `toFixed` rounding with no carry into minutes/degrees | `d7c73f6e`, `fce9abee` |
| Part 77 approach drawn/evaluated at 2,000-ft outer width (should be 3,500), visual non-utility horizontal at 10,000 ft (should be 5,000), ≤¾-mi primary at 500 ft (should be 1,000) | criteria table mis-encodings vs §77.19 — verified against live CFR text | `a2ab1eab`, `675f7f2c` |
| Editing a saved Part 77 evaluation recomputed/rendered under UFC | page never passed `surfaceSet` on edit re-eval; no state pin existed; reseed effect could clobber a pin on cold loads (and persist the wrong `surface_set` on save) | `9dc2a250`, `392cfdc4` |
| Runway pavement outline vanished under Part 77 overlays | Part 77 branch omitted the shared `runway` layer (spec listed it as shared) | `c9c4f955` |

## Lessons from this session

- **Owner's standing ruling: encode verified regulatory values.** When an
  encoded criterion conflicts with the verified publication (UFC Table 3-7,
  §77.19), correct it — changed evaluation results are the point, not a
  risk to avoid. Verbatim source quotes go in provenance comments.
- **The ADCS construction is the constant-splay method**: the sloped run's
  widths set the splay; the horizontal portion continues at that splay to
  the end width; totals are implicit, never printed. The horizontal
  portion's elevation datum is EAE; the slope's datum is the nearest
  threshold (already implemented in the evaluator).
- **Table 3-7 has no conical/outer-horizontal rows** — they're
  class-invariant and live in the glossary. Don't go hunting the table for
  them again.
- **Brief-authoring bugs are a real failure mode of SDD** — two briefs this
  session asserted code state that didn't exist (a test point actually
  inside the UFC clear zone; a `setSurfaceSet` call that was never there).
  Implementer deviation reports + reviewer adjudication caught both; keep
  briefs' claims about existing code verifiable and expect pushback.
- **Per-task model selection worked**: opus for dense logic/integration and
  their reviews, sonnet for well-specified components/wiring, fable for
  final whole-branch reviews. The two review-loop Importants (edit-mode
  clobber, runway outline) were both caught by reviewers one tier above
  the "it compiles" bar. (saved as feedback memory)
- **`docs/references/` is gitignored** — the UFC verified-values
  transcription lives there untracked; the committed spec carries the
  binding summaries. Don't `git add` that directory; do keep load-bearing
  conclusions in the spec.

## Known issues / tech debt

New (accepted debt from the two feature reviews — details in
`.superpowers/sdd/progress-manual-coordinates.md` / `progress-part77.md`):

| Item | Severity | Notes |
|---|---|---|
| Picker flip re-initializes the whole map (pan/zoom lost, tile flash) | low | Brief-directed effect-deps design; split-effect refactor candidate. Check feel during in-browser QA. |
| Picker-note fallback copy promises a base surface-set control that doesn't exist yet | low | Becomes true when the expansion build ships the standard selector (its natural home). Make the copy accurate there. |
| Entry-input polish bundle (MGRS mid-typing red flicker on odd digit counts; `kind` discriminant on parser errors; literal MGRS-error test; aria-live on the status line) | low | Do together when the component is reused by wildlife/discrepancy pickers. |
| `ufcRef` §77.19 lettering strings still wrong (incl. one "(non-utility)" label on the corrected visual radius; also sweep `part77-geometry.ts` section-header comments) | med | Fix is specced in the surface-set expansion build — verified lettering: (a) Horizontal (b) Conical (c) Primary (d) Approach (e) Transitional. |
| Evaluator's transitional `approachCutoff` unclamped vs builder's clamped formula | low | Identical for all six real types; unify in the expansion registry refactor. |

Carried forward (unchanged): encoded UFC Class B criteria conflict — **now
owner-ruled, fix ships with the expansion build** · ShopsTab/ArffTab
frozen-prop pattern · NIPR uploads (closed, don't re-propose) · hero
redline strings · demo user on Demo AFB / KDRA prep · proof band empty ·
NAVAID marker dials · QRC draft flow · demo seeds `shift_name_*` ·
track-page SEO · civilian tenant status chips · status-page weather race ·
account-deactivation live sessions · Selfridge 1098 dedup · 2 unused
exported types · reports "hgjhj" row · anonymous-submission gap.

## glidepath-site — remaining roadmap

Unchanged from the prior handoff (no site work this session): owner
preview-checks the CSP then promotes (CI green at `9dd00ad`); this-month
tier-2 items (module H1 pass, /about expansion, clip compression, scoped
DB credential, demo-route tests, `regulation.cites`); this-quarter traffic
engine; www→apex 308.

## Next session tasks

1. **Owner in-browser QA + promote** — both features are pushed but not
   deployed. Manual QA scripts live in the two specs' §Testing sections
   (manual coordinates: typed ≡ tap equivalence, mobile keyboard, edit
   mode, packed-NOTAM round-trip; Part 77: overlay swap, per-type
   trapezoids, amber note, edit-mode parity, USAF-flip selectors, both
   PDFs). Known feel item: picker flip re-centers the map.
2. **Build the surface-set expansion**
   (`docs/superpowers/specs/2026-07-16-airfield-surface-set-expansion-design.md`)
   — **fully unblocked**; every dimension verified or owner-ruled (§13
   items resolved in place; full derivations in the untracked
   `docs/references/ufc-3-260-01-table3-7-verified.md`). Includes: Class B
   corrections + ADCS horizontal-portion model (changes future evaluation
   results fleet-wide — owner-approved), Class A entry, ICAO Annex 14 set,
   5-standard picker, §77.19 lettering fix, base-level standard selector
   (also fixes the picker-note copy), migrations `20260716xx` →
   renumber.
3. **Then per the specs index build order**: NAMO/NAMT attribution
   migrations early (`2026071641`–`42` equivalents) · FPR Check · 43 Check
   log · local regs review · NAMO/NAMT report UI.
4. **glidepath-site**: owner CSP preview-check + promote; then next tier-2/3
   item (DAFMAN 13-204 hub or module H1 pass).
5. **Civilian capture day** (owner-scheduled): "prep KDRA" → run
   `docs/references/civilian-capture-plan.md`.

### Long-running carryover
Hero + coverage redline pass · Part 139 cert-inspection audit build (resume
from `.superpowers/sdd/progress.md`) · SEO / rich-results · deferred audit
items · Next 16 — owner-scheduled, unchanged.

## Build snapshot
```
airfield-app @ c9c4f955 (verified at wrap, local): tsc ✓ · lint 0 errors ·
  vitest 1368 passed | 0 skipped (144 files — +107 tests: coordinates,
  coordinate-entry-input, part77-geometry, obstruction-pdf new; part77-
  surfaces, obstruction-evaluation, pdf-generators-smoke extended) ·
  build ✓ · shared First Load JS 106 kB · middleware 80.8 kB.
  /obstructions 20.2 kB · 211 kB First Load (grew this session: entry
  input + four-format display + set-aware map branch; mgrs adds ~6 kB to
  the obstruction chunks only).
glidepath-site @ 9dd00ad: unchanged this session (tsc/lint/CI green as of
  session 4).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-17 (session 5) | Obstruction manual coordinate entry (DD/DDM/DMS/NOTAM/MGRS smart-parse field, four-format display + copy, hemisphere fixes) · FAA Part 77 surface polygons (set-aware map/legend/header/PDF, per-runway §77.19 dimensioning, base-config gate) · three verified §77.19 criteria corrections · UFC Table 3-7 fully verified + owner rulings recorded — surface-set expansion unblocked. 20 commits, zero migrations. |
| **Unreleased** | 2026-07-16 (session 4) | KFAR status-board save bug: 37/64 bases had no `airfield_status` row — fleet-wide backfill + seed trigger (migration `2026071600`, applied) · setup-wizard import staleness fixed · autosave pill registers deletes/updates · +2 invariant tests. |
| **Unreleased** | 2026-07-16 (spec planning) | Seven implementation specs in `docs/superpowers/specs/` · Part 77 §77.19 lettering resolved · Class B criteria mis-sourcing discovered. |
| **Unreleased** | 2026-07-16 (late) | Supabase type regen (43 casts removed) · fan-out silent-error sweep (27 sites) · glidepath-site 4-pass review + SEO/security tier-1/2 · NIPR uploads closed as DISA-CBII-blocked. |
| **Unreleased** | 2026-07-16 | Two-repo code audit + remediation · RLS security-test suite wired (0 skipped). |
| **Unreleased** | 2026-07-15 (late) | Taxiway-step freeze fix (RDP decimation) · NIPR proxy plan (superseded). |
| **Unreleased** | 2026-07-13 | Configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP; PPR calendar; AMTR 803/1098; C2IMERA; WWA expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files
- `lib/calculations/coordinates.ts` — coordinate parser + four formatters.
- `components/ui/coordinate-entry-input.tsx` — generic smart-parse entry field.
- `lib/calculations/part77-geometry.ts` — §77.19 plan-view polygon builders.
- `docs/references/ufc-3-260-01-table3-7-verified.md` — **untracked**
  (gitignored dir): verified Table 3-7 transcription + ADCS derivation +
  glossary values.
- `.superpowers/sdd/progress-manual-coordinates.md` / `progress-part77.md` —
  SDD ledgers (untracked), accepted-debt lists live here.

### Modified files
- `app/(app)/obstructions/page.tsx` — entry field wiring, four-format
  display, distance toast, set-aware header/calls/keys, edit-load pin +
  reseed guard, conditional picker note.
- `components/obstructions/airfield-map-google.tsx` — surface-set renderer
  branch, per-set legends/toggles, runway outline in both sets.
- `lib/calculations/obstructions.ts` — three §77.19 criteria corrections +
  set-aware `identifySurface`.
- `lib/obstruction-pdf.ts` — hemisphere fix + set-aware Surface Set row.
- `app/(app)/base-config/setup/page.tsx` — FAA approach-selector gate
  widening only.
- `docs/manual/10_obstructions.md` — typed-coordinates + set-aware overlay
  sections.
- `docs/superpowers/specs/2026-07-16-airfield-surface-set-expansion-design.md`
  — all §13 blockers resolved in place (owner rulings + verified values).
- `package.json` — `mgrs@2.2.0`.
