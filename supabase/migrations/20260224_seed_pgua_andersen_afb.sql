-- Seed Andersen Air Force Base (PGUA) as the second base installation.
-- Data sourced from FAA AIP (Guam, effective Dec 2024–Jan 2025), FAA NFDC, and
-- publicly available DoD aviation references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current DoD FLIP AP/1B (Pacific)
-- before operational use, particularly ILS frequencies and taxiway inventory.

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
-- Temporarily nullify profile references so we can delete and re-insert.
-- The profiles.primary_base_id FK lacks ON DELETE CASCADE, so we must
-- detach profiles first, then reattach after the INSERT.
UPDATE profiles SET primary_base_id = NULL
WHERE primary_base_id IN (SELECT id FROM bases WHERE icao = 'PGUA');

DELETE FROM bases WHERE icao = 'PGUA';

INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Andersen Air Force Base',
  'PGUA',
  '36th Wing',
  'Pacific Air Forces (PACAF)',
  'Yigo, Guam',
  617,
  'Pacific/Guam',
  ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
);

-- Restore profile references for any users whose primary_base_id was nulled
UPDATE profiles SET primary_base_id = '00000000-0000-0000-0000-000000000002'
WHERE primary_base_id IS NULL
  AND id IN (
    SELECT user_id FROM base_members
    WHERE base_id = '00000000-0000-0000-0000-000000000002'
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Runways
--    Andersen has two parallel 065°/245° runway pairs.
--    True headings per FAA AIP; threshold coords from FAA AIP published data.
--    Magnetic variation: 2°E → magnetic heading ≈ true − 2°.
--    end1 = low-numbered (06) end; end2 = high-numbered (24) end.
-- ═══════════════════════════════════════════════════════════════

-- Runway 06L/24R — 10,528 ft × 200 ft, PCN 98 R/A/W/T
-- 06L: threshold elev 539.1 ft. BAK-12 arresting gear.
-- 24R: threshold elev 617.4 ft. ALSF-1 approach lighting (verify vs. current AIP).
--      Hazardous turbulence on final. 47 ft TACAN antenna 1,300 ft SE of threshold.
-- NOTE: Coordinates are for PGUA (Andersen AFB, ~13°35'N), NOT PGUM (Won Pat, ~13°28'N).
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '06L/24R', 10528, 200, 'Asphalt', 65,
  '06L', 13.580356, 144.915644, 63, 'MALSR',
  '24R', 13.592203, 144.942706, 243, 'ALSF-1'
)
ON CONFLICT (base_id, runway_id) DO NOTHING;

