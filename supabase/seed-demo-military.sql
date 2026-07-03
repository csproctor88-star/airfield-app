-- ============================================================
-- Clone Selfridge → fictional military demo airfield (USAF mode)
--
-- Marketing-capture tenant for the glidepath-site Phase 2 pipeline
-- (glidepath-site docs/plan-phase-2.md). Spins up a fictional USAF
-- airfield whose name is safe to show in marketing screenshots
-- (spec rule: never a real installation name). Reuses Selfridge's
-- airfield layout — runways, taxiways, NAVAIDs, lighting systems,
-- and the full Visual NAVAIDs feature map (it's just geometry) —
-- and keeps airport_type='usaf' so every code path renders
-- military terminology.
--
-- Clone set (modeled on seed-demo-base.sql, against the current
-- schema): base config incl. enabled_modules, runways, NAVAIDs,
-- areas, ARFF aircraft, taxiways, facilities, wildlife species,
-- inspection templates/sections/items (+ system links), lighting
-- systems + components, infrastructure features, shift checklist
-- items, a clean airfield_status row, all-green navaid_statuses,
-- legacy 5-slot daily-review shape, demo-user membership.
--
-- Marketing-safe exclusions (deliberate — do not "fix"):
--   * No operational rows copied (discrepancies, live status
--     board, current outage states, feature/system notes) — the
--     photogenic state is staged through the UI per plan Task 2,
--     and Selfridge's live ops data must never appear in captures.
--   * No QRC templates — Selfridge's QRC steps embed real phone
--     numbers / call trees. /qrc is not in the Phase 2 shot list;
--     seed sanitized QRCs later if Phase 3 needs that module.
--   * bases contact/message fields (amops_email, default_*_message,
--     installation_code, c2imera_*) left NULL — real contact info.
--
-- NOTAMs: /notams is a live FAA-feed view (no local table). A
-- fictional ICAO returns no NOTAMs — expected and fine; no capture
-- route renders NOTAMs.
--
-- Rename the tenant by editing demo_name / demo_icao / demo_unit
-- below before running.
--
-- Run in Supabase SQL Editor (one-time operation).
-- To reset (also required before re-running):
--   DELETE FROM bases WHERE name = 'Blue Mesa AFB';
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
  n_systems INT;
  n_features INT;
  n_items INT;
BEGIN

  -- ── 0. Preconditions ──
  SELECT id INTO demo_user_id FROM profiles WHERE email = 'demo@glidepathops.com';
  IF demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user not found. Create demo@glidepathops.com first.';
  END IF;

  IF EXISTS (SELECT 1 FROM bases WHERE name = demo_name) THEN
    RAISE EXCEPTION '% already exists. Reset first: DELETE FROM bases WHERE name = ''%'';',
      demo_name, demo_name;
  END IF;

  SELECT * INTO src_base FROM bases WHERE id = src_base_id;
  IF src_base.id IS NULL THEN
    RAISE EXCEPTION 'Source base % not found.', src_base_id;
  END IF;

  -- ── 1. Create the fictional military base ──
  -- Clones the config columns (module roster, status-board labels,
  -- ARFF config, activity/contractor templates, shop map, setup
  -- state) so the tenant behaves like a fully configured base.
  -- Contact/identifier fields stay NULL (see header).
  INSERT INTO bases (
    id, name, icao, unit, majcom, location, elevation_msl, timezone,
    ce_shops, checklist_reset_time, activity_templates,
    discrepancy_type_shop_map, contractor_templates, status_labels,
    feedback_form_config, arff_config, shift_count,
    enabled_modules, setup_progress, quick_setup_pending,
    qrc_review_interval, map_provider,
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
    src_base.activity_templates,
    src_base.discrepancy_type_shop_map,
    src_base.contractor_templates,
    src_base.status_labels,
    src_base.feedback_form_config,
    src_base.arff_config,
    src_base.shift_count,
    src_base.enabled_modules,    -- full module roster, not column default
    src_base.setup_progress,     -- wizard shows complete
    FALSE,
    src_base.qrc_review_interval,
    src_base.map_provider,
    'usaf',
    NULL,                        -- no Part 139 class in military mode
    NULL,
    NULL,
    'ufc_3_260_01'
  );

  RAISE NOTICE 'Created % (%) with id: %', demo_name, demo_icao, new_base_id;

  -- ── 2-7. Airfield geometry / reference data ──────────────
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

  -- ── 8. Wildlife species list (quick-log favorites) ───────
  INSERT INTO base_wildlife_species (base_id, species_common, is_favorite)
  SELECT new_base_id, species_common, is_favorite
  FROM base_wildlife_species WHERE base_id = src_base_id;

  -- ── 9. Inspection templates (3-level hierarchy, ID-remapped) ──
  CREATE TEMP TABLE _template_map (old_id UUID, new_id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE _section_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _template_map (old_id, new_id)
  SELECT id, gen_random_uuid()
  FROM base_inspection_templates WHERE base_id = src_base_id;

  INSERT INTO base_inspection_templates (id, base_id, template_type)
  SELECT m.new_id, new_base_id, t.template_type
  FROM base_inspection_templates t
  JOIN _template_map m ON m.old_id = t.id
  WHERE t.base_id = src_base_id;

  INSERT INTO _section_map (old_id, new_id)
  SELECT s.id, gen_random_uuid()
  FROM base_inspection_sections s
  JOIN _template_map tm ON tm.old_id = s.template_id;

  INSERT INTO base_inspection_sections (id, template_id, section_id, title,
    guidance, conditional, sort_order)
  SELECT sm.new_id, tm.new_id, s.section_id, s.title,
    s.guidance, s.conditional, s.sort_order
  FROM base_inspection_sections s
  JOIN _template_map tm ON tm.old_id = s.template_id
  JOIN _section_map sm ON sm.old_id = s.id;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order)
  SELECT sm.new_id, i.item_key, i.item_number, i.item_text, i.item_type, i.sort_order
  FROM base_inspection_items i
  JOIN _section_map sm ON sm.old_id = i.section_id;

  -- ── 10. Lighting systems + components (Visual NAVAIDs config) ──
  CREATE TEMP TABLE _system_map (old_id UUID, new_id UUID) ON COMMIT DROP;
  CREATE TEMP TABLE _component_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _system_map (old_id, new_id)
  SELECT id, gen_random_uuid() FROM lighting_systems WHERE base_id = src_base_id;

  -- notes dropped: free-text system notes may reference real ops
  INSERT INTO lighting_systems (id, base_id, system_type, name,
    runway_or_taxiway, is_precision, sort_order)
  SELECT sm.new_id, new_base_id, ls.system_type, ls.name,
    ls.runway_or_taxiway, ls.is_precision, ls.sort_order
  FROM lighting_systems ls
  JOIN _system_map sm ON sm.old_id = ls.id;

  INSERT INTO _component_map (old_id, new_id)
  SELECT c.id, gen_random_uuid()
  FROM lighting_system_components c
  JOIN _system_map sm ON sm.old_id = c.system_id;

  INSERT INTO lighting_system_components (id, system_id, component_type, label, total_count,
    allowable_outage_pct, allowable_outage_count, allowable_outage_consecutive, allowable_no_adjacent,
    requires_notam, requires_ce_notification, requires_system_shutoff, requires_terps_notification,
    requires_obstruction_notam_attrs, is_zero_tolerance, allowable_outage_text,
    q_code, notam_text_template, sort_order)
  SELECT cm.new_id, sm.new_id, c.component_type, c.label, c.total_count,
    c.allowable_outage_pct, c.allowable_outage_count, c.allowable_outage_consecutive, c.allowable_no_adjacent,
    c.requires_notam, c.requires_ce_notification, c.requires_system_shutoff, c.requires_terps_notification,
    c.requires_obstruction_notam_attrs, c.is_zero_tolerance, c.allowable_outage_text,
    c.q_code, c.notam_text_template, c.sort_order
  FROM lighting_system_components c
  JOIN _system_map sm ON sm.old_id = c.system_id
  JOIN _component_map cm ON cm.old_id = c.id;

  -- ── 11. Infrastructure features (the Visual NAVAIDs map) ──
  -- Statuses forced to 'operational' and notes dropped: Selfridge's
  -- live outage state / remarks must not leak into the demo tenant.
  -- Plan Task 2 stages the one photogenic outage through the UI.
  CREATE TEMP TABLE _feature_map (old_id UUID, new_id UUID) ON COMMIT DROP;

  INSERT INTO _feature_map (old_id, new_id)
  SELECT id, gen_random_uuid() FROM infrastructure_features WHERE base_id = src_base_id;

  INSERT INTO infrastructure_features (id, base_id, feature_type, longitude, latitude,
    rotation, layer, block, label, source, status, status_changed_at,
    system_component_id)
  SELECT fm.new_id, new_base_id, f.feature_type, f.longitude, f.latitude,
    f.rotation, f.layer, f.block, f.label, f.source, 'operational', now(),
    cm.new_id
  FROM infrastructure_features f
  JOIN _feature_map fm ON fm.old_id = f.id
  LEFT JOIN _component_map cm ON cm.old_id = f.system_component_id
  WHERE f.base_id = src_base_id;

  -- Second pass: remap bar_group self-references
  UPDATE infrastructure_features dst
  SET bar_group_id = fm_bar.new_id
  FROM infrastructure_features src
  JOIN _feature_map fm_src ON fm_src.old_id = src.id
  JOIN _feature_map fm_bar ON fm_bar.old_id = src.bar_group_id
  WHERE dst.id = fm_src.new_id
    AND src.bar_group_id IS NOT NULL
    AND src.base_id = src_base_id;

  -- ── 12. Shift checklist items ─────────────────────────────
  INSERT INTO shift_checklist_items (base_id, label, shift, frequency, sort_order, is_active)
  SELECT new_base_id, label, shift, frequency, sort_order, is_active
  FROM shift_checklist_items WHERE base_id = src_base_id;

  -- ── 13. Inspection item → system/component links ──────────
  INSERT INTO inspection_item_system_links (item_id, system_id, component_id)
  SELECT new_items.id, sm.new_id, cm.new_id
  FROM inspection_item_system_links isl
  JOIN base_inspection_items old_items ON old_items.id = isl.item_id
  JOIN _section_map secm ON secm.old_id = old_items.section_id
  JOIN base_inspection_items new_items ON new_items.section_id = secm.new_id
    AND new_items.item_key = old_items.item_key
  JOIN _system_map sm ON sm.old_id = isl.system_id
  LEFT JOIN _component_map cm ON cm.old_id = isl.component_id;

  -- ── 14. Clean airfield status row (staged via UI later) ───
  INSERT INTO airfield_status (base_id, runway_status)
  VALUES (new_base_id, 'open');

  -- ── 15. NAVAID status grid — all green ─────────────────────
  INSERT INTO navaid_statuses (base_id, navaid_name, status, notes)
  SELECT new_base_id, navaid_name, 'green', NULL
  FROM base_navaids WHERE base_id = new_base_id;

  -- ── 16. Daily review slots ─────────────────────────────────
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

  -- ── 17. Grant demo user access ─────────────────────────────
  -- Membership only: no primary_base_id flip and no membership
  -- deletes — the demo user keeps access to BOTH capture tenants.
  INSERT INTO base_members (base_id, user_id, role)
  VALUES (new_base_id, demo_user_id, 'airfield_manager')
  ON CONFLICT (base_id, user_id) DO UPDATE SET role = 'airfield_manager';

  -- ── Done — summary ─────────────────────────────────────────
  SELECT count(*) INTO n_systems  FROM lighting_systems         WHERE base_id = new_base_id;
  SELECT count(*) INTO n_features FROM infrastructure_features  WHERE base_id = new_base_id;
  SELECT count(*) INTO n_items    FROM base_inspection_items i
    JOIN base_inspection_sections s ON s.id = i.section_id
    JOIN base_inspection_templates t ON t.id = s.template_id
    WHERE t.base_id = new_base_id;

  RAISE NOTICE '% ready: % lighting systems, % map features, % inspection items. Base id: %',
    demo_name, n_systems, n_features, n_items, new_base_id;

END $$;
