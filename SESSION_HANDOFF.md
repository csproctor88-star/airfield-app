# Session Handoff

**Date:** 2026-07-12
**Branch:** `main` (both repos). `airfield-app` **untouched again** — no code
commits, HEAD still `66b9e3ab` (its only local change is this handoff file,
uncommitted by convention). `glidepath-site`: **24 commits**
(`3446e4a..bb80daf`), all **pushed**, tree clean.
**Build:** `glidepath-site` @ `bb80daf` (fresh gate at HEAD): tsc ✓ · lint 0
errors 0 warnings · vitest **123 passed** (23 files) · `npm run build` ✓
(67 routes; `/` 8.35 kB page / 118 kB First Load JS; `/military` &
`/civilian` 180 kB First Load — the explorer client JS lives there now).
**HEAD:** `glidepath-site` `bb80daf` (pushed) · `airfield-app` `66b9e3ab`.
**DB:** no migrations. One linked-DB data write: demo user's
`primary_base_id` flipped to Demo AFB (KDMO) for mil captures — still there.
**Not promoted** — owner owns Vercel promotion. Preview builds from main.

---

## What shipped this session

One repo again, one campaign: the owner audited the live site ("blank,
disjointed, click-heavy, generic black"), picked a navy blue-hour palette,
approved a six-phase **credibility & experience campaign** spec, and we
executed phases 0–4. Phase 4 (the module browser) went through **six
iterations in one session** — side panel → full takeover → radial mind map →
progressive mind map + dialog → left-rail living tree → **product-window
cards** (final, owner-picked from an options menu). Media work moved from
subagent fleets to inline execution mid-session after a ~1M-token cost
callout by the owner.

### Blue-hour navy palette (`033cf87`)

Owner chose variant B "as is": ground `#0A0E16`, panel/surface `#0F141D`,
`surface2 #0C111A`, line `#1F2836`/`#2B3648`, plus a viewport-fixed
`body::after` blue vignette (`rgba(56,120,200,0.07)` radial from top). All
token-level in `tailwind.config.ts` + `globals.css`; kill-list untouched.

### Campaign spec (`d1707cd`)

`docs/superpowers/specs/2026-07-11-credibility-experience-campaign-design.md`
— six phases: captures, day-spine copy sit-down, proof assets, spine
cinematics, module explorer, subpage/photography/report-pack polish. Owner
answered the proof-asset questions: AFM testimonials + named installations
(content owed), founder story **anonymous** (About stays nameless — hard
rule, spec amended).

### Phase 0 — capture production (`56fd03d..cb472b0`, `1fec15b`)

Dedicated Log/Fix/Prove clips recorded for both tracks (previously reused
frames). Three real PII-scrub failures found and fixed in the pipeline
(TreeWalker text-node scrub; detail-anchor waits; post-accordion re-scrub;
plus `958e165` scrubbing a real squadron designation out of a poster via
`scrubReportingUnit` running before poster capture). `cb472b0` re-recorded
all six original clips after the owner spotted the "Glidepath has moved"
banner in frame — the runner now pre-seeds `glidepath-moved-notice-seen` and
`glidepath_theme` in localStorage. **Read-only choreography law holds** (no
form submits, no row creation).

### Phase 1 — owner-verbatim day-spine copy (`b1e0d95`, `e38ff99`, `12c4430`)

Full copy sit-down: every station now a timestamped log-entry header
(`0600Z - begin the daily airfield inspection` …), headline
`0700Z - aircraft are ready to taxi`, kicker deleted, button `▶ Run the day`.
All strings owner-redlined verbatim into `lib/day-spine.ts`. Chips first
baseline-pinned (`e38ff99`), then removed entirely on owner direction
(`12c4430`).

### Phase 2 — proof band (`f9a16dd`)

`lib/proof-content.ts` + `components/home/proof-band.tsx`: testimonials and
installations render **only when real content exists** (null-hides — both
arrays still empty, owner owes quotes + installation-name permissions), plus
an anonymous "Built by an Airfield Manager." strip linking `/about`. About
added to main nav.

### Phase 3 — spine rail, ambient self-play, in-depth clips
(`6b6e04a..b6aa803`)

Spine rebuilt as a lit timeline rail with ambient self-play (9s/station).
`051c20c` fixed two user-caught defects: ambient froze on scroll
(intersection ratio on a variable-height section → two-observer redesign:
fixed-height header starts, whole-section threshold-0 pauses) and clip
stalls (next-clip `<video preload="auto">` prefetch + legacy re-encodes).
The first cinematic treatment (crop/zoom pans) was rejected twice by the
owner ("choppy", "doesn't show what's going on") — root cause chased to
animating filters over variable-frame-rate sources (`c882851`, fps-conform
first) and then to the treatment concept itself: `b6aa803` **reshot all ten
station clips full-frame and in depth** (18–19s choreographed takes using a
rAF-eased `smoothScroll` primitive; `treat-clips.mjs` reduced to a
finish-only grade: fps30, mild contrast/saturation, vignette, vp9 crf42,
≤1.5 MB budget). Owner: clips acceptable for now, **video quality revisit
parked** ("we can come back to this video").

### Phase 4 — the module browser saga (`c6f984b..bb80daf`)

Six forms in one session; each rejection sharpened the brief:

- `c6f984b` in-place explorer with side detail panel — "not hitting the
  mark, animation needs to be grander, show full details".
- `b7d41e6` full takeover (grid-rows morph, module rail on top) — "tab with
  a scroll bar is NOT the look".
- `a096513` radial mind map (hub + 26 nodes) — owner proposed progressive
  disclosure instead.
- `31ab095` hub + 4 section nodes, bloom on click, **module dialog** that
  zooms out of the clicked node (`--zoom-from` set from the node's screen
  rect; CSS var inside keyframes), Esc/backdrop/✕, body scroll lock,
  `?module=` deep links preserved.
- `19803fd` left-rail tree (root → sections stacked left → modules spawn
  right; ref: 50-jahre-hitparade.ch) with a **life layer**: ambient float +
  cursor magnetism via one rAF spring loop writing to a dedicated wrapper
  transform layer. Owner verdict: "eh… seems too basic, lacks the cards'
  detail" — mind map concept dropped.
- `bb80daf` **product-window cards** (owner picked from a 3-option
  AskUserQuestion with previews): every card is the module's real capture +
  name + tagline, grouped under the four section headers
  (`MODULE_BRANCHES`); hover = 2.4s capture zoom + border ignite + cursor
  tilt (perspective transform, direct style writes); seven cards play their
  day-spine workflow clip inline on hover (`MODULE_CLIPS` in
  `lib/module-map.ts` — only clips that unambiguously depict that module;
  prove/log-civ stayed unmapped per caption-accuracy rule). Dialog kept,
  now zooming from the card's rect **position and size** (reads as the card
  expanding). `module-mind-map.tsx` deleted; map keyframes removed.

