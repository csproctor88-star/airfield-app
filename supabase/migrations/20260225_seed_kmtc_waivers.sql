-- ═══════════════════════════════════════════════════════════════
-- Seed 17 historical KMTC (Selfridge ANGB) waivers
-- Source: KMTC Waivers.xlsx — Feb 2025 annual review data
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_base_id UUID;
  v_wid UUID;
BEGIN

  -- Look up KMTC base
  SELECT id INTO v_base_id FROM bases WHERE icao = 'KMTC';
  IF v_base_id IS NULL THEN
    RAISE NOTICE 'KMTC base not found — skipping seed';
    RETURN;
  END IF;

  -- ── 1. VGLZ0502240001 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ0502240001', 'temporary', 'active', 'low', 'new',
    'Taxiway Lima is 50'' wide, less than 75'' required for a Class B runway airfield',
    'Repair taxiway by replacement',
    '25'' deficiency', 'VGLZ009082', '61 Years',
    '2005-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'TWY L')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1, Item 1', 'Taxiway width deficiency — 50'' vs 75'' required', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 2. VGLZ050224007 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ050224007', 'permanent', 'active', 'low', 'new',
    'Pole Barn, Bldg 1045 protrudes 9'' into clear zone, 1491'' east of RW 19 centerline',
    'Relocate facility',
    '9'' into 3000x3000'' Clear Zone for RWY 19', 'VGLZ050224', 'Indefinite',
    '2005-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'RWY 19 Clear Zone')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 3.5, Item 4', 'Clear zone encroachment — Bldg 1045', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 3. VGLZ050224009 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ050224009', 'permanent', 'active', 'low', 'new',
    'Short Approach Lighting System on Cat Type I, Class B Runway 1',
    'SALS will be replaced with ALSF-1 lighting system during the runway encroachment project.',
    'Non-precision approach lighting system', 'VGLZ239505', 'Until 2028',
    '2005-01-01', '2028-01-01', '2025-02-20', '2026-02-01', 'RWY 01 Approach')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_535_01', 'Table 2-1A, Note 16', 'Non-precision approach lighting deficiency', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 4. VGLZ050224011 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ050224011', 'temporary', 'active', 'low', 'new',
    'Hot cargo pad size insufficient to accommodate large aircraft (C-17 and C-5) from maneuvering and does not meet minimum size requirements',
    'Enlarge or replace hot cargo area to meet dimensions required for aircraft larger than C-130 aircraft without use of marshallers or wing walkers',
    'Turn Radius for aircraft larger than C-130', 'VGLZ009082', '61 Years',
    '2005-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'Hot Cargo Pad')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Para 6.12.3', 'Hot cargo pad size — turn radius deficiency', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 5. VGLZ050224013 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ050224013', 'permanent', 'active', 'low', 'new',
    'Above ground, non-frangible utility lines run through the middle of the south clear zone for RW 1/19. Poles are located approximately 1500'' south of departure end of RW 1/19 and are on non-US owned property that traverses east to west through the south clear zone',
    'None: Obstruction is published in FLIP AP1',
    'Ranges from 1500'' to 1900''', NULL, 'Indefinite',
    '2005-01-01', '2025-02-20', '2026-02-01', 'RWY 01/19 South Clear Zone')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'AFH 32-7084, p78, Figure 4, SLUSM 47, 48, & 49', 'Non-frangible utility lines in clear zone', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 6. VGLZ080527001 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ080527001', 'temporary', 'active', 'low', 'new',
    'Oil water separator and approximately 330 feet of fencing along Taxiway "A" exists roughly 165 feet from taxiway centerline. Majority of aircraft operating on this taxiway clear this fenced compound by at least 25 feet.',
    'Alpha taxiway replacement project will relocate new taxiway away from this fencing currently infringing upon mandatory 200 foot obstruction clearance/frangibility area.',
    '35'' within the Taxiway Obstacle Free Area', 'VGLZ009802', '8 Years',
    '2021-01-01', '2025-02-20', '2026-02-01', 'TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1; Item 10', 'Oil water separator and fencing in TWY A obstacle free area', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 7. VGLZ080527004 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ080527004', 'temporary', 'active', 'low', 'new',
    'Taxiway "A" has a non-frangible above ground telephone pedestal located 150 feet from taxiway centerline along with 4 protective bollards reaching to 3.5 feet',
    'Taxiway "A" project will relocate the taxiway away from this area and reestablish the required 200 foot centerline separation',
    '50'' within the Taxiway Obstacle Free Area', 'VGLZ009082', '61 Years',
    '2008-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1, item 10 and Atch 14.2.2', 'Non-frangible telephone pedestal in TWY A obstacle free area', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 8. VGLZ080527005 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ080527005', 'temporary', 'active', 'low', 'new',
    'South overrun permanently displaced threshold does not have correct configuration of lighting (runway end and edge lights) for useable takeoff/roll out area. Area to be used for fixed wing aircraft - day/VFR takeoff only',
    'Correct lighting deficiencies to UFC 3-535-01 specifications during Taxiway "A" realignment',
    'Day time VFR only', 'VGLZ009082', '61 Years',
    '2008-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'RWY 01/19 South Overrun')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_535_01', 'Para 4.5.2, 4.5.2.2, & 4.5.2.3 and Figure 4.6', 'Displaced threshold lighting deficiency', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 9. VGLZ090413003 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ090413003', 'temporary', 'active', 'low', 'new',
    'Telephone pedestal 150'' from taxiway centerline; non-frangible structure',
    'Taxiway replacement project will place this obstruction outside of the obstruction mandatory clearance area for frangible structures',
    '50'' within the Taxiway Obstacle Free Area', '8 Years',
    '2017-01-01', '2025-02-20', '2026-02-01', 'TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1, item 10 and Atch 14.2.2', 'Non-frangible telephone pedestal in TWY obstacle free area', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 10. VGLZ090413004 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ090413004', 'temporary', 'active', 'low', 'new',
    'Non frangible fire hydrant located 150'' away from taxiway centerline',
    'Future taxiway replacement project will eliminate the out of standard condition',
    'Within Taxiway Obstacle Free Area', 'VGLZ009082', '61 Years',
    '2009-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1, Item 10 and Section 13, para B13.2.2', 'Non-frangible fire hydrant in TWY obstacle free area', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 11. VGLZ100405003 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, project_number, period_valid,
    date_approved, expiration_date, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ100405003', 'temporary', 'active', 'low', 'new',
    'Multiple buildings impinge on taxiway. Bldg 46 and fence 197'' from taxi centerline. Bldg 851 is 233'' from taxi centerline and 1004'' from runway centerline',
    'Taxiway "A" realignment project would eliminate impact. Meantime, obstruction lighting to be added to Bldg 851',
    '3'' within the Taxiway Obstacle Free Area', 'VGLZ009082', '61 Years',
    '2010-01-01', '2066-01-01', '2025-02-20', '2026-02-01', 'TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1; Item 10 and Section 13, para B13-2.2', 'Buildings impinging on taxiway obstacle free area', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 12. VGLZ10405001 ───────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ10405001', 'temporary', 'active', 'low', 'new',
    'Allow C-130 and smaller craft to use current hot cargo pad for munitions on/off load. Tail of parked aircraft infringes on 7:1 transitional surface slope by at least 29'' vertically',
    'Resite hot cargo pad to another site that meets both explosive and transitional surface criteria',
    '29'' violation to the transitional surface', '8 Years',
    '2010-01-01', '2025-02-20', '2026-02-01', 'Hot Cargo Pad')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 3-7; item 30', 'Hot cargo pad transitional surface violation', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 13. VGLZ130430001 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ130430001', 'temporary', 'active', 'low', 'new',
    'Building 851 (water pump house) which is 1,006 feet of runway centerline penetrates the transition surface (7:1).',
    'There is a project to replace/relocate Alpha Taxiway in the next 5-10 years and it may be addressed during that design process. An obstruction light was installed.',
    '50'' too close to meet the 7:1 ratio', '8 Years',
    '2013-01-01', '2025-02-20', '2026-02-01', 'RWY / TWY A')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 3-7, Item 30', 'Bldg 851 transitional surface penetration', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 14. VGLZ140805001 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ140805001', 'temporary', 'active', 'low', 'new',
    'Exclusive use taxiway to Coast Guard ramp does not meet UFC requirement for Class B runway of 75 ft wide at 40 feet, 8 inches. Coast Guard Aux aircraft use the taxiway; they have wingspans of less than 40 feet',
    'None',
    'Only Coast Guard aircraft utilize entrance', '8 Years',
    '2014-01-01', '2025-02-20', '2026-02-01', 'USCG Ramp TWY')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1', 'Coast Guard taxiway width deficiency', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 15. VGLZ140805002 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ140805002', 'temporary', 'active', 'low', 'new',
    'Exclusive use taxiway to Coast Guard ramp does not meet UFC requirement for Class B runway of 75 ft wide at 40 feet, 8 inches. Coast Guard C-130, HC-144, C-37, and C-27 use the taxiway on an occasional basis & are not aircraft based at this Air Station',
    'Aircraft will be towed and wing walked at the threshold of the ramp as needed',
    'Only Coast Guard aircraft utilize entrance', '8 Years',
    '2014-01-01', '2025-02-20', '2026-02-01', 'USCG Ramp TWY')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 5.1', 'Coast Guard taxiway width deficiency — larger aircraft', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 16. VGLZ180328001 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ180328001', 'temporary', 'active', 'low', 'new',
    'West ramp reconfigured to accommodate KC-135 Alert operations. Fire hydrants on the west edge of ramp are not 84 feet from taxilane centerline. 50 feet between obstacles cannot be maintained. Non-standard markings exist as per East ramp',
    'Parking plan will be published in local AOI: SANGB 13-1. An operational risk management assessment has been conducted. KC-135 aircrew will be briefed on operating procedures and if needed maintenance personnel will provide wing walkers.',
    '9'' too close to taxilane', '8 Years',
    '2018-01-01', '2025-02-20', '2026-02-01', 'West Ramp')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 6-1, Items 4/5 and B13-2.20.2.5', 'West ramp fire hydrant and obstacle clearance for KC-135 ops', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  -- ── 17. VGLZ220125001 ──────────────────────────────────────
  INSERT INTO waivers (base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, corrective_action, criteria_impact, period_valid,
    date_approved, last_reviewed_date, next_review_due, location_description)
  VALUES (v_base_id, 'VGLZ220125001', 'permanent', 'active', 'medium', 'new',
    'South End Expanded Clear Zone South and East of the Clinton River. On 16 Feb 1979 this area was excluded permanently from the Expanded Clear Zone acquisition within a compromise solution between Congressmen Bonner & Nedzi and HQ AF/LEE',
    'No action will be taken to initiate acquisition of any real property interest IAW AFI32-1015, Paragraph 3.4. Runway Encroachment Solution projects in work.',
    '80 homes within 1800'' of runway threshold', 'Indefinite',
    '2022-01-01', '2025-02-20', '2026-02-01', 'RWY 01/19 South Expanded CZ')
  RETURNING id INTO v_wid;
  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order)
  VALUES (v_wid, 'ufc_3_260_01', 'Table 3-5', 'Expanded clear zone residential encroachment', 0);
  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, recommendation, mitigation_verified, presented_to_facilities_board)
  VALUES (v_wid, 2025, '2025-02-20', 'retain', true, true);

  RAISE NOTICE 'Seeded 17 KMTC waivers with criteria and 2025 reviews';

END $$;
