# Session Handoff

**Date:** 2026-07-14 (late — supersedes the same-day handoff at `770bb22f`;
the session continued through the evening while the owner cut video)
**Branch:** `main` (both repos). `airfield-app`: 1 commit since the prior
handoff (`49da6526`), pushed, tree clean (this handoff is the only
uncommitted file). `glidepath-site`: 11 commits (`4fd72f0..94efc85`), all
**pushed**, tree clean.
**Build:** `airfield-app` @ `49da6526` (gate fresh at HEAD, pipefail, cwd
pinned): tsc ✓ · lint 0 errors · vitest **1229 passed | 16 skipped** ·
`npm run build` ✓ (middleware 80.8 kB). `glidepath-site` @ `94efc85`:
tsc ✓ · lint 0/0 · vitest **142 passed** (22 files) · build ✓.
**HEAD:** `airfield-app` `49da6526` · `glidepath-site` `94efc85`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied. **Promotion:** owner promoted during the session — his footage
shows the shop-routing fix, the alert copy fix, and the unbroken public
PPR form live on prod.

---

## What shipped this session

Phase 4 sprinted to a milestone: **all three military homepage cascade
slots play owner footage** (NAVAIDs, PPR, Parking), the spall vignette was
replaced by a PPR cascade after the strengthened NAVAIDs lines absorbed
its story, the hero was rebuilt around facts instead of narrative, module
rows got a click affordance, and OG images were regenerated. Recording the
pilot's-POV footage also flushed out a 12-day production bug: every
anonymous public form had been dead since July 2.

### airfield-app: `/api/public/*` middleware allowlist (`49da6526`)

The owner hit "Submission failed" recording the public PPR form.
Vercel edge logs showed every anonymous POST to `/api/public/ppr-request`
answered **307 by the middleware** with zero route invocations: commit
`3f5e4dbe` (2026-07-02) had fronted the three anonymous public-write forms
(PPR request, SMS safety report, customer feedback) with rate-limited
server routes but never allowlisted the new paths, so the cookie auth-gate
redirected anonymous POSTs to `/login`. Signed-in testers carry a cookie
and never saw it — only genuinely anonymous visitors failed, for 12 days.
Fix is one allowlist entry (each route rate-limits itself; same precedent
as the M-6 forgot-password fix), locked by regression tests: all three
public paths must pass anonymously, non-public API routes must still gate.

### glidepath-site: cascade media completed (military side)

- `4fd72f0` — **parking clip** (28 s): taxilane envelopes, C-130 drag with
  live wingtip ring and conflict envelope. The cascade action line said
  "C-17" but the footage flies a C-130 — copy aligned to the recording per
  the caption-accuracy rule (owner can re-record with a C-17 and flip it
  back). The cascades guard test ("media slots explicitly null") expired
  with the first real asset; its invariant is now *null, or a well-formed
  asset whose files exist under `public/media/`*.
- `7529059` — **homepage NAVAIDs clip** (31 s), recorded on the promoted
  build: the threshold alert on camera reads "auto-created — assigned to
  CE Electrical", so the footage backs the cascade's routing claim end to
  end.
- `d6f6bb9` / `237e88b` — **PPR clip**: the owner's 63.5 s natural-pace
  recording (phone form → submit → Request Submitted → desktop log showing
  `196-001-XX AWAITING REVIEW`) converted with a **6× time-lapse over the
  form fill (0–37 s)** and real-time beats after; output 32.7 s / 1.2 MB.
  `237e88b` is a drop-in re-render after the owner re-placed a mistimed
  callout in his edit. Conversion boundary + factor are one-line params;
  full-quality source archived in `docs/references/Screenshots/`.

### glidepath-site: PPR vignette replaces the spall vignette (`c2d20e8`)

Owner call: the strengthened NAVAIDs lines absorbed the discrepancy-routing
story, so the reel told it twice. The replacement is the one cascade where
someone *else* does the one thing: a pilot submits the public form and the
work arrives structured. Consequence lines fact-checked per the
capability-truth rule (ppr_number mints at insert on the public path —
`2026042803`; pending PPRs render on the calendar). Reel now covers three
distinct shapes: incident / inbound work / planning math.

