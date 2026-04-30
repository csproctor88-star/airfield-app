# Session Handoff

**Date:** 2026-04-29
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npx vitest run` ✓ (253 pass), `npm run build` ✓
**HEAD:** `b007aea`

---

## What shipped this session

**16 commits** on `main`. One new migration (`2026042907`) applied to
prod. The session's spine was a continuous **distinctive-refresh
visual pass** across the daily-ops modules: Airfield Status `/`,
`/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections`. Two
new check types (Construction + Other) shipped alongside the `/checks`
refresh, plus a shared P/F/N/A toggle component extracted between
`/checks` and `/inspections`. End-of-session: a light-mode bug pass on
the AFM OOO / Closed banners that had been hardcoded for dark mode.

The pattern that emerged across these refreshes is now durable enough
to be the project's de facto design language: tertiary-tier section
headers with cyan accent underlines, Lucide icons replacing emoji
everywhere, semantic status pills, banner-tier blocking states (4px
danger left rule), tiered action clusters (primary cyan / utility calm
/ blocking left-border), bordered detail-item tiles with cyan accent
left rules, and filter restructures (Search input + Filters dropdown
with active-count badge + dismissible chip strip).

### PPR Columns row: align Req column on time rows (`d123170`)

Carry-over from the prior session's PPR Columns cleanup. The Z/L
time-display chip cluster sat after the Req pill, knocking Req out of
column alignment on time-type rows. Moved Z/L between the type select
and the Req pill in both the existing-row and add-row blocks. Every
row's Req/Opt pill now lines up regardless of column type.

### Drop arrival_eta_zulu spine field from PPR (`07896a6`)

The spine ETA was added in `2026042901` to make ETA universal on every
PPR. After `2026042905` made it optional on the public form (and rolled
time capture into custom `time` columns with per-column Zulu/Local
display), the spine field stopped paying for itself: every surface
that needs an arrival time can get it from a custom column with the
right display mode, and bases were collecting the same data twice.

Migration `2026042906` drops the column from `ppr_entries` and
recreates `submit_public_ppr_request` without `p_arrival_eta_zulu` (and
without the HHMM format guard, which has nothing left to guard). Code
strips ETA from the staff PPR create/edit modal, PPR Log table column
+ detail card + `SubmittedSummary`, the PDF generator, the Airfield
Status "Today's PPRs" panel, the coordination-request + cancellation
email routes, the `PprEntry` types, and the `pdf-utils` test fixture.

Bases that want arrival-time capture configure a custom `time` column.
Operators preserving historical ETA visibility should add the column
and backfill before applying the migration.

### Airfield Status: distinctive refresh + header consolidation (`363d8d0`)

The kickoff of the visual sweep. Sets the language used by every
following module:

- The operational cluster (advisories chip / PPRs Today chip / Z clock
  / Julian / calendar date) lives in the **app-shell header** now,
  not on the page. It rides the sticky header across every route, and
  the base name + ICAO get the hero treatment (large weight-700 base
  name + cyan mono ICAO pill) replacing the small all-caps "DEMO AFB
  · KDMO" line. The green "Online" presence label was redundant with
  operator identity below — removed.
- Section headers gained the accent underline rule + count chips
  ("Personnel · 3", "PPRs · 6").
- Operational vital-signs band: accent left border + elevated bg on
  Runway Status; RSC + BWC slimmed so RWY stays dominant; BWC alert
  chrome at MOD/SEV/PROHIB.
- Personnel cards reformatted out of LABEL: value form into a
  status-board layout (~30% less vertical per card).
- Construction / Closures: best-effort parser turns "LOCATION: work"
  into yellow location chip + work text rows; falls back to pre-wrap.
- AFM Closed banner picked up 4px danger left border + AlertOctagon;
  AFM OOO banner got 2px accent + DoorOpen.
- Advisories sorted WARNING → WATCH → ADVISORY; <30min countdown flips
  to danger weight 800.
- Layout fix in same commit: `DashboardProvider` raised to wrap
  `Header` so the header's `useDashboard()` call resolves (fixes a
  runtime error from the operational-cluster move).

### Airfield Status: structured Construction add + Weather Alerts +icon (`96da91f`)

Follow-up on the Construction/Closures chip rendering. The chip
parser had no path to add a new LOCATION + work entry without
dropping into the bulk-edit textarea. Added an inline "+ Add Item"
that expands into two inputs (LOCATION uppercase mono cyan, Work
regular text). Save appends a properly formatted "LOCATION: work"
block to the underlying free-text remarks; bulk Edit remains in the
section header. Weather Alerts +Add chip slimmed to a 22×22
icon-only square — text was redundant next to the Plus icon.

### Dashboard: distinctive refresh + base-name weight tweak (`b732273`)

Second module in the sweep, applying the language from `/`:

- Page header collapses to a tight row: tertiary "DASHBOARD" left,
  "LAST CHECK · TYPE @ HHMMZ" right (cyan mono), accent underline
  below.
- Inspection Status Strip — emoji (✅ 📝 ☀️ 🌙) replaced with Lucide
  CheckCircle2 / ClipboardList / Sunrise / Moon.
- Quick Actions tile grid restructured into three tiers: primary cyan
  (Airfield Checks, New Discrepancy), secondary calm with category
  Lucides (Personnel HardHat, Shift Checklist ListChecks, QRCs Zap,
  SCN Radio, PPR Log ClipboardList, BASH Bird), blocking (Out of
  Office DoorOpen, Close Airfield Moon — banner-tier styling when
  active).
- Tile labels at weight 600 (not 700) so labels recede and the icons
  + colors carry the hierarchy.
- Stripped `lightingHealthSummary` — it was fetching lighting
  systems/components/features just to never render anything.
- Header tweak in same commit: app-shell base name weight 800 → 700
  so it stops shouting; the cyan ICAO badge stays the eye-catch.

### Discrepancies: distinctive refresh across list / detail / create (`ce1ea33`)

Three pages in one sweep:

- **List**: tertiary "DISCREPANCIES" header + accent underline. Top-
  right action cluster tiered (utility Excel/PDF/Email + cyan +New).
  KPI band: labels demoted to tertiary, vertical separator splits the
  primary pair (OPEN / >30 DAYS) from the secondary triplet
  (AFM/CES/AMOPS), AlertOctagon prefix on >30 DAYS when non-zero.
  Filter row restructured (Search top + Filters dropdown +
  active-count badge + dismissible chip strip + Clear all).
- **Detail**: layout pivoted to a 2-col internal row — detail items
  on the left as bordered tiles (subtle inset + 2px cyan accent left
  rule, label fs-2xs/weight 600, value fs-md/weight 500), map +
  photos on the right. Action toolbar moved below as a horizontal
  flex bar with Lucide icons throughout; Delete pushes right via
  `marginLeft: auto`. Removed the Work Order button (Update flow
  already covers WO# editing). New current_status pill in the header
  via `CURRENT_STATUS_COLORS` map.
- **Create**: 13-field flat stack grouped into 4 sections with
  accent-underlined headers (Discrepancy Details / Classification &
  Assignment / Location & Linked Features / Media). GPS button
  hardcoded SVG → Lucide MapPin.

### PPR: distinctive refresh across log, detail, modals, public form (`33572ff`)

Visual-only sweep across PPR. Highlights:

- Filter row restructured to mirror /discrepancies. Slim Log table
  loading reuses the `weather-skeleton` pulse with 5 stub rows.
- Detail card Coordination block rebuilt as semantic tiles (concur
  green / non-concur red / pending neutral) with Lucide icons.
- Triage and create modals converted to a card-based segmented
  control (`SegmentedCard`) so the selected outcome is unambiguous —
  hidden native radios for accessibility; Lucide icon per option.
- Public form: header tiered (base name primary with Plane accent
  icon, "Prior Permission Required Request" demoted to tertiary).
  `<RequiredMark />` consolidates 4 inline `#EF4444` asterisks. Error
  banner upgraded from plain red text to padded box. Success state
  rebuilt as banner-tier card (4px success left border, Lucide
  CheckCircle2 size 48).
