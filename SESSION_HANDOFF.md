# Session Handoff

**Date:** 2026-04-30
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `9d32a58`

---

## What shipped this session

A long, dense session. **20 commits** on `main` carrying the
distinctive-design-language sweep across the rest of the app — the
inspections / wildlife / notams / scn / contractors / obstructions /
waivers modules — plus a clutch of smaller fixes (Other-check resume
bug, sidebar collapse toggle, discrepancy detail layout, DetailGrid
upgrade). The campaign that started in late April is now functionally
complete across every primary user-facing route. The remaining
untouched pages are admin / reports / public-auth (catalogued in the
"Next session tasks" section below).

The sweep landed three cross-cutting wins beyond chrome refresh:

1. **Caught a latent bug in /scn** — `${SCN_STATUS_COLORS[s]}55`
   shadow concat silently broke when the source map was tokenized to
   `var(--color-*)`. The outlined-pill rebuild fixes a broken active
   state that had been shipping since the token migration landed.
2. **Migrated 3 shared constant maps** in `lib/constants.ts`:
   `CONTRACTOR_STATUS_CONFIG`, `WAIVER_STATUS_CONFIG`,
   `WAIVER_HAZARD_RATINGS`. All hex pairs swap to `var(--color-*)` +
   `color-mix()` so light mode now adapts. `WAIVER_CLASSIFICATIONS`
   gains an `iconKey` field consumed by the detail/new/edit pages
   (Lock / Clock / Construction / Calendar / RefreshCw / FileEdit
   replace 🔒 ⏳ 🏗️ 📅 🔄 📝).
3. **Discovered + fixed a wall-of-text regression** in
   `/waivers/[id]` Overview by upgrading the shared `DetailGrid`
   component to bordered tile chrome. Six detail pages benefit.

### Inspections forms refresh + Other-check resume bug (`407ce03`, `5549cc6`)

Carryover from the prior session. `/inspections/construction/new` +
`/inspections/joint-monthly/new` got the established design language
in `407ce03` — tertiary header (HardHat for construction,
ClipboardCheck for joint), `var(--color-amber)` / `var(--color-blue)`
replacing hardcoded hex, `color-mix()` recipe replacing
`rgba(56,189,248,...)` for personnel selection rows.

`5549cc6` fixed a real bug surfaced during smoke-testing: the
"Other" check Reason wasn't persisting on resume. Root cause was
`buildDraftSnapshot()` in `app/(app)/checks/page.tsx` omitting
`constructionItems` and `otherSubject` from the returned object,
even though both were in the dependency array. TS missed it because
both fields are `?` optional in `CheckDraft`. Same bug had been
silently dropping Construction-check checklist state on auto-save.
The b007aea belt-and-suspenders save still ran — but the next
auto-save tick overwrote localStorage with a stripped snapshot. One-
line fix: add both fields to the snapshot literal.

### Discrepancy detail 2-col stretched grid (`20688a8`)

Inner detail grid was using `auto-fit minmax(160px, 1fr)` which
produced 3-4 narrow columns on a typical viewport — long labels
("Work Order Assigned to") wrapped, and the whole left section
ended up shorter than the map+photos column. Changed to fixed 2-col
with `gridAutoRows: 1fr`, `alignItems: stretch`, plus
`whiteSpace: nowrap + ellipsis` on labels. The recipe was reused on
this session's later DetailGrid upgrade.

### Sidebar collapse toggle (`7c8fc4c`)

The collapse toggle was orphaned in its own row below the logo +
tagline. Floated it absolutely in the top-right corner of the
sidebar header when expanded; collapsed state unchanged.

### NOTAMs module sweep (`3f8f40e`)

All three NOTAM routes (list / detail / new) on the design language.
List page: tertiary `Megaphone` header + cyan rule, FAA feed status
card color-codes by connection state (success / danger), refresh
swapped to Lucide `RefreshCw`, source-coded card left rules (cyan
FAA / purple LOCAL / gray expired / danger expiring), the `✉`
envelope glyph + `↻` refresh glyph are gone. Detail page: source-
tracking accent rule, theme-token colors, tile-style info grid.
New page: tertiary header + ArrowLeft + CheckCircle2 on Save Draft.

