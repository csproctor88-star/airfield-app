# Session Handoff

**Date:** 2026-07-04
**Branch:** `main` — **4 commits unpushed** (`bf1d2187..8bfdfab8`); push was
blocked by the permission classifier at session end — needs the user to
push or explicitly authorize. glidepath-site likewise holds **24 unpushed
commits** (`4ede9ef..545d2c6`). Working trees clean except this file.
**Build:** tsc ✓ · lint 0 errors · `npm run build` ✓ · vitest ✓ (all rerun
at this wrap).
**HEAD:** `8bfdfab8` — Stage KDRA PPR, contractors, and training records.

This session closed the two carryover items (CI failures, Next 15 runtime
QA) and then executed the marketing site's **Phase 3 end-to-end via
subagent-driven development**: all 36 module pages (22 military + 14
civilian) authored, screenshot-backed, reviewed task-by-task with fix
cycles, and cleared by a final whole-branch review as READY TO PUSH. This
repo's role was the staging layer: four seed commits that made the demo
tenants photogenic and claims-clean for every frame.

---

## What shipped this session

### CI failures root-caused and fixed (`9147c156`, `ec54e56f`)
The "failed to run" emails were CI's lint step: since the Next 15 upgrade,
`next build` no longer lints, so 13 `react/no-unescaped-entities` errors
(raw `'`/`"` in JSX) sat invisible locally while failing every push. All
escaped; CI also bumped to Node 24 to match Vercel. The wrap-session skill
now carries `npm run lint` as a fourth gate so this class can't recur.

### Next 15 runtime QA — resolved as environmental (no commit)
The carried "local `next start` 500s" repro came down to server hygiene,
not an app bug: a `next start` that outlives a rebuild serves rotated
chunk names (404s) and middleware 500s; the :3000/:3001 "ghost listeners"
were orphaned servers from prior sessions, killed this session. Rule now
in the start-session skill (netstat sweep) and memory: restart `next
start` after every build.

### PWA update toast activates parked workers (`bce9eba5`)
The toast's Refresh reloaded the page but a waiting service worker stayed
parked, so field devices could dismiss-loop forever. Refresh now posts
SKIP_WAITING and reloads on `controllerchange`. Login footer bumped to
v2.35.0 (`4af9a013`); session skills committed (`396a0ec7`).

### Demo-tenant staging for Phase 3 captures (`97c5e131`, `f15dad6f`, `bf1d2187`, `ff7a4625`, `8216c8c9`, `8bfdfab8`)
Six seed commits, all applied to the linked project via
`npx supabase db query --linked --file` (idempotent, guarded — safe to
re-run). `seed-demo-military-staging.sql` fictionalizes everything the
claims guardrail forbids in-frame on KDMO (waiver proponents, contractor
companies + contacts, PPR requesters/phones/emails, AMTR roster names,
daily-review signers → demo persona) and future-dates three PPR clones so
the today-forward log frames content. `seed-demo-civilian-staging.sql`
builds KDRA's story: three open discrepancies (with GPS pins — without
coordinates the map renders a full-frame "No GPS Coordinates" overlay),
the demo user's dashboard board written with a complete 7-widget layout,
three future-dated PPRs, three fictional work parties, and eight §139.303
training completions. Non-obvious: both KDRA dashboard boards were EMPTY —
the widgets seen on screen were the app's runtime starter fallback, which
any saved widget suppresses; the seed therefore resolves the demo user's
default board via `dashboard_user_defaults` (never by name — the owner has
a same-named board it must not touch).

### glidepath-site: Phase 3 complete — 36 module pages (`4ede9ef..545d2c6`)
24 commits (details in its git log). Content model + registry with
invariant tests (meta lengths, FAQ counts, screenshot existence, roster
1:1); template + routes; pillar pages with full module grids; five content
batches, each authored by a fresh subagent and reviewed against its brief
with the PNGs open (caption-vs-frame checks caught real defects in 4 of 5
batches; the "never reuse military prose" rule was enforced down to
8-consecutive-word overlap scans). Final whole-branch review (most capable
model) verified cross-page voice, 36/36 unique metaTitles, zero cross-page
prose reuse, all 20 reg cites against the plan tables, and applied two
fixes itself: `text-faint` token 4.46:1 → 4.59:1 (clears the Lighthouse
a11y-96 cap site-wide, includes every figcaption) and a QRC "all 25" claim
that contradicted the 26 visible in its own frame. Lighthouse 96–100
across 12 audits; phone pass at 360px clean; built sitemap exactly 42
URLs; 48/48 tests.

---

## Migrations status

