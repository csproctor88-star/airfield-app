# Session Handoff

**Date:** 2026-05-06
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `cba5a67` (origin/main)

---

## What shipped this session

Two threads. First, an end-to-end refresh of the discrepancy module's
visual identity — emojis on `DISCREPANCY_TYPES` swapped for lucide
icons, the Google Maps InfoWindow's clunky default close-button row
floated as a top-right overlay, and the icons themselves color-coded
per type so an operator can read the COP at a glance. Second, the IAW
compliance doc got fully wired up: every step in
`lib/base-setup-guide.ts` had its `cite` triple replaced from the
user-reviewed `docs/base-setup-guide-review.md`, two of them switched
to `null` for admin-only configuration, and a follow-up pass synced
the divergent What/How/Why prose plus eight typo carryovers. Plus a
trivial nav reorg moving Glidepath Training to the Reference section
on the `/more` page so it matches the sidebar.

### Discrepancy type icons — emojis → lucide (`05d8c79`)

`DISCREPANCY_TYPES` carried an `emoji` field per type that rendered in
seven places (3 dropdowns, detail row, list page, CES queue, plus
`textContent` inside the 30px circular DOM marker on both the Mapbox
and Google Maps COP variants). Emojis render inconsistently across OS
/ font stacks (Apple vs Microsoft vs Noto), and they aren't a
Glidepath idiom — every other module is on `lucide-react`. Swap each
for a lucide icon component, render that icon at every existing emoji
site, and keep the COP visually differentiated since the COP markers
are the one place the user explicitly mentioned would break on a
straight emoji removal.

Mapping: `🚨→AlertTriangle`, `🛣️→Construction`, `💡→Lightbulb`,
`🎨→Paintbrush`, `🪧→Signpost`, `🌊→Droplets`, `🌿→Trees`,
`🦅→Bird`, `⛔→Ban`, `📡→RadioTower`, `📋→ClipboardList`. All in
the existing `lucide-react@0.563.0` — no dep change.

The interesting bit was the COP marker: the existing implementation
sets `el.textContent = emoji` on a DOM div built imperatively, and
React JSX doesn't compose into that. Solution: a tiny helper
`renderLucideToSvgString(Icon, opts)` in a brand-new
`lib/render-lucide-svg.ts` that uses `react-dom/server`'s
`renderToStaticMarkup(createElement(Icon, props))` to produce an SVG
string the marker can drop into `innerHTML`. Two caveats —
`@types/react-dom` isn't installed in this repo, so a tiny ambient
declaration `types/react-dom-server.d.ts` types just the one symbol;
and Next.js 14 forbids `react-dom/server` from any module reachable
from a Server Component, so the helper had to live in its own client-
only file rather than `lib/utils.ts` (which is reached from
`app/api/infrastructure-import/route.ts` via `lib/supabase/server.ts`).

Native `<select>` sites (`modals.tsx:227`,
`simple-discrepancy-panel.tsx:372`) drop the icon entirely — `<option>`
can't hold SVG, and converting to custom dropdowns was out of scope.

### InfoWindow close-button overlay (`70f33aa`, `d315f1a`)

User flagged via screenshots that the Google Maps InfoWindow's default
X button takes its own row above the content, leaving an empty band
that makes the popups look unfinished — most visibly on the
discrepancy COP (dark card) and the Visual NAVAID popup on
`/infrastructure`. The X lives in `.gm-style-iw-chr`, a row Google
renders ahead of `.gm-style-iw-d` (the content div).

Global fix in `app/globals.css`: anchor `.gm-style-iw-c` with
`position: relative`, then absolute-position `.gm-style-iw-chr` at
top-right with `min-height: 0` and `padding: 0` so it stops occupying
its own row. Reserve 30px of right padding on `.gm-style-iw-d`
globally so titles don't collide with the floating X. Update the two
existing per-component scoped overrides (the discrepancy COP's
`<style jsx global>` block and the infrastructure popup's `<style>`
block) to widen their right padding correspondingly — without that
the per-component `.gm-style-iw-d { padding: 10px 12px !important }`
would cancel the global rule. Waivers and obstructions had no
per-component CSS, so they pick up the overlay automatically with
Google's default white chrome.

First commit pinned the X at `top: 0; right: 0` and shipped — but the
28×28 button overflowed the rounded-corner edge and the X glyph
rendered partially clipped. Follow-up `d315f1a` insets to
`top: 4px; right: 4px`, shrinks the button to 22×22, and constrains
the inner glyph span to 14×14 so the X sits cleanly inside the
chrome.

### Per-type icon colors (`d5d8577`)

