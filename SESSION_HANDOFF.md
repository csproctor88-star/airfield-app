# Session Handoff

**Date:** 2026-05-01
**Branch:** `tweaks` (not yet merged to `main`)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `d08f06d` (local; `tweaks` branch not pushed)

---

## What shipped this session

**The structure-first audit.** A long-running session — 31 commits
across 22+ surfaces — that started as a continuation of the
2026-04-30 token sweep and pivoted mid-session into structural UX
work after the user pointed out the prior week's "distinctive
refresh" had been color-only and never reviewed actual
structural ergonomics. The new pattern: screenshot every page,
enter plan mode, propose specific structural changes, get
ExitPlanMode approval, execute. Saved as
`feedback_screenshot_then_plan_mode.md` so it sticks across
sessions.

The work breaks into three phases:

1. **ACSI module** (commits `3c5d59c` → `1165d77`, then
   `82fdc96`) — six commits across the constants file, list
   page, detail page, new/edit page, shared section/item
   components, and discrepancy panels (panel-group, panel,
   picker). Token-only at first, then a follow-up pass for the
   draft row "Not started" state and the Affected Areas chip
   cluster after screenshots came in.

2. **Structure-first restructures** (`6a9a6a4` → `c12ea81` →
   `75a0f76` → `804904a` → `d7cff23` → `9786d98` → `b5f0497`
   → `0ad0d98` → `cb044a9` → `82fdc96`) — `/daily-reviews`,
   `/recent-activity`, `/wildlife` (list + sighting form),
   `/aircraft` (list + detail + manufacturer-drop iteration),
   `/contractors`, ACSI list + discrepancy-panel polish. Each
   one screenshot-driven, plan-mode-gated.

3. **Tier 3 sweep + bug fixes** (`abd5f55` → `6973641` →
   `1ae099e` → `de32a1a` → `db7a8a8` → `5e858f2` → `ec6811c`
   → `0ee7d0b` → `c28eb9d` → `58cf007` → `d08f06d`) —
   `/shift-checklist`, `/checks/history`, `/scn`, `/waivers`,
   `/obstructions/[id]`, `/ppr`, `/dashboard`,
   `/` (Airfield Status), `/users`, `/more` (twice — token
   then emoji-to-Lucide). NOTAMs canonical-card polish in the
   middle (`a90d64b`).

A handful of real bugs surfaced and got fixed alongside the
structural work — see the **Bugs fixed** table below. The
hex-alpha-concat footgun (`${var(--color-X)}NN` produces
invalid CSS and silently drops bg/border) keeps reappearing —
it's been pinned in `feedback_amber_text_contrast.md` since
last week but kept biting because shared components
(`ActionButton`, FREQ_COLORS chip helper, BWC option chip,
`/more` icon tile, etc.) had been doing it for months. This
session fixed each instance found.

### ACSI module sweep (`3c5d59c` → `1165d77`)

Six commits in sequence. `ACSI_STATUS_CONFIG` raw hex
(`#9CA3AF`, `#3B82F6`, `#10B981`, `#8B5CF6`) migrated to CSS
variable tokens; `Badge` component auto-derives the tinted bg
via color-mix when color starts with `var(`, so the explicit
`bg` hex literals were dropped. Subsequent commits hit the
list page (outlined-pill cyan filter chips, status-colored
3px left rail using the now-tokenized `statusCfg.color`,
`--fs-2xl` → `--fs-xl`), detail page (Mail icon replacing the
✉ glyph, all rgba tints to color-mix, `--color-accent` →
`--color-cyan` on the Edit Form button), new/edit page
(progress bar accent → cyan, Complete & File button moved to
`--color-success` for finalization semantic), shared
components (response-button hex literals to tokens, all row
tints to color-mix, `--color-accent` → `--color-cyan` on
subsection labels), and the three discrepancy-panel
components — including hardening `chipStyle` against the
hex-alpha-concat footgun preemptively.

