# Session Handoff

**Date:** 2026-04-30
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npx vitest run` ✓ (253 pass), `npm run build` ✓
**HEAD:** `83cda74`

---

## What shipped this session

**1 commit** on `main`. Single-sweep refresh of the QRC module — `/qrc`
page + dashboard QRC dialog get the established design language, the
checkbox step model gains a Done / N/A two-state toggle (operationally
necessary for emergency response checklists), the QRC PDF gets a
ground-up visual rebuild, and two durable lessons land in `pdf-utils.ts`
+ memory so future PDF refreshes don't re-discover the bugs we hit
along the way.

The session arc was iterative — three rounds of UI feedback (white text
on amber → black text on amber → outlined-pill recipe) and three rounds
of PDF feedback (broken Unicode glyphs → bland wall of text → header
chip overlap → step row spacing overlap → sub-step indent overlap)
shaped the final form. Two memories saved to bake the rules in.

### QRC distinctive refresh + Done/N/A toggle + amber unification + PDF rewrite (`83cda74`)

The QRC sweep was the next module on the distinctive-refresh backlog.
Three concerns shaped the scope:

1. **Color was inconsistent across surfaces.** `#D97706` was hardcoded
   four times in `/qrc` while the dashboard QRC dialog used
   `var(--color-cyan)` for the same QRC-NN badge. Status pills used raw
   `rgba(...)` calls that didn't adapt to light mode (the same banner-
   class pattern the OOO/Closed fix from `dd0cfb8` documented). Decision
   per AskUserQuestion: **amber is the QRC brand color** (urgency-
   coded for emergency response), routed through `var(--color-amber)`
   so light mode adapts.

2. **Binary checkboxes don't model real emergency workflows.** Audit of
   the 25 seed QRCs found numerous steps where N/A is operationally
   meaningful (QRC-6 evac kit items, QRC-14 bird remains, QRC-15 BWC
   repeat-until logic, QRC-22 agency jurisdiction, QRC-4 reopening
   steps). An unchecked step today meant *both* "not yet done" AND
   "intentionally not applicable" — auditors couldn't distinguish.

3. **Base setup is out of scope.** Per user direction mid-plan, the two
   `#D97706` hardcodes in `settings/base-setup/page.tsx` stay until the
   future base-setup full sweep.

**Schema** — `QrcStepResponse` (in `lib/supabase/types.ts`) gains
optional `status: 'completed' | 'not_applicable'` and `agencies_na:
string[]`. No DB migration — `step_responses` is JSONB. Back-compat via
`getStepStatus()` / `getAgencyStatus()` in new `lib/qrc-step-status.ts`:
legacy executions with only `completed: boolean` continue to render as
Done. The bridge functions read `status` first and fall back to the
boolean.

**New component** — `components/ui/qrc-step-toggle.tsx` mirrors
`PfnToggle`'s visual contract (segmented border, `color-mix()` button
backgrounds, `aria-pressed`) but with a nullable state model: neither
button selected = incomplete (the default empty state). Click a selected
button again to clear back to incomplete. `QrcStepStatusPill` is the
read-only counterpart for closed QRCs. Used by both `/qrc` and the
dashboard dialog renderer. Did NOT extend or replace `PfnToggle` because
the state models are different (PfnToggle is always-selected; QRC needs
nullable). The progress denominator now subtracts N/A steps so 100%
remains reachable when half a checklist is N/A.

**`/qrc` page rewrite** — Tertiary "QUICK REACTION CHECKLISTS" header
with cyan accent rule + `Zap` icon, tightened tab pills with chip-style
count badges, bordered tile grid for available templates with amber
left rule + Lucide review-status icons (`CheckCircle2` for current,
`AlertCircle` for overdue/never), Active/History list rows with amber
left accent for OPEN + slate for CLOSED + colored status pills via
`color-mix()`, execution view header with `ArrowLeft` back link + amber
QRC chip + status pill + opened/closed metadata, banner-tier warning
block (4px danger left rule + `AlertOctagon` icon) for template notes,
progress bar with `CheckCircle2` accent at 100%, bordered cyan-rule
SCN form section, bordered tile for the Annual Review block with
`Calendar` + `CheckCircle2`/`AlertCircle` status icons, action button
cluster with Lucide everywhere (`CheckCircle2`/`X`/`RotateCcw`/
`FileDown`/`Mail`). The `✉` glyph is finally gone.

**Dashboard QRC dialog** — Same color tokens applied (amber QRC-NN
badges, `color-mix()` warning + active row backgrounds), same step-
toggle integration. The dialog stays a slim modal (no full visual
refresh — different presentation than the full page). The `AlertOctagon`
icon was added to the warning block to match the on-page treatment.

