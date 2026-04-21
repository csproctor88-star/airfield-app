-- ============================================================
-- Seed Demo Walkthrough Data for KDMO Demo AFB
--
-- Adds rich, realistic content across every module that isn't
-- already exercised by seed-demo-base.sql / seed-demo-analytics.sql:
--
--   • Customer Feedback  — enable the module + 18 submissions
--   • SCN                — 8 agencies + 30 days Daily + 1 Monthly Back-up
--   • PPR Log            — 6 columns + 10 entries
--   • Waivers            — 4 waivers with criteria, reviews, coordination
--   • Obstructions       — 4 evaluations (2 violations)
--   • NOTAMs             — 5 local NOTAMs (active + expired)
--   • Shift Checklist    — 3 days of completions
--   • Daily Reviews      — 5 days (mix of fully certified and partial)
--   • Runway Status Log  — 8 recent runway/BWC/RSC changes (Daily Ops PDF)
--   • ARFF Status Log    — 6 recent ARFF category / aircraft readiness moves
--   • Discrepancies      — 15 fully-populated rows w/ lat/lng pins,
--                          assignment, work orders, ECD, resolution
--
-- Idempotent: re-running this file deletes the prior walkthrough
-- rows (identified by DEMO- prefix or seed marker) and reinserts.
--
-- Prereqs:
--   1. seed-demo-base.sql already run (creates Demo AFB + demo user)
--   2. (optional) seed-demo-analytics.sql already run
--
-- Run in Supabase SQL Editor.
-- ============================================================

DO $$
DECLARE
  demo_base UUID;
  demo_user UUID;
  -- Fixed UUIDs for the 3 custom feedback fields so inserts can
  -- reference them in the responses JSONB.
  fb_field_1 UUID := 'aaaaaaaa-0001-0001-0001-000000000001'; -- visit purpose (dropdown)
  fb_field_2 UUID := 'aaaaaaaa-0001-0001-0001-000000000002'; -- would recommend (yes_no)
  fb_field_3 UUID := 'aaaaaaaa-0001-0001-0001-000000000003'; -- services needed (text)
  -- Waiver UUIDs so reviews/criteria/coordination can reference them
  w1 UUID := 'bbbbbbbb-0001-0001-0001-000000000001';
  w2 UUID := 'bbbbbbbb-0001-0001-0001-000000000002';
  w3 UUID := 'bbbbbbbb-0001-0001-0001-000000000003';
  w4 UUID := 'bbbbbbbb-0001-0001-0001-000000000004';
  -- Shift checklist holders
  sc1 UUID; sc2 UUID; sc3 UUID;
  chk UUID;
