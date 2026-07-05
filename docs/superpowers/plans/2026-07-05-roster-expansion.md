# Module Roster Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Each batch task is authored by one implementer subagent, then task-reviewed (spec + quality), then it lands in the owner's review tool.

**Goal:** Add 15 module pages to glidepath-site (4 military, 11 civilian) so the site lists every module the app offers, plus one app change opening ACSI to civilian mode.

**Architecture:** Extends the established Phase 3 content pipeline. One typed content file per page under `lib/modules/{track}/<slug>.ts`, registered in `lib/modules/index.ts`'s `MODULE_PAGES`, rendered by `components/modules/module-page.tsx`, auto-wired into pillar grids + `app/sitemap.ts` + `lib/og-routes.ts`. No new architecture.

**Tech stack:** Next.js 15 App Router (static), TypeScript strict, Tailwind, Vitest, Playwright capture pipeline, tsx.

**Spec:** `airfield-app/docs/superpowers/specs/2026-07-05-roster-expansion-design.md` (read it — §3 framing calls and §10 pointers are load-bearing).

## Global Constraints

- Site work in `C:/Users/cspro/glidepath-site`; the ACSI app change (Task 7) in `C:/Users/cspro/airfield-app`.
- **No em dashes (`—`) or spaced en dashes (` – `) in any rendered copy string.** Use colons, commas, parentheses, periods.
- Terminology guards (law, `tests/terminology.test.ts`): never "AMT", "FOD walk", paper/whiteboard/clipboard comparisons, snake_case role keys, "PII" (say "sensitive personal data"), endorsement claims. "Glidepath Technologies" appears ONLY in about/platform/legal carriers — never in a module page.
- metaTitle ≤ 60 chars; metaDescription ≤ 160 chars; FAQ 3–5 entries per page. No fabricated regulatory text — cite only what the spec's roster table authorizes for that page.
- Civilian pages say "airport"; military pages say "airfield". Copy is written independently per track — no cross-track prose reuse ≥ 8 consecutive words (captions transcribing identical shared UI are the one accepted overlap).
- Every new content file is registered in `allCopy()` in `tests/terminology.test.ts`.
- Captions are written from the actual captured PNG and get a claims-guardrail review (no real names/emails/units/phones) before commit. Text-only pages use an empty `how.screenshots: []` array.
- Gates before every commit: `npx tsc --noEmit && npm run lint && npm run test && npm run build`, all RC=0.
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + the session's `Claude-Session:` line. Never commit `.env*`. Do not push; the session lead batches pushes.

## Content-file shape (every authoring task follows this)

Clone an existing sibling as the structural template: `lib/modules/military/discrepancies.ts` (has regulation cites) or `lib/modules/military/airfield-status.ts` (`regulation: null`). The exported object is `ModulePageContent` (`lib/modules/types.ts`): `slug`, `track`, `metaTitle`, `metaDescription`, `problem {heading, body[]}`, `how {heading, steps[{title,body}], screenshots[{src,alt,caption}]}`, `regulation {cites[{cite,note}]} | null`, `benefits[{title,body}]`, `related[]` (same-track slugs), `faq[{q,a}]`. Each page also needs a `modules-data.ts` `MODULES` entry: `{ slug, name, track, tagline, regCite? }`.

Wiring for each registered page (do once per file, in the same commit):
1. Create `lib/modules/{track}/<slug>.ts`.
2. Add its `MODULES` entry in `lib/modules-data.ts` (correct track section).
3. Import + add it to `MODULE_PAGES` in `lib/modules/index.ts`.
4. Register the content export in `allCopy()` in `tests/terminology.test.ts`.
5. Add `related` links both ways where natural (optional).

---

### Task 1: Military `reports` + refocus `events-log-reports`

**Files:** create `lib/modules/military/reports.ts`; modify `lib/modules-data.ts`, `lib/modules/index.ts`, `tests/terminology.test.ts`, `lib/modules/military/events-log-reports.ts`.

**Brief — `reports` (military):** The app's report suite at `/reports` (daily operations, trends, aging, discrepancies, lighting analytics), generated client-side as PDF/Excel. Sell: the day's numbers assembled from the records already in the platform, not rebuilt by hand — aging discrepancies, lighting outage trends, daily ops summaries, each exportable and attributable. Name "Reports". regCite: none (or "AF Form 3616" only as context, not a compliance claim). Related: `events-log-reports`, `discrepancies`.

**Refocus `events-log-reports`:** rename its `modules-data` card to "Events Log", set metaTitle/metaDescription and copy emphasis onto the chronological attributed log (the reports half now lives in the new page); **keep the slug `events-log-reports`** unchanged. Trim reports-suite language so the two pages don't overlap. Flag the refocused copy for the owner's review pass.

- [ ] Author `reports.ts` from the brief (clone `discrepancies.ts` structure). Text-only or capture `mil-reports` from KDMO `/reports` if cleanly shootable (switch demo base to KDMO first).
- [ ] Refocus `events-log-reports.ts` + its `modules-data` entry per the brief.
- [ ] Wire (modules-data, index, allCopy). Verify meta lengths, FAQ 3–5.
- [ ] Gates green; commit `feat: add military Reports page and refocus Events Log`.

