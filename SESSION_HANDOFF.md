# Session Handoff

**Date:** 2026-07-06
**Branch:** `main`. Both repos **fully pushed and clean**. `airfield-app` is
**2 commits ahead of the promoted build** (`7f9383bc`, `64e5796d` — the ACSI
mode-aware form/PDF work) and needs a **re-promote** on Vercel to go live.
`glidepath-site` is promoted and **live** (all 50 pages).
**Build:** `airfield-app` tsc ✓ · lint 0 errors · `npm run build` ✓.
`glidepath-site` tsc ✓ · lint ✓ · `npm run test` 74/74 · `npm run build` ✓.
**HEAD:** `airfield-app` `64e5796d` · `glidepath-site` `3688a57`.

This session executed the **module roster expansion** end to end (glidepath-site
36 → 50 module pages) via subagent-driven-development, plus the supporting
airfield-app changes to open ACSI to civilian mode and make it fully mode-aware.

---

## What shipped this session

### Marketing-site roster expansion — complete (glidepath-site, 7 commits `df8e0b8`..`3688a57`)
14 new module pages authored copy-first with real, guardrail-cleared captures,
in 4 thematic batches (each: implementer subagent → controller/review → owner
review-tool), plus a whole-branch review (Opus) that returned **READY TO PUSH**:
- **Military (4):** Reports, Records Export, Customer Feedback, Read File (+ the
  existing Events Log page refocused off the reports half).
- **Civilian (10):** Airport Checks, Shift Checklist, Events Log, Emergency
  Checklists, Field Conditions, Obstructions (Part 77 framing), FLIP Management
  (FAA terms), Part 139 Certification Inspection (prepare-not-perform), Customer
  Feedback, Read File.
- **Gated (1, authored but wired NOWHERE):** civilian Modifications & Exemptions
  (`lib/modules/civilian/modifications-exemptions.ts`) — held until the owner
  ships the app feature.
- Roster **36 → 50** (26 military / 24 civilian), OG **46 → 60**,
  `SHIPPED_PAGE_COUNT` 50, "50 modules" prose. **Owner copy-reviewed all 50
  pages: no changes required.**

### App: ACSI opened to civilian + fully mode-aware (airfield-app `050374df`, `7f9383bc`, `64e5796d`)
- `lib/modules-config.ts`: `acsi.appliesTo` → `['usaf','faa_part139']`.
- `/acsi` reads **"Part 139 Annual Inspection" / "14 CFR Part 139"** on civilian
  tenants and "ACSI" / "DAFMAN 13-204v2, Para 5.4.3" on military, everywhere:
  the main-page header, the form/list labels (Start New, empty-state, per-row
  Reopen/Delete confirms + toasts, new/edit heading, Back-to-List links,
  not-found, emailed report subject), the **record display_id prefix**
  (`P139-` vs `ACSI-`, from the base's `airport_type` at insert), and the
  **generated PDF** (title, reg cite, risk-cert statement) via a new
  `AcsiPdfOptions.airportType`. Mode is read from `getAirportType(currentInstallation)`.

### Demo-data seeds (owner-authorized, additive/reversible)
KDRA was under-seeded for several modules, so real capture frames required
seeding. Seeded: KDRA `shift_checklist_items` ×7, `qrc_templates` ×8 (civilian
emergency titles, title-only stubs), `customer_feedback` ×4, `read_files` ×3;
KDMO `read_files` ×3. Owner ruled: **keep the seeds**.

### Guardrail scrubs
- KDMO `customer_feedback` carried the owner's real submission (name/email/unit)
  → scrubbed to an anonymous transient in the marketing frame (capture prep hook).
- KDRA ACSI record `ACSI-2026-HN2K` held the owner's real name (`inspector_name`,
  `filed_by_name`) → **cleaned on the actual DB record** to "Demo Inspector"
  (verified no "Proctor" survives in any field). Both KDRA records' display_id
  updated `ACSI-` → `P139-`.

---

