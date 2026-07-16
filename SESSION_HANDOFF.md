# Session Handoff

**Date:** 2026-07-15
**Branch:** `main` (both repos). `airfield-app`: **0 commits** this session
(HEAD unchanged; media-day session — all code work was site-side), tree
clean (this handoff is the only modified file). `glidepath-site`:
**5 commits** (`388ea3f..1514702`), all **pushed**, tree clean.
**Build:** `airfield-app` @ `1373a0b6` (re-verified at wrap, pipefail, cwd
pinned): tsc ✓ · lint 0 errors · vitest **1229 passed | 16 skipped** ·
`npm run build` ✓ (middleware 80.8 kB). `glidepath-site` @ `1514702`:
tsc ✓ · lint 0/0 · vitest **143 passed** (22 files, +1 media guard) ·
build ✓.
**HEAD:** `airfield-app` `1373a0b6` · `glidepath-site` `1514702`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied.

---

## What shipped this session

Media day, executed same-day end to end: the owner recorded six module
walkthroughs and shot 21 stills; by end of session **every one of the 26
military module pages carries owner media** (7 clips + 19 stills), the
homepage PPR asset serves both surfaces, and the visual-NAVAIDs module
clip is the true two-story re-record. All five commits are site-side;
airfield-app saw no code changes (its gitignored `docs/references/`
archive gained the full-quality sources + the civilian capture plan).

### glidepath-site: five module clips (`388ea3f`)

Batch 2 of owner walkthroughs, converted with the house recipe (1280w
H.264 CRF24 muted+faststart, poster each): airfield-status (51s — runway
swap, suspension w/ DAFMAN 6.2.2 resume time, glideslope to YELLOW,
ending on the events log showing every action auto-written), discrepancies
(124s source cut to 83s with the PPR-precedent 6× time-lapse over the
form fill, 8s–58s; boundary/factor are one-line params), obstructions
(43s — 125ft crane, violation with the verify-the-numbers math on
screen), parking-plans (60s — taxilane drawing, 4× C-130, plan PDF),
wildlife-bash (75s — sighting → heatmap → DAFMAN 91-212 monthly PDF).
The cascade slots' file-existence invariant now covers module pages too
(new guard in `tests/module-content.test.ts`). Two of the seven shared
links were duds — a truncated file ID (32 chars; Drive IDs run 33) and a
re-export of the *old* NAVAIDs clip, caught by md5 against the archive.

### glidepath-site: NAVAIDs interim swap + PPR reuse (`8193aaf`)

Interim step while the re-record was pending: the owner's titleless
re-export of the old NAVAIDs recording replaced the live clip (binary
swap, same filenames), and the PPR module page was wired to the same
converted asset as the homepage cascade (`/media/ppr-request.mp4`) after
the owner's "ppr-hp-module" upload proved byte-identical to the already
archived 63.5s source — one recording, both surfaces, no duplicate binary.

### glidepath-site: 16 stills + the true NAVAIDs re-record (`2073695`)