- Globals: `weather-skeleton` gets a subtle elevated bg so empty
  pulse rows have a visible silhouette.

### Checks: distinctive refresh + Construction & Other check types (`93cd9d0`)

Two changes in one sweep across `/checks`. Visual refresh follows the
discrepancies/ppr template (tertiary headers, KPI/filter polish,
detail-page tiles, history page filter restructure, skeleton loading,
empty states with Clear-all + +New CTAs). The data layer changes:

- `CheckType` union extended with `'construction' | 'other'`. No DB
  change needed (column is TEXT; per-type structured data lives in
  `airfield_checks.data` JSONB). New keys
  `data.construction_items: { [itemId]: 'P'|'F'|'N/A' }` and
  `data.other_subject: string`.
- `CHECK_TYPE_CONFIG` extended to 8 entries; `icon` strings swept
  emoji → Lucide component-name strings (storing strings keeps
  `lib/constants.ts` React-free for PDF/draft/analytics consumers).
  Resolved via new `lib/check-icons.tsx` with a fallback.
- Construction Check: structured FAA airfield-construction checklist
  (11 items in 3 sections — Safety & Security / Operational Areas /
  Documentation & Coordination), each item P/F/N/A defaulted to P.
  New `lib/check-construction-items.ts` + new
  `components/checks/construction-checklist.tsx` (segmented toggle
  for input, status pill for read-only).
