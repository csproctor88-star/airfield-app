-- ============================================================
-- Seed KBCV — Chièvres Air Base, Belgium
-- Run in Supabase SQL Editor
-- Assumes the base already exists (created via app UI).
-- Finds it by ICAO code 'EBCV' and populates child data.
-- To re-run: delete child rows first, then run again.
-- ============================================================

DO $$
DECLARE
  v_base_id UUID;
BEGIN

-- ── Find existing base ──
SELECT id INTO v_base_id FROM bases WHERE icao = 'EBCV';
IF v_base_id IS NULL THEN
  RAISE EXCEPTION 'Base with ICAO EBCV not found. Create it in Base Setup first.';
END IF;

RAISE NOTICE 'Found EBCV base with id: %', v_base_id;

-- ── Runway 08/26 ──
INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl)
VALUES (
  v_base_id, '08/26', 8196, 148, 'Asphalt/Concrete', 'B', 80.0,
  '08', 50.5752, 3.8216, 80.0, NULL, 178,
  '26', 50.5740, 3.8589, 260.0, 'ALS NATO standard', 148
) ON CONFLICT (base_id, runway_id) DO NOTHING;

-- ── NAVAIDs ──
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  (v_base_id, 'DVOR/DME CIV', 1),
  (v_base_id, 'TACAN CIV', 2),
  (v_base_id, '26 Localizer', 3),
  (v_base_id, '26 Glideslope', 4),
  (v_base_id, '26 ILS', 5),
  (v_base_id, 'PAPI 08', 6),
  (v_base_id, 'PAPI 26', 7)
ON CONFLICT (base_id, navaid_name) DO NOTHING;

-- ── Areas ──
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  (v_base_id, 'RWY 08/26', 1),
  (v_base_id, 'TWY A', 2),
  (v_base_id, 'Apron Spot 1', 3),
  (v_base_id, 'Apron Spot 2', 4),
  (v_base_id, 'Apron Spots 3 & 4', 5),
  (v_base_id, 'Rotary Wing Apron', 6),
  (v_base_id, 'Airfield Perimeter', 7)
ON CONFLICT (base_id, area_name) DO NOTHING;

-- ── Taxiway ──
INSERT INTO base_taxiways (base_id, designator, taxiway_type) VALUES
  (v_base_id, 'A', 'taxiway')
ON CONFLICT DO NOTHING;

-- ── ARFF ──
INSERT INTO base_arff_aircraft (base_id, aircraft_name, sort_order) VALUES
  (v_base_id, 'P-19', 1),
  (v_base_id, 'P-23', 2),
  (v_base_id, 'P-34', 3)
ON CONFLICT DO NOTHING;

-- ── Facilities ──
INSERT INTO base_facilities (base_id, facility_number, description, sort_order) VALUES
  (v_base_id, 'TWR', 'Chièvres Tower', 1),
  (v_base_id, 'BLD-20002', 'Building 20002 (424th ABS HQ)', 2)
ON CONFLICT DO NOTHING;

-- ── NAVAID statuses ──
INSERT INTO navaid_statuses (base_id, navaid_name, status)
SELECT v_base_id, navaid_name, 'green'
FROM base_navaids WHERE base_id = v_base_id
ON CONFLICT DO NOTHING;

-- ── Airfield status ──
INSERT INTO airfield_status (base_id, runway_status) VALUES (v_base_id, 'open')
ON CONFLICT DO NOTHING;

RAISE NOTICE 'KBCV seed data applied to existing base %', v_base_id;

END $$;
