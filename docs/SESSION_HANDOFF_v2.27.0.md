# Session Handoff — v2.27.0

**Date:** 2026-03-22
**Branch:** `main`
**Commits:** 12 on `main`
**Build:** Clean

---

## What Was Done

### 1. Parking Page Layout Overhaul
- Replaced fixed 320px sidebar with floating overlay panel (top-right, 340px wide)
- Map now fills entire viewport width for better diagram creation UX
- Panel toggle available in all modes including fullscreen
- Floating toolbar appears when panel is closed
- Mobile bottom sheet unchanged

### 2. Demo Mode System
- **Demo login via URL**: `glidepathops.com/login?demo=true` auto-signs in (no button visible to users)
- **Demo AFB**: SQL seed script clones Selfridge config (runways, NAVAIDs, areas, CE shops, templates, QRC templates, lighting systems, infrastructure features, shift checklist items) into isolated Demo AFB
- Demo user assigned as `airfield_manager` with full feature access
- Demo base has 20 recent discrepancies seeded for non-empty lists

### 3. RLS Security Tightening
- 19 write policies updated to enforce `user_can_write()` (was only checking `user_has_base_access()`)
- Blocked `read_only`, `ces`, `safety`, `atc` from unauthorized writes across 19 tables
- CES exception: can UPDATE discrepancies for work order status changes
- `friendlyError()` utility maps raw Postgres errors to user-friendly messages across all 15 CRUD modules

### 4. Elevation API Migration
- Replaced Open-Elevation API (broken SSL cert) with Google Elevation API
- Server-side proxy at `/api/elevation` protects API key
- Obstruction evaluations now get reliable ground elevation data

### 5. Light Mode Fixes
- Visual NAVAIDs: ~46 hardcoded dark `rgba()` backgrounds → CSS variables
- Infrastructure audit panel: ~20 hardcoded borders/backgrounds → CSS variables
- GPS/location buttons: theme-aware styling matching discrepancy map pattern

### 6. Inspection Analytics Accuracy
- Added `started_at` column to `inspections` table
- Set when inspector begins walkdown (not when draft created)
- Analytics uses `started_at → filed_at` for accurate avg time; falls back to `created_at` for legacy

### 7. Documentation Suite
- **SRS v6.0 Leadership Edition** (`docs/Glidepath_SRS_v6.0_Leadership.md`)
- **SRS v6.0 Developer Edition** (`docs/Glidepath_SRS_v6.0_Developer.md`)
- **Capabilities Document v2.26** (`docs/Glidepath_Capabilities_v2.26.md`) — 24 sections, 78 screenshots
- **Slide Decks** — AFM (29 slides) and Leadership (17 slides) content documents
- DOCX versions generated locally via pandoc

---

## Files Modified (Key Changes)

| File | Changes |
|------|---------|
| `app/(app)/parking/page.tsx` | Floating panel layout, removed sidebar div |
| `app/login/page.tsx` | Demo auto-login via `?demo=true`, removed demo button |
| `app/api/elevation/route.ts` | New — Google Elevation API proxy |
| `app/(app)/infrastructure/page.tsx` | ~46 dark rgba → CSS variables, GPS button theme fix |
| `components/infrastructure/audit-panel.tsx` | ~20 dark rgba → CSS variables |
| `components/infrastructure/system-health-panel.tsx` | 1 border fix |
| `app/(app)/obstructions/page.tsx` | Toast text update |
| `lib/utils.ts` | Added `friendlyError()` |
| `lib/supabase/*.ts` (15 files) | Added `friendlyError()` import + usage |
| `lib/supabase/inspections.ts` | Set `started_at` on new inspection insert |
| `lib/reports/analytics-data.ts` | Use `started_at → filed_at` for avg time |
| `supabase/migrations/2026032100` | RLS tightening (19 policies) |
| `supabase/migrations/2026032101` | Add `started_at` to inspections |
| `supabase/seed-demo-base.sql` | Demo AFB cloning script |
| `.env.example` | Added `GOOGLE_ELEVATION_API_KEY` |

---

## Project Stats

| Metric | Value |
|--------|-------|
| Source files (.ts/.tsx) | 205 |
| Routes (page.tsx) | 53 |
| Migrations (.sql) | 123 |
| Total lines of code | 92,310 |
| `as any` casts | 168 |
| Files > 500 lines | 15 |

### Largest Files
1. `infrastructure/page.tsx` — 4,090 lines
2. `parking/page.tsx` — 3,842 lines
3. `base-setup/page.tsx` — 2,847 lines
4. `inspections/page.tsx` — 2,511 lines
5. `dashboard/page.tsx` — 1,744 lines

---

## Pending Migrations (Run in Supabase SQL Editor)

If not already applied:
1. `2026032100` — RLS write policy tightening
2. `2026032101` — `ALTER TABLE inspections ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;`

---

## Known Tech Debt

| Item | Details |
|------|---------|
| 168 `as any` casts | ~28 Mapbox, ~70 Supabase inserts, ~11 jsPDF, ~59 misc |
| No test suite | 0 test files |
| 15 files > 500 lines | Largest: infrastructure at 4,090 |
| Map init duplication | 6 Mapbox components with similar setup |
| PDF boilerplate | 16 generators with shared patterns not yet extracted |
| Orphaned: `lib/acsi-excel.ts` | ACSI Excel export — defined but never imported |
| Orphaned: `lib/calculations/surface-criteria.ts` | UFC surface criteria — defined but never imported |
| Unused export: `isSupabaseConfigured()` | In `lib/utils.ts` — defined but never called |
| Check draft real-time sync | Two users could create duplicate drafts (deferred) |
| Storage RLS not row-scoped | `photos` bucket relies on app-level checks, not path-based RLS |

---

## Environment Variables

Current production env vars required:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
GOOGLE_ELEVATION_API_KEY    ← NEW (server-side only)
```

---

## Recommended Next Steps

1. **Training Management Module** (v2.28 target) — DAF training records, 20 Excel sheets → 7+ tables
2. **Outage analytics** — frequency/duration tracking for lighting systems
3. **Test suite** — critical path coverage for inspections, discrepancies, clearance calculations
4. **Supabase type regeneration** — would eliminate ~50% of `as any` casts
5. **PDF utility extraction** — shared header/footer/page-break helpers across 16 generators
6. **Clean up orphans** — delete `lib/acsi-excel.ts`, `lib/calculations/surface-criteria.ts`, unused `isSupabaseConfigured()`

---

## Version Sync Checklist

All 5 locations updated to **2.27.0**:
- [x] `package.json`
- [x] `app/login/page.tsx` (footer)
- [x] `app/(app)/settings/page.tsx` (About section)
- [x] `CHANGELOG.md`
- [x] `README.md`