### Wildlife/BASH module sweep (5 commits — `e319f17` through `b497480`)

Five-commit arc covering the page chrome, the heatmap (chrome only
— Mapbox layers untouched), analytics + report panels, sighting +
strike forms + species picker, plus a card-grouped restructure of
both forms after user feedback that the flat field stack felt
congested.

`e319f17` did the page chrome: tertiary `Bird` header + amber rule
(BASH = bird hazard, urgency-coded), outlined-pill `+ Sighting` /
`+ Strike` action buttons (Eye / Zap icons), pill-style segmented
tabs matching QRC + NOTAMs, activity log rows with type-coded left
rule + Lucide-iconed tinted squares replacing 👁️ / 💥 emoji.

`f9356a9` did the forms + species picker — tertiary headers
(Eye for sighting, Zap for strike), GPS / Map button SVG → Lucide
`Crosshair` / `MapPin`, action toggles + parts-struck / parts-
damaged pills on outlined-pill recipe, classification star → Lucide
`Star`. Filed mode (BASH alert + risk pill + submit button) all
moved to outlined-pill recipe.

`956af94` did the analytics + report tabs. `BWC_COLORS` map values
routed through tokens (semantic tier mapping preserved). Four
KPI cards on color-coded outlined-pill chrome with Lucide icons
replacing 👁️💥📢✓. Section headers tertiary tier-label
(BarChart3 / Award / Layers / Clock / FileText / Map).

`5d9f123` did the heatmap chrome — filter bar tertiary header,
density legend gradient routed through theme tokens (Mapbox paint
config explicitly preserved with comment), tertiary footer. Bonus:
deleted `wildlife-heatmap-google.tsx` (191 LOC) — confirmed dead
code, leftover from the half-done Google Maps migration.

`c284eb9` moved Pin Location to the top of both forms after the
user noted the embedded map mid-form looked weird.

`b497480` was the polish pass. The user's exact feedback: "looks
too congested for a polish and professional looking input form."
Six (sighting) / seven (strike) bordered cards group related fields
with Lucide-iconed bold uppercase headers; field labels relax to
sentence-case `text-3` for two-tier hierarchy. Field rendering /
validation / submit logic unchanged.

### Batch sweep — /scn, /contractors, /obstructions, /waivers (8 commits)

8-commit slice plan executed cleanly:

- `3b8e731` /scn — fixed the latent `${color}55` shadow concat bug
  via outlined-pill rebuild. Backup vs Daily check chips gain
  purple/cyan tokens.
- `0955bf1` /contractors + `CONTRACTOR_STATUS_CONFIG` constants
  migration. Active count badge, Mark Completed, Save Template all
  on outlined-pill recipe.
- `5677cee` /obstructions list — tertiary `AlertTriangle` header,
  GPS inline SVG → Lucide `Crosshair`, `⚠️/✅` violation/clear
  emojis → Lucide `AlertCircle`/`CheckCircle2`, surface result
  badges and taxiway WITHIN OFA pill on `color-mix()`. Google Maps
  + `s.color` overlay coloring untouched per plan.
- `06d9037` /obstructions detail + history — `📄/✉/🔍` →
  `FileDown/Mail/Search`, history page Map/List toggle on outlined-
  pill cyan, evaluation cards get type-coded left rule (3px
  danger/success). Critical preservation: the `SURFACE_COLORS` map
  in `[id]/page.tsx` (UFC 3-260-01 imaginary-surface legend)
  stays verbatim hex — semantic + backend-mapped + reference-tied.
- `d6b9f78` /waivers list — `FileWarning` header, KPI cards
  (Permanent/Temporary/Expiring/Overdue) gain outlined-pill chrome
  with token colors, `+ New Waiver` filled gradient → outlined cyan
  with `Plus` icon.