**PDF generator rewrite** (`lib/qrc-pdf.ts`) — The previous `[✓]` /
`[☐]` glyphs didn't render in jsPDF's default Helvetica (the screenshot
showed empty brackets / random `&` characters). Swapped for filled
rounded rect status pills drawn directly with `roundedRect()` + text
inside (DONE green / N/A gray / outlined empty). Added cyan accent
header band with base name, amber QRC chip + bold `EXECUTION REPORT`
title, mini progress bar in the info box, color-coded per-row left
rules (green for done, light gray for incomplete or N/A), italic amber
warning blocks for conditional steps (no fake checkbox — they were
rendering with broken `[& ]` symbols before), cyan-rule narrative
blocks for `text` / `textarea` step types, boxed step notes with subtle
gray fill, split Notified vs N/A agency lists with `getTextWidth()`-
based prefix offsets so labels don't crash into values, footer
separator line.

### Lessons captured to memory + pdf-utils.ts

Two rounds of color feedback narrowed the QRC-NN badge to the
**outlined-pill recipe** — amber-tinted bg via `color-mix()` + amber
border + amber text. Filled amber backgrounds read poorly with any text
color (white fails contrast at ~2.0:1, black passes on paper but reads
chromatically muddy in browser). Saved as
`feedback_amber_text_contrast.md` so the next sweep knows.

Two rounds of PDF spacing feedback narrowed to a **y-coordinate
convention** — jsPDF text uses baseline y, rects use top y, mixing them
without care produces silent overlap. Three constants exported from
`lib/pdf-utils.ts` (`STEP_ROW_GAP_MM = 6`, `BLOCK_POST_SPACING_MM = 6`,
`TEXT_CAP_HEIGHT_9PT_MM = 3`, `ROW_INNER_GAP_MM = 2`) plus a documented
convention block at the top of the file. Saved as
`feedback_pdf_y_coords.md` so future PDF refreshes inherit the rule
instead of re-discovering it. The QRC PDF imports the constants
in-file as the first concrete adopter.

The on-screen sub-step indent moved from `depth * 20` to `depth * 44`
+ `marginTop: 6` because the parent's number column (12 padding + 30
minWidth = 42px) was wider than the indent — sub-step card borders
visually cut through where the parent's "N." stamp was, AND the first
sub-step had no top gap so its border merged with the parent card's
bottom border.

---

## Migrations status

No new migrations this session. Migration `2026042907` from the prior
session is the latest applied to prod.

| Migration | Status | What it does |
|---|---|---|
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) DROP + ADD `airfield_checks_check_type_check` to allow `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu` + recreates `submit_public_ppr_request` RPC. |

---

## Bugs / friction fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| QRC PDF rendered `[✓]` / `[☐]` as empty brackets, sometimes `[& ]` | jsPDF's default Helvetica doesn't carry the `✓` (check mark) or `☐` (ballot box) glyphs — silent missing-glyph fallback | `83cda74` (replaced text symbols with rendered status pills) |
| White text on amber QRC-NN badge had ~2.0:1 contrast (fails WCAG AA) | Filled `var(--color-amber)` background pairs poorly with any text color regardless of theme | `83cda74` (outlined-pill recipe — tinted bg + amber border + amber text) |
| QRC PDF header chip overlapped the cyan accent rule above it | The cyan rule was 14mm tall, then `y += 16`, then chip drawn at `y - 4` — chip top landed at `margin + 12`, inside the rule's vertical range (margin to margin + 14) | `83cda74` (chip drawn with `y` as top edge, header advance bumped) |
| Sub-step row left rule landed at the same y as the previous conditional/text block's bottom edge | `y += blockH + 3` post-spacing was too tight — next row's rule starts at `(y) - 3`, so anything < 5mm of post-spacing causes the rule to touch | `83cda74` (`+ BLOCK_POST_SPACING_MM` = 6mm; codified the rule in `pdf-utils.ts`) |
| `/qrc` sub-step card border visually cut through the parent's "N." stamp | Sub-step indent of `depth * 20` was less than the parent's number column width (12 padding + 30 minWidth = 42), AND first sub-step had no `marginTop` so its border merged with parent card's bottom | `83cda74` (`depth * 44` + `marginTop: 6`) |

---

## Lessons from this session

- **`color-mix()` + outlined-pill > filled brand color for branded chips
  on bright-yellow-range fills.** Filled amber backgrounds have bad
  contrast with white (fails AA) and read muddy with black. The
  established `StatusPill` recipe (tinted bg + matching border + colored
  text) reads cleanly in both themes and matches the existing visual
  language. Tile/row prominence comes from the accent left rule, not
  the chip. Saved as feedback memory.