Follow-up commit (`82fdc96`) after screenshots: list rows for
drafts no longer show `0% / 0P 0F 0NA` clutter (now show
`Not started` until any response is recorded), and the
Affected Areas pill row in the discrepancy panel was wrapped
in a single bordered chip-cluster container per
`feedback_chip_cluster_pattern.md`.

### `/daily-reviews` (`6a9a6a4`, `6e5de8d`, `c12ea81`)

Three commits, escalating scope. First (`6a9a6a4`) was the
token-sweep pass — title tier drop, all rgba success tints to
color-mix, ✓/✕ HTML entities to Lucide, Sign Review button
contrast text to `var(--color-cyan-btn-text)`. The shared
`EmailPdfModal` got a sibling commit (`6e5de8d`) for its
hex-alpha purple `#A78BFA33`/`#A78BFA55` (8-digit hex
hardcoding the dark-mode purple) → color-mix on
`--color-purple`. Then the structural restructure
(`c12ea81`) — relative-date headers ("Today" / "Yesterday" /
"Wed, May 1"), fixed slot grid replacing variable pills,
status-colored 3px left rail with amber for today-pending,
header pending/reviewed counts. The `formatGroupDate` helper
that landed here became the recipe for four other pages this
session.

### `/recent-activity` structural restructure (`75a0f76`)

Day-group headers got bigger, relative-dated, and count-augmented
("Today · Wed, May 1 · 23 entries" with a 1px bottom rule).
Per-row 3px entity-colored left rail keyed off the existing
`getActionColor` helper (which had only been tinting the
action label inline). Force-uppercase on the details line
dropped — was `details.toUpperCase()` mangling natural casing
for an audit log; now renders in source case at
`--color-text-2`. Lines clamp to 2 instead of truncating
mid-sentence at 60ch. User attribution (rank + last name)
inlined with the action header instead of being buried as 3rd-
line `--fs-2xs` gray. OI badge promoted from a bare letter-
spaced span to a small color-mix cyan chip.

### `/wildlife` list + sighting form (`804904a`, `d7cff23`)

List got the same date-grouping recipe, time-only rows (date
moved to the day header), location promoted to a mono-cyan
chip, and a `formatTimeColon` helper for the `HH:MMZ` form.
The strike-vs-sighting 3px rail differentiation that the plan
flagged as missing was actually already in place in the code
— the screenshot just happened to show only sightings; noted
in the commit body so a future inventory doesn't re-flag it.

Sighting form: section headers bumped one tier (`--fs-2xs` /
text-3 → `--fs-xs` / text-2) so each card has a clear visual
anchor. Action Taken pills (Hazed / Dispersed / Depredated /
Relocated / Disposed / Given to USDA) wrapped in a single
bordered chip-cluster container per
`feedback_chip_cluster_pattern.md` — six independent pills
became one "what was your response?" widget.

### `/aircraft` list + detail (`9786d98`, `b5f0497`, `0ad0d98`)

List rows got densified: model name + a violet `GROUP-N` chip
(military) + `Wingspan N ft` quiet secondary. Duplicate
"127 aircraft" count dropped (now only renders when a search
or favorite filter narrows the set). Detail page section
labels migrated from `--color-accent` to `--color-cyan` with
a 1px bottom rule, Pin/ACN-PCN button rgba literals
tokenized to color-mix on `--color-warning` / `--color-success`,
favorite-card outer border tokenized.

UX-iteration commit (`0ad0d98`) addressed user feedback:
manufacturer dropped from the collapsed row (kept inside the
expanded detail), and the discrepancy detail toolbar got
visible 1px vertical separators between groups instead of
relying on the 14px-vs-6px gap contrast that was too subtle.

### `/discrepancies` list + detail (`809bc16`, `f3fd20f`)

List restructure was the biggest single-commit on the queue
side. The list view's leading mono-cyan slot had been showing
`work_order_number || 'Pending'` — the actual `display_id`
(D-2026-XXX) was completely absent from the list view.
Restructured to a single-line layout with eight slots: 3px
status-colored left rail, display_id, title (truncated), WO
chip when assigned (only for real WO numbers, not the
"Pending" placeholder), compact status pill (`TO AFM`,
`AWAIT CES`, `VERIFY`, etc. — full labels stay in the detail
header), days-open chip with danger color when > 30. Two new
module-scope maps mirror the `/ces` page convention:
`CURRENT_STATUS_COLORS` and `CURRENT_STATUS_SHORT`.

