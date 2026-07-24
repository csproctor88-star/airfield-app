-- ============================================================================
-- KDRA Demo Seed — Cluster E: Safety Management System (civilian Part 139 SMS)
-- Base: Demo Regional Airport (KDRA)  base_id ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- "Today" = 2026-07-23. History window 2026-01-24 .. 2026-07-23 (UTC).
--
-- !!! ORCHESTRATOR / APPLY-TIME PREREQUISITE (READ BEFORE APPLYING) !!!
-- Every SMS author/user column (created_by, updated_by, identified_by,
-- risk_owner_user_id, assessed_by, owner_user_id, completed_by, triaged_by,
-- performed_by, proposed_by, approved_by, accountable_executive_user_id, ...)
-- has a FOREIGN KEY -> auth.users(id).  As of introspection only TWO of the
-- ten roster ids exist in auth.users:
--     af9a39db-76fd-4bcc-8d50-7afbc292eaf6  (Marcus Delgado)
--     6be75b3b-cab7-4acb-9c47-b353796d6438  (Christopher Proctor)
-- The other 8 roster staff (Sara, Anthony, Danielle, Brian, Olivia, James,
-- Ramon, Karen) exist ONLY in `profiles`, NOT in `auth.users`.
-- This file authors records to the roster ids per the brief. It will FAIL on
-- FK violation unless those 8 auth.users rows exist at apply time. The
-- orchestrator MUST materialize the demo staff in auth.users (or repoint the
-- FKs at profiles) before applying. This is a cross-cluster dependency.
--
-- Idempotent: deterministic md5 ids + ON CONFLICT (id) DO NOTHING.
-- INSERT only. Parents before children. Normal FK checks ON.
-- ============================================================================

BEGIN;

-- Roster ids (all FK -> auth.users):
--  Marcus Delgado   af9a39db-76fd-4bcc-8d50-7afbc292eaf6  airfield_manager
--  Karen Whitfield  af5eed97-5425-d64b-358f-8c1b0e8050af  accountable_executive
--  Anthony Ruiz     4f8ab1a5-c662-a906-7ae3-2730db18551f  ops_supervisor
--  Danielle Pearce  44cc521d-5850-0faa-8f92-c030a19fce37  amops
--  Brian Okafor     00b4cdd3-cbf0-0269-a366-3514870b0474  amops
--  Olivia Brenner   57a1c585-209a-5012-9983-ff95142a9ff0  amops
--  Sara Lindqvist   d3666d88-527f-b006-2afe-96b9573674e2  sms_manager
--  James Holloway   f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd  aep_coordinator
--  Ramon Castellano 10bd2c31-e693-c4d5-2455-d3af3506d106  arff_chief


