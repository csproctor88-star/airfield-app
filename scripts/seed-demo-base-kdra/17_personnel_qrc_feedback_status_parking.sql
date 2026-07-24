-- ============================================================================
-- KDRA Demo Seed — CLUSTER H
-- Personnel on Airfield + QRC + Customer Feedback + Status board + Parking
-- Base: Demo Regional Airport (KDRA)  base_id = ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- "Today" = 2026-07-23.  Civilian FAA Part 139 voice.  INSERT-only, idempotent.
--
-- Enum/value provenance:
--   airfield_contractors.status  CHECK  active|completed
--   qrc_executions.status        CHECK  open|closed
--   customer_feedback.overall_rating CHECK 1..5
--   parking_spots.spot_type      CHECK  apron|ramp|transient
--   parking_spots.status         CHECK  occupied|available|reserved
--   runway_status_log.new_runway_status : open|closed|restricted|suspended (sampled)
--   runway_status_log advisory_type     : WATCH|WARNING|ADVISORY (app/(app)/page.tsx)
--   arff_status_log.new_readiness        : optimum|reduced|critical|inadequate (app/(app)/page.tsx:2407)
--   bwc_history.bwc_value                : LOW|MOD|SEV|PROHIB (sampled distinct)
--   af_form_483 field = civilian SIDA badge # / expiry (contractors page credentialLabel);
--   flag_number field = "Vehicle Escort" flag (contractors page)
-- No UNIQUE constraints beyond PK on any target table -> md5 id + ON CONFLICT (id) DO NOTHING.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) airfield_contractors  (Personnel on Airfield) — 20 rows, mix active/completed
--    Badges: mix of valid (future) + expired to exercise the "EXPIRED" warning.
-- ---------------------------------------------------------------------------
INSERT INTO airfield_contractors
  (id, base_id, company_name, contact_name, location, work_description, status,
   start_date, end_date, notes, callsign, flag_number, contact_phone,
   af_form_483, af_form_483_expiration, created_by, created_at, updated_at)