- Other Check: standard check skeleton + required free-form Subject
  field at the top so History rows are distinguishable.
- `CheckDraft` interface gains `constructionItems` + `otherSubject`
  so resume + auto-save persist the new state.
- `lib/check-pdf.ts` adds Construction (3-section table with
  P=green / F=red / N/A=gray) and Other (Subject line) blocks.

### Checks: inline tile layout, start-check confirm, drop standalone remarks (`4b395f5`)

Three follow-ups on the new-check form after first user pass:
type tiles laid out icon + label inline (was stacked); clicking a
tile now prompts "Start <type> and log yourself on the airfield?"
(silent log was an audit risk); standalone Remarks textarea removed
for non-BASH checks (Issue Found is the path for context — comment
+ location + photos live together there). BASH still has its own
internal remarks card (data lives elsewhere).

### Migration: extend airfield_checks.check_type CHECK (`139fdc5`)

Saving an Other check failed with `airfield_checks_check_type_check`
violation — DB still enforced the original 7-value whitelist while
the TS union and config had been extended to 9 in `93cd9d0`. Drop
the constraint and re-add with `'construction'` and `'other'`
included. No data backfill needed (TEXT column, JSONB payload).
`schema.sql` updated in lockstep. Migration applied to prod
manually by user.

### Other Check: rename Subject to Reason, prompt up front (`0b087e6`)

The "Subject" label rebadged to "Reason for Check" across the form,
detail page, and PDF (storage key `data.other_subject` unchanged so
existing rows still display). Clicking the Other tile now prompts
for the Reason via `window.prompt()` before the form renders, so the
on-airfield Events Log entry can include the reason from the start
instead of needing a back-fill or second log row. Captured Reason
pre-fills the inline input — editable until the check completes.

Events Log entries for Other now read tighter without the redundant
"OTHER CHECK FOR" wrapper:

- on-airfield: `AFLD3/OI ON THE AFLD FOR <REASON>`
- off-airfield: `AFLD3/OI OFF THE AFLD. CK CMPLT, <discrepancies>`

The Reason itself is the descriptor on the on-airfield side; the
off-airfield side just confirms completion + any findings.

### Sidebar logo: SVG experiment + revert (`709ffea`, `1457cee`)

