-- ============================================================
-- Seed KBCV — Chièvres Air Base, Belgium
-- Run in Supabase SQL Editor
-- To reset: DELETE FROM bases WHERE icao = 'EBCV';
-- ============================================================
-- Sources:
--   AIP Belgium AD 2 EBCV (19 MAR 2020)
--   SkyVector EBCV airport data
-- ============================================================

DO $$
DECLARE
  v_base_id UUID := gen_random_uuid();
BEGIN

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops, checklist_reset_time)
VALUES (
  v_base_id,
  'Chièvres Air Base',
  'EBCV',
  '424th Air Base Squadron',
  'United States Air Force',
  'Chièvres, Wallonia, Belgium',
  194,
  'Europe/Brussels',
  ARRAY['Pavements', 'Electrical', 'Structures', 'HVAC', 'Grounds'],
  '06:00'
);

RAISE NOTICE 'Created Chièvres Air Base (EBCV) with id: %', v_base_id;

-- ═══════════════════════════════════════════════════════════════
-- 2. Runway 08/26 (8196 x 148 ft, Hard surface)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl)
VALUES (
  v_base_id,
  '08/26',
  8196,
  148,
  'Asphalt/Concrete',
  'B',
  80.0,
  '08',
  50.5752,   -- N50°34.51'
  3.8216,    -- E003°49.28'
  80.0,
  NULL,      -- RWY 08: no approach lighting
  178,       -- THR ELEV 178 FT
  '26',
  50.5740,   -- N50°34.44'
  3.8589,    -- E003°51.54'
  260.0,
  'ALS NATO standard',
  148        -- THR ELEV 147.7 FT
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  (v_base_id, 'DVOR/DME CIV (113.200 MHz)', 1),
  (v_base_id, 'TACAN CIV (CH 79X)', 2),
  (v_base_id, 'ILS 26 (CAT I) LOC ICV (108.55 MHz)', 3),
  (v_base_id, 'ILS 26 GP (329.750 MHz)', 4),
  (v_base_id, 'PAPI 08 (3.00°)', 5),
  (v_base_id, 'PAPI 26 (3.00°)', 6),
  (v_base_id, 'VASIS 08', 7),
  (v_base_id, 'VASIS 26 (MEHT 49 FT)', 8);

-- ═══════════════════════════════════════════════════════════════
-- 4. Areas
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  (v_base_id, 'RWY 08/26', 1),
  (v_base_id, 'TWY A', 2),
  (v_base_id, 'Apron Spot 1 (ASPH/CONC, PCN 55)', 3),
  (v_base_id, 'Apron Spot 2 (ASPH, PCN 83)', 4),
  (v_base_id, 'Apron Spots 3 & 4 (ASPH, PCN 75)', 5),
  (v_base_id, 'Rotary Wing Apron', 6),
  (v_base_id, 'Overrun 08', 7),
  (v_base_id, 'Overrun 26', 8),
  (v_base_id, 'Airfield Perimeter', 9),
  (v_base_id, 'Bird Sanctuary (N of RWY centreline, 2.5 NM)', 10);

-- ═══════════════════════════════════════════════════════════════
-- 5. Taxiway A
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_taxiways (base_id, designator, taxiway_type, tdg)
VALUES (v_base_id, 'A', 'taxiway', NULL);

-- ═══════════════════════════════════════════════════════════════
-- 6. Lighting systems (table: lighting_systems)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO lighting_systems (base_id, system_type, name, runway_or_taxiway, notes) VALUES
  (v_base_id, 'threshold_lights',     'RWY 08 Threshold Lights',  '08/26', 'Colour: green, Wing bars'),
  (v_base_id, 'threshold_lights',     'RWY 26 Threshold Lights',  '08/26', 'Colour: green, Wing bars'),
  (v_base_id, 'runway_end_lights',    'RWY 08 End Lights',        '08/26', 'Colour: red, Wing bars'),
  (v_base_id, 'runway_end_lights',    'RWY 26 End Lights',        '08/26', 'Colour: red, Wing bars'),
  (v_base_id, 'runway_edge_lights',   'RWY Edge Lights',          '08/26', 'LIH/LIL, directional & omnidirectional, 30M spacing'),
  (v_base_id, 'approach_lighting',    'RWY 26 ALS NATO Standard', '08/26', 'ALS NATO standard, LIH'),
  (v_base_id, 'papi',                 'PAPI RWY 08',              '08/26', 'PAPI 3.00°'),
  (v_base_id, 'papi',                 'PAPI RWY 26',              '08/26', 'PAPI 3.00°'),
  (v_base_id, 'vasis',                'VASIS RWY 08',             '08/26', NULL),
  (v_base_id, 'vasis',                'VASIS RWY 26',             '08/26', 'MEHT 49 FT'),
  (v_base_id, 'touchdown_zone_lights','TDZ Lights RWY 08',        '08/26', NULL),
  (v_base_id, 'touchdown_zone_lights','TDZ Lights RWY 26',        '08/26', NULL),
  (v_base_id, 'stopway_lights',       'Stopway Lights RWY 08',    '08/26', NULL),
  (v_base_id, 'stopway_lights',       'Stopway Lights RWY 26',    '08/26', NULL),
  (v_base_id, 'taxiway_edge_lights',  'TWY Edge Lighting',        'TWY A', 'AVBL per AD 2.15'),
  (v_base_id, 'runway_guard_lights',  'Runway Guard Lights',      '08/26', 'INFO not AVBL per AD 2.9'),
  (v_base_id, 'distance_markers',     'Distance Markers',         '08/26', 'AVBL per AD 2.9'),
  (v_base_id, 'stop_bars',            'Stop Bars',                NULL,    'INFO not AVBL per AD 2.9');

-- ═══════════════════════════════════════════════════════════════
-- 7. ARFF — CAT 7
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_arff_aircraft (base_id, aircraft_name, sort_order) VALUES
  (v_base_id, 'P-19 (1500 gal water / 5678 L)', 1),
  (v_base_id, 'P-23 (3300 gal water / 12491 L)', 2),
  (v_base_id, 'P-34 (400 gal water / 1514 L)', 3);

-- ═══════════════════════════════════════════════════════════════
-- 8. Facilities
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_facilities (base_id, facility_number, description, sort_order) VALUES
  (v_base_id, 'TWR', 'Chièvres Tower (ARFF Cat 7)', 1),
  (v_base_id, 'BLD-20002', 'Bâtiment / Building 20002 (424th ABS HQ)', 2),
  (v_base_id, 'ARO', 'ATS Reporting Office', 3),
  (v_base_id, 'MET', 'EBCV MET Office (associated)', 4);

-- ═══════════════════════════════════════════════════════════════
-- 9. Airfield status (initial)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id) VALUES (v_base_id);

-- ═══════════════════════════════════════════════════════════════
-- 10. NAVAID statuses (initial row per NAVAID)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO navaid_statuses (base_id, navaid_name, status)
SELECT v_base_id, navaid_name, 'operational'
FROM base_navaids WHERE base_id = v_base_id;

RAISE NOTICE 'KBCV Chièvres Air Base seeded successfully!';

END $$;