VALUES
 (md5('kdra-contractors-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Great Lakes Line Striping', 'R. Alvarez', 'West apron', 'Apron edge line and centerline remarking', 'active', '2026-07-14', NULL, 'Escorted through movement area by Ops.', 'PAINT 1', NULL, '(586) 555-0104', 'SIDA-2026-0101', '2026-12-31', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-14T13:20:00Z', '2026-07-14T13:20:00Z'),
 (md5('kdra-contractors-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Meridian Mechanical', 'T. Nguyen', 'Terminal ramp', 'Terminal HVAC replacement, mechanical room', 'active', '2026-07-09', NULL, NULL, NULL, NULL, '(586) 555-0112', 'SIDA-2026-0102', '2027-01-31', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-07-09T15:05:00Z', '2026-07-09T15:05:00Z'),
 (md5('kdra-contractors-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Harbor City Electric', 'D. Kowalski', 'TWY A', 'Taxiway A edge light circuit fault isolation', 'active', '2026-07-18', NULL, 'Working under NOTAM; night access coordinated.', 'SPARK 2', NULL, '(586) 555-0119', 'SIDA-2026-0103', '2026-11-30', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-07-18T22:40:00Z', '2026-07-18T22:40:00Z'),
 (md5('kdra-contractors-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Northgate Fence & Gate', 'S. Petrov', 'Perimeter — south', 'Perimeter fence repair and gate actuator replacement', 'active', '2026-07-06', NULL, NULL, NULL, 'VE-114', '(586) 555-0126', 'SIDA-2026-0104', '2026-10-31', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-06T14:10:00Z', '2026-07-06T14:10:00Z'),
 (md5('kdra-contractors-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Clearview Glass & Glazing', 'J. Barnes', 'Terminal', 'Terminal window glazing replacement', 'completed', '2026-05-19', '2026-05-30', 'Landside; escorted for SIDA-side panels only.', NULL, NULL, '(586) 555-0133', 'SIDA-2026-0089', '2026-06-30', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-05-19T13:00:00Z', '2026-05-30T21:00:00Z'),
 (md5('kdra-contractors-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Summit Roofing Contractors', 'L. Mercer', 'Maintenance hangar', 'Hangar roof membrane recoat', 'completed', '2026-04-14', '2026-05-02', NULL, NULL, NULL, '(586) 555-0141', 'SIDA-2026-0072', '2026-05-31', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-04-14T12:30:00Z', '2026-05-02T20:15:00Z'),
 (md5('kdra-contractors-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'BlueSky Aviation Fueling', 'P. Osei', 'Fuel farm', 'Fuel farm tank inspection and valve service', 'active', '2026-07-11', NULL, 'Hot-work permit on file.', 'FUEL 3', NULL, '(586) 555-0150', 'SIDA-2026-0105', '2027-02-28', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-11T16:45:00Z', '2026-07-11T16:45:00Z'),
 (md5('kdra-contractors-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Cornerstone Concrete', 'M. Delacroix', 'North apron', 'Apron slab joint reseal, tie-down rows C–E', 'active', '2026-07-15', NULL, 'Rows C–E cordoned during cure.', 'CONC 1', 'VE-121', '(586) 555-0158', 'SIDA-2026-0106', '2026-12-15', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-15T13:50:00Z', '2026-07-15T13:50:00Z'),
 (md5('kdra-contractors-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Titan Crane & Rigging', 'R. Iqbal', 'East ramp', 'Crane lift for rooftop unit set — escort required', 'active', '2026-07-21', NULL, 'Crane height notified; escorted at all times.', 'CRANE 1', 'VE-127', '(586) 555-0165', 'SIDA-2026-0107', '2026-08-31', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-21T11:20:00Z', '2026-07-21T11:20:00Z'),
 (md5('kdra-contractors-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'EverGreen Landscaping', 'K. Owusu', 'Infield — west', 'Seasonal mowing and vegetation control', 'active', '2026-06-30', NULL, 'Coordinate BWC before infield ops.', 'MOW 1', NULL, '(586) 555-0172', 'SIDA-2026-0095', '2026-07-10', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-06-30T12:00:00Z', '2026-07-16T12:00:00Z'),
 (md5('kdra-contractors-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Precision Pavement Marking', 'H. Vogel', 'Runway 01/19', 'Hold-position marking refresh, TWY B', 'completed', '2026-07-08', '2026-07-11', 'Daytime verification completed.', 'PAINT 2', NULL, '(586) 555-0180', 'SIDA-2026-0098', '2026-09-30', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-08T14:00:00Z', '2026-07-11T19:30:00Z'),
 (md5('kdra-contractors-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Delta Fire Systems', 'C. Nakamura', 'ARFF station', 'Fire suppression system annual inspection', 'completed', '2026-06-02', '2026-06-04', NULL, NULL, NULL, '(586) 555-0188', 'SIDA-2026-0081', '2026-12-31', '10bd2c31-e693-c4d5-2455-d3af3506d106', '2026-06-02T13:15:00Z', '2026-06-04T18:00:00Z'),
 (md5('kdra-contractors-13')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Anchor Fence Co.', 'B. Salazar', 'Perimeter — north', 'Wildlife exclusion fence base burial', 'active', '2026-07-17', NULL, 'Part 139 wildlife perimeter integrity.', NULL, 'VE-133', '(586) 555-0195', 'SIDA-2026-0108', '2026-11-15', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-07-17T13:30:00Z', '2026-07-17T13:30:00Z'),
 (md5('kdra-contractors-14')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Riverside Excavating', 'D. Toma', 'Infield — east', 'Storm drainage culvert replacement', 'active', '2026-07-12', NULL, 'Open excavation marked and lit.', 'DIG 1', 'VE-136', '(586) 555-0203', 'SIDA-2026-0109', '2026-10-15', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-12T12:45:00Z', '2026-07-12T12:45:00Z'),
 (md5('kdra-contractors-15')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'ProAir HVAC', 'E. Lindgren', 'SRE building', 'Rooftop unit replacement, SRE building', 'completed', '2026-03-10', '2026-03-19', NULL, NULL, NULL, '(586) 555-0210', 'SIDA-2026-0064', '2026-04-30', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-03-10T13:00:00Z', '2026-03-19T17:45:00Z'),
 (md5('kdra-contractors-16')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Beacon Signage', 'A. Ferreira', 'Movement area', 'Taxiway guidance sign panel replacement', 'active', '2026-07-19', NULL, 'Signs on movement area; escort + NOTAM.', 'SIGN 1', 'VE-140', '(586) 555-0218', 'SIDA-2026-0110', '2026-12-31', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-07-19T14:25:00Z', '2026-07-19T14:25:00Z'),
 (md5('kdra-contractors-17')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Metro Waste Services', 'G. Okonkwo', 'Landside', 'Waste and recycling collection, badged escort route', 'active', '2026-06-25', NULL, 'Recurring; landside only.', NULL, NULL, '(586) 555-0225', 'SIDA-2026-0092', '2027-01-31', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-06-25T11:00:00Z', '2026-06-25T11:00:00Z'),
 (md5('kdra-contractors-18')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Ironclad Security Integrators', 'V. Kessler', 'Terminal / SIDA', 'Access control reader upgrade, SIDA doors', 'active', '2026-07-16', NULL, 'Coordinated with airport security.', NULL, NULL, '(586) 555-0232', 'SIDA-2026-0111', '2026-10-31', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-16T15:40:00Z', '2026-07-16T15:40:00Z'),
 (md5('kdra-contractors-19')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Cascade Painting', 'N. Reyes', 'Terminal', 'Interior repaint, gate hold rooms', 'completed', '2026-02-17', '2026-02-27', NULL, NULL, NULL, '(586) 555-0240', 'SIDA-2026-0051', '2026-03-31', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-02-17T12:20:00Z', '2026-02-27T16:00:00Z'),
 (md5('kdra-contractors-20')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'AeroFuel Services LLC', 'F. Haddad', 'Fuel farm', 'Hydrant fueling pit maintenance', 'active', '2026-07-20', NULL, 'Hot-work permit; fuel farm access.', 'FUEL 4', NULL, '(586) 555-0247', 'SIDA-2026-0112', '2027-02-28', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-20T13:10:00Z', '2026-07-20T13:10:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) qrc_executions — 12 runs referencing real qrc_templates (qrc_number/title matched)
--    Mix closed (with closed_at >= opened_at, initials) + open. step_responses default {}.
-- ---------------------------------------------------------------------------
INSERT INTO qrc_executions
  (id, base_id, template_id, qrc_number, title, status,
   opened_by, opened_at, open_initials, closed_by, closed_at, close_initials,
   step_responses, remarks, created_at, updated_at)
VALUES
 (md5('kdra-qrc-exec-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'bb957a55-5de5-409e-995f-53a668d91ca1', 2, 'In-Flight Emergency', 'closed', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-02-11T15:42:00Z', 'MD', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-02-11T16:20:00Z', 'MD', '{}'::jsonb, 'Inbound Part 135 King Air declared rough-running engine; precautionary landing RWY 19, ARFF standby, uneventful.', '2026-02-11T15:42:00Z', '2026-02-11T16:20:00Z'),
 (md5('kdra-qrc-exec-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'b9730cfc-d424-4c76-a540-55cfa75d8d69', 6, 'Bird or Wildlife Strike', 'closed', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-03-04T13:05:00Z', 'DP', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-03-04T14:10:00Z', 'DP', '{}'::jsonb, 'Departing Citation reported bird strike on climb-out RWY 01. Runway inspection completed, remains removed, strike report filed.', '2026-03-04T13:05:00Z', '2026-03-04T14:10:00Z'),
 (md5('kdra-qrc-exec-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'a5c5f966-8c30-473e-a472-d90360916f4c', 8, 'Severe Weather and Lightning', 'closed', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-03-22T19:30:00Z', 'BO', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-03-22T21:05:00Z', 'BO', '{}'::jsonb, 'Line of thunderstorms within 5 NM. Ramp operations suspended, personnel sheltered until lightning cleared.', '2026-03-22T19:30:00Z', '2026-03-22T21:05:00Z'),
 (md5('kdra-qrc-exec-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'e184f9d7-a984-4dbc-9fc7-fbb8c76e0f84', 5, 'Fuel Spill or Hazardous Materials', 'closed', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-04-15T14:50:00Z', 'OB', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-04-15T16:35:00Z', 'AR', '{}'::jsonb, 'Approx 8 gal Jet-A spill during into-plane fueling, west apron. Contained with absorbent, FBO remediation, no drain entry.', '2026-04-15T14:50:00Z', '2026-04-15T16:35:00Z'),
 (md5('kdra-qrc-exec-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'bb957a55-5de5-409e-995f-53a668d91ca1', 2, 'In-Flight Emergency', 'closed', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-05-06T17:12:00Z', 'AR', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-05-06T17:58:00Z', 'AR', '{}'::jsonb, 'Gear-indication issue on inbound Part 135 aircraft; ARFF positioned, normal landing RWY 01, taxied in normally.', '2026-05-06T17:12:00Z', '2026-05-06T17:58:00Z'),
 (md5('kdra-qrc-exec-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'b9730cfc-d424-4c76-a540-55cfa75d8d69', 6, 'Bird or Wildlife Strike', 'closed', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-05-28T12:40:00Z', 'DP', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-05-28T13:25:00Z', 'DP', '{}'::jsonb, 'Reported gull strike on landing rollout RWY 19. Runway swept, no debris to movement area, strike documented.', '2026-05-28T12:40:00Z', '2026-05-28T13:25:00Z'),
 (md5('kdra-qrc-exec-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'd9ea4962-b10d-4905-8b5f-b7b3e8cb616b', 3, 'Aircraft Ground Emergency', 'closed', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-06-12T18:20:00Z', 'BO', '10bd2c31-e693-c4d5-2455-d3af3506d106', '2026-06-12T19:40:00Z', 'RC', '{}'::jsonb, 'Brake fire reported at gate during turn. ARFF responded, extinguished, aircraft towed clear, ramp reopened.', '2026-06-12T18:20:00Z', '2026-06-12T19:40:00Z'),
 (md5('kdra-qrc-exec-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'a5c5f966-8c30-473e-a472-d90360916f4c', 8, 'Severe Weather and Lightning', 'closed', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-06-27T20:05:00Z', 'OB', '57a1c585-209a-5012-9983-ff95142a9ff0', '2026-06-27T22:15:00Z', 'OB', '{}'::jsonb, 'Convective activity and lightning within 5 miles; ramp closed to ground crews, resumed after 30-min all-clear.', '2026-06-27T20:05:00Z', '2026-06-27T22:15:00Z'),
 (md5('kdra-qrc-exec-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '1a742a98-b42e-4abd-a1c0-aa68c53ba5c7', 4, 'Disabled Aircraft on the Movement Area', 'open', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-09T15:30:00Z', 'AR', NULL, NULL, NULL, '{}'::jsonb, 'Light twin with flat main gear tire holding short TWY B. Coordinating tow; monitoring runway availability.', '2026-07-09T15:30:00Z', '2026-07-09T15:30:00Z'),
 (md5('kdra-qrc-exec-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'b9730cfc-d424-4c76-a540-55cfa75d8d69', 6, 'Bird or Wildlife Strike', 'closed', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-15T13:15:00Z', 'DP', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-15T14:00:00Z', 'DP', '{}'::jsonb, 'Suspected bird strike reported by departing charter. Full-length runway inspection, no findings, precautionary report filed.', '2026-07-15T13:15:00Z', '2026-07-15T14:00:00Z'),
 (md5('kdra-qrc-exec-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'bb957a55-5de5-409e-995f-53a668d91ca1', 2, 'In-Flight Emergency', 'open', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-07-20T16:48:00Z', 'MD', NULL, NULL, NULL, '{}'::jsonb, 'Inbound aircraft reporting pressurization issue, requesting priority handling; ARFF alerted, tracking.', '2026-07-20T16:48:00Z', '2026-07-20T16:48:00Z'),
 (md5('kdra-qrc-exec-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'e184f9d7-a984-4dbc-9fc7-fbb8c76e0f84', 5, 'Fuel Spill or Hazardous Materials', 'open', '00b4cdd3-cbf0-0269-a366-3514870b0474', '2026-07-22T14:22:00Z', 'BO', NULL, NULL, NULL, '{}'::jsonb, 'Small hydraulic fluid spill at east ramp during maintenance; containment underway, awaiting cleanup crew.', '2026-07-22T14:22:00Z', '2026-07-22T14:22:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) qrc_monthly_reviews — 6 currency reviews (reviewers: manager/supervisor/ARFF chief)
-- ---------------------------------------------------------------------------
INSERT INTO qrc_monthly_reviews
  (id, base_id, template_id, user_id, reviewed_at, template_updated_at_at_review, notes, created_at)
VALUES
 (md5('kdra-qrc-review-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '7b845f45-9f80-48e7-96ef-68e2db291b03', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-03-31T18:00:00Z', NULL, 'Reviewed for currency against Part 139 emergency procedures. No changes required.', '2026-03-31T18:00:00Z'),
 (md5('kdra-qrc-review-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'bb957a55-5de5-409e-995f-53a668d91ca1', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-04-30T17:30:00Z', NULL, 'Verified notification sequence and ARFF standby steps current.', '2026-04-30T17:30:00Z'),
 (md5('kdra-qrc-review-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'b9730cfc-d424-4c76-a540-55cfa75d8d69', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-05-31T18:15:00Z', NULL, 'Reviewed wildlife strike checklist; aligned with §139.337 hazard management.', '2026-05-31T18:15:00Z'),
 (md5('kdra-qrc-review-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'e184f9d7-a984-4dbc-9fc7-fbb8c76e0f84', '10bd2c31-e693-c4d5-2455-d3af3506d106', '2026-06-30T16:50:00Z', NULL, 'Confirmed spill containment and notification steps with ARFF. Current.', '2026-06-30T16:50:00Z'),
 (md5('kdra-qrc-review-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'a5c5f966-8c30-473e-a472-d90360916f4c', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-07-15T17:00:00Z', NULL, 'Severe weather thresholds reviewed ahead of summer convective season. No changes.', '2026-07-15T17:00:00Z'),
 (md5('kdra-qrc-review-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'd9ea4962-b10d-4905-8b5f-b7b3e8cb616b', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-07-20T18:30:00Z', NULL, 'Ground emergency response steps verified current with terminal ramp layout.', '2026-07-20T18:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) customer_feedback — 12 pilot/tenant submissions. Generic orgs, no names.
--    responses default {}. Ratings 1..5 (mostly 4-5, a few lower).
-- ---------------------------------------------------------------------------
INSERT INTO customer_feedback
  (id, base_id, name, email, organization, overall_rating, comments, responses, submitted_at)
VALUES
 (md5('kdra-feedback-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Transient Flight Dept', 5, 'Fast PPR turnaround and clear ramp instructions. Line crew was excellent.', '{}'::jsonb, '2026-07-21T14:10:00Z'),
 (md5('kdra-feedback-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Regional Charter', 4, 'Good coordination with Airport Operations. Fuel wait was a little long at peak.', '{}'::jsonb, '2026-07-19T22:05:00Z'),
 (md5('kdra-feedback-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Corporate Flight Dept', 5, 'NOTAMs were current and the field condition report was accurate on arrival.', '{}'::jsonb, '2026-07-16T13:40:00Z'),
 (md5('kdra-feedback-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Flight School', 5, 'Pattern work was well managed and hold-short instructions were clear.', '{}'::jsonb, '2026-07-12T15:25:00Z'),
 (md5('kdra-feedback-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Air Ambulance', 5, 'Priority handling for our medevac was quick and professional. Thank you.', '{}'::jsonb, '2026-07-09T03:15:00Z'),
 (md5('kdra-feedback-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'FBO Line Service', 4, 'Ramp assignments were smooth. A marshaller at the east ramp would help during rushes.', '{}'::jsonb, '2026-07-05T18:50:00Z'),
 (md5('kdra-feedback-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Part 135 Operator', 3, 'Overall fine, but the after-hours callback took longer than expected.', '{}'::jsonb, '2026-06-28T23:30:00Z'),
 (md5('kdra-feedback-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Cargo Operator', 4, 'Smooth after-hours coordination. Appreciated the proactive weather advisory.', '{}'::jsonb, '2026-06-20T04:20:00Z'),
 (md5('kdra-feedback-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Business Aviation', 5, 'Best-run regional field on our route. Parking plan was ready when we landed.', '{}'::jsonb, '2026-06-11T16:00:00Z'),
 (md5('kdra-feedback-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Aero Club', 4, 'Friendly staff and good comms. Restroom on the GA side could use attention.', '{}'::jsonb, '2026-05-30T14:45:00Z'),
 (md5('kdra-feedback-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Fractional Operator', 2, 'Ground stop during storms was handled safely but updates were sparse. More frequent status would help.', '{}'::jsonb, '2026-05-14T21:10:00Z'),
 (md5('kdra-feedback-12')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'Itinerant GA', 5, 'Easy PPR request and quick approval. Line service topped us off fast.', '{}'::jsonb, '2026-04-26T17:35:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) status_updates — discrepancy activity/comment thread on EXISTING KDRA
--    discrepancies (real ids). Comment-style (old/new status NULL, notes free-text),
--    matching addStatusNote(). created_at >= parent discrepancy created_at.
-- ---------------------------------------------------------------------------
INSERT INTO status_updates
  (id, discrepancy_id, old_status, new_status, notes, updated_by, base_id, created_at)
VALUES
 (md5('kdra-statusupd-1')::uuid,  '8db19154-9ad7-46e2-ac22-b02a11d3994b', NULL, NULL, 'Identified on afternoon self-inspection. NOTAM filed for TWY A centerline segment near RWY 01 intersection; maintenance notified.', '44cc521d-5850-0faa-8f92-c030a19fce37', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-02T15:10:00Z'),
 (md5('kdra-statusupd-2')::uuid,  '8db19154-9ad7-46e2-ac22-b02a11d3994b', NULL, NULL, 'Replacement fixtures on order; interim signage and reduced-visibility taxi procedures in place.', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-05T13:00:00Z'),
 (md5('kdra-statusupd-3')::uuid,  '8db19154-9ad7-46e2-ac22-b02a11d3994b', NULL, NULL, 'Parts received. Repair scheduled for next maintenance window.', '4f8ab1a5-c662-a906-7ae3-2730db18551f', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-20T12:00:00Z'),
 (md5('kdra-statusupd-4')::uuid,  'ae543fa0-9201-40a0-af11-3089eec229b5', NULL, NULL, 'Crack width measured ~1/2 in along tie-down rows C–D. Affected slabs cordoned and NOTAM issued for reduced apron capacity.', '57a1c585-209a-5012-9983-ff95142a9ff0', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-28T18:20:00Z'),
 (md5('kdra-statusupd-5')::uuid,  'ae543fa0-9201-40a0-af11-3089eec229b5', NULL, NULL, 'Cornerstone Concrete scheduled for joint reseal the week of 7/14. Tie-down rows will remain closed during cure.', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-06T14:30:00Z'),
 (md5('kdra-statusupd-6')::uuid,  'd5a9f907-2040-4486-bb56-a088f12033aa', NULL, NULL, 'Retroreflectivity below threshold at TWY B / RWY 01-19 hold line. Added to pavement marking refresh scope.', '44cc521d-5850-0faa-8f92-c030a19fce37', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-06-25T16:45:00Z'),
 (md5('kdra-statusupd-7')::uuid,  'd5a9f907-2040-4486-bb56-a088f12033aa', NULL, NULL, 'Precision Pavement Marking completed hold-position remarking; pending daytime retroreflectivity verification.', '57a1c585-209a-5012-9983-ff95142a9ff0', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-11T15:00:00Z'),
 (md5('kdra-statusupd-8')::uuid,  '86210154-a4e3-48cf-9778-a237b6131936', NULL, NULL, 'Sign panel dark on north face. NOTAM issued; work order to airfield electric for driver/panel check.', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-23T04:15:00Z'),
 (md5('kdra-statusupd-9')::uuid,  '5dec9b55-599f-4a7f-abef-ffaeeb6a6f5f', NULL, NULL, 'Distance Remaining Marker board damaged, likely mower strike. Replacement panel requested from stores.', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-23T04:20:00Z'),
 (md5('kdra-statusupd-10')::uuid, '233d3c6a-9b4d-40c1-bc50-03a792619b65', NULL, NULL, 'TWY J edge light out; isolated on the circuit. Harbor City Electric tasked to troubleshoot fixture.', '44cc521d-5850-0faa-8f92-c030a19fce37', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', '2026-07-23T05:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) runway_status_log — recent status/advisory/active-runway changes (single RWY 01/19)
-- ---------------------------------------------------------------------------
INSERT INTO runway_status_log
  (id, base_id, old_runway_status, new_runway_status, old_active_runway, new_active_runway,
   old_advisory_type, new_advisory_type, old_advisory_text, new_advisory_text, changed_by, reason, created_at)
VALUES
 (md5('kdra-rwylog-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '19', '01', NULL, NULL, NULL, NULL, '44cc521d-5850-0faa-8f92-c030a19fce37', 'Wind shift; active runway changed to 01.', '2026-05-02T12:30:00Z'),
 (md5('kdra-rwylog-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '01', '01', NULL, 'WATCH', NULL, 'Deer activity reported vicinity RSA on the Runway 01 approach — exercise caution.', '57a1c585-209a-5012-9983-ff95142a9ff0', 'Wildlife watch posted.', '2026-05-18T11:05:00Z'),
 (md5('kdra-rwylog-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'closed', '01', '01', NULL, NULL, NULL, NULL, '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Temporary closure for pavement crack repair, RWY 01/19.', '2026-06-02T13:00:00Z'),
 (md5('kdra-rwylog-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'closed', 'open', '01', '01', NULL, NULL, NULL, NULL, '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Repair complete, runway inspected and reopened.', '2026-06-02T16:45:00Z'),
 (md5('kdra-rwylog-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '01', '19', NULL, NULL, NULL, NULL, '44cc521d-5850-0faa-8f92-c030a19fce37', 'Wind shift; active runway changed to 19.', '2026-06-20T14:15:00Z'),
 (md5('kdra-rwylog-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '19', '19', NULL, 'WARNING', NULL, 'Convective activity within 5 NM and lightning within 5 miles — ramp operations suspended.', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Thunderstorms in the vicinity.', '2026-06-28T20:10:00Z'),
 (md5('kdra-rwylog-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '19', '19', 'WARNING', NULL, 'Convective activity within 5 NM and lightning within 5 miles — ramp operations suspended.', NULL, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Storms cleared; advisory removed.', '2026-06-28T21:35:00Z'),
 (md5('kdra-rwylog-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '19', '19', NULL, 'ADVISORY', NULL, 'Infield mowing in progress — personnel and equipment adjacent to Runway 19.', '57a1c585-209a-5012-9983-ff95142a9ff0', 'Mowing operations advisory.', '2026-07-05T13:20:00Z'),
 (md5('kdra-rwylog-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'restricted', '19', '19', NULL, 'ADVISORY', NULL, 'Displaced threshold Runway 01 in effect for pavement rehabilitation — see NOTAM.', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Displaced threshold for construction.', '2026-07-12T12:00:00Z'),
 (md5('kdra-rwylog-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'restricted', 'open', '19', '01', 'ADVISORY', NULL, 'Displaced threshold Runway 01 in effect for pavement rehabilitation — see NOTAM.', NULL, '44cc521d-5850-0faa-8f92-c030a19fce37', 'Threshold restored; active runway 01.', '2026-07-18T15:40:00Z'),
 (md5('kdra-rwylog-11')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'open', 'open', '01', '01', NULL, 'WATCH', NULL, 'Increased bird activity at dawn near the approach end of Runway 01.', '00b4cdd3-cbf0-0269-a366-3514870b0474', 'Dawn wildlife watch.', '2026-07-22T10:25:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) arff_status_log — ARFF vehicle readiness history (CRJ-900 / E-175 aircraft rows)
--    readiness: optimum|reduced|critical|inadequate. cat left NULL (matches sample).
-- ---------------------------------------------------------------------------
INSERT INTO arff_status_log
  (id, base_id, old_cat, new_cat, aircraft_name, old_readiness, new_readiness, changed_by, reason, created_at)
VALUES
 (md5('kdra-arfflog-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'CRJ-900', NULL, 'optimum', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'ARFF vehicles fully staffed and in service.', '2026-04-10T12:00:00Z'),
 (md5('kdra-arfflog-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'E-175', NULL, 'optimum', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Annual pump test passed; full response capability.', '2026-05-14T13:30:00Z'),
 (md5('kdra-arfflog-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'CRJ-900', 'optimum', 'reduced', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Primary ARFF truck out of service for foam system repair; reserve vehicle in place.', '2026-06-09T09:45:00Z'),
 (md5('kdra-arfflog-4')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'CRJ-900', 'reduced', 'optimum', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Primary ARFF truck returned to service.', '2026-06-11T15:20:00Z'),
 (md5('kdra-arfflog-5')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'CRJ-900', 'optimum', 'critical', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'Brief maintenance overlap left both structural vehicles down; operations restricted per emergency plan.', '2026-06-30T08:30:00Z'),
 (md5('kdra-arfflog-6')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'CRJ-900', 'critical', 'optimum', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Maintenance overlap cleared; vehicles back in service.', '2026-06-30T10:15:00Z'),
 (md5('kdra-arfflog-7')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'E-175', 'optimum', 'reduced', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Agent resupply in progress; secondary vehicle covering.', '2026-07-08T11:10:00Z'),
 (md5('kdra-arfflog-8')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', NULL, NULL, 'E-175', 'reduced', 'optimum', '10bd2c31-e693-c4d5-2455-d3af3506d106', 'Resupply complete; full response capability restored.', '2026-07-21T14:05:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8) bwc_history — Bird Watch Condition history (set_by = display name text; source text)
-- ---------------------------------------------------------------------------
INSERT INTO bwc_history
  (id, base_id, bwc_value, set_at, set_by, source, notes, created_at)
VALUES
 (md5('kdra-bwc-1')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-04-05T11:30:00Z', 'D. Pearce', 'inspection', NULL, '2026-04-05T11:30:00Z'),
 (md5('kdra-bwc-2')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-04-27T12:15:00Z', 'B. Okafor', 'inspection', NULL, '2026-04-27T12:15:00Z'),
 (md5('kdra-bwc-3')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOD', '2026-05-19T13:40:00Z', 'O. Brenner', 'dashboard', 'Increased gull activity near the west apron.', '2026-05-19T13:40:00Z'),
 (md5('kdra-bwc-4')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-05-20T09:10:00Z', 'O. Brenner', 'dashboard', 'Activity dispersed overnight.', '2026-05-20T09:10:00Z'),
 (md5('kdra-bwc-5')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-06-15T11:50:00Z', 'D. Pearce', 'inspection', NULL, '2026-06-15T11:50:00Z'),
 (md5('kdra-bwc-6')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOD', '2026-06-30T10:20:00Z', 'A. Ruiz', 'dashboard', 'Deer observed vicinity RSA at dawn.', '2026-06-30T10:20:00Z'),
 (md5('kdra-bwc-7')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-07-08T12:05:00Z', 'B. Okafor', 'inspection', NULL, '2026-07-08T12:05:00Z'),
 (md5('kdra-bwc-8')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'MOD', '2026-07-16T13:15:00Z', 'O. Brenner', 'dashboard', 'Flocking birds over the infield during mowing operations.', '2026-07-16T13:15:00Z'),
 (md5('kdra-bwc-9')::uuid,  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'SEV', '2026-07-20T10:40:00Z', 'M. Delgado', 'dashboard', 'Large flock crossing the approach to Runway 01; crews advised, dispersal underway.', '2026-07-20T10:40:00Z'),
 (md5('kdra-bwc-10')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'LOW', '2026-07-22T09:30:00Z', 'D. Pearce', 'dashboard', 'Activity subsided after dispersal.', '2026-07-22T09:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9) parking_plans — 3 named apron plans (one active). created_by/updated_by roster.
-- ---------------------------------------------------------------------------
INSERT INTO parking_plans
  (id, base_id, plan_name, description, is_active, is_template, created_by, updated_by, created_at, updated_at)
VALUES
 (md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Main Apron — Daily Layout', 'Standard daily parking configuration for the main terminal apron and transient ramp.', true,  false, 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', '2026-06-10T13:00:00Z', '2026-07-22T12:00:00Z'),
 (md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient & Itinerant Ramp', 'Overflow parking for transient GA and itinerant traffic on the east ramp.', false, false, '4f8ab1a5-c662-a906-7ae3-2730db18551f', '4f8ab1a5-c662-a906-7ae3-2730db18551f', '2026-06-18T14:30:00Z', '2026-06-18T14:30:00Z'),
 (md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Fly-In Event Overflow', 'Expanded parking plan for seasonal fly-in and community event overflow.', false, false, '44cc521d-5850-0faa-8f92-c030a19fce37', '44cc521d-5850-0faa-8f92-c030a19fce37', '2026-07-05T15:10:00Z', '2026-07-05T15:10:00Z')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) parking_spots — spots per plan (geometry clustered near existing apron
--     lat ~42.606, lon ~-82.817). Parents (parking_plans) inserted above.
-- ---------------------------------------------------------------------------
INSERT INTO parking_spots
  (id, plan_id, base_id, spot_name, spot_type, aircraft_name, tail_number, unit_callsign,
   longitude, latitude, heading_deg, clearance_ft, status, notes, sort_order, created_at, updated_at)
VALUES
 -- Plan 1: Main Apron — Daily Layout (8 spots)
 (md5('kdra-parking-spot-p1-1')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Terminal 1', 'apron', 'CRJ-900', 'N512RC', 'Regional Charter', -82.817900, 42.606050, 190, 30, 'occupied', NULL, 1, '2026-06-10T13:05:00Z', '2026-07-22T12:00:00Z'),
 (md5('kdra-parking-spot-p1-2')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Terminal 2', 'apron', 'E-175', 'N188RA', 'Regional Charter', -82.817650, 42.606080, 190, 30, 'occupied', NULL, 2, '2026-06-10T13:05:00Z', '2026-07-22T12:00:00Z'),
 (md5('kdra-parking-spot-p1-3')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Apron A1', 'apron', 'Gulfstream G280', 'N280DR', NULL, -82.817400, 42.606110, 190, 40, 'reserved', 'Reserved for scheduled corporate arrival.', 3, '2026-06-10T13:05:00Z', '2026-06-10T13:05:00Z'),
 (md5('kdra-parking-spot-p1-4')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Apron A2', 'apron', 'Citation CJ3', 'N63CJ', NULL, -82.817150, 42.606140, 190, 25, 'available', NULL, 4, '2026-06-10T13:05:00Z', '2026-06-10T13:05:00Z'),
 (md5('kdra-parking-spot-p1-5')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Apron A3', 'apron', 'King Air 350', 'N350KA', NULL, -82.816900, 42.606170, 190, 25, 'available', NULL, 5, '2026-06-10T13:05:00Z', '2026-06-10T13:05:00Z'),
 (md5('kdra-parking-spot-p1-6')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Apron A4', 'apron', 'Pilatus PC-12', 'N912PC', NULL, -82.816650, 42.606200, 190, 20, 'occupied', NULL, 6, '2026-06-10T13:05:00Z', '2026-07-21T18:00:00Z'),
 (md5('kdra-parking-spot-p1-7')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Ramp R1', 'ramp', 'Cessna 208 Caravan', 'N208DR', 'Cargo Operator', -82.816400, 42.606230, 190, 20, 'available', NULL, 7, '2026-06-10T13:05:00Z', '2026-06-10T13:05:00Z'),
 (md5('kdra-parking-spot-p1-8')::uuid, md5('kdra-parking-plan-1')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Ramp R2', 'ramp', 'Beechcraft Baron', 'N58BE', NULL, -82.816150, 42.606260, 190, 18, 'available', NULL, 8, '2026-06-10T13:05:00Z', '2026-06-10T13:05:00Z'),
 -- Plan 2: Transient & Itinerant Ramp (7 spots)
 (md5('kdra-parking-spot-p2-1')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient T1', 'transient', 'TBM 940', 'N940TB', NULL, -82.815900, 42.605700, 10, 20, 'available', NULL, 1, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 (md5('kdra-parking-spot-p2-2')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient T2', 'transient', 'Pilatus PC-24', 'N724PC', NULL, -82.815650, 42.605730, 10, 25, 'reserved', 'Holding for itinerant IFR arrival.', 2, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 (md5('kdra-parking-spot-p2-3')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient T3', 'transient', 'Cirrus SR22', 'N522SR', NULL, -82.815400, 42.605760, 10, 15, 'available', NULL, 3, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 (md5('kdra-parking-spot-p2-4')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient T4', 'transient', 'Diamond DA62', 'N462DA', NULL, -82.815150, 42.605790, 10, 15, 'available', NULL, 4, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 (md5('kdra-parking-spot-p2-5')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Transient T5', 'transient', 'Piper M600', 'N600PM', NULL, -82.814900, 42.605820, 10, 18, 'occupied', NULL, 5, '2026-06-18T14:35:00Z', '2026-07-22T16:00:00Z'),
 (md5('kdra-parking-spot-p2-6')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Ramp E1', 'ramp', 'Cessna 172', 'N172DR', 'Aero Club', -82.814650, 42.605850, 10, 12, 'available', NULL, 6, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 (md5('kdra-parking-spot-p2-7')::uuid, md5('kdra-parking-plan-2')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Ramp E2', 'ramp', 'Beechcraft Bonanza G36', 'N36BG', NULL, -82.814400, 42.605880, 10, 12, 'available', NULL, 7, '2026-06-18T14:35:00Z', '2026-06-18T14:35:00Z'),
 -- Plan 3: Fly-In Event Overflow (6 spots)
 (md5('kdra-parking-spot-p3-1')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O1', 'transient', 'Cessna 182', 'N182FI', NULL, -82.816000, 42.607000, 190, 12, 'available', 'Event grass-edge overflow row.', 1, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z'),
 (md5('kdra-parking-spot-p3-2')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O2', 'transient', 'Piper PA-28', 'N28PA', NULL, -82.815750, 42.607030, 190, 12, 'available', NULL, 2, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z'),
 (md5('kdra-parking-spot-p3-3')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O3', 'transient', 'Van''s RV-10', 'N10RV', NULL, -82.815500, 42.607060, 190, 12, 'available', NULL, 3, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z'),
 (md5('kdra-parking-spot-p3-4')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O4', 'transient', 'Cessna 206', 'N206FI', NULL, -82.815250, 42.607090, 190, 14, 'available', NULL, 4, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z'),
 (md5('kdra-parking-spot-p3-5')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O5', 'transient', 'Beechcraft Bonanza A36', 'N36FI', NULL, -82.815000, 42.607120, 190, 12, 'available', NULL, 5, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z'),
 (md5('kdra-parking-spot-p3-6')::uuid, md5('kdra-parking-plan-3')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae', 'Overflow O6', 'transient', 'Cirrus SR20', 'N20FI', NULL, -82.814750, 42.607150, 190, 12, 'available', NULL, 6, '2026-07-05T15:15:00Z', '2026-07-05T15:15:00Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
