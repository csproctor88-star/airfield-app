-- ============================================================
-- Seed Demo Analytics Data for KDMO Demo AFB
-- Adds inspections, checks, discrepancies, personnel, wildlife
-- to populate the Reports & Analytics dashboard
-- Run in Supabase SQL Editor (safe to re-run)
-- ============================================================

DO $$
DECLARE
  demo_base UUID;
  demo_user UUID;
  d DATE;
  ct TEXT;
  check_types TEXT[] := ARRAY['fod','fod','fod','fod','rsc','rcr','bash','bash','heavy_aircraft','ife'];
BEGIN

  -- Find demo base and user
  SELECT id INTO demo_base FROM bases WHERE icao = 'KDMO' LIMIT 1;
  SELECT id INTO demo_user FROM profiles WHERE email = 'demo@glidepathops.com' LIMIT 1;
  IF demo_base IS NULL THEN RAISE EXCEPTION 'Demo base KDMO not found'; END IF;
  IF demo_user IS NULL THEN RAISE EXCEPTION 'Demo user not found'; END IF;

  -- Clean previous demo analytics data (safe re-run)
  DELETE FROM inspections WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM airfield_checks WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM discrepancies WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM airfield_contractors WHERE base_id = demo_base AND company_name IN ('Kiewit Infrastructure','AECOM','Hensel Phelps','Turner Construction','Skanska');
  DELETE FROM wildlife_sightings WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM wildlife_strikes WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM activity_log WHERE base_id = demo_base AND (metadata::text LIKE '%DEMO-LOG%' OR metadata::text LIKE '%AFLD3/CP COMPLETED%INSPECTION%');

  -- ══════════════════════════════════════════════════════
  -- INSPECTIONS — 12 airfield + 10 lighting over past 30 days
  -- ══════════════════════════════════════════════════════
  FOR i IN 1..12 LOOP
    d := CURRENT_DATE - (i * 2 + (i % 3));
    INSERT INTO inspections (
      base_id, display_id, inspection_type, status, inspector_id, inspection_date,
      created_at, started_at, filed_at,
      passed_count, failed_count, na_count, total_items, completion_percent
    ) VALUES (
      demo_base, 'DEMO-AFLD-' || LPAD(i::TEXT, 3, '0'), 'airfield', 'completed', demo_user, d,
      d + interval '6 hours',
      d + interval '6 hours',
      d + interval '6 hours' + (30 + (i * 7) % 45) * interval '1 minute',
      42 + (i % 5), (i % 3), 2, 48, 100
    );
  END LOOP;

  FOR i IN 1..10 LOOP
    d := CURRENT_DATE - (i * 3 + (i % 2));
    INSERT INTO inspections (
      base_id, display_id, inspection_type, status, inspector_id, inspection_date,
      created_at, started_at, filed_at,
      passed_count, failed_count, na_count, total_items, completion_percent
    ) VALUES (
      demo_base, 'DEMO-LTG-' || LPAD(i::TEXT, 3, '0'), 'lighting', 'completed', demo_user, d,
      d + interval '19 hours',
      d + interval '19 hours',
      d + interval '19 hours' + (20 + (i * 5) % 35) * interval '1 minute',
      36 + (i % 4), (i % 2), 1, 40, 100
    );
  END LOOP;

  -- ══════════════════════════════════════════════════════
  -- AIRFIELD CHECKS — 20 checks of various types over 30 days
  -- ══════════════════════════════════════════════════════
  FOR i IN 1..20 LOOP
    d := CURRENT_DATE - (i + (i % 4));
    ct := check_types[1 + (i % array_length(check_types, 1))];
    INSERT INTO airfield_checks (
      base_id, display_id, check_type, created_at, started_at, completed_at, completed_by
    ) VALUES (
      demo_base, 'DEMO-CHK-' || LPAD(i::TEXT, 3, '0'), ct,
      d + interval '7 hours' + (i * 37 % 600) * interval '1 minute',
      d + interval '7 hours' + (i * 37 % 600) * interval '1 minute',
      d + interval '7 hours' + (i * 37 % 600 + 15 + (i * 3) % 30) * interval '1 minute',
      demo_user
    );
  END LOOP;

  -- ══════════════════════════════════════════════════════
  -- DISCREPANCIES — 8 total: 3 open, 4 completed, 1 cancelled
  -- ══════════════════════════════════════════════════════
  INSERT INTO discrepancies (base_id, display_id, type, status, current_status, title, description, location_text, severity, reported_by, created_at, updated_at, resolution_date) VALUES
    (demo_base, 'DEMO-DISC-001', 'lighting', 'open', 'submitted_to_ces', 'TWY A Edge Light Inop', 'Taxiway A edge light #14 inoperative', 'TWY A', 'medium', demo_user, CURRENT_DATE - 18, CURRENT_DATE - 15, NULL),
    (demo_base, 'DEMO-DISC-002', 'pavement', 'open', 'submitted_to_afm', 'RWY 01/19 FOD Damage', 'Spalling on RWY 01/19 at 2000ft marker', 'RWY 01/19', 'high', demo_user, CURRENT_DATE - 12, CURRENT_DATE - 10, NULL),
    (demo_base, 'DEMO-DISC-003', 'signage', 'open', 'awaiting_action_by_ces', 'TWY B Mandatory Sign Faded', 'Mandatory hold sign at TWY B/RWY 01 faded', 'TWY B', 'medium', demo_user, CURRENT_DATE - 5, CURRENT_DATE - 3, NULL),
    (demo_base, 'DEMO-DISC-004', 'lighting', 'completed', 'work_completed_awaiting_verification', 'Approach Light ALSF-2 Lamp', 'ALSF-2 bar 3 lamp #2 replaced', 'RWY 01 Approach', 'medium', demo_user, CURRENT_DATE - 25, CURRENT_DATE - 20, CURRENT_DATE - 20),
    (demo_base, 'DEMO-DISC-005', 'markings', 'completed', 'work_completed_awaiting_verification', 'RWY 01 Threshold Markings', 'Threshold markings repainted', 'RWY 01', 'low', demo_user, CURRENT_DATE - 22, CURRENT_DATE - 14, CURRENT_DATE - 14),
    (demo_base, 'DEMO-DISC-006', 'vegetation', 'completed', 'work_completed_awaiting_verification', 'Grass Height Violation', 'Grass exceeding 7 inches along TWY C', 'TWY C', 'low', demo_user, CURRENT_DATE - 20, CURRENT_DATE - 16, CURRENT_DATE - 16),
    (demo_base, 'DEMO-DISC-007', 'drainage', 'completed', 'work_completed_awaiting_verification', 'Storm Drain Blockage', 'Storm drain near TWY A/B intersection blocked', 'TWY A/B', 'medium', demo_user, CURRENT_DATE - 15, CURRENT_DATE - 8, CURRENT_DATE - 8),
    (demo_base, 'DEMO-DISC-008', 'fod', 'cancelled', 'submitted_to_afm', 'FOD Near Taxiway Hold', 'Metal debris reported — removed during FOD check', 'TWY A', 'low', demo_user, CURRENT_DATE - 10, CURRENT_DATE - 10, NULL);

  -- ══════════════════════════════════════════════════════
  -- PERSONNEL / CONTRACTORS — 3 active, 2 completed
  -- ══════════════════════════════════════════════════════
  INSERT INTO airfield_contractors (base_id, company_name, contact_name, location, work_description, status, start_date, created_at) VALUES
    (demo_base, 'Kiewit Infrastructure', 'John Smith', 'TWY A/B Intersection', 'Joint sealing and pavement repair', 'active', CURRENT_DATE - 5, NOW() - interval '5 days'),
    (demo_base, 'AECOM', 'Sarah Johnson', 'RWY 01 Approach', 'Approach light maintenance', 'active', CURRENT_DATE - 3, NOW() - interval '3 days'),
    (demo_base, 'Hensel Phelps', 'Mike Davis', 'Hangar 4', 'Hangar door repair', 'active', CURRENT_DATE - 1, NOW() - interval '1 day'),
    (demo_base, 'Turner Construction', 'Bob Wilson', 'East Ramp', 'Ramp resurfacing', 'completed', CURRENT_DATE - 20, NOW() - interval '20 days'),
    (demo_base, 'Skanska', 'Amy Chen', 'TWY C', 'Drainage improvement', 'completed', CURRENT_DATE - 15, NOW() - interval '15 days');

  -- ══════════════════════════════════════════════════════
  -- WILDLIFE — 6 sightings, 1 strike
  -- ══════════════════════════════════════════════════════
  INSERT INTO wildlife_sightings (base_id, display_id, species_common, species_group, count_observed, observed_at, location_text, observed_by, created_at) VALUES
    (demo_base, 'DEMO-WS-001', 'Canada Goose', 'bird', 12, NOW() - interval '2 days', 'RWY 01 Departure End', demo_user, NOW() - interval '2 days'),
    (demo_base, 'DEMO-WS-002', 'Red-tailed Hawk', 'bird', 2, NOW() - interval '5 days', 'TWY A Midfield', demo_user, NOW() - interval '5 days'),
    (demo_base, 'DEMO-WS-003', 'White-tailed Deer', 'mammal', 3, NOW() - interval '8 days', 'Perimeter Fence East', demo_user, NOW() - interval '8 days'),
    (demo_base, 'DEMO-WS-004', 'European Starling', 'bird', 50, NOW() - interval '10 days', 'Hangar Row', demo_user, NOW() - interval '10 days'),
    (demo_base, 'DEMO-WS-005', 'Ring-billed Gull', 'bird', 8, NOW() - interval '14 days', 'RWY 19 Threshold', demo_user, NOW() - interval '14 days'),
    (demo_base, 'DEMO-WS-006', 'Canada Goose', 'bird', 25, NOW() - interval '20 days', 'Retention Pond South', demo_user, NOW() - interval '20 days');

  INSERT INTO wildlife_strikes (base_id, display_id, species_common, species_group, strike_date, reported_by, created_at) VALUES
    (demo_base, 'DEMO-WK-001', 'European Starling', 'bird', CURRENT_DATE - 7, demo_user, NOW() - interval '7 days');

  -- ══════════════════════════════════════════════════════
  -- ACTIVITY LOG — recent entries for the feed
  -- ══════════════════════════════════════════════════════
  INSERT INTO activity_log (base_id, action, entity_type, entity_id, user_id, metadata, created_at) VALUES
    (demo_base, 'filed', 'inspection', demo_base, demo_user, '{"details":"AFLD3/CP COMPLETED AIRFIELD INSPECTION. BWC/LOW, RSC/DRY. 1 DISCREPANCY NOTED"}', NOW() - interval '1 day'),
    (demo_base, 'filed', 'inspection', demo_base, demo_user, '{"details":"AFLD3/CP COMPLETED LIGHTING INSPECTION. ALL SYSTEMS OPERATIONAL"}', NOW() - interval '2 days'),
    (demo_base, 'completed', 'check', demo_base, demo_user, '{"details":"AFLD3/CP ON THE AFLD FOR A FOD CHECK. AFLD CLEAR"}', NOW() - interval '4 hours'),
    (demo_base, 'created', 'discrepancy', demo_base, demo_user, '{"details":"TWY B MANDATORY SIGN FADED"}', NOW() - interval '5 days'),
    (demo_base, 'status_updated', 'airfield_status', demo_base, demo_user, '{"details":"ADVISES RWY 01 IN USE"}', NOW() - interval '6 hours'),
    (demo_base, 'noted', 'manual', demo_base, demo_user, '{"details":"SHIFT CHANGE - DAY SHIFT ON DUTY"}', NOW() - interval '8 hours');

  RAISE NOTICE 'Demo analytics data seeded for base %', demo_base;

END $$;