## Migrations status
No new migrations this session. All changes are content (glidepath-site), app
code (airfield-app), and demo-data seeds/updates on the linked DB (not migrations).

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **airfield-app needs re-promote** | high (owner) | 2 commits (`7f9383bc`,`64e5796d`) live-ready but not promoted; the ACSI form/PDF mode-aware fixes won't show until then |
| **App-side dual-mode terminology (other modules)** | med | ACSI is now fully mode-aware, but civilian tenants still leak military terms elsewhere: `/discrepancies` AFM/CES/AMOPS KPI chips, `/inspections` "DAFMAN 13-204V2", `/checks` header "AIRFIELD CHECK"/DAFI cite, `/qrc` "Quick Reaction Checklists", `/flip` "DAFMAN…Continuity Binder", `/obstructions` "UFC 3-260-01". `lib/airport-mode.ts` SoT doesn't cover them. The site captions worked around them |
| Civilian QRC templates are title-only stubs | low | KDRA `qrc_templates` ×8 have "0 steps / Never reviewed"; enrich for a richer `/qrc` frame if desired |
| Text-only capture strategy is not viable | low (reference) | `module-content.test.ts` requires ≥1 real screenshot per registered page; see memory `project_marketing_capture_pipeline` |
| Carried low items | low | Status-page weather race (`app/(app)/page.tsx:194`); demo-form email-fail-after-insert silent; account-deactivation doesn't kill live sessions (`middleware.ts:50-58`); `gh` CLI absent; Selfridge 1098 dedup — all unchanged |

---

## Next session tasks
1. **Owner:** re-promote airfield-app so the ACSI form/PDF mode-aware fixes go live.
2. **App-side dual-mode terminology sweep** — extend `lib/airport-mode.ts` +
   the leaking modules (`/discrepancies`, `/inspections`, `/checks`, `/qrc`,
   `/flip`, `/obstructions`) to render FAA terms on civilian tenants, mirroring
   what was just done for ACSI. Would also make future civilian captures leak-free.
3. **Optional owner follow-ups:** enrich the KDRA QRC stubs; the marketing
   Modifications & Exemptions page is authored + staged, ready to wire when the
   owner ships the app Waivers/Modifications feature.

### Long-running carryover
Phase 5 (app apex cutover to `app.glidepathops.com`) and the SEO/rich-results
follow-ups remain owner-scheduled. Deferred audit items, Next 16 — unchanged.

---

## Build snapshot
```
glidepath-site @ 3688a57: tsc ✓ · lint ✓ · vitest 74/74 · build ✓ (60 static
  paths). 50 module pages (26 mil + 24 civ) + about/platform/security/faq/demo/
  legal/404 + home + two pillars. 60 OG images. PROMOTED / live.

airfield-app @ 64e5796d: tsc ✓ · lint 0 errors · build ✓. ACSI mode-aware end to
  end. 2 commits ahead of the promoted build — RE-PROMOTE pending.
```

---

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-05..06 | Marketing-site roster expansion (36→50 module pages, 60 OG, whole-branch reviewed + owner copy-approved); ACSI opened to civilian mode and made fully mode-aware (header, form, record IDs, PDF). Demo-data seeds on KDRA/KDMO; KDRA ACSI real-name cleanup. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File modules; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key docs / files touched this session
### airfield-app
- `lib/modules-config.ts` (acsi appliesTo), `app/(app)/acsi/{page,new,[id]}.tsx`
  (mode-aware labels), `lib/supabase/acsi-inspections.ts` (display_id prefix),
  `lib/acsi-pdf.ts` (mode-aware title/cite/cert + `airportType` option),
  `lib/export/export-record-modules.ts` (export PDF mode inference).
- `docs/superpowers/specs/2026-07-05-roster-expansion-design.md`,
  `docs/superpowers/plans/2026-07-05-roster-expansion.md` (executed this session).

### glidepath-site (the session's main story; fully pushed + live)
- `lib/modules/{military,civilian}/**` (14 new content files + events-log refocus),
  `lib/modules/index.ts`, `lib/modules-data.ts`, `lib/about-content.ts`,
  `lib/og-routes.ts`, `scripts/capture-manifest.mjs` (new shot entries + prep
  scrubs), `scripts/generate-og-images.ts` (`--only` flag), `public/screenshots/*`,
  `public/og/*` (60), `tests/*` (count bumps).
