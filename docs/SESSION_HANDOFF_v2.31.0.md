# Session Handoff — Glidepath v2.31.0

**Date:** 2026-04-07
**Branch:** `tweaks`
**Build:** Clean (zero errors)
**Commits this session:** 46 (on tweaks)

---

## What Was Done This Session

### Google Maps Migration (Major)
Complete migration of all 13 map components from Mapbox GL JS to Google Maps JS API. Mapbox was completely unusable on government networks due to WebGL rendering + TLS inspection latency causing 15+ second freezes.

**Components migrated:**
1. Location picker (7 consumers: discrepancies, waivers, ACSI, wildlife sighting/strike, simple discrepancy panel)
2. Discrepancy COP map view
3. Waiver map view
4. Obstruction evaluation map
5. Obstruction history map view
6. ACSI location map (multi-pin)
7. Wildlife heatmap (Google Maps HeatmapLayer)
8. Infrastructure feature picker
9. Base setup runway adjustment (draggable markers)
10. Taxiway editor (polyline drawing, buffer zones)
11. Infrastructure page (4,053 lines — canvas icons, spatial indexing, drag, edit/audit mode)
12. Parking page (3,735 lines — to-scale silhouettes, drag with distance labels, PDF capture)
13. Obstruction airfield map (was already on Google tiles)

**New infrastructure files:**
- `lib/google-maps.ts` — shared API init via `@googlemaps/js-api-loader`
- `lib/google-map-adapter.ts` — GMapWrapper, spatial index, icon caching with dimensions, hit testing, coordinate conversion
- 10 new `-google.tsx` component files
- `page-mapbox.tsx` backups for infrastructure and parking

**Key patterns established:**
- Canvas icons → `imageDataToDataUrl()` → `registerIcon()` with `iconSizes` map → Google Maps Marker with `scaledSize`
- Zoom scaling via `zoomScale()` / `zoomCircleRadius()` interpolation functions
- Parking silhouettes cached in `silhouetteCacheRef`, scaled via bounds-based `computeIconScale()`
- Async render cancellation via `renderCancelRef` token
- Hit testing via `queryFeatureAtPoint()` with 15m threshold
- Context menu: Ctrl+click (desktop) + long-press (touch)
- PDF capture: `html2canvas` with temporary 1600x900 resize

### Parking Plan Templates
- `is_template` flag on parking_plans (migration 2026040600)
- `duplicateParkingPlan()` deep-copies spots, taxilanes, boundaries
- Plan selector groups templates vs plans in optgroups
- "Save as Template" / "Convert to Plan" toggle
- Auto-space bulk aircraft using wingspan + wingtip clearance
- Heading preset in aircraft picker

### Custom Status Boards
- 2 new tables: `custom_status_boards` + `custom_status_items` (migration 2026040601)
- CRUD module: `lib/supabase/custom-status.ts`
- Dashboard renders configurable G/Y/R toggle panels
- Base Setup step 13 for board/item management

