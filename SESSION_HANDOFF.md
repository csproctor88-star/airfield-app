# Session Handoff

**Date:** 2026-07-12 (second session this date — evening/night)
**Branch:** `main` (both repos). `airfield-app` untouched (HEAD `66930fe6`,
which is just the prior handoff commit). `glidepath-site`: **43 commits**
(`bb80daf..bd07c58`), all **pushed**, tree clean.
**Build:** `glidepath-site` @ `bd07c58` (gate ran fresh at HEAD): tsc ✓ ·
lint 0 errors 0 warnings · vitest **139 passed** (22 files) · `npm run build`
✓ (67 routes, all static/SSG). `/military` + `/civilian` ~110 kB First Load
(down from 180 kB at session start); `/` ~117 kB; module `[slug]` pages
~110 kB.
**HEAD:** `glidepath-site` `bd07c58` (pushed) · `airfield-app` `66930fe6`.
**DB:** no migrations. Demo user's `primary_base_id` still on Demo AFB.
**Not promoted** — owner owns Vercel promotion. Preview builds from main.

---

## What shipped this session

The owner came in ready to scrap the site ("nothing about it gets me
excited... as an airfield management nerd") and left saying "Holy shit...
I think we might be there." In between: the credibility campaign was
retired, a new spec was written around the owner's real brief ("blows
people's minds when they start clicking around"; buyer mental model =
"make my life easier and still keep the airfield safe"), and the entire
presentation layer was rebuilt in three SDD phases plus a long
owner-driven iteration loop on the module browser that ended, after ~13
forms across two days, on a design built from the owner's own sketch.
Spec of record: `docs/superpowers/specs/2026-07-12-cascade-rebuild-design.md`
(supersedes the credibility campaign). Full execution ledger:
`glidepath-site/.superpowers/sdd/progress.md`.

### Strategy reset + cascade spec (`bb007d6..b23b6a4`)

Two founding premises died: "competitors show product immediately" (owner's
own comparison found the opposite) and "narrate the operational day" (owner:
"no airfield manager thinks about their day like that"). New organizing
principle from his live-demo jaw-drop list: **you do the one thing,
Glidepath does everything downstream.** Rules of record: no regulation
chips anywhere; "built on" claims read exactly "DAFMAN and UFC
requirements"; homepage cascade copy citation-free; product imagery only
when accurate and owner-produced (Playwright capture pipeline retired);
scroll-reveal reinstated (kill-list entry lifted); track labels say
"Civilian" never "Part 139".

### Phase 1 — homepage cascades (`e280136..8c27153`)

Day spine deleted wholesale (component, lib, tests, all ten station clips,
`treat-clips.mjs`). Homepage now: hero = cascade #1 ("You close Runway
14/32.") with consequence lines igniting, cascade reel (NAVAID outage /
discrepancy / parking vignettes, Military|Civilian dialect toggle),
coverage band with derived counts, surviving proof band. Every cascade
claim was fact-checked against airfield-app code before shipping (redline
doc: `docs/superpowers/specs/2026-07-12-cascade-copy-redline.md`): status
realtime confirmed (supabase channel, poll is fallback), events-log
drumbeat true for status changes only (dropped from the other vignettes),
CES routing is a submit action (copy softened accordingly). Owner redlined
every string via an editable Google Doc — that round-trip pattern
(mobile-editable doc → controller verbatim diff → frozen into the plan)
ran twice this session and worked well.

### Phase 2 — track pages (`34a6b77..1a4eb02`)

/military and /civilian lead copy rewritten in the owner's voice (the
stale "rest ship next" line is dead; his new four-paragraph military
narrative is the strongest prose on the site). The explorer/card-grid
died; an interim "automation index" shipped and was itself replaced the
same night (below). Citation guard now covers `trackContent`; two taglines
reworded citation-free; `?module=` deep links forward to module pages.

### Phase 3 — module pages (`e0f2d21..11639c4`)

