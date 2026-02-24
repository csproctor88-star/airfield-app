# Multi-Base Scaling Assessment

**Date:** 2026-02-24
**Purpose:** Comprehensive audit of what needs to change to support multiple installations/bases

---

## Current Multi-Base Readiness

### Already Database-Driven (Works for Any Base)

- **Base metadata** (name, ICAO, elevation, timezone, CE shops) — `bases` table
- **Runway geometry** (coordinates, heading, dimensions, lighting) — `base_runways` table
- **NAVAID definitions** — `base_navaids` table with per-base scoping
- **Airfield areas** — `base_areas` table
- **All operational data** (inspections, discrepancies, NAVAID statuses, obstruction evaluations) — scoped by `base_id`
- **Obstruction evaluation engine** — UFC 3-260-01 surfaces fully implemented; uses runway geometry + elevation as inputs
- **Base directory** — 200+ military bases available for selection
- **Installation context** — supports switching between bases

---

## Hardcoded to Selfridge

| Item | Where | Severity |
|------|-------|----------|
| **Inspection templates** (74 items across 14 sections) | `lib/constants.ts` | Critical — references RWY 01/19, TWY A/B/E/G/J/K/L, "South Hammerhead Edge Lights", "Stadium Lights" |
| **PDF export headers** (5 files) | `lib/reports/*.ts`, `lib/pdf-export.ts` | Critical — hardcodes "Selfridge ANGB (KMTC) — 127TH WING" |
| **PDF filenames** | `lib/reports/*.ts` | High — all use "KMTC_" prefix |
| **INSTALLATION constant** | `lib/constants.ts` | Critical — entire Selfridge config object used as fallback |
| **Fallback coordinates** | `lib/weather.ts` | High — hardcodes 42.6108, -82.8371 |
| **App metadata** | `app/layout.tsx`, `manifest.json` | High — says "127th Wing" / "Selfridge ANGB" |
| **Default NAVAID fallback** | `app/(app)/page.tsx` | Medium — 6 Selfridge-specific NAVAIDs |
| **Selfridge UUID fallback** | `lib/installation-context.tsx` | High — hardcoded fallback ID |
| **Runway class** | `obstructions.ts`, `obstructions/page.tsx` | Critical — hardcoded to Class B only |
| **All surface dimensions** | `obstructions.ts` IMAGINARY_SURFACES | Critical — all 10 surfaces use Class B criteria, no A/C/D |
| **Consolidation migration** | `20260224_consolidate_selfridge_base.sql` | Critical — forces single-base operation |
| **Weather/NOTAM API stubs** | `app/api/weather/route.ts`, `app/api/notams/sync/route.ts` | Low — stubs reference KMTC |

---

## Obstruction Evaluation Engine — Deep Dive

### How It Works

**Core file:** `lib/calculations/obstructions.ts` (606 lines)

**Core function:** `evaluateObstruction(point, obstructionHeightAGL, groundElevationMSL, rwy, airfieldElevMSL)`

The engine:
1. Takes a geographic point (lat/lon), obstruction height AGL, ground elevation MSL, runway geometry, and airfield elevation
2. Projects the point into runway-relative coordinates using local tangent-plane projection
3. Evaluates against 10 imaginary surfaces
4. Returns comprehensive analysis with violations, penetration depths, and waiver guidance

### UFC 3-260-01 Surfaces Implemented

**Height-Restriction Surfaces (6):**

| # | Surface | Key Parameters (Class B) | UFC Reference |
|---|---------|-------------------------|---------------|
| 1 | Primary Surface | 1,000 ft half-width, 200 ft extension, 0 ft max height | Table 3-7, Item 1 |
| 2 | Approach-Departure Clearance | 50:1 slope, 1,000→2,550 ft half-width, 25,000 ft length | Table 3-7, Item 2 |
| 3 | Transitional Surface | 7:1 slope, extends from primary/approach edges, 150 ft max | Table 3-7, Item 3 |
| 4 | Inner Horizontal | 150 ft AGL, 13,120 ft radius (stadium shape) | Table 3-7, Item 4 |
| 5 | Conical Surface | 20:1 slope, 7,000 ft extent, 150→500 ft height | Table 3-7, Item 5 |
| 6 | Outer Horizontal | 500 ft AGL, 42,250 ft radius (stadium shape) | Table 3-7, Item 6 |

**Land-Use Restriction Zones (2):**

| # | Surface | Key Parameters | Reference |
|---|---------|---------------|-----------|
| 7 | APZ I (Accident Potential Zone I) | 3,000–8,000 ft from threshold, 1,500 ft half-width | DoD Instruction 4165.57 |
| 8 | APZ II (Accident Potential Zone II) | 8,000–15,000 ft from threshold, 1,500 ft half-width | DoD Instruction 4165.57 |

**Clear Zone Surfaces (2):**

| # | Surface | Key Parameters | Reference |
|---|---------|---------------|-----------|
| 9 | Runway Clear Zone | 3,000 ft length, 1,500 ft half-width, 0 ft max height | Chapter 3, Appendix B §13 |
| 10 | Graded Portion of Clear Zone | 1,000 ft length, 1,500 ft half-width, 0 ft max height | Chapter 3, Appendix B §13 |

### Runway Class Issue

- **Database schema** supports `runway_class` column (constrained to A/B)
- **Code ignores it** — all evaluations use Class B dimensions
- **Obstruction page** hardcodes `runway_class: 'B'` on every save
- **Detail page** hardcodes "(Class B)" in display
- **No lookup table** for class-specific surface dimensions exists in code