Mid-session detour into the sidebar logo. First commit (`709ffea`)
replaced the PNG with two stylized SVGs at
`/public/glidepath-logo-{light,dark}.svg` (cyan glide-slope mark +
"Glidepath" wordmark) and restructured the sidebar so the tagline
"Guiding You to Mission Success" sits centered directly under the
logo with the collapse toggle on its own row below. The SVG didn't
parse in browsers because XML comments can't contain `--` and mine
contained `var(--color-accent)` — also the user wanted a different
direction. Switched to an inline React `<GlidepathLogo />` component
(theme-aware via `currentColor`), then briefly tried the user's
`dark logo.jpg`, then **reverted entirely** in `1457cee` back to the
original PNGs (`/glidepath2.png` light, `/glidepathdarkmode3.png`
dark). Tagline-centered + collapse-toggle-below layout improvement
was kept; everything else rolled back. The JPG sits untracked in
`/public` for the user to pick up later.

### Inspections: distinctive refresh + shared PfnToggle (`23def8f`)

Daily-ops set of `/inspections` (3 highest-traffic pages):
list+form `page.tsx` (~3106 LOC), detail `[id]/page.tsx` (~1562 LOC),
type hub `all/page.tsx` (~208 LOC). Construction Inspection +
Joint Monthly Inspection forms deferred (personnel-attendance
forms with no checklist UI; lower daily traffic).

Shared infrastructure:

- New `components/ui/pfn-toggle.tsx` — extracted the P/F/N/A
  segmented toggle (and read-only status pill) out of
  construction-checklist into a shared UI primitive so Construction
  Check and the Daily Airfield/Lighting forms read with the same
  control. `components/checks/construction-checklist.tsx` now
  imports it instead of carrying its own copy.
- `lib/check-icons.tsx` renamed `getCheckIcon` → `getTypeIcon`
  (backwards-compat alias kept) and extended with PlaneTakeoff /
  Lightbulb / HardHat / Handshake / ShieldCheck for the inspection
  type tiles.

`/inspections` per-page polish followed the established pattern
(tertiary headers, Lucide everywhere, KPI tiles, segmented item
toggle replacing the cycling 28×28 box). The cycling button kept the
existing `toggle()` callsite around as a fallback for any future
keyboard-shortcut callsite, but introduced a new `setResponse()`
direct setter that drives the segmented toggle and preserves the
auto-create-discrepancy-stub-on-fail behavior.

### Other Check: fix prompt example, drop "FOR" from log, persist reason instantly (`b007aea`)

End-of-session polish on the Other check flow. The `window.prompt()`
example text was stale (still said "AFLD3 ON THE AFLD FOR AN OTHER
CHECK FOR <reason>" — the wording from before `0b087e6` trimmed the
redundant wrapper). Updated to match what actually lands. The
Events Log on-airfield entry also dropped the leading preposition
"FOR" so it now reads `AFLD3/OI ON THE AFLD. <REASON>` — the
off-airfield `… OFF THE AFLD. CK CMPLT, …` side already used a
period, so the two halves now mirror.

The bigger change was a persistence fix: after the prompt captures
the Reason, the draft is now **explicitly saved to localStorage
right then** rather than relying on the
`buildDraftSnapshot → auto-save useEffect` chain. React batches the
setState calls, so the snapshot ref doesn't update until the next
render tick — if the user navigates away (or the tab unmounts)
before that tick, the localStorage draft would catch only the
checkType with no reason. Explicit save eliminates the race. The
auto-save useEffect still runs on every subsequent state change, so
this is purely a first-write guarantee.

Bonus: resume banner now surfaces the Reason for Other checks
(`Other Check — "Perimeter fence walk after wind event"`) so the
user knows what they're resuming, not just "an unfinished Other
check."

### Light-mode fixes for OOO / Closed banners + Close-Airfield dialog (`dd0cfb8`)

End-of-session bug pass surfaced by user screenshots. The AFM Out
of Office banner and the AFM Closed banner on `/` both hardcoded
a dark-navy background (`rgba(15, 23, 42, ...)`); the Closed banner
also hardcoded a light-pink title (`#FECACA`) and slate-300 body.
Worked fine in dark mode; in light mode the dark blocks crashed the
page color story and the light pink/slate text washed out.

The Close Airfield Management dialog's primary "Activate" button
used a slate fill (`rgba(100,116,139,0.25)`) with `#CBD5E1` text —
light gray on light gray, effectively invisible in light mode.