All 50 module pages restructured: hero regCite chip deleted, regulation
cites went plain mono then the whole citation + works-alongside sections
were later removed outright (owner call), screenshots retired from
template + type + all 51 content files (prose verified untouched to the
byte), null-hidden owner-media slots added, prev/next pager in branch
order ends the dead-ends. 82 orphaned capture files deleted; the 4
`/platform` captures survive until Phase 4's photography pass.

### The module stack (`e097652..f2b374b`)

The quiet index read "plain" on desktop and mobile. Owner supplied two
references (madebycat.com/services; studiodunbar.xyz/case/exacq-vision —
both viewed in-browser) and the experience brief ("Whoa it does all of
this?!" / value at a glance / no rabbit-holing). First build over-indexed
on the Dunbar reference (26 scroll-stacked cards — owner: "a bit
excessive"; lesson saved to memory). Final form, iterated live with owner
screenshots and a sketch:

- **Four section cards** sticky-stack on scroll (staggered pins, ascending
  z-indexes), groups renamed by owner: mil "Command & Control, Automated /
  Streamlining Operations / The Airfield Manager's Toolkit / Maintaining
  Readiness & Compliance"; civ "The Whole Picture / … / The Operations
  Toolkit / …". Group titles light italic; module names bold display face.
- Inside each card every module is a **native `<details>` accordion** —
  all collapsed at rest so every name is scannable, name-exclusive per
  section, payload = 2-3 citation-free benefit titles in the homepage's
  `↳` grammar, eased auto-collapse (260 ms WAAPI) once the visitor scrolls
  half a viewport past an open one.
- "Full module page" opens a **top-layer `<dialog>`** (92vw × 88vh) that
  grows out of the clicked module title (transform-origin from the summary
  rect), dims the page (`::backdrop`), closes on click-away/Esc/Back.
  Content = problem → how it works (2-col) → FAQ ("What it automates" cut
  as triple-redundant). Module content lazy-loads via
  `import('@/lib/modules')` on first open — **never static-import
  `lib/modules` from client code**; it drags 50 content files into First
  Load (observed: 110→164 kB before the split into
  `lib/module-stack-content.ts`).
- Ticker of every module name under a "{count} modules. One platform."
  header; breadth is the message.

### Late reversals + trims (`6e80124`, `bd07c58`)

Owner end-of-night round: threshold doors REMOVED (everyone lands straight
on the hero cascade — this also restored the crawlable h1, resolving the
Phase 1 SEO flag), header Military|Civilian toggle removed (nav links
suffice), AFMAN 91-203 purged from all rendered copy (QRCs cite DAFMAN
13-204 V2, their real source), hero photo fade restored (the reel's opaque
`bg-surface2` band had been amputating the photo tail), footer legal name
deduped to the © line only.

## Migrations status

None. `2026070900_email_broadcasts` remains the latest applied.

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| day-spine ambient test broke after adding test stubs | global `IntersectionObserver` stub flips `next/link`'s module-load `typeof` sample onto the observer path | `f3b6615` |
| Stack cards never actually overlapped (dead scroll bands) | `position: sticky` on the card inside its own slot = travel confined to the slot; pin must live on the sibling slots | `763e836` |
| Incoming cards slid BEHIND an open card | `:focus-within` z-lift fired on mouse click focus; replaced with explicit ascending z-indexes + `:has(:focus-visible)` keyboard-only lift | `3f90184` |
| Track pages jumped 110→164 kB First Load | client component value-imported from `lib/module-stack-data`, statically dragging `lib/modules` (50 content files) into the bundle | `28a9be8` |
| Dialog test crash in jsdom | jsdom implements neither `dialog.showModal()` nor `.close()` — both guarded | `9ac1278` |
| Scroll auto-collapse "jolts closed, looks like a glitch" | bare `details.open = false`; now a 260 ms WAAPI height/opacity ease, reduced-motion instant | `9ac1278` |

## Lessons from this session

- **The owner's sentence is the spec.** "Make my life easier and still
  keep the airfield safe" unlocked the homepage; the sketch unlocked the
  module browser. When iterating fails repeatedly, the missing input is
  his articulation, not more execution — ask for the feeling/reference.
- **Synthesize ALL owner references, scaled to the real item count** (saved
  to memory): the 26-card stack came from one of two references; Dunbar's
  pattern was 4 cards.
- **SDD for phases, inline for reworks.** The reviewed-subagent loop caught
  real bugs (the sticky geometry, the ignite-in-static-HTML violation) but
  the owner called out turnaround ("57 minutes?"); design-iteration rounds
  went controller-inline at ~10-15 min each with the full gate intact.
- **Fact-check before copy ships**: three cascade claims would have been
  false (drumbeat on two vignettes, "CES has it" auto-routing). The
  app-side truth also surfaced a real airfield-app inconsistency (below).
- Native `<details name=…>` gives exclusive accordions, no-JS operation,
  and crawlable content for free; jsdom quirks (no dialog methods, no IO)
  are handled by guards that double as old-browser fallbacks.

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Wording queue (redline-on-preview) | med | Strings authored by Claude awaiting owner redline: "modules. One platform." header suffix · "Every module" ticker label · "Full module page" / "Back to modules" dialog labels · the track-page line "Every row is something that Glidepath does for you, automated." (now renders above CARDS, not rows). All in `lib/module-stack-content.ts` / `lib/track-content.ts`. |
| airfield-app: outage auto-create shop | med | `app/(app)/infrastructure/page.tsx:1340,1420` hardcodes `assigned_shop: 'Airfield Management'`; the manual form auto-assigns by type (lighting → CE Electrical) and in-app training copy promises Electrical routing. Fix + deploy, then upgrade the NAVAID cascade line to the owner's stronger wording ("routed to maintenance personnel immediately"). |
| `modifications-exemptions` (civilian) | low | Written content file, never in roster/routes. Owner decision: ship it (add to roster + branches) or delete. |
| Track pages no longer link to `/[slug]` pages | low | Dialog replaced navigation; pages remain SSG'd (sitemap + pager keep them stitched) but internal linking from the stack is gone. Watch SEO; revisit if rankings matter. |
| OG images stale | med | Old palette AND now old titles (QRC metaTitle changed). `npm run og:images` regen held by owner. |
| Proof band empty | med | Testimonials + installation permissions still owed by owner; null-hidden. |
| Owner-media polish (when first asset lands) | low | `owner-media.tsx` video is `autoPlay loop` without reduced-motion gating; hardcoded 1280×720 image dims; AppFrame placeholder branch is production-dead until Phase 4 `/platform` work. |
| Cosmetic | low | Stray blank line in all 51 module content files (screenshot sweep artifact); `modules-data` civilian count comment fixed, header comment em dashes remain (unrendered). |
| Prior app-side carryover | low | Civilian tenant status chips read "TO CES / TO AFM / AWAIT CES" (dual-mode miss) · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |
| Demo user on Demo AFB | low | `primary_base_id` still KDMO; flip to KDRA before civilian capture/photography work. |

## Next session tasks

1. **Owner preview verdict on the final site** — the module dialog feel
   (zoom scale 0.12 / 450 ms), ticker speed (48 s), stack pin stagger
   (16 px steps), auto-collapse threshold (half viewport). All one-line
   dials in `app/globals.css` / `stack-section-card.tsx`.
2. **Wording queue** (table above) — five short strings, one Google-Doc
   round or inline redlines.
3. **Phase 4, owner-paced:** owner records walkthrough media in his demo
   tool (Claude supplies shot lists per slot on request); slots already
   exist on homepage cascades + all 50 module pages + the dialog has room.
   Photography pass replaces the 4 surviving `/platform` captures.
4. **`modifications-exemptions`** ship-or-delete call.
5. **airfield-app:** the Report Outage `assigned_shop` fix (see tech debt)
   — small, high-value, unblocks stronger marketing copy.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 · OG regen — all
owner-scheduled, unchanged.

## Build snapshot
```
glidepath-site @ bd07c58 (fresh, at HEAD): tsc ✓ · lint 0 errors 0 warnings ·
  npx vitest run 139 passed (22 files) · npm run build ✓ 67 routes, all
  static/SSG. /military + /civilian ~110 kB First Load (was 180 kB at
  session start; explorer client JS gone, module content lazy-chunks on
  dialog open) · / ~117 kB · module [slug] pages ~110 kB.
airfield-app @ 66930fe6: UNTOUCHED this session (snapshot carried from
  2026-07-10: lint 0 errors · 1179 passed / 16 skipped · build ✓).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-12 (late) | glidepath-site cascade rebuild: spec + 3 SDD phases + module stack. Homepage = owner-voice cascade vignettes ("you do the one thing, Glidepath does the rest"); track pages = four sticky-stacking section cards with accordion modules and a zoom-from-title module dialog; 50 module pages restructured (chips/citations/screenshots gone, pager added); AFMAN 91-203 purged; doors + header toggle removed same night they shipped. ~13th module-browser form is the keeper ("Holy shit... I think we might be there"). |
| **Unreleased** | 2026-07-12 | glidepath-site credibility campaign phases 0–4 (superseded the same day): navy palette · PII-hardened captures + station clips · day-spine copy · proof band · product-window cards. |
| **Unreleased** | 2026-07-11 | glidepath-site homepage rebuilt twice: blue-hour hero + Operational Day spine. PR #1 merged. |
| **Unreleased** | 2026-07-05..10 | Marketing roster 36→50 + Part 139 cert-audit; owner-testing bug sweep; Help & Training overhaul; Phase 5 apex cutover; broadcast email; `.mil` deliverability fix; agency-plural fix + SCN nav. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session (all glidepath-site)

### New files
- `docs/superpowers/specs/2026-07-12-cascade-rebuild-design.md` — spec of record (supersedes credibility campaign).
- `docs/superpowers/plans/2026-07-12-cascade-rebuild-phase{1,2,3}.md`, `2026-07-12-module-stack.md` — SDD plans.
- `docs/superpowers/specs/2026-07-12-{cascade,track}-copy-redline.md` — owner redline records (Google Doc round-trips).
- `lib/cascades.ts` · `lib/module-stack-data.ts` · `lib/module-stack-content.ts` · `lib/module-page-content.ts` — copy/data sources (all guard-registered).
- `components/home/cascade-band.tsx` · `cascade-reel.tsx` · `coverage-band.tsx` — homepage cascades.
- `components/modules/module-stack.tsx` · `stack-section-card.tsx` (the final browser) · `module-deep-link.tsx`.
- `components/ui/reveal.tsx` · `owner-media.tsx` · `components/providers/track-provider.tsx`.

### Modified files
- `app/page.tsx`, `components/home/hero.tsx` (cascade #1, doors added then removed), `lib/home-content.ts`, `lib/track-content.ts` (owner rewrite), `lib/module-map.ts` (group renames), `lib/modules-data.ts` (2 taglines, QRC regCite), `lib/modules/military/qrc.ts` (91-203 purge), `components/modules/module-page.tsx` (cascade skeleton, sections removed), `app/globals.css` (reveal/ignite/stack/dialog systems), `components/layout/site-header.tsx` + `site-footer.tsx`, `tests/terminology.test.ts` (citation guards), `tests/kill-list.test.ts` (scroll-reveal entry lifted).

### Deleted
- Day spine (component/lib/tests/clips), module explorer + card grid, `treat-clips.mjs`, `public/screenshots/cine/` (20 files), 82 orphaned captures, `header-track-switch.tsx`, `automation-index.tsx` (interim form), `stack-card.tsx` (interim form).