### glidepath-site: the facts are the hero (`391f00a`, `881f98c`)

Owner: the runway-close hero was "just words without any real substance"
once the reel below carried footage. New hero: kicker · **"Everything you
do. One Platform."** (promoted from the coverage band) · three ↳ automation
facts (real-time status / auto events log / one-click reports) · the mono
inventory strip · CTAs below the strip (owner layout call). Secondary CTA
is now "See it happen ↓". The coverage band promoted its own line ("Every
module speaks to the others.") to its title; a guard pins it against ever
echoing the h1. `881f98c` makes the strip's ethos item **track-aware**:
"Built by an Airfield Manager" (military default) / "Built by an Airport
Operations Manager" (civilian, chosen as the US-standard title), reading
the app-level TrackProvider and flipping with the toggle or `?track=`.

### glidepath-site: polish + OG (`5bb7071`, `f872d97`, `adbe04a`)

- `5bb7071` — the 960px owner-media width cap became the component default
  (owner: cascade clip too big on desktop); one dial, all surfaces, mobile
  unaffected.
- `f872d97` — module accordion rows now carry a sky mono `+` (rotates to ×
  when open) plus row-hover tint: the rows read as clickable, including on
  touch where hover doesn't exist (owner feedback: no affordance at all).
- `adbe04a` — `npm run og:images` full regen after the owner released the
  hold: 59 of 60 PNGs were already byte-identical; only `military-qrc.png`
  had drifted. Home + QRC cards visually verified on the navy palette.
- `94efc85` — **photo-backed OG cards** for the three share targets
  (owner call): home, `/military`, `/civilian` render over the blue-hour
  hero photo with the homepage grade; the home card mirrors the rebuilt
  hero ("Everything you do. One Platform." + mono inventory strip,
  count derived). SEO metaTitles unchanged; inner pages keep the
  typographic card. All three verified visually.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Latest migration; nothing new this session |

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| All three anonymous public forms (PPR, safety report, feedback) failed with "Submission failed" since 2026-07-02 | `3f5e4dbe` moved them behind `/api/public/*` server hops without allowlisting the paths in the auth middleware — anonymous POSTs 307'd to `/login`; signed-in testers never hit it | `49da6526` |

## Lessons from this session

- **cwd resets when a `cd X && …` chain fails.** A failed site gate left
  later "verification" runs silently executing against airfield-app —
  nine false greens that mislabeled a deterministic failure as a flake.
  Pin gates with `cd <repo> && pwd &&` and sanity-check test counts.
  (Saved as a feedback memory.)
- **"Null until the owner supplies assets" fixtures expire.** Two guard
  tests (module-page, cascade-band) used live content as their "empty"
  fixture and broke the day real assets landed — strip fixtures
  explicitly so the guard outlives the milestone it was written before.
- **Vercel edge logs settle middleware-vs-route questions instantly**:
  307 at the edge with zero function invocations means the handler never
  ran — no app debugging required.
- **Anonymous-POV recording is production QA.** Signed-in testing can
  never catch an auth-gate regression on public forms; the owner's
  pilot's-eye recording did.

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Hero redline strings | med | Owner preview pass owed on: "See it happen ↓" CTA · coverage band title/line split · the three ↳ automation lines · the dialect ethos pair. All in `lib/home-content.ts` / `lib/cascades.ts`. |
| visual-navaids MODULE clip stale frame | med | The module-page/dialog clip (~16 s) still shows pre-fix "assigned to Airfield Management". Re-record now unblocked (fixes are promoted — the homepage clip proves the corrected copy). Owner-paced. |
| Anonymous-submission gap 2026-07-02..14 | info | Failed submissions never reached the DB, so there is nothing to query — any lost pilot PPRs / feedback / safety reports are unknowable from our side. Owner decides if any outreach or a note to bases is warranted. |
| NAVAID marker-sizing dials | low | Three-stage rendering live on prod (owner recorded with it, no complaints); dials in `lib/infrastructure/marker-scale.ts` if wanted. |
| QRC draft flow not browser-driven | low | `lib/qrc-draft.ts` unit-tested; the create→close→resume dialog loop still deserves one hands-on pass. |
| Demo seeds don't copy `shift_name_*` | low | Carry. |
| `modifications-exemptions` (civilian) | low | Stays gated (owner decision 2026-07-13) until the app feature ships. |
| Track pages no longer link to `/[slug]` | low | Watch SEO; module pages remain SSG'd and now carry media. |
| Proof band empty | med | Testimonials + permissions owed by owner; null-hidden. |
| Cosmetic | low | Stray blank line in 51 module content files; `modules-data` header em dashes (unrendered). |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode miss · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |
| Demo user on Demo AFB | low | `primary_base_id` still KDMO; flip to KDRA before civilian capture work. |

## Next session tasks

1. **Hero + coverage redline pass** on the live homepage (strings in the
   tech-debt row). The track-aware ethos line is worth checking in both
   dialects (toggle Civilian on the reel).
2. **Civilian phase**: flip the demo user KDMO → KDRA, then record the
   three civilian cascade clips (737 parking; NAVAIDs and PPR civilian
   dialects) and any civilian module-page clips.
3. **Module-page clips, batch 2** — Discrepancies, Parking,
   Self-Inspections module pages; plus the visual-navaids module clip
   re-record (stale-frame row). Pipeline is proven: drop a file or Drive
   link, conversion/screening/wiring is turnkey.
4. **Anonymous-submission gap decision** (tech-debt row) — owner's call.
5. **QRC drafts hands-on pass** on the promoted build.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ 49da6526 (fresh, pipefail, cwd pinned): tsc ✓ · lint 0
  errors · vitest 1229 passed | 16 skipped (137 files) · build ✓.
  /api/public/ppr-request 107 kB First Load · /[icao]/ppr-request 168 kB ·
  shared 106 kB · middleware 80.8 kB.
glidepath-site @ 94efc85: tsc ✓ · lint 0/0 · vitest 142 passed (22
  files) · build ✓. public/media/ now carries 4 clips + posters
  (visual-navaids 5.6MB · aircraft-parking 2.8MB · visual-navaids-hp
  4.7MB · ppr-request 1.2MB).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-14 (late) | Military homepage cascade complete (NAVAIDs/PPR/Parking clips, PPR with 6× fill time-lapse) · spall vignette → PPR cascade · hero rebuilt "facts are the hero" + track-aware "Built by an Airfield Manager" · module-row affordance · 960px media cap default · OG regen + photo-backed share cards (home/tracks) · **airfield-app: 12-day anonymous public-form outage fixed** (middleware allowlist). |
| **Unreleased** | 2026-07-14 | Report Outage type→shop routing (+ alert copy) · QRC editor localStorage drafts · NAVAID three-stage marker sizing + light clamps · site: owner redlines, NAVAID cascade line, first Phase 4 clip wired. |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts: 1–3 per base, renameable; migration `2026071300` applied. |
| **Unreleased** | 2026-07-12 (late) | glidepath-site cascade rebuild: homepage cascade vignettes; track-page module stack + zoom dialog; 50 module pages restructured. |
| **Unreleased** | 2026-07-11..12 | Homepage rebuilt twice; credibility campaign superseded same day. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### airfield-app
- `middleware.ts` — `/api/public/*` allowlist entry (the fix).

### glidepath-site
- `lib/cascades.ts` — hero object removed · PPR cascade (replaces
  discrepancies) · coverage retitle · navaids/parking/ppr media slots.
- `lib/home-content.ts` — new hero content: title, automations, dialect
  `builtBy` pair, reordered strip.
- `components/home/hero.tsx` — facts-are-the-hero layout, track-aware strip.
- `components/modules/stack-section-card.tsx` — row affordance glyph;
  dialog media slot uses component-default cap.
- `components/ui/owner-media.tsx` — 960px default cap + `className` prop.
- `public/media/` — aircraft-parking, visual-navaids-hp, ppr-request
  (+posters); sources archived in `airfield-app/docs/references/Screenshots/`.
