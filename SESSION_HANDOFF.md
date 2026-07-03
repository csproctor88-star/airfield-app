# Session Handoff

**Date:** 2026-07-03
**Branch:** `main` — pushed, in sync with origin. Working tree clean.
**Build:** tsc ✓ · `npm run build` ✓ · vitest ✓ (all rerun at this wrap).
**HEAD:** `33727e1f` — fix(infrastructure): dedupe the outage tier alert.

This session executed the marketing site's **Phase 2 end-to-end**: the
homepage demo player now runs real dark-mode app footage captured from the
Demo AFB tenant, with real workflows on camera. Chasing capture quality
drove four genuine app fixes back into this repo (demo seed rewrite,
inspection-delete failures, a duplicated outage-alert card, and a jsonb
type trap). Both repos are fully pushed; glidepath-site auto-deploys main,
so the new footage is live.

---

## What shipped this session

### Cloud-branch merge + repo tidy (`68913db3`, `a6d72c74`, `cb1b672d`)
The iPad session's `claude/phase-1-tasks-4-11-ey20xj` branch was merged
(fast-forward, gated green) and deleted on both repos. It carried the
military demo seed and a PWA update toast: installed PWAs rarely re-fetch
`sw.js`, so field devices lag production by weeks (the Volk/Ebbing
question-mark-marker report was a stale bundle) — `PwaUpdateToast` checks
for a fresh worker every 30 min and on foreground, then shows a persistent
Refresh prompt. Also committed the start/wrap session skills so cloud
sessions inherit the same workflow.

### Military demo seed rewritten as a full clone (`24276a81`, `d4ca09c3`)
The cloud session's seed was modeled on `seed-demo-civilian.sql`, whose
Part 139 demo story never touched infrastructure — so Blue Mesa AFB came up
with no Visual NAVAIDs map, no lighting systems, no inspection templates,
and default `enabled_modules`. Remodeled on `seed-demo-base.sql` (the full
clone) against the current schema (five tables gained columns since it was
written), with marketing hardening: no operational rows, no free-text
notes, no QRC templates (real call-tree text), contact fields NULL.
`quick_setup_pending` is jsonb (wizard draft), not a boolean — dropped from
the INSERT so the `'{}'` default applies. **Owner then decided captures use
the existing, lived-in Demo AFB (KDMO) instead**; Blue Mesa stays seeded as
a clean fallback tenant.