### What Needs to Change for Multi-Class Support

1. **Extend DB constraint** to allow A/B/C/D
2. **Create surface criteria lookup** mapping each class to its UFC Table 3-7 dimensions
3. **Pass runway class** into `evaluateObstruction()` as a parameter
4. **Remove hardcoded Class B** from UI pages
5. **Read class from runway record** in the database

---

## NAVAID System — Deep Dive

### Architecture

- **`base_navaids` table** — per-base NAVAID definitions with `base_id` FK, `navaid_name`, `sort_order`
- **`navaid_statuses` table** — tracks green/yellow/red status per NAVAID, scoped by `base_id`
- **Seeded for Selfridge:** 6 NAVAIDs (01 Localizer, 01 Glideslope, 01 ILS, 19 Localizer, 19 Glideslope, 19 ILS)

### Multi-Base Status: Mostly Ready

- NAVAID definitions are per-base in the database
- Status tracking is per-base
- **One issue:** Fallback `DEFAULT_NAVAIDS` array in `app/(app)/page.tsx` hardcodes 6 Selfridge NAVAIDs

---

## Inspection System — Deep Dive

### Architecture

- Templates defined as **TypeScript constants** in `lib/constants.ts` (NOT in database)
- Two template types: Airfield (9 sections, 42 items) and Lighting (5 sections, 32 items)
- Inspections stored in `inspections` table with `items` as JSONB, scoped by `base_id`

### Selfridge-Specific Items (Examples)

**Airfield Inspection:**
- "Runway/Overruns 01/19" (Section 5)
- "Grass Height (7–14\")" (Section 4 — Selfridge-specific range)

**Lighting Inspection:**
- "01/19 Edge Lights" (Section 1)
- "01 Approach Lighting (SALS)" (Section 1 — Selfridge-specific SALS system)
- "01 Threshold Bar / 19 Runway End Lights" (Section 1)
- "01 PAPI", "19 PAPI", "19 REILs" (Sections 1-2)
- "South Hammerhead Edge Lights" (Section 1)
- All 13 taxiway/ramp items: TWY A, K, B, L, J, E, G, East Ramp, West Ramp, USCG Ramp, DHS Ramp, West/East Stadium Lights (Section 3)
- "01/19 DRMs (Distance Remaining Markers)" (Section 4)

### What Needs to Change

- Move templates to database (e.g., `base_inspection_templates`, `base_inspection_sections`, `base_inspection_items`)
- Seed Selfridge's current items as initial data
- UI fetches templates per base instead of importing constants
- Each base configures their own checklist items

---

## PDF Export System — Deep Dive

### Hardcoded References

| File | Hardcoded Text |
|------|---------------|
| `lib/pdf-export.ts` (line 44) | `'SELFRIDGE AIR NATIONAL GUARD BASE (KMTC) — 127TH WING'` |
| `lib/reports/daily-ops-pdf.ts` (line 100) | `'Selfridge ANGB (KMTC)'` |
| `lib/reports/open-discrepancies-pdf.ts` (line 70) | `'Selfridge ANGB (KMTC)'` |
| `lib/reports/aging-discrepancies-pdf.ts` (line 78) | `'Selfridge ANGB (KMTC)'` |
| `lib/reports/discrepancy-trends-pdf.ts` (line 58) | `'Selfridge ANGB (KMTC)'` |

### Hardcoded Filenames

- `KMTC_Daily_Ops_{date}.pdf`
- `KMTC_Open_Discrepancies_{date}.pdf`
- `KMTC_Aging_Discrepancies_{date}.pdf`
- `KMTC_Discrepancy_Trends_{date}.pdf`

### Fix

- Pass `currentInstallation.name` / `.icao` into PDF generation functions
- Use base ICAO code in filenames dynamically

---

## Other Hardcoded References

### Weather (`lib/weather.ts`)
```typescript
const SELFRIDGE_LAT = 42.6108
const SELFRIDGE_LON = -82.8371
```
Falls back to Selfridge coordinates when browser geolocation unavailable.
**Fix:** Use base coordinates from installation context.

### App Metadata (`app/layout.tsx`)
```typescript
title: 'Glidepath | 127th Wing',
description: 'Glidepath — Airfield Operations Suite — Selfridge ANGB (KMTC)',
```
**Fix:** Make dynamic or use generic "Glidepath — Airfield Operations Suite".

### Manifest (`public/manifest.json`)
```typescript
"description": "Glidepath — Airfield operations suite for 127th Wing",
```
**Fix:** Use generic description.

### Installation Context (`lib/installation-context.tsx`)
```typescript
const SELFRIDGE_INSTALLATION_ID = '00000000-0000-0000-0000-000000000001'
```
Used as last-resort fallback when no base is set.
**Fix:** Fall back to first available base, or require base selection.

### Consolidation Migration (`20260224_consolidate_selfridge_base.sql`)
Forces all users to Selfridge base and deletes other base memberships.
**Fix:** Remove or make migration conditional for initial deployment only.

---

## Clarifying Questions (Pending)

1. **Runway classes** — Need support for all four (A/B/C/D), or just A and B?
2. **Inspection templates** — Fully customizable per base, or template system?
3. **Base onboarding** — Admin UI, seed data from you, or both?
4. **Priority** — Quick wins first (hardcoded references), or all phases together?
