# Glidepath Marketing Site — Module Roster Expansion Design Spec

**Date:** 2026-07-05
**Parent specs:** `2026-07-02-marketing-website-design.md` (site of record), `2026-07-04-marketing-site-phase-4-design.md`
**Repos:** `glidepath-site` (15 new pages), `airfield-app` (one module change: open ACSI to civilian mode)
**Owner decisions captured:** 2026-07-05 roster-comparison tool + follow-up direction

## 1. Purpose and scope

A module-by-module comparison of the app's own registry (`airfield-app/lib/modules-config.ts`) against both site tracks surfaced 15 module pages the app offers but the site doesn't list. The owner adjudicated all 15 via the roster-decision tool. This spec covers authoring those pages, one supporting app change, and the wiring/tests to ship them.

This is **not new architecture** — it extends the established content-model pipeline (Phase 3): one typed content file per page under `lib/modules/{track}/<slug>.ts`, registered in `MODULE_PAGES`, rendered by the existing `components/modules/module-page.tsx` template, wired into the pillar grids, sitemap, and OG registry, captured by the existing Playwright pipeline.

### The 15 pages

**Military (4):**
| slug | name | reflects app module | reg cite | notes |
|---|---|---|---|---|
| `reports` | Reports | `/reports` suite | AF Form 3616 (context only) | Split out from the combined Events Log & Reports page |
| `records-export` | Records Export | `/settings/exports` | AF records disposition (honest, non-specific) | Mirrors the civilian `records-export` page |
| `feedback` | Customer Feedback | `/feedback` + public QR form | none | Both-track page |
| `read-file` | Read File | `/read-file` | none | Both-track page (v2.35 module) |

**Civilian (11):**
| slug | name | reflects app module | reg cite | notes |
|---|---|---|---|---|
| `part-139-inspection` | Part 139 Certification Inspection | `/acsi` (civilian mode) | 14 CFR Part 139 Subpart D | **Prepare-for-the-inspection framing** (see §3.1). Needs app change §4. |
| `flip-management` | Flight Information Publications | `/flip` | none forced | Chart/publication currency in FAA terms (Chart Supplement, TERPS), not DoD FLIP jargon |
| `emergency-checklists` | Emergency Checklists | `/qrc` | tie loosely to §139.325 AEP | Drop AFMAN 91-203 and "QRC" jargon |
| `airport-checks` | Airport Checks | `/checks` | none forced | Recurring condition checks between self-inspections |
| `shift-checklist` | Shift Checklist | `/shift-checklist` | none | 0600L reset story carries over |
| `events-log` | Events Log | `/activity` | none forced | Attributed daily record |
| `field-conditions` | Field Conditions | `/field-conditions` | TALPA / RCAM / AC 150/5200-30 (honest) | TALPA/FICON field condition reporting |
| `obstructions` | Obstructions | `/obstructions` | **14 CFR Part 77 (§77.19)** | Part 77 confirmed real (see §3.2) |
| `modifications-exemptions` | Modifications & Exemptions | `/waivers` (reframed) | FAA Modification of Standards / Part 139 exemptions | **GATED** — authored but held (see §3.3) |
| `feedback` | Customer Feedback | `/feedback` + public QR form | none | Both-track page |
| `read-file` | Read File | `/read-file` | none | Both-track page |

**Out of scope (owner ruled "keep folded"):** WHMP stays inside the civilian Wildlife page; the civilian work-order queue stays inside "Discrepancies & Work Orders".

## 2. Counts and the gated page

- Content files authored: **15** (4 military + 11 civilian).
- Registered in `MODULE_PAGES` (and thus live in grids/sitemap/OG): **14**. The `modifications-exemptions` (civilian Waivers) content file is authored but **not** registered until the owner confirms the app feature ships — the site must not describe a capability the app lacks.
- `SHIPPED_PAGE_COUNT`: **36 → 50** (36 + 14).
- OG routes: 10 static + 50 module = **46 → 60**.

## 3. The three framing calls (owner-confirmed)

### 3.1 Civilian ACSI → "Part 139 Certification Inspection"
The FAA *conducts* the Part 139 certification inspection. The page sells **preparation and self-audit**: readiness checks, findings tracked to closure, and a filed record ready when the inspector arrives. It must **never** imply Glidepath performs, replaces, or substitutes for the FAA's inspection. Mode label already exists in `airport-mode.ts:177` (`compliance_inspection: { faa: 'Part 139 Annual Inspection' }`).

### 3.2 Civilian Obstructions → Part 77 (confirmed real)
`app/(app)/obstructions/page.tsx:729-730` offers a surface-set toggle: `ufc_3_260_01` (USAF) vs `faa_part77` ("FAA Part 77", "14 CFR §77.19 — civilian"), defaulting to Part 77 for civilian bases via `getSurfaceSet()`. The page can honestly claim Part 77 imaginary-surface evaluation.

### 3.3 Civilian Waivers → "Modifications & Exemptions" (gated)
The owner is adding the app feature for civilian Modifications of Standards / exemptions; it is **not live yet**. The content file is authored to the intended capability but withheld from `modules-data.ts`, `MODULE_PAGES`, the sitemap, the OG set, and the pillar grid until the owner confirms the feature ships. Wiring it in later is a one-line import + `og:images` regen + count bump.

## 4. App change (airfield-app): open ACSI to civilian

