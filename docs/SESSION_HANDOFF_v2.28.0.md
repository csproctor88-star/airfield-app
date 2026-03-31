# Session Handoff — Glidepath v2.28.0

**Date:** 2026-03-28 through 2026-03-31
**Branch:** `tweaks` (39 commits ahead of `main`)
**Build:** Clean (TypeScript compiles with zero errors)
**Version:** 2.28.0

## Summary

This session focused on UI polish, events log improvements, discrepancy workflow streamlining, NAVAID map thumbnails, notification cleanup, and a dashboard revamp. Also conducted competitive analysis for potential commercialization.

## Commits (39 on `tweaks` branch)

### Realtime & Notifications
- Replaced aggressive toast spam with silent connection tracking + `warnIfRealtimeDown()` for action-triggered warnings only
- Consolidated cyan alert banners — multiple field changes produce a single banner
- DAFMAN threshold alerts folded into inspection completion toast

### Events Log & Activity
- Template-based entries now show exact template label as ACTION ("NOTAM Issued", "Shift Change", etc.)
- All details text uppercased across display, Excel export, and daily ops PDF
- Underscore display fixes in all report generators (entity types, check types, inspection types)
- Added 7 missing entity type labels across events log and daily ops PDF
- Color-coded ACTION column by entity type (cyan=checks, yellow=discrepancies, green=completed, etc.)
- Discrepancy CRUD no longer writes to activity_log (removed all 4 logActivity calls)

### Dashboard UI Revamp
- Quick Actions: 2-row grid → compact inspection status strip + pill buttons
- Last Check: full-width banner → slim centered card
- Log Entry: always-visible textarea → collapsed by default with expand on click
- Activity feed: color-coded, matching events log page
- Light mode: deeper backgrounds, dark header bar, stronger borders, richer accent colors
- Touch targets: all pills meet 44px minimum height
- Save point: `git tag ui-pre-revamp-v2.27`

### Discrepancies
- Edit modal: added Work Order # and Assigned To fields (no separate modals needed)
- Camera capture: dedicated button with `capture="environment"` for mobile
- Multi-photo upload: `multiple` attribute on file inputs
- Pending W/O filter tab on list page
- Activity log spam removed (status_updates table still tracks per-discrepancy history)

### ACSI
- Reopen for Editing: button on detail + inline on list page
- Reopen rebuilds draft_data from filed items (was creating blank drafts)
- Inline Edit/Reopen/Delete buttons on list page

### Visual NAVAID Map Thumbnails
- Component-scoped feature queries (not full system)
- Switched from GeoJSON simplestyle (pin icons) to Mapbox pin overlay syntax (colored dots)
- Zoom 18 centered on linked feature, 150m radius for nearby features
- URL overflow protection for large feature sets
- Fallback red dot for features without system_component_id

### Parking
- Selected aircraft render at 40% opacity (nose wheel marker visible)

### Obstructions
- Taxiway clearance moved to bottom of legend, hidden by default

### Other Fixes
- Dashboard check type labels use CHECK_TYPE_CONFIG (not raw DB values)
- Base switcher fixed for base_admin and namo roles
- Parking bulk add quantity clearable on mobile
- Taxilane wingspan auto-populated from design aircraft

### Cleanup
- Removed `lib/acsi-excel.ts` (orphaned, never imported)
- Removed `isSupabaseConfigured()` from `lib/utils.ts` (unused export)
- Removed `skipActivityLog` param from discrepancy CRUD

## Current State

| Metric | Value |
|--------|-------|
| Source files | 206 |
| Routes | 53 |
| Migrations | 124 |
| Database tables | 42 |
| Build status | Clean (0 errors) |
| Orphaned files | 0 |
| TODO/FIXME comments | 0 |

## Known Tech Debt

| Item | Priority |
|------|----------|
| No test suite | High |
| ~165 `as any` casts | Medium |
| 15 files > 500 lines | Low |
| Map init duplication (6 components) | Low |
| PDF boilerplate duplication (16 generators) | Low |
| Check draft real-time sync (duplicate risk) | Low |
| Storage RLS not row-scoped | Low |

## Files Modified This Session

### Core App Changes
- `app/globals.css` — light mode color variables
- `app/(app)/dashboard/page.tsx` — UI revamp, formatAction, color-coding
- `app/(app)/activity/page.tsx` — template labels, color-coding, uppercase
- `app/(app)/inspections/page.tsx` — DAFMAN toast consolidation, warnIfRealtimeDown
- `app/(app)/checks/page.tsx` — warnIfRealtimeDown
- `app/(app)/discrepancies/[id]/page.tsx` — camera capture, NAVAID map fallback
- `app/(app)/discrepancies/new/page.tsx` — multi-photo upload
- `app/(app)/discrepancies/page.tsx` — Pending W/O filter
- `app/(app)/acsi/page.tsx` — inline action buttons
- `app/(app)/acsi/[id]/page.tsx` — reopen button
- `app/(app)/acsi/new/page.tsx` — draft_data rebuild from items
- `components/discrepancies/modals.tsx` — work order + assigned to in edit modal
- `components/obstructions/airfield-map.tsx` — taxiway legend position
- `components/ui/template-picker.tsx` — pass category + label
- `components/realtime-alert-banner.tsx` — consolidated alerts

### Library Changes
- `lib/realtime-subscribe.ts` — silent tracking, warnIfRealtimeDown
- `lib/dashboard-context.tsx` — warnIfRealtimeDown on status changes
- `lib/supabase/activity.ts` — category + templateLabel params
- `lib/supabase/discrepancies.ts` — removed all logActivity calls
- `lib/supabase/acsi-inspections.ts` — reopenAcsiInspection with draft rebuild
- `lib/supabase/infrastructure-features.ts` — component-scoped query
- `lib/utils.ts` — pin overlay map, removed isSupabaseConfigured
- `lib/reports/daily-ops-pdf.ts` — uppercase details, entity labels, underscore fixes

### Deleted Files
- `lib/acsi-excel.ts` — orphaned, never imported

## Branching Notes

- `tweaks` branch has 39 commits ahead of `main`
- Revert point for dashboard UI: `git tag ui-pre-revamp-v2.27`
- All changes compile cleanly
- Ready to merge to `main` or continue development on a new branch

## Planned Next Steps

- Landing page for glidepathops.com (app.glidepathops.com subdomain)
- Part 139 civilian airport template support
- Training Management Module
- Platform One Party Bus onboarding
- Test suite foundation