**No new migrations this session.** Latest remains `2026070204` (applied).
The six staging seeds are NOT migrations — they live in `supabase/seed-*`
and were applied ad hoc to the linked project (all verified by count
queries this session).

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Every push emails "failed to run" | CI lints separately since Next 15 — `next build` no longer lints, so 13 unescaped-entity errors were invisible locally | `9147c156` |
| Local `next start` 500s all authenticated requests | Environmental: server outliving a rebuild serves rotated chunks; orphaned servers squatted :3000/:3001 | — (hygiene, no code) |
| PWA update toast dismiss-loops on field devices | Refresh never activated the waiting worker (no SKIP_WAITING) | `bce9eba5` |
| /discrepancies map full-frame "No GPS Coordinates" on KDRA | Staged discrepancies had no lat/lng | `8216c8c9` |
| KDRA dashboard showed 4 widgets, then only 3 after staging | Boards were empty; on-screen widgets were the runtime starter fallback, suppressed by any saved widget | `8216c8c9` |

---

## Lessons from this session

- **Empty dashboard boards render a starter-fallback widget set** — saving
  ANY widget suppresses all of it. Stage boards with the complete layout,
  and target the demo user's board via `dashboard_user_defaults`, never by
  board name.
- **Marketing frames need coordinates**: list pages with map views
  (discrepancies) render overlay errors when rows lack GPS.
- **Prose-reuse across track siblings is invisible to every automated
  guard** — three of four content batches shipped military sentence
  echoes despite explicit instructions; only overlap-scanning reviews
  (8-consecutive-word bar) caught them. Captions transcribing shared UI
  are the one accepted overlap.
- **Caption-vs-frame verification catches real defects** (wrong counts,
  military reg strings leaking into civilian captions) — reviewers must
  open the PNGs, not trust the diff.
- **The claims guardrail beats a richer frame**: /training/compliance was
  refused because KDRA's member list shows a real "System Admin" account;
  the static hub shipped instead (owner can unblock a reshoot).
- **Pushes to main now need explicit user authorization** in this
  environment — batch them consciously; "wait to push" then push at wrap
  gets classifier-blocked.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **Both repos unpushed** | high | App: 4 commits (`bf1d2187..8bfdfab8`). Site: 24 commits (`4ede9ef..545d2c6`, final review passed). First action next session (or user pushes now). After the site push: verify Vercel preview, run Google rich-results test on the preview URL (deferred from Task 9). |
| App-side dual-mode terminology gaps | med | Civilian tenants render military strings: /discrepancies shows AFM/CES/AMOPS KPI chips; /inspections header shows "DAFMAN 13-204V2". `lib/airport-mode.ts` doesn't cover them. Marketing captions transcribe faithfully meanwhile. |
| DAFI vs DAFMAN 91-212 designation split (owner) | low | App repo disagrees with itself: `regulations-data.ts` links `dafi91-212.pdf`, `airport-mode.ts` says DAFMAN; site copy says DAFMAN. E-pub URL favors DAFI. Owner to rule; then align both repos. |
| Daily-reviews cite contradiction (owner) | low | Site page cites V2 Para 2.5.2.10 while its own frame header reads "DAFMAN 13-204v1 Para 2.5.2.10.3 & 10.4" — visible in-frame. Owner to rule which designation is right; fix copy or app header. |
| KDRA /training richer frame blocked | low | Compliance/roster views show the owner's real account ("System Admin" row). Clean the membership display or approve a temporary profile retitle, then reshoot `/training/compliance`. |
| ACSI module page frames an empty list | low | Honest but thin; owner rec from final review: seed one completed ACSI on KDMO + reshoot. |
| Status-page weather effect races runway load | low | Carried — `app/(app)/page.tsx:194`. |
| `gh` CLI absent on this machine | low | Carried — plain git; CI via Actions page. |
| Deferred audit items / npm advisories / Selfridge 1098 / local-only reference docs | low | Carried unchanged. |

---

## Next session tasks

1. **Push both repos** (blocked at wrap by the permission classifier —
   needs the user). Then: confirm app CI green (lint gate), open the site's
   Vercel preview, spot-check 3–4 module pages, and run Google's
   rich-results test against the preview URL.
2. **Owner adjudications** (all detailed in Known issues): DAFI vs DAFMAN
   91-212; daily-reviews V1-vs-V2; KDRA training reshoot unblock; optional
   ACSI seed + reshoot. Site copy edits from these are one-line fixes.
3. **Phase 4** (sequenced next in glidepath-site): OG/social images,
   /security /about /faq content, /demo polish. Phase 5 (apex domain
   cutover) remains owner-executed.
4. **Owner owes** (carried): real adoption-stat values for the homepage
   stats band (placeholder-hidden until provided).