After the icons shipped in monochrome white, the user asked for
color-coding so types are readable at a glance on the COP. Adds a
`color: string` field to each `DISCREPANCY_TYPES` entry and threads
it through all seven render sites. Both COP markers pass `color` into
`renderLucideToSvgString`; the legend, dropdown, detail row, CES
queue, and filter chips render `<Icon color={t.color} />`. Legend
dimming for inactive filter types now drops to `opacity: 0.5` instead
of swapping the icon color out — the brand color stays the
differentiator.

Palette picked for separability against the dark COP marker
background:
```
fod_hazard   #EF4444 red       obstruction  #B91C1C dark red
pavement     #F97316 orange    lighting     #FACC15 yellow
marking      #EC4899 pink      signage      #60A5FA sky blue
drainage     #2DD4BF teal      vegetation   #22C55E green
wildlife     #A3E635 lime      navaid       #A855F7 purple
other        #94A3B8 slate
```

vegetation/wildlife are both green-family but the icons (Trees vs
Bird) differentiate them; same for fod_hazard/obstruction in the red
family (AlertTriangle vs Ban).

### Base-setup IAW citation sync (`572a7db`)

User worked through every step in `docs/base-setup-guide-review.md`
flipping Status to REVIEWED. Sync the per-step `cite: { reg, para,
outcome }` triples back into `lib/base-setup-guide.ts` verbatim.
Notable changes:

- Steps 1 (Runways) and 14 (Custom Status Boards) flagged as having
  no DAFMAN compliance hook — administrative or operationally-
  specific configuration. To support this without a sentinel hack,
  `StepGuide.cite` is now `GuideCite | null` and
  `formatComplianceStatement` renders an admin notice line when
  `null`. The `GuidePanel.tsx` consumer needed no change since it
  already passed `guide.cite` through opaquely.