Detail commit (`f3fd20f`) grouped the action toolbar by
intent — edit (Update + Status), media (Capture + Upload),
output (Export PDF + Email PDF), destructive (Delete on the
right via `marginLeft: auto`). Tokenized the per-button hex
to CSS vars. Surfaced a real bug in the shared `ActionButton`
component while at it: `${color}14` / `${color}33` works for
hex literals but silently drops bg/border for var-bound
callers. Multiple `/waivers/[id]` and `/inspections/[id]`
buttons had been rendering with no tinted bg/border for
months. Migrated to color-mix.

### `/contractors` (`cb044a9`)

Card body 2-col grid replacing the 6-row "LABEL: value"
stack — card height roughly halves. Day N color hierarchy
(1-3 default gray → 4-7 text-2 → 8-13 amber → 14+ danger)
surfaces personnel lingering past their typical AF Form 483
window. Add Personnel form 2-col grid matching the inline
edit form.

### `/notams` (`a90d64b`)

NOTAM number lifted from dim `--fs-sm color-text-3` mono to
the canonical `--fs-md fw 700 color-cyan` — was metadata,
should have been the primary identifier. New
`compactNotamDate` helper drops the year for current-year
dates and adds Today/Tomorrow/Yesterday relative anchors —
saves significant width in the 2-col card grid where each
card renders both effective_start and effective_end.

### `/scn` (`1ae099e`)

Real typo fix: history rows showed `Apr 30, 2026Z` — the `Z`
designator is for times, not dates. Same typo on the page
header. Both dropped. Plus relative-date prefix
("Today" / "Yesterday" / "Mon, Apr 21") via a local
`formatScnHistoryDate`. Modal got a one-tap "Mark All Loud
& Clear" quick-fill button — most days are all-clear, this
saves 13 taps per check. Hides once every agency is already
loud_clear (matches the ACSI "Mark All Y" recipe).

### `/checks/history` (`6973641`)

Day grouping with relative-date headers + counts ("3 checks"
right-aligned). Drop the per-row date prefix (now in the day
header), display_id color migrated from `--color-accent` to
`--color-cyan` for canonical alignment.

### `/shift-checklist` (`abd5f55`)

Real bug — FREQ_COLORS chip bg silently dropping. Weekly /
monthly badges had been rendering with only colored text on
the row's underlying bg (no chip) because the
`${FREQ_COLORS[item.frequency]}15` hex-alpha-concat produced
invalid CSS for the var-bound colors. Fixed with color-mix.
Plus history-tab chevron `‹` Unicode → Lucide ChevronRight.

### `/waivers` (`de32a1a`)

Status-colored 3px left rail per row keyed off
`WAIVER_STATUS_CONFIG.color` with urgency override:
expiration within 30 days → danger rail, within 90 → warning,
otherwise the status color. Classification badge migrated
from uniform `--color-text-3` to a per-classification color
map (Permanent → success, Temporary → warning amber, etc.).
Expiration date proximity coloring on the date span — within
30 days renders red + AlertCircle prefix, 90 days amber, 365
days text-2, beyond text-3 default.

### `/obstructions/[id]` (`db7a8a8`)

Real bug — Required Actions list had three "5." entries in a
row. Each violated surface was hardcoded to label `5.` instead
of grouping under a single parent. Restructured as
`5. Address each violated surface:` with an indented
sub-bullet `<ul>` listing each surface. Scales cleanly to N
violations. Plus display_id on canonical mono-cyan +
`compactObstructionDate` helper modeled on the NOTAMs version.

### `/ppr` (`5e858f2`)

