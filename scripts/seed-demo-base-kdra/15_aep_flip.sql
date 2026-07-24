-- ============================================================================
-- KDRA Demo Seed — CLUSTER F: Airport Emergency Plan (AEP) + FLIP
-- Base: Demo Regional Airport (KDRA)  base_id = ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- Window: 2026-01-24 .. 2026-07-23 (today = 2026-07-23), weighted recent.
-- INSERT-only. Deterministic md5 ids + ON CONFLICT DO NOTHING (re-apply safe).
-- Parents before children. Real FKs (roster / real agency ids). No UPDATE/DELETE.
--
-- NOTES FOR ORCHESTRATOR:
--  * aep_response_agencies already holds 14 rows but 8 are DUPLICATES
--    (3x County EMS, 3x Mercy Hospital ED, 3x Demo Tower, 3x County Sheriff;
--     same name/role/sort_order, different ids). To keep comms-check screenshots
--     clean, comms results are seeded against the 6 DISTINCT agencies (one real
--     id per name+role, DISTINCT ON). Recommend the orchestrator dedupe the
--     roster (INSERT-only here, so not done in this file).
--  * A completed full_scale drill already exists (2026-05-27). A second full_scale
--    within 6 months is unrealistic (triennial cadence per 139.325(h)), so the new
--    drills are tabletop / functional / orientation / arff_familiarization only.
-- ============================================================================

BEGIN;

-- ############################################################################
-- ## AEP — DRILLS (139.325)                                                  ##
-- ############################################################################
-- Real distinct agency ids used in participant rosters:
--   ARFF Engine 7        528c0931-314f-4449-bda2-234dc3c74e77 (arff)
--   Springfield Fire     1b66c7b6-99b3-494d-b962-f091b0683005 (mutual_aid_fire)
--   County EMS           9e56aa2a-c042-4601-ad8f-ed95b57d4c20 (ems)
--   Mercy Hospital ED    f6b1d02b-4fb9-4e6c-97ab-266ac12e3c33 (hospital)
--   Demo Tower           e0bde353-aa48-47f5-8cf2-05723770920f (atc)
--   County Sheriff       9cf74868-7ef5-47d6-9e73-1dbb0b23cbc1 (police)

INSERT INTO aep_drills
  (id, base_id, drill_date, drill_type, scenario, status, participants,
   after_action_notes, findings, completed_at, completed_by, created_at, created_by, updated_at)