Fixes:

- OOO banner (and minimized chip): swap navy fill for
  `var(--color-bg-surface)` + `var(--color-border)`. Adapts to both
  themes; cyan accent rule kept.
- Closed banner: `color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-surface))`
  layers a 6% danger tint over the surface bg so the card carries a
  red tint in both themes; title moves to `var(--color-danger)`,
  body to `var(--color-text-2)`.
- Close-Airfield dialog primary button relabeled "Activate" → "Close
  Airfield" and styled filled-danger (red bg, white text). Closing
  the airfield is destructive enough that filled red is the right
  severity, and it's now visible in light mode.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | Drops `ppr_entries.arrival_eta_zulu` column and recreates `submit_public_ppr_request` RPC without the `p_arrival_eta_zulu` parameter (and without the HHMM format guard). |
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | Drops + re-adds `airfield_checks_check_type_check` constraint to include `'construction'` and `'other'`. No data backfill (TEXT column, JSONB payload). Applied manually by user. |

---

## Bugs / friction fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Saving an Other check failed with `airfield_checks_check_type_check` violation | TS union + CHECK_TYPE_CONFIG extended to 9 types in `93cd9d0` but DB constraint still whitelisted the original 7 | `139fdc5` (DROP + ADD with 9 values) |
| OOO + Closed banners and Activate button invisible / clashing in light mode | Hardcoded `rgba(15, 23, 42, ...)` navy bg + light-pink/slate text + slate-on-slate filled button — all designed only for dark mode | `dd0cfb8` (semantic surface tokens + danger-tinted color-mix + filled-danger primary) |
| Other Check Reason could be lost if user navigated away within ~1 render tick of the prompt | The auto-save useEffect chain depends on `buildDraftSnapshot` being recomputed via React state flush; setState batching means the snapshot ref can lag the prompt-captured value | `b007aea` (explicit `saveCheckDraft()` immediately after the prompt; auto-save still picks up subsequent edits) |
| New SVG logo failed to render in the browser | XML comments can't contain `--`, but the SVG comments contained `var(--color-accent)`. Browser XML parser rejected the file with "Double hyphen within comment". | `709ffea` initially shipped broken; pivoted to inline React component (theme-aware via currentColor); then reverted entirely in `1457cee` per user direction |
| `airfield_checks` Inspector sometimes silent-logged "ON THE AFLD" with no operator confirmation | Tile click set check_type and called `logActivity('started')` immediately; user had no chance to bail | `4b395f5` (added `confirm()` gate before flipping into started state) |
| Other Check on-airfield Events Log entry was empty/uninformative | Subject was only collected after the form rendered, but Events Log fired at tile-click time | `0b087e6` (`window.prompt()` for Reason at tile-click; pre-fills inline input) |

---

## Lessons from this session