New PPR / Edit modal wrapped in a 2-column grid (Arrival
Date / Notes / Approver OI span both columns; dynamic
PprFieldInput cells fill one each). modalCardStyle widened
from 520px → 720px with `maxWidth: '92vw'` so the columns get
~330px after padding. The save-mode picker (Send to
coordination / Pre-coordinated / Save pending) stays outside
the grid. Detail modal benefits from the same width bump.

### `/dashboard` + `/` (Airfield Status) (`ec6811c`, `0ee7d0b`)

Dashboard: setup-banner + Out-of-Office active + Close-Airfield
active rgba sites all migrated to color-mix; OOO migrated from
`var(--color-accent)` to `var(--color-cyan)` for canonical
alignment.

Airfield Status: real bug — BWC option chip active bg silently
dropping (same hex-alpha-concat footgun). LOW/MOD/SEV/PROHIB
selector in the BWC modal had been rendering with no visible
bg highlight. Fixed via color-mix on the resolved color
expression. Plus runway-status `getColors` helper (10 rgba
literals across 3 statuses) refactored to compute the token
once and color-mix at the appropriate alpha. ADVISORY_COLORS
weather-alert map tokenized + ADVISORY's text migrated from
`--color-accent` to `--color-cyan`.

### `/users` (`c28eb9d`)

Role-colored 3px left rail per UserCard. New `getRoleRailColor`
helper exported from `role-badge.tsx` mirrors the existing
3-tier classification (sysadmin → danger, baseadmin / AFM /
NAMO → cyan, others → text-3). Single source of truth so a
future role addition updates the badge class + the rail color
together.

### `/more` (`58cf007`, `d08f06d`)

Two commits on the mobile module menu. First tokenized the
~25 raw hex literals across the 6 nav-item arrays to CSS
vars, migrated the icon-tile concat to color-mix
(pre-emptively — the concat worked on raw hex but would break
the moment any color became a var; Change 1 made that
inevitable so Change 2 was required), and swapped the Unicode
`›` chevron for Lucide ChevronRight.

Second commit was the **emoji-to-Lucide migration**. /more was
the only place in the running UI still using emoji-as-icon at
scale: 27 nav-tile emojis + 4 group-header emojis. Each
migrated to a semantic Lucide component (RadioTower, BarChart3,
ScrollText, Zap, Radio, CheckSquare, ClipboardCheck,
ClipboardList, Bird, FileSignature, HardHat, AlertTriangle,
MapPin, Lightbulb, PlaneLanding, Plane, Library, Clock,
CalendarCheck, FileText, TrendingUp, GraduationCap, BookOpen,
Users, SettingsIcon, Wrench, FolderOpen, Shield). `ModuleItem.icon`
type changed from `string` to `LucideIcon`. Group icon tile bg
also tokenized (was hardcoded slate rgba). The /wildlife empty
state `🦅` glyph at `--fs-3xl` got the same Bird icon for
single-canonical-icon-per-module consistency.

---

## Migrations status

No new migrations this session. Migration `2026042907` is still
the latest applied.

| Migration | Status | What it does |
|---|---|---|
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) `airfield_checks_check_type_check` accepts `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu`; recreates `submit_public_ppr_request` RPC. |

---

## Bugs fixed during the session

The hex-alpha-concat footgun (`${var(--color-X)}NN` invalid CSS,
silent bg/border drop) keeps surfacing in shared helpers. Each
of these had been silently broken until this session.

