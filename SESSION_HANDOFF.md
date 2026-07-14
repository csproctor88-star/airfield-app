# Session Handoff

**Date:** 2026-07-14 (session ran 2026-07-13 evening into the 14th)
**Branch:** `main` (both repos). `airfield-app`: 6 commits
(`765e9211..ab4d98be`), all **pushed**, tree clean (this handoff is the
only uncommitted file). `glidepath-site`: 4 commits (`02a19ba..67738d9`),
all **pushed**, tree clean.
**Build:** `airfield-app` @ `ab4d98be` (gate ran fresh at HEAD, pipefail):
tsc ✓ · lint 0 errors · vitest **1227 passed | 16 skipped** (137 files) ·
`npm run build` ✓. `glidepath-site` @ `67738d9`: tsc ✓ · lint 0/0 ·
vitest **139 passed** (22 files) · build ✓ (routes unchanged, all
static/SSG).
**HEAD:** `airfield-app` `ab4d98be` · `glidepath-site` `67738d9` (both
pushed).
**DB:** no new migrations. `2026071300_configurable_shifts` (applied
2026-07-13) remains the latest. **Not promoted** — owner owns Vercel
promotion; the shop-routing fixes and the marker sizing are preview-only
until then.

---

## What shipped this session

The whole previous next-session backlog cleared in one pass: the owner
approved the site preview, redlined the wording queue, made the
`modifications-exemptions` call (keep gated), and greenlit the outage
shop fix. Then two owner-requested app features (QRC editor drafts,
NAVAID marker sizing) and the start of Phase 4: the first owner-recorded
walkthrough clip is converted, screened, and live on the site preview —
and screening it frame-by-frame caught a second half of the shop-routing
bug nobody knew was there.

### Report Outage shop routing (`765e9211`, airfield-app)

