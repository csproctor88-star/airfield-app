-- ============================================================
-- Clone Selfridge → Demo AFB
-- Run in Supabase SQL Editor (one-time operation)
-- To reset: DELETE FROM bases WHERE name = 'Demo AFB';
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

  -- ── 1. Create Demo AFB base ──
  SELECT * INTO src_base FROM bases WHERE id = src_base_id;
  INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone,
    ce_shops, checklist_reset_time, discrepancy_type_shop_map)
  VALUES (
    new_base_id,
    'Demo AFB',
    'KDMO',
    src_base.unit,
    src_base.majcom,
    'Demo Installation',
    src_base.elevation_msl,
    src_base.timezone,
    src_base.ce_shops,
    src_base.checklist_reset_time,
    src_base.discrepancy_type_shop_map
  );

  RAISE NOTICE 'Created Demo AFB with id: %', new_base_id;

  -- ── 2. Base runways ──
  INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, runway_class,
    end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
    end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl,
    true_heading)
  SELECT new_base_id, runway_id, length_ft, width_ft, surface, runway_class,
    end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
    end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl,
    true_heading
  FROM base_runways WHERE base_id = src_base_id;

  -- ── 3. Base NAVAIDs ──
  INSERT INTO base_navaids (base_id, navaid_name, sort_order)
  SELECT new_base_id, navaid_name, sort_order
  FROM base_navaids WHERE base_id = src_base_id;

  -- ── 4. Base areas ──
  INSERT INTO base_areas (base_id, area_name, sort_order)
  SELECT new_base_id, area_name, sort_order
  FROM base_areas WHERE base_id = src_base_id;

  -- ── 5. CE shops — stored as ce_shops TEXT[] on bases, already copied above ──

  -- ── 6. ARFF aircraft ──
  INSERT INTO base_arff_aircraft (base_id, aircraft_name, sort_order)
  SELECT new_base_id, aircraft_name, sort_order
  FROM base_arff_aircraft WHERE base_id = src_base_id;

  -- ── 7. Base taxiways ──
  INSERT INTO base_taxiways (base_id, designator, taxiway_type, tdg, centerline_coords,
    standard, runway_class, service_branch)
  SELECT new_base_id, designator, taxiway_type, tdg, centerline_coords,
    standard, runway_class, service_branch
  FROM base_taxiways WHERE base_id = src_base_id;

  -- ── 8. Base facilities ──
  INSERT INTO base_facilities (base_id, facility_number, description, sort_order)
  SELECT new_base_id, facility_number, description, sort_order
  FROM base_facilities WHERE base_id = src_base_id;

  -- ── 9. Wildlife species ──
  INSERT INTO base_wildlife_species (base_id, species_common, is_favorite)
  SELECT new_base_id, species_common, is_favorite
  FROM base_wildlife_species WHERE base_id = src_base_id;

  -- ── 10. Inspection templates (3-level hierarchy with ID mapping) ──
  CREATE TEMP TABLE _template_map (old_id UUID, new_id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE _section_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  -- Templates
  INSERT INTO _template_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM base_inspection_templates WHERE base_id = src_base_id;

  INSERT INTO base_inspection_templates (id, base_id, template_type)
  SELECT m.new_id, new_base_id, t.template_type
  FROM base_inspection_templates t
  JOIN _template_map m ON m.old_id = t.id
  WHERE t.base_id = src_base_id;

  -- Sections
  INSERT INTO _section_map (old_id, new_id)
  SELECT s.id, gen_random_uuid()
  FROM base_inspection_sections s
  JOIN _template_map tm ON tm.old_id = s.template_id;

  INSERT INTO base_inspection_sections (id, template_id, section_id, title, sort_order)
  SELECT sm.new_id, tm.new_id, s.section_id, s.title, s.sort_order
  FROM base_inspection_sections s
  JOIN _template_map tm ON tm.old_id = s.template_id
  JOIN _section_map sm ON sm.old_id = s.id;

  -- Items (item_key, item_number, item_text — NOT item_id/label)
  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order)
  SELECT sm.new_id, i.item_key, i.item_number, i.item_text, i.item_type, i.sort_order
  FROM base_inspection_items i
  JOIN _section_map sm ON sm.old_id = i.section_id;

  -- ── 11. Lighting systems (2-level hierarchy) ──
  CREATE TEMP TABLE _system_map (old_id UUID, new_id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE _component_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _system_map (old_id, new_id)
  SELECT id, gen_random_uuid() FROM lighting_systems WHERE base_id = src_base_id;

  INSERT INTO lighting_systems (id, base_id, system_type, name, runway_or_taxiway, is_precision, notes)
  SELECT sm.new_id, new_base_id, ls.system_type, ls.name, ls.runway_or_taxiway, ls.is_precision, ls.notes
  FROM lighting_systems ls
  JOIN _system_map sm ON sm.old_id = ls.id;

  -- Components (requires_notam, requires_system_shutoff — NOT action_*)
  INSERT INTO _component_map (old_id, new_id)
  SELECT c.id, gen_random_uuid()
  FROM lighting_system_components c
  JOIN _system_map sm ON sm.old_id = c.system_id;

  INSERT INTO lighting_system_components (id, system_id, component_type, label, total_count,
    allowable_outage_pct, allowable_outage_count, allowable_outage_consecutive, allowable_no_adjacent,
    requires_notam, requires_ce_notification, requires_system_shutoff, requires_terps_notification,
    is_zero_tolerance, allowable_outage_text, q_code, notam_text_template, sort_order)
  SELECT cm.new_id, sm.new_id, c.component_type, c.label, c.total_count,
    c.allowable_outage_pct, c.allowable_outage_count, c.allowable_outage_consecutive, c.allowable_no_adjacent,
    c.requires_notam, c.requires_ce_notification, c.requires_system_shutoff, c.requires_terps_notification,
    c.is_zero_tolerance, c.allowable_outage_text, c.q_code, c.notam_text_template, c.sort_order
  FROM lighting_system_components c
  JOIN _system_map sm ON sm.old_id = c.system_id
  JOIN _component_map cm ON cm.old_id = c.id;

  -- ── 12. Infrastructure features (with bar_group self-reference) ──
  CREATE TEMP TABLE _feature_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _feature_map (old_id, new_id)
  SELECT id, gen_random_uuid() FROM infrastructure_features WHERE base_id = src_base_id;

  -- First pass: insert all features without bar_group_id
  INSERT INTO infrastructure_features (id, base_id, feature_type, longitude, latitude,
    rotation, layer, block, label, notes, source, status, status_changed_at,
    system_component_id)
  SELECT fm.new_id, new_base_id, f.feature_type, f.longitude, f.latitude,
    f.rotation, f.layer, f.block, f.label, f.notes, f.source, f.status, f.status_changed_at,
    cm.new_id
  FROM infrastructure_features f
  JOIN _feature_map fm ON fm.old_id = f.id
  LEFT JOIN _component_map cm ON cm.old_id = f.system_component_id
  WHERE f.base_id = src_base_id;

  -- Second pass: update bar_group_id self-references
  UPDATE infrastructure_features dst
  SET bar_group_id = fm_bar.new_id
  FROM infrastructure_features src
  JOIN _feature_map fm_src ON fm_src.old_id = src.id
  JOIN _feature_map fm_bar ON fm_bar.old_id = src.bar_group_id
  WHERE dst.id = fm_src.new_id
    AND src.bar_group_id IS NOT NULL
    AND src.base_id = src_base_id;

  -- ── 13. QRC templates ──
  INSERT INTO qrc_templates (base_id, qrc_number, title, notes, steps, "references",
    has_scn_form, scn_fields, is_active, sort_order)
  SELECT new_base_id, qrc_number, title, notes, steps, "references",
    has_scn_form, scn_fields, is_active, sort_order
  FROM qrc_templates WHERE base_id = src_base_id;

  -- ── 14. Shift checklist items ──
  INSERT INTO shift_checklist_items (base_id, label, shift, frequency, sort_order, is_active)
  SELECT new_base_id, label, shift, frequency, sort_order, is_active
  FROM shift_checklist_items WHERE base_id = src_base_id;

  -- ── 15. Inspection item → system links ──
  INSERT INTO inspection_item_system_links (item_id, system_id)
  SELECT new_items.id, sm.new_id
  FROM inspection_item_system_links isl
  JOIN base_inspection_items old_items ON old_items.id = isl.item_id
  JOIN _section_map secm ON secm.old_id = old_items.section_id
  JOIN base_inspection_items new_items ON new_items.section_id = secm.new_id
    AND new_items.item_key = old_items.item_key
  JOIN _system_map sm ON sm.old_id = isl.system_id;

  -- ── 16. Seed airfield status row ──
  INSERT INTO airfield_status (base_id, advisory_type, advisory_text, runway_status)
  SELECT new_base_id, advisory_type, advisory_text, runway_status
  FROM airfield_status WHERE base_id = src_base_id
  LIMIT 1;

  -- If no source row exists, create a default
  IF NOT FOUND THEN
    INSERT INTO airfield_status (base_id, runway_status) VALUES (new_base_id, 'open');
  END IF;

  -- ── 17. Copy recent discrepancies (last 20) ──
  -- Use 'DEMO-' prefix on display_id to avoid unique constraint conflicts
  INSERT INTO discrepancies (base_id, display_id, title, description, type, status,
    current_status, severity, location_text, work_order_number, assigned_shop, facility_number,
    reported_by, created_at)
  SELECT new_base_id, 'DEMO-' || display_id, title, description, type, status,
    current_status, severity, location_text, work_order_number, assigned_shop, facility_number,
    demo_user_id, created_at
  FROM discrepancies
  WHERE base_id = src_base_id
  ORDER BY created_at DESC
  LIMIT 20;

  -- ── 18. Copy NAVAID statuses ──
  INSERT INTO navaid_statuses (base_id, navaid_name, status, notes)
  SELECT new_base_id, navaid_name, status, notes
  FROM navaid_statuses WHERE base_id = src_base_id;

  -- ── 19. Update demo user → Demo AFB with airfield_manager role ──
  UPDATE profiles
  SET primary_base_id = new_base_id, role = 'airfield_manager'
  WHERE id = demo_user_id;

  -- Update or insert base membership
  DELETE FROM base_members WHERE user_id = demo_user_id;
  INSERT INTO base_members (base_id, user_id, role)
  VALUES (new_base_id, demo_user_id, 'airfield_manager');

  RAISE NOTICE 'Demo AFB created and demo user assigned. Base ID: %', new_base_id;
  RAISE NOTICE 'Done! Demo user is now airfield_manager at Demo AFB.';

END $$;