- `01d3d8d` /waivers detail + `WAIVER_STATUS_CONFIG` /
  `WAIVER_HAZARD_RATINGS` / `WAIVER_CLASSIFICATIONS` constants
  migration. Constants migration is the load-bearing piece — every
  consumer (list page Badge component, detail page status pill,
  hazard pills, classification chip) keeps working transparently
  because the shape stays identical and the Badge component already
  auto-applies `color-mix()` when given `var(--color-*)`. The
  `iconKey` field on WAIVER_CLASSIFICATIONS gets resolved through
  small `CLASSIFICATION_ICON` maps at each rendering site to keep
  `lib/constants.ts` free of React imports.
- `cb75a45` /waivers new + edit — both forms get tertiary headers,
  classification dropdown picks up Lucide icons via `iconKey`,
  Action Requested pills + + Add Criteria buttons on outlined-pill
  recipe.
- `eb55da5` /waivers annual-review — tertiary `Calendar` header,
  KPI cards with outlined-pill chrome, year nav arrows replace
  `&larr;/&rarr;` HTML entities with Lucide `ChevronLeft/Right`,
  per-waiver classification chip uses Lucide icon, Remove Review
  button on outlined-pill danger.

### DetailGrid bordered tile upgrade (`9d32a58`)

User fed back that `/waivers/[id]` Overview read as a wall of text —
16 label/value pairs in a 2-col grid with no visual separation.
Fix: lift the tile chrome from the discrepancy detail (`20688a8`)
into the shared `DetailGrid` component. Each cell now renders as
its own bordered tile with `color-mix()` cyan left rule + `bg-inset`
interior + `whiteSpace: nowrap` clipped uppercase label + `weight-
500 fs-md` value. Six detail pages benefit at once: `/waivers/[id]`,
`/obstructions/[id]`, `/discrepancies/[id]` (already had its own
inline tiled grid — unchanged), `/inspections/[id]`, `/checks/[id]`,
`/aircraft`. Default `gap` 10 → 8 for tighter rhythm.

### Sweep audit + handoff backlog

End-of-session: explored every untouched page-level file across
`app/(app)/`, `app/(public)/`, `app/feedback/`, scoring each by
"refresh signal count" (HTML entity back-arrows, `var(--fs-2xl)`
page titles, raw `rgba()`, hex literals, emoji-as-icon, inline
SVGs, filled-bright buttons). The result is in **Next session
tasks** below — about 19 commits of work remaining across 14
single-page modules + 5 report subpages + held multi-session work.

---

## Migrations status

No new migrations this session. Migration `2026042907` from the
prior session is still the latest applied to prod.

| Migration | Status | What it does |
|---|---|---|
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) DROP + ADD `airfield_checks_check_type_check` to allow `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu` + recreates `submit_public_ppr_request` RPC. |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Other-check Reason vanished on resume | `buildDraftSnapshot()` returned object missing `constructionItems` + `otherSubject`; both were in deps array but not in the literal. TS missed it because both fields are `?` optional in `CheckDraft`. Auto-save tick overwrote the immediate-save belt-and-suspenders write. Same bug silently dropped Construction-check checklist state. | `5549cc6` |
| `/scn` AgencyRow status grid active state showed nothing | `${SCN_STATUS_COLORS[s]}55` box-shadow string concat broke after `SCN_STATUS_COLORS` values were tokenized to `var(--color-*)` — concatenating "55" to "var(--color-success)" gives invalid CSS. Had been shipping broken since the token migration. | `3b8e731` |
| Discrepancy detail tiles wrapped labels + left side shorter than right | Inner grid `auto-fit minmax(160px, 1fr)` produced 3-4 narrow columns on a typical viewport; outer grid `alignItems: 'start'` left columns mis-matched in height. | `20688a8` |
| Waiver Overview read as wall of text | DetailGrid component had no per-cell chrome — just flat label/value pairs in a `gap: 10` grid. | `9d32a58` |

---

## Lessons from this session

