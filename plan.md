# BASH/Wildlife Hazard Tracking Module — Implementation Plan

## Overview

Create a comprehensive Bird/Animal Strike Hazard (BASH) and Wildlife tracking module within Glidepath that enables airfield management to log wildlife sightings, document strikes, record dispersal/harassment actions, visualize concentrated activity areas via heatmap, and generate DAFI 91-212 compliant monthly reports.

This module **integrates with and extends** the existing BASH check type (`check_type='bash'`), BWC fields, wildlife discrepancy type, and Section 4 Habitat Management inspection items — becoming the central hub for all wildlife-related data already in the system.

---

## Research Context: Commercial Software & Regulatory Requirements

### Commercial Products Surveyed
- **ProDIGIQ SANTORINI** — Wildlife module with FAA Strike DB integration, mobile field logging, trend analytics
- **Veoci** — Species database management, GIS mapping, hazing/depredation tracking, permit expiration alerts
- **Aerosimple** — Offline-capable, exact GIS location, FAA Part 139 integration
- **Falcon Environmental WMS** — Hotspot mapping, SMS risk analysis, land-use modification modeling
- **DeTect MERLIN / Robin Radar MAX** — Hardware radar systems ($2-5M+), not applicable to software module

### DAFI 91-212 Key Requirements
- Installation BASH Plan (commander-endorsed)
- Bird Watch Conditions (LOW/MODERATE/SEVERE/PROHIBITED) continuously updated
- Bird Hazard Working Group meetings
- Wildlife Dispersal Team on duty during flight ops
- **Must maintain a depiction of local bird/wildlife hazards** on/around airfield (hazard illustration)
- Wildlife Hazard Assessment (year-long, stand-alone)
- Habitat management (grass 7-14", eliminate ponding, fencing)

### DAFMAN 13-204v2 Key Requirements
- Wildlife observations during routine airfield inspections
- BASH program support by Airfield Operations Flight
- Hazard illustration maintained IAW DAFI 91-212
- Training on Wildlife Hazard Management

### FAA Form 5200-7 Data Points (90+ variables)
- Species (common/scientific name, size category, count seen/struck)
- Location (airport ID, specific airfield location)
- Flight phase (taxi, takeoff, climb, approach, landing roll)
- Altitude AGL, speed (IAS)
- Time/conditions (date, time of day, precipitation, sky condition)
- Aircraft (registration, make/model, engine type)
- Damage (parts struck, extent)
- Engine ingestion details
- Flight effect (aborted takeoff, precautionary landing, engine shutdown)
- Cost (repair, other costs, hours out of service)
- Pilot warned of wildlife (yes/no)
- Remains collected/sent to Smithsonian

---

## Architecture Decisions

1. **New database tables** for wildlife sightings, strikes, and dispersals (not reusing `airfield_checks.data` JSONB — structured data is essential for analytics)
2. **Link to existing systems** — BWC from BASH checks feeds into the wildlife dashboard; wildlife discrepancies link to sightings/strikes; inspection habitat items cross-reference
3. **Mapbox heatmap layer** using `mapbox-gl` heatmap source type with sighting GPS data
4. **New route** at `/app/(app)/wildlife/` with sub-pages for log, map, analytics, and reports
5. **Species database** — curated list of common airfield hazard species with size categories, stored as a seed data file (expandable per-base)
6. **Monthly PDF report** following the existing jsPDF + autotable pattern

---

## Implementation Steps

### Phase 1: Database Schema (1 migration)

**Migration: `create_wildlife_tables`**

```sql
-- Wildlife sightings (observations during patrols, inspections, BASH checks)
CREATE TABLE wildlife_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  display_id TEXT NOT NULL,

  -- What was seen
  species_common TEXT NOT NULL,          -- e.g. "Canada Goose"
  species_scientific TEXT,               -- e.g. "Branta canadensis"
  species_group TEXT NOT NULL,           -- bird, mammal, reptile, bat
  size_category TEXT,                    -- small (<100g), medium (100g-1kg), large (>1kg)
  count_observed INTEGER NOT NULL DEFAULT 1,
  behavior TEXT,                         -- feeding, flying, roosting, nesting, transiting, loafing

  -- Where
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,                    -- e.g. "RWY 01 threshold", "TWY A midpoint"
  airfield_zone TEXT,                    -- predefined zone/sector for grid analysis

  -- When / conditions
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_of_day TEXT,                      -- dawn, day, dusk, night
  sky_condition TEXT,                    -- clear, some_cloud, overcast
  precipitation TEXT,                    -- none, fog, rain, snow

  -- Action taken
  action_taken TEXT,                     -- none, hazed, dispersed, depredated, relocated
  dispersal_method TEXT,                 -- pyrotechnics, vehicle, shotgun, laser, bioacoustics, other
  dispersal_effective BOOLEAN,

  -- Who
  observed_by TEXT NOT NULL,
  observed_by_id UUID,

  -- Links
  check_id UUID REFERENCES airfield_checks(id),      -- link to BASH check
  inspection_id UUID REFERENCES inspections(id),      -- link to inspection
  discrepancy_id UUID REFERENCES discrepancies(id),   -- link to wildlife discrepancy

  -- Photos
  photo_count INTEGER DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wildlife strikes (bird/animal strikes to aircraft)
CREATE TABLE wildlife_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  display_id TEXT NOT NULL,

  -- Species
  species_common TEXT,
  species_scientific TEXT,
  species_group TEXT,                    -- bird, mammal, reptile, bat
  size_category TEXT,
  number_struck INTEGER DEFAULT 1,
  number_seen INTEGER,

  -- Location & conditions
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,
  strike_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_of_day TEXT,
  sky_condition TEXT,
  precipitation TEXT,

  -- Aircraft info
  aircraft_type TEXT,                    -- from aircraft database
  aircraft_registration TEXT,
  engine_type TEXT,                      -- piston, turboprop, turbofan, turbojet

  -- Strike details
  phase_of_flight TEXT,                  -- taxi, takeoff_run, climb, approach, landing_roll, en_route
  altitude_agl INTEGER,                 -- feet AGL
  speed_ias INTEGER,                    -- knots IAS
  pilot_warned BOOLEAN,

  -- Damage assessment
  parts_struck TEXT[],                   -- radome, windshield, nose, engine_1, engine_2, wing, fuselage, landing_gear, tail, other
  parts_damaged TEXT[],
  damage_level TEXT,                     -- none, minor, substantial, destroyed
  engine_ingested BOOLEAN,
  engines_ingested INTEGER[],           -- engine numbers (L-to-R crew view)

  -- Flight effect
  flight_effect TEXT,                    -- none, aborted_takeoff, precautionary_landing, engine_shutdown, other

  -- Cost
  repair_cost DECIMAL,
  other_cost DECIMAL,
  hours_out_of_service INTEGER,

  -- Remains
  remains_collected BOOLEAN DEFAULT false,
  remains_sent_to_lab BOOLEAN DEFAULT false,
  lab_identification TEXT,               -- Smithsonian/other lab result

  -- Who reported
  reported_by TEXT NOT NULL,
  reported_by_id UUID,

  -- Links
  discrepancy_id UUID REFERENCES discrepancies(id),
  sighting_id UUID REFERENCES wildlife_sightings(id),

  photo_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- BWC history log (track every BWC change for trend analysis)
CREATE TABLE bwc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  bwc_value TEXT NOT NULL,               -- LOW, MOD, SEV, PROHIB
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  set_by TEXT,
  source TEXT,                           -- bash_check, manual, inspection
  source_id UUID,                        -- ID of the check/inspection that triggered it
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for all three tables (base_id scoping)
-- Indexes on base_id, observed_at/strike_date, species_common, lat/lng
```

### Phase 2: Species Reference Data

**New file: `lib/wildlife-species-data.ts`**

Curated list of ~80 common airfield hazard species (top FAA strike species + common CONUS military base species):
- Canada Goose, Snow Goose, Turkey Vulture, Black Vulture, Red-tailed Hawk, American Kestrel, Barn Owl, Great Horned Owl, Killdeer, European Starling, Mourning Dove, Rock Pigeon, Laughing Gull, Ring-billed Gull, Herring Gull, American Crow, White-tailed Deer, Coyote, Eastern Cottontail, etc.

Each entry includes: `common_name`, `scientific_name`, `group` (bird/mammal/reptile/bat), `size_category`, `mean_mass_g`, `strike_risk` (low/medium/high/critical)

This is seed data — users can add custom species per base.

### Phase 3: Supabase Query Functions

**New file: `lib/supabase/wildlife.ts`**

Functions following the existing pattern in `checks.ts` and `discrepancies.ts`:

- `createSighting(input)` — insert sighting, log activity, auto-link to check/inspection if provided
- `fetchSightings(baseId, filters?)` — list with date range, species, zone filters
- `fetchSighting(id)` — single sighting detail
- `createStrike(input)` — insert strike, log activity, auto-create wildlife discrepancy if damage
- `fetchStrikes(baseId, filters?)` — list with filters
- `fetchStrike(id)` — single strike detail
- `fetchBwcHistory(baseId, dateRange?)` — BWC change log
- `logBwcChange(baseId, value, source, sourceId)` — called from existing BASH check flow + new manual updates
- `fetchWildlifeAnalytics(baseId, dateRange)` — aggregated data for dashboard (counts by species, zone, month, trend)
- `fetchHeatmapData(baseId, dateRange?)` — lat/lng + weight for Mapbox heatmap layer

### Phase 4: Constants & Types

**Updates to `lib/constants.ts`:**
- `SPECIES_GROUPS`: `['bird', 'mammal', 'reptile', 'bat']`
- `SIZE_CATEGORIES`: `['small', 'medium', 'large']` with weight ranges
- `WILDLIFE_BEHAVIORS`: `['feeding', 'flying', 'roosting', 'nesting', 'transiting', 'loafing']`
- `DISPERSAL_METHODS`: `['pyrotechnics', 'vehicle_hazing', 'shotgun', 'laser', 'bioacoustics', 'propane_cannon', 'other']`
- `FLIGHT_PHASES`: `['taxi', 'takeoff_run', 'climb', 'en_route', 'approach', 'landing_roll']`
- `DAMAGE_LEVELS`: `['none', 'minor', 'substantial', 'destroyed']`
- `AIRCRAFT_PARTS`: `['radome', 'windshield', 'nose', 'engine_1', ...]`
- `FLIGHT_EFFECTS`: `['none', 'aborted_takeoff', 'precautionary_landing', 'engine_shutdown', 'other']`
- `SKY_CONDITIONS`, `PRECIPITATION_OPTIONS`, `TIME_OF_DAY_OPTIONS`

### Phase 5: Wildlife Page & Components

**New route: `/app/(app)/wildlife/page.tsx`**

Tab-based layout with 4 views:

#### Tab 1: Activity Log (default)
- Chronological feed of sightings, strikes, and dispersals
- Filter by: date range, species, type (sighting/strike/dispersal), zone
- Each entry shows: species icon, count, location, time, action taken
- Quick-add FAB button for new sighting (most common action)
- Links to related BASH checks, inspections, discrepancies

#### Tab 2: Heatmap
- Full-width Mapbox satellite map with heatmap layer
- Color gradient: green (low) → yellow → orange → red (high activity)
- Data source: all sighting GPS coordinates, weighted by count
- Date range filter (7d, 30d, 90d, 1yr, custom)
- Species filter dropdown
- Toggle between sightings-only, strikes-only, or combined
- Clickable points show sighting details in a popup
- This serves as the **DAFI 91-212 hazard depiction illustration**

#### Tab 3: Analytics Dashboard
- **KPI cards**: Total sightings (period), Total strikes, Current BWC, Top species, Strike rate (per 10K movements)
- **Trend chart**: Sightings & strikes per month (12-month rolling) — simple bar/line using CSS or lightweight chart
- **Species breakdown**: Top 10 species table with count, % of total, trend arrow
- **BWC history timeline**: Visual timeline of BWC changes over selected period
- **Dispersal effectiveness**: Actions taken vs. successful dispersals (%)
- **Seasonal pattern**: Monthly activity by species group (heat table)
- **Zone hotspots**: Top 5 airfield zones by activity count

#### Tab 4: Reports
- **Monthly BASH Summary PDF** — generate and export
- **Hazard Depiction Map** — static map image export (satellite + heatmap overlay)
- Date range selector for report period
- Email delivery via existing Resend integration

### Phase 6: New Sighting Form

**Component: `components/wildlife/sighting-form.tsx`**

Mobile-first form (primary use case: patrol vehicle tablet/phone):
- Species autocomplete (from species database, most-recent-first for quick re-entry)
- Count (number input, default 1)
- Behavior dropdown
- Location: GPS auto-capture + location text + zone picker
- Action taken (none/hazed/dispersed/depredated)
- If dispersal: method dropdown + effective yes/no
- Photo capture button
- Notes
- Auto-populated: observer name, date/time, weather (from Open-Meteo)
- Save as sighting → option to escalate to strike report

### Phase 7: Strike Report Form

**Component: `components/wildlife/strike-form.tsx`**

Structured form aligned with FAA Form 5200-7 fields:
- Species (pre-filled if linked from sighting)
- Aircraft info (type from aircraft database, registration, engine type)
- Flight phase, altitude, speed
- Parts struck/damaged (multi-select checklist)
- Damage level
- Engine ingestion details
- Flight effect
- Cost fields
- Remains collected/sent to lab
- Photos
- Auto-creates wildlife discrepancy if damage > none

### Phase 8: Integration Points

**8a. Existing BASH Check Integration**
- When a BASH check is completed (`check_type='bash'`), auto-create a `wildlife_sighting` record from the check data
- BWC changes from BASH checks are logged to `bwc_history`
- BASH check detail page gets a "View in Wildlife Module" link

**8b. Inspection Integration**
- Section 4 Habitat Management items (Bird/Animal Survey, BWC) link to wildlife sightings
- When an inspection notes wildlife during the bird survey item, offer quick-add sighting

**8c. Discrepancy Integration**
- Wildlife discrepancies (`type='wildlife'`) link to sightings/strikes
- Strike reports with damage auto-generate a wildlife discrepancy

**8d. Dashboard Integration**
- Dashboard shows current BWC prominently (already exists)
- Add wildlife activity summary card: "X sightings today, Y this month"
- BWC change alert via Supabase Realtime

### Phase 9: Monthly BASH Report PDF

**New file: `lib/reports/wildlife-report-pdf.ts`**

Following the `daily-ops-pdf.ts` pattern:

Report sections:
1. **Header** — Base name, ICAO, report period, generated by/date
2. **Executive Summary** — Total sightings, strikes, dispersals, current BWC, strike rate
3. **BWC History** — Table of all BWC changes during period
4. **Species Activity Table** — Top species by sighting count with strike count, % of activity
5. **Strike Summary** — Each strike: date, species, aircraft, damage, cost, flight effect
6. **Dispersal Effectiveness** — Methods used, success rates
7. **Hotspot Zones** — Top activity zones with counts
8. **Hazard Depiction Map** — Static satellite map image with heatmap overlay (using `fetchMapImageDataUrl`)
9. **Trends** — Month-over-month comparison, seasonal notes
10. **Recommendations** — Auto-generated based on data (e.g., "Canada Goose activity increased 40% — consider enhanced dispersal during dawn hours")

### Phase 10: Navigation & Sidebar

- Add "Wildlife / BASH" entry to sidebar nav (icon: 🦅, between existing items)
- Add to bottom nav for mobile
- Add to `/more/` page for tablet overflow

---

## File Summary

| Type | Files | Description |
|------|-------|-------------|
| Migration | 1 | `wildlife_sightings`, `wildlife_strikes`, `bwc_history` tables + RLS + indexes |
| Seed data | 1 | `lib/wildlife-species-data.ts` (~80 species) |
| Supabase queries | 1 | `lib/supabase/wildlife.ts` |
| Constants | 1 | Updates to `lib/constants.ts` |
| Page | 1 | `app/(app)/wildlife/page.tsx` (4-tab layout) |
| Components | ~5 | Sighting form, strike form, heatmap, analytics dashboard, report generator |
| Report PDF | 1 | `lib/reports/wildlife-report-pdf.ts` |
| Nav updates | 3 | Sidebar, bottom nav, more page |
| Integration | 2 | Updates to `checks.ts` (BWC history logging) and inspection linking |

**Estimated new/modified files: ~15**

---

## Implementation Order

1. Database migration (schema foundation)
2. Species seed data + constants
3. Supabase query functions
4. Wildlife page shell with Activity Log tab
5. Sighting form (most-used feature first)
6. Strike form
7. Integration with existing BASH checks + BWC history logging
8. Heatmap tab (Mapbox heatmap layer)
9. Analytics dashboard tab
10. Monthly report PDF + hazard depiction map export
11. Navigation updates (sidebar, bottom nav, more page)