| Symptom | Root cause | Commit |
|---|---|---|
| Required Actions on `/obstructions/[id]` rendered three `5.` entries in a row when an evaluation hit multiple violated surfaces. Looked like a typo. | The surface-violations loop hardcoded `5. {surfaceName}` instead of incrementing or grouping. Fixed by restructuring as a parent step + indented sub-bullet `<ul>`. | `db7a8a8` |
| BWC option chip in the Airfield Status BWC modal had no visible active-state bg highlight when LOW/MOD/SEV/PROHIB was selected — only the colored text + border showed. | `${c}15` hex-alpha-concat where `c` is `var(--color-success)` etc. produces invalid CSS; the `background` declaration silently drops. Same footgun pinned in `feedback_amber_text_contrast.md`. | `0ee7d0b` |
| FREQ_COLORS chip on `/shift-checklist` (Weekly / Monthly badge) had no visible chip bg — only colored text on the row's underlying bg. | Same hex-alpha-concat. `${FREQ_COLORS[item.frequency]}15` with var-bound colors was invalid CSS. Migrated to color-mix. | `abd5f55` |
| Shared `ActionButton` component dropped bg + border for any caller that passed a CSS variable as `color`. Multiple `/waivers/[id]` and `/inspections/[id]` buttons had been rendering as just colored text on transparent bg. | `${color}14` / `${color}33` 8-digit hex concat works for hex but breaks for var. Migrated to color-mix(in srgb, ${color} 12% / 30%, transparent). | `f3fd20f` |
| KPI band on `/discrepancies` "active" border state rendered with default `--color-border` instead of the per-KPI tint. | `${k.color}44` hex-alpha-concat where `k.color` was a var. Migrated to color-mix. | `809bc16` |
| Trailing `Z` on `/scn` history-row dates and on the page header date — `Apr 30, 2026Z` instead of `Apr 30, 2026`. The `Z` time-zone designator is for times, not dates. | `formatZuluDate(...)Z` literal-Z suffix. Dropped. | `1ae099e` |
| `/notams` `formatDate` produced verbose `Mar 9, 2026 1851Z` for every date. With both effective_start and effective_end on each card in the 2-col grid, this wrapped frequently. | New `compactNotamDate` helper handles relative anchors (Today/Yesterday) and drops year for current-year. Applied via `formatDate`. | `a90d64b` |

---

## Lessons from this session

- **Structure-first, then tokens.** Re-saved the lesson as
  `feedback_refresh_structure_first.md`. The prior week's
  "distinctive refresh" sweep was tokenization-only — it
  improved theme consistency but never touched scan hierarchy,
  row density, status affordances, or relative-date formatting.
  When the user pointed this out mid-session, the work pivoted
  from token cleanup to actual UX restructure. Six pages
  (`/daily-reviews`, `/recent-activity`, `/discrepancies`,
  `/wildlife`, `/contractors`, `/aircraft`) got real
  structural work this session that the prior token-only
  sweep had skipped.

- **Screenshot-driven > code-only.** Saved as
  `feedback_screenshot_then_plan_mode.md`. Before any
  structural restructure: name the section, wait for the user's
  screenshots, enter plan mode, propose specific changes, get
  ExitPlanMode approval, execute. The /wildlife sighting/strike
  rail differentiation that I flagged as broken from
  code-reading turned out to already be in place — the
  screenshot just happened to show only sightings. That kind
  of false flag is exactly what screenshot-driven planning
  prevents.

- **Hex-alpha-concat keeps biting.** Counted 6 distinct
  instances surfaced this session alone (`ActionButton`,
  FREQ_COLORS, BWC option chip, KPI band, `/more` icon tile,
  `chipStyle` in acsi-discrepancy-picker). Each was working
  until a CSS variable replaced a hex literal in some upstream
  callsite, then silently broke. The fix is mechanical
  (`color-mix(in srgb, ${color} N%, transparent)`) but the
  preventive sweep is still incomplete — every shared helper
  that does string concatenation on a color is suspect. A
  codebase-wide grep for `\$\{[a-z]+\}1[0-9A-F]` style
  patterns would surface remaining cases.

- **Real bugs ride along with structural work.** The
  obstructions duplicate `5.` numbering, the BWC chip
  silent-drop, the ActionButton var-color drop — none of
  these were on anyone's bug list. Each surfaced because the
  structural pass forced a careful read of the rendering code.
  Worth keeping the bundle pattern: structural commit
  includes incidental bugs found in the same scope.

- **Auto mode + plan mode coexist via the
  screenshot-then-plan-mode rule.** Auto mode says "execute
  immediately"; the user's explicit instruction says
  "always use plan mode for each section before execution."
  The user's direct instruction beats the auto-mode default.
  Memory captures the rule so it survives across sessions.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Cyan filter-chip `rgba(56,189,248, X)` patterns in `/aircraft` | Low | (Carryover) Category tabs, sort buttons, favorites toggle — many chips, identical pattern. Visible only as "looks slightly more saturated than QRC's chips." |