- **jsPDF coordinate convention is a footgun.** Text APIs use baseline
  y, rect APIs use top y. The transition between them is invisible in
  the source and silent in the output — overlaps just appear in the PDF
  with no warning. Always treat `y` as "next element's top edge" and
  add cap-height when drawing text. Always verify post-element spacing
  is ≥ 5mm when the next element extends above its cursor for cap-
  height alignment. Saved as feedback memory + spacing constants in
  `pdf-utils.ts`.
- **Type checks pass overlap bugs through.** `tsc --noEmit` and
  `vitest` are blind to PDF geometry — only visual smoke catches it.
  In auto mode, ship the change and ask for a screenshot rather than
  claiming the PDF is verified.
- **Tri-state semantic > binary checkbox for audit forms.** The QRC
  `Done / N/A` decision matched the same logic that drove the
  `/inspections` `PfnToggle` extraction last session. When operators
  need to distinguish "not yet done" from "deliberately skipped,"
  binary state encodes ambiguity that auditors can't resolve later.
  This pattern is now in three places (Construction Check, Daily
  Inspections, QRC) — next time it shows up, default to tri-state.
- **Sub-component indent must clear the parent's content column.** When
  rendering a tree (sub-steps under steps), the indent in pixels must
  exceed the parent's leftmost content column width so the child's
  outline doesn't visually intersect the parent's stamp area. For a
  parent with `padding-left: 12` + `minWidth: 30` number column, the
  child's `marginLeft` must be ≥ 42px. AND the first child needs a
  small `marginTop` so its border doesn't merge with the parent's
  bottom border.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **`/inspections/construction/new` + `/inspections/joint-monthly/new` pre-refresh** | Open (next session candidate) | Carryover from 2026-04-29. Personnel-attendance forms; lower daily traffic. ~520 LOC combined. |
| **Base setup QRC tab still on `#D97706` hardcodes** | Open (deferred) | Two badge sites at `settings/base-setup/page.tsx:3493, 3606`. Will land in the future base-setup full sweep — not worth a one-off PR. |
| **Untracked `dark logo.jpg`** | Low | 2.4MB JPG sits in `/public` from prior logo experiment. Carryover. |
| **Untracked `docs/DEMO_LOGINS.md`** | Low | Carryover. User to decide whether to commit. |
| **Untracked `.claude/`** | Low | Local Claude Code settings (gitignored expectation). Carryover. |
| **Three+ zombie node processes hold ports 3000–3003** | Low (user-side) | Dev server landed on port 3004 today. Sandbox can't kill PIDs. Suggest `taskkill /F /IM node.exe` at session start tomorrow. |
| **Discrepancy "Notes History" backfill** | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; rendering rewrites on display. |
| **Visual NAVAIDs further perf** | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume when "Color by health" is on, audit-mode panel. |
| **Sequential PPR coordination** | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| **Public PPR form file uploads** | Deferred (carryover) | Out of scope unless requested. |
| **"Advisories" → "WWA Notifications" UI sweep** | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |

---

## Next session tasks

The distinctive-refresh sweep continues. Modules done so far:
`/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections`
(daily-ops set), `/qrc`.

**Recommended next pick — `/inspections/construction/new` +
`/inspections/joint-monthly/new`** (carryover from 2026-04-29, ~520
LOC combined). Finishes the inspections module. Personnel-attendance
forms with no checklist UI; the established design language applies
straightforwardly.

After that:

- `/notams` — shorter module, good variety
- `/wildlife` — sighting/strike forms; the BASH heatmap is a Mapbox
  holdout (out of scope for visual refresh)
- Batch sweep: `/waivers`, `/contractors`, `/obstructions`, `/scn` —
  smaller modules, polish together

Held until later (multi-session work each):

- `/infrastructure` (~4.1k LOC) — Visual NAVAIDs
- `/parking` (~4.3k LOC) — multi-select editor + map + clearance sidebar
- `/settings/base-setup` (~4.7k LOC) — 15-step wizard (will pick up the
  two QRC `#D97706` hardcodes during this sweep)

The new `<QrcStepToggle>` from `components/ui/qrc-step-toggle.tsx` is
ready for any other audit form that needs a nullable Done/N/A
semantic — distinct from `PfnToggle` (always-selected three-state).

The `STEP_ROW_GAP_MM` / `BLOCK_POST_SPACING_MM` / `TEXT_CAP_HEIGHT_9PT_MM`
constants from `lib/pdf-utils.ts` are now the canonical PDF spacing
values. Use them when refreshing or writing any new generator. The
y-coord convention block at the top of `pdf-utils.ts` documents the
trap to avoid.

### Long-running carryover from prior sessions

Pick from these only when bandwidth allows or a customer asks:

- Offline reads for QRC + Regulations.
- Component extraction for 4K+ LOC pages (`base-setup`, `parking`,
  `infrastructure`).
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian template.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged from prior session)
Build: npm run build clean — no warnings, no errors.
No new migrations.

Notable First Load JS (changed routes this session):
  /qrc                     9.08 kB / 184 kB  (was ~10.5 kB / 184 kB)
  /dashboard              13.9 kB / 205 kB   (slight +0.8 kB from QRC dialog refresh)

Largest static page (unchanged): /wildlife 454 kB / 788 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-30 (this session) | QRC distinctive refresh: amber-unified colors via outlined-pill recipe, Done/N/A two-state step toggle + schema bridge for back-compat, full PDF rewrite (status pills replace broken Unicode glyphs, color-coded row rules, italic warning blocks for conditional steps, mini progress bar). pdf-utils.ts gains spacing constants + y-coord convention. Two feedback memories pinned. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections` daily-ops set. Construction + Other check types added (FAA 11-item P/F/N/A checklist; required Reason for Other). Shared `<PfnToggle>` extracted between Checks and Inspections. Light-mode fixes for OOO/Closed banners. PPR spine ETA dropped (custom time columns now). 16 commits, two migrations applied. |
| **Unreleased** | 2026-04-29 (prior) | PPR per-surface visibility (3 flags replace `is_public`), per-column `time_display`, public form ETA optional, Airfield Status base-local-today filter, type-scale shrink (desktop + tablet headings), PPR Columns row redesign (chip clusters, drop redundant arrows). 4 commits. |
| **Unreleased** | 2026-04-28 (cont.) | Capabilities doc v2.32 + FOD Check terminology, discrepancy notes humanization, Visual NAVAIDs zoom stabilization, Training nav rename, CLAUDE.md drift fixes. 6 commits. |
| **Unreleased** | 2026-04-28 | PPR commercial phone + ETA Zulu spine, soft-cancel + email, AMOPS delete/approve perms, manual-coord-pending, slim Log, ACSI per-member signature toggle, sidebar badge polling cuts. Four migrations. |
| **Unreleased** | 2026-04-27 (cont.) | Denial email, AMOPS reply-to format check, PPR PDF coord/status section, no-coord triage warning, OI refresh, public form date echo, atomic PPR# counter, storage RLS path scoping, sidebar badge fixes. |
| **Unreleased** | 2026-04-27 | PPR remarks, info-only columns, ICAO-based URL, sidebar pending dots, agency coordinators, deny-on-review, base-setup drag-reorder, Events Log filter. |
| **Unreleased** | 2026-04-26 | PPR public form + AMOPS-triaged multi-agency coordination, requester emails, full UI/UX iteration. |
| **Unreleased** | 2026-04-25 (cont.) | Offline write queue: foundation + 12 wraps + inspector + pending photos. |
| **Unreleased** | 2026-04-25 | iOS PWA fixes, airfield diagram upload rewrite, OFFLINE pill, codebase primer, Workbox runtime caching for offline reads. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `components/ui/qrc-step-toggle.tsx` — Done/N/A 2-button segmented
  toggle + read-only status pill, mirrors PfnToggle visual contract
  with nullable state model
- `lib/qrc-step-status.ts` — `getStepStatus()` + `getAgencyStatus()`
  helpers bridging legacy `completed: boolean` ↔ new
  `status: 'completed' | 'not_applicable'`

### Modified files

- `app/(app)/qrc/page.tsx` — full distinctive refresh, amber outlined-
  pill QRC-NN badges, color-mix() status pills, Lucide icons throughout,
  Done/N/A toggle integration, sub-step indent + gap fixes
- `app/(app)/dashboard/page.tsx` — QRC dialog: amber badges, color-mix
  warning + active row, AlertOctagon, Done/N/A toggle parity
- `lib/qrc-pdf.ts` — full rewrite: filled rounded-rect status pills
  replace broken Unicode glyphs, color-coded per-row left rules, italic
  amber warning blocks for conditional steps, cyan-rule narrative
  blocks, boxed step notes, split Notified/N/A agency lists, header
  band + amber chip + mini progress bar
- `lib/pdf-utils.ts` — added Y-coord convention doc block + four
  spacing constants (`STEP_ROW_GAP_MM`, `BLOCK_POST_SPACING_MM`,
  `TEXT_CAP_HEIGHT_9PT_MM`, `ROW_INNER_GAP_MM`)
- `lib/supabase/types.ts` — `QrcStepResponse` gains optional `status`
  + `agencies_na` fields

---

*All changes pushed to `origin/main`. No new migrations. Two feedback
memories saved (`feedback_amber_text_contrast.md`,
`feedback_pdf_y_coords.md`) so the QRC color and PDF spacing lessons
carry into future sessions.*