---

### Task 2: Military `records-export`

**Files:** create `lib/modules/military/records-export.ts`; modify `lib/modules-data.ts`, `lib/modules/index.ts`, `tests/terminology.test.ts`.

**Brief:** Mirrors the civilian `records-export` page (read `lib/modules/civilian/records-export.ts` for structure and voice, then rewrite independently for the military reader — no ≥8-word reuse). The app's `/settings/exports` builds records-disposition exports (CSV/PDF/photos/interactive), generated client-side. Military framing: records custodians pulling a disposition-ready export on demand; honest, non-specific AF records-management framing (no invented AFI/AFMAN paragraph). Name "Records Export". regCite: omit or a non-specific records-disposition reference — do NOT fabricate a paragraph. Related: `events-log-reports`, `discrepancies`.

- [ ] Author from the brief. Capture `mil-records-export` from KDMO if clean, else text-only.
- [ ] Wire; verify meta lengths / FAQ.
- [ ] Gates green; commit `feat: add military Records Export page`.

---

### Task 3–6: Civilian ops batch (one implementer, four pages)

Author these four civilian pages. Each: content file + modules-data entry + index registration + allCopy. Civilian voice ("airport"). Capture from KDRA where clean (switch demo base to KDRA); text-only otherwise.

- [ ] **`airport-checks`** — reflects `/checks`. Sell: recurring condition checks (FOD, lighting, surface, friction) between self-inspections, each archived with a record. Name "Airport Checks". regCite: none forced. Related: `self-inspections`, `field-conditions`.
- [ ] **`shift-checklist`** — reflects `/shift-checklist`. Sell: an ops-shift turnover checklist that resets each day, so nothing carries over unverified. Name "Shift Checklist". regCite: none. Related: `airport-status`, `events-log`.
- [ ] **`events-log`** — reflects `/activity`. Sell: an attributed, chronological record of the airport day, with status changes and completions posting themselves. Name "Events Log". regCite: none forced. Related: `reports` (civilian), `airport-status`.
- [ ] **`emergency-checklists`** — reflects `/qrc`. Sell: emergency and contingency checklists ready at the moment they're needed, tied to the Airport Emergency Plan. Drop AFMAN 91-203 and "QRC". Name "Emergency Checklists". regCite: tie loosely to 14 CFR §139.325 (AEP) only if honest, else none. Related: `aep`, `self-inspections`.
- [ ] Wire all four; verify meta lengths / FAQ each.
- [ ] Gates green; commit `feat: add civilian ops pages (checks, shift, events log, emergency checklists)`.

---

### Task 7: App change — open ACSI to civilian (airfield-app)

**Files (airfield-app):** `lib/modules-config.ts`, `app/(app)/acsi/page.tsx`; enable `acsi` in KDRA `enabled_modules` (linked DB).

- [ ] `lib/modules-config.ts` (~line 101): change the `acsi` module's `appliesTo: ['usaf']` to apply to both modes (set `['usaf', 'faa_part139']`).
- [ ] `app/(app)/acsi/page.tsx` (~lines 96, 99): replace the hardcoded "Airfield Compliance and Safety Inspection" title and "DAFMAN 13-204v2, Para 5.4.3" cite with mode-aware values — read mode from `currentInstallation` via `airport-mode.ts` (`compliance_inspection` label gives `faa: 'Part 139 Annual Inspection'`); reg cite USAF = "DAFMAN 13-204v2, Para 5.4.3", FAA = "14 CFR Part 139". Verify the page already has `useInstallation()` in scope.
- [ ] Enable `acsi` in KDRA's `enabled_modules` via `npx supabase db query --linked --file` (append `acsi` to the array; idempotent guard). Verify KDRA shows ACSI.
- [ ] Gates (airfield-app): `npx tsc --noEmit && npm run lint && npm run build` RC=0. (No push.)
- [ ] Commit (airfield-app) `Open ACSI to civilian mode with a Part 139 inspection header`.

---

### Task 8–12: Civilian compliance batch (one implementer, five pages — one gated)

Depends on Task 7 for the ACSI capture. Civilian voice. Capture from KDRA where clean.