| `computeIconScale` uses `getBounds()` for px-per-degree calc | Low | (Carryover) Naive bounds rectangle expands on a rotated map; aircraft render slightly smaller than intended at non-zero map heading. |
| Counter-rotation of aircraft icons regenerates 30+ canvases per heading change | Low–Medium | (Carryover) Smooth on developer laptops. May stutter on weaker hardware during fast Ctrl+drag rotation. Migration target: `AdvancedMarkerElement`. |
| Largest parking page LOC (~4.4K) still monolithic | Held | (Carryover) Component extraction explicitly held out from the prior session. Visible polish is in place. |
| Untracked `dark logo.jpg` (2.4MB) | Low | Sits in `/public` from a prior logo experiment. Carryover. |
| Untracked `docs/DEMO_LOGINS.md` | Low | Carryover. |
| Untracked `.claude/` | Low | Local Claude Code settings (gitignored expectation). Carryover. |
| Trademark | Low | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Visual NAVAIDs further perf | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume, audit-mode panel. |
| Sequential PPR coordination | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| Public PPR form file uploads | Deferred (carryover) | Out of scope unless requested. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | (Carryover) Was 182. |
| PDF boilerplate duplication in 11 generators | Low | (Carryover) 5 already on `pdf-utils.ts`. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |
| `tweaks` branch unmerged | Action | 31 commits on `tweaks` not yet merged to `main` or pushed. User decides when. |
| Hex-alpha-concat sweep incomplete | Low | Six instances fixed this session. A codebase-wide grep for `\$\{[a-z_]+\}[0-9A-F]{1,2}` patterns would surface remaining cases. |
| `/feedback` (staff log view) — never reviewed | Low | On the original Tier 3 list. User sent a public-form screenshot instead and the public form was already canonical from Tier 1. The staff view at `app/(app)/feedback/page.tsx` has not been examined. |

---

## Next session tasks

The structure-first audit is **complete for the surfaces with
screenshots**. None of the items below are required next
steps — pick whichever the user wants to focus on. Most need a
screenshot to enter the same plan-mode flow.

### Pages explicitly NOT touched this session

These were either out of screenshot scope or explicitly deferred.

- **`/library`** (PDF Library) — referenced in `/more` but no
  structural work; never screenshotted.
- **`/training`** (Glidepath Training) — on the Tier 3 list;
  ~21 kB First Load JS suggests moderate complexity. No
  screenshots came in.
- **`/feedback`** (staff log view at
  `app/(app)/feedback/page.tsx`) — was on the Tier 3 list but
  only the public QR form was reviewed. The staff view has not
  been examined.
- **`/reports` subpages** (`daily`, `aging`, `discrepancies`,
  `lighting`, `trends`) — flagged as "Tier 4" deferred.
  Reports tend to have minimal interactive chrome; sweep
  targets are likely page titles, table-row tints, and the
  export-button styles.
- **`/settings/base-setup`** — 4.7K LOC. Explicit multi-session
  work, not a single-pass refresh.
- **`/infrastructure`** (Visual NAVAIDs) — 4.1K LOC. Also
  queued. Layer-toggle perf + health-ring volume + audit-mode
  panel are all separate concerns deferred from prior work.
- **`/parking` page proper** — visible polish is done from the
  prior parking-deep session. **Component extraction is
  queued and still needs to be completed next session** —
  4.4K LOC of stable JSX in `app/(app)/parking/page.tsx`. Per
  prior plan: four commits to extract `parking-panel.tsx`
  (`sidebarContent()`, ~1K LOC), then `AircraftTab` +
  `AircraftGroup` + `AircraftSpotRow`, then `EnvironmentTab`,
  then `ClearanceTab` + `SettingsTab` + `ParkingHeader` +
  `ActionBar`. After all four, `parking/page.tsx` drops from
  ~4.4K to ~1.5K (state + handlers + map init + four
  top-level component calls).

