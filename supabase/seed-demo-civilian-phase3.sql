-- ============================================================
-- KDRA (Demo Regional Airport) — Phase 2 + Phase 3 data refresh
--
-- Backfills the Demo Regional Airport with sample data so the demo
-- tour story is end-to-end across Phase 2 (SMS) and Phase 3:
--
--   3c — FAA approach type + category on each runway
--   3b — AEP plan + response agencies + 1 completed tabletop drill
--   3d — 2 historical FCRs (winter snow event narrative)
--   3e — 2026 WHMP assessment with 3 species + 2 findings
--   2  — 4 SMS hazards + assessments + mitigations + 1 internal audit
--   2  — 3 monthly AEP comms checks (Feb / Mar / Apr 2026)
--
-- Idempotent: re-running won't duplicate rows. Each section uses
-- ON CONFLICT or check-first-then-insert.
--
-- Run via:
--   npx supabase db query --linked --file supabase/seed-demo-civilian-phase3.sql
--
-- To reset demo data only (leaves base + runways intact):
--   DELETE FROM aep_plans                     WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM aep_response_agencies         WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM aep_drills                    WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM aep_comms_checks              WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM field_condition_reports       WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM wildlife_hazard_assessments   WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM sms_hazards                   WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
--   DELETE FROM sms_audits                    WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';
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
  v_aep_agency_police UUID;
  v_aep_agency_mutual UUID;
  v_aep_drill_id UUID;
  v_whmp_id UUID;
  v_haz_id UUID;
  v_haz_code TEXT;
  v_audit_id UUID;
  v_comms_check_id UUID;
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
  SELECT id INTO v_aep_agency_arff   FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'ARFF Engine 7';
  SELECT id INTO v_aep_agency_ems    FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'County EMS';
  SELECT id INTO v_aep_agency_hosp   FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'Mercy Hospital ED';
  SELECT id INTO v_aep_agency_atc    FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'Demo Tower';
  SELECT id INTO v_aep_agency_police FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'County Sheriff';
  SELECT id INTO v_aep_agency_mutual FROM aep_response_agencies WHERE base_id = v_kdra_id AND agency_name = 'Springfield Fire Dept';

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

  -- ── 5. Phase 2 SMS — 4 hazards + assessments + mitigations + 1 audit ──
  -- A small but representative hazard register so the SMS dashboard,
  -- hazard register, risk matrix, and SPI cards have content to render
  -- during pilot demos. Each insert is title-keyed for idempotency.

  -- 5a. Hazard #1 — wildlife strike recurring (sourced from WHMP)
  IF NOT EXISTS (SELECT 1 FROM sms_hazards WHERE base_id = v_kdra_id AND title = 'Recurring goose strikes on RWY 01 approach') THEN
    v_haz_code := _sms_next_code(v_kdra_id, 'HZ', 'sms_hazards');
    INSERT INTO sms_hazards (
      base_id, hazard_code, title, description,
      source_type, status, risk_owner_user_id,
      identified_by, identified_at, created_by
    ) VALUES (
      v_kdra_id, v_haz_code,
      'Recurring goose strikes on RWY 01 approach',
      'Three confirmed Canada Goose strikes on RWY 01 short final in the past 18 months. Stormwater retention pond on the east side acts as a year-round attractant; spring migration intensifies risk substantially.',
      'wildlife_strike', 'under_review', v_demo_user,
      v_demo_user, '2026-04-10T13:00:00Z', v_demo_user
    ) RETURNING id INTO v_haz_id;

    INSERT INTO sms_risk_assessments (
      hazard_id, base_id, assessed_at, assessed_by,
      likelihood, severity,
      residual_likelihood, residual_severity,
      likelihood_rationale, severity_rationale, notes
    ) VALUES (
      v_haz_id, v_kdra_id, '2026-04-12T15:00:00Z', v_demo_user,
      4, 4,
      2, 4,
      'Three strikes in 18 months at one threshold; geese present 9 months/year. Likelihood = Frequent (4).',
      'Engine ingestion at low altitude on final approach. Severity = Hazardous (4) — possible loss of aircraft if multiple engine ingestion.',
      'Residual likelihood drops to Remote (2) after habitat modification + pyrotechnic dispersal protocol; severity unchanged because the consequence path is intrinsic to the operation.'
    );

    INSERT INTO sms_mitigations (
      hazard_id, base_id, title, description,
      control_type, owner_user_id, due_date, status, completed_at, completed_by, created_by
    ) VALUES (
      v_haz_id, v_kdra_id,
      'Add 2nd propane cannon south of stormwater pond + weekly habitat sweep',
      'Operations crew to deploy additional propane cannon by 2026-05-15 and add a Friday habitat sweep on the cannon rotation. USDA Wildlife Services on-call for goose-removal events > 25 birds.',
      'engineering', v_demo_user, '2026-05-15', 'completed',
      '2026-05-14T18:00:00Z', v_demo_user, v_demo_user
    );

    RAISE NOTICE 'Phase 2 SMS: created hazard %', v_haz_code;
  END IF;

  -- 5b. Hazard #2 — apron pavement cracking (sourced from a discrepancy)
  IF NOT EXISTS (SELECT 1 FROM sms_hazards WHERE base_id = v_kdra_id AND title = 'Progressive transverse cracking on north apron') THEN
    v_haz_code := _sms_next_code(v_kdra_id, 'HZ', 'sms_hazards');
    INSERT INTO sms_hazards (
      base_id, hazard_code, title, description,
      source_type, status, risk_owner_user_id,
      identified_by, identified_at, created_by
    ) VALUES (
      v_kdra_id, v_haz_code,
      'Progressive transverse cracking on north apron',
      'Three transverse cracks > 1/2" wide along the north apron tie-down rows. FOD ejection risk increasing as winter freeze-thaw cycles propagate the cracks.',
      'discrepancy', 'controlled', v_demo_user,
      v_demo_user, '2026-02-22T10:00:00Z', v_demo_user
    ) RETURNING id INTO v_haz_id;

    INSERT INTO sms_risk_assessments (
      hazard_id, base_id, assessed_at, assessed_by,
      likelihood, severity,
      residual_likelihood, residual_severity,
      likelihood_rationale, severity_rationale, notes
    ) VALUES (
      v_haz_id, v_kdra_id, '2026-02-23T11:30:00Z', v_demo_user,
      3, 3,
      1, 3,
      'Occasional FOD events traceable to apron cracking — Likelihood = Occasional (3).',
      'FOD ingestion or tire damage — Severity = Major (3).',
      'After crack-sealing + biweekly apron sweep, likelihood drops to Improbable (1).'
    );

    INSERT INTO sms_mitigations (
      hazard_id, base_id, title, description,
      control_type, owner_user_id, due_date, status, completed_at, completed_by, created_by
    ) VALUES (
      v_haz_id, v_kdra_id,
      'Crack-seal all transverse cracks > 1/4" and add to FY26 mill-and-overlay scope',
      'Maintenance to crack-seal in next dry window. Engineering to add the north apron to the FY26 mill-and-overlay project envelope.',
      'engineering', v_demo_user, '2026-04-01', 'completed',
      '2026-03-28T16:00:00Z', v_demo_user, v_demo_user
    );

    RAISE NOTICE 'Phase 2 SMS: created hazard %', v_haz_code;
  END IF;

  -- 5c. Hazard #3 — taxiway lighting cluster outage (sourced from inspection)
  IF NOT EXISTS (SELECT 1 FROM sms_hazards WHERE base_id = v_kdra_id AND title = 'Clustered taxiway centerline outages on Taxiway A') THEN
    v_haz_code := _sms_next_code(v_kdra_id, 'HZ', 'sms_hazards');
    INSERT INTO sms_hazards (
      base_id, hazard_code, title, description,
      source_type, status, risk_owner_user_id,
      identified_by, identified_at, created_by
    ) VALUES (
      v_kdra_id, v_haz_code,
      'Clustered taxiway centerline outages on Taxiway A',
      'Multiple inspection cycles showing 4-6 adjacent centerline lights out near Taxiway A intersection with RWY 01. Pattern suggests buried cable damage rather than individual lamp failures.',
      'inspection', 'open', v_demo_user,
      v_demo_user, '2026-05-01T08:00:00Z', v_demo_user
    ) RETURNING id INTO v_haz_id;

    INSERT INTO sms_risk_assessments (
      hazard_id, base_id, assessed_at, assessed_by,
      likelihood, severity,
      residual_likelihood, residual_severity,
      likelihood_rationale, severity_rationale, notes
    ) VALUES (
      v_haz_id, v_kdra_id, '2026-05-02T13:00:00Z', v_demo_user,
      3, 3,
      2, 3,
      'Recurring outages observed across last 4 inspection cycles — Likelihood = Occasional (3).',
      'Centerline cues at night/low-vis are safety-critical for taxi routing — Severity = Major (3).',
      'After cable replacement (planned Q3) the residual likelihood drops to Remote (2).'
    );

    INSERT INTO sms_mitigations (
      hazard_id, base_id, title, description,
      control_type, owner_user_id, due_date, status, created_by
    ) VALUES (
      v_haz_id, v_kdra_id,
      'Targeted cable replacement segment between TWY A2 and A4',
      'CES electrical to scope cable replacement for the 4-light cluster. Interim: NOTAM published; affected taxi segment routed via TWY B at night.',
      'engineering', v_demo_user, '2026-08-15', 'in_progress',
      v_demo_user
    );

    RAISE NOTICE 'Phase 2 SMS: created hazard %', v_haz_code;
  END IF;

  -- 5d. Hazard #4 — wet-runway braking action (sourced from a pilot safety report)
  IF NOT EXISTS (SELECT 1 FROM sms_hazards WHERE base_id = v_kdra_id AND title = 'Wet-runway braking action reports below expected on RWY 19') THEN
    v_haz_code := _sms_next_code(v_kdra_id, 'HZ', 'sms_hazards');
    INSERT INTO sms_hazards (
      base_id, hazard_code, title, description,
      source_type, status, risk_owner_user_id,
      identified_by, identified_at, created_by
    ) VALUES (
      v_kdra_id, v_haz_code,
      'Wet-runway braking action reports below expected on RWY 19',
      'Two PIREPs from regional turboprop operators reporting wet braking action "fair" where "good" was expected. Last friction survey was 13 months ago; macrotexture may be degrading on the rollout third.',
      'safety_report', 'open', v_demo_user,
      v_demo_user, '2026-05-08T19:30:00Z', v_demo_user
    ) RETURNING id INTO v_haz_id;

    INSERT INTO sms_risk_assessments (
      hazard_id, base_id, assessed_at, assessed_by,
      likelihood, severity,
      likelihood_rationale, severity_rationale, notes
    ) VALUES (
      v_haz_id, v_kdra_id, '2026-05-09T10:00:00Z', v_demo_user,
      3, 3,
      'Two reports in 30 days; wet conditions ~40 days/year — Likelihood = Occasional (3).',
      'Runway excursion risk in adverse braking — Severity = Major (3).',
      'Awaiting friction survey results before sizing residual mitigation.'
    );

    INSERT INTO sms_mitigations (
      hazard_id, base_id, title, description,
      control_type, owner_user_id, due_date, status, created_by
    ) VALUES (
      v_haz_id, v_kdra_id,
      'Conduct CFME friction survey on RWY 19 and FICON if degraded',
      'Operations to schedule continuous-friction survey within 14 days. If µ < 0.5 over the rollout third in wet condition, issue FICON and request maintenance prioritization for grooving rejuvenation.',
      'administrative', v_demo_user, '2026-05-23', 'planned',
      v_demo_user
    );

    RAISE NOTICE 'Phase 2 SMS: created hazard %', v_haz_code;
  END IF;

  -- 5e. SMS audit — 1 completed internal audit (DAFMAN/AC 150/5200-37A §6.4)
  IF NOT EXISTS (SELECT 1 FROM sms_audits WHERE base_id = v_kdra_id AND title = 'Q1 2026 internal SMS audit') THEN
    INSERT INTO sms_audits (
      base_id, audit_code, title, audit_type, scope,
      scheduled_date, performed_date, performed_by, status,
      findings, findings_open, findings_closed,
      notes, created_by
    ) VALUES (
      v_kdra_id, _sms_next_code(v_kdra_id, 'AUD', 'sms_audits'),
      'Q1 2026 internal SMS audit', 'internal',
      'Sample of safety policy, SRM workflow, and hazard-to-mitigation traceability across the prior quarter.',
      '2026-03-25', '2026-04-08', v_demo_user, 'completed',
      jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'title', 'Hazard register lacks risk-owner assignment on 1 of 4 sampled hazards',
          'severity', 'minor',
          'status', 'closed',
          'closed_at', '2026-04-15',
          'notes', 'Closed after risk owner assigned within 7 days of finding.'
        ),
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'title', 'Mitigation due-date tracking inconsistent across SRM register and SPIs',
          'severity', 'observation',
          'status', 'closed',
          'closed_at', '2026-04-20',
          'notes', 'Closed after process note added to monthly SMS review checklist.'
        )
      ),
      0, 2,
      'Audit performed by ASO; both findings closed within 30 days. Next audit scheduled Q3 2026.',
      v_demo_user
    );
    RAISE NOTICE 'Phase 2 SMS: created Q1 2026 internal audit';
  END IF;

  -- ── 6. Phase 2 AEP comms checks — 3 monthly cycles backfilled ──
  -- Per AC 150/5200-31C §2.3 the airport runs periodic comms checks
  -- against the AEP response roster. Backfill the last 3 completed
  -- monthly cycles so the dashboard SPI feed has data (the cron picks
  -- up aep_comms_checks_last_90d on its next run).

  -- 6a. February 2026 — clean cycle (all loud_clear)
  IF NOT EXISTS (SELECT 1 FROM aep_comms_checks WHERE base_id = v_kdra_id AND check_date = '2026-02-15' AND check_period = 'monthly') THEN
    INSERT INTO aep_comms_checks (
      base_id, check_date, check_period, started_at, completed_at,
      completed_by, completed_by_oi, notes
    ) VALUES (
      v_kdra_id, '2026-02-15', 'monthly',
      '2026-02-15T14:00:00Z', '2026-02-15T14:35:00Z',
      v_demo_user, 'JD',
      'All agencies loud and clear. EMS dispatcher confirmed the revised channel from the March drill is now in their playbook.'
    ) RETURNING id INTO v_comms_check_id;

    INSERT INTO aep_comms_check_results (check_id, agency_id, agency_name, agency_role, status, notes, sort_order) VALUES
      (v_comms_check_id, v_aep_agency_arff,   'ARFF Engine 7',         'arff',            'loud_clear', NULL, 10),
      (v_comms_check_id, v_aep_agency_mutual, 'Springfield Fire Dept', 'mutual_aid_fire', 'loud_clear', NULL, 20),
      (v_comms_check_id, v_aep_agency_ems,    'County EMS',            'ems',             'loud_clear', NULL, 30),
      (v_comms_check_id, v_aep_agency_hosp,   'Mercy Hospital ED',     'hospital',        'loud_clear', NULL, 40),
      (v_comms_check_id, v_aep_agency_atc,    'Demo Tower',            'atc',             'loud_clear', NULL, 50),
      (v_comms_check_id, v_aep_agency_police, 'County Sheriff',        'police',          'loud_clear', NULL, 60);

    RAISE NOTICE 'Phase 2 AEP: created Feb 2026 comms check';
  END IF;

  -- 6b. March 2026 — Mercy Hospital no_response, retry next day
  IF NOT EXISTS (SELECT 1 FROM aep_comms_checks WHERE base_id = v_kdra_id AND check_date = '2026-03-15' AND check_period = 'monthly') THEN
    INSERT INTO aep_comms_checks (
      base_id, check_date, check_period, started_at, completed_at,
      completed_by, completed_by_oi, notes
    ) VALUES (
      v_kdra_id, '2026-03-15', 'monthly',
      '2026-03-15T14:00:00Z', '2026-03-15T14:45:00Z',
      v_demo_user, 'JD',
      'Mercy Hospital ED did not respond on Med-9 — confirmed via backup phone that ED radio was off-air for maintenance. Retried 2026-03-16 with successful loud-clear. AEP radio plan reviewed; no changes.'
    ) RETURNING id INTO v_comms_check_id;

    INSERT INTO aep_comms_check_results (check_id, agency_id, agency_name, agency_role, status, notes, sort_order) VALUES
      (v_comms_check_id, v_aep_agency_arff,   'ARFF Engine 7',         'arff',            'loud_clear',  NULL, 10),
      (v_comms_check_id, v_aep_agency_mutual, 'Springfield Fire Dept', 'mutual_aid_fire', 'loud_clear',  NULL, 20),
      (v_comms_check_id, v_aep_agency_ems,    'County EMS',            'ems',             'loud_clear',  NULL, 30),
      (v_comms_check_id, v_aep_agency_hosp,   'Mercy Hospital ED',     'hospital',        'no_response', 'Med-9 dead; confirmed via backup phone that radio was off-air for scheduled maintenance.', 40),
      (v_comms_check_id, v_aep_agency_atc,    'Demo Tower',            'atc',             'loud_clear',  NULL, 50),
      (v_comms_check_id, v_aep_agency_police, 'County Sheriff',        'police',          'loud_clear',  NULL, 60);

    RAISE NOTICE 'Phase 2 AEP: created Mar 2026 comms check';
  END IF;

  -- 6c. April 2026 — clean cycle
  IF NOT EXISTS (SELECT 1 FROM aep_comms_checks WHERE base_id = v_kdra_id AND check_date = '2026-04-15' AND check_period = 'monthly') THEN
    INSERT INTO aep_comms_checks (
      base_id, check_date, check_period, started_at, completed_at,
      completed_by, completed_by_oi, notes
    ) VALUES (
      v_kdra_id, '2026-04-15', 'monthly',
      '2026-04-15T14:00:00Z', '2026-04-15T14:30:00Z',
      v_demo_user, 'JD',
      'All loud and clear.'
    ) RETURNING id INTO v_comms_check_id;

    INSERT INTO aep_comms_check_results (check_id, agency_id, agency_name, agency_role, status, notes, sort_order) VALUES
      (v_comms_check_id, v_aep_agency_arff,   'ARFF Engine 7',         'arff',            'loud_clear', NULL, 10),
      (v_comms_check_id, v_aep_agency_mutual, 'Springfield Fire Dept', 'mutual_aid_fire', 'loud_clear', NULL, 20),
      (v_comms_check_id, v_aep_agency_ems,    'County EMS',            'ems',             'loud_clear', NULL, 30),
      (v_comms_check_id, v_aep_agency_hosp,   'Mercy Hospital ED',     'hospital',        'loud_clear', NULL, 40),
      (v_comms_check_id, v_aep_agency_atc,    'Demo Tower',            'atc',             'loud_clear', NULL, 50),
      (v_comms_check_id, v_aep_agency_police, 'County Sheriff',        'police',          'loud_clear', NULL, 60);

    RAISE NOTICE 'Phase 2 AEP: created Apr 2026 comms check';
  END IF;

  RAISE NOTICE '=== KDRA Phase 3 demo data refresh complete ===';
END;
$$;