- **String concatenation onto CSS-token values is a silent footgun.**
  The `${SCN_STATUS_COLORS[s]}55` pattern works for hex literals
  (yields `#XXXXXX55`) and breaks for `var()` (yields invalid CSS
  with no console warning). Same trap snared the
  `${classInfo.color}14` pattern in waivers list pre-refresh. Anywhere
  a config map gets tokenized, sweep callsites for hex-alpha concat
  first. The fix is always `color-mix(in srgb, ${val} X%, transparent)`
  which works against either input.
- **Optional fields + spread literals + dependency arrays = silent
  drops.** `buildDraftSnapshot()` had the right deps but the wrong
  spread. The TS contract (`CheckDraft` with `?` optional fields)
  accepts both correct and broken outputs as valid. When auto-save
  state drops on a single field, look for spread/dep mismatches in
  the snapshot builder.
- **Shared component upgrades cascade for free.** Lifting tile chrome
  into `DetailGrid` improved 6 detail pages with one commit. When
  fixing visual issues on one page, ask whether the underlying
  primitive is shared and whether the fix belongs there. (Same
  principle applied earlier when `Badge` started auto-applying
  `color-mix()` — every consumer adapted instantly.)
- **Constants migrations are transparent when the shape doesn't
  change.** `WAIVER_STATUS_CONFIG` consumers all kept working through
  the hex → token swap because `{ color, bg, label }` shape stayed
  identical and the `Badge` component already accepted `var()`
  values. The hidden risk is hex-alpha string concat (above) — if
  you're considering a migration like this, grep for
  `\$\{.*\.color\}` first.
- **Card grouping > flat stack for forms with > ~8 fields.** The
  wildlife forms feedback was unambiguous: a stack of similar-weight
  field labels reads as a wall, even when the chrome is otherwise
  clean. The fix is two-tier hierarchy — bold uppercase tier-label
  card headers above, lighter sub-labels inside. This pattern is now
  proven on QRC, NOTAMs, the wildlife forms, and the waiver
  forms; codify it as the default for any form ≥ 8 fields.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Audit identified ~14 untouched single-page modules** | Low | See Next Session Tasks. Smaller chrome work each, but cumulatively a 2-session sweep. |
| **`/login` filled-cyan gradient + white text** | Low (cosmetic) | 657 LOC. Highest-impact public surface (every user). Top of next-session tier 1. |
| **`/regulations` is the single-largest unrefreshed page** | Low | 800 LOC, 5 refresh signals (highest count). |
| **/infrastructure, /parking, /settings/base-setup** | Held | All 4K+ LOC. Multi-session each. Held until customer or rollout asks. |
| **Untracked `dark logo.jpg`** | Low | 2.4MB JPG sits in `/public` from prior logo experiment. Carryover. |
| **Untracked `docs/DEMO_LOGINS.md`** | Low | Carryover. |
| **Untracked `.claude/`** | Low | Local Claude Code settings (gitignored expectation). Carryover. |
| **Trademark** | Low | CDW holds live "GLIDEPATH" Class 42 (SaaS) registration — risk for commercial use. |
| **Discrepancy "Notes History" backfill** | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; rendering rewrites on display. |
| **Visual NAVAIDs further perf** | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume, audit-mode panel. |
| **Sequential PPR coordination** | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| **Public PPR form file uploads** | Deferred (carryover) | Out of scope unless requested. |
| **"Advisories" → "WWA Notifications" UI sweep** | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| **~124 `as any` casts project-wide** | Low | Was 182. Mostly residual; codebase shape gradually getting tighter. |
| **PDF boilerplate duplication in 11 generators** | Low | 5 already on `pdf-utils.ts`. Not worth forcing — see `feedback_pdf_utility.md`. |
| **Check draft real-time sync deferred** | Low | Two users could create duplicate drafts. |

---

## Next session tasks

**The distinctive-refresh sweep is functionally complete across every
high-traffic user-facing route.** What remains is admin / reports /
public-auth chrome — lower traffic but still worth bringing onto
the design language. Audit grouping below, with refresh-signal counts
in parens (higher = more out-of-spec):

### Tier 1 — Public-facing auth (every user sees these)

