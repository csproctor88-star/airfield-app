-- ============================================================
-- KDRA (Demo Regional Airport) — Phase 3 data refresh
--
-- Backfills the Demo Regional Airport with sample data for each
-- Phase 3 sub-module so the demo tour story is end-to-end:
--
--   3c — FAA approach type + category on each runway
--   3b — AEP plan + response agencies + 1 completed tabletop drill
--   3d — 2 historical FCRs (winter snow event narrative)
--   3e — 2026 WHMP assessment with 3 species + 2 findings
--
-- Idempotent: re-running won't duplicate rows. Each section uses
-- ON CONFLICT or check-first-then-insert.
--
-- Run via:
--   npx supabase db query --linked --file supabase/seed-demo-civilian-phase3.sql
--
-- To reset Phase 3 demo data only (leaves base + runways intact):
--   DELETE FROM aep_plans              WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM aep_response_agencies  WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM aep_drills             WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM field_condition_reports WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM wildlife_hazard_assessments WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
-- ============================================================

DO $$
DECLARE
  v_kdra_id   UUID := 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
  v_demo_user UUID := 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6';
  v_runway_id UUID;
  v_aep_plan_id UUID;
  v_aep_agency_arff UUID;
  v_aep_agency_ems UUID;
  v_aep_agency_hosp UUID;
  v_aep_agency_atc UUID;
  v_aep_drill_id UUID;
  v_whmp_id UUID;