-- ============================================================================
-- 1) HAZARDS  (sms_hazards)  HZ-0007 .. HZ-0021  (15 rows)
--    Parent for risk_assessments, mitigations, moc.linked_hazard_id,
--    communications.related_hazard_id, safety_reports.promoted_hazard_id.
--    latest_assessment_id / source_ref_id have NO FK -> safe to set forward.
--    current_band / residual_band must match the attached risk assessment.
-- ============================================================================
INSERT INTO sms_hazards
  (id, base_id, hazard_code, title, description, source_type, source_ref_id,
   status, closed_at, closed_by, closure_rationale, risk_owner_user_id,
   identified_by, identified_at, latest_assessment_id, current_band,
   residual_band, created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_hazards-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0007', 'Deer incursions through south perimeter fence gap',
  'Repeated dawn/dusk deer sightings near the south tie-downs. A suspected gap in the south boundary fence is allowing deer onto airport property, with risk of a runway or taxiway incursion during low-light operations.',
  'whmp', NULL, 'under_review', NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', '44cc521d-5850-0faa-8f92-c030a19fce37',
  '2026-07-12 07:30+00', md5('kdra-sms_risk_assessments-7')::uuid, 'medium', 'medium',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-07-12 08:00+00', '2026-07-20 14:00+00'),

 (md5('kdra-sms_hazards-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0008', 'FOD accumulation near construction laydown on Taxiway B',
  'A contractor laydown area staged too close to the Taxiway B edge is generating loose gravel and debris that migrates onto the taxiway during wind and jet blast, creating a foreign-object-damage risk.',
  'inspection', NULL, 'controlled', NULL, NULL, NULL,
  '4f8ab1a5-c662-a906-7ae3-2730db18551f', '00b4cdd3-cbf0-0269-a366-3514870b0474',
  '2026-03-15 08:00+00', md5('kdra-sms_risk_assessments-8')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-03-15 09:00+00', '2026-03-26 12:00+00'),

 (md5('kdra-sms_hazards-9')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0009', 'Faded centerline and touchdown-zone markings on RWY 01/19',
  'Runway centerline stripes and touchdown-zone markings on RWY 01/19 have faded below the desired reflectivity, reducing visual guidance at night and in rain.',
  'discrepancy', NULL, 'controlled', NULL, NULL, NULL,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '57a1c585-209a-5012-9983-ff95142a9ff0',
  '2026-03-02 09:00+00', md5('kdra-sms_risk_assessments-9')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-03-02 10:00+00', '2026-04-09 15:00+00'),

 (md5('kdra-sms_hazards-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0010', 'Recurring hot spot at TWY A / RWY 19 hold line',
  'Transient pilots and drivers repeatedly stop past or become confused at the TWY A intersection with the RWY 19 hold line. Geometry and sign placement contribute to potential runway incursions.',
  'safety_report', md5('kdra-sms_safety_reports-1')::uuid, 'open', NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', '4f8ab1a5-c662-a906-7ae3-2730db18551f',
  '2026-04-09 15:30+00', md5('kdra-sms_risk_assessments-10')::uuid, 'medium', 'medium',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-04-09 16:00+00', '2026-06-26 11:00+00'),

 (md5('kdra-sms_hazards-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0011', 'Fuel spill risk at self-serve avgas island, west apron',
  'A minor 100LL spill occurred when a self-serve nozzle auto-shutoff failed to trip. Root causes include aging nozzle hardware and inconsistent adherence to the fueling SOP.',
  'safety_report', md5('kdra-sms_safety_reports-2')::uuid, 'under_review', NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', '10bd2c31-e693-c4d5-2455-d3af3506d106',
  '2026-04-23 11:45+00', md5('kdra-sms_risk_assessments-11')::uuid, 'low', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-04-23 12:00+00', '2026-07-05 10:00+00'),

 (md5('kdra-sms_hazards-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0012', 'Standing water on north infield attracting birds after rain',
  'A low spot on the north infield ponds after heavy rain and remains wet for a day or more, drawing gulls and waterfowl close to the movement area and increasing strike risk.',
  'whmp', NULL, 'open', NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', '00b4cdd3-cbf0-0269-a366-3514870b0474',
  '2026-07-19 09:00+00', md5('kdra-sms_risk_assessments-12')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-07-19 09:30+00', '2026-07-21 13:00+00'),

 (md5('kdra-sms_hazards-13')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0013', 'Vehicle/pedestrian deviation onto the movement area',
  'A contractor vehicle entered the movement area near the RWY 01 threshold after dusk without clearance or an escort, and the driver held a lapsed airfield driving endorsement.',
  'safety_report', md5('kdra-sms_safety_reports-3')::uuid, 'controlled', NULL, NULL, NULL,
  '4f8ab1a5-c662-a906-7ae3-2730db18551f', '44cc521d-5850-0faa-8f92-c030a19fce37',
  '2026-05-03 21:30+00', md5('kdra-sms_risk_assessments-13')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-05-03 22:00+00', '2026-05-25 16:00+00'),

 (md5('kdra-sms_hazards-14')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0014', 'Temporary crane operations near RWY 01 approach surface',
  'A contractor crane performing terminal-roof work penetrates the RWY 01 approach surface during lifts. Requires procedural controls to prevent conflict with arriving traffic.',
  'moc', NULL, 'controlled', NULL, NULL, NULL,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
  '2026-06-20 10:00+00', md5('kdra-sms_risk_assessments-14')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-06-20 10:30+00', '2026-06-27 15:00+00'),

 (md5('kdra-sms_hazards-15')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0015', 'Rubber deposit buildup reducing friction on RWY 19 rollout',
  'Rubber deposits in the RWY 19 touchdown and rollout thirds are reducing measured friction, contributing to below-expected wet braking-action reports from regional operators.',
  'inspection', NULL, 'open', NULL, NULL, NULL,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '57a1c585-209a-5012-9983-ff95142a9ff0',
  '2026-06-30 08:30+00', md5('kdra-sms_risk_assessments-15')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-06-30 09:00+00', '2026-07-18 10:00+00'),

 (md5('kdra-sms_hazards-16')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0016', 'Snow and ice control plan gaps at ramp edges',
  'Winter-operations review found the Snow and Ice Control Plan lacked a defined ramp-edge treatment procedure, leaving intermittent ice ridges at apron boundaries.',
  'reg_review', NULL, 'closed',
  '2026-03-20 16:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  'SICP updated with a ramp-edge treatment procedure and staff briefed; residual risk acceptable for the season.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
  '2026-02-05 14:00+00', md5('kdra-sms_risk_assessments-16')::uuid, 'low', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-02-05 14:30+00', '2026-03-20 16:00+00'),

 (md5('kdra-sms_hazards-17')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0017', 'Unlit midfield windsock during night operations',
  'The lighted midfield windsock was found unlit during a night inspection, degrading wind-awareness cues for pilots operating after dark.',
  'discrepancy', NULL, 'controlled', NULL, NULL, NULL,
  '4f8ab1a5-c662-a906-7ae3-2730db18551f', '57a1c585-209a-5012-9983-ff95142a9ff0',
  '2026-06-28 03:30+00', md5('kdra-sms_risk_assessments-17')::uuid, 'medium', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-06-28 04:00+00', '2026-07-04 09:00+00'),

 (md5('kdra-sms_hazards-18')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0018', 'Coyote den activity adjacent to the RWY 19 runway safety area',
  'Repeated coyote sightings and suspected den activity near the RWY 19 end raise the risk of an animal entering the runway safety area during operations.',
  'wildlife_strike', NULL, 'under_review', NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', '44cc521d-5850-0faa-8f92-c030a19fce37',
  '2026-07-08 06:45+00', md5('kdra-sms_risk_assessments-18')::uuid, 'medium', 'medium',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-07-08 07:00+00', '2026-07-19 15:00+00'),

 (md5('kdra-sms_hazards-19')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0019', 'Inconsistent NOTAM wording on partial taxiway closures',
  'An internal audit found that partial taxiway-closure NOTAMs were worded inconsistently, leading to pilot confusion about which segment was closed.',
  'audit', NULL, 'closed',
  '2026-07-02 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  'NOTAM wording standardized against a template; audit finding closed and staff briefed.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-06-18 12:00+00', md5('kdra-sms_risk_assessments-19')::uuid, 'low', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-06-18 12:30+00', '2026-07-02 10:00+00'),

 (md5('kdra-sms_hazards-20')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0020', 'After-hours arrival with no on-duty response coverage',
  'Reports of after-hours PPR arrivals when it is unclear whether staff are on duty to respond to an incident. Access-control and duty-coverage clarification needed.',
  'other', NULL, 'duplicate',
  '2026-07-09 09:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  'Duplicate of the access-control theme tracked under HZ-0013; consolidated for a single corrective-action track.',
  'd3666d88-527f-b006-2afe-96b9573674e2', '00b4cdd3-cbf0-0269-a366-3514870b0474',
  '2026-07-06 12:30+00', md5('kdra-sms_risk_assessments-20')::uuid, 'low', 'low',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-07-06 13:00+00', '2026-07-09 09:00+00'),

 (md5('kdra-sms_hazards-21')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'HZ-0021', 'Unmanned aircraft (drone) sighting near the RWY 01 approach',
  'A pilot on short final to RWY 01 reported a small quadcopter near the approach path at roughly 300 ft AGL and went around. Potential for a serious mid-air conflict during pattern operations.',
  'safety_report', md5('kdra-sms_safety_reports-4')::uuid, 'under_review', NULL, NULL, NULL,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '4f8ab1a5-c662-a906-7ae3-2730db18551f',
  '2026-05-15 19:00+00', md5('kdra-sms_risk_assessments-21')::uuid, 'high', 'medium',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-05-15 19:30+00', '2026-06-01 10:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 2) RISK ASSESSMENTS  (sms_risk_assessments)  one per hazard  (15 rows)
--    risk_index = likelihood * severity.  Band: >=15 high, >=7 medium, else low.
--    Bands here MUST match each hazard's current_band / residual_band.
-- ============================================================================
INSERT INTO sms_risk_assessments
  (id, hazard_id, base_id, assessed_at, assessed_by, likelihood, severity,
   residual_likelihood, residual_severity, likelihood_rationale,
   severity_rationale, notes, created_at, updated_at)
VALUES
 (md5('kdra-sms_risk_assessments-7')::uuid, md5('kdra-sms_hazards-7')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-13 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 4, 2, 4,
  'Multiple sightings over consecutive weeks with a confirmed fence gap — Likelihood = Remote (3).',
  'A deer on the runway during a night landing could cause a runway excursion or gear damage — Severity = Hazardous (4).',
  'Residual stays medium until the fence is repaired; interim dusk sweeps reduce but do not eliminate exposure.',
  '2026-07-13 10:00+00', '2026-07-13 10:00+00'),

 (md5('kdra-sms_risk_assessments-8')::uuid, md5('kdra-sms_hazards-8')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-03-16 11:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 3, 1, 3,
  'Debris migration observed on several inspection cycles — Likelihood = Remote (3).',
  'FOD ingestion or tire damage on a taxiing aircraft — Severity = Major (3).',
  'After relocating the laydown and adding a daily FOD check, likelihood drops to Extremely Improbable (1).',
  '2026-03-16 11:00+00', '2026-03-16 11:00+00'),

 (md5('kdra-sms_risk_assessments-9')::uuid, md5('kdra-sms_hazards-9')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-03-03 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 3, 1, 3,
  'Degraded markings affect every night/low-vis operation — Likelihood = Remote (3).',
  'Loss of centerline guidance at night could contribute to a lateral excursion — Severity = Major (3).',
  'Repaint restores reflectivity; residual likelihood Extremely Improbable (1).',
  '2026-03-03 10:00+00', '2026-03-03 10:00+00'),

 (md5('kdra-sms_risk_assessments-10')::uuid, md5('kdra-sms_hazards-10')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-04-10 11:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 4, 2, 4,
  'Recurring confusion at a single hold line by transient traffic — Likelihood = Remote (3).',
  'A runway incursion at this hold line could lead to a serious conflict — Severity = Hazardous (4).',
  'Enhanced markings and an elevated sign reduce likelihood; residual remains medium pending sign install.',
  '2026-04-10 11:00+00', '2026-04-10 11:00+00'),

 (md5('kdra-sms_risk_assessments-11')::uuid, md5('kdra-sms_hazards-11')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-04-24 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 3, 1, 3,
  'One minor spill traced to a nozzle fault and SOP lapse — Likelihood = Extremely Remote (2).',
  'A larger avgas spill near aircraft could create a fire/environmental hazard — Severity = Major (3).',
  'SOP refresher, spill-kit staging, and PPE reduce likelihood to Extremely Improbable (1).',
  '2026-04-24 10:00+00', '2026-04-24 10:00+00'),

 (md5('kdra-sms_risk_assessments-12')::uuid, md5('kdra-sms_hazards-12')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-19 12:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  4, 3, 2, 3,
  'Ponding recurs after most heavy-rain events during the wet season — Likelihood = Probable (4).',
  'A bird strike drawn by the attractant could damage an engine or airframe — Severity = Major (3).',
  'Regrading and drainage eliminate the attractant; interim post-rain patrols hold residual to low.',
  '2026-07-19 12:00+00', '2026-07-19 12:00+00'),

 (md5('kdra-sms_risk_assessments-13')::uuid, md5('kdra-sms_hazards-13')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-05-04 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 4, 1, 4,
  'A single deviation with a lapsed endorsement, quickly recalled — Likelihood = Extremely Remote (2).',
  'An unauthorized vehicle on the movement area could conflict with an aircraft — Severity = Hazardous (4).',
  'Recurrent driver training and endorsement audit reduce likelihood to Extremely Improbable (1).',
  '2026-05-04 10:00+00', '2026-05-04 10:00+00'),

 (md5('kdra-sms_risk_assessments-14')::uuid, md5('kdra-sms_hazards-14')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-21 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 5, 1, 5,
  'Approach-surface penetration only during scheduled, controlled lifts — Likelihood = Extremely Remote (2).',
  'A conflict between a crane and an arriving aircraft would be catastrophic — Severity = Catastrophic (5).',
  'Daytime-only NOTAM window, dedicated spotter, and no-lift-during-IFR reduce likelihood to Extremely Improbable (1).',
  '2026-06-21 10:00+00', '2026-06-21 10:00+00'),

 (md5('kdra-sms_risk_assessments-15')::uuid, md5('kdra-sms_hazards-15')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-01 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 3, 2, 3,
  'Below-expected wet braking reports recurring on RWY 19 — Likelihood = Remote (3).',
  'Reduced friction can contribute to a wet-runway excursion — Severity = Major (3).',
  'Rubber removal and friction rejuvenation reduce likelihood; residual low pending the friction survey.',
  '2026-07-01 10:00+00', '2026-07-01 10:00+00'),

 (md5('kdra-sms_risk_assessments-16')::uuid, md5('kdra-sms_hazards-16')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-02-06 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 2, 1, 2,
  'Ramp-edge ice ridges occurred intermittently before the procedure update — Likelihood = Extremely Remote (2).',
  'A slip or minor ground event at low speed — Severity = Minor (2).',
  'SICP procedure update and staff briefing reduce likelihood to Extremely Improbable (1).',
  '2026-02-06 10:00+00', '2026-02-06 10:00+00'),

 (md5('kdra-sms_risk_assessments-17')::uuid, md5('kdra-sms_hazards-17')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-28 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 3, 1, 3,
  'Recurring lamp failures on the midfield windsock — Likelihood = Remote (3).',
  'Loss of wind cues at night can affect approach/landing decisions — Severity = Major (3).',
  'Fixture replacement restores the cue; residual likelihood Extremely Improbable (1).',
  '2026-06-28 10:00+00', '2026-06-28 10:00+00'),

 (md5('kdra-sms_risk_assessments-18')::uuid, md5('kdra-sms_hazards-18')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-08 12:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 4, 2, 4,
  'Repeated sightings with suspected denning near the RSA — Likelihood = Remote (3).',
  'A coyote in the RSA during landing could cause an excursion or strike — Severity = Hazardous (4).',
  'USDA den survey and removal reduce likelihood; residual remains medium until the den is cleared.',
  '2026-07-08 12:00+00', '2026-07-08 12:00+00'),

 (md5('kdra-sms_risk_assessments-19')::uuid, md5('kdra-sms_hazards-19')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-19 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 3, 1, 3,
  'Occasional confusion from inconsistent NOTAM wording — Likelihood = Extremely Remote (2).',
  'A misread closure could route an aircraft onto a closed segment — Severity = Major (3).',
  'Standardized NOTAM template reduces likelihood to Extremely Improbable (1).',
  '2026-06-19 10:00+00', '2026-06-19 10:00+00'),

 (md5('kdra-sms_risk_assessments-20')::uuid, md5('kdra-sms_hazards-20')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-07 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  2, 2, 1, 2,
  'After-hours coverage ambiguity reported occasionally — Likelihood = Extremely Remote (2).',
  'Delayed response to a minor after-hours event — Severity = Minor (2).',
  'Consolidated with the access-control corrective action under HZ-0013.',
  '2026-07-07 10:00+00', '2026-07-07 10:00+00'),

 (md5('kdra-sms_risk_assessments-21')::uuid, md5('kdra-sms_hazards-21')::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-05-16 10:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2',
  3, 5, 2, 5,
  'Drone activity near approaches is an increasing regional trend — Likelihood = Remote (3).',
  'A mid-air collision with an aircraft on final would be catastrophic — Severity = Catastrophic (5).',
  'FAA UAS reporting and law-enforcement coordination reduce likelihood; residual remains medium given limited control over airspace intruders.',
  '2026-05-16 10:00+00', '2026-05-16 10:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3) MITIGATIONS  (sms_mitigations)  M1..M20  (20 rows)
--    hazard_id FK -> sms_hazards (required). control_type / status enums
--    per CHECK. completed_at >= created_at. Overdue in-progress rows (M15,M18)
--    intentionally feed the "overdue mitigations" SPI.
-- ============================================================================
INSERT INTO sms_mitigations
  (id, hazard_id, base_id, title, description, control_type, owner_user_id,
   due_date, status, completed_at, completed_by, evidence_url, notes,
   created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_mitigations-1')::uuid, md5('kdra-sms_hazards-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Repair south perimeter fence gap and install a wildlife-exclusion apron',
  'Contract repair of the south boundary fence gap with a buried exclusion apron to deter deer. Interim dusk deer sweeps remain in effect until complete.',
  'engineering', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-08-15', 'in_progress',
  NULL, NULL, NULL, 'Contractor scheduled; interim dusk sweeps in place.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-13 09:00+00', '2026-07-20 14:00+00'),

 (md5('kdra-sms_mitigations-2')::uuid, md5('kdra-sms_hazards-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Add a dusk deer sweep to the evening inspection route',
  'Interim administrative control: add a dedicated deer sweep of the south boundary to the evening self-inspection until the fence is repaired.',
  'administrative', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-20', 'completed',
  '2026-07-19 22:00+00', '44cc521d-5850-0faa-8f92-c030a19fce37', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-13 09:00+00', '2026-07-19 22:00+00'),

 (md5('kdra-sms_mitigations-3')::uuid, md5('kdra-sms_hazards-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Relocate the construction laydown clear of the Taxiway B edge',
  'Move the contractor laydown at least 200 ft from the taxiway edge to eliminate the debris source, and require a daily FOD check of the area.',
  'elimination', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-03-25', 'completed',
  '2026-03-24 17:00+00', '4f8ab1a5-c662-a906-7ae3-2730db18551f', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-03-16 09:00+00', '2026-03-24 17:00+00'),

 (md5('kdra-sms_mitigations-4')::uuid, md5('kdra-sms_hazards-9')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Repaint RWY 01/19 centerline and touchdown-zone markings',
  'Repaint the runway centerline and touchdown-zone markings to restore reflectivity during the next dry weather window.',
  'engineering', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-04-10', 'completed',
  '2026-04-08 18:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-03-05 09:00+00', '2026-04-08 18:00+00'),

 (md5('kdra-sms_mitigations-5')::uuid, md5('kdra-sms_hazards-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Install enhanced hold-line marking and an elevated hold sign at TWY A / RWY 19',
  'Apply enhanced surface hold-line markings and install an elevated runway-holding-position sign to improve conspicuity at the hot spot.',
  'engineering', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-30', 'completed',
  '2026-06-25 16:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', NULL, 'Markings and elevated sign installed.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-12 09:00+00', '2026-06-25 16:00+00'),

 (md5('kdra-sms_mitigations-6')::uuid, md5('kdra-sms_hazards-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Publish a hot-spot advisory and brief tenants and pilots',
  'Issue a hot-spot advisory for the TWY A / RWY 19 hold line and brief based operators, tenants, and airfield drivers.',
  'training', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-01', 'completed',
  '2026-05-28 15:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-12 09:00+00', '2026-05-28 15:00+00'),

 (md5('kdra-sms_mitigations-7')::uuid, md5('kdra-sms_hazards-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Conduct a self-serve fueling SOP refresher for line staff',
  'Refresher training on the self-serve fueling SOP: nozzle handling, auto-shutoff verification, and spill response.',
  'administrative', '10bd2c31-e693-c4d5-2455-d3af3506d106', '2026-05-15', 'completed',
  '2026-05-12 14:00+00', '10bd2c31-e693-c4d5-2455-d3af3506d106', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-25 09:00+00', '2026-05-12 14:00+00'),

 (md5('kdra-sms_mitigations-8')::uuid, md5('kdra-sms_hazards-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Stage spill kits and require eye protection at the self-serve island',
  'Position spill kits at the self-serve island and require eye protection during self-serve fueling operations.',
  'ppe', '10bd2c31-e693-c4d5-2455-d3af3506d106', '2026-05-10', 'completed',
  '2026-05-09 12:00+00', '10bd2c31-e693-c4d5-2455-d3af3506d106', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-25 09:00+00', '2026-05-09 12:00+00'),

 (md5('kdra-sms_mitigations-9')::uuid, md5('kdra-sms_hazards-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Regrade the north infield low spot and add subsurface drainage',
  'Regrade the ponding low spot on the north infield and install subsurface drainage to eliminate the standing-water bird attractant.',
  'engineering', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-09-15', 'planned',
  NULL, NULL, NULL, 'Scoped into the FY26 drainage project.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-20 09:00+00', '2026-07-20 09:00+00'),

 (md5('kdra-sms_mitigations-10')::uuid, md5('kdra-sms_hazards-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Trigger a post-rain wildlife patrol when standing water is observed',
  'Interim control: dispatch a wildlife patrol whenever standing water is observed on the north infield after rain.',
  'administrative', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-25', 'superseded',
  NULL, NULL, NULL, 'Superseded by an automated rain trigger in the inspection workflow.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-20 09:00+00', '2026-07-22 10:00+00'),

 (md5('kdra-sms_mitigations-11')::uuid, md5('kdra-sms_hazards-13')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Airfield driver recurrent training and movement-area radio protocol',
  'Deliver recurrent training on movement-area boundaries, clearance requirements, and radio protocol for all airfield drivers and escorts.',
  'training', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-05-20', 'completed',
  '2026-05-18 16:00+00', '4f8ab1a5-c662-a906-7ae3-2730db18551f', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-05 09:00+00', '2026-05-18 16:00+00'),

 (md5('kdra-sms_mitigations-12')::uuid, md5('kdra-sms_hazards-13')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Reissue the vehicle escort SOP and audit driving endorsements',
  'Reissue the vehicle escort and clearance SOP and audit all airfield driving endorsements for currency.',
  'administrative', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-05-25', 'completed',
  '2026-05-22 15:00+00', '44cc521d-5850-0faa-8f92-c030a19fce37', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-05 09:00+00', '2026-05-22 15:00+00'),

 (md5('kdra-sms_mitigations-13')::uuid, md5('kdra-sms_hazards-14')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'NOTAM crane operations with daytime-only lifts and a dedicated spotter',
  'Publish a NOTAM for crane operations, restrict lifts to a daytime window with a dedicated spotter, and prohibit lifts during IFR conditions.',
  'administrative', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-25', 'completed',
  '2026-06-22 12:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-21 09:00+00', '2026-06-22 12:00+00'),

 (md5('kdra-sms_mitigations-14')::uuid, md5('kdra-sms_hazards-14')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Establish a temporary displaced threshold during crane lifts',
  'Considered establishing a temporary displaced threshold on RWY 01 during lift windows to increase clearance from the crane.',
  'substitution', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-28', 'rejected',
  NULL, NULL, NULL, 'Rejected — a displaced threshold cuts usable landing distance below operator minimums; mitigated via NOTAM and spotter instead.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-21 09:00+00', '2026-06-24 11:00+00'),

 (md5('kdra-sms_mitigations-15')::uuid, md5('kdra-sms_hazards-15')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Schedule rubber removal and friction rejuvenation on RWY 19',
  'Contract rubber removal and friction rejuvenation of the RWY 19 touchdown and rollout thirds; conduct a continuous-friction survey to confirm restoration.',
  'engineering', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-06-30', 'in_progress',
  NULL, NULL, NULL, 'Vendor quote received; awaiting a weather window. Past due — reflected in the overdue-mitigations SPI.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-05 09:00+00', '2026-07-15 10:00+00'),

 (md5('kdra-sms_mitigations-16')::uuid, md5('kdra-sms_hazards-16')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Update the Snow and Ice Control Plan ramp-edge treatment procedure',
  'Add a defined ramp-edge treatment procedure to the SICP and brief operations staff before the next winter season.',
  'administrative', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-03-15', 'completed',
  '2026-03-14 15:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-02-10 09:00+00', '2026-03-14 15:00+00'),

 (md5('kdra-sms_mitigations-17')::uuid, md5('kdra-sms_hazards-17')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Replace the midfield lighted windsock fixture',
  'Replace the failed midfield windsock light fixture and verify night operation.',
  'engineering', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-07-05', 'completed',
  '2026-07-03 13:00+00', '57a1c585-209a-5012-9983-ff95142a9ff0', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-29 09:00+00', '2026-07-03 13:00+00'),

 (md5('kdra-sms_mitigations-18')::uuid, md5('kdra-sms_hazards-18')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Coordinate a USDA Wildlife Services coyote den survey and removal',
  'Request a USDA Wildlife Services site visit to survey the suspected den near the RWY 19 end and remove or relocate animals as needed.',
  'other', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-10', 'in_progress',
  NULL, NULL, NULL, 'USDA site visit scheduled. Past due — reflected in the overdue-mitigations SPI.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-09 09:00+00', '2026-07-18 10:00+00'),

 (md5('kdra-sms_mitigations-19')::uuid, md5('kdra-sms_hazards-21')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'File an FAA UAS sighting report and coordinate with local law enforcement',
  'Submit the drone sighting to the FAA UAS reporting process and coordinate with local law enforcement on repeat activity near the approach.',
  'administrative', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-05-16', 'completed',
  '2026-05-15 20:00+00', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-14 09:00+00', '2026-05-15 20:00+00'),

 (md5('kdra-sms_mitigations-20')::uuid, md5('kdra-sms_hazards-21')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Add UAS-sighting response steps to the operations shift briefing',
  'Incorporate drone-sighting response steps (notification, traffic advisory, reporting) into the standard operations shift briefing.',
  'training', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-30', 'completed',
  '2026-05-27 15:00+00', 'd3666d88-527f-b006-2afe-96b9573674e2', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-14 09:00+00', '2026-05-27 15:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 4) SAFETY REPORTS  (sms_safety_reports)  SR-0008 .. SR-0037  (30 rows)
--    triage_status enum: new / reviewing / promoted / closed_no_action / duplicate
--    source enum: public_form / internal / email / phone / walk_in
--    category enum per CHECK. Triaged rows -> triaged_by = Sara Lindqvist.
--    Promoted rows (r 1-4) link promoted_hazard_id -> HZ-0010/0011/0013/0021.
--    Triage fields derived from triage_status in the SELECT (single source).
-- ============================================================================
INSERT INTO sms_safety_reports
  (id, base_id, report_code, reporter_name, reporter_email, reporter_phone,
   reporter_role, is_anonymous, category, occurred_at, location_text,
   description, immediate_action, source, triage_status, triaged_by,
   triaged_at, promoted_hazard_id, triage_notes, submitted_at, created_at, updated_at)
SELECT
  r.id, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', r.report_code, r.reporter_name, NULL, NULL,
  r.reporter_role, r.is_anonymous, r.category, r.occurred_at, r.location_text,
  r.description, r.immediate_action, r.source, r.triage_status,
  CASE WHEN r.triage_status IN ('reviewing','promoted','closed_no_action','duplicate')
       THEN 'd3666d88-527f-b006-2afe-96b9573674e2'::uuid ELSE NULL END,
  CASE WHEN r.triage_status IN ('reviewing','promoted','closed_no_action','duplicate')
       THEN r.submitted_at + interval '2 days' + ((r.i % 4) * interval '7 hours') ELSE NULL END,
  r.promoted_hazard_id,
  CASE r.triage_status
    WHEN 'promoted' THEN 'Promoted to the hazard register; SRM assessment initiated.'
    WHEN 'reviewing' THEN 'Under review — gathering additional detail before an SRM decision.'
    WHEN 'closed_no_action' THEN 'Reviewed — no further SMS action required; handled through routine operations or maintenance.'
    WHEN 'duplicate' THEN 'Duplicate of an existing report/hazard; consolidated.'
    ELSE NULL END,
  r.submitted_at, r.submitted_at,
  COALESCE(
    CASE WHEN r.triage_status IN ('reviewing','promoted','closed_no_action','duplicate')
         THEN r.submitted_at + interval '2 days' + ((r.i % 4) * interval '7 hours') END,
    r.submitted_at)
FROM (
  VALUES
   (1, md5('kdra-sms_safety_reports-1')::uuid, 'SR-0008', 'Anthony Ruiz'::text, 'Operations Supervisor'::text, false,
    'runway_incursion'::text, '2026-04-08 14:20+00'::timestamptz, 'TWY A / RWY 19 hold line'::text,
    'Regional turboprop crossed the RWY 19 hold line without a clearance readback during a busy VFR period. No conflict, but the geometry at this intersection repeatedly confuses transient pilots.'::text,
    'Reinforced hold-short instruction on frequency; logged for hot-spot review.'::text, 'internal'::text, 'promoted'::text,
    md5('kdra-sms_hazards-10')::uuid, '2026-04-08 15:10+00'::timestamptz),
   (2, md5('kdra-sms_safety_reports-2')::uuid, 'SR-0009', 'Line service technician', 'Line Service', false,
    'fuel', '2026-04-22 10:05+00', 'Self-serve avgas island, west apron',
    'About one gallon of 100LL spilled during self-serve fueling when the nozzle auto-shutoff failed to trip. Spill kit deployed; no injuries. Recommend an SOP refresher and a containment review.',
    'Deployed spill kit; secured the pump and tagged the nozzle out of service.', 'walk_in', 'promoted',
    md5('kdra-sms_hazards-11')::uuid, '2026-04-22 11:30+00'),
   (3, md5('kdra-sms_safety_reports-3')::uuid, 'SR-0010', 'Danielle Pearce', 'Ops Specialist', false,
    'ground_vehicle', '2026-05-02 20:40+00', 'Movement area near the RWY 01 threshold',
    'A contractor pickup entered the movement area near the RWY 01 threshold after dusk without clearance or an escort. Vehicle recalled immediately. The driver held a lapsed airfield driving endorsement.',
    'Recalled the vehicle; suspended the driver''s access pending re-training.', 'internal', 'promoted',
    md5('kdra-sms_hazards-13')::uuid, '2026-05-02 21:15+00'),
   (4, md5('kdra-sms_safety_reports-4')::uuid, 'SR-0011', NULL, 'Pilot', true,
    'aircraft', '2026-05-14 18:10+00', 'Traffic pattern, ~1.5 NM final RWY 01',
    'Pilot reported a small quadcopter drone hovering near the approach path about 300 ft AGL while on short final to RWY 01, and went around as a precaution. Requesting coordination with local authorities.',
    'Issued a traffic advisory to other pattern traffic.', 'phone', 'promoted',
    md5('kdra-sms_hazards-21')::uuid, '2026-05-14 18:45+00'),
   (5, md5('kdra-sms_safety_reports-5')::uuid, 'SR-0012', NULL, NULL, true,
    'wildlife', NULL, 'RWY 01 approach / east retention pond',
    'Large flock of geese observed loafing near the east stormwater pond around sunset. Concerned about strike risk on the RWY 01 approach.',
    NULL, 'public_form', 'reviewing', NULL, '2026-07-18 07:40+00'),
   (6, md5('kdra-sms_safety_reports-6')::uuid, 'SR-0013', 'Brian Okafor', 'Ops Specialist', false,
    'weather', '2026-07-15 22:30+00', 'RWY 19 rollout',
    'Braking action reported as "fair" by a regional operator on a wet RWY 19 where "good" was expected. Logged for friction-survey follow-up.',
    'Issued a braking-action advisory; queued a friction survey.', 'internal', 'reviewing', NULL, '2026-07-16 06:20+00'),
   (7, md5('kdra-sms_safety_reports-7')::uuid, 'SR-0014', 'Olivia Brenner', 'Ops Specialist', false,
    'equipment', '2026-06-28 03:10+00', 'Midfield windsock',
    'Midfield lighted windsock observed unlit during night inspection. NOTAM issued; maintenance work order opened.',
    'Issued a NOTAM; opened a maintenance work order.', 'internal', 'closed_no_action', NULL, '2026-06-28 04:00+00'),
   (8, md5('kdra-sms_safety_reports-8')::uuid, 'SR-0015', 'Meridian Air Charter dispatcher', 'Tenant / Based Operator', false,
    'procedure', NULL, 'Airport operations',
    'Request for clarification on the after-hours PPR procedure; a scheduled arrival was unsure whether the field was attended. Suggest clearer NOTAM wording.',
    NULL, 'email', 'closed_no_action', NULL, '2026-06-10 13:25+00'),
   (9, md5('kdra-sms_safety_reports-9')::uuid, 'SR-0016', NULL, NULL, true,
    'wildlife', NULL, 'North infield near the RWY 19 end',
    'Coyote seen trotting along the north infield near the RWY 19 end in early morning. Second sighting this week.',
    NULL, 'public_form', 'reviewing', NULL, '2026-07-20 06:15+00'),
   (10, md5('kdra-sms_safety_reports-10')::uuid, 'SR-0017', 'Ramon Castellano', 'ARFF Captain', false,
    'arff', '2026-06-19 09:00+00', 'ARFF station / RWY 01',
    'During a timed response drill, ARFF Truck 2 reached the RWY 01 midpoint in 3:05 — slightly over the 3-minute target. Recommend reviewing the apron gate route.',
    'Logged the response time; scheduled a route review.', 'internal', 'reviewing', NULL, '2026-06-19 10:30+00'),
   (11, md5('kdra-sms_safety_reports-11')::uuid, 'SR-0018', NULL, 'Pilot', true,
    'runway_incursion', NULL, 'RWY 01/19',
    'Reported confusion about which taxiway leads back to the ramp after landing RWY 19; nearly turned onto a closed segment.',
    NULL, 'public_form', 'duplicate', NULL, '2026-07-05 12:00+00'),
   (12, md5('kdra-sms_safety_reports-12')::uuid, 'SR-0019', 'Danielle Pearce', 'Ops Specialist', false,
    'equipment', '2026-05-30 21:45+00', 'TWY A centerline',
    'Cluster of four to five taxiway centerline lights out near the TWY A / RWY 01 intersection. Logged as a discrepancy; recurring pattern.',
    'Opened a discrepancy; routed night taxi via TWY B.', 'internal', 'closed_no_action', NULL, '2026-05-30 22:20+00'),
   (13, md5('kdra-sms_safety_reports-13')::uuid, 'SR-0020', NULL, NULL, true,
    'other', NULL, 'Terminal apron',
    'A pedestrian (appeared to be a passenger) walked onto the apron unescorted from the terminal side. Someone should check the gate.',
    NULL, 'public_form', 'reviewing', NULL, '2026-07-21 15:30+00'),
   (14, md5('kdra-sms_safety_reports-14')::uuid, 'SR-0021', 'Based aircraft owner', 'Based Operator', false,
    'wildlife', NULL, 'South tie-downs',
    'Several deer grazing near the south tie-downs at dawn; a fence gap is suspected on the south boundary.',
    NULL, 'walk_in', 'reviewing', NULL, '2026-07-12 07:10+00'),
   (15, md5('kdra-sms_safety_reports-15')::uuid, 'SR-0022', 'Anthony Ruiz', 'Operations Supervisor', false,
    'aircraft', '2026-07-08 16:40+00', 'RWY 01/19',
    'Two aircraft on slightly compressed final spacing during a busy fly-in; no loss of separation, but worth noting for traffic-management practice at events.',
    'Adjusted sequencing; briefed for future events.', 'internal', 'closed_no_action', NULL, '2026-07-08 17:20+00'),
   (16, md5('kdra-sms_safety_reports-16')::uuid, 'SR-0023', NULL, NULL, true,
    'fuel', NULL, 'Self-serve fuel island',
    'The self-serve card reader intermittently rejects cards; pilots idle near the pump longer than necessary.',
    NULL, 'public_form', 'closed_no_action', NULL, '2026-06-22 11:15+00'),
   (17, md5('kdra-sms_safety_reports-17')::uuid, 'SR-0024', 'Olivia Brenner', 'Ops Specialist', false,
    'ground_vehicle', '2026-07-02 13:20+00', 'Perimeter road / TWY B',
    'A mowing contractor crossed TWY B without radio contact. Reoriented on the spot; recommend reinforcing radio protocol at the pre-work brief.',
    'Stopped the crossing; re-briefed the contractor.', 'internal', 'reviewing', NULL, '2026-07-02 14:05+00'),
   (18, md5('kdra-sms_safety_reports-18')::uuid, 'SR-0025', 'Tenant FBO manager', 'Tenant / FBO', false,
    'procedure', NULL, 'FBO ramp',
    'Suggestion to add a painted pedestrian walkway from the FBO door to transient parking to reduce ramp foot traffic near taxiing aircraft.',
    NULL, 'email', 'new', NULL, '2026-07-22 09:30+00'),
   (19, md5('kdra-sms_safety_reports-19')::uuid, 'SR-0026', NULL, NULL, true,
    'weather', NULL, 'North infield',
    'During last week''s thunderstorms, standing water pooled on the north infield and stayed for a day, attracting birds.',
    NULL, 'public_form', 'reviewing', NULL, '2026-07-19 08:50+00'),
   (20, md5('kdra-sms_safety_reports-20')::uuid, 'SR-0027', 'Brian Okafor', 'Ops Specialist', false,
    'equipment', '2026-06-14 04:30+00', 'RWY 01 PAPI',
    'RWY 01 PAPI appeared to have one unit slightly off-color during the night check; flagged for a photometric check.',
    'Flagged for a photometric check.', 'internal', 'closed_no_action', NULL, '2026-06-14 05:10+00'),
   (21, md5('kdra-sms_safety_reports-21')::uuid, 'SR-0028', NULL, NULL, true,
    'other', NULL, 'Terminal / landside',
    'General comment: the airport looks well maintained lately — the new hold-line markings are much clearer.',
    NULL, 'public_form', 'closed_no_action', NULL, '2026-07-01 19:00+00'),
   (22, md5('kdra-sms_safety_reports-22')::uuid, 'SR-0029', 'Danielle Pearce', 'Ops Specialist', false,
    'runway_incursion', '2026-07-14 11:05+00', 'RWY 19 hold short TWY A',
    'A vehicle held short slightly past the enhanced hold line while awaiting clearance. No conflict; recommend reinforcing the stop position at driver training.',
    'Repositioned the vehicle; noted for driver training.', 'internal', 'reviewing', NULL, '2026-07-14 11:50+00'),
   (23, md5('kdra-sms_safety_reports-23')::uuid, 'SR-0030', 'USDA Wildlife Services technician', 'USDA Wildlife Services', false,
    'wildlife', '2026-07-10 06:30+00', 'RWY 01 approach / east pond',
    'Confirmed goose dispersal action near the east pond; recommend adding a second propane cannon south of the pond.',
    'Dispersed the flock; logged to the WHMP.', 'walk_in', 'reviewing', NULL, '2026-07-10 08:15+00'),
   (24, md5('kdra-sms_safety_reports-24')::uuid, 'SR-0031', 'Ramon Castellano', 'ARFF Captain', false,
    'arff', NULL, 'Fuel farm',
    'Request for additional spill-response training for line staff following the recent minor spill at the self-serve island.',
    NULL, 'internal', 'closed_no_action', NULL, '2026-05-18 10:40+00'),
   (25, md5('kdra-sms_safety_reports-25')::uuid, 'SR-0032', NULL, 'Pilot', true,
    'procedure', NULL, 'NOTAM / TWY B',
    'The partial TWY B closure NOTAM was hard to interpret; it was unclear which segment was closed.',
    NULL, 'public_form', 'duplicate', NULL, '2026-06-26 14:10+00'),
   (26, md5('kdra-sms_safety_reports-26')::uuid, 'SR-0033', NULL, 'Pilot', true,
    'aircraft', '2026-07-17 12:25+00', 'RWY 01',
    'Reported a possible bird strike on departure from RWY 01 — no aircraft damage noted, but wanted it on record for the strike log.',
    'Inspected the runway; logged to the strike record.', 'phone', 'reviewing', NULL, '2026-07-17 13:00+00'),
   (27, md5('kdra-sms_safety_reports-27')::uuid, 'SR-0034', 'Anthony Ruiz', 'Operations Supervisor', false,
    'ground_vehicle', '2026-07-06 09:15+00', 'West apron',
    'A fuel truck parked briefly within the aircraft movement path on the west apron. Relocated; reminder issued.',
    'Relocated the truck; issued a reminder.', 'internal', 'closed_no_action', NULL, '2026-07-06 10:00+00'),
   (28, md5('kdra-sms_safety_reports-28')::uuid, 'SR-0035', 'Olivia Brenner', 'Ops Specialist', false,
    'equipment', '2026-07-20 21:30+00', 'RWY 19 threshold',
    'One RWY 19 threshold light appeared dim during night inspection; a work order was opened.',
    'Opened a maintenance work order.', 'internal', 'new', NULL, '2026-07-20 22:10+00'),
   (29, md5('kdra-sms_safety_reports-29')::uuid, 'SR-0036', 'Brian Okafor', 'Ops Specialist', false,
    'weather', '2026-07-21 05:00+00', 'Airfield-wide',
    'Dense ground fog reduced visibility below 1/2 SM at dawn; delayed the morning self-inspection by 40 minutes. Logged for pattern tracking.',
    'Delayed the inspection until visibility improved.', 'internal', 'new', NULL, '2026-07-21 06:30+00'),
   (30, md5('kdra-sms_safety_reports-30')::uuid, 'SR-0037', NULL, NULL, true,
    'other', NULL, 'Airport operations',
    'Anonymous concern that after-hours operations sometimes proceed without anyone clearly on duty to respond to issues.',
    NULL, 'public_form', 'new', NULL, '2026-07-22 23:10+00')
) AS r(i, id, report_code, reporter_name, reporter_role, is_anonymous, category,
       occurred_at, location_text, description, immediate_action, source,
       triage_status, promoted_hazard_id, submitted_at)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 5) SPIs  (sms_spis)  SPI-007, SPI-008  (2 new; total becomes 8)
--    Parent for the new measurements. Existing SPI-001..006 already present.
-- ============================================================================
INSERT INTO sms_spis
  (id, base_id, code, title, description, unit, target_value, target_direction,
   alert_threshold, computation_key, measurement_frequency, active,
   created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_spis-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'SPI-007',
  'Runway Incursions (rolling 12-month count)',
  'Count of confirmed runway incursions (pilot deviation, vehicle/pedestrian deviation, or operational deviation) over the trailing 12 months.',
  'count', 0, 'lower', 2, NULL, 'monthly', true,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-01-28 12:00+00', '2026-07-01 12:00+00'),
 (md5('kdra-sms_spis-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'SPI-008',
  'Safety Reports Triaged within 5 Business Days (%)',
  'Percent of submitted safety reports that reach an initial triage decision within five business days — a measure of reporting-system responsiveness and just-culture engagement.',
  'percent', 90, 'higher', 75, NULL, 'monthly', true,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2',
  '2026-01-28 12:00+00', '2026-07-01 12:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 6) SPI MEASUREMENTS  (sms_spi_measurements)  30 rows
--    UNIQUE (spi_id, period_start, period_end). Existing SPI-001..006 already
--    have May/Jun/Jul; here we BACKFILL Feb/Mar/Apr for them (new rows, no
--    collision) and add the full Feb..Jul series for the 2 new SPIs -> a clean
--    6-month trend across all 8 SPIs for the charts.
--    Status vs target/alert: lower -> <=target on_target / <alert warning /
--    >=alert alert;  higher -> >=target on_target / >alert warning / <=alert alert.
--    id = md5('kdra-meas-'||spi_id||'-'||period_start). created_at ~ period start.
-- ============================================================================
INSERT INTO sms_spi_measurements
  (id, spi_id, base_id, period_start, period_end, value, status, computed_by, created_at)
SELECT
  md5('kdra-meas-' || m.spi_id::text || '-' || m.period_start::text)::uuid,
  m.spi_id, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', m.period_start, m.period_end,
  m.value, m.status, m.computed_by, (m.period_start::timestamptz + interval '2 hours 30 minutes')
FROM (
  VALUES
   -- SPI-001 wildlife strikes/1k ops (lower; target 1, alert 2): spring low, feeds into existing 0,0 (May,Jun) and Jul spike
   ('73366c12-7e58-4c8c-a276-b4fc49cdf1fa'::uuid, '2026-02-01'::date, '2026-02-28'::date, 1.5::numeric, 'warning'::text, 'cron'::text),
   ('73366c12-7e58-4c8c-a276-b4fc49cdf1fa', '2026-03-01', '2026-03-31', 1.0, 'on_target', 'cron'),
   ('73366c12-7e58-4c8c-a276-b4fc49cdf1fa', '2026-04-01', '2026-04-30', 0.5, 'on_target', 'cron'),
   -- SPI-002 open safety discrepancies >30d (lower; target 0, alert 3): improving toward existing 0s
   ('64447d32-4902-47b4-84cc-4d93d4dac468', '2026-02-01', '2026-02-28', 4, 'alert', 'cron'),
   ('64447d32-4902-47b4-84cc-4d93d4dac468', '2026-03-01', '2026-03-31', 2, 'warning', 'cron'),
   ('64447d32-4902-47b4-84cc-4d93d4dac468', '2026-04-01', '2026-04-30', 1, 'warning', 'cron'),
   -- SPI-003 daily self-inspection completion % (higher; target 100, alert 95): consistent with existing low/alert series
   ('1152b900-cb4d-42bf-b836-68e9cd5f5ebe', '2026-02-01', '2026-02-28', 0.0, 'alert', 'cron'),
   ('1152b900-cb4d-42bf-b836-68e9cd5f5ebe', '2026-03-01', '2026-03-31', 0.0, 'alert', 'cron'),
   ('1152b900-cb4d-42bf-b836-68e9cd5f5ebe', '2026-04-01', '2026-04-30', 4.0, 'alert', 'cron'),
   -- SPI-004 overdue mitigations % (lower; target 0, alert 10): clean spring, spikes later (existing Jun/Jul 50)
   ('1524ab81-8390-43e4-8380-c44a243394b7', '2026-02-01', '2026-02-28', 0, 'on_target', 'cron'),
   ('1524ab81-8390-43e4-8380-c44a243394b7', '2026-03-01', '2026-03-31', 0, 'on_target', 'cron'),
   ('1524ab81-8390-43e4-8380-c44a243394b7', '2026-04-01', '2026-04-30', 0, 'on_target', 'cron'),
   -- SPI-005 AEP full-scale drill overdue (lower; target 0, alert 1): was overdue, drill done, resolved by Jun
   ('6d922f73-bf39-426b-97d4-1baf59deb918', '2026-02-01', '2026-02-28', 1, 'alert', 'cron'),
   ('6d922f73-bf39-426b-97d4-1baf59deb918', '2026-03-01', '2026-03-31', 1, 'alert', 'cron'),
   ('6d922f73-bf39-426b-97d4-1baf59deb918', '2026-04-01', '2026-04-30', 1, 'alert', 'cron'),
   -- SPI-006 AEP comms checks last 90d (higher; target 3, alert 1): slowly improving
   ('4a635fef-f804-446a-a157-99054cd57f4a', '2026-02-01', '2026-02-28', 0, 'alert', 'cron'),
   ('4a635fef-f804-446a-a157-99054cd57f4a', '2026-03-01', '2026-03-31', 1, 'alert', 'cron'),
   ('4a635fef-f804-446a-a157-99054cd57f4a', '2026-04-01', '2026-04-30', 2, 'warning', 'cron'),
   -- SPI-007 runway incursions rolling 12mo (lower; target 0, alert 2): improving trend Feb..Jul
   (md5('kdra-sms_spis-7')::uuid, '2026-02-01', '2026-02-28', 3, 'alert', 'manual'),
   (md5('kdra-sms_spis-7')::uuid, '2026-03-01', '2026-03-31', 3, 'alert', 'manual'),
   (md5('kdra-sms_spis-7')::uuid, '2026-04-01', '2026-04-30', 2, 'alert', 'manual'),
   (md5('kdra-sms_spis-7')::uuid, '2026-05-01', '2026-05-31', 1, 'warning', 'manual'),
   (md5('kdra-sms_spis-7')::uuid, '2026-06-01', '2026-06-30', 1, 'warning', 'manual'),
   (md5('kdra-sms_spis-7')::uuid, '2026-07-01', '2026-07-31', 0, 'on_target', 'manual'),
   -- SPI-008 reports triaged within 5 business days % (higher; target 90, alert 75): improving trend Feb..Jul
   (md5('kdra-sms_spis-8')::uuid, '2026-02-01', '2026-02-28', 68, 'alert', 'manual'),
   (md5('kdra-sms_spis-8')::uuid, '2026-03-01', '2026-03-31', 74, 'alert', 'manual'),
   (md5('kdra-sms_spis-8')::uuid, '2026-04-01', '2026-04-30', 80, 'warning', 'manual'),
   (md5('kdra-sms_spis-8')::uuid, '2026-05-01', '2026-05-31', 86, 'warning', 'manual'),
   (md5('kdra-sms_spis-8')::uuid, '2026-06-01', '2026-06-30', 92, 'on_target', 'manual'),
   (md5('kdra-sms_spis-8')::uuid, '2026-07-01', '2026-07-31', 96, 'on_target', 'manual')
) AS m(spi_id, period_start, period_end, value, status, computed_by)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 7) AUDITS  (sms_audits)  AUD-0002 .. AUD-0005  (4 rows)
--    audit_type: internal / external / self_assessment. status enum per CHECK.
--    findings jsonb mirrors existing shape: {id,title,status,severity,closed_at,notes}.
--    findings_open / findings_closed reconcile with the findings array.
-- ============================================================================
INSERT INTO sms_audits
  (id, base_id, audit_code, title, audit_type, scope, scheduled_date,
   performed_date, performed_by, status, findings, findings_open,
   findings_closed, report_url, notes, created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_audits-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AUD-0002',
  'Q2 2026 internal SMS audit', 'internal',
  'Sampled the SRM workflow, hazard-to-mitigation traceability, and SPI review cadence for Q2.',
  '2026-06-08', '2026-06-18', 'd3666d88-527f-b006-2afe-96b9573674e2', 'completed',
  '[{"id":"a1f0c2e4-0001-4a00-9000-000000000001","title":"SPI-003 self-inspection completion metric under-reporting due to a data-source gap","status":"open","severity":"major","notes":"Root cause: inspection completion is not consistently flagged; corrective action assigned to Operations."},
    {"id":"a1f0c2e4-0001-4a00-9000-000000000002","title":"Two mitigations past due without documented interim controls","status":"closed","severity":"minor","closed_at":"2026-07-01","notes":"Interim controls documented and due dates renegotiated."},
    {"id":"a1f0c2e4-0001-4a00-9000-000000000003","title":"Hazard closure rationale missing on one sampled closed hazard","status":"closed","severity":"observation","closed_at":"2026-06-30","notes":"Rationale added; the closure checklist was updated."}]'::jsonb,
  1, 2, NULL, 'Two findings closed within two weeks; one open finding tracked to completion.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-19 10:00+00', '2026-07-15 10:00+00'),

 (md5('kdra-sms_audits-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AUD-0003',
  'Wildlife Hazard Management Plan self-assessment', 'self_assessment',
  'Reviewed WHMP implementation against 14 CFR §139.337 — dispersal logging, habitat management, and strike reporting.',
  '2026-04-28', '2026-05-05', '44cc521d-5850-0faa-8f92-c030a19fce37', 'completed',
  '[{"id":"a1f0c2e4-0003-4a00-9000-000000000001","title":"Strike-report submissions to the FAA database lagging by about two weeks","status":"closed","severity":"minor","closed_at":"2026-05-20","notes":"A weekly submission cadence was established."},
    {"id":"a1f0c2e4-0003-4a00-9000-000000000002","title":"Habitat log missing entries for two dispersal events","status":"closed","severity":"observation","closed_at":"2026-05-18","notes":"Retroactive entries added; the field form was updated."}]'::jsonb,
  0, 2, NULL, 'WHMP implementation is on track; both findings closed within three weeks.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-06 10:00+00', '2026-05-21 10:00+00'),

 (md5('kdra-sms_audits-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AUD-0004',
  'External SMS gap assessment (independent consultant)', 'external',
  'Independent review of SMS maturity against 14 CFR Part 5 and AC 150/5200-37A ahead of the annual management review.',
  '2026-07-15', NULL, NULL, 'in_progress',
  '[]'::jsonb, 0, 0, NULL, 'Fieldwork underway; a draft report is expected in early August.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-10 10:00+00', '2026-07-21 10:00+00'),

 (md5('kdra-sms_audits-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AUD-0005',
  'Q3 2026 internal SMS audit', 'internal',
  'Planned quarterly internal audit of the SRM register, management-of-change records, and safety communications.',
  '2026-09-21', NULL, NULL, 'scheduled',
  '[]'::jsonb, 0, 0, NULL, 'Scheduled for Q3.',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-16 10:00+00', '2026-07-16 10:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 8) MANAGEMENT OF CHANGE  (sms_management_of_change)  MOC-0002 .. MOC-0004  (3)
--    change_category / status enums per CHECK. linked_hazard_id FK -> hazards.
--    proposed_by/approved_by/created_by FK -> auth.users (roster).
-- ============================================================================
INSERT INTO sms_management_of_change
  (id, base_id, moc_code, title, change_description, change_category, triggered_by,
   proposed_by, proposed_at, effective_date, status, linked_hazard_id,
   risk_analysis_summary, approved_by, approved_at, approval_notes,
   rejection_reason, created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_management_of_change-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOC-0002',
  'Revise the daily self-inspection checklist for SMS hazard capture',
  'Update the daily self-inspection checklist to add structured prompts for FOD, wildlife attractants, and marking/lighting condition so hazards are captured consistently and flow into the SRM register.',
  'procedural', 'Q1 internal audit recommendation',
  'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-02 10:00+00', '2026-05-01', 'implemented',
  md5('kdra-sms_hazards-8')::uuid,
  'Low residual risk; the change adds structured prompts with no adverse operational impact and improves hazard capture.',
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-04-10 15:00+00',
  'Approved; roll out at the May shift briefings.', NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-02 10:00+00', '2026-05-01 12:00+00'),

 (md5('kdra-sms_management_of_change-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOC-0003',
  'Upgrade the self-serve fuel island spill containment',
  'Add a containment berm and upgraded auto-shutoff nozzles at the self-serve avgas island to reduce spill likelihood following the recent minor 100LL spill.',
  'facility', 'Safety report SR-0009 (fuel spill)',
  'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-05 09:00+00', NULL, 'pending_approval',
  md5('kdra-sms_hazards-11')::uuid,
  'Containment berm plus upgraded auto-shutoff nozzles reduces spill likelihood; capital cost estimate pending before approval.',
  NULL, NULL, NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-05 09:00+00', '2026-07-18 11:00+00'),

 (md5('kdra-sms_management_of_change-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOC-0004',
  'Temporary crane operations near the RWY 01 approach surface',
  'Authorize contractor crane operations for the terminal-roof project that penetrate the RWY 01 approach surface, under defined operational controls.',
  'operational', 'Contractor terminal-roof project',
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-20 11:00+00', '2026-07-01', 'approved',
  md5('kdra-sms_hazards-14')::uuid,
  'Penetrates the approach surface during lifts; mitigated by a daytime-only NOTAM window, a dedicated spotter, and no lifts during IFR conditions.',
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-27 14:00+00',
  'Approved with conditions: NOTAM, dedicated spotter, and no lifts during IFR.', NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-20 11:00+00', '2026-06-27 14:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 9) SAFETY COMMUNICATIONS  (sms_communications)  6 rows  (table was empty)
--    channel: bulletin / newsletter / training / briefing / email / other.
--    related_hazard_id FK -> hazards (C1 links the EXISTING goose hazard).
-- ============================================================================
INSERT INTO sms_communications
  (id, base_id, title, body, channel, audience, published_at, attachment_url,
   related_hazard_id, created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-sms_communications-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Spring Wildlife Advisory: Goose Activity on the RWY 01 Approach',
  'Canada geese are congregating near the east stormwater pond during spring migration. Expect dispersal operations at dawn and dusk. Report large flocks near the approach to Airport Operations. Habitat management and additional propane cannons are being deployed under the Wildlife Hazard Management Plan.',
  'bulletin', 'All operations staff and based operators', '2026-04-15 13:00+00', NULL,
  'c060b348-7f45-4cad-afde-54b49e97aaf1',
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-04-15 13:00+00', '2026-04-15 13:00+00'),

 (md5('kdra-sms_communications-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Hot Spot Awareness: TWY A / RWY 19 Hold Line',
  'A recurring hot spot exists where Taxiway A meets the RWY 19 hold line. Enhanced surface markings and an elevated holding-position sign have been installed. Come to a full stop at the hold line and obtain clearance before crossing. Pilots and airfield drivers, please brief this location.',
  'briefing', 'Pilots, tenants, and airfield drivers', '2026-05-20 12:00+00', NULL,
  md5('kdra-sms_hazards-10')::uuid,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-20 12:00+00', '2026-05-20 12:00+00'),

 (md5('kdra-sms_communications-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'DRA Safety Digest — Q2 2026',
  'Quarterly safety summary: two hazards moved to controlled, the wildlife strike rate held near target through spring, the self-serve fueling SOP was refreshed, and the enhanced hold-line markings were completed. Thank you for more than forty safety reports this quarter — every report strengthens the program.',
  'newsletter', 'All personnel', '2026-06-30 16:00+00', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-30 16:00+00', '2026-06-30 16:00+00'),

 (md5('kdra-sms_communications-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Airfield Driver Recurrent Training — Movement Area Protocol',
  'Recurrent training for all airfield drivers and escorts covers movement-area boundaries, radio protocol, and clearance requirements. Complete this before your next escorted operation. Driving endorsements are being audited this month.',
  'training', 'Airfield drivers and escorts', '2026-05-10 09:00+00', NULL,
  md5('kdra-sms_hazards-13')::uuid,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-05-10 09:00+00', '2026-05-10 09:00+00'),

 (md5('kdra-sms_communications-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Fuel Handling SOP Reminder — Self-Serve Island',
  'Following a minor 100LL spill, please review the self-serve fueling SOP: verify the auto-shutoff, keep a hand on the nozzle, and know the spill-kit location. Report any equipment faults immediately. Eye protection is now required at the island.',
  'email', 'Line service staff and self-serve users', '2026-06-05 10:30+00', NULL,
  md5('kdra-sms_hazards-11')::uuid,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-06-05 10:30+00', '2026-06-05 10:30+00'),

 (md5('kdra-sms_communications-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae',
  'Just Culture and Non-Retribution Reporting Reminder',
  'Our Safety Management System depends on open reporting. Reports made in good faith will not result in disciplinary action, consistent with our Safety Policy and 14 CFR §139.401. If you see a hazard, report it — anonymously if you prefer.',
  'bulletin', 'All personnel', '2026-07-10 08:00+00', NULL, NULL,
  'd3666d88-527f-b006-2afe-96b9573674e2', 'd3666d88-527f-b006-2afe-96b9573674e2', '2026-07-10 08:00+00', '2026-07-10 08:00+00')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 10) POLICIES  (sms_policies)  — INTENTIONALLY NOT SEEDED. See summary note.
--    Existing: v1 (active, signed) + v2 (draft revision) = a coherent
--    "policy with a revision in progress" state. The table is a versioned
--    singleton: fetchActivePolicy() expects exactly ONE row with status
--    'active'. Under the INSERT-only rule we cannot supersede v1 (that needs an
--    UPDATE), so adding another version would create either a second 'active'
--    policy or an out-of-order superseded version. Left as-is by design.
-- ============================================================================

COMMIT;