### Inspection delete failures surfaced + FK trap defused (`96449684`)
Field-reported: an in-progress inspection would not delete and hard refresh
didn't help. `handleDeleteInProgress` ignored `deleteInspection`'s error
and toasted success regardless, so any failure was invisible. Separately,
`discrepancies.inspection_id` is a NO ACTION FK — an in-progress inspection
that had spawned a discrepancy was undeletable at the DB. Now the handler
surfaces the real error, and `deleteInspection` detaches spawned
discrepancies first (they're real work and outlive a discarded draft).
The stuck row (`AI-2026-GFG8`) was removed via SQL during the session.

### Outage tier alert dedupe (`33727e1f`)
Reporting an outage recalculates the feature's component outage AND the
system's `overall` component for the alert dialog. On single-component
systems (RDR markers) the feature's component IS the overall one, so the
identical card rendered twice (owner screenshot). Skip the overall pass
when it resolves to the same component. Verified on camera in the reshoot.

### glidepath-site: Phase 2 complete — real footage live (`9c42b5b`..`876c526`)
Eleven commits in the site repo (its own history has details). Highlights:
plan corrected where it was written against imagined app behavior (NOTAMs
are a live FAA feed with no local entry — staging them is impossible;
inspection marking is exception-based so "70% complete" isn't stageable);
capture pipeline v2 — dark mode forced, field geolocation, Open-Meteo
intercepted with staged weather (Open-Meteo had a real outage mid-session),
per-scene scripted interactions with post-window undo and ffmpeg trims
(re-encode: Playwright VP8 keyframes ~5s, stream-copy cuts snap); scenes
now perform real workflows — NAVAID status change through the board dialog,
zoom-to-RDR-fixture outage report with the tier alert + auto-discrepancy,
BWC/RSC + discrepancy entry typed on the live inspection, sighting form +
BASH heatmap. Set landed at `76db8cb` (+ `876c526` tail trim); the demo
player renders captures with hand-built scenes as fallback. Demo AFB was
verified restored after every run (29 INOP baseline, all three capture
discrepancies completed, board green except its usual three).

---

## Migrations status

**No new migrations this session.** Latest remains `2026070204` (all
applied per the prior handoff).

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| In-progress inspection won't delete; refresh doesn't help | Handler swallowed `deleteInspection` errors + NO ACTION FK from spawned discrepancies blocks the DB delete | `96449684` |
| Outage alert shows the same card twice | Overall-component pass recomputes the feature's own component on single-component systems | `33727e1f` |
| Military seed 42804 error | `quick_setup_pending` is jsonb (wizard draft), not boolean | `d4ca09c3` |
| Demo tenant missing infrastructure/inspections/checklist | Seed authored from the slim civilian template instead of `seed-demo-base.sql` | `24276a81` |

---

## Lessons from this session

- **Demo seeds must start from `seed-demo-base.sql`** — the civilian seed
  is a slim Part 139 variant; it clones 6 tables, the full clone is ~19.
- **Verify module behavior in code before authoring plan steps.** Two
  Phase 2 staging steps (add NOTAMs, 70%-complete inspection) were written
  against features that don't exist / can't exist.
- **Playwright VP8 records keyframes every ~5 s** — stream-copy `-ss/-t`
  trims snap to the wrong frames; re-encode with libvpx for real cuts.
- **Local `next start` 500s every authenticated request** (plain-text
  middleware error; unauthenticated 307s fine; nothing logged). Dev server
  works. Production on Vercel is unaffected. This is the first concrete
  local repro signal for the outstanding Next 15 runtime QA item.
- **Capture undo must outwait async writes** — Mark Operational closes the
  linked discrepancy after its confirm; closing the browser 1.8 s later
  lost the race on the dev server and left discrepancies open (SQL-fixed;
  wait widened to 5 s).
- **Claims guardrail = identifiability, not provenance** (owner ruling,
  saved to memory): generic ops text cloned from a real base is fine
  in-frame; names/emails/units/phones are not.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Next 15 runtime QA on the promoted build | med | Carried — auth/session, async `createClient` callers, dynamic routes, PWA offline queue, map+form render. **New signal:** local `next start` middleware-500s authenticated requests (see Lessons) — same-family suspect, repro is `npm run build && npm run start` + log in. |
| Status-page weather effect races runway load | low | `app/(app)/page.tsx:194` — empty-dep effect runs before `runways` populate, so no-geolocation browsers query Open-Meteo at 0,0. Fix: re-run when runways land. Captures sidestep it (geolocation granted + mocked weather). |
| Ghost listeners on :3000 / :3001 on this machine | low | Unidentified processes squat both ports (this session served on :3005/:3006 and cleaned up). Worth a `netstat`/kill sweep before the next local-server session. |
| `gh` CLI absent on this machine | low | Carried — plain git; CI via Actions page. |
| Deferred audit items / npm advisories / Selfridge 1098 / local-only reference docs | low | Carried unchanged. |

---

## Next session tasks

**Marketing site — the forward plan:**

1. **Bank the civilian captures** (quick win, ~15 min): in the app, switch
   the demo user's active base to Demo Regional Airport, then from
   glidepath-site run the capture with `--tenant civilian` (5 stills:
   status, self-inspections, SMS, AEP, wildlife — KDRA already carries the
   phase-3 seed's SMS/AEP/WHMP data). These feed Phase 3's civilian pages.
2. **Write the Phase 3 plan** (`docs/plan-phase-3.md` in glidepath-site):
   the ~36 module pages (military ~22, civilian ~14). Needs a per-module
   content model (copy in `lib/` data files, registered with the
   terminology guards), a page template, per-module capture-manifest
   entries reusing the Phase 2 pipeline, and internal linking/SEO
   (sitemap already lists the five nav stubs). Verify module behavior in
   the app code before writing any capture/staging steps — that's now a
   proven failure mode.
3. **Owner owes:** real adoption-stat values for the homepage stats band
   (placeholder-hidden until provided); optionally a handful of clustered
   wildlife sightings on Demo AFB if the heatmap should look hotter
   (reshoot is one `--only wildlife` command).
4. Phases 4 (OG/social images) and 5 (apex domain cutover, owner-executed)
   remain sequenced after Phase 3.

**App backlog (unchanged priority):** Next 15 runtime QA on the promoted
build — now with the local `next start` repro as a starting point.

### Long-running carryover
Deferred audit items, optional Next 16, Selfridge 1098 dedup, local-only
reference docs — unchanged.

---

## Build snapshot

```
airfield-app @ 33727e1f: tsc ✓ · npm run build ✓ (First Load JS shared
106 kB; Middleware 80.8 kB) · vitest ✓ (suite green this wrap; no test
files changed this session — 1120 tests / 121 files).

glidepath-site @ 876c526: vitest 34/34 ✓ · build ✓ (gated at every push
this session). Site auto-deploys main → production; demo player now
serves public/screenshots/ captures.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-02..03 | Codebase-audit remediation P0–P4; public-write rate limiting; Next.js 15.3.9 + React 19; PWA update toast; demo-seed full clone; inspection-delete + outage-alert fixes. Marketing site: Phases 1–2 complete — homepage demo player runs real captured footage. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File modules; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key files touched this session

### This repo
- `supabase/seed-demo-military.sql` — rewritten (full clone)
- `app/(app)/inspections/page.tsx` + `lib/supabase/inspections.ts` — delete fixes
- `app/(app)/infrastructure/page.tsx` — outage alert dedupe
- `components/pwa-update-toast.tsx` + `app/layout.tsx` — PWA refresh prompt (cloud, merged)
- `.claude/skills/{start,wrap}-session/SKILL.md` — now tracked

### glidepath-site (see its git log for the full story)
- `scripts/capture-manifest.mjs` + `scripts/capture-screenshots.mjs` — pipeline v2
- `public/screenshots/` — 4 scene clips + 6 stills + manifest (landed)
- `docs/plan-phase-2.md` — corrected against real app behavior