- **`color-mix` over `var(--color-*)` solves the dual-theme banner problem.** When you need a tinted surface (red-tinted card, success-tinted card) that adapts to both themes, use `color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-surface))` instead of hardcoded `rgba(...)`. The mix lifts the right base color in each theme automatically.
- **Inline React SVG > static `.svg` for theme-aware brand marks.** When a logo needs `currentColor` to follow text color in light/dark, an inline `<svg>` returned from a React component sidesteps file caching, service-worker invalidation, and XML parse rules. Static `.svg` files in `/public` are fine for non-theme-aware images.
- **XML comment rule that bites every dev once:** `<!-- -- -->` is illegal. Any comment containing `var(--color-accent)` will fail XML parsing with "Double hyphen within comment". Use `<!-- color-accent -->` with a single dash, or strip the comment entirely.
- **Type-config icons should be strings, not React components, when the config is shared with non-React code.** `CHECK_TYPE_CONFIG.icon: 'PlaneTakeoff'` (resolved at render time via a helper) keeps `lib/constants.ts` React-free for PDF/draft/analytics consumers. Same pattern just rolled into `INSPECTION_TYPE_CONFIG` via the renamed `getTypeIcon()`.
- **Audit forms deserve segmented controls, not cycling buttons.** Pass/Fail/N/A on inspections used a single cycling box; the safety risk of accidental over-cycling outweighs the screen-real-estate savings. Segmented three-button is the right pattern for any state with semantic meaning.
- **Activity log entries that fire at click time can't reference state set later in the form.** Prompting for the value up front (Other Check Reason) is cleaner than back-filling or rewriting the log row. The on-airfield log is committed; design around that.
- **The `--no-edit` / `--no-verify` rule is real:** zombie node processes blocking ports 3000/3001/3002 happens after `npm run build` runs alongside an active `npm run dev`. The sandbox blocks `Stop-Process -Id`, so the user has to clean up themselves. Suggest `taskkill /F /IM node.exe` in their terminal when the symptom appears.
- **A small UX iteration with the user in the loop beats a big planned design.** The Other Check shipped Subject → Reason → "drop OTHER from log entirely" → "drop the FOR too, persist on first write, surface in resume banner" in four quick rounds because the user steered each one. Never assume the first design decision survives contact with a real workflow.
- **Don't trust auto-save chains for first-write guarantees.** The `buildDraftSnapshot` → auto-save useEffect pattern works fine for ongoing edits but loses the first write if the user navigates away within a render tick of the trigger. When a value is captured imperatively (e.g. from `window.prompt()`), call `saveCheckDraft()` directly with an inline draft snapshot too. Auto-save remains the steady-state path; the explicit call is the racing-the-tab-close belt.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **`/inspections/construction/new` + `/inspections/joint-monthly/new` pre-refresh** | Open (next session) | Personnel-attendance forms; lower daily traffic. Carry the same pattern as the daily-ops set. ~520 LOC combined. |
| **Untracked `dark logo.jpg`** | Low | 2.4MB JPG sits in `/public` from the logo experiment. User said "I will figure out the logo a different day." Decide later whether to commit, delete, or replace. |
| **Three zombie node processes hold ports 3000–3002** | Low (user-side) | Earlier dev-server starts left zombies. Sandbox can't kill PIDs by ID. Suggest `taskkill /F /IM node.exe` at session start tomorrow if dev-server lands on port 3003+. |
| **Discrepancy "Notes History" backfill** | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; rendering rewrites on display. |
| **Visual NAVAIDs further perf** | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume when "Color by health" is on, audit-mode panel. |
| **Sequential PPR coordination** | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| **Public PPR form file uploads** | Deferred (carryover) | Out of scope unless requested. |
| **"Advisories" → "WWA Notifications" UI sweep** | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |

---

## Next session tasks

The distinctive-refresh sweep continues. Modules done so far:
`/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`,
`/inspections` (daily-ops set).

**Recommended next pick — `/qrc`** (emergency checklists, 25 QRCs ×
8 step types). Different shape from list/detail (linear step-by-step
execution flow), so it'll validate that the patterns scale beyond
table modules.

After that:

- `/inspections/construction/new` + `/inspections/joint-monthly/new`
  — finish the inspections module (carryover from this session,
  ~520 LOC combined)
- `/notams` — shorter module, good for variety
- `/wildlife` — sighting/strike forms; the BASH heatmap is a Mapbox
  holdout (out of scope for visual refresh)
- Batch sweep: `/waivers`, `/contractors`, `/obstructions`, `/scn`
  — smaller modules, polish together

Held until later (multi-session work each):

- `/infrastructure` (~4.1k LOC) — Visual NAVAIDs
- `/parking` (~4.3k LOC) — multi-select editor + map + clearance sidebar
- `/settings/base-setup` (~4.7k LOC) — 15-step wizard

The shared `<PfnToggle>` from `components/ui/pfn-toggle.tsx` is
ready for any other audit form that needs P/F/N/A semantics — the
ACSI module is a natural fit if it ever gets the refresh treatment.

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
Migrations 2026042906 + 2026042907 applied to prod.