The owner shot the entire still-tier of the module rundown in one pass.
All 16 wired as `ownerMedia` image slots with in-frame-accurate alt text
(alt strings ride into the terminology guards via `MODULE_PAGES`, so
they're em-dash/banned-term checked). Curation calls: `acsi` took the
graded-fail frame over the `acsi2` detail view; `reports` initially took
the clean preview page because the rendered-PDF frame showed a
keyboard-mash "RESOLUTION: hgjhj" row; `ces-work-orders` was **held** —
its header read "Selfridge ANG Base (KMTC)" (real base, real queue).
The visual-navaids module clip was replaced with the true re-record
(73.5s vs the old 32.4s): both outage stories — zero-tolerance mandatory
sign AND taxiway edge lights — each landing on the CE Electrical work
order callout.

### glidepath-site: final owner calls (`0c2e3f2`, `1514702`)

Owner rulings on everything held or flagged: checks + dashboard stills
wired (check-type picker over recent history; populated widget board);
`reports` swapped to the rendered PDF frame he prefers ("hgjhj … isn't
going to be that much of a focus"); and the CES still shipped with the
header **cropped off** after he was shown the Selfridge line he'd missed
("crop the header off") — the frame now opens on the shop chips, no base
name anywhere. Push explicitly authorized; all five commits live on
origin.

### Clip house style — settled

The 3D-tilt rule got its full arc this session: owner accepted tilt on
the re-export, reversed ("they should all match"), re-recorded, then
accepted the re-record's residual template tilt (opening beat + one
section break; straight-on body). Calibrated rule, saved to memory:
brief template tilt as intro/section punctuation is tolerated; tilt as
the primary framing is not. Keep flagging tilt beats; owner decides per
clip.

### Civilian capture plan written

`docs/references/civilian-capture-plan.md` (local-only, gitignored):
6 recordings + 18 stills → 24 of 25 civilian pages plus all three
homepage cascade slots in civilian dialect. Shot scripts quote the
`lib/cascades.ts` part139 lines each clip must back (incl. the arrivals
calendar beat the military PPR cut never showed). Files prefixed `civ-`
to avoid `public/media/` slug collisions. Deliberately excluded:
`part-139-inspection` (waits for the cert-audit build) and
`modifications-exemptions` (gated). Trigger phrase on capture day:
**"prep KDRA"** → run the pre-flight (demo-user flip KDMO→KDRA, seed
density audit, `enabled_modules` check, verify the lights flow in
civilian dialect, clean junk demo rows) before the owner records.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Latest migration; nothing new this session |

## Bugs fixed during the session

None — no app code changed. (The site work surfaced no code bugs; the
two bad uploads were data problems caught in screening.)

## Lessons from this session

- **md5 incoming "new" media against the archive before converting.**
  Two of seven uploads weren't new: one was byte-identical to the
  already-used PPR source (which settled what "ppr-hp-module" meant),
  and one was a re-export of the old NAVAIDs recording (identical frames
  at the same timestamps, same 32.400s duration). Seconds of hashing
  saved two wasted conversions and a wrong wiring.
- **A 32-char Drive file ID is a truncated paste, not a permissions
  problem.** Drive IDs run 33 chars; count before diagnosing. The
  folder-share flow (scrape `embeddedfolderview` for id/name pairs)
  eliminates per-link transcription loss entirely — prefer it.
- **Screening catches what filenames can't.** The CES still was captured
  on the owner's real base with the base named in the header — and the
  owner's initial approval explicitly rested on believing it wasn't
  identifiable. Showing him the header crop (rather than wiring on his
  mistaken premise) got the right call in one round trip.
- **Alt text is guarded copy.** `MODULE_PAGES` flows into
  `terminology.test.ts`'s `allCopy()`, so ownerMedia alt strings are
  subject to the em-dash and banned-term rules like any site copy.

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Hero redline strings | med | Carry: owner preview pass still owed on "See it happen ↓" CTA · coverage band title/line split · the three ↳ automation lines · the dialect ethos pair. `lib/home-content.ts` / `lib/cascades.ts`. |
| Anonymous-submission gap 2026-07-02..14 | info | Carry: owner decides if outreach is warranted; nothing queryable from our side. |
| reports still shows "hgjhj" resolution row | low | Owner accepted ("not a focus"). If the demo row gets cleaned and the PDF regenerated, the swap is drop-in. |
| NAVAIDs module clip: template tilt on 2 beats | info | Owner accepted. Re-export swap is turnkey if he changes his mind. |
| Dashboard still: light theme + ad overlay | low | Owner-supplied capture; flight-tracker widget shows adsbexchange ad junk and it's the one light-theme still on a dark site. Cosmetic; re-capture swaps in turnkey. |
| Discrepancies clip: demo typo "RWY 16" vs 06R/24L | info | In the recorded demo data; flashes by at 6×. Also visible in `acsi2` (unused). |
| Demo user on Demo AFB | med | Now the civilian blocker: "prep KDRA" pre-flight is step 0 of the capture plan (`docs/references/civilian-capture-plan.md`). |
| Proof band empty | med | Carry: testimonials + permissions owed by owner; null-hidden. |
| NAVAID marker-sizing dials | low | Carry; dials in `lib/infrastructure/marker-scale.ts`. |
| QRC draft flow not browser-driven | low | Carry: create→close→resume dialog loop deserves one hands-on pass. |
| Demo seeds don't copy `shift_name_*` | low | Carry. |
| `modifications-exemptions` (civilian) | low | Stays gated (owner decision 2026-07-13) until the app feature ships. |
| Track pages no longer link to `/[slug]` | low | Watch SEO; module pages remain SSG'd and now all carry media. |
| Cosmetic | low | Stray blank line in 51 module content files; `modules-data` header em dashes (unrendered). |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode miss · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |

## Next session tasks

1. **Civilian capture day** (owner-scheduled, "a different day"): owner
   says **"prep KDRA"** → run the pre-flight in the capture plan
   (`docs/references/civilian-capture-plan.md`), then he records
   6 clips + 18 stills (`civ-` prefix, same Drive folder). Pipeline is
   proven turnkey from there.
2. **Hero + coverage redline pass** on the live homepage (carryover;
   strings in the tech-debt row). Check the ethos line in both dialects.
3. **Anonymous-submission gap decision** — owner's call.
4. **QRC drafts hands-on pass** on the promoted build.
5. **Part 139 cert-inspection audit build** — resume from
   `.superpowers/sdd/progress.md` when the owner wants it; the
   `part-139-inspection` module clip waits on it.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ 1373a0b6 (re-verified at wrap; code unchanged since
  49da6526): tsc ✓ · lint 0 errors · vitest 1229 passed | 16 skipped
  (137 files) · build ✓ · middleware 80.8 kB.
glidepath-site @ 1514702: tsc ✓ · lint 0/0 · vitest 143 passed (22
  files; +1: module ownerMedia file-existence guard) · build ✓.
  public/media/ now ~46MB: 9 mp4 (7 module clips, 2 of which shared
  with cascade slots, + visual-navaids-hp + aircraft-parking cascade
  clips) + 19 stills + posters. Largest asset: visual-navaids.mp4
  10.0MB (73.5s).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-15 | glidepath-site military track **media-complete**: 7 owner clips + 19 stills across all 26 military module pages · NAVAIDs two-story re-record · PPR asset shared cascade+module · CES still header-cropped (identifiability call) · module ownerMedia existence guard · civilian capture plan written. airfield-app: no code changes. |
| **Unreleased** | 2026-07-14 (late) | Military homepage cascade complete (NAVAIDs/PPR/Parking clips, PPR with 6× fill time-lapse) · spall vignette → PPR cascade · hero rebuilt "facts are the hero" + track-aware "Built by an Airfield Manager" · module-row affordance · 960px media cap default · OG regen + photo-backed share cards (home/tracks) · **airfield-app: 12-day anonymous public-form outage fixed** (middleware allowlist). |
| **Unreleased** | 2026-07-14 | Report Outage type→shop routing (+ alert copy) · QRC editor localStorage drafts · NAVAID three-stage marker sizing + light clamps · site: owner redlines, NAVAID cascade line, first Phase 4 clip wired. |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts: 1–3 per base, renameable; migration `2026071300` applied. |
| **Unreleased** | 2026-07-12 (late) | glidepath-site cascade rebuild: homepage cascade vignettes; track-page module stack + zoom dialog; 50 module pages restructured. |
| **Unreleased** | 2026-07-11..12 | Homepage rebuilt twice; credibility campaign superseded same day. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### glidepath-site
- `lib/modules/military/*.ts` — all 26 files now carry `ownerMedia`
  (7 video slots, 19 image slots with alt text).
- `tests/module-content.test.ts` — ownerMedia file-existence guard
  (mirrors the cascade invariant).
- `public/media/` — +5 module clips, +19 stills, +posters; NAVAIDs clip
  and poster replaced twice (titleless re-export, then the re-record).

### airfield-app (local-only, gitignored)
- `docs/references/civilian-capture-plan.md` — **new**; the civilian
  shot list + pre-flight.
- `docs/references/Screenshots/` — full-quality sources archived for all
  six recordings and 22 stills (incl. the unused `acsi2`, `checks2`,
  `reports` PDF original, and the pre-crop CES capture).
