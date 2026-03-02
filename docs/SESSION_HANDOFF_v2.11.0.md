# Session Handoff — v2.11.0 (2026-03-02)

## What Was Built This Session

### ACSI Module (14 new files)
Complete Airfield Compliance and Safety Inspection module per DAFMAN 13-204v2, Para 5.4.3.

**New files created:**
- `app/(app)/acsi/page.tsx` — List page with KPI badges, status filter, search
- `app/(app)/acsi/new/page.tsx` — Form page (622 lines) — 10 collapsible sections, Y/N/N/A toggles, discrepancy documentation, team editor, risk cert, auto-save
- `app/(app)/acsi/[id]/page.tsx` — Detail page (398 lines) — read-only view with edit button for authorized roles
- `components/acsi/acsi-section.tsx` — Collapsible section with progress counter
- `components/acsi/acsi-item.tsx` — Checklist item with Y/N/N/A toggle + discrepancy expansion
- `components/acsi/acsi-discrepancy-panel.tsx` — Per-item failure documentation (comment, WO#, project#, cost, date, photos)
- `components/acsi/acsi-team-editor.tsx` — Inspection team with 3 required + additional members
- `components/acsi/acsi-risk-cert.tsx` — Risk management certification with 3 signature blocks
- `components/acsi/acsi-location-map.tsx` — Mapbox map for location pins (square aspect ratio, 210x210)
- `lib/acsi-pdf.ts` — PDF export (612 lines) with `didParseCell`/`didDrawCell` hooks, parent/sub-field hierarchy, inline discrepancy photos/maps
- `lib/acsi-excel.ts` — Multi-sheet Excel export (Cover, Checklist, Team, Risk Cert)
- `lib/acsi-draft.ts` — Draft persistence (localStorage + DB auto-save)
- `lib/supabase/acsi-inspections.ts` — CRUD module (fetchAll, fetchOne, saveDraft, file, delete, uploadPhoto, fetchPhotos)
- `supabase/migrations/2026030200_create_acsi_inspections.sql` — Table + RLS + photo FK columns

**Modified files:**
- `lib/supabase/types.ts` — Added AcsiItem, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData, AcsiStatus, AcsiInspection types
- `lib/constants.ts` — Added ACSI_CHECKLIST_SECTIONS (10 sections, ~100 items), ACSI_STATUS_CONFIG, ACSI_TEAM_ROLES (~400 lines added)
- `lib/demo-data.ts` — Added DEMO_ACSI_INSPECTIONS (2 sample records)
- `components/layout/sidebar-nav.tsx` — Added ACSI entry with ShieldCheck icon

### All Inspections Hub
- `app/(app)/inspections/all/page.tsx` — Navigation hub with styled cards for 4 inspection types (Daily, ACSI, Pre/Post Construction, Joint Monthly), each with Start and History buttons
- `app/(app)/more/page.tsx` — Added "All Inspections" as first menu item

### Airfield Check Improvements
- `app/(app)/checks/page.tsx` — `handleComplete` now auto-saves pending remark text before finalizing
- `app/(app)/checks/[id]/page.tsx` — Removed unused Notes section (was lines 425-488), removed `updateCheckNotes` import and `editingNotes`/`notesText` state

### Version Bump
- `package.json` → 2.11.0
- `app/login/page.tsx` → v2.11
- `app/(app)/settings/page.tsx` → 2.11.0

---

## Architecture Notes for ACSI Module

### Data Model
- **Separate table**: `acsi_inspections` — not reusing `inspections` table due to unique fields (inspection_team JSONB, risk_cert_signatures JSONB, fiscal_year, per-item discrepancy details in items JSONB)
- **Items stored as JSONB array**: Each item has `section_id`, `item_number`, `question`, `response` (pass/fail/na/null), `hasSubFields`, and failure-specific fields (`comment`, `work_order`, `project_number`, `estimated_cost`, `estimated_completion`, `photo_ids`, `location_pins`)
- **Display ID format**: `ACSI-{FY}-{4-digit sequence}`
- **Status workflow**: draft → in_progress → completed → staffed

### PDF Export Pattern
The ACSI PDF (`lib/acsi-pdf.ts`) uses the same `didParseCell`/`didDrawCell` hook pattern as the discrepancy report PDF. Key implementation details:
- Pre-fetches all photo and map data URLs as base64 before table construction
- Row metadata array tracks `'item' | 'parent' | 'detail'` types
- Parent rows: bold text, light blue-gray background, no response column
- Sub-field rows: 7.5pt font, 14mm left padding, lighter text color
- Detail rows (discrepancy info for failures): content rendered entirely in `didDrawCell`, table cell intentionally empty
- Photos/maps embedded inline below failure detail text

### Draft Persistence
- localStorage auto-save with 1-second debounce (same pattern as `lib/inspection-draft.ts`)
- On new inspection mount, auto-saves to DB immediately so photo uploads work without manual save
- `dbRowId` state tracks the row ID for subsequent saves

### Role-Based Edit Access
- `canEdit = isAdmin || userRole === 'airfield_manager'`
- Edit button visible on detail page for authorized roles regardless of inspection status

---

## Codebase Audit Summary

### File Counts
| Category | Count |
|----------|-------|
| TypeScript/TSX/JSX source files | 147 |
| App pages/routes | 53 |
| Components | 33 |
| Library modules | 53 |
| SQL migrations | 57 |
| Total lines of code | ~50,145 |

### Build Status
`npm run build` passes clean — zero TypeScript errors, all 50 routes compile.

### Untracked Files in Git
These files exist on disk but are NOT committed:
1. `aircraft_images/` — Root-level duplicate of `public/aircraft_images/` (can delete)
2. `public/commercial_aircraft.json` — Duplicate of root `commercial_aircraft.json`
3. `public/military_aircraft.json` — Duplicate of root `military_aircraft.json`
4. `public/image_manifest.json` — Duplicate of root `image_manifest.json`
5. `supabase/migrations/2026022701_inspection_photos.sql` — Untracked migration (should be committed or removed if already applied)

### Orphaned / Misplaced Files
1. **`components/PDFLibrary.jsx`** — Only JSX file in the project; needs TSX conversion
2. **`public/aircraft_images/military/commercial/`** — Contains ~20 commercial aircraft images duplicated from `public/aircraft_images/commercial/` (can delete entire folder)
3. **`public/aircraft_images/commercial/Screenshot 2026-02-21 011347.png`** — Stray screenshot in aircraft images
4. **`public/aircraft_images/military/commercial/Screenshot 2026-02-21 011347.png`** — Same stray screenshot
5. **Root JSON duplicates** — `commercial_aircraft.json`, `military_aircraft.json`, `image_manifest.json` at project root duplicate files in `public/`

### Code Quality Metrics
| Metric | Value | Status |
|--------|-------|--------|
| `as any` casts | 197 across 27 files | Medium debt — fix with `supabase gen types` |
| TODO/FIXME/HACK | 0 | Clean |
| console.log in production | 1 (PDFLibrary.jsx) | Low |
| console.warn in production | 5 (RegulationPDFViewer, surface-criteria, userDocuments) | Acceptable |
| Test files | 0 | High debt — no test suite |
| Broken imports | 0 | Clean |
| Orphaned components | 0 | Clean |

### Largest Files (candidates for refactoring)
| File | Lines |
|------|-------|
| `app/(app)/inspections/page.tsx` | 1,929 |
| `app/(app)/regulations/page.tsx` | 1,638 |
| `app/(app)/waivers/[id]/page.tsx` | 1,312 |
| `app/(app)/settings/page.tsx` | 1,289 |
| `lib/regulations-data.ts` | 1,164 |
| `app/(app)/settings/base-setup/page.tsx` | 1,131 |
| `app/(app)/obstructions/page.tsx` | 1,029 |
| `app/(app)/inspections/[id]/page.tsx` | 975 |
| `app/(app)/page.tsx` (dashboard) | 884 |
| `lib/pdf-export.ts` | 845 |
| `lib/supabase/waivers.ts` | 809 |

---

## Tech Debt Summary (Pre-Branch)

### High Priority
1. **No test suite** — Zero automated tests. Consider adding at least smoke tests for critical paths (auth, inspection creation, photo upload)
2. **197 `as any` casts** — Run `supabase gen types typescript` with your Supabase project to generate typed client. Most casts are in `lib/supabase/*.ts` CRUD modules

### Medium Priority
3. **Untracked migration** — `supabase/migrations/2026022701_inspection_photos.sql` needs to be committed or removed
4. **Weather API stub** — `/api/weather` returns placeholder data; Open-Meteo is used client-side directly
5. **Console statements** — 1 `console.log` in PDFLibrary.jsx, 5 `console.warn` in production components (mostly error fallbacks)

### Low Priority
6. **PDFLibrary.jsx** — Only non-TypeScript component file; convert to `.tsx`
7. **30+ files > 500 lines** — inspections/page.tsx is nearly 2,000 lines; consider splitting into sub-components
8. **Duplicate files** — Root-level aircraft JSON files and `aircraft_images/` folder duplicate `public/` content
9. **Stray screenshots** — 2 screenshot PNGs accidentally committed in aircraft image directories
10. **`public/aircraft_images/military/commercial/`** — Entire folder is a duplicate of `public/aircraft_images/commercial/`

### Cleanup Commands (Optional)
```bash
# Remove duplicate root-level aircraft data
rm commercial_aircraft.json military_aircraft.json image_manifest.json
rm -rf aircraft_images/

# Remove duplicate commercial images from military folder
rm -rf public/aircraft_images/military/commercial/

# Remove stray screenshots
rm "public/aircraft_images/commercial/Screenshot 2026-02-21 011347.png"

# Commit the untracked migration (if not already applied to production)
git add supabase/migrations/2026022701_inspection_photos.sql
```

---

## What's Ready for Next Phase

### Fully Functional Modules
All 15 modules are complete and functional:
1. Dashboard (weather, runway status, advisory, presence tracking)
2. Activity Log (manual entries, edit/delete, Excel export)
3. Daily Inspections (form, detail, PDF export)
4. ACSI (form, detail, list, PDF/Excel export)
5. Airfield Checks (7 types, history, detail, PDF export)
6. NOTAMs (live FAA feed, local drafts)
7. Discrepancies (full lifecycle, map view COP)
8. Obstruction Evaluations (UFC 3-260-01, map overlays)
9. References (70+ regulations, offline caching, My Documents)
10. Aircraft Database (1,000+ entries, ACN/PCN comparison)
11. Waivers (AF Form 505, annual review, PDF/Excel export)
12. Reports (4 types with PDF export)
13. User Management (RBAC, invite, delete cascade)
14. Settings (base setup, templates, appearance)
15. All Inspections hub (navigation to all inspection forms)

### Placeholder Module
- **Sync & Data** (`/sync`) — Page exists with "coming soon" content

### Suggested Next Steps
1. Clean up duplicate/orphaned files (see commands above)
2. Regenerate Supabase types to eliminate `as any` casts
3. Add automated tests (start with critical path smoke tests)
4. Implement Sync & Data module for offline queue/export/import
5. Server-side email delivery for inspection reports
6. Convert PDFLibrary.jsx to TypeScript
7. Consider splitting the 5 largest page files (1,000+ lines each)
