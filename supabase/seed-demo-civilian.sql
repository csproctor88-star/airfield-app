-- ============================================================
-- Clone Selfridge → Demo Regional Airport (FAA Part 139 mode)
--
-- Spins up a civilian Class III non-hub commercial airport for
-- testing the Phase 1+ FAA Part 139 changes. Reuses Selfridge's
-- runway / taxiway / NAVAID layout (it's just geometry) but sets
-- airport_type='faa_part139' and obstruction_surface_set='faa_part77'
-- so every mode-aware code path renders civilian terminology.
--
-- Run in Supabase SQL Editor (one-time operation).
-- To reset: DELETE FROM bases WHERE name = 'Demo Regional Airport';
-- ============================================================

DO $$
DECLARE
  src_base_id UUID := '00000000-0000-0000-0000-000000000001'; -- Selfridge
  new_base_id UUID := gen_random_uuid();
  demo_user_id UUID;
  src_base RECORD;
BEGIN

  -- ── 0. Find demo user ──
  SELECT id INTO demo_user_id FROM profiles WHERE email = 'demo@glidepathops.com';
  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Create demo@glidepathops.com first.';
  END IF;

  -- ── 1. Create Demo Regional Airport base in civilian mode ──
  SELECT * INTO src_base FROM bases WHERE id = src_base_id;
  INSERT INTO bases (
    id, name, icao, unit, majcom, location, elevation_msl, timezone,
    ce_shops, checklist_reset_time, discrepancy_type_shop_map,
    airport_type, part139_class, faa_site_number, aoc_number,
    obstruction_surface_set
  ) VALUES (
    new_base_id,
    'Demo Regional Airport',
    'KDRA',
    NULL,                        -- no military "unit" in civilian mode
    NULL,                        -- no MAJCOM
    'Demo Civilian Installation',
    src_base.elevation_msl,
    src_base.timezone,
    -- Civilian "shop" names. The discrepancy_type_shop_map below
    -- references these by name; if the source map points to CES names
    -- they'll silently miss and discrepancies fall back to manual
    -- assignment, which is acceptable for a demo seed.
    ARRAY['Operations', 'Airfield Maintenance', 'Electrical', 'Grounds', 'Wildlife', 'Snow Removal'],
    src_base.checklist_reset_time,
    src_base.discrepancy_type_shop_map,
    'faa_part139',               -- ← the flag everything keys off
    'III',                       -- Class III non-hub commercial
    '00000.*Z',                  -- placeholder FAA Site Number
    NULL,                        -- AOC number left for the actual airport operator
    'faa_part77'                 -- civilian obstruction surface set
  );

  RAISE NOTICE 'Created Demo Regional Airport (KDRA) with id: %', new_base_id;

  -- ── 2-9. Clone airfield geometry from Selfridge ──────────
  -- Runways, NAVAIDs, areas, ARFF, taxiways, facilities. These are
  -- pure geometry / reference data and translate fine to civilian.

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

  -- ── 10. Daily review slots ──────────────────────────────
  -- The migration 2026052506 only backfills USAF bases; civilian bases
  -- need their own slot config. Seed with the civilian shape that
  -- maps to the airport_mode TermKey lookups (Day Shift / Evening /
  -- Night / Supervisor / Manager).
  INSERT INTO daily_review_slots (base_id, slot_key, label, sort_order, required, permission_key)
  VALUES
    (new_base_id, 'day_shift',    'Day Shift',           1, true, 'daily_reviews:sign:supervisor'),
    (new_base_id, 'evening_shift','Evening Shift',       2, true, 'daily_reviews:sign:supervisor'),
    (new_base_id, 'night_shift',  'Night Shift',         3, true, 'daily_reviews:sign:supervisor'),
    (new_base_id, 'supervisor',   'Operations Supervisor', 4, true, 'daily_reviews:sign:supervisor'),
    (new_base_id, 'manager',      'Operations Manager',  5, true, 'daily_reviews:sign:manager');

  -- ── 11. Grant demo user broad access ────────────────────
  -- Mirrors the Demo AFB pattern: demo user gets airfield_manager
  -- to exercise the full UI. For a real civilian deployment the
  -- accountable_executive and sms_manager roles should be granted
  -- to real users via /users.
  INSERT INTO base_members (base_id, user_id, role)
  VALUES (new_base_id, demo_user_id, 'airfield_manager')
  ON CONFLICT (base_id, user_id) DO UPDATE SET role = 'airfield_manager';

END $$;