## Migrations status

No new migrations. `2026070900_email_broadcasts` remains the latest applied.

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Real name survived scrub in report detail | leaf-element scrub missed nested "Filed By" text → TreeWalker; name-wait satisfied by list DOM → anchor on detail-only marker; accordion content mounted post-prep → re-scrub after expansion | `0ccda20`/`d5c9bb7` |
| Real squadron in mil-prove poster | poster captured before clip `prep` ran → runner runs prep first | `958e165` |
| Migration banner in every clip | fresh Playwright contexts lack the seen-key → pre-seed localStorage | `cb472b0` |
| Ambient spine froze after user scroll | IO ratio on variable-height section | `051c20c` |
| Cinematic clips choppy | animated filters over VFR sources; fixed with fps-conform, then treatment redesigned entirely | `c882851`, `b6aa803` |
| Dialog zoom origin dead / stale | keyframe transform fill-mode overrides positioning + dim transforms → 3-layer node (position button > rAF wrapper > ignite span) | `19803fd` |
| Card buttons unfindable by name | `img alt` + "▶ plays" chip precede the title in DOM → pollute the accessible name (`alt=""` + `aria-hidden`) | `bb80daf` |
| Contract sweeps flaky in CI-size runs | 22–26 dialog cycles vs full-page DOM exceed vitest's 5s default → explicit 20–30s timeouts | `bb80daf` |

## Lessons from this session

- **Owner's design bar, sharpened:** structure without substance fails (mind
  maps), substance without life fails (flat cards). The product's own
  captures ARE the wow; canned CSS eases read "generic" — continuous/
  physics-y motion (float, magnetism, tilt) reads alive. Reference he rates:
  50-jahre-hitparade.ch.
- **After repeated rejections, switch to an options menu.** The
  AskUserQuestion with ASCII previews (cards vs strips vs tree+thumbnails)
  ended a six-iteration loop in one exchange.
- **CSS keyframe fill-mode overrides transitions on the same element.**
  Any node needing entrance keyframes AND later transform transitions needs
  separate transform layers (or drop the animation after it settles).
- **Button accessible names concatenate img alt + every child span.**
  Decorative captures inside labeled cards get `alt=""`; affordance chips
  get `aria-hidden`.
- **Media/capture tasks run inline, not SDD** — subagent ceremony burned
  ~1M tokens for two tasks before the owner called it (saved to memory).