**App backlog:** Next 15 runtime QA is CLOSED (environmental). No required
app work pending beyond the dual-mode terminology gaps above.

### Long-running carryover
Deferred audit items, optional Next 16, Selfridge 1098 dedup, local-only
reference docs — unchanged.

---

## Content-edit playbook (glidepath-site) — CARRY THIS SECTION FORWARD

How to change site text or replace screenshots (owner prompts one
sentence; the rest is this process):

- **Text** — all copy lives in `lib/` data files, never components:
  module pages `lib/modules/{military,civilian}/<slug>.ts` (metaTitle,
  problem, how.steps, benefits, faq, screenshot captions); homepage
  `lib/home-content.ts`; nav/footer `lib/site-config.ts`; grid card
  names/taglines `lib/modules-data.ts`. `npm run test` enforces banned
  terms, metaTitle ≤60, metaDescription ≤160, FAQ 3–5 — fix copy, never
  tests. Full four-gate before commit; push → Vercel auto-deploys main.
- **Screenshots** — `public/screenshots/<id>.png`, referenced by that
  path in the module file; shot list in `scripts/capture-manifest.mjs`.
  Reshoot: `CAPTURE_BASE_URL=https://app.glidepathops.com
  CAPTURE_EMAIL=demo@glidepathops.com CAPTURE_PASSWORD=$(sed -n
  's/^CAPTURE_PASSWORD=//p' ../airfield-app/.env.local | tr -d '\r')
  node scripts/capture-screenshots.mjs --tenant <t> --only <id>` —
  never print the password. The demo user's ACTIVE base must match the
  tenant (KDMO for `mil-*`, KDRA for `civ-*`) — switch in-app first.
  Owner-supplied PNGs: same filename drop-in; keep 1600×1000.
- **Every new frame**: claims-guardrail review before commit (no real
  names/emails/units/phones; approved fiction: "TSgt Demo", pooled
  initial+surname names, "(586) 555-01xx", fictional companies) AND
  update the caption to match the frame — caption accuracy has no
  automated guard and was the most common review defect in Phase 3.
- **If the frame needs data the tenant lacks**: stage fictional rows
  first via the guarded seeds (`airfield-app/supabase/
  seed-demo-{military,civilian}-staging.sql` are the patterns; apply
  with `npx supabase db query --linked --file` from airfield-app).
- **Pushes to main need explicit user authorization** in the same
  conversational stretch — "push when green" in the request suffices.

---

## Build snapshot

```
airfield-app @ 8bfdfab8: tsc ✓ · lint 0 errors (warnings only) ·
npm run build ✓ (Middleware 80.8 kB) · vitest 1104 passed / 16 skipped
(1120, 121 files). No app code changed since bce9eba5 — seeds and skills
only.

glidepath-site @ 545d2c6: tsc ✓ · lint ✓ · vitest 48/48 ✓ · build ✓
(36 module SSG paths + 42-URL sitemap; gate rerun at wrap RC=0).
Lighthouse (local prod build): 96–100 across /military,
/military/visual-navaids, /civilian/sms — a11y cap fixed in 545d2c6.
NOT yet deployed — push pending.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-02..04 | Codebase-audit remediation P0–P4; public-write rate limiting; Next.js 15.3.9 + React 19; PWA update toast + parked-worker fix; CI lint gate fixed; demo-seed full clone; inspection-delete + outage-alert fixes; demo-tenant staging seeds. Marketing site: Phases 1–3 complete — homepage demo player + all 36 module pages. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File modules; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key files touched this session

### This repo
- `supabase/seed-demo-military-staging.sql` — KDMO fictionalization (6 blocks)
- `supabase/seed-demo-civilian-staging.sql` — KDRA staging (6 blocks)
- `supabase/seed-demo-civilian-wildlife.sql`, `seed-demo-civilian-part139-polish.sql` — earlier civilian passes
- `components/pwa-update-toast.tsx` — parked-worker activation
- `.github/workflows/` — Node 24; 13 JSX entity escapes across components
- `.claude/skills/{start,wrap}-session/SKILL.md` — lint gate + orphan sweep

### glidepath-site (see its git log for the full story)
- `lib/modules/` — types, registry, 36 content files (military/ + civilian/)
- `components/modules/module-page.tsx` + `app/{military,civilian}/[slug]/page.tsx`
- `app/{military,civilian}/page.tsx` — pillar pages + module grid
- `scripts/capture-manifest.mjs` — 20+ new shot entries across batches
- `public/screenshots/` — 21 new stills banked
- `tests/module-content.test.ts` — invariants, then 1:1 completeness flip
- `tailwind.config.ts` — `text-faint` AA bump (final review)