VALUES
  -- 1. Orientation (completed) — early window
  (md5('kdra-aep-drill-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-01-30', 'orientation',
   'New-employee Airport Emergency Plan orientation — response roles, the emergency notification sequence, and an ARFF response walkthrough for the Q1 Airport Operations hires.',
   'completed',
   '[{"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":true},
     {"agency_id":"e0bde353-aa48-47f5-8cf2-05723770920f","agency_name":"Demo Tower","role":"atc","attended":true}]'::jsonb,
   'All Q1 Airport Operations hires briefed on the AEP notification sequence and command-post stand-up. Grid map and agency call list reviewed.',
   'No findings.',
   '2026-01-30 21:00:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd',
   '2026-01-26 14:00:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-01-30 21:00:00+00'),

  -- 2. Tabletop (completed)
  (md5('kdra-aep-drill-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-02-19', 'tabletop',
   'Tabletop exercise: disabled aircraft on RWY 01 with a fuel leak during winter operations. Coordination among ARFF, mutual-aid fire, EMS, and Airport Operations for runway closure, NOTAM issuance, and passenger accountability.',
   'completed',
   '[{"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":true},
     {"agency_id":"1b66c7b6-99b3-494d-b962-f091b0683005","agency_name":"Springfield Fire Dept","role":"mutual_aid_fire","attended":true},
     {"agency_id":"9e56aa2a-c042-4601-ad8f-ed95b57d4c20","agency_name":"County EMS","role":"ems","attended":true},
     {"agency_id":"e0bde353-aa48-47f5-8cf2-05723770920f","agency_name":"Demo Tower","role":"atc","attended":true}]'::jsonb,
   'Runway-closure and NOTAM sequence exercised end to end. Mutual-aid staging point confirmed at the south gate.',
   'Identified a ~4-minute gap in mutual-aid notification; Springfield Fire added to the primary crash-net dial list ahead of EMS.',
   '2026-02-19 20:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd',
   '2026-02-10 15:00:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-02-19 20:30:00+00'),

  -- 3. Functional (completed)
  (md5('kdra-aep-drill-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-04-22', 'functional',
   'Functional exercise: full emergency notification and crash-net activation with live comms checks to every response agency, plus command-post stand-up at the airport operations building.',
   'completed',
   '[{"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":true},
     {"agency_id":"1b66c7b6-99b3-494d-b962-f091b0683005","agency_name":"Springfield Fire Dept","role":"mutual_aid_fire","attended":true},
     {"agency_id":"9e56aa2a-c042-4601-ad8f-ed95b57d4c20","agency_name":"County EMS","role":"ems","attended":true},
     {"agency_id":"f6b1d02b-4fb9-4e6c-97ab-266ac12e3c33","agency_name":"Mercy Hospital ED","role":"hospital","attended":true},
     {"agency_id":"e0bde353-aa48-47f5-8cf2-05723770920f","agency_name":"Demo Tower","role":"atc","attended":true},
     {"agency_id":"9cf74868-7ef5-47d6-9e73-1dbb0b23cbc1","agency_name":"County Sheriff","role":"police","attended":true}]'::jsonb,
   'Command post stood up in 9 minutes; all agencies acknowledged on the crash net within the notification window.',
   'Two agency radios required backup handhelds; the comms plan was annotated with backup frequencies.',
   '2026-04-22 19:45:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd',
   '2026-04-14 13:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-04-22 19:45:00+00'),

  -- 4. ARFF familiarization (completed) — ARFF chief completes
  (md5('kdra-aep-drill-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-06-17', 'arff_familiarization',
   'ARFF airport familiarization — movement-area orientation, gate and access-road routing, water-supply points, and a RWY 01/19 grid-map review with the mutual-aid engine company.',
   'completed',
   '[{"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":true},
     {"agency_id":"1b66c7b6-99b3-494d-b962-f091b0683005","agency_name":"Springfield Fire Dept","role":"mutual_aid_fire","attended":true}]'::jsonb,
   'Access routes and water points driven with both engine companies. Grid map reprinted to reflect the new Twy B1 connector.',
   'Access gate 3 lock re-keyed; ARFF grid map reissued with the Twy B1 connector and updated hold-short lines.',
   '2026-06-17 18:30:00+00', '10bd2c31-e693-c4d5-2455-d3af3506d106',
   '2026-06-09 14:00:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-06-17 18:30:00+00'),

  -- 5. Tabletop (completed) — recent
  (md5('kdra-aep-drill-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-07-09', 'tabletop',
   'Tabletop exercise: fuel-farm spill and hazmat response on the west apron — containment, agency notification, environmental reporting, and the operational impact on apron and taxiway access.',
   'completed',
   '[{"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":true},
     {"agency_id":"1b66c7b6-99b3-494d-b962-f091b0683005","agency_name":"Springfield Fire Dept","role":"mutual_aid_fire","attended":true},
     {"agency_id":"9cf74868-7ef5-47d6-9e73-1dbb0b23cbc1","agency_name":"County Sheriff","role":"police","attended":true}]'::jsonb,
   'Containment and notification chain exercised; environmental reporting thresholds reviewed with the FBO and fuel vendor.',
   'Recommended pre-staging absorbent booms and pads at the west apron; action assigned to Airport Operations.',
   '2026-07-09 19:15:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd',
   '2026-07-01 13:20:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-07-09 19:15:00+00'),

  -- 6. Functional (scheduled) — upcoming, forward-looking
  (md5('kdra-aep-drill-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-08-19', 'functional',
   'Functional exercise (scheduled): mass-casualty triage coordination with County EMS and Mercy Hospital ED following a simulated runway excursion on RWY 19.',
   'scheduled',
   '[{"agency_id":"9e56aa2a-c042-4601-ad8f-ed95b57d4c20","agency_name":"County EMS","role":"ems","attended":false},
     {"agency_id":"f6b1d02b-4fb9-4e6c-97ab-266ac12e3c33","agency_name":"Mercy Hospital ED","role":"hospital","attended":false},
     {"agency_id":"528c0931-314f-4449-bda2-234dc3c74e77","agency_name":"ARFF Engine 7","role":"arff","attended":false}]'::jsonb,
   NULL, NULL, NULL, NULL,
   '2026-07-14 15:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-07-14 15:30:00+00'),

  -- 7. Tabletop (cancelled)
  (md5('kdra-aep-drill-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '2026-05-06', 'tabletop',
   'Tabletop exercise: severe-weather and tornado sheltering for airfield personnel and tenants, including terminal and FBO shelter-in-place procedures.',
   'cancelled',
   '[]'::jsonb,
   'Cancelled due to a conflicting NAVAID outage response the same afternoon; content folded into the Q3 functional exercise.',
   NULL, NULL, NULL,
   '2026-04-28 14:10:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', '2026-05-06 12:00:00+00')
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- ## AEP — COMMS CHECKS + PER-AGENCY RESULTS                                 ##
-- ############################################################################
-- Authored by James Holloway (AEP coordinator, OI 'JH'). Complements the
-- existing Feb/Mar/Apr monthly checks; adds Jan + May..Jul monthly, two
-- quarterly, and several ad-hoc (weighted recent).

INSERT INTO aep_comms_checks
  (id, base_id, check_date, check_period, started_at, completed_at, completed_by, completed_by_oi, notes, created_at)
VALUES
  (md5('kdra-aep-comms-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-01-28', 'monthly',   '2026-01-28 13:00:00+00', '2026-01-28 13:35:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Monthly emergency-notification comms check — all primary and backup lines verified.', '2026-01-28 13:35:00+00'),
  (md5('kdra-aep-comms-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-03-31', 'quarterly', '2026-03-31 13:00:00+00', '2026-03-31 13:50:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Quarterly full-roster comms check including all backup radios and handhelds.', '2026-03-31 13:50:00+00'),
  (md5('kdra-aep-comms-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-05-15', 'monthly',   '2026-05-15 13:00:00+00', '2026-05-15 13:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Monthly emergency-notification comms check.', '2026-05-15 13:30:00+00'),
  (md5('kdra-aep-comms-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-05-28', 'ad_hoc',    '2026-05-28 14:00:00+00', '2026-05-28 14:25:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Post-exercise comms verification following the 27 May full-scale exercise.', '2026-05-28 14:25:00+00'),
  (md5('kdra-aep-comms-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-15', 'monthly',   '2026-06-15 13:00:00+00', '2026-06-15 13:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Monthly emergency-notification comms check.', '2026-06-15 13:30:00+00'),
  (md5('kdra-aep-comms-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-30', 'quarterly', '2026-06-30 13:00:00+00', '2026-06-30 13:48:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Quarterly full-roster comms check including backup radios.', '2026-06-30 13:48:00+00'),
  (md5('kdra-aep-comms-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-06', 'ad_hoc',    '2026-07-06 13:15:00+00', '2026-07-06 13:35:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Ad-hoc comms check after the Demo Tower AWOS frequency change.', '2026-07-06 13:35:00+00'),
  (md5('kdra-aep-comms-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-15', 'monthly',   '2026-07-15 13:00:00+00', '2026-07-15 13:30:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Monthly emergency-notification comms check.', '2026-07-15 13:30:00+00'),
  (md5('kdra-aep-comms-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-20', 'ad_hoc',    '2026-07-20 13:10:00+00', '2026-07-20 13:28:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Ad-hoc backup-radio check with the mutual-aid fire company.', '2026-07-20 13:28:00+00'),
  (md5('kdra-aep-comms-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-22', 'ad_hoc',    '2026-07-22 13:05:00+00', '2026-07-22 13:22:00+00', 'f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd', 'JH', 'Weekly command-post radio check.', '2026-07-22 13:22:00+00')
ON CONFLICT (id) DO NOTHING;

-- Per-agency results: each of the 10 checks x the 6 DISTINCT agencies.
-- Mostly loud_clear; a handful of deterministic exceptions with operational notes.
INSERT INTO aep_comms_check_results
  (id, check_id, agency_id, agency_name, agency_role, status, notes, sort_order, created_at)
SELECT
  md5('kdra-aep-cres-'||c.i||'-'||a.id)::uuid,
  md5('kdra-aep-comms-'||c.i)::uuid,
  a.id, a.agency_name, a.agency_role,
  CASE
    WHEN c.i = 2 AND a.agency_name = 'ARFF Engine 7'        THEN 'oos'
    WHEN c.i = 4 AND a.agency_name = 'County EMS'           THEN 'no_response'
    WHEN c.i = 5 AND a.agency_name = 'Mercy Hospital ED'    THEN 'not_reached'
    WHEN c.i = 6 AND a.agency_name = 'County Sheriff'       THEN 'no_response'
    WHEN c.i = 9 AND a.agency_name = 'Springfield Fire Dept' THEN 'oos'
    ELSE 'loud_clear'
  END,
  CASE
    WHEN c.i = 2 AND a.agency_name = 'ARFF Engine 7'        THEN 'Primary mobile radio in the shop; reached loud & clear on the backup handheld.'
    WHEN c.i = 4 AND a.agency_name = 'County EMS'           THEN 'No answer on the primary dispatch line; backup line loud & clear on retry.'
    WHEN c.i = 5 AND a.agency_name = 'Mercy Hospital ED'    THEN 'ED charge nurse mid shift-change; callback request left, verified next cycle.'
    WHEN c.i = 6 AND a.agency_name = 'County Sheriff'       THEN 'Dispatch line busy on first attempt; confirmed loud & clear on retry.'
    WHEN c.i = 9 AND a.agency_name = 'Springfield Fire Dept' THEN 'Backup radio battery fault noted; primary line loud & clear.'
    ELSE NULL
  END,
  a.sort_order,
  (c.cdate + time '13:30')::timestamptz
FROM (VALUES
    (1,  '2026-01-28'::date),
    (2,  '2026-03-31'::date),
    (3,  '2026-05-15'::date),
    (4,  '2026-05-28'::date),
    (5,  '2026-06-15'::date),
    (6,  '2026-06-30'::date),
    (7,  '2026-07-06'::date),
    (8,  '2026-07-15'::date),
    (9,  '2026-07-20'::date),
    (10, '2026-07-22'::date)
  ) AS c(i, cdate)
CROSS JOIN (
  SELECT DISTINCT ON (agency_name, agency_role) id, agency_name, agency_role, sort_order
  FROM aep_response_agencies
  WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'
  ORDER BY agency_name, agency_role, sort_order, id
) AS a
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- ## FLIP — LOCAL FLIP LIST (civilian FLIP publications)                     ##
-- ############################################################################
INSERT INTO flip_list (id, base_id, title, sort_order, created_at)
VALUES
  (md5('kdra-flip-list-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – ILS or LOC RWY 01 (KDRA)',                         10,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 01 (KDRA)',                         20,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 19 (KDRA)',                         30,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – VOR-A (KDRA)',                                     40,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Diagram (KDRA)',                                 50,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Chart Supplement U.S. – Demo Regional (KDRA) Entry',     60,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Takeoff Minimums & (Obstacle) Departure Procedures (KDRA)', 70, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Obstacle Departure Procedure – RWY 19 (KDRA)',           80,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Hot Spot Notice – HS1 (Twy A / Twy B) (KDRA)',           90,  '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IFR Alternate Minimums (KDRA)',                          100, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Diverse Vector Area (DVA) Assessment (KDRA)',            110, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IFR Enroute Low Altitude Chart L-25 (KDRA Sector)',      120, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-13')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'VFR Sectional Chart – Regional (KDRA Area)',             130, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-14')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Terminal Procedures Publication (TPP) – Northeast Vol NE-3', 140, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-15')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Chart Supplement U.S. – Northeast Volume',               150, '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-list-16')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Ramp / FBO Diagram (KDRA)',                      160, '2026-01-26 15:00:00+00')
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- ## FLIP — TEXT SECTIONS (Account Overview + change directions)             ##
-- ############################################################################
-- section_key CHECK: acct_info | appt_letter | ordering | responsibilities | change_directions
-- (appt_letter handled by flip_appointment below, not as a text section.)
INSERT INTO flip_text_sections (id, base_id, section_key, content, updated_at, updated_by)
VALUES
  (md5('kdra-flip-sec-acct')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'acct_info',
   'Demo Regional Airport (KDRA) maintains an electronic FLIP account through the FAA Aeronautical Information Services digital product subscription (AeroNav Products). Account reference: DRA-FLIP-KDRA. Coverage includes the U.S. Terminal Procedures Publication (Northeast, NE-3), the Chart Supplement U.S. (Northeast volume), and the applicable IFR enroute low-altitude and VFR area charts. Products are distributed electronically to Airport Operations on each 28-day and 56-day chart cycle and posted to the FLIP continuity binder.',
   '2026-01-26 15:10:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'),
  (md5('kdra-flip-sec-ordering')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'ordering',
   'Current and revised publications are pulled from the FAA digital product catalog on each published effective-date cycle. The Primary FLIP Custodian confirms the upcoming cycle product list against the Local FLIP List, downloads the current charts on the effective date, and verifies currency before superseding the prior edition. Superseded editions are retained for one cycle for reference. Out-of-cycle corrections are handled through the FLIP Change board.',
   '2026-01-26 15:10:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'),
  (md5('kdra-flip-sec-resp')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'responsibilities',
   'The Primary FLIP Custodian maintains the Local FLIP List, downloads and posts each cycle current publications, documents the recurring FLIP review, and coordinates changes with Airport Operations. The Alternate Custodian performs these duties in the Primary custodian absence. Airport Operations reviews and coordinates change requests; final review and sign-off rests with the Airport Operations Manager.',
   '2026-01-26 15:10:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'),
  (md5('kdra-flip-sec-changedir')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'change_directions',
   'Coordinate non-routine FLIP changes through the FLIP Change board: (1) select the affected publication from the Local FLIP List; (2) attach the reference document and page; (3) enter the additions, deletions, or revisions and any associated NOTAM; (4) route for Airport Operations Manager approval; (5) record the creation, processed, and published dates; and (6) post the change with operating initials. Reference discrepancies found during the recurring review are logged with a corrective action and a date corrected.',
   '2026-01-26 15:10:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6')
ON CONFLICT (base_id, section_key) DO NOTHING;


-- ############################################################################
-- ## FLIP — ROLE ASSIGNMENTS (per-record sign chain: custodian>namo>afm)     ##
-- ############################################################################
-- role CHECK: custodian | alternate | namo | afm
--   Danielle Pearce  -> custodian  (Primary FLIP Custodian)
--   Brian Okafor     -> alternate  (Alternate Custodian)
--   Anthony Ruiz     -> namo       (middle review authority; dual-mode relabeled in UI)
--   Marcus Delgado   -> afm        (Airport Operations Manager / final approval)
INSERT INTO flip_role_assignments (id, base_id, user_id, role, created_at)
VALUES
  (md5('kdra-flip-role-cust')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '44cc521d-5850-0faa-8f92-c030a19fce37', 'custodian', '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-role-alt')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'alternate', '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-role-namo')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '4f8ab1a5-c662-a906-7ae3-2730db18551f', 'namo',      '2026-01-26 15:00:00+00'),
  (md5('kdra-flip-role-afm')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'afm',       '2026-01-26 15:00:00+00')
ON CONFLICT (base_id, user_id, role) DO NOTHING;


-- ############################################################################
-- ## FLIP — APPOINTMENT LETTER (one row per base)                            ##
-- ############################################################################
INSERT INTO flip_appointment (id, base_id, file_path, file_name, custodians, notes, updated_at, updated_by)
VALUES
  (md5('kdra-flip-appt')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'flip-appointment/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/FLIP-Custodian-Appointment-Letter-2026.pdf',
   'FLIP-Custodian-Appointment-Letter-2026.pdf',
   '[{"name":"Danielle Pearce","role":"primary"},{"name":"Brian Okafor","role":"alternate"}]'::jsonb,
   'FLIP Custodian appointment effective 26 JAN 2026. The Primary and Alternate FLIP Custodians are appointed in writing by the Airport Operations Manager and are responsible for FLIP account currency, the recurring FLIP review, and change coordination for Demo Regional Airport (KDRA).',
   '2026-01-26 15:20:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6')
ON CONFLICT (base_id) DO NOTHING;


-- ############################################################################
-- ## FLIP — REFERENCES (uploaded reference documents)                        ##
-- ############################################################################
-- file_type CHECK: pdf | docx | pptx | xlsx | other
INSERT INTO flip_references (id, base_id, title, file_type, storage_path, uploaded_by, uploaded_at)
VALUES
  (md5('kdra-flip-ref-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'FAA Chart Supplement Ordering & Currency Guide', 'pdf',
   'flip-references/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/chart-supplement-ordering-guide.pdf', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-01-27 14:00:00+00'),
  (md5('kdra-flip-ref-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AeroNav Products Digital Subscription Confirmation – KDRA', 'pdf',
   'flip-references/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/aeronav-subscription-kdra.pdf', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-01-27 14:05:00+00'),
  (md5('kdra-flip-ref-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '28/56-Day Aeronautical Chart Cycle Calendar (2026)', 'pdf',
   'flip-references/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/chart-cycle-calendar-2026.pdf', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-01-27 14:10:00+00'),
  (md5('kdra-flip-ref-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'FLIP Continuity Binder – Standard Operating Procedure', 'docx',
   'flip-references/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/flip-binder-sop.docx', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-02-03 13:30:00+00'),
  (md5('kdra-flip-ref-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Terminal Procedures Publication Coverage Index – Northeast', 'pdf',
   'flip-references/ea2b542e-72cc-4300-9037-bfe18c0bf7ae/tpp-coverage-index-ne.pdf', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-03-10 15:00:00+00')
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- ## FLIP — CHANGES (board) + change events (coordination timeline)          ##
-- ############################################################################
-- stage CHECK: coordination | submitted | completed   (rejected=true also -> completed)
-- Lifecycle: coordinated -> afm_approved (stage=submitted) -> processed -> published (stage=completed)
-- Authors: Danielle Pearce (DP) / Brian Okafor (BO) coordinate; Marcus Delgado (AFM) approves.
INSERT INTO flip_changes
  (id, base_id, flip_title, notam, details, submitted_by_name, submitted_by_user,
   stage, rejected, afm_approved_by, afm_approved_at,
   creation_date, processed_date, published_date, posted_initials, posted_date,
   reference_doc_page, additions, deletions, revisions_from, revisions_to,
   coordinated_at, updated_at)
VALUES
  -- 1 PUBLISHED
  (md5('kdra-flip-chg-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'IAP – RNAV (GPS) RWY 01 (KDRA)', '!DRA 01/014 KDRA RWY 01 RNAV (GPS) AMDT 2A',
   'Cycle amendment to the RNAV (GPS) RWY 01 approach; superseded the prior edition on the effective date.',
   'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37',
   'completed', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-02-06 14:10:00+00',
   '2026-02-06', '2026-02-10', '2026-02-13', 'DP', '2026-02-13',
   'TPP NE-3, RNAV (GPS) RWY 01 plate', 'Added LPV line of minima (DA 250, HAT 200) and updated the missed-approach holding at DEMO.', NULL, 'AMDT 2', 'AMDT 2A',
   '2026-02-05 15:20:00+00', '2026-02-13 16:30:00+00'),

  -- 2 PUBLISHED
  (md5('kdra-flip-chg-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'Airport Diagram (KDRA)', NULL,
   'Airport diagram update reflecting the new Twy B1 connector and revised hold-short markings north of RWY 01.',
   'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474',
   'completed', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-02-28 15:00:00+00',
   '2026-02-28', '2026-03-04', '2026-03-06', 'BO', '2026-03-06',
   'Airport Diagram, KDRA', 'Added the Twy B1 connector and updated hold-short markings north of RWY 01.', NULL, 'Twy B labeling', 'Twy B / Twy B1 relabel',
   '2026-02-27 13:05:00+00', '2026-03-06 15:10:00+00'),

  -- 3 PUBLISHED
  (md5('kdra-flip-chg-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'Chart Supplement U.S. – Demo Regional (KDRA) Entry', '!DRA 02/108 KDRA AWOS-3 FREQ CHG',
   'Chart Supplement entry update for the AWOS-3 frequency change and a new FBO after-hours contact.',
   'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37',
   'completed', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-03-23 14:20:00+00',
   '2026-03-23', '2026-03-27', '2026-03-31', 'DP', '2026-03-31',
   'Chart Supplement U.S. (NE), KDRA entry', 'Updated the AWOS-3 frequency and added a new FBO after-hours contact number.', NULL, 'AWOS 118.025 / CTAF 122.7', 'AWOS 119.375 / CTAF 122.7',
   '2026-03-20 16:40:00+00', '2026-03-31 15:40:00+00'),

  -- 4 REJECTED
  (md5('kdra-flip-chg-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'IAP – VOR-A (KDRA)', NULL,
   'Proposed removal of the VOR-A minima. Rejected — VOR-A remains published pending the VOR MON decommission schedule.',
   'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474',
   'completed', true, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   'TPP NE-3, VOR-A plate', NULL, 'Proposed removal of the VOR-A line of minima.', NULL, NULL,
   '2026-04-14 12:30:00+00', '2026-04-15 14:00:00+00'),

  -- 5 PUBLISHED
  (md5('kdra-flip-chg-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'Obstacle Departure Procedure – RWY 19 (KDRA)', '!DRA 05/033 KDRA ODP RWY 19 CLIMB GRADIENT',
   'ODP RWY 19 climb-gradient revision following a new temporary obstacle survey south of the airport.',
   'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37',
   'completed', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-05-09 13:30:00+00',
   '2026-05-09', '2026-05-12', '2026-05-15', 'DP', '2026-05-15',
   'Takeoff Minimums & (Obstacle) DP, KDRA', 'Added a temporary crane obstacle 0.7 NM south and raised the RWY 19 climb gradient.', NULL, 'Climb 240 ft/NM to 1500', 'Climb 280 ft/NM to 1700',
   '2026-05-08 14:00:00+00', '2026-05-15 16:00:00+00'),

  -- 6 PUBLISHED
  (md5('kdra-flip-chg-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'Hot Spot Notice – HS1 (Twy A / Twy B) (KDRA)', NULL,
   'Added Hot Spot HS1 at the Twy A / Twy B intersection to the airport diagram and hot-spot table.',
   'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474',
   'completed', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-03 14:00:00+00',
   '2026-06-03', '2026-06-06', '2026-06-10', 'BO', '2026-06-10',
   'Airport Diagram / Hot Spot table, KDRA', 'Added Hot Spot HS1 at the Twy A / Twy B intersection (complex geometry; frequent wrong-turns toward RWY 01).', NULL, NULL, NULL,
   '2026-06-02 15:45:00+00', '2026-06-10 15:25:00+00'),

  -- 7 SUBMITTED (awaiting publication)
  (md5('kdra-flip-chg-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'IAP – ILS or LOC RWY 01 (KDRA)', '!DRA 06/077 KDRA ILS RWY 01 GP UNMON',
   'ILS or LOC RWY 01 note update for an unmonitored glidepath period. Approved and submitted; awaiting publication.',
   'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37',
   'submitted', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-25 14:40:00+00',
   '2026-06-25', NULL, NULL, NULL, NULL,
   'TPP NE-3, ILS or LOC RWY 01 plate', 'Added a glidepath-unmonitored note for scheduled maintenance windows.', NULL, 'GS coverage note', 'Added glidepath-unmonitored note',
   '2026-06-24 13:20:00+00', '2026-06-25 14:40:00+00'),

  -- 8 SUBMITTED (processed, awaiting publication)
  (md5('kdra-flip-chg-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'IAP – RNAV (GPS) RWY 19 (KDRA)', '!DRA 07/012 KDRA RNAV (GPS) RWY 19 AMDT 1B',
   'RNAV (GPS) RWY 19 amendment; processed with the FAA and awaiting publication on the next cycle.',
   'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474',
   'submitted', false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-07-07 13:50:00+00',
   '2026-07-07', '2026-07-10', NULL, NULL, NULL,
   'TPP NE-3, RNAV (GPS) RWY 19 plate', 'Updated the LNAV/VNAV DA and added a cold-temperature correction note.', NULL, 'AMDT 1A', 'AMDT 1B',
   '2026-07-06 15:10:00+00', '2026-07-10 14:30:00+00'),

  -- 9 COORDINATION (awaiting AFM approval)
  (md5('kdra-flip-chg-9')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'IFR Alternate Minimums (KDRA)', NULL,
   'Proposed IFR alternate-minimums note change; awaiting Airport Operations Manager approval.',
   'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37',
   'coordination', false, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   'Alternate Minimums, KDRA', NULL, NULL, 'Standard alternate minimums', 'NA when local weather source not available',
   '2026-07-15 16:00:00+00', '2026-07-15 16:00:00+00'),

  -- 10 COORDINATION (awaiting AFM approval) — most recent
  (md5('kdra-flip-chg-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   'Diverse Vector Area (DVA) Assessment (KDRA)', NULL,
   'Proposed DVA update for RWY 01 departures following the new obstacle survey; awaiting Airport Operations Manager approval.',
   'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474',
   'coordination', false, NULL, NULL,
   NULL, NULL, NULL, NULL, NULL,
   'DVA Assessment, KDRA', 'Proposed DVA revision for RWY 01 departures incorporating the temporary obstacle south of the field.', NULL, NULL, NULL,
   '2026-07-21 14:30:00+00', '2026-07-21 14:30:00+00')
ON CONFLICT (id) DO NOTHING;

-- Change events (coordination timeline). event_type CHECK:
--   coordinated | afm_approved | processed | published | rejected
INSERT INTO flip_change_events (id, change_id, base_id, event_type, actor_user_id, actor_name, remarks, created_at)
VALUES
  -- change 1
  (md5('kdra-flip-evt-1-1')::uuid, md5('kdra-flip-chg-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'Cycle amendment coordinated against the current TPP.', '2026-02-05 15:20:00+00'),
  (md5('kdra-flip-evt-1-2')::uuid, md5('kdra-flip-chg-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-02-06 14:10:00+00'),
  (md5('kdra-flip-evt-1-3')::uuid, md5('kdra-flip-chg-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', NULL, '2026-02-10 15:00:00+00'),
  (md5('kdra-flip-evt-1-4')::uuid, md5('kdra-flip-chg-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'published',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'Posted to the binder on the effective date; prior edition archived.', '2026-02-13 16:30:00+00'),
  -- change 2
  (md5('kdra-flip-evt-2-1')::uuid, md5('kdra-flip-chg-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'Diagram update coordinated with the movement-area survey.', '2026-02-27 13:05:00+00'),
  (md5('kdra-flip-evt-2-2')::uuid, md5('kdra-flip-chg-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-02-28 15:00:00+00'),
  (md5('kdra-flip-evt-2-3')::uuid, md5('kdra-flip-chg-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', NULL, '2026-03-04 14:20:00+00'),
  (md5('kdra-flip-evt-2-4')::uuid, md5('kdra-flip-chg-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'published',    '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', NULL, '2026-03-06 15:10:00+00'),
  -- change 3
  (md5('kdra-flip-evt-3-1')::uuid, md5('kdra-flip-chg-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'AWOS frequency change coordinated with the tower and FBO.', '2026-03-20 16:40:00+00'),
  (md5('kdra-flip-evt-3-2')::uuid, md5('kdra-flip-chg-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-03-23 14:20:00+00'),
  (md5('kdra-flip-evt-3-3')::uuid, md5('kdra-flip-chg-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', NULL, '2026-03-27 13:15:00+00'),
  (md5('kdra-flip-evt-3-4')::uuid, md5('kdra-flip-chg-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'published',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', NULL, '2026-03-31 15:40:00+00'),
  -- change 4 (rejected)
  (md5('kdra-flip-evt-4-1')::uuid, md5('kdra-flip-chg-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'Coordinated removal of the VOR-A minima.', '2026-04-14 12:30:00+00'),
  (md5('kdra-flip-evt-4-2')::uuid, md5('kdra-flip-chg-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'rejected',     'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', 'Duplicate submission — VOR-A stays published until the VOR MON decommission date is confirmed.', '2026-04-15 14:00:00+00'),
  -- change 5
  (md5('kdra-flip-evt-5-1')::uuid, md5('kdra-flip-chg-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'Climb-gradient change coordinated off the temporary crane survey.', '2026-05-08 14:00:00+00'),
  (md5('kdra-flip-evt-5-2')::uuid, md5('kdra-flip-chg-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-05-09 13:30:00+00'),
  (md5('kdra-flip-evt-5-3')::uuid, md5('kdra-flip-chg-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', NULL, '2026-05-12 15:20:00+00'),
  (md5('kdra-flip-evt-5-4')::uuid, md5('kdra-flip-chg-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'published',    '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', NULL, '2026-05-15 16:00:00+00'),
  -- change 6
  (md5('kdra-flip-evt-6-1')::uuid, md5('kdra-flip-chg-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'Hot spot coordinated after repeated wrong-turn reports.', '2026-06-02 15:45:00+00'),
  (md5('kdra-flip-evt-6-2')::uuid, md5('kdra-flip-chg-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-06-03 14:00:00+00'),
  (md5('kdra-flip-evt-6-3')::uuid, md5('kdra-flip-chg-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', NULL, '2026-06-06 13:40:00+00'),
  (md5('kdra-flip-evt-6-4')::uuid, md5('kdra-flip-chg-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'published',    '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', NULL, '2026-06-10 15:25:00+00'),
  -- change 7 (submitted)
  (md5('kdra-flip-evt-7-1')::uuid, md5('kdra-flip-chg-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'Coordinated the glidepath-unmonitored note for the maintenance window.', '2026-06-24 13:20:00+00'),
  (md5('kdra-flip-evt-7-2')::uuid, md5('kdra-flip-chg-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', 'Approved; submit to the FAA for the next cycle.', '2026-06-25 14:40:00+00'),
  -- change 8 (submitted + processed)
  (md5('kdra-flip-evt-8-1')::uuid, md5('kdra-flip-chg-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'AMDT 1B coordinated against the current plate.', '2026-07-06 15:10:00+00'),
  (md5('kdra-flip-evt-8-2')::uuid, md5('kdra-flip-chg-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'afm_approved', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Marcus Delgado', NULL, '2026-07-07 13:50:00+00'),
  (md5('kdra-flip-evt-8-3')::uuid, md5('kdra-flip-chg-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'processed',    '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'Processed with the FAA; awaiting publication.', '2026-07-10 14:30:00+00'),
  -- change 9 (coordination)
  (md5('kdra-flip-evt-9-1')::uuid, md5('kdra-flip-chg-9')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated',  '44cc521d-5850-0faa-8f92-c030a19fce37', 'Danielle Pearce', 'Coordinated the alternate-minimums note change; routed for approval.', '2026-07-15 16:00:00+00'),
  -- change 10 (coordination)
  (md5('kdra-flip-evt-10-1')::uuid, md5('kdra-flip-chg-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'coordinated', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Brian Okafor', 'DVA revision coordinated off the new obstacle survey; routed for approval.', '2026-07-21 14:30:00+00')
ON CONFLICT (id) DO NOTHING;


-- ############################################################################
-- ## FLIP — REVIEWS + ITEMS + SIGNOFFS (recurring 56-day FLIP review)        ##
-- ############################################################################
-- Reviews created by Anthony Ruiz (ops_supervisor) / Marcus Delgado (AFM).
-- Signoff chain: custodian (Danielle) -> namo (Anthony) -> afm (Marcus).
INSERT INTO flip_reviews (id, base_id, cycle, review_date, created_by, created_at)
VALUES
  (md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '23 JAN 2026 – 19 MAR 2026', '2026-03-18', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-03-18 15:00:00+00'),
  (md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '20 MAR 2026 – 14 MAY 2026', '2026-05-13', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-05-13 14:30:00+00'),
  (md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '15 MAY 2026 – 09 JUL 2026', '2026-07-08', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-08 15:15:00+00'),
  (md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '10 JUL 2026 – 03 SEP 2026', '2026-07-21', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-07-21 15:00:00+00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO flip_review_items
  (id, review_id, base_id, flip_title, effective_date, discrepancy, discrepancy_note, corrective_action, date_corrected, sort_order)
VALUES
  -- Review 1
  (md5('kdra-flip-ri-1-1')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – ILS or LOC RWY 01 (KDRA)', '2026-01-23', false, NULL, NULL, NULL, 0),
  (md5('kdra-flip-ri-1-2')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 01 (KDRA)', '2026-02-13', false, NULL, NULL, NULL, 1),
  (md5('kdra-flip-ri-1-3')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Diagram (KDRA)', '2026-03-06', false, NULL, NULL, NULL, 2),
  (md5('kdra-flip-ri-1-4')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Chart Supplement U.S. – Demo Regional (KDRA) Entry', '2026-01-23', true, 'The AWOS frequency in the posted binder copy did not match the current Chart Supplement entry.', 'Downloaded the current cycle entry and coordinated a FLIP change; superseded the prior copy.', '2026-03-31', 3),
  (md5('kdra-flip-ri-1-5')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – VOR-A (KDRA)', '2026-01-23', false, NULL, NULL, NULL, 4),
  -- Review 2
  (md5('kdra-flip-ri-2-1')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 19 (KDRA)', '2026-03-20', false, NULL, NULL, NULL, 0),
  (md5('kdra-flip-ri-2-2')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Obstacle Departure Procedure – RWY 19 (KDRA)', '2026-04-10', true, 'A new crane obstacle south of RWY 19 was not yet reflected in the posted ODP climb gradient.', 'Coordinated an ODP FLIP change; climb gradient raised to 280 ft/NM.', '2026-05-15', 1),
  (md5('kdra-flip-ri-2-3')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Takeoff Minimums & (Obstacle) Departure Procedures (KDRA)', '2026-03-20', false, NULL, NULL, NULL, 2),
  (md5('kdra-flip-ri-2-4')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Diagram (KDRA)', '2026-03-06', false, NULL, NULL, NULL, 3),
  (md5('kdra-flip-ri-2-5')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Chart Supplement U.S. – Demo Regional (KDRA) Entry', '2026-03-31', false, NULL, NULL, NULL, 4),
  -- Review 3 (clean)
  (md5('kdra-flip-ri-3-1')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – ILS or LOC RWY 01 (KDRA)', '2026-05-15', false, NULL, NULL, NULL, 0),
  (md5('kdra-flip-ri-3-2')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 01 (KDRA)', '2026-05-15', false, NULL, NULL, NULL, 1),
  (md5('kdra-flip-ri-3-3')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 19 (KDRA)', '2026-05-15', false, NULL, NULL, NULL, 2),
  (md5('kdra-flip-ri-3-4')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Hot Spot Notice – HS1 (Twy A / Twy B) (KDRA)', '2026-06-10', false, NULL, NULL, NULL, 3),
  (md5('kdra-flip-ri-3-5')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Diagram (KDRA)', '2026-06-10', false, NULL, NULL, NULL, 4),
  (md5('kdra-flip-ri-3-6')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Obstacle Departure Procedure – RWY 19 (KDRA)', '2026-05-15', false, NULL, NULL, NULL, 5),
  -- Review 4 (open discrepancy: AMDT 1B processed, not yet posted)
  (md5('kdra-flip-ri-4-1')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – RNAV (GPS) RWY 19 (KDRA)', '2026-07-10', true, 'RNAV (GPS) RWY 19 AMDT 1B processed with the FAA but not yet posted to the binder as of the review date.', 'Pending publication; FLIP change is in Submitted status.', NULL, 0),
  (md5('kdra-flip-ri-4-2')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IAP – ILS or LOC RWY 01 (KDRA)', '2026-07-10', false, NULL, NULL, NULL, 1),
  (md5('kdra-flip-ri-4-3')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Chart Supplement U.S. – Demo Regional (KDRA) Entry', '2026-07-10', false, NULL, NULL, NULL, 2),
  (md5('kdra-flip-ri-4-4')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'IFR Alternate Minimums (KDRA)', '2026-05-15', false, NULL, NULL, NULL, 3),
  (md5('kdra-flip-ri-4-5')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Airport Diagram (KDRA)', '2026-06-10', false, NULL, NULL, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Signoffs (one per review; UNIQUE review_id). Reviews 1–3 fully signed;
-- review 4 custodian + namo signed, AFM final signature pending (in progress).
INSERT INTO flip_review_signoffs
  (id, review_id, base_id, custodian_signed_by, custodian_signed_at, namo_signed_by, namo_signed_at, afm_signed_by, afm_signed_at)
VALUES
  (md5('kdra-flip-signoff-1')::uuid, md5('kdra-flip-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-03-18 16:00:00+00',
   '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-03-19 14:00:00+00',
   'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-03-20 15:00:00+00'),
  (md5('kdra-flip-signoff-2')::uuid, md5('kdra-flip-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-05-13 15:30:00+00',
   '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-05-14 13:45:00+00',
   'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-05-15 14:20:00+00'),
  (md5('kdra-flip-signoff-3')::uuid, md5('kdra-flip-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-08 16:00:00+00',
   '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-09 14:10:00+00',
   'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-07-10 15:20:00+00'),
  (md5('kdra-flip-signoff-4')::uuid, md5('kdra-flip-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
   '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-21 16:00:00+00',
   '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-22 14:30:00+00',
   NULL, NULL)
ON CONFLICT (review_id) DO NOTHING;

COMMIT;
