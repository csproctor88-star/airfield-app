# Session Handoff — v2.25.0

**Date:** 2026-03-19
**Branch:** `main`
**Commits:** 30 (daa3094 → v2.25.0 docs commit)
**Build:** Clean (`npm run build` passes with zero errors)

---

## What Was Done

### 1. Configurable Discrepancy PDF Export System
- **New file: `lib/pdf-config.ts`** — shared PDF configuration with consolidated status labels, type abbreviation map (`abbreviateType()`), photo rendering helpers (`photoCellHeight()`, `drawPhotosInCell()`), column definitions, `buildDiscrepancyTable()` core builder, `sanitizePdfText()` Unicode sanitizer, and localStorage-backed template persistence
- **New file: `components/ui/pdf-template-selector.tsx`** — modal dialog (`PdfExportDialog`) with column toggles, named template save/load, triggered by PDF/Email buttons
- **Refactored:** `lib/reports/open-discrepancies-pdf.ts`, `lib/reports/aging-discrepancies-pdf.ts`, `app/(app)/discrepancies/page.tsx` — all use shared `buildDiscrepancyTable()`, removing ~160 lines of duplicated code
- **Photo compression:** all PDF thumbnails compressed to 400px/0.6q (down from raw resolution, 88MB→~5-10MB)
- **Unicode sanitization:** arrows (►, →), smart quotes, em dashes replaced with ASCII equivalents

### 2. Inspection One-Per-Day Enforcement
- Hard lock: one airfield + one lighting inspection per day per type
- 0600L daily reset using installation timezone
- Three states on KPI badges: not started / in progress (with inspector name) / completed
- Blocked dialogs (not toasts) with "View Report" button for completed, inspector name for in-progress
- Confirmation dialog before starting new inspection
- Cross-user draft isolation: draft sync skips other users' inspections
- Dashboard Quick Actions reflect same 3 states with same 0600L reset
- URL `?action=begin` auto-start guarded

### 3. Parking Module Enhancements
- Full editing context menu (right-click): Spot Name, Tail #, Callsign, Heading, Clearance, Status, Fly To, Duplicate, Remove
- Fixed context menu positioning (clientX/clientY instead of canvas-relative)
- Click-to-select aircraft on map (was drag-only)
- Right-click no longer starts drag (filtered to left-click only)
- Transparent drag mode (40% opacity to see nose gear + ground)
- PDF captures current map view (fullscreen = full-detail export)
- Obstacle-to-taxilane clearance checks per UFC 3-260-01
- Violation text updated for obstacle+aircraft violations

### 4. BASH Monthly Report Overhaul
- Live heatmap capture via off-screen Mapbox GL canvas (replaces static pin markers)
- Heatmap density color ramp legend (Low→High)
- Sighting details streamlined: removed scientific names, Airfield Zone, Coordinates; weather consolidated into compact row; all values title-cased
- Chronological order (oldest first)
- Fixed double Zulu "ZZ" timestamps
- BWC History source labels humanized

### 5. Analytics Accuracy
- Inspection avg time from `created_at → filed_at` (actual start-to-file)
- New `started_at` column on `airfield_checks` (migration `2026031900`)
- Check avg time from `started_at → completed_at`
- Check draft persists `startedAt` for cross-device resume

---

## New/Modified Files

### New Files
| File | Purpose |
|------|---------|
| `lib/pdf-config.ts` | Shared PDF configuration, table builder, template persistence |
| `components/ui/pdf-template-selector.tsx` | PDF export dialog with column picker + templates |
| `supabase/migrations/2026031900_add_started_at_to_checks.sql` | Add `started_at` to airfield_checks |