- Step 3 (Taxiways) re-cited from `UFC 3-260-01 §Ch. 3` to
  `§5-5 + Table 5-1` with an outcome explicitly tied to Fixed-Wing
  Taxiway clearance ("with the drop of a pen rather than using a
  measuring wheel").
- Step 10 (QRC) reg switched from `AFMAN 91-203` to
  `DAFMAN 13-204v2 §2.5.2.8`.
- Step 12 (Wildlife) reg corrected `DAFMAN 91-212` → `DAFI 91-212`.
- The leading "needs verification" comment at the top of
  `lib/base-setup-guide.ts` is removed since these are now user-
  verified.

### Base-setup W/H/W prose + typo carryovers (`a6b63ef`)

Round-two sync after the user authorized syncing the divergent
What/How/Why prose for the seven steps where the doc and source
diverged, plus cleaning up the typos that came across in the
verbatim IAW sync.

Prose changes per step:
- **Step 1 (Runways):** drop the closed-runway clause and the
  "DAFMAN bar-out detection cannot run" tail.
- **Step 3 (Taxiways):** rewritten around the Obstruction Evaluation
  Tool centerline workflow (KML/GeoJSON import + point-drop
  centerlines) — replaces the parking-clearance + lighting-grouping
  framing.
- **Step 4 (NAVAIDs):** AFM → AMOPS terminology, drops shift-sign-off
  references for the events log + Daily Operations rollup, removes
  the auto-create-on-red mention.
- **Step 6 (ARFF):** full rewrite around aircraft-types model, drops
  the vehicle-by-callsign concept, AFM → AMOPS, references Events
  Log.
- **Step 7 (Facilities):** removes AF Form 483 / contractor escort
  references; tightens the discrepancy examples.
- **Steps 9, 13:** essentially identical between source and doc on
  read-through; explore agent's "diverged" flag was false-positive
  on punctuation.

Typo cleanup: `documentaiton` → `documentation`, `excute` →
`execute`, `centeralized` → `centralized`, `hazardous throughout` →
`hazards throughout`, `calcuated` → `calculated`, `eventus log` →
`events log`, `taking by AMOPS` → `taken by AMOPS`,
`and and monthly` → `and monthly`. The user's normal practice is to
sync verbatim and surface typos as a separate review item — they
authorized the cleanup explicitly this round.

### /more — Glidepath Training under Reference (`cba5a67`)

Trivial. Sidebar (`lib/sidebar-config.ts:73`) groups `/training` under
"Reference"; the `/more` page (`app/(app)/more/page.tsx:66`) had it
under "Admin". Move it on `/more` to match. Two-place hardcoded
module lists is the underlying drift risk — flagged for backlog
below.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050400_bases_qrc_review_interval.sql` | ✅ Applied | Adds `bases.qrc_review_interval` (TEXT, default `'monthly'`, CHECK monthly/quarterly). Applied this session. |
| `2026050300_qrc_monthly_reviews.sql` | ✅ Applied | (Carryover) Per-user monthly QRC review event table. |
| All prior migrations through `2026050202` | ✅ Applied | (carryover) |

No new migrations this session.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| InfoWindow X glyph clipped at the chrome's right edge after the first overlay attempt | `top: 0; right: 0` on `.gm-style-iw-chr` plus a 28×28 button overflowed the card's rounded corner. The button bounds extended past the chrome border, clipping the X. | `d315f1a` |
| `react-dom/server` import in `lib/utils.ts` failed Next.js build with "imports react-dom/server… render or return the content directly as a Server Component instead" | Next 14 bans the import from any module reachable from a Server Component, even if the symbol is unused server-side. `lib/utils.ts` is reached from `app/api/infrastructure-import/route.ts` via `lib/supabase/server.ts`. | `05d8c79` (resolved by extracting the helper to `lib/render-lucide-svg.ts`) |

---

## Lessons from this session

- **`react-dom/server` lives on the wrong side of Next 14's
  Server/Client boundary.** If a helper renders React to a string for
  imperative DOM injection, put it in its own file imported only by
  `'use client'` modules — never in a shared `lib/utils.ts`-style
  file that server code might transit. The error message is clear
  ("To fix it, render or return the content directly as a Server
  Component"), but the import-trace it shows is what tells you which
  intermediary brought it into the server graph. Saved as feedback
  memory candidate but skipped — it's a one-off framework constraint
  rather than a recurring product pattern.
- **Google Maps InfoWindow chrome is overridable per-selector but
  ordering matters.** Per-component `<style jsx global>` blocks emit
  after globals.css in the cascade, so any `.gm-style-iw-d` rule
  there with `!important` will cancel a less-specific global rule.
  When introducing a global Google-chrome rule, audit the existing
  per-component rules and either widen them (the path taken — bumped
  the discrepancy COP and infrastructure padding to clear the X) or
  consolidate them up. Saved as `feedback_gmap_infowindow_widths.md`
  was already implicit on this; today's lesson reinforces it for
  layout fixes specifically.
- **Sidebar and `/more` are not derived from a single config.** The
  user surfaces look like they share a model but each maintains its
  own hardcoded module list (`lib/sidebar-config.ts` vs
  `app/(app)/more/page.tsx`). When a module's section moves, both
  must be touched — and one is easy to forget. Recorded as tech
  debt; a single shared config consumed by both surfaces is the
  obvious cleanup.
- **The doc-as-review-doc pattern continues to work.**
  `docs/base-setup-guide-review.md` proved out the same status-flag
  workflow that `training-modules-review.md` did last session: user
  edits prose in markdown, flips PENDING → REVIEWED, Claude syncs
  back. Less friction than asking the user to edit nested object
  literals in a 538-line TypeScript file. The verbatim-sync rule
  (preserve typos, surface them as a separate review item) held;
  user explicitly authorized the typo cleanup this round.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Sidebar + `/more` parallel hardcoded module lists** | Low | New this session. `lib/sidebar-config.ts` and `app/(app)/more/page.tsx` each maintain their own module → section mapping. When a module's section moves, both must be updated and divergence is easy to miss. Cleanup: extract a shared module-list config and have both surfaces consume it. |
| `lib/tours/pages/*.ts` still present | Low | (Carryover) 28 files retained as content seed for the training rebuild. No imports anywhere; safe to delete in a sweep when convenient. |
| `data-tour` anchors throughout page.tsx files | Low | (Carryover) 70+ anchors no longer used by any active tour (only setup-wizard tour uses them). Harmless dead attributes; sweep is optional cleanup. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | (Carryover) Quick Start has 7 lean steps; Base Setup tab is a placeholder pointing at `/base-config/setup` wizard. Could be expanded over time. |
| FAQ entries on every module are empty | Low | `faq: []` on all 27 modules. Populate as user questions come in. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover) 1.6K LOC of its own. |
| `/infrastructure` perf | Low–Medium | (Carryover) Smooth on dev laptops, may stutter elsewhere. AdvancedMarkerElement migration target. |
| Largest source files | Held | `base-config/setup/page.tsx` ~5.8K LOC, `parking/page.tsx` ~4.7K LOC, `infrastructure/page.tsx` ~4.3K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `docs/training-modules-review.md`, `public/glidepath-logo-dark.jpg`. |
| ~124 `as any` casts | Low | (Carryover) Plus the four in `lib/supabase/qrc-reviews.ts` for the `qrc_monthly_reviews` table type — fine until the next supabase types regeneration sweeps them up. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| Trademark | Held | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration — risk for commercial use. |

---

## Next session tasks

No required next step. The two threads from this session — discrepancy
visual refresh and the base-setup IAW/W-H-W sync — both shipped fully.
The user has been holding a v2.34.0 bump until they're ready; that's
their call when it comes.

Open candidates for next session, none blocking:

- **Bump version to 2.34.0** when the user's ready. This release
  bundle now spans: QRC per-base review interval (Monthly/Quarterly),
  parking aircraft-label toggle + Spot Name → Aircraft Label rename,
  full /training content sync + readability refresh, discrepancy
  emoji → lucide + per-type colors, InfoWindow X overlay polish, and
  the base-setup IAW/W-H-W sync. Five places to bump:
  `package.json`, `app/(app)/settings/page.tsx`,
  `app/(public)/login/page.tsx`, `CHANGELOG.md`, `README.md`. New
  entry in `lib/release-notes.ts`.
- **Sidebar / `/more` shared config refactor.** New tech debt item
  this session. Extract the module-list to a single source of truth
  consumed by both surfaces.

### Long-running carryover (bandwidth-permitting)

- Sweep the unreferenced `lib/tours/pages/*.ts` files + dead
  `data-tour` attributes.
- Move `resolveEffectivePermissions` out of `lib/permissions.ts`
  into a shared module (server + client both import).
- Component extraction in `base-config/setup/page.tsx` (~5.8K LOC).
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.7K LOC).
- "Advisories" → "WWA Notifications" UI sweep.
- Outage analytics, training management, Part 139 civilian template.
- CAC/PIV authentication (blocked on Platform One).

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged)
Build: npm run build clean — no warnings, no errors.
No new migrations this session.

Notable First Load JS (changed routes this session):
  /discrepancies          12 kB / 228 kB     (was 11.x / 227 kB; +icon imports)
  /discrepancies/[id]     9.48 kB / 215 kB
  /discrepancies/new      9.13 kB / 187 kB
  /ces                    5.59 kB / 195 kB
  /infrastructure         36.7 kB / 220 kB   (unchanged at route level — InfoWindow CSS only)
  /more                   7.3 kB / 201 kB    (unchanged — module reorder is in-place)

Largest static page (unchanged): /wildlife 459 kB / 794 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | Discrepancy emoji → lucide icons + per-type color coding; Google Maps InfoWindow X overlay polish; base-setup guide IAW citations + W/H/W prose sync from review doc; QRC per-base review interval (Monthly/Quarterly); parking aircraft-label toggle + Spot Name → Aircraft Label rename; full /training content sync + readability refresh. |
| 2.33.0 | 2026-05-02 | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages with Mark Reviewed toggle; click-through tour torn down; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `lib/render-lucide-svg.ts` — client-only helper rendering a lucide
  icon to an SVG string for COP markers' imperative `innerHTML`
  assignment. Kept out of `lib/utils.ts` because Next.js forbids
  `react-dom/server` from any module reachable from a Server
  Component.
- `types/react-dom-server.d.ts` — minimal ambient declaration for
  `react-dom/server`'s `renderToStaticMarkup` and `renderToString`,
  in lieu of installing `@types/react-dom`.

### Modified files

- `lib/constants.ts` — `DISCREPANCY_TYPES` reshape: `emoji` →
  `icon: LucideIcon` + `color: string` per entry.
- `lib/base-setup-guide.ts` — `StepGuide.cite` now
  `GuideCite | null`; `formatComplianceStatement` handles null;
  every per-step `cite` triple updated; W/H/W prose synced for
  steps 1, 3, 4, 6, 7; eight typo fixes in outcome strings.
- `app/globals.css` — new section: Google Maps InfoWindow close-
  button overlay rules (anchor `.gm-style-iw-c`, float
  `.gm-style-iw-chr`, reserve content `padding-right`).
- `components/discrepancies/discrepancy-map-view-google.tsx` —
  marker `innerHTML` SVG via `renderLucideToSvgString`, legend uses
  per-type color, scoped `.gm-style-iw-d` padding widened.
- `components/discrepancies/discrepancy-map-view.tsx` — same
  changes for the Mapbox sibling.
- `components/discrepancies/modals.tsx` — strip emoji from native
  `<select><option>` (can't hold SVG).
- `components/ui/simple-discrepancy-panel.tsx` — same.
- `app/(app)/discrepancies/new/page.tsx` — custom dropdown shows
  colored lucide icon next to label in pill + option rows.
- `app/(app)/discrepancies/[id]/page.tsx` — DetailGrid Type row
  returns JSX with colored icon per comma-separated type.
- `app/(app)/discrepancies/page.tsx` — list-page filter chips
  prefixed with colored icon.
- `app/(app)/ces/page.tsx` — `getTypeLabel` (string) replaced by
  `renderTypeLabel` (JSX) for queue rows.
- `app/(app)/infrastructure/page.tsx` — scoped `.gm-style-iw`
  padding widened to clear the floating X.
- `app/(app)/more/page.tsx` — Glidepath Training moved from Admin
  to Reference section to match the sidebar.

### Environment changes

None this session.

---

*Seven commits this session pushed to `origin/main`: `05d8c79` →
`70f33aa` → `d315f1a` → `d5d8577` → `572a7db` → `a6b63ef` →
`cba5a67`.*
