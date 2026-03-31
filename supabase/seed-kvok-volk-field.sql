-- ============================================================
-- Seed KVOK — Volk Field Airport, Camp Douglas, Wisconsin
-- Run in Supabase SQL Editor
-- Assumes the base already exists (created via app UI).
-- Finds it by ICAO code 'KVOK' and populates child data.
-- Safe to re-run: deletes existing child data first, then re-inserts.
-- ============================================================

DO $$
DECLARE
  v_base_id UUID;
BEGIN

-- ── Find existing base ──
SELECT id INTO v_base_id FROM bases WHERE icao = 'KVOK';
IF v_base_id IS NULL THEN
  RAISE EXCEPTION 'Base with ICAO KVOK not found. Create it in Base Setup first.';
END IF;

RAISE NOTICE 'Found KVOK base with id: %', v_base_id;

-- ── Delete existing child data (order matters for FK constraints) ──
DELETE FROM navaid_statuses WHERE base_id = v_base_id;
DELETE FROM airfield_status WHERE base_id = v_base_id;
DELETE FROM base_navaids WHERE base_id = v_base_id;
DELETE FROM base_areas WHERE base_id = v_base_id;
DELETE FROM base_taxiways WHERE base_id = v_base_id;
DELETE FROM base_arff_aircraft WHERE base_id = v_base_id;
DELETE FROM base_facilities WHERE base_id = v_base_id;
DELETE FROM base_runways WHERE base_id = v_base_id;

RAISE NOTICE 'Cleared existing KVOK child data';

-- ── Runway 09/27 ──
-- 9,000 x 150 ft, concrete-asphalt/grooved, PCN 44 R/A/W/T
-- First/last 1,600 ft grooved concrete, middle 5,800 ft grooved asphalt
-- BAK-12B(B) arresting gear, high intensity edge lighting
-- Both ends right traffic
INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl)
VALUES (
  v_base_id, '09/27', 9000, 150, 'Concrete-Asphalt/Grooved', 'B', 89.0,
  '09', 43.939000, -90.270167, 89.0, 'MALSR 1,400 ft medium intensity', 912,
  '27', 43.939500, -90.236000, 269.0, 'ALSF-1 2,400 ft high intensity w/ SFL', 904
) ;

-- ── NAVAIDs ──
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  (v_base_id, 'TACAN', 1),
  (v_base_id, 'ILS/LOC/DME RWY 27', 2),
  (v_base_id, 'PAPI RWY 09 (Left)', 3),
  (v_base_id, 'PAPI RWY 27 (Right)', 4),
  (v_base_id, 'MALSR RWY 09', 5),
  (v_base_id, 'ALSF-1 RWY 27', 6),
  (v_base_id, 'Touchdown Lights RWY 27', 7)
;

-- ── Areas ──
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  (v_base_id, 'RWY 09/27', 1),
  (v_base_id, 'TWY A', 2),
  (v_base_id, 'TWY B', 3),
  (v_base_id, 'Southeast Apron', 4),
  (v_base_id, 'East Ramp', 5),
  (v_base_id, 'West Ramp', 6),
  (v_base_id, 'Hangar Area', 7),
  (v_base_id, 'Airfield Perimeter', 8)
;

-- ── Taxiways ──
INSERT INTO base_taxiways (base_id, designator, taxiway_type) VALUES
  (v_base_id, 'A', 'taxiway'),
  (v_base_id, 'B', 'taxiway')
;

-- ── NAVAID statuses (default all green) ──
INSERT INTO navaid_statuses (base_id, navaid_name, status)
SELECT v_base_id, navaid_name, 'green'
FROM base_navaids WHERE base_id = v_base_id
;

-- ── Airfield status (default open) ──
INSERT INTO airfield_status (base_id, runway_status) VALUES (v_base_id, 'open')
;

RAISE NOTICE 'KVOK seed data applied to existing base %', v_base_id;

END $$;