### Key Modified Files
| File | Changes |
|------|---------|
| `app/(app)/discrepancies/page.tsx` | Replaced ~220 lines inline PDF with shared builder + dialog |
| `app/(app)/reports/discrepancies/page.tsx` | Added PDF export dialog |
| `app/(app)/reports/aging/page.tsx` | Added PDF export dialog with photos/comments disabled |
| `lib/reports/open-discrepancies-pdf.ts` | Uses shared `buildDiscrepancyTable()` |
| `lib/reports/aging-discrepancies-pdf.ts` | Uses shared `buildDiscrepancyTable()` |
| `lib/reports/open-discrepancies-data.ts` | Photo compression tightened to 400px/0.6q |
| `app/(app)/inspections/page.tsx` | One-per-day enforcement, confirmation dialog, blocked dialogs, draft isolation |
| `app/(app)/dashboard/page.tsx` | 3-state inspection badges, 0600L reset, removed `?action=begin` bypass |
| `app/(app)/parking/page.tsx` | Full context menu, click-to-select, transparent drag, PDF current view, obstacle-taxilane checks |
| `lib/calculations/parking-clearance.ts` | `checkObstacleTaxilaneClearance()` + wired into batch checks |
| `lib/reports/wildlife-report-pdf.ts` | Heatmap capture, detail streamlining, chronological sort |
| `lib/supabase/wildlife.ts` | `fetchHeatmapData()` returns `display_id` |
| `lib/reports/analytics-data.ts` | Inspection/check avg time from DB timestamps |
| `app/(app)/checks/page.tsx` | Captures `startedAt`, passes to `createCheck()` |
| `lib/supabase/checks.ts` | `started_at` field + `createCheck()` accepts it |
| `lib/check-draft.ts` | `startedAt` field in CheckDraft |
| `lib/supabase/types.ts` | `started_at` added to airfield_checks Row type |

---

## Codebase Stats

| Metric | Value |
|--------|-------|
| Source files (.ts + .tsx) | ~199 |
| Total lines | ~94,000 |
| Migrations | 121 |
| `as any` casts | 169 across 41 files |
| Files > 500 lines | ~58 |
| PDF generators | 16 |
| Test files | 0 |
| Page routes | 53 |
| Build | Clean (zero errors) |

### Largest Files
1. `infrastructure/page.tsx` — 4,097 lines
2. `parking/page.tsx` — 3,846 lines
3. `base-setup/page.tsx` — 2,855 lines
4. `inspections/page.tsx` — 2,415 lines
5. `dashboard/page.tsx` — 1,760 lines

---

## Known Tech Debt

| Item | Details |
|------|---------|
| 169 `as any` casts | ~28 Mapbox, ~70 Supabase inserts, ~11 jsPDF, ~60 misc |
| No test suite | 0 test files |
| 58 files > 500 lines | Largest: infrastructure at 4,097 |
| Map init duplication | 6 Mapbox components with similar setup |
| PDF boilerplate | 16 generators with shared patterns not yet extracted |
| Orphaned file | `lib/acsi-excel.ts` (151 lines, unused) |
| Check draft real-time sync | Two users could create duplicate drafts (deferred) |

---

## Pending Migration

**Must run before using new features:**
```sql
-- 2026031900_add_started_at_to_checks.sql
ALTER TABLE airfield_checks ADD COLUMN IF NOT EXISTS started_at timestamptz;
```

---

## Recommended Next Steps

1. **Training Management Module** (v2.25–v2.26 target) — DAF training records, 20 Excel sheets → 7+ tables, automated compliance checks, TRB reports
2. **Outage analytics** — frequency/duration tracking for lighting systems
3. **Test suite** — critical path coverage for inspections, discrepancies, clearance calculations
4. **Supabase type regeneration** — would eliminate ~50% of `as any` casts
5. **PDF utility extraction** — shared header/footer/page-break helpers across 16 generators

---

## Version Sync Checklist

All 5 locations updated to **2.25.0**:
- [x] `package.json`
- [x] `app/login/page.tsx` (footer)
- [x] `app/(app)/settings/page.tsx` (About section)
- [x] `CHANGELOG.md`
- [x] `README.md`
