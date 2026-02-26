# Session Handoff — v2.4.0 (2026-02-26)

## Project State Summary

**App**: Glidepath — Airfield OPS Management Suite
**Version**: 2.4.0 (synced across package.json, more/page.tsx, CHANGELOG.md, README.md)
**Build**: TypeScript compiles clean (`tsc --noEmit` — zero errors)
**Branch**: `main` at commit `b6bd7e7`
**Remote**: Up to date with `origin/main`

---

## What's Built (12 Complete Modules)

| Module | Route | Status | Key Features |
|--------|-------|--------|--------------|
| Dashboard | `/` | Complete | Weather, advisory, runway status, NAVAID toggles, activity feed, quick actions |
| Discrepancies | `/discrepancies` | Complete | 11 types, full lifecycle, photos, map, notes, work orders |
| Airfield Checks | `/checks` | Complete | 7 check types, camera, map, history |
| Daily Inspections | `/inspections` | Complete | Configurable templates, combined reports, PDF export |
| Waivers | `/waivers` | Complete | AF-505 lifecycle, annual review, PDF/Excel export, 17 KMTC seed records |
| NOTAMs | `/notams` | Complete | Live FAA feed, ICAO search, local NOTAM creation |
| Obstruction Eval | `/obstructions` | Complete | UFC 3-260-01 multi-runway analysis, interactive map |
| Reports | `/reports` | Complete | Daily ops, open discrepancies, trends, aging — all with PDF export |
| Aircraft Database | `/aircraft` | Complete | 1,000+ entries, ACN/PCN comparison, favorites |
| References | `/regulations` | Complete | 70 regulations, PDF viewer, offline cache, My Documents |
| Settings | `/settings` | Complete | Base setup, inspection templates, themes |
| PDF Library | `/library` | Complete | Admin PDF management, text extraction |

**Placeholder modules**: Sync & Data (`/sync`), Users & Security (`/users`)

---

## Architecture Overview

```
38 routes | 120+ source files | 47 migrations | 25+ database tables
```

- **Framework**: Next.js 14 (App Router) + TypeScript strict mode
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Tailwind CSS with CSS custom properties (light/dark/auto themes)
- **Maps**: Mapbox GL JS
- **PDF**: jsPDF (export) + react-pdf (viewing)
- **Excel**: SheetJS (xlsx)
- **Offline**: PWA + IndexedDB (6 object stores)
- **Demo Mode**: Full offline operation with mock data when Supabase not configured

### Key Patterns
- **CRUD modules**: `lib/supabase/<entity>.ts` — `createClient()` null check returns empty for demo mode
- **Demo data**: `lib/demo-data.ts` — 8 arrays for all modules
- **Constants**: `lib/constants.ts` — type/status configs with color/bg/label
- **Types**: `lib/supabase/types.ts` — Database type + convenience aliases
- **Activity logging**: `logActivity()` from `lib/supabase/activity.ts`
- **Installation context**: `useInstallation()` → installationId, areas, userRole, ceShops
- **Multi-base**: All data tables carry `base_id` FK, queries scoped to current installation

---

## Tech Debt & Known Issues

### High Priority (should fix before next feature branch)

1. **151 `as any` type assertions** across 19 files
   - Root cause: `lib/supabase/types.ts` is incomplete — many tables not in the generated types
   - Fix: Run `supabase gen types typescript` to regenerate types from the live schema
   - This would also eliminate ~163 `eslint-disable @typescript-eslint/no-explicit-any` comments

2. **Version was out of sync** (now fixed)
   - package.json was 2.1.0, more/page.tsx was 2.4.0 — now all synced to 2.4.0

### Medium Priority (clean up when convenient)

3. **8 dead/unused files** that can be deleted:
   - `lib/validators.ts` — Zod schemas never imported anywhere (also makes `zod` dep unused)
   - `lib/installation.ts` — Legacy helper superseded by `useInstallation()` context
   - `lib/supabase/middleware.ts` — Logic duplicated in root `middleware.ts`, never imported
   - `lib/pdfTextCache.ts` — Orphaned, never imported by any component
   - `components/ui/card.tsx` — Unused UI component
   - `components/ui/input.tsx` — Unused UI component (StyledInput, StyledSelect, StyledTextarea)
   - `components/ui/loading-skeleton.tsx` — Unused UI component
   - `components/layout/page-header.tsx` — Unused layout component

4. **`PDFLibrary.jsx`** — Only JSX file in a TypeScript codebase
   - Located at `components/PDFLibrary.jsx` (62.4 KB)
   - Actively used (dynamic import from `/library/page.tsx`)
   - Should be converted to TSX when touching this file

5. **1 debug `console.log`** in `components/PDFLibrary.jsx:354`
   - Logs persistent storage grant result — minor, consider removing for production

### Low Priority (future consideration)

6. **40 MB of aircraft images committed to git** (`public/aircraft_images/`)
   - 211 JPG files bloating the repo
   - Should eventually move to Supabase Storage or CDN