- [ ] **`part-139-inspection`** — reflects `/acsi` (civilian mode). **Framing (spec §3.1):** the FAA conducts the Part 139 certification inspection; this page sells getting ready — self-audit, findings tracked to closure, a filed record ready when the inspector arrives. Never imply Glidepath performs or replaces the FAA inspection. Name "Part 139 Certification Inspection". regCite "14 CFR Part 139". Related: `self-inspections`, `records-export`. Capture `civ-part-139-inspection` from KDRA `/acsi` after Task 7 (mode-aware header should read "Part 139 Annual Inspection").
- [ ] **`flip-management`** — reflects `/flip`. Sell: chart and publication currency in FAA terms (Chart Supplement, terminal procedures), tracked so nothing goes stale. Avoid DoD "FLIP" jargon in the prose. Name "Flight Information Publications". regCite: none forced. Related: `notams`, `airport-status`.
- [ ] **`field-conditions`** — reflects `/field-conditions`. Sell: TALPA/FICON field condition reporting (RCAM assessments, contaminant reporting) captured and shared. Name "Field Conditions". regCite honest (TALPA / AC 150/5200-30 / §139.339 — only if accurate, no fabrication). Related: `airport-status`, `self-inspections`.
- [ ] **`obstructions`** — reflects `/obstructions`. **Framing (spec §3.2):** the app evaluates against FAA Part 77 imaginary surfaces via its surface-set toggle (confirmed real, `obstructions/page.tsx:729`). Sell Part 77 (14 CFR §77.19) evaluation for civilian airports. Do NOT reuse the military UFC framing. Name "Obstructions". regCite "14 CFR Part 77". Related: `airport-status`, `work-orders`.
- [ ] **`modifications-exemptions`** (GATED, spec §3.3) — reflects `/waivers` reframed for FAA Modifications of Standards and exemptions. **Author the content file only. Do NOT** add a `modules-data` entry, do NOT register in `MODULE_PAGES`, do NOT wire into allCopy/sitemap/OG. It sits as an unregistered file until the owner confirms the app feature ships. Frame to the intended capability (managing Mods of Standards / exemption requests, tracked to decision) without claiming it's live. Name "Modifications & Exemptions". Text-only (no capture — feature not live).
- [ ] Wire the four registered pages; verify meta lengths / FAQ each.
- [ ] Gates green; commit `feat: add civilian compliance pages (Part 139 inspection, FLIP, field conditions, obstructions) and stage Modifications page`.

---

### Task 13–14: Both-track batch (feedback + read-file, four files)

Author two pages per module, one per track, written independently (no cross-track reuse). These are the weakest capture candidates — default to text-only; capture only if a clean, guardrail-safe frame is available (the public feedback QR form is a candidate).

- [ ] **`feedback` (military)** + **`feedback` (civilian)** — reflects `/feedback` + the public QR form. Sell: a QR-code feedback channel for airfield/airport users and a staff review queue, closing the loop on issues raised from the field. regCite: none. Related: military `events-log-reports`/`discrepancies`; civilian `events-log`/`work-orders`.
- [ ] **`read-file` (military)** + **`read-file` (civilian)** — reflects `/read-file`. Sell: routed documents with tracked read-acknowledgment, so required reading is provably distributed. regCite: none. Related: track-appropriate.
- [ ] Wire all four; verify meta lengths / FAQ each.
- [ ] Gates green; commit `feat: add Customer Feedback and Read File pages on both tracks`.

---

### Task 15: Finalize — OG images, counts, whole-branch review

**Files:** `lib/modules/index.ts` (`SHIPPED_PAGE_COUNT`), `tests/og-images.test.ts` (count), `public/og/*.png`.

- [ ] Set `SHIPPED_PAGE_COUNT` to **50** (36 + 14 registered; Waivers excluded).
- [ ] Update the route-count assertion in `tests/og-images.test.ts` from 46 to **60** (10 static + 50 module).
- [ ] Run `npm run og:images`; confirm `public/og/` has 60 PNGs; eyeball 3 new frames (one military, one civilian, one long-title) for clipping/track-tag correctness.
- [ ] Full gates green.
- [ ] Regenerate the owner's copy-review artifact so all 14 new pages appear for review (extend the DONE_KEYS-driven generator; new pages start ungreen).
- [ ] Commit `feat: regenerate OG images and bump roster to 50 pages`.
- [ ] Dispatch the whole-branch review (most capable model) over the batch range: cross-track voice, framing-rule compliance on the three §3 pages (ACSI prepare-not-perform, Obstructions Part 77, Waivers gated-and-absent-from-roster), guard coverage, no ≥8-word cross-track reuse, roster/sitemap/OG consistency. Triage findings, then hand back to the owner for the copy-review pass + capture follow-up.

---

## Self-review notes
- Spec coverage: §1 roster → Tasks 1–14; §4 app change → Task 7; §5 Events Log refocus → Task 1; §3.3 gated Waivers → Task 12 (authored, unregistered); §7 wiring/tests → each task + Task 15; §6 capture strategy → per-task capture-or-text-only.
- Gated Waivers is the one place a content file exists without a `modules-data`/`MODULE_PAGES`/allCopy entry — intentional; the route-stubs 1:1 test only checks registered roster entries, so an unregistered file does not trip it. Confirm this holds when authoring (the file must not be imported anywhere until the feature ships).
- `SHIPPED_PAGE_COUNT` 50 and OG count 60 must move together in Task 15, after all 14 registered pages exist, or the completeness/coverage tests fail mid-batch. Author-and-register per batch is fine; the count bumps land last.
- Captures are best-effort and owner-reviewed later; do not block a batch's gates on a capture — ship text-only and note it for the follow-up pass.