1. **`/login`** (657 LOC, signal: 3) — filled-cyan-gradient sign-in
   button + `#fff` text. The single most-seen page in the app and
   still on the pre-sweep aesthetic.
2. **`/reset-password`** (240 LOC, signal: 2) + **`/setup-account`**
   (242 LOC, signal: 2) — paired auth forms. Bundle in one commit.
3. **`/feedback/[baseId]`** (~100 LOC, signal: 1) — public QR form.

### Tier 2 — Daily-traffic operations

4. **`/regulations`** (800 LOC, signal: 5) — top signal count of
   any untouched page; filled-gradient tabs + `#fff`, `var(--fs-2xl)`,
   inline SVG in PDF viewer toggle.
5. **`/aircraft`** (500 LOC, signal: 4) — `#34D399`/`#EF4444` hex
   literals, `var(--fs-2xl)` headers. The DetailGrid upgrade in
   `9d32a58` already lifted parts of this; rest is page chrome.
6. **`/ces`** (400 LOC, signal: 3) — CES role landing.
   `rgba(34,211,238,0.12)` + `var(--fs-2xl)`.
7. **`/shift-checklist`** (350 LOC, signal: 3) — minimal chrome,
   inline checkbox SVG in button.
8. **`/recent-activity`** (600 LOC, signal: 3) — `#FBBF24`/`#334155`
   hex for stars, filled-bright filter pills.

### Tier 3 — Lower-traffic / smaller chrome

9. **`/training`** (1,100 LOC, signal: 4) — `var(--fs-2xl)` +
   filled-bright buttons. Already uses `ArrowLeft`. Largest of the
   untouched non-held set.
10. **`/acsi/page.tsx`** (300 LOC) + **`acsi/[id]`** (499 LOC) +
    **`acsi/new`** (806 LOC) — 1.6K LOC across 3 files. Mostly clean
    already; just `var(--fs-2xl)` headers.
11. **`/daily-reviews`** (170 LOC, signal: 1) — header only.
12. **`/users`** (555 LOC, signal: 1) — header only.
13. **`/more`** (292 LOC, signal: 2) — replace 📡 / 📊 / etc. emoji
    nav icons with Lucide.
14. **`/feedback`** staff page (400 LOC, signal: 1) — `#FBBF24` star
    cosmetic + filled buttons.

### Tier 4 — Reports module (small chrome each)

15. **`/reports/daily`** + **`reports/aging`** + **`reports/discrepancies`**
    + **`reports/trends`** + **`reports/lighting`** — 327–470 LOC each.
    Most already use `ArrowLeft` and color-mix; just header + minor
    chrome. Bundle as one commit.

### Held — explicitly out of scope (multi-session each)

- **`/infrastructure`** (~4.1K LOC) — Visual NAVAIDs.
- **`/parking`** (~4.3K LOC) — multi-select editor + map + clearance
  sidebar.
- **`/settings/base-setup`** (~4.7K LOC) — 15-step config wizard.
  Includes the `#D97706` QRC tab hardcodes flagged from the QRC sweep.
- **`/settings/page.tsx`** (~1.5K LOC) — already largely on the
  language; just `var(--fs-2xl)` header to fix. Bundle with the
  base-setup pass when that ships.

### Long-running carryover from prior sessions

Pick from these only when bandwidth allows or a customer asks:

- Offline reads for QRC + Regulations.
- Component extraction for 4K+ LOC pages (`base-setup`, `parking`,
  `infrastructure`).
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian template.
- "Advisories" → "WWA Notifications" UI sweep.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged from prior session)
Build: npm run build clean — no warnings, no errors.
No new migrations.