### PPR (Prior Permission Required) Log
- 2 new tables: `ppr_columns` + `ppr_entries` (migration 2026040602)
- Column types: text, date, time, yes/no/na, phone, number, email (migration 2026040603)
- CRUD module: `lib/supabase/ppr.ts` with auto PPR# generation
- New `/ppr` page with browsable table, date filtering, create/edit/delete
- Base Setup step 14 for column configuration with inline rename and reorder
- Dashboard integration (today's PPRs at bottom of Airfield Status)
- Sidebar nav under Operations

### Other Changes
- Weather advisory number persistence on AdvisoryItem
- T-3 Waiver Assessment PDF (`docs/Glidepath_T3_Waiver_Assessment.pdf`)
- Removed Memphis ANGB (KNQA) from base directory
- Service worker tile caching (ESRI, Google, Mapbox)
- Tile pre-cache in Settings > Data & Storage

### Migrations to Apply (+4)
- `2026040600` — `is_template` boolean on `parking_plans`
- `2026040601` — `custom_status_boards` + `custom_status_items`
- `2026040602` — `ppr_columns` + `ppr_entries`
- `2026040603` — `column_type` on `ppr_columns`

---

## Current State

### Stats
| Metric | Count |
|--------|-------|
| Version | 2.31.0 |
| Routes (pages) | 55 |
| Source files (.ts/.tsx) | 225 |
| Migrations | 130 |
| Database tables | 46 |
| `as any` casts | 223 across ~50 files |
| Files > 500 lines | 70+ |
| Files > 3,000 lines | 4 (base-setup 4,135, infrastructure 4,053, parking 3,735, infrastructure-mapbox 4,092) |

### Build Status
- `npm run build` passes with zero TypeScript errors
- Google Maps components: all 13 compile and render
- Mapbox components: preserved as backup files, not actively imported

---

## Tech Debt Summary

| Item | Priority | Detail |
|------|----------|--------|
| No test suite | High | 0 test files |
| ~223 `as any` casts | Medium | Google Maps adapter (~15), Supabase inserts (~70), jsPDF hooks (~11), misc (~127) |
| 11 orphaned Mapbox component files | Medium | Original Mapbox versions retained alongside `-google.tsx` versions. Safe to delete after migration validated across all bases |
| 2 `page-mapbox.tsx` backup files | Low | Infrastructure + parking Mapbox backups. Delete after migration stable |
| `map-load-gate.tsx` unused | Low | Created but never imported |
| `hooks/use-map-ruler.tsx` orphaned | Low | Mapbox-only ruler tool, not ported to Google Maps |
| `lib/map-config.ts` partially orphaned | Low | Only referenced by Mapbox backup files |
| `lib/tile-precache.ts` | Low | ESRI/Mapbox tile pre-cache — less useful now that all maps use Google Maps |
| `lib/reports/wildlife-report-pdf.ts` uses Mapbox | Medium | Still imports mapbox-gl for heatmap capture in PDF — needs Google Maps equivalent |
| Large files | Medium | 4 files > 3,000 lines |
| PDF boilerplate | Low | 16+ PDF generators share header/footer patterns |
| Check draft sync | Low | Two users could create duplicate checks |
| Storage RLS | Low | photos bucket relies on app-level checks |

---

## Env Vars Required

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps JS API + Static Maps API (all map components) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (only for backup/rollback; not actively used) |
| `GOOGLE_ELEVATION_API_KEY` | Server-side elevation proxy |
| All existing Supabase/Resend vars | Unchanged |

---

## Recommended Next Actions

### High Priority
1. **Validate Google Maps on gov network** — test all 13 map components on the government network to confirm they load smoothly
2. **Clean up orphaned Mapbox files** — once migration is validated, delete the 11 original Mapbox component files, 2 page-mapbox backups, `map-load-gate.tsx`, and `hooks/use-map-ruler.tsx`
3. **Fix wildlife-report-pdf.ts** — still uses Mapbox for heatmap capture in PDF export
4. **Training Management Module** — largest planned feature (Ch 8 of DAFMAN compliance)

### Medium Priority
5. **Shift Sign-Off & Daily Review** — DAFMAN 2.5.2.10.3/10.4 compliance without T-3 waiver
6. **Add estimated completion date to discrepancies** — DAFMAN 2.3.2.7.3
7. **Add estimated resume time to runway status** — DAFMAN 6.2.2
8. **Regenerate Supabase types** — eliminate ~40% of `as any` casts

### Low Priority
9. **Port ruler tool to Google Maps** — measurement tool for infrastructure/parking
10. **NOTAM tracking enhancements**
11. **ARFF status tracking**
12. **BowMonk Conversion Tool**

---

## Files Changed This Session

### Created (New Features)
- `app/(app)/ppr/page.tsx` — PPR Log page
- `lib/supabase/ppr.ts` — PPR CRUD module
- `lib/supabase/custom-status.ts` — Custom Status Boards CRUD
- `lib/google-maps.ts` — Shared Google Maps init
- `lib/google-map-adapter.ts` — Google Maps adapter (GMapWrapper, spatial index, icons)
- `lib/tile-precache.ts` — Tile pre-cache utility
- `lib/map-config.ts` — Mapbox style/perf config (partially orphaned)
- `components/ui/location-picker-map-google.tsx`
- `components/ui/infrastructure-feature-picker-google.tsx`
- `components/ui/map-load-gate.tsx` (unused)
- `components/discrepancies/discrepancy-map-view-google.tsx`
- `components/waivers/waiver-map-view-google.tsx`
- `components/obstructions/obstruction-map-view-google.tsx`
- `components/obstructions/airfield-map-google.tsx`
- `components/acsi/acsi-location-map-google.tsx`
- `components/wildlife/wildlife-heatmap-google.tsx`
- `components/taxiway-editor-google.tsx`
- `app/(app)/infrastructure/page-mapbox.tsx` (backup)
- `app/(app)/parking/page-mapbox.tsx` (backup)
- `scripts/generate-waiver-pdf.js`
- `docs/Glidepath_T3_Waiver_Assessment.pdf`
- 4 new migrations

### Modified (Major)
- `app/(app)/infrastructure/page.tsx` — full Google Maps rewrite (4,053 lines)
- `app/(app)/parking/page.tsx` — full Google Maps rewrite (3,735 lines)
- `app/(app)/page.tsx` — custom status boards + PPR on dashboard + weather number persistence
- `app/(app)/settings/base-setup/page.tsx` — Status Boards (step 13), PPR Columns (step 14), runway map → Google Maps, taxiway editor → Google Maps
- `app/(app)/settings/page.tsx` — tile cache UI in Data & Storage
- `lib/supabase/parking.ts` — is_template, duplicateParkingPlan
- `lib/supabase/airfield-status.ts` — AdvisoryItem.number field
- `lib/dashboard-context.tsx` — advisory number passthrough
- `lib/sidebar-config.ts` — PPR Log nav item
- `lib/base-directory.ts` — removed KNQA
- `next.config.js` — service worker tile caching rules
- All 7 location picker consumers swapped to Google Maps
- All 3 map view page imports swapped to Google Maps