BEGIN

  -- Resolve demo base + user
  SELECT id INTO demo_base FROM bases WHERE icao = 'KDMO' LIMIT 1;
  SELECT id INTO demo_user FROM profiles WHERE email = 'demo@glidepathops.com' LIMIT 1;
  IF demo_base IS NULL THEN RAISE EXCEPTION 'Demo base KDMO not found — run seed-demo-base.sql first'; END IF;
  IF demo_user IS NULL THEN RAISE EXCEPTION 'Demo user not found'; END IF;

  -- ══════════════════════════════════════════════════════════
  -- CLEANUP (safe re-run)
  -- ══════════════════════════════════════════════════════════
  DELETE FROM customer_feedback WHERE base_id = demo_base AND ip_hash = 'seed-walkthrough';
  DELETE FROM scn_checks WHERE base_id = demo_base;                       -- cascades scn_check_results
  DELETE FROM scn_agencies WHERE base_id = demo_base;
  DELETE FROM ppr_entries WHERE base_id = demo_base AND ppr_number LIKE 'DEMO-%';
  DELETE FROM ppr_columns WHERE base_id = demo_base;
  DELETE FROM waivers WHERE waiver_number LIKE 'DEMO-%';                  -- cascades reviews/criteria/coordination
  DELETE FROM obstruction_evaluations WHERE base_id = demo_base AND display_id LIKE 'DEMO-%';
  DELETE FROM notams WHERE base_id = demo_base AND notam_number LIKE 'DEMO-%';
  DELETE FROM shift_checklists WHERE base_id = demo_base;                 -- cascades shift_checklist_responses
  DELETE FROM daily_reviews WHERE base_id = demo_base;
  DELETE FROM runway_status_log WHERE changed_by = demo_user AND reason LIKE 'DEMO:%';
  DELETE FROM arff_status_log WHERE base_id = demo_base AND reason LIKE 'DEMO:%';
  DELETE FROM discrepancies WHERE base_id = demo_base AND display_id LIKE 'DEMO-W-DISC-%';

  -- ══════════════════════════════════════════════════════════
  -- A. CUSTOMER FEEDBACK — enable + 18 submissions
  -- ══════════════════════════════════════════════════════════
  UPDATE bases SET feedback_form_config = jsonb_build_object(
    'enabled', true,
    'title', 'Airfield Operations Feedback — ' || (SELECT name FROM bases WHERE id = demo_base),
    'description', 'Your feedback helps us improve transient aircrew support. Takes about 2 minutes.',
    'thank_you_message', 'Thank you — your feedback has been recorded.',
    'show_name', true,
    'show_email', true,
    'show_organization', true,
    'show_overall_rating', true,
    'fields', jsonb_build_array(
      jsonb_build_object('id', fb_field_1, 'label', 'Reason for visit', 'type', 'dropdown', 'required', false,
        'options', jsonb_build_array('Transient overnight','Training','Exercise','Fuel stop','Maintenance diversion','Other')),
      jsonb_build_object('id', fb_field_2, 'label', 'Would you recommend this airfield?', 'type', 'yes_no', 'required', false),
      jsonb_build_object('id', fb_field_3, 'label', 'Any services we should add or improve?', 'type', 'textarea', 'required', false)
    )
  ) WHERE id = demo_base;

  INSERT INTO customer_feedback (base_id, name, email, organization, overall_rating, comments, responses, submitted_at, ip_hash) VALUES
    (demo_base, 'Capt Elena Martinez',  'martinez.e@us.af.mil', '121st AW Rickenbacker', 5, 'Fast turn, friendly ops counter, fuel truck on-spot within 10 minutes of block-in. Will route through Demo AFB again.', jsonb_build_object(fb_field_1, 'Fuel stop', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '2 hours', 'seed-walkthrough'),
    (demo_base, 'MAJ D. Kowalski',      'dkowalski@us.army.mil', 'Army MEDEVAC 4-2',      5, 'Exceptional support for rotary MEDEVAC stopover. AMSL had fuel, ice, and a hot meal staged before we shut down.', jsonb_build_object(fb_field_1, 'Transient overnight', fb_field_2, 'Yes', fb_field_3, 'A crew rest space closer to parking would be perfect'), NOW() - interval '1 day', 'seed-walkthrough'),
    (demo_base, 'LT Priya Shah',        'priya.shah.navy@us.navy.mil', 'VFA-143 Pukin Dogs', 4, 'Good ramp handling on two F/A-18s. One comms glitch trying to reach AMOPS on 121.85 — had to route via tower.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'Yes', fb_field_3, 'Consider publishing the AMOPS freq on the AIP'), NOW() - interval '1 day 3 hours', 'seed-walkthrough'),
    (demo_base, 'Jenny Liang',          'jliang@natcadispatch.com', 'NATCA Dispatch',      4, 'Clear NOTAM info via the feedback QR itself is a nice touch. Needed it on arrival Sunday and it saved a call.', jsonb_build_object(fb_field_1, 'Other', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '2 days', 'seed-walkthrough'),
    (demo_base, 'SSgt Mike Bennett',    'bennett.m@us.af.mil',  '127th OSS',              3, 'Average experience — fuel was slow (45 min from call to completion). Parking crew were professional though.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'Maybe', fb_field_3, 'Improve fuel truck response time on weekends'), NOW() - interval '3 days', 'seed-walkthrough'),
    (demo_base, 'TSgt Aaron White',     'a.white.3@us.af.mil',  '911th AW Pittsburgh',    5, 'Smooth pitsop. C-17 crew was in/out in 90 minutes. Transient alert did exactly what we asked.', jsonb_build_object(fb_field_1, 'Fuel stop', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '3 days 6 hours', 'seed-walkthrough'),
    (demo_base, 'Maj T. Arnold',        'tarnold@ang.af.mil',   'ANG 180th FW',           2, 'Poor coverage on the ARFF cat changes — we arrived during a category drop and nobody advised on approach.', jsonb_build_object(fb_field_1, 'Exercise', fb_field_2, 'No', fb_field_3, 'Broadcast ARFF cat changes on CTAF, not just the ATIS'), NOW() - interval '4 days', 'seed-walkthrough'),
    (demo_base, 'Capt R. Jefferson',    'r.jefferson@us.af.mil','22 ARW McConnell',       5, 'Best airfield support on our whole trip. Mrs. Patterson at AMOPS was outstanding with PPR.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '5 days', 'seed-walkthrough'),
    (demo_base, 'Chris Tanner',         'ctanner@demo-civ.com', 'Netjets N712QS',         4, 'Professional handling. Lighting on the transient ramp at night could be brighter near row C.', jsonb_build_object(fb_field_1, 'Fuel stop', fb_field_2, 'Yes', fb_field_3, 'Row C ramp lights'), NOW() - interval '6 days', 'seed-walkthrough'),
    (demo_base, 'CDR Amy Winters',      'awinters@us.navy.mil', 'VR-62 Navy Reserve',     5, 'P-8 crew — easy in, easy out. The new PPR approval workflow was fast.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '7 days', 'seed-walkthrough'),
    (demo_base, 'Mike Reeves',          'reeves@flexjet.com',   'Flexjet N921FX',         3, 'Fine, nothing special. Expected an FBO-style lounge that wasn''t there.', jsonb_build_object(fb_field_1, 'Fuel stop', fb_field_2, 'Maybe', fb_field_3, 'A small transient lounge would help'), NOW() - interval '9 days', 'seed-walkthrough'),
    (demo_base, 'Lt Col B. Hardaway',   'b.hardaway@us.af.mil', '445th AW Wright-Patt',   5, 'C-17 cargo-only transit. Everything worked on first call. Ops plotted our PPR in under 30 minutes.', jsonb_build_object(fb_field_1, 'Other', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '10 days', 'seed-walkthrough'),
    (demo_base, '1Lt K. Osei',          'k.osei@us.af.mil',     '107th AW Niagara Falls', 4, 'Good overall. Deer on the field during dusk run-up — wildlife team responded in under 5 min.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'Yes', fb_field_3, 'Dusk wildlife patrol'), NOW() - interval '12 days', 'seed-walkthrough'),
    (demo_base, 'SSG A. Baldwin',       'anthony.baldwin@us.army.mil', 'Army 160th SOAR', 5, 'Quiet night ops, no issues. Good comms with AMOPS throughout.', jsonb_build_object(fb_field_1, 'Exercise', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '13 days', 'seed-walkthrough'),
    (demo_base, 'Kara Whitfield',       'kwhitfield@jsx.com',   'JSX Part 135 Charter',   4, 'Solid service. Only gripe: the PPR phone number in ForeFlight was outdated — should be (XXX) 555-4477.', jsonb_build_object(fb_field_1, 'Fuel stop', fb_field_2, 'Yes', fb_field_3, 'Update PPR contact in FlightAware/ForeFlight'), NOW() - interval '15 days', 'seed-walkthrough'),
    (demo_base, 'Maj S. Okafor',        's.okafor@us.af.mil',   '916th ARW Seymour Johnson', 2, 'Arrival was rough — taxi instructions conflicted between tower and ops, had to stop twice.', jsonb_build_object(fb_field_1, 'Training', fb_field_2, 'No', fb_field_3, 'Tower/AMOPS coordination on taxi routing'), NOW() - interval '18 days', 'seed-walkthrough'),
    (demo_base, 'CW3 D. Fields',        'd.fields@us.army.mil', 'Army NG Aviation',       5, 'UH-60 crew — perfect stop, no complaints. AMSL even had a weather brief printed.', jsonb_build_object(fb_field_1, 'Transient overnight', fb_field_2, 'Yes', fb_field_3, ''), NOW() - interval '22 days', 'seed-walkthrough'),
    (demo_base, 'Rebecca Yu',           'r.yu@tempus-aero.com', 'Tempus Air Ambulance',   4, 'MEDEVAC diversion — professional handling. Would appreciate an after-hours contact on the AIP.', jsonb_build_object(fb_field_1, 'Maintenance diversion', fb_field_2, 'Yes', fb_field_3, 'Publish after-hours phone'), NOW() - interval '27 days', 'seed-walkthrough');

  -- ══════════════════════════════════════════════════════════
  -- C. SCN AGENCIES + D. DAILY/MONTHLY CHECKS
  -- ══════════════════════════════════════════════════════════
  INSERT INTO scn_agencies (base_id, agency_name, sort_order, is_active) VALUES
    (demo_base, 'Control Tower',      1, true),
    (demo_base, 'Fire Department',    2, true),
    (demo_base, 'Base Ops / AMOPS',   3, true),
    (demo_base, 'Security Forces',    4, true),
    (demo_base, 'Medical / Clinic',   5, true),
    (demo_base, 'Command Post',       6, true),
    (demo_base, 'Weather Flight',     7, true),
    (demo_base, 'Safety Office',      8, true);

  -- 30 days of Daily SCN checks with mostly loud_clear + occasional exception
  FOR i IN 0..29 LOOP
    INSERT INTO scn_checks (base_id, check_date, check_type, started_at, completed_at, completed_by, completed_by_oi)
    VALUES (
      demo_base,
      CURRENT_DATE - i,
      'primary',
      (CURRENT_DATE - i)::timestamp + interval '7 hours' + (i * 3 % 15) * interval '1 minute',
      (CURRENT_DATE - i)::timestamp + interval '7 hours' + (i * 3 % 15 + 4) * interval '1 minute',
      demo_user,
      'AFM'
    )
    RETURNING id INTO chk;

    -- Results: 8 agencies, mostly loud_clear. Inject a realistic exception on ~15% of days.
    INSERT INTO scn_check_results (check_id, agency_id, agency_name, status, notes, sort_order)
    SELECT chk, a.id, a.agency_name,
      CASE
        WHEN i % 7 = 0 AND a.agency_name = 'Weather Flight' THEN 'no_response'
        WHEN i % 11 = 0 AND a.agency_name = 'Medical / Clinic' THEN 'oos'
        WHEN i % 13 = 0 AND a.agency_name = 'Safety Office' THEN 'no_response'
        ELSE 'loud_clear'
      END,
      CASE
        WHEN i % 11 = 0 AND a.agency_name = 'Medical / Clinic' THEN 'Radio in shop — contacted via landline, confirmed ready'
        ELSE NULL
      END,
      a.sort_order
    FROM scn_agencies a
    WHERE a.base_id = demo_base;
  END LOOP;

  -- One Monthly Back-up SCN check (this month, yesterday)
  INSERT INTO scn_checks (base_id, check_date, check_type, started_at, completed_at, completed_by, completed_by_oi, notes)
  VALUES (
    demo_base, CURRENT_DATE - 1, 'backup',
    (CURRENT_DATE - 1)::timestamp + interval '9 hours',
    (CURRENT_DATE - 1)::timestamp + interval '9 hours 12 minutes',
    demo_user, 'AFM',
    'Back-up landline net — all agencies verified.'
  )
  RETURNING id INTO chk;

  INSERT INTO scn_check_results (check_id, agency_id, agency_name, status, sort_order)
  SELECT chk, a.id, a.agency_name, 'loud_clear', a.sort_order
  FROM scn_agencies a
  WHERE a.base_id = demo_base;

  -- ══════════════════════════════════════════════════════════
  -- E. PPR COLUMNS + F. ENTRIES
  -- ══════════════════════════════════════════════════════════
  INSERT INTO ppr_columns (base_id, column_name, column_type, is_required, sort_order) VALUES
    (demo_base, 'Aircraft Type',   'text',   true,  1),
    (demo_base, 'Tail Number',     'text',   true,  2),
    (demo_base, 'Origin',          'text',   false, 3),
    (demo_base, 'Departure Date',  'date',   false, 4),
    (demo_base, 'Crew POC Phone',  'phone',  false, 5),
    (demo_base, 'Billeting Req?',  'yes_no_na', false, 6);

  INSERT INTO ppr_entries (base_id, ppr_number, arrival_date, column_values, notes, approver_oi, created_by, created_at) VALUES
    (demo_base, 'DEMO-PPR-0001', CURRENT_DATE + 1, jsonb_build_object('Aircraft Type','C-17A','Tail Number','07-7171','Origin','KCHS','Departure Date', (CURRENT_DATE + 2)::text, 'Crew POC Phone','(843) 555-0112','Billeting Req?','Yes'), 'Cargo mission — routine stop', 'AFM', demo_user, NOW() - interval '6 hours'),
    (demo_base, 'DEMO-PPR-0002', CURRENT_DATE + 1, jsonb_build_object('Aircraft Type','KC-135R','Tail Number','58-0100','Origin','KDOV','Departure Date', (CURRENT_DATE + 1)::text, 'Crew POC Phone','(302) 555-0133','Billeting Req?','No'), 'Tanker — quick turn, no billeting', 'AFM', demo_user, NOW() - interval '1 day'),
    (demo_base, 'DEMO-PPR-0003', CURRENT_DATE + 2, jsonb_build_object('Aircraft Type','F-16C','Tail Number','89-2008','Origin','KHIF','Departure Date', (CURRENT_DATE + 3)::text, 'Crew POC Phone','(801) 555-0188','Billeting Req?','Yes'), 'Ferry — 2 ships overnight', 'NAMO', demo_user, NOW() - interval '2 days'),
    (demo_base, 'DEMO-PPR-0004', CURRENT_DATE,     jsonb_build_object('Aircraft Type','UH-60M','Tail Number','20-21234','Origin','KADW','Departure Date', CURRENT_DATE::text, 'Crew POC Phone','(240) 555-0199','Billeting Req?','N/A'), 'Short stop — fuel only', 'AFM', demo_user, NOW() - interval '8 hours'),
    (demo_base, 'DEMO-PPR-0005', CURRENT_DATE - 1, jsonb_build_object('Aircraft Type','C-130J','Tail Number','09-6211','Origin','KPOB','Departure Date', (CURRENT_DATE - 1)::text, 'Crew POC Phone','(910) 555-0144','Billeting Req?','No'), 'Training diversion', 'AFM', demo_user, NOW() - interval '2 days'),
    (demo_base, 'DEMO-PPR-0006', CURRENT_DATE - 3, jsonb_build_object('Aircraft Type','Citation XLS','Tail Number','N712QS','Origin','KTEB','Departure Date', (CURRENT_DATE - 3)::text, 'Crew POC Phone','(201) 555-0122','Billeting Req?','N/A'), 'NetJets civilian — approved DV list', 'NAMO', demo_user, NOW() - interval '4 days'),
    (demo_base, 'DEMO-PPR-0007', CURRENT_DATE - 5, jsonb_build_object('Aircraft Type','C-5M','Tail Number','87-0030','Origin','KDOV','Departure Date', (CURRENT_DATE - 5)::text, 'Crew POC Phone','(302) 555-0166','Billeting Req?','Yes'), 'Heavy — prepositioning for exercise', 'AFM', demo_user, NOW() - interval '6 days'),
    (demo_base, 'DEMO-PPR-0008', CURRENT_DATE - 8, jsonb_build_object('Aircraft Type','A-10C','Tail Number','80-0190','Origin','KMTC','Departure Date', (CURRENT_DATE - 8)::text, 'Crew POC Phone','(586) 555-0177','Billeting Req?','No'), 'Cross-country training', 'AFM', demo_user, NOW() - interval '9 days'),
    (demo_base, 'DEMO-PPR-0009', CURRENT_DATE - 12, jsonb_build_object('Aircraft Type','P-8A','Tail Number','168854','Origin','KNUW','Departure Date', (CURRENT_DATE - 12)::text, 'Crew POC Phone','(360) 555-0155','Billeting Req?','Yes'), 'Navy Maritime Patrol — 2 nights', 'AFM', demo_user, NOW() - interval '13 days'),
    (demo_base, 'DEMO-PPR-0010', CURRENT_DATE - 20, jsonb_build_object('Aircraft Type','KC-46A','Tail Number','19-46060','Origin','KIKK','Departure Date', (CURRENT_DATE - 20)::text, 'Crew POC Phone','(316) 555-0123','Billeting Req?','No'), 'Fuel + quick turn', 'AFM', demo_user, NOW() - interval '21 days');

  -- ══════════════════════════════════════════════════════════
  -- G. WAIVERS (4) + criteria + reviews + coordination
  -- ══════════════════════════════════════════════════════════
  INSERT INTO waivers (id, base_id, waiver_number, classification, status, hazard_rating, action_requested,
    description, justification, risk_assessment_summary, corrective_action, criteria_impact,
    proponent, project_number, period_valid, date_submitted, date_approved, expiration_date,
    last_reviewed_date, next_review_due, location_description, notes, created_by, created_at) VALUES
    (w1, demo_base, 'DEMO-WV-2024-001', 'permanent', 'active', 'low', 'new',
      'Taxiway B centerline offset — 4ft east of UFC 3-260-01 standard due to legacy pavement layout',
      'Relocating would require full mill-and-overlay estimated at $4.2M with 18-month airfield closure',
      'Low — taxi ops continue normally with painted guidance; no incidents in 12 years',
      'Enhanced painted centerline + reflective markers; annual pavement assessment',
      'UFC 3-260-01 para 4-5.3.2 — centerline alignment',
      '127th OSS / Civil Engineer', 'FY19-PROJ-0042', 'Permanent', CURRENT_DATE - 365*6, CURRENT_DATE - 365*6 + 60,
      CURRENT_DATE + 365*4, CURRENT_DATE - 30, CURRENT_DATE + 335,
      'TWY B between A4 and B2', 'Reviewed annually per DAFMAN 13-204v2', demo_user, NOW() - interval '6 years'),
    (w2, demo_base, 'DEMO-WV-2024-002', 'temporary', 'active', 'medium', 'new',
      'Temporary hangar 204 relocation — structure 38ft tall within horizontal surface',
      'Supporting 2026 Operation Sentinel Shield exercise — deconstruction scheduled Oct 2026',
      'Medium — notched horizontal surface, coordinated with ATC and TERPS; no pattern conflict',
      'NOTAM issued; lit obstruction lighting 24/7; daily wildlife/FOD check in vicinity',
      'UFC 3-260-01 Ch 3 — horizontal surface penetration',
      'Wing Plans / 127th CES', 'EX-2026-SS-11', '18 months', CURRENT_DATE - 60, CURRENT_DATE - 45,
      CURRENT_DATE + 365, CURRENT_DATE - 30, CURRENT_DATE + 335,
      'Hangar Row — position 204', 'Obstruction lighting inspection logged weekly', demo_user, NOW() - interval '65 days'),
    (w3, demo_base, 'DEMO-WV-2024-003', 'construction', 'active', 'high', 'extension',
      'Crane operation RWY 01 approach — construction of new ILS shelter',
      'Originally 90-day waiver expired; project delayed due to supply chain (ILS controller backorder)',
      'High — 65ft crane within primary surface transition, mitigated by NOTAM + daylight-only ops',
      'Crane down at night; NOTAM active; TERPS non-standard approach plate issued',
      'UFC 3-260-01 Ch 3 — primary/transitional surface',
      '127th CES / Contractor Hensel Phelps', 'MP-2025-ILS-01', '60 days',
      CURRENT_DATE - 110, CURRENT_DATE - 105, CURRENT_DATE + 30,
      CURRENT_DATE - 7, CURRENT_DATE + 335,
      'RWY 01 approach — 2,800ft from threshold', 'Daily crane-down confirmation by AMOPS', demo_user, NOW() - interval '112 days'),
    (w4, demo_base, 'DEMO-WV-2024-004', 'temporary', 'expired', 'low', 'new',
      'Wildlife attractant — retention pond south of field exceeds 1,500ft buffer',
      'Pond scheduled for drainage under FY24 BASH mitigation project — completed Jan 2026',
      'Low — bird counts trending down per wildlife log; active hazing program in place',
      'Daily wildlife patrol; pyrotechnic hazing on sighting; monthly counts reviewed',
      'DAFMAN 91-212 para 4.3 — BASH buffer zones',
      'Wing Safety / CE Environmental', 'BASH-MIT-FY24', '12 months',
      CURRENT_DATE - 400, CURRENT_DATE - 395, CURRENT_DATE - 35,
      CURRENT_DATE - 90, CURRENT_DATE + 275,
      'Retention pond south — 1,200ft from TWY A', 'Closed out — pond drained', demo_user, NOW() - interval '13 months');

  INSERT INTO waiver_criteria (waiver_id, criteria_source, reference, description, sort_order) VALUES
    (w1, 'ufc_3_260_01', 'Ch 4 para 4-5.3.2', 'Taxiway centerline alignment tolerance', 1),
    (w2, 'ufc_3_260_01', 'Ch 3 para 3-3.2',   'Horizontal imaginary surface — 150ft above established airport elevation', 1),
    (w3, 'ufc_3_260_01', 'Ch 3 para 3-3.1',   'Primary surface — extends 200ft beyond each runway end', 1),
    (w3, 'ufc_3_260_01', 'Ch 3 para 3-3.4',   'Transitional surface — slopes 7:1 from primary surface edges', 2),
    (w4, 'other',        'DAFMAN 91-212 para 4.3', 'BASH — wildlife attractant buffer distances', 1);

  INSERT INTO waiver_reviews (waiver_id, review_year, review_date, reviewed_by, recommendation, mitigation_verified, notes, presented_to_facilities_board, facilities_board_date) VALUES
    (w1, EXTRACT(YEAR FROM CURRENT_DATE)::int,     CURRENT_DATE - 30, demo_user, 'retain', true, 'No change — continue annual painted centerline touch-ups', true, CURRENT_DATE - 25),
    (w1, EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, CURRENT_DATE - 395, demo_user, 'retain', true, 'Annual review — no incidents', true, CURRENT_DATE - 390),
    (w2, EXTRACT(YEAR FROM CURRENT_DATE)::int,     CURRENT_DATE - 30, demo_user, 'retain', true, 'Temp waiver, on-track for Oct 2026 close-out', false, NULL),
    (w3, EXTRACT(YEAR FROM CURRENT_DATE)::int,     CURRENT_DATE - 7,  demo_user, 'modify', true, 'Extension approved — new expiration date locked in', true, CURRENT_DATE - 5),
    (w4, EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, CURRENT_DATE - 90, demo_user, 'cancel', true, 'Pond drainage complete — waiver closed at expiration', true, CURRENT_DATE - 85);

  INSERT INTO waiver_coordination (waiver_id, office, office_label, coordinator_name, coordinated_date, status, comments) VALUES
    (w1, 'civil_engineer',      'CE',      'Mr. R. Parker',     CURRENT_DATE - 28, 'concur',     'Concur — maintain painted markings'),
    (w1, 'airfield_manager',    'AFM',     'Demo User',         CURRENT_DATE - 28, 'concur',     'Concur'),
    (w1, 'airfield_ops_terps',  'AO/TERPS','Capt J. Liang',     CURRENT_DATE - 28, 'concur',     'No TERPS impact'),
    (w2, 'civil_engineer',      'CE',      'Mr. R. Parker',     CURRENT_DATE - 46, 'concur',     'Concur w/ obstruction lighting'),
    (w2, 'airfield_ops_terps',  'AO/TERPS','Capt J. Liang',     CURRENT_DATE - 46, 'concur',     'NOTAM issued'),
    (w3, 'civil_engineer',      'CE',      'Mr. R. Parker',     CURRENT_DATE - 6,  'concur',     'Extension concurred'),
    (w3, 'base_safety',         'SE',      'MSgt T. Arnold',    CURRENT_DATE - 6,  'non_concur', 'Prefer accelerated completion'),
    (w3, 'airfield_ops_terps',  'AO/TERPS','Capt J. Liang',     CURRENT_DATE - 6,  'concur',     'Non-std approach plate current');

  -- ══════════════════════════════════════════════════════════
  -- H. OBSTRUCTIONS (4 evaluations)
  -- ══════════════════════════════════════════════════════════
  INSERT INTO obstruction_evaluations (base_id, display_id, runway_class, object_height_agl, object_distance_ft,
    distance_from_centerline_ft, object_elevation_msl, obstruction_top_msl, latitude, longitude,
    description, results, controlling_surface, violated_surfaces, has_violation, evaluated_by, notes, created_at) VALUES
    (demo_base, 'DEMO-OBS-001', 'B', 38.0, 3800, 480, 581, 619, 42.614, -82.834,
      'Temporary hangar 204 — 2026 Sentinel Shield exercise', '[]'::jsonb,
      'horizontal', ARRAY['horizontal']::text[], true, demo_user,
      'Covered under DEMO-WV-2024-002. Obstruction lit 24/7.', NOW() - interval '62 days'),
    (demo_base, 'DEMO-OBS-002', 'B', 65.0, 2800, 0, 590, 655, 42.618, -82.830,
      'Construction crane — ILS shelter build, RWY 01 approach', '[]'::jsonb,
      'primary', ARRAY['primary','transitional']::text[], true, demo_user,
      'Covered under DEMO-WV-2024-003. Crane down during darkness.', NOW() - interval '112 days'),
    (demo_base, 'DEMO-OBS-003', 'B', 22.0, 4200, 720, 579, 601, 42.612, -82.840,
      'New perimeter light pole — FY26 security upgrade', '[]'::jsonb,
      'none', ARRAY[]::text[], false, demo_user,
      'No surface penetration. Logged for reference.', NOW() - interval '45 days'),
    (demo_base, 'DEMO-OBS-004', 'A', 15.0, 3500, 380, 578, 593, 42.610, -82.836,
      'Tree line south of RWY 01/19 — grounds keeping trimmed back', '[]'::jsonb,
      'none', ARRAY[]::text[], false, demo_user,
      'Trimmed to 15ft — within acceptable height. No action required.', NOW() - interval '20 days');

  -- ══════════════════════════════════════════════════════════
  -- I. NOTAMS (5 local — mix active + expired)
  -- ══════════════════════════════════════════════════════════
  INSERT INTO notams (base_id, notam_number, source, status, notam_type, title, full_text,
    effective_start, effective_end, created_by, created_at) VALUES
    (demo_base, 'DEMO-L-001', 'local', 'active', 'Construction',
      'Crane Operation RWY 01 Approach',
      '!KDMO 01/001 KDMO CRANE 65FT AGL WI 2800FT NE OF RWY 01 THR LGTD. DLY 2300-1100Z. EXP 2026-'||to_char(CURRENT_DATE+30,'MM-DD'),
      CURRENT_DATE - 100, CURRENT_DATE + 30, demo_user, NOW() - interval '100 days'),
    (demo_base, 'DEMO-L-002', 'local', 'active', 'Taxiway',
      'TWY B CL OFFSET 4FT EAST STDS',
      '!KDMO 01/002 KDMO TWY B CL OFFSET 4FT EAST OF STDS BTN A4 AND B2. PERM.',
      CURRENT_DATE - 365*6, NULL, demo_user, NOW() - interval '6 years'),
    (demo_base, 'DEMO-L-003', 'local', 'active', 'Wildlife',
      'WILDLIFE ACTIVITY VCNTY AFLD',
      '!KDMO 01/003 KDMO WILDLIFE ACTY DEER/GEESE VCNTY AFLD DSK-DWN DLY.',
      CURRENT_DATE - 14, CURRENT_DATE + 16, demo_user, NOW() - interval '14 days'),
    (demo_base, 'DEMO-L-004', 'local', 'expired', 'Other',
      'Retention Pond Drainage Project',
      '!KDMO 01/004 KDMO HVY EQUIP VCNTY RETENTION POND S OF TWY A. DLY 1200-2200Z.',
      CURRENT_DATE - 120, CURRENT_DATE - 30, demo_user, NOW() - interval '120 days'),
    (demo_base, 'DEMO-L-005', 'local', 'active', 'Lighting',
      'ALSF-2 BAR 3 LAMP #2 RESTORED',
      '!KDMO 01/005 KDMO ALSF-2 RWY 01 ALL LAMPS OPS. PREV OTS 2026-'||to_char(CURRENT_DATE-20,'MM-DD')||'.',
      CURRENT_DATE - 20, CURRENT_DATE + 15, demo_user, NOW() - interval '20 days');

  -- ══════════════════════════════════════════════════════════
  -- J. SHIFT CHECKLIST — 3 days of completions
  -- ══════════════════════════════════════════════════════════
  INSERT INTO shift_checklists (base_id, checklist_date, status, completed_by, completed_at)
  VALUES (demo_base, CURRENT_DATE,     'in_progress', demo_user, NULL) RETURNING id INTO sc1;
  INSERT INTO shift_checklists (base_id, checklist_date, status, completed_by, completed_at)
  VALUES (demo_base, CURRENT_DATE - 1, 'completed',   demo_user, (CURRENT_DATE - 1)::timestamp + interval '22 hours') RETURNING id INTO sc2;
  INSERT INTO shift_checklists (base_id, checklist_date, status, completed_by, completed_at)
  VALUES (demo_base, CURRENT_DATE - 2, 'completed',   demo_user, (CURRENT_DATE - 2)::timestamp + interval '22 hours') RETURNING id INTO sc3;

  -- Mark 70% of today's items complete, 100% of prior two days
  INSERT INTO shift_checklist_responses (checklist_id, item_id, completed, completed_by, completed_at)
  SELECT sc1, i.id, (random() < 0.7), demo_user,
    CASE WHEN random() < 0.7 THEN NOW() - (random() * interval '6 hours') ELSE NULL END
  FROM shift_checklist_items i
  WHERE i.base_id = demo_base AND i.is_active = true AND i.frequency = 'daily';

  INSERT INTO shift_checklist_responses (checklist_id, item_id, completed, completed_by, completed_at)
  SELECT sc2, i.id, true, demo_user, (CURRENT_DATE - 1)::timestamp + interval '10 hours' + (random() * interval '12 hours')
  FROM shift_checklist_items i
  WHERE i.base_id = demo_base AND i.is_active = true AND i.frequency = 'daily';

  INSERT INTO shift_checklist_responses (checklist_id, item_id, completed, completed_by, completed_at)
  SELECT sc3, i.id, true, demo_user, (CURRENT_DATE - 2)::timestamp + interval '10 hours' + (random() * interval '12 hours')
  FROM shift_checklist_items i
  WHERE i.base_id = demo_base AND i.is_active = true AND i.frequency = 'daily';

  -- ══════════════════════════════════════════════════════════
  -- K. DAILY REVIEWS — 5 days (mix of fully certified + partial)
  -- ══════════════════════════════════════════════════════════
  -- Day -4 through -2: fully certified (all AMSL shifts + NAMO + AFM signed)
  INSERT INTO daily_reviews (base_id, review_date,
    day_amsl_signed_by, day_amsl_signed_at,
    swing_amsl_signed_by, swing_amsl_signed_at,
    mid_amsl_signed_by, mid_amsl_signed_at,
    namo_signed_by, namo_signed_at,
    afm_signed_by, afm_signed_at,
    fully_certified_at)
  VALUES
    (demo_base, CURRENT_DATE - 4,
      demo_user, (CURRENT_DATE - 3)::timestamp + interval '06 hours',
      demo_user, (CURRENT_DATE - 3)::timestamp + interval '14 hours',
      demo_user, (CURRENT_DATE - 3)::timestamp + interval '22 hours',
      demo_user, (CURRENT_DATE - 3)::timestamp + interval '09 hours',
      demo_user, (CURRENT_DATE - 3)::timestamp + interval '16 hours',
      (CURRENT_DATE - 3)::timestamp + interval '22 hours'),
    (demo_base, CURRENT_DATE - 3,
      demo_user, (CURRENT_DATE - 2)::timestamp + interval '06 hours',
      demo_user, (CURRENT_DATE - 2)::timestamp + interval '14 hours',
      demo_user, (CURRENT_DATE - 2)::timestamp + interval '22 hours',
      demo_user, (CURRENT_DATE - 2)::timestamp + interval '09 hours',
      demo_user, (CURRENT_DATE - 2)::timestamp + interval '16 hours',
      (CURRENT_DATE - 2)::timestamp + interval '22 hours'),
    (demo_base, CURRENT_DATE - 2,
      demo_user, (CURRENT_DATE - 1)::timestamp + interval '06 hours',
      demo_user, (CURRENT_DATE - 1)::timestamp + interval '14 hours',
      demo_user, (CURRENT_DATE - 1)::timestamp + interval '22 hours',
      demo_user, (CURRENT_DATE - 1)::timestamp + interval '09 hours',
      demo_user, (CURRENT_DATE - 1)::timestamp + interval '16 hours',
      (CURRENT_DATE - 1)::timestamp + interval '22 hours');

  -- Day -1: partial — AMSL shifts signed, NAMO signed, AFM not yet
  INSERT INTO daily_reviews (base_id, review_date,
    day_amsl_signed_by, day_amsl_signed_at,
    swing_amsl_signed_by, swing_amsl_signed_at,
    mid_amsl_signed_by, mid_amsl_signed_at,
    namo_signed_by, namo_signed_at)
  VALUES
    (demo_base, CURRENT_DATE - 1,
      demo_user, CURRENT_DATE::timestamp + interval '06 hours',
      demo_user, CURRENT_DATE::timestamp + interval '14 hours',
      demo_user, CURRENT_DATE::timestamp + interval '22 hours',
      demo_user, CURRENT_DATE::timestamp + interval '09 hours');

  -- Today: just day AMSL signed so far
  INSERT INTO daily_reviews (base_id, review_date,
    day_amsl_signed_by, day_amsl_signed_at)
  VALUES
    (demo_base, CURRENT_DATE, demo_user, NOW() - interval '2 hours');

  -- ══════════════════════════════════════════════════════════
  -- L. RUNWAY STATUS LOG — 8 recent changes (for Daily Ops PDF)
  -- ══════════════════════════════════════════════════════════
  INSERT INTO runway_status_log (old_runway_status, new_runway_status, old_active_runway, new_active_runway,
    old_advisory_type, new_advisory_type, old_advisory_text, new_advisory_text,
    changed_by, reason, created_at) VALUES
    ('open','closed',     '01','01', NULL,'closed',     NULL, 'RWY 01/19 closed for sweep',        demo_user, 'DEMO: FOD walk',                 NOW() - interval '6 hours'),
    ('closed','open',     '01','01', 'closed', NULL,    'RWY 01/19 closed for sweep', NULL,        demo_user, 'DEMO: FOD walk complete',        NOW() - interval '5 hours 20 minutes'),
    ('open','open',       '01','19', NULL, NULL,        NULL, NULL,                                demo_user, 'DEMO: Wind shift — active runway change',    NOW() - interval '3 hours'),
    ('open','restricted', '19','19', NULL,'advisory',   NULL, 'BWC MOD — fresh snow 0.5in',        demo_user, 'DEMO: Snow event arrival',       NOW() - interval '1 day 4 hours'),
    ('restricted','open', '19','19', 'advisory', NULL,  'BWC MOD — fresh snow 0.5in', NULL,        demo_user, 'DEMO: Plow/broom complete — BWC LOW', NOW() - interval '1 day 1 hour'),
    ('open','open',       '19','01', NULL, NULL,        NULL, NULL,                                demo_user, 'DEMO: Wind shift',               NOW() - interval '2 days 8 hours'),
    ('open','closed',     '01','01', NULL,'closed',     NULL, 'Wildlife on runway — deer',         demo_user, 'DEMO: Wildlife incursion',       NOW() - interval '3 days 5 hours'),
    ('closed','open',     '01','01', 'closed', NULL,    'Wildlife on runway — deer', NULL,         demo_user, 'DEMO: Wildlife cleared',         NOW() - interval '3 days 4 hours 45 minutes');

  -- ══════════════════════════════════════════════════════════
  -- M. ARFF STATUS LOG — 6 recent moves
  -- ══════════════════════════════════════════════════════════
  INSERT INTO arff_status_log (base_id, old_cat, new_cat, aircraft_name, old_readiness, new_readiness, changed_by, reason, created_at) VALUES
    (demo_base, 7, 6,   NULL,     NULL,        NULL,        demo_user, 'DEMO: P-23 down for 100hr inspection',              NOW() - interval '4 hours'),
    (demo_base, 6, 7,   NULL,     NULL,        NULL,        demo_user, 'DEMO: P-23 returned to service',                     NOW() - interval '1 hour 30 minutes'),
    (demo_base, NULL, NULL, 'P-22', 'full',    'marginal',  demo_user, 'DEMO: P-22 foam agent resupply in progress',         NOW() - interval '1 day 3 hours'),
    (demo_base, NULL, NULL, 'P-22', 'marginal','full',      demo_user, 'DEMO: P-22 foam topped off',                         NOW() - interval '1 day 1 hour'),
    (demo_base, 7, 5,   NULL,     NULL,        NULL,        demo_user, 'DEMO: Two trucks OOS for pump test',                 NOW() - interval '5 days 8 hours'),
    (demo_base, 5, 7,   NULL,     NULL,        NULL,        demo_user, 'DEMO: Pump test complete — all trucks returned',     NOW() - interval '5 days 5 hours');

  -- ══════════════════════════════════════════════════════════
  -- N. DISCREPANCIES WITH LOCATION (15 fully-populated rows)
  --
  -- Demo AFB uses Selfridge coordinates — RWY 01/19 spans
  -- ~42.6016 to 42.6262, -82.8375 to -82.8365. Pins are
  -- scattered across the runway, taxiways, ramps, and approach
  -- so the map fills out and filtering is meaningful.
  -- ══════════════════════════════════════════════════════════
  --
  -- Note: `assigned_to` is a UUID FK to profiles. The demo base only
  -- has one profile row (the demo user), so we leave the column out
  -- and let `assigned_shop` carry shop attribution for the demo.
  INSERT INTO discrepancies (base_id, display_id, type, status, current_status, title, description,
    location_text, facility_number, latitude, longitude, assigned_shop,
    work_order_number, estimated_completion_date, reported_by, created_at, updated_at,
    resolution_notes, resolution_date) VALUES
    -- OPEN — awaiting AFM review
    (demo_base, 'DEMO-W-DISC-001', 'lighting', 'open', 'submitted_to_afm',
      'RWY 01 Threshold Bar Light #3 Inop',
      'ALSF-2 threshold bar 1, lamp position 3, no illumination. Identified during night lighting inspection.',
      'RWY 01 Threshold — ALSF-2 Bar 1', '7201',
      42.60180, -82.83735, 'Electric Shop',
      NULL, CURRENT_DATE + 5, demo_user,
      NOW() - interval '4 hours', NOW() - interval '4 hours',
      NULL, NULL),

    -- OPEN — submitted to CES with work order
    (demo_base, 'DEMO-W-DISC-002', 'pavement', 'open', 'submitted_to_ces',
      'TWY A Spall Near A4',
      'Pavement spall approximately 14" x 8" x 2" deep. FOD risk elevated. Cone-marked pending patch.',
      'TWY A between A3 and A4', NULL,
      42.61420, -82.83600, 'Pavements Shop',
      'WO-2026-0842', CURRENT_DATE + 10, demo_user,
      NOW() - interval '1 day 6 hours', NOW() - interval '1 day 6 hours',
      NULL, NULL),

    -- OPEN — awaiting CES action
    (demo_base, 'DEMO-W-DISC-003', 'signage', 'open', 'awaiting_action_by_ces',
      'TWY B/RWY 01 Hold Sign Faded',
      'Mandatory hold position sign (TWY B at RWY 01) red background faded to pink. Not compliant with AC 150/5340-18.',
      'TWY B / RWY 01 hold position', '7305',
      42.60650, -82.83520, 'Pavements Shop',
      'WO-2026-0841', CURRENT_DATE + 14, demo_user,
      NOW() - interval '3 days', NOW() - interval '2 days',
      NULL, NULL),

    -- OPEN — waiting for project (supply chain)
    (demo_base, 'DEMO-W-DISC-004', 'navaid', 'open', 'waiting_for_project',
      'VASI RWY 19 Right-Side Unit Inop',
      'Right-side VASI lamp assembly failed. Replacement on 6-8 week backorder. Temporary NOTAM issued.',
      'RWY 19 right of threshold', NULL,
      42.62580, -82.83600, 'NAVAID Shop',
      'WO-2026-0756', CURRENT_DATE + 42, demo_user,
      NOW() - interval '18 days', NOW() - interval '12 days',
      NULL, NULL),

    -- OPEN — work completed awaiting AFM verification
    (demo_base, 'DEMO-W-DISC-005', 'drainage', 'open', 'work_completed_awaiting_verification',
      'Storm Drain Near TWY C Blocked',
      'Storm drain grate clogged with debris causing ponding. CES cleared grate and jetted line.',
      'TWY C midfield', NULL,
      42.61350, -82.83110, 'Pavements Shop',
      'WO-2026-0798', CURRENT_DATE - 2, demo_user,
      NOW() - interval '8 days', NOW() - interval '1 day',
      NULL, NULL),

    -- OPEN — vegetation near perimeter
    (demo_base, 'DEMO-W-DISC-006', 'vegetation', 'open', 'submitted_to_ces',
      'Grass Height Exceeds 7in — TWY A East Edge',
      'Grass height measured 9-11in along 300ft stretch of TWY A east safety area. Wildlife attractant.',
      'TWY A east edge, midfield', NULL,
      42.61410, -82.83420, 'Grounds',
      'WO-2026-0845', CURRENT_DATE + 3, demo_user,
      NOW() - interval '2 days', NOW() - interval '2 days',
      NULL, NULL),

    -- OPEN — wildlife
    (demo_base, 'DEMO-W-DISC-007', 'wildlife', 'open', 'submitted_to_afm',
      'Deer Path Breach — South Perimeter Fence',
      'Repeated deer crossings detected near south fence line. Fence line inspection requested.',
      'South perimeter fence, 500ft east of gate', NULL,
      42.60410, -82.83960, 'Grounds',
      NULL, CURRENT_DATE + 7, demo_user,
      NOW() - interval '12 hours', NOW() - interval '12 hours',
      NULL, NULL),

    -- OPEN — obstruction
    (demo_base, 'DEMO-W-DISC-008', 'obstruction', 'open', 'waiting_for_project',
      'Unlit Antenna on FBO Rooftop',
      'Civilian FBO installed 18ft antenna on building 412 without coordination. Within horizontal surface.',
      'Building 412 rooftop', '412',
      42.61780, -82.84090, NULL,
      NULL, CURRENT_DATE + 30, demo_user,
      NOW() - interval '6 days', NOW() - interval '4 days',
      NULL, NULL),

    -- OPEN — marking
    (demo_base, 'DEMO-W-DISC-009', 'marking', 'open', 'submitted_to_ces',
      'RWY 01 Centerline Stripe Worn — 1000ft Marker',
      'Centerline stripe visibly worn between 800ft and 1100ft markers. Visible but below spec contrast.',
      'RWY 01 centerline, 800-1100ft from threshold', NULL,
      42.60360, -82.83710, 'Pavements Shop',
      'WO-2026-0850', CURRENT_DATE + 21, demo_user,
      NOW() - interval '1 day', NOW() - interval '1 day',
      NULL, NULL),

    -- OPEN — FOD
    (demo_base, 'DEMO-W-DISC-010', 'fod_hazard', 'open', 'submitted_to_afm',
      'Loose Concrete Fragments TWY A/B Intersection',
      'Approximately 6 pieces of 2-4" concrete fragments near TWY A/B intersection, likely from recent vehicle traffic.',
      'TWY A/B intersection', NULL,
      42.61820, -82.83490, 'Pavements Shop',
      NULL, CURRENT_DATE + 2, demo_user,
      NOW() - interval '3 hours', NOW() - interval '3 hours',
      NULL, NULL),

    -- COMPLETED — work completed awaiting verification (recent)
    (demo_base, 'DEMO-W-DISC-011', 'lighting', 'completed', 'work_completed_awaiting_verification',
      'TWY A Edge Light #14 Replaced',
      'TWY A edge light #14 flickering intermittently. Lamp and base connection both replaced.',
      'TWY A edge, north of A3', NULL,
      42.61560, -82.83560, 'Electric Shop',
      'WO-2026-0812', CURRENT_DATE - 3, demo_user,
      NOW() - interval '12 days', NOW() - interval '3 days',
      'Lamp assembly replaced; photometric check passed. Verified on-site by AFM.',
      CURRENT_DATE - 3),

    -- COMPLETED — fully closed
    (demo_base, 'DEMO-W-DISC-012', 'pavement', 'completed', 'work_completed_awaiting_verification',
      'RWY 19 Threshold Spall',
      'Spall 10"x6"x1.5" near RWY 19 threshold. Patched with airfield-grade concrete per UFGS 32 01 19.19.',
      'RWY 19 threshold, 50ft south', NULL,
      42.62570, -82.83680, 'Pavements Shop',
      'WO-2026-0701', CURRENT_DATE - 10, demo_user,
      NOW() - interval '25 days', NOW() - interval '10 days',
      'Patch cured and trafficked; no deterioration observed after 7 days.',
      CURRENT_DATE - 10),

    -- COMPLETED — ramp lighting
    (demo_base, 'DEMO-W-DISC-013', 'lighting', 'completed', 'work_completed_awaiting_verification',
      'Transient Ramp Flood Light Out — Pole 7',
      'Pole 7 flood on transient ramp non-functional. Photocell replaced, lamp reseated.',
      'Transient ramp, pole 7', '7120',
      42.61700, -82.84150, 'Electric Shop',
      'WO-2026-0688', CURRENT_DATE - 15, demo_user,
      NOW() - interval '20 days', NOW() - interval '15 days',
      'Photocell was failed. Replaced and tested at dusk.',
      CURRENT_DATE - 15),

    -- CANCELLED — duplicate report
    (demo_base, 'DEMO-W-DISC-014', 'fod_hazard', 'cancelled', 'submitted_to_afm',
      'Reported Metal Object Near TWY B',
      'Called in by transient crew. Response team dispatched — turned out to be painted line marker shadow.',
      'TWY B near B2', NULL,
      42.61290, -82.83510, NULL,
      NULL, NULL, demo_user,
      NOW() - interval '5 days', NOW() - interval '5 days',
      'Cancelled — no actual FOD present after site inspection.',
      NULL),

    -- OPEN — other / misc (panel door)
    (demo_base, 'DEMO-W-DISC-015', 'other', 'open', 'submitted_to_ces',
      'Electrical Vault Door Latch Broken',
      'Airfield lighting vault door latch broken — door swings open in wind. Security concern.',
      'Airfield lighting vault, east apron', '7812',
      42.61850, -82.83900, 'Electric Shop',
      'WO-2026-0849', CURRENT_DATE + 4, demo_user,
      NOW() - interval '2 days', NOW() - interval '2 days',
      NULL, NULL);

  RAISE NOTICE 'Demo walkthrough data seeded for base %', demo_base;
  RAISE NOTICE '  • 18 feedback submissions + module enabled';
  RAISE NOTICE '  • 8 SCN agencies, 30 Daily SCN checks, 1 Monthly Back-up';
  RAISE NOTICE '  • 6 PPR columns, 10 PPR entries';
  RAISE NOTICE '  • 4 waivers with criteria, reviews, coordination';
  RAISE NOTICE '  • 4 obstruction evaluations (2 w/ violations)';
  RAISE NOTICE '  • 5 local NOTAMs';
  RAISE NOTICE '  • 3 shift-checklist days, 5 daily-review days';
  RAISE NOTICE '  • 8 runway-status log entries, 6 ARFF log entries';
  RAISE NOTICE '  • 15 discrepancies with lat/lng pins + full form fields';

END $$;