7. **Duplicate/misplaced files in repo root and public/**:
   - `public/commercial_aircraft (1).json`, `public/military_aircraft (1).json` — browser download duplicates
   - `public/001_pdf_text_search.sql` — SQL file in public web directory
   - Root-level `commercial_aircraft.json`, `military_aircraft.json`, `image_manifest.json` — duplicated
   - `migration_aircraft_characteristics.sql` — orphaned at repo root

8. **Stale git branches** (5 local, 11 remote):
   - Local: `build-gp-aircraftdatabase`, `claude/build-aos-reg-database-R4Ytm`, `claude/start-glidepath-app-LFQyC`, `feature/scale`, `waivers/create`
   - Remote: 9 `origin/claude/*` branches + merged `origin/feature/scale` and `origin/waivers/create`

9. **Untracked files in working tree**:
   - `aircraft_images/` (root) — 40 MB duplicate of `public/aircraft_images/`
   - `public/commercial_aircraft.json`, `public/military_aircraft.json`, `public/image_manifest.json` — duplicates of root files
   - `supabase/.temp/` — should be gitignored

10. **RLS disabled on all tables** — MVP decision, must be re-enabled before production

---

## Waivers Module — Detailed State

The waivers module is the most recently built and most complex module. Here's its complete state:

### Database Tables (5)
- `waivers` — Core waiver records with AF-505 fields
- `waiver_criteria` — UFC/standard references (FK CASCADE)
- `waiver_attachments` — Photos and documents (FK CASCADE)
- `waiver_reviews` — Annual reviews with UNIQUE(waiver_id, review_year)
- `waiver_coordination` — Office-by-office tracking

### CRUD Functions (`lib/supabase/waivers.ts`)
- Core: fetchWaivers, fetchWaiver, createWaiver, updateWaiver, updateWaiverStatus, deleteWaiver
- Criteria: fetchWaiverCriteria, fetchAllWaiverCriteria, upsertWaiverCriteria
- Attachments: fetchWaiverAttachments, uploadWaiverAttachment, deleteWaiverAttachment
- Reviews: fetchWaiverReviews, fetchAllWaiverReviews, fetchReviewsByYear, createWaiverReview, deleteWaiverReview
- Coordination: fetchWaiverCoordination, upsertWaiverCoordination, updateWaiverCoordination, deleteWaiverCoordination

### Status Flow
```
draft → pending → approved → active → closed / expired / cancelled
                                 ↕           ↕
                              expired ←→ closed
                                 ↓           ↓
                              active ←────── active (reactivate)
cancelled → draft (re-open)
```
All transitions between active/expired/closed require mandatory comments via dialog.

### Pages (6)
- `/waivers` — List with KPIs, filters, search, Excel export
- `/waivers/new` — 5-section form + photos + attachments
- `/waivers/[id]` — 6-section detail + status actions + PDF export
- `/waivers/[id]/edit` — Pre-populated edit form
- `/waivers/annual-review` — Redirects to current year
- `/waivers/annual-review/[year]` — Per-year review forms with KPIs

### Seed Data
- 17 KMTC (Selfridge ANGB) waivers with VGLZ format numbers
- Criteria references for each
- 2025 annual review records

---

## Files Changed Since v2.2.0

### New Files
- `lib/supabase/waivers.ts` — Waiver CRUD (~17 functions)
- `lib/waiver-export.ts` — Excel export
- `lib/waiver-pdf.ts` — PDF export
- `app/(app)/waivers/page.tsx` — List page
- `app/(app)/waivers/new/page.tsx` — Create form
- `app/(app)/waivers/[id]/page.tsx` — Detail page
- `app/(app)/waivers/[id]/edit/page.tsx` — Edit page
- `app/(app)/waivers/annual-review/page.tsx` — Year redirect
- `app/(app)/waivers/annual-review/[year]/page.tsx` — Year review
- 7 migration files (`2026022503` through `2026022509`)

### Modified Files
- `lib/constants.ts` — Waiver classifications, statuses, transitions, hazard ratings, etc.
- `lib/supabase/types.ts` — New type aliases for waiver tables
- `lib/demo-data.ts` — 4 new demo arrays (waivers, criteria, reviews, coordination)
- `app/(app)/waivers/page.tsx` — Complete rewrite from placeholder to full list
- `app/(app)/more/page.tsx` — Version bump to v2.4.0

---

## Recommended Next Steps

### Immediate (before next feature branch)
1. **Regenerate Supabase types** — `supabase gen types typescript --project-id <id> > lib/supabase/types.ts` to eliminate 151 `as any` casts
2. **Delete dead files** — Remove the 8 unused files listed in tech debt section
3. **Clean stale branches** — Delete merged local and remote branches
4. **Add `supabase/.temp/` to .gitignore**

### Phase 3 Candidates (from original plan)
- Users & Security module — user management, role assignment, profile editing
- Sync & Data module — offline queue, data export/import
- Weather METAR integration — replace stub with `aviationweather.gov` API
- Server-side email delivery for inspection reports
- Re-enable RLS policies for production security

---

## Quick Reference

| Item | Value |
|------|-------|
| Repo | `C:/Users/cspro/airfield-app` |
| Branch | `main` at `b6bd7e7` |
| Version | 2.4.0 |
| Node | Standard Next.js (check with `node -v`) |
| Dev server | `npm run dev` → `localhost:3000` |
| Type check | `npx tsc --noEmit` (passes clean) |
| Lint | `npx next lint` |
| Build | `npm run build` |
| Supabase | Project configured in `.env.local` |
| Demo mode | Works without Supabase credentials |
