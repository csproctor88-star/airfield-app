# Session Handoff

**Date:** 2026-07-07
**Branch:** `main`, **fully pushed and clean** (HEAD `d2d414e5`, CI run #27 green).
This session built the **Part 139 certification-inspection readiness audit** end
to end via subagent-driven-development, then pushed. **Not promoted** — owner owns
promotion, and should visually verify the form/detail/PDF on a civilian base first.
`glidepath-site` unchanged/live (`3688a57`).
**Build:** `airfield-app` @ `d2d414e5`: tsc ✓ · lint 0 errors (2 pre-existing
warnings in `lib/waiver-pdf.ts`, not this work) · `npx vitest run` **1127 passed /
16 skipped** ✓ · `npm run build` ✓. **CI:** run #27 `d2d414e5` ✅ success.
**HEAD:** `airfield-app` `d2d414e5` · `glidepath-site` `3688a57`.
**DB:** migration `2026070700_add_part139_cover_fields` applied to the linked DB.
**Task-by-task detail:** `.superpowers/sdd/progress.md`. Design/plan:
`docs/superpowers/specs|plans/2026-07-06-part139-cert-inspection-audit-*`.

---

## What shipped this session

The civilian (`airport_type = 'faa_part139'`) `/acsi` module was repurposed from
the USAF ACSI into an **annual Part 139 certification-inspection *readiness
audit*** — a self-audit that mirrors the FAA's own annual certification inspection
("prepare, don't perform"), so an airport can walk the same checks the FAA Airport
Safety Inspector does before the visit. It reproduces **FAA Form 5280-4** (the
inspector's Airport Certification/Safety Inspection Checklist). This is distinct
from the daily self-inspection (§139.327 / AC 150/5200-18C), which `/checks`
already covers — that distinction is *why* the first "civilian ACSI checklist
swap" spec was superseded mid-brainstorm. Built in 6 review-gated phases, ~21
feature commits, every task implemented + reviewed by fresh subagents. The USAF
ACSI path is **verified byte-for-byte unchanged** throughout — everything branches
on `getAirportType`.

### Phase 1 — data foundation (`fc1481d8`..`e1f9b4cc`)
`lib/part139-cert-checklist.ts` (new): `PART139_CERT_SECTIONS` — 22 sections / 123
items transcribed verbatim from Form 5280-4, each item carrying its exact 14 CFR
sub-paragraph in `citation`. `AcsiChecklistItem` gained optional `citation?` /
`guidance?` (USAF array unaffected). `sectionsForAirportType()` selects the array
by mode; `sectionMetaById()` resolves a stored record's section by its namespaced
`section_id` (`p139-*` vs `acsi-*`) so historical USAF records are immune to a base
later flipping mode. `PART139_TEAM_ROLES` added.

### Phase 2 — wiring + persistence (`997c968c`..`f4ca36e4`)
Mode-selected the shared machinery: `acsiDraftToItems(draft, sections)` and
`createNewAcsiDraft(mode)` (civilian team, no risk-cert signatures); `AcsiItem`
gained `responseLabels` (S/U/N-A vs Y/N/N-A) + citation + a collapsible guidance
disclosure; `AcsiTeamEditor` role labels + required-count made mode-aware (the plan
mis-stated this as an `ACSI_TEAM_ROLES` import swap — it was actually a hardcoded
`roleLabels`/`i<3` fix); discrepancy panel's "Risk Control Measure" → "Corrective
Action"; `AcsiSection` tallies → S/U. `/acsi/new` and `/acsi/[id]` render the
civilian audit (record-derived `isFaa`), hide risk-cert, show cover fields,
calendar-year default. **Cover-field persistence** (`2.5c`/`2.5d`): a review caught
that `arff_index`/`airport_class`/`inspector` lived only in `draft_data` (nulled on
file) and were also dropped by `reopenAcsiInspection` — fixed with an additive
migration + threading through save/file/fetch/reopen.

### Phases 3–4 — inspector guidance (`4303dd8e`..`a9499652`)
All **123 items** carry "what the inspector looks for" guidance transcribed from
**FAA Order 5280.5D** — Chapter 4 §§4.9–4.30 plus the Appendix H enhanced ARFF
checklist. Delivered in 5 batches (physical airfield / records-personnel-manual /
programs ×2 / obstructions-etc / ARFF), each **fidelity-reviewed against the source
Order sentence-by-sentence — zero fabrication**. Sparse/ambiguous source passages
were disclosed and handled faithfully (real general-duty text, never invented).

### Phase 5 — Form 5280-4 PDF (`0335479e`)
`lib/acsi-pdf.ts` civilian branch: Form 5280-4 header (skip-if-null cover fields),
a 5-column Facility/Condition · S · U · N/A · Remarks table, no risk-cert, no
guidance printed. Review proved the USAF PDF path has **zero changed lines** in its
~235-line table loop. Smoke test `tests/acsi-pdf.test.ts` (civilian + USAF).

### Phase 6 — module copy + verify (`7214192a`)
`lib/modules-config.ts` `acsi` description/useCase neutralized to dual-mode copy
(`appliesTo` untouched — that broke CI a prior session). Final full gate green.

---

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026070700_add_part139_cover_fields` | **Applied** (linked DB, verified) | additive nullable `arff_index`/`airport_class`/`inspector` on `acsi_inspections` for the Form 5280-4 header; RLS inherits the table's base-scoped policies |

Prior migrations (`2026070204`, `2026070400`, `2026070401`) unchanged/applied.

---

## Bugs fixed / gaps caught in review

| Symptom | Root cause | Commit |
|---|---|---|
| civilian cover fields would vanish from *filed* audits + PDF | stored only in `draft_data`, which `fileAcsiInspection` nulls on file — no real columns | `721aaa4a`+`a94d937a` |
| reopen→refile would silently null the cover fields | `reopenAcsiInspection`'s `rebuiltDraft` omitted the 3 fields | `2f82a536` |
| civilian team member showed "Additional Member -2", wrong required-count | team editor hardcoded `afm/ce/safety` labels + `i<3` required-by-index | `242463a5` |

---

## Lessons from this session

- **Delegate-transcribe + fidelity-review holds the no-fabrication line.** ~123
  regulatory guidance strings were transcribed by subagents and each batch verified
  by a reviewer that read the source Order and checked every string — zero
  fabrication across the whole run. The pattern (strict source-only dispatch,
  page-referenced, + a source-reading review) is reusable for any reg-text work.
- **A transient `API Error: Overloaded` can kill a subagent *after* it commits.**
  Task 3.2's implementer committed `c6590a36` then died on its report message.
  Recovery = check `git log`/`git status` + re-verify (tsc/tests) rather than
  re-dispatch; the commit was intact. Watch for this on long subagent runs.
- **Two Part 139 "inspections" are different things.** The airport's daily
  self-inspection (§139.327, AC 150/5200-18C) ≠ the FAA's annual certification
  inspection (Form 5280-4, Order 5280.5D). The daily one is `/checks`; the annual
  cert-readiness audit is civilian `/acsi`. Getting the source doc right (Form
  5280-4, not AC 18C) is what made the module tailored to the real FAA visit.
- **The SDD ledger (`.superpowers/sdd/progress.md`) is the durable spine** for a
  20+-task build across one long session — commit SHAs + decisions + in-flight
  notes survive even if context is summarized.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Part 139 audit — visual density unverified** | med | no PDF/HTML render harness; owner must eyeball `/acsi/new`, `/acsi/[id]`, and the Form 5280-4 PDF column widths on a civilian base |
| Guidance accuracy-pass nits | low | `aep.6` citation `§325(f)` vs the Order's prose `§325(b)(9)` (Form 5280-4 and the Order disagree — pre-existing from the item transcription); `wildlife.10` biologist gloss; `arff.7` "cannot be waived" synthesis; `msl.10` conditional tightening — all in-source, none fabricated, flagged in the ledger |
| `inspTerm` uses installation not record mode | low | `app/(app)/acsi/[id]/page.tsx:82` — a base flipping `airport_type` after filing could show a mismatched breadcrumb term vs the record-derived body |
| App-side dual-mode terminology (other modules) | med | `/discrepancies`, `/inspections`, `/checks`, `/qrc`, `/flip`, `/obstructions` still leak military terms on civilian tenants; `lib/airport-mode.ts` doesn't cover them |
| Civilian QRC templates title-only stubs | low | KDRA `qrc_templates` ×8 have "0 steps"; enrich for a richer `/qrc` frame |
| Carried low items | low | status-page weather race (`app/(app)/page.tsx:194`); demo-form email-fail-after-insert silent; account-deactivation doesn't kill live sessions (`middleware.ts:50-58`); Selfridge 1098 dedup — unchanged |

---

## Next session tasks

The Part 139 cert-audit is **pushed and CI-green**. Owner actions before it goes
live:

1. **Visually verify** on a civilian base (KDMO/KDRA): `/acsi/new` renders the
   22-section Form 5280-4 audit (S/U/N-A, civilian team, cover fields, no
   risk-cert, per-item Guidance disclosures) → file it → `/acsi/[id]` displays →
   the generated **PDF** looks right (column density is the one unverified thing).
2. **Promote** when satisfied (owner owns Vercel promotion).
3. Optional: the guidance accuracy-pass nits above; extend the civilian PDF with a
   signature block if desired (not in scope this build).

Then, older backlog (unchanged): **app-side dual-mode terminology sweep** for the
other leaking modules — mirror what ACSI/Part 139 now does.

### Long-running carryover
Phase 5 apex cutover to `app.glidepathops.com`, SEO/rich-results, deferred audit
items, Next 16 — all owner-scheduled, unchanged.

---

## Build snapshot
```
airfield-app @ d2d414e5: tsc ✓ · lint 0 errors (2 pre-existing warnings in
  lib/waiver-pdf.ts) · npx vitest run 1127 passed / 16 skipped (122 files) ·
  npm run build ✓. CI run #27 green. Part 139 cert-audit live-ready but UNPROMOTED.
  Changed routes: /acsi/new (~24 kB, the civilian audit form) and /acsi/[id]
  (mode-aware detail view). Middleware 80.8 kB. New civilian PDF path in
  lib/acsi-pdf.ts (no route-size impact). New file lib/part139-cert-checklist.ts
  (~123-item data + guidance).
```

---

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-05..07 | Marketing roster 36→50; ACSI opened to civilian + mode-aware; **Part 139 certification-inspection readiness audit** — civilian `/acsi` reproduces FAA Form 5280-4 (22 sections / 123 items, all with CFR citations + inspector guidance from Order 5280.5D), S/U/N-A, cover-field persistence (migration), Form 5280-4 PDF. Pushed, CI-green, unpromoted. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key docs / files touched this session
### New files
- `lib/part139-cert-checklist.ts` — `PART139_CERT_SECTIONS` (22 sections / 123
  items + citations + guidance), `sectionsForAirportType`, `sectionMetaById`.
- `supabase/migrations/2026070700_add_part139_cover_fields.sql`.
- `tests/part139-cert-checklist.test.ts`, `tests/acsi-pdf.test.ts`.
- `docs/superpowers/specs/2026-07-06-part139-cert-inspection-audit-design.md`
  (+ the superseded self-inspection spec), `docs/superpowers/plans/2026-07-06-part139-cert-inspection-audit.md`.

### Modified files
- `lib/constants.ts` (item fields + team roles), `lib/acsi-draft.ts`,
  `lib/acsi-pdf.ts` (civilian Form 5280-4 layout), `lib/modules-config.ts`,
  `lib/supabase/{types,acsi-inspections}.ts`, `lib/sync/handlers.ts`.
- `app/(app)/acsi/{new,[id]}/page.tsx`, `components/acsi/{acsi-item,acsi-team-editor,acsi-section,acsi-discrepancy-panel,acsi-discrepancy-panel-group}.tsx`.