### Branch + merge

`tweaks` branch has 31 commits not on `main`. User decides
when to merge or push.

### Hex-alpha-concat preventive sweep (low priority)

Codebase-wide grep for the pattern would surface any remaining
silent bg-drops. Six instances were fixed this session
(`ActionButton`, FREQ_COLORS, BWC option chip, KPI band,
`/more` icon tile, `chipStyle` in
`acsi-discrepancy-picker`). The fix is mechanical
(`color-mix(in srgb, ${color} N%, transparent)`).

### Long-running carryover (bandwidth-permitting)

Pick from these only when bandwidth allows or a customer asks:

- Component extraction for the other 4K+ LOC pages (`base-setup`,
  `infrastructure`).
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian
  template.
- "Advisories" → "WWA Notifications" UI sweep.
- Offline reads for QRC + Regulations.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged)
Build: npm run build clean — no warnings, no errors.
No new migrations.

Notable First Load JS (changed routes this session):
  /                                     (Airfield Status — full-page route)
  /acsi                            3.04 kB / 199 kB
  /acsi/[id]                       5.53 kB / 202 kB
  /acsi/new                        19.8 kB / 204 kB
  /aircraft                        11.7 kB / 155 kB
  /checks/history                  6.72 kB / 199 kB
  /contractors                     10.7 kB / 191 kB
  /daily-reviews                   2.67 kB / 327 kB
  /dashboard                       14.0 kB / 205 kB
  /discrepancies                   11.3 kB / 226 kB
  /discrepancies/[id]              8.35 kB / 213 kB
  /more                            8.47 kB / 180 kB   (+0.20 from Lucide imports)
  /notams                          7.01 kB / 178 kB
  /obstructions                    17.8 kB / 182 kB
  /obstructions/[id]               12.0 kB / 329 kB
  /ppr                             16.9 kB / 184 kB
  /recent-activity                 5.37 kB / 160 kB   (+0.96 from grouping helpers)
  /scn                             10.3 kB / 181 kB
  /shift-checklist                 5.56 kB / 168 kB
  /users                           18.3 kB / 183 kB
  /waivers                         4.02 kB / 187 kB

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-05-01 (this session) | Structure-first audit. 31 commits across 22+ surfaces. ACSI module sweep (7 commits), structural restructures of `/daily-reviews`, `/recent-activity`, `/wildlife` list+form, `/aircraft` list+detail, `/contractors`, `/discrepancies` list+detail. Tier 3 sweep: `/notams`, `/scn`, `/shift-checklist`, `/checks/history`, `/waivers`, `/obstructions`, `/ppr`, `/dashboard`, `/`, `/users`, `/more` (2 commits including emoji→Lucide). 6 real bugs fixed including the hex-alpha-concat silent-drops in `ActionButton`, `BWC chip`, `FREQ_COLORS`, KPI band; and the `obstructions` duplicate-`5.` Required Actions numbering. All on `tweaks` branch, 0 migrations. |
| **Unreleased** | 2026-04-30 (prior) | Tier 2 of the audit-derived refresh backlog finished. Six commits across five pages: `/regulations` (outlined-pill tabs + card refresh with left-rail accents), `/aircraft` (PASS/EXCEEDS + Shield purple tokenized, six fs-2xl headers down a tier), `/ces` (rgba cleanup + a latent hex-alpha-concat bug fix), `/shift-checklist` (Lucide Check + pill tokenization), `/recent-activity` (entity color tokens). Plus the prior-session handoff committed. |
| **Unreleased** | 2026-04-30 (prior) | Tier 1 of the audit refresh (login + reset-password + setup-account + public feedback) plus 25-commit deep parking polish. 28 commits. |
| **Unreleased** | 2026-04-30 (prior) | Distinctive-refresh sweep across high-traffic routes: Inspections, NOTAMs, Wildlife, /scn, /contractors, /obstructions, /waivers. DetailGrid bordered tiles. 20 commits. |
| **Unreleased** | 2026-04-30 (prior) | QRC distinctive refresh: amber-unified colors via outlined-pill, Done/N/A toggle + schema bridge, full PDF rewrite. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections`. Construction + Other check types added. PfnToggle extracted. 16 commits, two migrations applied. |
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

### New files

- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_refresh_structure_first.md`
  — feedback memory: refresh sweeps should review structure
  before tokenization.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_screenshot_then_plan_mode.md`
  — feedback memory: structural restructures are
  screenshot-gated and require plan-mode + ExitPlanMode
  approval per section.

### Modified files

- `app/(app)/page.tsx` — Airfield Status. BWC chip, runway
  status, ADVISORY_COLORS.
- `app/(app)/dashboard/page.tsx` — setup banner, OOO, Close
  Airfield rgba sites.
- `app/(app)/discrepancies/page.tsx` — list restructure.
- `app/(app)/discrepancies/[id]/page.tsx` — toolbar grouping +
  ActionButton fix.
- `app/(app)/checks/history/page.tsx` — date grouping.
- `app/(app)/notams/page.tsx` — number prominence + compact
  date format.
- `app/(app)/ppr/page.tsx` — modal 2-col grid + width bump.
- `app/(app)/scn/page.tsx` — relative-date history + quick-fill.
- `app/(app)/waivers/page.tsx` — rail + classification +
  expiration urgency.
- `app/(app)/obstructions/[id]/page.tsx` — Required Actions
  sub-bullets + display_id + date.
- `app/(app)/contractors/page.tsx` — densification + Day N +
  Add form 2-col.
- `app/(app)/shift-checklist/page.tsx` — FREQ_COLORS bug +
  Lucide.
- `app/(app)/daily-reviews/page.tsx` — token + structural
  restructure.
- `components/daily-reviews/sign-modal.tsx` — token sweep.
- `app/(app)/recent-activity/page.tsx` — restructure rows +
  day headers.
- `app/(app)/wildlife/page.tsx` — list date grouping + Bird
  empty state.
- `components/wildlife/sighting-form.tsx` — section headers +
  Action Taken chip cluster.
- `app/(app)/aircraft/page.tsx` — list densification + detail
  polish.
- `app/(app)/users/page.tsx` — (no direct change; via
  components/admin/).
- `components/admin/role-badge.tsx` — `getRoleRailColor` helper.
- `components/admin/user-card.tsx` — borderLeft.
- `app/(app)/more/page.tsx` — token migration + emoji→Lucide.
- `app/(app)/acsi/page.tsx` — list refresh + draft state.
- `app/(app)/acsi/[id]/page.tsx` — detail refresh.
- `app/(app)/acsi/new/page.tsx` — new/edit refresh.
- `components/acsi/acsi-section.tsx` — token sweep.
- `components/acsi/acsi-item.tsx` — response buttons + tints.
- `components/acsi/acsi-discrepancy-panel-group.tsx` — token sweep.
- `components/acsi/acsi-discrepancy-panel.tsx` — token sweep +
  Affected Areas chip cluster.
- `components/acsi/acsi-discrepancy-picker.tsx` — chipStyle
  hardening.
- `components/ui/email-pdf-modal.tsx` — hex-alpha purple
  migration.
- `components/ui/button.tsx` — `ActionButton` color-mix fix.
- `lib/constants.ts` — `ACSI_STATUS_CONFIG` tokenization.

### Reference files (read-only)

- `app/(app)/qrc/page.tsx:194` + `:245` — canonical
  outlined-pill + card recipes.
- `app/(app)/notams/page.tsx:496` + `:558` — second canonical.
- `feedback_amber_text_contrast.md` — hex-alpha-concat
  footgun, cited in 6 commit bodies.
- `feedback_chip_cluster_pattern.md` — chip cluster recipe,
  cited in ACSI Affected Areas + Wildlife Action Taken.

### Environment changes

None this session.

---

*All 31 commits this session are on the `tweaks` branch and have
not been pushed. No new migrations. No version bump. Untracked
files (`.claude/`, `docs/DEMO_LOGINS.md`, `public/dark logo.jpg`)
remain carryover.*