1. `lib/modules-config.ts` (~line 101): the `acsi` module has `appliesTo: ['usaf']`. Change to both modes (remove the restriction or set `['usaf', 'faa_part139']`), so civilian tenants get the module in their list and setup wizard.
2. `app/(app)/acsi/page.tsx`: the header hardcodes "Airfield Compliance and Safety Inspection" (line ~96) and "DAFMAN 13-204v2, Para 5.4.3" (line ~99). Make both **mode-aware** using the existing `compliance_inspection` label and a mode-aware reg cite (USAF: DAFMAN 13-204 V2 §5.4.3; FAA: 14 CFR Part 139). Read mode from `currentInstallation` via the existing `airport-mode.ts` helpers.
3. Enable `acsi` in KDRA's `enabled_modules` so the civilian page is capturable.
4. Gates: airfield-app `tsc` + `lint` + `build`. This deploys to the app (KDRA is the only civilian tenant, so blast radius is the demo).

The owner's Waivers app feature is **owner-owned** — not part of this work.

## 5. Military Events Log refocus

Splitting `reports` out leaves the existing military `events-log-reports` page. Refocus its grid-card name (`modules-data.ts`) to "Events Log" and trim its reports-heavy copy so the two pages don't overlap, **keeping its slug `events-log-reports`** for URL/OG/sitemap stability. Both tracks then read symmetrically: an Events Log page and a Reports page each. Flag the refocused copy for the owner's review pass.

## 6. Capture strategy (owner-chosen: author copy first, capture in parallel)

Author and wire all copy first so it flows into the owner's review tool immediately. Per page:
- **Cleanly shootable now** (module runs on the demo tenant with photogenic data): capture a real frame with a frame-checked caption via the existing pipeline (`glidepath-site/scripts/capture-screenshots.mjs`, `capture-manifest.mjs`). Switch the demo user's active base to match the tenant first.
- **Not cleanly shootable yet** (Feedback, Read File, anything needing staging): ship text-only (empty `how.screenshots` array — valid, renders no figure, passes the existence invariant) and capture in a follow-up pass.
- Every caption edit and new frame gets the claims-guardrail review (no real names/emails/units/phones) and caption-vs-frame check before commit.

## 7. Wiring and tests

- `lib/modules-data.ts`: 14 new `MODULES` entries (name, slug, track, tagline, optional `regCite`). Not the gated Waivers page.
- `lib/modules/index.ts`: import + register the 14, bump `SHIPPED_PAGE_COUNT` 36 → 50.
- `app/sitemap.ts` and `lib/og-routes.ts`: auto-derive from `MODULE_PAGES` — no manual edits beyond the registration.
- OG images: `npm run og:images` regenerates to 60 PNGs; update the count assertion in `tests/og-images.test.ts` (46 → 60).
- Pillar grids (`/military`, `/civilian`): auto-render from `modules-data.ts`.
- Guards (carry from Phase 4, all enforced by `tests/terminology.test.ts` over `allCopy()`): no em dashes / spaced en dashes; never "AMT", "FOD walk", paper/whiteboard/clipboard comparisons, snake_case role keys, "PII" (say "sensitive personal data"), endorsement claims; "Glidepath Technologies" only in about/platform/legal carriers. Every new content file registers in `allCopy()`.
- Per-page invariants (`tests/module-content.test.ts`): metaTitle ≤ 60, metaDescription ≤ 160, FAQ 3–5 entries, screenshots exist; roster 1:1 (every `modules-data` entry renders a full page — `tests/route-stubs.test.tsx`).
- Voice: civilian says "airport", military says "airfield"; no fabricated regulatory text; separately-written copy per track (no cross-track prose reuse ≥ 8 consecutive words).
- Gates before every commit: `npx tsc --noEmit && npm run lint && npm run test && npm run build`, all RC=0.

## 8. Batching (owner-chosen: thematic, ~4 batches)

1. **Military parity** — `reports`, `records-export` (2)
2. **Civilian ops** — `airport-checks`, `shift-checklist`, `events-log`, `emergency-checklists` (4)
3. **Civilian compliance** — `part-139-inspection` (+ the ACSI app change §4), `flip-management`, `field-conditions`, `obstructions`, `modifications-exemptions` (gated) (5)
4. **Both-track** — `feedback` ×2, `read-file` ×2 (4)

Each batch: authored copy-first with best-effort captures → four site gates → regenerate the owner's review artifact so the new pages appear (prior batches' green marks preserved) → next batch. A whole-branch review, OG regeneration, and the `SHIPPED_PAGE_COUNT`/OG-count bump close the work.

## 9. Acceptance

- 14 pages live (grids, sitemap, OG), 1 (Waivers) authored and staged.
- All four site gates green; app change gated green in airfield-app.
- Owner has reviewed every new page's copy in the review tool.
- Captures present for cleanly-shootable pages; text-only pages flagged for the follow-up capture pass.
- Civilian ACSI, Obstructions, and Waivers pages honor their §3 framing rules.

## 10. Fresh-session pointers (exploration already done 2026-07-05)

- Part 77 toggle: `airfield-app/app/(app)/obstructions/page.tsx:729-730`, `getSurfaceSet()` in `lib/airport-mode.ts`.
- ACSI mode label: `airfield-app/lib/airport-mode.ts:177` (`compliance_inspection`).
- ACSI hardcoded header: `airfield-app/app/(app)/acsi/page.tsx:96,99`.
- ACSI registry restriction: `airfield-app/lib/modules-config.ts:~101` (`appliesTo: ['usaf']`).
- App module routes: `modules-config.ts` `hrefs` (feedback `/feedback`, read-file `/read-file`, flip `/flip`, field-conditions `/field-conditions`, reports `/reports`, records-export `/settings/exports`).
- Content-file template to clone: any existing `glidepath-site/lib/modules/{track}/<slug>.ts` (e.g. `military/discrepancies.ts`).
- Review-tool generator: rebuilt each sitting from `MODULE_PAGES` + `platformContent` + `aboutContent`; DONE_KEYS marks owner-reviewed blocks green (42 as of batch 2).