- **PowerShell mangles `git commit -m` with embedded quotes** — write the
  message to a file and `git commit -F`.

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Track-page lead copy stale | **high** | `/military` + `/civilian` intro still says "the modules with a full page … the rest ship next" — false (all 26 have pages) and it references the dead wall layout. Owner to supply the line or ask for drafts. |
| Proof band empty | med | testimonials + installations null-hidden until owner delivers quotes (rank/role attribution) + installation-name permissions → `lib/proof-content.ts`. |
| Notify-station citations unverified | med | carried: owner to confirm `DAFMAN 13-204` (mil) / `14 CFR §139.339` (civ), then render chips. |
| Spine video quality revisit | med | owner parked it; per-take tuning = choreography tweaks + `treat-clips --only` re-records. |
| Day-spine verbatim check | low | composed s1-mil line + `❚❚ Pause` label never explicitly owner-confirmed. |
| OG images old palette | med | carried; even staler vs navy. Regen held by owner. |
| App-side dual-mode miss | med | **airfield-app bug**: civilian tenant status chips read "TO CES / TO AFM / AWAIT CES" — visible in civ captures until fixed app-side. |
| Facts bar + security copy rework | med | carried; `send-pdf-email` wording tightening still queued. |
| Messaging buckets B/C | med | carried: deployment-proof claim, pricing facts, sample-report CTA. |
| Prior app-side carryover | low | dual-mode terminology sweep; status-page weather race; account-deactivation live sessions; Selfridge 1098 dedup. |
| Demo user on Demo AFB | low | `primary_base_id` still KDMO; flip to KDRA before any civilian capture work. |

## Next session tasks

1. **Owner verdict on product-window cards** — feel the tilt/hover-clips on
   the Vercel preview (Playwright recordings undersell motion). Dials
   (tilt degrees, zoom scale, pull radius) are one-liners if he wants more
   or less.
2. **Replace the track-page lead copy** (the "rest ship next" line) —
   blocked on owner wording or a request for drafts.
3. **Campaign Phase 5** — Higgsfield photography (owner per-image approval)
   + two-column subpage layouts (`/platform`, module pages).
4. **Campaign Phase 6** — ungated sample report pack (demo-base PDFs),
   60–90s video tour, OG regen (owner sign-off).
5. **Owner content queue:** proof quotes + installation permissions ·
   notify-citation confirmations · day-spine verbatim check.

### Long-running carryover
Spine video quality revisit · SEO / rich-results · deferred audit items ·
Next 16 — owner-scheduled, unchanged.

---

## Build snapshot
```
glidepath-site @ bb80daf (fresh, at HEAD): tsc ✓ · lint 0 errors 0 warnings ·
  npx vitest run 123 passed (23 files) · npm run build ✓ 67 routes.
  / 8.35 kB page / 118 kB First Load JS · /military & /civilian 138 B page /
  180 kB First Load (explorer + card grid client JS) · module pages 110 kB.
  All routes static except /api/demo.
airfield-app @ 66b9e3ab: UNTOUCHED this session (snapshot carried from
  2026-07-10: lint 0 errors · 1179 passed / 16 skipped · build ✓).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-12 | glidepath-site credibility campaign phases 0–4: navy blue-hour palette · PII-hardened capture pipeline + 10 full-frame station clips · owner-verbatim day-spine timeline copy · proof band (null-hidden) · spine rail w/ ambient self-play · module browser rebuilt six times, landing on **product-window cards** (capture cards w/ hover clips + tilt, card-expanding dialog). |
| **Unreleased** | 2026-07-11 | glidepath-site homepage rebuilt twice: cinematic **blue-hour hero + disciplined-dark foundation** (kill-list-guarded), then the **Operational Day spine** (five stations, dual-track toggle, play-the-day, episodic row) replacing demo player + capability sections. PR #1 merged. airfield-app untouched. |
| **Unreleased** | 2026-07-05..10 | Marketing roster 36→50 + Part 139 cert-audit; owner-testing bug sweep; Help & Training overhaul; Phase 5 apex cutover; broadcast email; `.mil` deliverability fix; agency-plural fix + SCN nav. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session (all glidepath-site)

### New files
- `components/modules/module-card-grid.tsx` — product-window cards (final browser form).
- `components/modules/module-explorer.tsx` — selection/URL/dialog owner (rewritten across iterations; dialog zooms from card rect).
- `lib/module-map.ts` — `MODULE_BRANCHES` (4 sections/track, guard-tested), `HUB_LABELS`, `MODULE_CLIPS`.
- `lib/proof-content.ts` + `components/home/proof-band.tsx` — null-hiding proof infrastructure.
- `scripts/treat-clips.mjs` — finish-only clip grade; `--only` re-render flag.
- `docs/superpowers/specs/2026-07-11-credibility-experience-campaign-design.md` — campaign spec of record.
- `public/screenshots/cine/*` — 10 station clips + posters (full-frame takes).

### Modified files
- `tailwind.config.ts` + `app/globals.css` — navy tokens, vignette, `card-in`/`dialog-zoom` keyframes (map keyframes added then removed).
- `lib/day-spine.ts` + `components/home/day-spine.tsx` — owner-verbatim copy, rail treatment, ambient self-play, dedicated clip wiring.
- `scripts/capture-manifest.mjs` + `scripts/capture-screenshots.mjs` — smoothScroll, TreeWalker PII scrubs, localStorage pre-seed, in-depth ACTIONS.
- `components/home/hero.tsx`, `components/layout/site-header.tsx` — accent/nav follow-ups.
- Deleted: `components/modules/module-grid.tsx`, `components/modules/module-mind-map.tsx`.