Notable First Load JS (changed routes this session):
  /                       — distinctive refresh + Construction add + light-mode fix
  /dashboard              13.1 kB / 204 kB
  /discrepancies          11.0 kB / 226 kB
  /discrepancies/[id]      8.3 kB / 213 kB
  /discrepancies/new       7.3 kB / 185 kB
  /ppr                    16.8 kB / 184 kB
  /checks                 11.2 kB / 243 kB
  /checks/[id]             9.4 kB / 216 kB
  /checks/history          6.4 kB / 199 kB
  /inspections            24.1 kB / 234 kB
  /inspections/[id]       12.4 kB / 216 kB
  /inspections/all         5.7 kB / 168 kB

Largest static page (unchanged): /wildlife 454 kB / 788 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-29 (this session) | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections` daily-ops set. Construction + Other check types added (FAA 11-item P/F/N/A checklist; required Reason for Other). Shared `<PfnToggle>` extracted between Checks and Inspections. Light-mode fixes for OOO/Closed banners. PPR spine ETA dropped (custom time columns now). 15 commits, two migrations applied. |
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

- `supabase/migrations/2026042906_drop_ppr_arrival_eta_zulu.sql` — drops the spine ETA column + recreates the public-submit RPC without it (applied to prod)
- `supabase/migrations/2026042907_add_construction_other_check_types.sql` — DROP + ADD `airfield_checks_check_type_check` with 9 values (applied to prod)
- `lib/check-icons.tsx` — emoji-name → Lucide component map; `getTypeIcon()` shared by check + inspection type configs (`getCheckIcon` aliased)
- `lib/check-construction-items.ts` — FAA 11-item Construction Check data + default state + summarizer
- `components/checks/construction-checklist.tsx` — 3-section checklist + read-only mode (now wraps shared PfnToggle)
- `components/ui/pfn-toggle.tsx` — shared P/F/N/A segmented toggle + status pill, used by Checks Construction + Inspections daily airfield/lighting

### Modified files

- `app/(app)/page.tsx` — distinctive refresh, header consolidation into app-shell, Construction add affordance, light-mode banner fixes
- `app/(app)/dashboard/page.tsx` — distinctive refresh, dead-code removal, light-mode dialog button fix
- `app/(app)/discrepancies/page.tsx`, `[id]/page.tsx`, `new/page.tsx` — distinctive refresh
- `app/(app)/ppr/page.tsx` — distinctive refresh + spine ETA removal
- `app/(app)/checks/page.tsx`, `[id]/page.tsx`, `history/page.tsx` — distinctive refresh + Construction/Other check types + Reason prompt
- `app/(app)/inspections/page.tsx`, `[id]/page.tsx`, `all/page.tsx` — distinctive refresh + segmented PfnToggle
- `app/globals.css` — `weather-skeleton` elevated bg, `.ppr-log-row:hover`, `.check-type-grid` responsive grid
- `components/layout/header.tsx` — operational cluster moved in, base name weight 800 → 700
- `components/layout/sidebar-nav.tsx` — tagline centered under logo, collapse toggle moved to its own row
- `components/ppr/public-request-form.tsx` — distinctive refresh, ETA removed
- `lib/constants.ts` — `CHECK_TYPE_CONFIG` extended to 8 with Lucide icon strings
- `lib/check-pdf.ts` — Construction (3-section colored autoTable) + Other (Reason line) PDF blocks
- `lib/check-draft.ts` — `constructionItems` + `otherSubject` in CheckDraft
- `lib/demo-data.ts` — demo Construction + Other checks
- `lib/supabase/types.ts` — `CheckType` union extended with `'construction' | 'other'`
- `lib/supabase/ppr.ts` — spine ETA stripped from `PprEntry` types
- `lib/ppr-pdf.ts` — spine ETA column removed
- `supabase/schema.sql` — `airfield_checks.check_type` CHECK constraint extended
- Numerous others in the data layer for the spine-ETA removal

---

*All changes pushed to `origin/main`. Migrations `2026042906` + `2026042907` applied to prod. The distinctive-refresh design language is now the project's de facto pattern; pick any module from the Next-session list and apply it.*
