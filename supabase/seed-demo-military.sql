-- ============================================================
-- Clone Selfridge → fictional military demo airfield (USAF mode)
--
-- Marketing-capture twin of seed-demo-civilian.sql: spins up a
-- fictional USAF airfield whose name is safe to show in marketing
-- screenshots (spec rule: never a real installation name). Reuses
-- Selfridge's runway / taxiway / NAVAID layout (it's just geometry)
-- and keeps airport_type='usaf' so every code path renders military
-- terminology.
--
-- Rename the tenant by editing demo_name / demo_icao / demo_unit
-- below before running.
--
-- Run in Supabase SQL Editor (one-time operation).
-- To reset: DELETE FROM bases WHERE name = 'Blue Mesa AFB';
-- ============================================================

DO $$
DECLARE
  src_base_id UUID := '00000000-0000-0000-0000-000000000001'; -- Selfridge
  new_base_id UUID := gen_random_uuid();
  demo_name   TEXT := 'Blue Mesa AFB';   -- ← fictional; edit to taste
  demo_icao   TEXT := 'KBMA';            -- ← fictional ICAO
  demo_unit   TEXT := 'Airfield Management Flight';  -- generic, non-real unit
  demo_user_id UUID;
  src_base RECORD;
BEGIN

  -- ── 0. Find demo user ──
  SELECT id INTO demo_user_id FROM profiles WHERE email = 'demo@glidepathops.com';
  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Create demo@glidepathops.com first.';
  END IF;

  -- ── 1. Create the fictional military base ──
  SELECT * INTO src_base FROM bases WHERE id = src_base_id;
  INSERT INTO bases (
    id, name, icao, unit, majcom, location, elevation_msl, timezone,
    ce_shops, checklist_reset_time, discrepancy_type_shop_map,
    airport_type, part139_class, faa_site_number, aoc_number,
    obstruction_surface_set
  ) VALUES (
    new_base_id,
    demo_name,
    demo_icao,
    demo_unit,
    NULL,                        -- no MAJCOM: avoids implying a real command
    'Demo Military Installation',
    src_base.elevation_msl,
    src_base.timezone,
    src_base.ce_shops,           -- CES shop names carry over for USAF mode
    src_base.checklist_reset_time,
    src_base.discrepancy_type_shop_map,
    'usaf',
    NULL,                        -- no Part 139 class in military mode
    NULL,
    NULL,
    'ufc_3_260_01'
  );

  RAISE NOTICE 'Created % (%) with id: %', demo_name, demo_icao, new_base_id;

  -- ── 2-7. Clone airfield geometry from Selfridge ──────────
  -- Runways, NAVAIDs, areas, ARFF, taxiways, facilities: pure
  -- geometry / reference data (same clone set as the civilian seed).

  INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class,
    end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
    end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl,
    true_heading)
  SELECT new_base_id, runway_id, length_ft, width_ft, surface, runway_class,
    end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
    end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl,
    true_heading
  FROM base_runways WHERE base_id = src_base_id;

  INSERT INTO base_navaids (base_id, navaid_name, sort_order)
  SELECT new_base_id, navaid_name, sort_order
  FROM base_navaids WHERE base_id = src_base_id;

  INSERT INTO base_areas (base_id, area_name, sort_order)
  SELECT new_base_id, area_name, sort_order
  FROM base_areas WHERE base_id = src_base_id;

  INSERT INTO base_arff_aircraft (base_id, aircraft_name, sort_order)
  SELECT new_base_id, aircraft_name, sort_order
  FROM base_arff_aircraft WHERE base_id = src_base_id;

  INSERT INTO base_taxiways (base_id, designator, taxiway_type, tdg, centerline_coords,
    standard, runway_class, service_branch)
  SELECT new_base_id, designator, taxiway_type, tdg, centerline_coords,
    standard, runway_class, service_branch
  FROM base_taxiways WHERE base_id = src_base_id;

  INSERT INTO base_facilities (base_id, facility_number, description, sort_order)
  SELECT new_base_id, facility_number, description, sort_order
  FROM base_facilities WHERE base_id = src_base_id;

  -- ── 8. Daily review slots ──────────────────────────────
  -- Migration 2026052506 backfilled USAF bases that existed at
  -- migration time; a base created afterwards needs the legacy
  -- 5-slot AMSL/NAMO/AFM shape seeded explicitly.
  INSERT INTO daily_review_slots (base_id, slot_key, label, sort_order, required, permission_key)
  VALUES
    (new_base_id, 'day_amsl',   'Day AMSL',   1, true, 'daily_reviews:sign:amsl'),
    (new_base_id, 'swing_amsl', 'Swing AMSL', 2, true, 'daily_reviews:sign:amsl'),
    (new_base_id, 'mid_amsl',   'Mid AMSL',   3, true, 'daily_reviews:sign:amsl'),
    (new_base_id, 'namo',       'NAMO',       4, true, 'daily_reviews:sign:namo'),
    (new_base_id, 'afm',        'AFM',        5, true, 'daily_reviews:sign:afm')
  ON CONFLICT (base_id, slot_key) DO NOTHING;

  -- ── 9. Grant demo user broad access ────────────────────
  INSERT INTO base_members (base_id, user_id, role)
  VALUES (new_base_id, demo_user_id, 'airfield_manager')
  ON CONFLICT (base_id, user_id) DO UPDATE SET role = 'airfield_manager';

END $$;