-- Runway 06R/24L — 11,200 ft × 200 ft, PCN 98 R/A/W/T
-- 06R: threshold elev 556.8 ft. BAK-12 arresting gear.
-- 24L: threshold elev 607.2 ft. ~1,004 ft displaced threshold (LDA 8,710 ft).
--      Hazardous turbulence on final. 47 ft TACAN antenna 1,300 ft NE of threshold.
--      Rising terrain 75 ft from threshold, 140 ft east of extended centerline, +8 ft.
--      First 500 ft of left shoulder not visible from tower.
--      Approach lighting for 24L not confirmed in public sources — admin should verify.
-- NOTE: Coordinates are for PGUA (Andersen AFB, ~13°35'N), NOT PGUM (Won Pat, ~13°28'N).
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '06R/24L', 11200, 200, 'Asphalt', 65,
  '06R', 13.575328, 144.916494, 63, 'MALSR',
  '24L', 13.587942, 144.945278, 243, NULL
)
ON CONFLICT (base_id, runway_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
--    ILS identifiers per FAA AIP. Frequencies not fully confirmed in public
--    sources — only RWY 06R (UAM, ~110.10 MHz) has a cited frequency.
--    TACAN identifier: UAM, Channel 54X (paired VOR frequency ~111.70 MHz).
--    All four runway ends have published ILS, TACAN Y/Z, and RNAV (GPS) approaches.
--    RWY 06L additionally has HI-ILS Y and HI-TACAN X procedures.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  -- RWY 06L — ILS identifier: GUM
  ('00000000-0000-0000-0000-000000000002', '06L Localizer',    1),
  ('00000000-0000-0000-0000-000000000002', '06L Glideslope',   2),
  ('00000000-0000-0000-0000-000000000002', '06L ILS',          3),
  -- RWY 06R — ILS identifier: UAM (~110.10 MHz, verify vs. FLIP)
  ('00000000-0000-0000-0000-000000000002', '06R Localizer',    4),
  ('00000000-0000-0000-0000-000000000002', '06R Glideslope',   5),
  ('00000000-0000-0000-0000-000000000002', '06R ILS',          6),
  -- RWY 24R — ILS identifier: YIG
  ('00000000-0000-0000-0000-000000000002', '24R Localizer',    7),
  ('00000000-0000-0000-0000-000000000002', '24R Glideslope',   8),
  ('00000000-0000-0000-0000-000000000002', '24R ILS',          9),
  -- RWY 24L — ILS identifier: PMY
  ('00000000-0000-0000-0000-000000000002', '24L Localizer',   10),
  ('00000000-0000-0000-0000-000000000002', '24L Glideslope',  11),
  ('00000000-0000-0000-0000-000000000002', '24L ILS',         12),
  -- TACAN — identifier: UAM, Channel 54X, located at 13.574553°N / 144.946578°E
  ('00000000-0000-0000-0000-000000000002', 'TACAN',           13)
ON CONFLICT (base_id, navaid_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways confirmed: A, B, C, E, F, G, J, K, L (per FAA NOTAMs, 36WGI refs).
--    TWY B and C between J and K closed for construction (active NOTAM as of 2024/25).
--    TWY F: designated arm/de-arm area per 36WGI91-102.
--    Additional taxiways (D, H, etc.) likely exist — admin should add from FLIP.
--    Ramps: North, South, Southwest Tactical, USCG, DHS, 734 AMS Cargo Terminal.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000002', 'Entire Airfield',           0),
  ('00000000-0000-0000-0000-000000000002', 'RWY 06L/24R',               1),
  ('00000000-0000-0000-0000-000000000002', 'RWY 06R/24L',               2),
  ('00000000-0000-0000-0000-000000000002', 'North Ramp',                3),
  ('00000000-0000-0000-0000-000000000002', 'South Ramp',                4),
  ('00000000-0000-0000-0000-000000000002', 'Southwest Tactical Ramp',   5),
  ('00000000-0000-0000-0000-000000000002', 'East Ramp',                 6),
  ('00000000-0000-0000-0000-000000000002', 'West Ramp',                 7),
  ('00000000-0000-0000-0000-000000000002', 'USCG Ramp',                 8),
  ('00000000-0000-0000-0000-000000000002', 'DHS Ramp',                  9),
  ('00000000-0000-0000-0000-000000000002', '734 AMS Cargo Terminal',   10),
  ('00000000-0000-0000-0000-000000000002', 'TWY A',                    11),
  ('00000000-0000-0000-0000-000000000002', 'TWY B',                    12),
  ('00000000-0000-0000-0000-000000000002', 'TWY C',                    13),
  ('00000000-0000-0000-0000-000000000002', 'TWY E',                    14),
  ('00000000-0000-0000-0000-000000000002', 'TWY F',                    15),
  ('00000000-0000-0000-0000-000000000002', 'TWY G',                    16),
  ('00000000-0000-0000-0000-000000000002', 'TWY J',                    17),
  ('00000000-0000-0000-0000-000000000002', 'TWY K',                    18),
  ('00000000-0000-0000-0000-000000000002', 'TWY L',                    19),
  ('00000000-0000-0000-0000-000000000002', 'Flight Line',              20)
ON CONFLICT (base_id, area_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- NOTE: airfield_status row intentionally omitted for Andersen.
-- The airfield_status table has a CHECK constraint restricting active_runway
-- to ('01', '19') — hardcoded for Selfridge. This constraint must be relaxed
-- (or converted to a free-text field) as part of multi-base Phase 4 refactoring
-- before Andersen can have an operational status row.
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- DATA GAPS — Items for base admin to verify against DoD FLIP AP/1B (Pacific):
--   1. ILS localizer frequencies for RWY 06L (GUM), 24R (YIG), 24L (PMY)
--   2. TACAN channel 54X confirmation (UAM TACAN frequency ~111.70 MHz paired)
--   3. Glideslope angles (3.00° assumed standard for all four ends)
--   4. Approach lighting for RWY 24L (not found in public AIP data)
--   5. RWY 24R approach lighting (ALSF-1 cited; conflicting AIP entries)
--   6. REIL status on any runway end
--   7. Touchdown zone lighting (TDZLs) — unlighted zones noted but TDZL
--      presence/absence not confirmed
--   8. Complete taxiway inventory — TWY D, H, and others not in public sources
--   9. Exact displaced threshold offset for RWY 24L
--      (LDA 8,710 ft vs. TORA 9,714 ft per declared distances)
--
-- DATA SOURCE: Runway dimensions and threshold coordinates are from FAA AIP and
-- FlightAware/iFlightPlanner data specifically for PGUA (Andersen AFB), verified
-- by latitude (~13°34-35'N = northern Guam). PGUM (Won Pat International) is
-- at ~13°28'N in southern Guam — do NOT confuse the two airports.
-- ═══════════════════════════════════════════════════════════════