BEGIN

  -- ── 1. Phase 3c — runway FAA approach data ──────────────────
  -- KDRA RWY 01/19 is a typical Class III non-precision runway.
  SELECT id INTO v_runway_id FROM base_runways WHERE base_id = v_kdra_id LIMIT 1;
  IF v_runway_id IS NOT NULL THEN
    UPDATE base_runways
       SET faa_approach_type = 'non_utility_non_precision_3_4',
           faa_approach_category = 'C'
     WHERE id = v_runway_id;
    RAISE NOTICE 'Phase 3c: set FAA approach type/category on runway %', v_runway_id;
  END IF;

  -- ── 2. Phase 3b AEP — plan + agencies + 1 drill ─────────────

  -- 2a. AEP plan (v2026.1, AE-signed)
  INSERT INTO aep_plans (
    base_id, version, effective_date, document_url,
    approved_by_faa_at, faa_acceptance_ref,
    ae_user_id, ae_signed_at, last_reviewed_at, reviewed_by_user_id,
    notes, created_by
  )
  SELECT
    v_kdra_id, '2026.1', '2026-04-15',
    'https://demo.glidepathops.com/sample-aep-2026.pdf',
    '2026-05-02', 'ATL-AEP-2026-04',
    v_demo_user, '2026-05-10T14:00:00Z', '2026-05-10T14:00:00Z', v_demo_user,
    'Annual revision incorporating updated mutual-aid roster after county consolidation.',
    v_demo_user
  WHERE NOT EXISTS (
    SELECT 1 FROM aep_plans WHERE base_id = v_kdra_id AND version = '2026.1'
  )
  RETURNING id INTO v_aep_plan_id;
  IF v_aep_plan_id IS NOT NULL THEN
    RAISE NOTICE 'Phase 3b: created AEP plan v2026.1 id=%', v_aep_plan_id;
  END IF;

  -- 2b. AEP response agencies — typical Class III roster (6 agencies)
  INSERT INTO aep_response_agencies (
    base_id, agency_name, agency_role,
    primary_contact_name, primary_contact_phone, primary_contact_radio,
    backup_contact_name, backup_contact_phone,
    notes, sort_order, is_active
  ) VALUES
    (v_kdra_id, 'ARFF Engine 7',         'arff',            'Station 7 Captain',  '555-911-0007', 'VHF 154.220 / Ch. ARFF', NULL, NULL,
     'Activate via airport phone 911. Response < 3 min for RFFS index B.', 10, TRUE),
    (v_kdra_id, 'Springfield Fire Dept', 'mutual_aid_fire', 'Dispatch',           '555-911-1100', 'VHF 154.265 / Mutual Aid',
     'Battalion 3 Chief', '555-911-1101', 'Mutual-aid agreement on file; reference "Airport ARFF assist".', 20, TRUE),
    (v_kdra_id, 'County EMS',            'ems',             'Central Dispatch',   '555-911-2200', 'UHF 460.500 / EMS Med-9', NULL, NULL,
     'Primary ALS transport. Backup via Springfield Fire ALS.', 30, TRUE),
    (v_kdra_id, 'Mercy Hospital ED',     'hospital',        'ED Charge Nurse',    '555-911-9111', 'VHF 462.150 / Med-9',
     'Trauma Coordinator', '555-911-9112', 'Level III trauma center; helipad on roof. Notify on mass-casualty events.', 40, TRUE),
    (v_kdra_id, 'Demo Tower',            'atc',             'Tower Supervisor',   '555-911-3300', 'VHF 119.300 / Tower', NULL, NULL,
     'Tower hours 0600-2200L. After hours: FAA SOC.', 50, TRUE),
    (v_kdra_id, 'County Sheriff',        'police',          'County Dispatch',    '555-911-4400', 'UHF 460.150 / Sheriff Tac',
     'Watch Commander',  '555-911-4401', NULL, 60, TRUE)
  ON CONFLICT DO NOTHING;
  RAISE NOTICE 'Phase 3b: ensured 6 AEP response agencies';

  -- Pull a couple of agency ids for the drill participants snapshot
  SELECT id INTO v_aep_agency_arff FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'ARFF Engine 7';
  SELECT id INTO v_aep_agency_ems  FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'County EMS';
  SELECT id INTO v_aep_agency_hosp FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'Mercy Hospital ED';
  SELECT id INTO v_aep_agency_atc  FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'Demo Tower';

  -- 2c. AEP drill — 1 completed tabletop earlier this year per §139.325(j)
  INSERT INTO aep_drills (
    base_id, drill_date, drill_type, scenario, status,
    participants, after_action_notes, findings,
    completed_at, completed_by, created_by
  )
  SELECT
    v_kdra_id, '2026-03-18', 'tabletop',
    'Aircraft accident with mass-casualty event on RWY 01 midfield; medical surge to Mercy Hospital; perimeter coordination with County Sheriff.',
    'completed',
    jsonb_build_array(
      jsonb_build_object('agency_id', v_aep_agency_arff::text, 'agency_name', 'ARFF Engine 7',         'role', 'arff',     'attended', true),
      jsonb_build_object('agency_id', v_aep_agency_ems::text,  'agency_name', 'County EMS',            'role', 'ems',      'attended', true),
      jsonb_build_object('agency_id', v_aep_agency_hosp::text, 'agency_name', 'Mercy Hospital ED',     'role', 'hospital', 'attended', true),
      jsonb_build_object('agency_id', v_aep_agency_atc::text,  'agency_name', 'Demo Tower',            'role', 'atc',      'attended', true)
    ),
    'Worked through full mass-casualty decision tree end-to-end (~3 hours). Triage timing was within target. Comms relay between Mercy ED and ARFF Engine 7 had a 2-minute lag due to channel mismatch — resolved with revised channel assignments.',
    'Channel mismatch between Mercy ED radio and ARFF VHF — updated AEP radio plan to include ED dispatcher on VHF 462.150 simulcast. Next full-scale exercise scheduled for 2027 per §139.325(h).',
    '2026-03-18T15:30:00Z', v_demo_user, v_demo_user
  WHERE NOT EXISTS (
    SELECT 1 FROM aep_drills
     WHERE base_id = v_kdra_id AND drill_date = '2026-03-18' AND drill_type = 'tabletop'
  )
  RETURNING id INTO v_aep_drill_id;
  IF v_aep_drill_id IS NOT NULL THEN
    RAISE NOTICE 'Phase 3b: created 2026-03-18 tabletop drill id=%', v_aep_drill_id;
  END IF;

  -- ── 3. Phase 3d — 2 historical FCRs (winter snow event) ─────
  -- These are superseded historical records — no active FCR for "today".
  IF v_runway_id IS NOT NULL THEN

    -- 3a. Older FCR (RwyCC 3/3/3 dry snow, plowed)
    INSERT INTO field_condition_reports (
      base_id, runway_id, generated_at, generated_by, generated_by_oi,
      valid_until, temperature_f, treatments, notes, ficon_text
    )
    SELECT
      v_kdra_id, v_runway_id, '2026-02-08T12:48:00Z', v_demo_user, 'JD',
      '2026-02-08T18:00:00Z', 28, ARRAY['plowed'],
      'Initial morning assessment after overnight snow event. Plowing crews on rwy 01/19 since 0500L.',
      'RWY 01/19 3/3/3 100/100/100 PCT DRY SN 1.5IN TRTD W/PLOW'
    WHERE NOT EXISTS (
      SELECT 1 FROM field_condition_reports
       WHERE base_id = v_kdra_id AND runway_id = v_runway_id AND generated_at = '2026-02-08T12:48:00Z'
    );

    -- 3b. Mid-event FCR (rollout degrades, plowed + chem)
    INSERT INTO field_condition_reports (
      base_id, runway_id, generated_at, generated_by, generated_by_oi,
      valid_until, temperature_f, treatments, notes, ficon_text
    )
    SELECT
      v_kdra_id, v_runway_id, '2026-02-08T15:30:00Z', v_demo_user, 'JD',
      '2026-02-08T22:00:00Z', 31, ARRAY['plowed','chemically_treated'],
      'Rollout end accumulated wet snow despite plowing. Applied chemical treatment.',
      'RWY 01/19 3/3/2 100/100/100 PCT DRY SN WET SN 2.5IN TRTD W/PLOW W/CHEM'
    WHERE NOT EXISTS (
      SELECT 1 FROM field_condition_reports
       WHERE base_id = v_kdra_id AND runway_id = v_runway_id AND generated_at = '2026-02-08T15:30:00Z'
    );

    -- Insert per-third rows for both FCRs (idempotent via UNIQUE on
    -- (report_id, third) — re-runs are no-ops). Only insert if the
    -- report row exists and has no thirds yet.
    INSERT INTO field_condition_thirds (
      report_id, third, contaminant, depth_in, coverage_percent,
      rwycc, rwycc_derived, rwycc_manual_override, sort_order
    )
    SELECT r.id, t.third, t.contaminant, t.depth_in, t.coverage_percent,
           t.rwycc, t.rwycc, FALSE, t.sort_order
      FROM (VALUES
        ('2026-02-08T12:48:00Z'::timestamptz, 'touchdown'::text, 'dry_snow'::text, 1.5::numeric, 100, 3, 0),
        ('2026-02-08T12:48:00Z'::timestamptz, 'midpoint',        'dry_snow',       1.5,          100, 3, 1),
        ('2026-02-08T12:48:00Z'::timestamptz, 'rollout',         'dry_snow',       1.5,          100, 3, 2),
        ('2026-02-08T15:30:00Z'::timestamptz, 'touchdown',       'dry_snow',       1.5,          100, 3, 0),
        ('2026-02-08T15:30:00Z'::timestamptz, 'midpoint',        'dry_snow',       1.5,          100, 3, 1),
        ('2026-02-08T15:30:00Z'::timestamptz, 'rollout',         'wet_snow',       2.5,          100, 2, 2)
      ) AS t(generated_at, third, contaminant, depth_in, coverage_percent, rwycc, sort_order)
      JOIN field_condition_reports r ON r.base_id = v_kdra_id AND r.runway_id = v_runway_id AND r.generated_at = t.generated_at
     WHERE NOT EXISTS (
       SELECT 1 FROM field_condition_thirds ft WHERE ft.report_id = r.id AND ft.third = t.third
     );

    -- Back-fill the supersede pointer (older FCR → newer FCR)
    UPDATE field_condition_reports older
       SET superseded_by_id = newer.id
      FROM field_condition_reports newer
     WHERE older.base_id = v_kdra_id AND older.runway_id = v_runway_id
       AND older.generated_at = '2026-02-08T12:48:00Z'
       AND newer.base_id = v_kdra_id AND newer.runway_id = v_runway_id
       AND newer.generated_at = '2026-02-08T15:30:00Z'
       AND older.superseded_by_id IS NULL;

    RAISE NOTICE 'Phase 3d: ensured 2 historical FCRs (Feb 8 snow event)';
  END IF;

  -- ── 4. Phase 3e WHMP — 2026 assessment with 3 species + 2 findings ──
  INSERT INTO wildlife_hazard_assessments (
    base_id, assessment_year, performed_by_user_id, performed_by_external, performed_at,
    report_url, faa_accepted_at, faa_acceptance_ref,
    ae_user_id, ae_signed_at, last_reviewed_at, reviewed_by_user_id,
    hazardous_species, mitigation_summary, findings,
    notes, created_by
  )
  SELECT
    v_kdra_id, 2026, NULL, 'USDA Wildlife Services', '2026-09-15',
    'https://demo.glidepathops.com/sample-whmp-2026.pdf',
    '2026-10-04', 'ATL-WS-2026-04',
    v_demo_user, '2026-10-12T14:00:00Z', '2026-10-12T14:00:00Z', v_demo_user,
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'species', 'Canada Goose',
        'hazard_level', 'high',
        'attractants', jsonb_build_array('Standing water near RWY 01 threshold', 'Stormwater retention pond on east side'),
        'mitigations', jsonb_build_array('Weekly mowing during migration season', 'Pyrotechnic dispersal protocol', 'Coordination with USDA on lethal removal authorization')
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'species', 'Red-Tailed Hawk',
        'hazard_level', 'medium',
        'attractants', jsonb_build_array('Tall grass on east apron', 'Rodent population near hangar complex'),
        'mitigations', jsonb_build_array('Maintain grass height ≤ 6 inches', 'Quarterly rodent control')
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'species', 'White-Tailed Deer',
        'hazard_level', 'severe',
        'attractants', jsonb_build_array('Forested perimeter with deer trails', 'Crop fields on north boundary'),
        'mitigations', jsonb_build_array('8-foot perimeter fence inspection quarterly', 'Quarterly deer-track survey', 'Coordination with state wildlife on managed hunt program')
      )
    ),
    'Increased grass-cutting frequency to weekly between Apr-Oct (was biweekly). Added 2 propane cannons near runway 01 threshold for goose dispersal. USDA Wildlife Services on-call for goose removal events exceeding 25 birds. Monthly habitat survey by Operations Specialist. Perimeter fence inspections moved to quarterly cadence after deer-strike incident in 2025.',
    jsonb_build_array(
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'finding', 'Grass height exceeded 8 inches in May 2026 survey (target ≤ 6 inches)',
        'category', 'habitat',
        'recommended_action', 'Increase mowing cadence to weekly between Apr-Oct',
        'sms_hazard_id', NULL
      ),
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'finding', 'New stormwater detention pond installed 2026-08 east of RWY 01 — significant attractant for waterfowl',
        'category', 'infrastructure',
        'recommended_action', 'Coordinate with airport engineering for pond netting or relocation; meanwhile add 1 additional propane cannon at south end of pond',
        'sms_hazard_id', NULL
      )
    ),
    'Assessment performed by USDA WS biologist over 3 days (2026-09-13 to 09-15). Report filed with FAA Regional Office 2026-09-22; acceptance letter received 2026-10-04.',
    v_demo_user
  WHERE NOT EXISTS (
    SELECT 1 FROM wildlife_hazard_assessments
     WHERE base_id = v_kdra_id AND assessment_year = 2026
  )
  RETURNING id INTO v_whmp_id;
  IF v_whmp_id IS NOT NULL THEN
    RAISE NOTICE 'Phase 3e: created 2026 WHMP assessment id=%', v_whmp_id;
  END IF;

  RAISE NOTICE '=== KDRA Phase 3 demo data refresh complete ===';
END;
$$;