Notable First Load JS (changed routes this session):
  /scn                      9.94 kB / 181 kB
  /contractors             10.6 kB  / 191 kB
  /obstructions            17.8 kB  / 182 kB
  /obstructions/[id]       11.8 kB  / 328 kB
  /obstructions/history     9.52 kB / 163 kB
  /waivers                  3.67 kB / 187 kB
  /waivers/[id]            10.3 kB  / 207 kB
  /waivers/[id]/edit        7.73 kB / 191 kB
  /waivers/new              8.65 kB / 184 kB
  /waivers/annual-review/[year]  4.83 kB / 197 kB
  /notams                   6.84 kB / 177 kB
  /notams/[id]              4.86 kB / 104 kB
  /notams/new               2.36 kB / 113 kB
  /wildlife               458 kB    / 793 kB
  /inspections/construction/new  6.26 kB / 191 kB
  /inspections/joint-monthly/new 6.23 kB / 191 kB
  /discrepancies/[id]       8.28 kB / 213 kB

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-30 (this session) | Distinctive-refresh sweep finished across every high-traffic route: Inspections (construction + joint monthly), NOTAMs (3 routes), Wildlife (5-commit arc covering page + heatmap + analytics + report + forms), /scn, /contractors, /obstructions (3 routes), /waivers (5 routes + constants migration). DetailGrid upgraded to bordered tiles — 6 detail pages benefit. Bug fixes: Other-check Reason resume, /scn AgencyRow active state, discrepancy detail layout. 20 commits. |
| **Unreleased** | 2026-04-30 (prior, same day) | QRC distinctive refresh: amber-unified colors via outlined-pill recipe, Done/N/A two-state step toggle + schema bridge for back-compat, full PDF rewrite (status pills replace broken Unicode glyphs, color-coded row rules, italic warning blocks for conditional steps, mini progress bar). pdf-utils.ts gains spacing constants + y-coord convention. Two feedback memories pinned. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections` daily-ops set. Construction + Other check types added. Shared `<PfnToggle>` extracted. Light-mode fixes for OOO/Closed banners. PPR spine ETA dropped. 16 commits, two migrations applied. |
| **Unreleased** | 2026-04-29 (prior) | PPR per-surface visibility, per-column `time_display`, public form ETA optional, Airfield Status base-local-today filter, type-scale shrink. 4 commits. |
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

### Modified files

- `app/(app)/checks/page.tsx` — `buildDraftSnapshot` resume bug fix
- `app/(app)/contractors/page.tsx` — distinctive refresh
- `app/(app)/discrepancies/[id]/page.tsx` — 2-col stretched detail grid
- `app/(app)/inspections/construction/new/page.tsx` — distinctive refresh
- `app/(app)/inspections/joint-monthly/new/page.tsx` — distinctive refresh
- `app/(app)/notams/page.tsx` + `[id]/page.tsx` + `new/page.tsx` — distinctive refresh
- `app/(app)/obstructions/page.tsx` + `[id]/page.tsx` + `history/page.tsx` — distinctive refresh
- `app/(app)/scn/page.tsx` — distinctive refresh + latent bug fix
- `app/(app)/waivers/page.tsx` + `[id]/page.tsx` + `[id]/edit/page.tsx` + `new/page.tsx` + `annual-review/[year]/page.tsx` — distinctive refresh
- `app/(app)/wildlife/page.tsx` — distinctive refresh
- `components/wildlife/sighting-form.tsx` + `strike-form.tsx` + `species-picker.tsx` + `wildlife-analytics.tsx` + `wildlife-heatmap.tsx` + `wildlife-report.tsx` — distinctive refresh
- `components/layout/sidebar-nav.tsx` — collapse toggle position
- `components/ui/detail-grid.tsx` — bordered tile chrome upgrade
- `lib/constants.ts` — `CONTRACTOR_STATUS_CONFIG`, `WAIVER_STATUS_CONFIG`,
  `WAIVER_HAZARD_RATINGS`, `WAIVER_CLASSIFICATIONS` (+`iconKey` field)

### Deleted files

- `components/wildlife/wildlife-heatmap-google.tsx` — confirmed dead
  code, leftover from half-done Google Maps migration.

---

*All changes pushed to `origin/main`. No new migrations. The
distinctive-refresh sweep across high-traffic routes is now
complete; what remains is the audit-derived backlog of admin /
reports / auth pages catalogued in Next Session Tasks.*
