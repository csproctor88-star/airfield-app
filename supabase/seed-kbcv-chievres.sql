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
  194,  -- 194 FT AMSL (AIP AD 2.2 item 3)
  'Europe/Brussels',
  ARRAY['Pavements', 'Electrical', 'Structures', 'HVAC', 'Grounds'],
  '06:00'
);

RAISE NOTICE 'Created Chièvres Air Base (EBCV) with id: %', v_base_id;

-- ═══════════════════════════════════════════════════════════════
-- 2. Runway — 08/26 (8196 x 148 ft / 2498 x 45 m, Hard surface)
--    AIP AD 2.12 + SkyVector
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl)
VALUES (
  v_base_id,
  '08/26',
  8196,     -- length (ft)
  148,      -- width (ft)
  'Asphalt/Concrete',
  'B',
  80.0,     -- true heading RWY 08 (SkyVector: 080°)
  '08',
  50.5752,  -- N50°34.51' → 50.5752 (THR 08 from AD 2.12: 503429.42N)
  3.8216,   -- E003°49.28' → 3.8216 (003491E → ~3.8217)
  80.0,
  NULL,     -- RWY 08: Approach lighting type NIL per AD 2.14
  178,      -- THR ELEV 178 FT (AD 2.12)
  '26',
  50.5740,  -- N50°34.44' (503443.43N from AD 2.12)
  3.8589,   -- E003°51.54' (0035122.02E → ~3.8561)
  260.0,
  'ALS NATO standard',  -- RWY 26: ALS NATO standard (AD 2.14)
  148       -- THR ELEV 147.7 FT (AD 2.12)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs — from AD 2.19 Radio Navigation and Landing Aids
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  (v_base_id, 'DVOR/DME CIV (113.200 MHz)', 1),
  (v_base_id, 'TACAN CIV (CH 79X)', 2),
  (v_base_id, 'ILS 26 (CAT I) LOC ICV (108.55 MHz)', 3),
  (v_base_id, 'ILS 26 GP (329.750 MHz)', 4),
  (v_base_id, 'PAPI 08 (3.00°)', 5),
  (v_base_id, 'PAPI 26 (3.00°)', 6),
  (v_base_id, 'VASIS 08 (MEHT?)', 7),
  (v_base_id, 'VASIS 26 (MEHT? 49 FT)', 8);

-- ═══════════════════════════════════════════════════════════════
-- 4. Areas — runway, taxiways, aprons, other
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
-- 5. Taxiways — from AD 2.8
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_taxiways (base_id, designator, taxiway_type, tdg)
VALUES
  (v_base_id, 'A', 'full_parallel', NULL);

-- ═══════════════════════════════════════════════════════════════
-- 6. Lighting systems — from AD 2.14 + AD 2.15 + AD 2.9
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_lighting_systems (base_id, system_name, system_type, runway_id, description) VALUES
  (v_base_id, 'RWY 08 Threshold Lights', 'threshold_lights', '08/26', 'Colour: green, Wing bars'),
  (v_base_id, 'RWY 26 Threshold Lights', 'threshold_lights', '08/26', 'Colour: green, Wing bars'),
  (v_base_id, 'RWY 08 End Lights', 'runway_end_lights', '08/26', 'Colour: red, Wing bars'),
  (v_base_id, 'RWY 26 End Lights', 'runway_end_lights', '08/26', 'Colour: red, Wing bars'),
  (v_base_id, 'RWY Edge Lights', 'runway_edge_lights', '08/26', 'LIH / LIL, directional & omnidirectional, Spacing 30 M'),
  (v_base_id, 'RWY 26 ALS NATO Standard', 'approach_lighting', '08/26', 'ALS NATO standard, LIH'),
  (v_base_id, 'RWY 08 Approach Lighting', 'approach_lighting', '08/26', 'Type: NIL (no approach lighting system)'),
  (v_base_id, 'PAPI RWY 08', 'papi', '08/26', 'PAPI 3.00°'),
  (v_base_id, 'PAPI RWY 26', 'papi', '08/26', 'PAPI 3.00°'),
  (v_base_id, 'VASIS RWY 08', 'vasis', '08/26', 'MEHT?'),
  (v_base_id, 'VASIS RWY 26', 'vasis', '08/26', 'MEHT? 49 FT'),
  (v_base_id, 'Touchdown Zone Lights 08', 'touchdown_zone_lights', '08/26', 'Per AD 2.14'),
  (v_base_id, 'Touchdown Zone Lights 26', 'touchdown_zone_lights', '08/26', 'Per AD 2.14'),
  (v_base_id, 'Stopway Lights 08', 'stopway_lights', '08/26', 'Per AD 2.14'),
  (v_base_id, 'Stopway Lights 26', 'stopway_lights', '08/26', 'Per AD 2.14'),
  (v_base_id, 'TWY Edge Lighting', 'taxiway_edge_lights', NULL, 'AVBL per AD 2.15'),
  (v_base_id, 'Runway Guard Lights', 'runway_guard_lights', '08/26', 'INFO not AVBL per AD 2.9'),
  (v_base_id, 'Distance Markers', 'distance_markers', '08/26', 'AVBL per AD 2.9'),
  (v_base_id, 'Stop Bars', 'stop_bars', NULL, 'INFO not AVBL per AD 2.9');

-- ═══════════════════════════════════════════════════════════════
-- 7. ARFF — from AD 2.6 (CAT 7)
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
-- 9. Obstructions — from AD 2.10
-- ═══════════════════════════════════════════════════════════════
INSERT INTO obstructions (base_id, title, description, evaluation_type, latitude, longitude, status)
VALUES
  (v_base_id, 'Church BRUGELETTE',      'Elev 349 ft AMSL, 2560m from ARP, Bearing 024°. Marking NO, Lighting YES.', 'permanent', 50.600, 3.850, 'open'),
  (v_base_id, 'Water Tower',             'Elev 274 ft AMSL, 1240m from ARP, Bearing 061°. Marking NO, Lighting YES.', 'permanent', 50.580, 3.830, 'open'),
  (v_base_id, 'Abbey CAMBRON-CASTEAU',   'Elev 291 ft AMSL, 3560m from ARP, Bearing 072°. Marking NO, Lighting YES.', 'permanent', 50.590, 3.870, 'open'),
  (v_base_id, 'Boat Elevator RONQUIÈRES','Elev 852 ft AMSL, 27300m from ARP, Bearing 087°. Marking NO, Lighting YES.', 'permanent', 50.610, 4.100, 'open'),
  (v_base_id, 'Aerials',                 'Elev 443 ft AMSL, 6800m from ARP, Bearing 120°. Marking NO, Lighting YES.', 'permanent', 50.560, 3.870, 'open'),
  (v_base_id, 'Church BAUFFE',           'Elev 307 ft AMSL, 1300m from ARP, Bearing 134°. Marking NO, Lighting YES.', 'permanent', 50.565, 3.835, 'open'),
  (v_base_id, 'Church CHIÈVRES',         'Elev 387 ft AMSL, 2620m from ARP, Bearing 300°. Marking NO, Lighting YES.', 'permanent', 50.590, 3.800, 'open'),
  (v_base_id, 'Aerial (322°)',           'Elev 304 ft AMSL, 2200m from ARP, Bearing 322°. Marking NO, Lighting YES.', 'permanent', 50.595, 3.805, 'open'),
  (v_base_id, 'Aerial (329°)',           'Elev 343 ft AMSL, 2120m from ARP, Bearing 329°. Marking NO, Lighting YES.', 'permanent', 50.596, 3.808, 'open');

-- ═══════════════════════════════════════════════════════════════
-- 10. Airfield status (initial)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id) VALUES (v_base_id);

-- ═══════════════════════════════════════════════════════════════
-- 11. NAVAID statuses (initial row per NAVAID)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO navaid_statuses (base_id, navaid_name, status)
SELECT v_base_id, navaid_name, 'operational'
FROM base_navaids WHERE base_id = v_base_id;

RAISE NOTICE 'KBCV Chièvres Air Base seeded successfully!';

END $$;