The Visual NAVAIDs Report Outage action hardcoded
`assigned_shop: 'Airfield Management'` in both its online and
offline-queued fan-out paths, while the manual New Discrepancy form
auto-assigns by type. New `lib/discrepancy-shop.ts`
(`resolveShopForTypes`, TDD'd) is now the single resolution shared by
both surfaces: per-base map from Base Setup → CE Shops first, then the
type's `defaultShop` with exact-then-substring matching. A base with no
CE shops configured gets an unassigned discrepancy — same as the manual
form would produce, and AFM still triages from "Submitted to AFM".

### QRC editor draft persistence (`bacf2d7c` spec, `04c2a016`)

The QRC editor dialog held the whole checklist build in React state and
the real save validates completeness, so a half-built QRC was simply
unsavable. Owner decisions: device-local only (localStorage — auto-save
is then free) and a resume banner, not silent restore. New
`lib/qrc-draft.ts` follows the `check-draft.ts` pattern, one draft per
context (`{baseId}_new` / `{baseId}_{templateId}`); the dialog
auto-saves on every change once the form diverges from its opening
state, offers "Unsaved draft from HHMMZ (n steps) — Resume / Discard" on
reopen, shows a footer "Draft saved" stamp, and clears the draft on a
successful save. Editing over an ignored banner overwrites the old draft
— the banner is the one warning (spec'd behavior, owner-approved).

### NAVAID marker sizing overhaul (`503eb4c0` spec, `b1d2e056`)

Owner: signs scaled inconsistently and fake-overlapped until max zoom.
Root causes: the 12px sizing floor operated on the *rotated bounding
box* of the label image (short "L" inflated, long rotated "1-19" not),
and signs rendered at fixed pixel sizes regardless of ground scale.
Signs now render in three stages — compact type-colored squares below
zoom 17, labeled panels normalized to one shared panel height at working
zooms, then ground-proportional growth clamped 12–44px — so spacing
opens up exactly as real spacing does. Lights keep their native
meter-true Circles but clamp to a 4–12px screen diameter, radius updated
once per zoom-settle behind a quantized no-op guard (gov-hardware zoom
smoothness preserved). Pure math in `lib/infrastructure/marker-scale.ts`
(14 tests); every threshold is a named one-line dial. The idle handler
is the marker-reuse path and now owns *every* zoom-dependent visual,
including INOP rings sized off their parent's displayed size.

### Threshold alert copy (`ab4d98be`, airfield-app)

Found by screening the owner's walkthrough footage: the outage alert
dialog had its *own* hardcoded "auto-created — assigned to Airfield
Management" string, contradicting the record `765e9211` now writes. The
alert threads the resolved shop from the handler and says "assigned to
{shop}", or just "auto-created" when no shop resolved.

### glidepath-site: redlines, cascade line, first owner media

- `02a19ba` — owner redlines: header "Modules. One Platform.", dialog
  "View Module Details" / "Continue Exploring". Ticker + track lead kept.
- `b98d31c` — NAVAID cascade line upgraded to claim automatic routing
  ("assigned to the right CE shop" / civilian "maintenance section"),
  backed by `765e9211`.
- `1a78fb5` — **first Phase 4 asset.** Owner-recorded 32 s visual-navaids
  walkthrough converted 35.7 MB → 5.6 MB (1280w H.264 CRF24, muted,
  faststart) + title-card poster under `public/media/`. Wired into the
  module content: renders on `/military/visual-navaids` AND in the module
  dialog (new one-line slot after the how-steps) — one recording, both
  surfaces. `OwnerMediaSlot` now honors `prefers-reduced-motion`
  (queued tech-debt item), and `cascade-band` reuses it instead of
  duplicated markup. Homepage cascade slots remain null/empty.
- `67738d9` — owner preview feedback: dialog capped the clip at
  `max-w-[960px]` on desktop (was upscaling 1280px source to ~1800px);
  mobile/module page stay full-width. The cap is a one-value dial in
  `stack-section-card.tsx`.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | **Applied 2026-07-13** (verified post-apply) | Widens `bases.shift_count` CHECK; adds `shift_name_*`; hardens `sign_daily_review_slot` |

No new migrations this session.

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Map-reported lighting outages landed in Airfield Management's queue, not CE Electrical's | Both Report Outage fan-out paths hardcoded `assigned_shop`; the manual form's type→shop resolution was never shared | `765e9211` |
| Threshold alert still said "assigned to Airfield Management" after the routing fix | The alert's display string was hardcoded separately from the payload — caught frame-by-frame in the owner's walkthrough footage | `ab4d98be` |

## Lessons from this session

- **Piping test output masks exit codes.** `vitest run | grep …` in a
  `&&` chain reports the *grep's* exit status — a gate "passed" with a
  red test this session. Use `set -o pipefail` or let the runner's exit
  code reach the chain. (Saved as a feedback memory.)
- **Owner footage is a review surface.** Screening the walkthrough clip
  frame-by-frame against current app behavior caught a shipped-copy bug
  (`ab4d98be`). Every future clip gets the same pass before wiring.
- **Fixing data isn't fixing every string that describes it.** When
  changing behavior, grep for display copy echoing the old behavior
  (the alert dialog narrated the pre-fix assignment).

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Wired visual-navaids clip shows stale alert copy at ~16 s | med | The footage (recorded pre-fix) shows "assigned to Airfield Management" in the threshold alert. Owner call: re-record after promoting `765e9211`+`ab4d98be`, or live with it as a test asset. |
| NAVAID marker sizing dials await owner preview verdict | low | Stage-switch zoom 17 · panel floor/cap 12/44px · compact 10px · light clamps 4/12px — all in `lib/infrastructure/marker-scale.ts`. |
| Dialog media cap dial | low | `max-w-[960px]` in `stack-section-card.tsx` if 960 isn't right on second look. |
| QRC draft flow not browser-driven | low | `lib/qrc-draft.ts` fully unit-tested; the dialog's create→close→resume loop verified by gate only. Worth one hands-on pass on preview. |
| Demo seeds don't copy `shift_name_*` | low | `seed-demo-military.sql` / `seed-demo-base.sql` clone `shift_count` but not the name columns. |
| `modifications-exemptions` (civilian) | low | Owner decided 2026-07-13: **stays gated** until the app feature ships. File remains orphaned by design. |
| Track pages no longer link to `/[slug]` pages | low | Dialog replaced navigation; pages remain SSG'd (and now carry the media slots). Watch SEO. |
| OG images stale | med | Old palette AND old titles. `npm run og:images` regen held by owner. |
| Proof band empty | med | Testimonials + installation permissions owed by owner; null-hidden. |
| Cosmetic | low | glidepath-site: stray blank line in 51 module content files; `modules-data` header em dashes (unrendered). |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode miss · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |
| Demo user on Demo AFB | low | `primary_base_id` still KDMO; flip to KDRA before civilian capture work. |

## Next session tasks

1. **Owner preview verdicts** — NAVAID marker sizing stages on
   `/infrastructure` (three zoom stages; dials above) and the module
   dialog media at 960px.
2. **Homepage cascade clips** — shot lists delivered 2026-07-13:
   NAVAIDs (~20 s: three edge lights out → threshold flag → toast),
   Discrepancies (~20 s: pavement write-up → shop auto-fill → CES view),
   Parking (~15 s: drag C-17 → live envelopes → conflict → clean spot).
   All: 1080p, demo data, slow cursor, loop-friendly ends, muted-loop
   readable. Record the NAVAIDs one on a build with the shop fixes
   promoted so the alert reads right on camera.
3. **Visual-navaids module clip re-record decision** (tech-debt row) —
   after promotion.
4. **Next module-page clips** — Discrepancies, Parking, Self-Inspections
   suggested next; shot lists on request. Conversion+wiring pipeline is
   proven now (drop file → I convert, screen, wire).
5. **QRC drafts hands-on pass** on the preview (create → close → resume
   → discard → save clears).

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 · OG regen — all
owner-scheduled, unchanged.

## Build snapshot
```
airfield-app @ ab4d98be (fresh, at HEAD, pipefail): tsc ✓ · lint 0
  errors · npx vitest run 1227 passed | 16 skipped (137 files) ·
  npm run build ✓. Changed routes First Load: /infrastructure 244 kB ·
  /discrepancies/new 206 kB · /base-config/setup 298 kB. Shared 106 kB ·
  middleware 80.8 kB.
glidepath-site @ 67738d9: tsc ✓ · lint 0/0 · 139 passed (22 files) ·
  build ✓ (all static/SSG; public/media/ adds the 5.6 MB clip + poster).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-14 | Report Outage type→shop routing (+ alert copy) · QRC editor localStorage drafts with resume banner · NAVAID three-stage marker sizing + light clamps · site: owner redlines applied, NAVAID cascade line strengthened, first Phase 4 walkthrough clip wired (module page + dialog, reduced-motion aware, 960px dialog cap). |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts: 1–3 per base, renameable. `lib/shifts.ts` SoT; wizard 1-shift option + Shift Names card + auto-move on reduction; Daily Reviews slots/labels/PDF follow; `sign_daily_review_slot` hardened. Migration `2026071300` applied. |
| **Unreleased** | 2026-07-12 (late) | glidepath-site cascade rebuild: spec + 3 SDD phases + module stack. Homepage owner-voice cascade vignettes; track pages sticky-stacking section cards + zoom dialog; 50 module pages restructured. |
| **Unreleased** | 2026-07-12 | glidepath-site credibility campaign phases 0–4 (superseded the same day). |
| **Unreleased** | 2026-07-11 | glidepath-site homepage rebuilt twice: blue-hour hero + Operational Day spine. PR #1 merged. |
| **Unreleased** | 2026-07-05..10 | Marketing roster 36→50 + Part 139 cert-audit; owner-testing bug sweep; Help & Training overhaul; Phase 5 apex cutover; broadcast email; `.mil` deliverability fix. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files (airfield-app)
- `docs/superpowers/specs/2026-07-13-qrc-editor-drafts-design.md` · `2026-07-13-navaid-marker-sizing-design.md` — specs of record.
- `lib/discrepancy-shop.ts` — type→shop resolution SoT (form + Report Outage).
- `lib/qrc-draft.ts` — QRC editor draft persistence (check-draft pattern).
- `lib/infrastructure/marker-scale.ts` — marker/light scale math + dials.

### Modified files (airfield-app)
- `app/(app)/infrastructure/page.tsx` — shop resolution at both fan-out call sites; three-stage sign rendering + light clamp + idle-handler rewrite; alert copy threads the resolved shop.
- `app/(app)/discrepancies/new/page.tsx` — auto-assign effect refactored onto `resolveShopForTypes`.
- `components/admin/qrc-editor-dialog.tsx` — auto-save, resume banner, footer stamp, clear-on-save.

### glidepath-site
- `public/media/visual-navaids.{mp4,jpg-poster}` — first owner asset.
- `lib/module-stack-content.ts` (redlines) · `lib/cascades.ts` (NAVAID line) · `lib/modules/military/visual-navaids.ts` (`ownerMedia`).
- `components/ui/owner-media.tsx` (client, reduced-motion, `className`) · `components/home/cascade-band.tsx` (dedupe) · `components/modules/stack-section-card.tsx` (dialog slot + 960px cap).
