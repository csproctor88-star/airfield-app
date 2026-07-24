-- =====================================================================
-- KDRA Demo Seed — CLUSTER A: Daily self-inspections & inspections
-- Base: Demo Regional Airport (KDRA)  base_id ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- Runway 01/19: 633cedfb-555a-4440-a5a0-9c734a4123da
-- Airfield inspection template (airfield): 3fb19207-50b4-4a2d-8f9b-dcd30d1f83d1
-- Window: 2026-01-24 .. 2026-07-23 (UTC), recent-weighted.  "Today" = 2026-07-23.
-- INSERT-only; deterministic md5 ids; ON CONFLICT (id) DO NOTHING; single txn.
-- Civilian 14 CFR Part 139 voice throughout.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) airfield_checks — routine daily self-inspections (§139.327 backbone)
--    166 rows via generate_series, recent-weighted, spread ~6 months.
--    Authors weighted to the 3 Ops Specialists + Anthony + Marcus.
--    display_id namespace: AC-01xx  (existing rows never start with 0)
-- ---------------------------------------------------------------------
WITH gen AS (
  SELECT
    i,
    (ARRAY['other','fod','other','bash','other','fod','rsc','other','fod','construction',
           'other','fod','bash','other','rsc','other','fod','heavy_aircraft','other','other'])[1 + (i % 20)] AS ctype,
    ( timestamptz '2026-07-22 13:00:00+00'
        - make_interval(days => (178.0 * power((i-1)/165.0, 1.7))::int)
        - make_interval(hours => (i*5) % 16)
        - make_interval(mins  => (i*13) % 60) ) AS ts
  FROM generate_series(1,166) AS g(i)
)
INSERT INTO airfield_checks
  (id, display_id, check_type, data, photo_count, areas, status,
   completed_by, completed_by_id, saved_by_id, completed_at, started_at,
   created_at, updated_at, base_id)
SELECT
  md5('kdra-check-'||i)::uuid,
  'AC-' || upper(lpad(to_hex(256 + i), 4, '0')),
  ctype,
  CASE ctype
    WHEN 'other' THEN jsonb_build_object('other_subject',
      (ARRAY[
        'Morning daily self-inspection — 14 CFR §139.327: pavement, markings, signs, lighting, safety areas, and FOD conditions inspected; airport in normal operating condition.',
        'Nighttime lighting inspection — 14 CFR §139.311: runway and taxiway edge lights, threshold/REIL, PAPI, guidance signs, and airport beacon verified operational.',
        'Pavement condition and markings inspection — 14 CFR §139.305/§139.309: runway and taxiway surfaces sound, holding-position and centerline markings legible, no FOD-generating distress.',
        'Safety area and NAVAID check — 14 CFR §139.309: RSA and OFA clear and graded, no ruts or ponding; NAVAID critical areas unobstructed and signage intact.',
        'Continuous surveillance check — 14 CFR §139.327: movement and non-movement areas monitored during air-carrier operations; no unsafe conditions observed.',
        'Signs, markings and lighting inspection — 14 CFR §139.311: mandatory instruction and guidance signs legible and lit; no obscured or damaged panels noted.',
        'Fueling area and apron self-inspection — 14 CFR §139.327: apron markings, tie-downs, and fuel-farm perimeter checked; no leaks or hazards observed.',
        'Post-weather runway inspection — 14 CFR §139.327: runway, taxiways, and safety areas checked following precipitation; surfaces clear, drainage functioning.'
      ])[1 + (i % 8)])
    WHEN 'bash' THEN jsonb_build_object(
      'condition_code', (ARRAY['LOW','LOW','LOW','MODERATE'])[1 + (i % 4)],
      'species_observed', (ARRAY[
        'Routine wildlife patrol — a few ring-billed gulls and mourning doves transiting midfield; dispersed by vehicle patrol, no runway incursion.',
        'Small group of killdeer loafing near the RWY 01 approach; hazed off the movement area. Wildlife hazard conditions nominal.',
        'Red-tailed hawk perched on the perimeter fence line; monitored and departed on its own. No mitigation required.',
        'Canada goose activity on the infield retention pond; pyrotechnics deployed and birds relocated off airport.',
        'Nominal wildlife survey — no significant bird or mammal activity on or near the movement area during the check.'
      ])[1 + (i % 5)])
    WHEN 'rsc' THEN jsonb_build_object('condition', (ARRAY['Dry','Dry','Dry','Wet'])[1 + (i % 4)])
    WHEN 'construction' THEN jsonb_build_object('construction_items',
      '{"barricades":"P","fencing":"P","fod_mgmt":"P","markings":"P","movement":"P","notams":"P","obstruction":"P","rwy_taxi":"P","signage":"P","stockpile":"P","vehicles":"P"}'::jsonb)
    WHEN 'heavy_aircraft' THEN jsonb_build_object('aircraft_type',
      (ARRAY['B767-300F (cargo)','A300-600F (cargo)','B757-200','MD-11F (transient)'])[1 + (i % 4)])
    ELSE '{}'::jsonb
  END,
  0,
  ARRAY[ CASE ctype
    WHEN 'other'        THEN (ARRAY['Entire Airfield','Entire Airfield','RWY 01/19','Entire Airfield','West Ramp'])[1 + (i % 5)]
    WHEN 'fod'          THEN (ARRAY['RWY 01/19','TWY A','West Ramp','East Ramp','TWY B','Access Road'])[1 + (i % 6)]
    WHEN 'bash'         THEN 'Entire Airfield'
    WHEN 'rsc'          THEN 'RWY 01/19'
    WHEN 'construction' THEN (ARRAY['West Ramp','East Ramp','TWY G'])[1 + (i % 3)]
    WHEN 'heavy_aircraft' THEN 'RWY 01/19'
    ELSE 'Entire Airfield' END ]::text[],
  'completed',
  (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1 + (i % 8)],
  (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1 + (i % 8)],
  (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1 + (i % 8)],
  ts,
  ts - make_interval(mins => 12 + (i % 15)),
  ts,
  ts,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid
FROM gen
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) airfield_checks — specific finding / event checks (14 rows)
--    Recent-weighted (Jun–Jul). data.issues[] mirrors the real shape
--    (comment/location/location_text/log_as_discrepancy/discrepancy_title/discrepancy_type).
--    display_id namespace: AC-02xx
-- ---------------------------------------------------------------------
INSERT INTO airfield_checks
  (id, display_id, check_type, data, photo_count, areas, status,
   completed_by, completed_by_id, saved_by_id, completed_at, started_at,
   created_at, updated_at, latitude, longitude, base_id)
VALUES
-- F1 FOD removed from Taxiway A
(md5('kdra-check-find-1')::uuid, 'AC-0201', 'fod',
 jsonb_build_object('issues', jsonb_build_array(jsonb_build_object(
   'comment','Rubber and metal debris recovered along the TWY A centerline near the RWY 01 hold line during a FOD check. Items removed and bagged; taxiway swept and re-inspected clear.',
   'location', jsonb_build_object('lat',42.6125,'lon',-82.8361),
   'location_text','Taxiway A — near RWY 01 hold line',
   'log_as_discrepancy', true,
   'discrepancy_title','FOD on Taxiway A','discrepancy_type','fod_hazard'))),
 0, ARRAY['TWY A']::text[], 'completed', 'Danielle Pearce',
 '44cc521d-5850-0faa-8f92-c030a19fce37','44cc521d-5850-0faa-8f92-c030a19fce37',
 timestamptz '2026-07-20 14:10:00+00', timestamptz '2026-07-20 13:52:00+00',
 timestamptz '2026-07-20 14:10:00+00', timestamptz '2026-07-20 14:10:00+00',
 42.6125, -82.8361, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F2 Faded threshold markings RWY 01
(md5('kdra-check-find-2')::uuid, 'AC-0202', 'other',
 jsonb_build_object(
   'other_subject','Markings inspection — 14 CFR §139.309: runway and taxiway markings checked for legibility and conspicuity.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','RWY 01 threshold bars and touchdown-zone markings faded below acceptable conspicuity; repainting scheduled with maintenance.',
     'location_text','RWY 01 threshold',
     'log_as_discrepancy', true,
     'discrepancy_title','Faded threshold markings — RWY 01','discrepancy_type','marking'))),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Brian Okafor',
 '00b4cdd3-cbf0-0269-a366-3514870b0474','00b4cdd3-cbf0-0269-a366-3514870b0474',
 timestamptz '2026-07-18 03:20:00+00', timestamptz '2026-07-18 02:58:00+00',
 timestamptz '2026-07-18 03:20:00+00', timestamptz '2026-07-18 03:20:00+00',
 NULL, NULL, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F3 Runway edge light out
(md5('kdra-check-find-3')::uuid, 'AC-0203', 'other',
 jsonb_build_object(
   'other_subject','Nighttime lighting inspection — 14 CFR §139.311: runway/taxiway edge lights, threshold/REIL, PAPI, and beacon checked.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','One RWY 01/19 runway edge light out on the east side approximately mid-field; lamp replacement work order submitted. Serviceable light count remained within limits.',
     'location', jsonb_build_object('lat',42.6089,'lon',-82.8290),
     'location_text','RWY 01/19 — east edge, mid-field',
     'log_as_discrepancy', true,
     'discrepancy_title','Runway edge light out — RWY 01/19','discrepancy_type','lighting'))),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Olivia Brenner',
 '57a1c585-209a-5012-9983-ff95142a9ff0','57a1c585-209a-5012-9983-ff95142a9ff0',
 timestamptz '2026-07-15 02:45:00+00', timestamptz '2026-07-15 02:20:00+00',
 timestamptz '2026-07-15 02:45:00+00', timestamptz '2026-07-15 02:45:00+00',
 42.6089, -82.8290, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F4 Wind cone fabric frayed
(md5('kdra-check-find-4')::uuid, 'AC-0204', 'other',
 jsonb_build_object(
   'other_subject','Wind indicator and signage check — 14 CFR §139.311.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','Primary lighted wind cone fabric frayed and faded; replacement ordered. Secondary wind cone serviceable and used as reference.',
     'location', jsonb_build_object('lat',42.6150,'lon',-82.8330),
     'location_text','East Ramp — primary wind cone',
     'log_as_discrepancy', true,
     'discrepancy_title','Wind cone fabric frayed','discrepancy_type','other'))),
 0, ARRAY['East Ramp']::text[], 'completed', 'Anthony Ruiz',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 timestamptz '2026-07-12 15:30:00+00', timestamptz '2026-07-12 15:12:00+00',
 timestamptz '2026-07-12 15:30:00+00', timestamptz '2026-07-12 15:30:00+00',
 42.6150, -82.8330, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F5 Gate lock serviceable (satisfactory — no discrepancy)
(md5('kdra-check-find-5')::uuid, 'AC-0205', 'other',
 jsonb_build_object('other_subject','Perimeter and gate inspection — 14 CFR §139.335: perimeter fence, vehicle gates, and gate locks checked. Gate 4 lock hardware inspected and found serviceable; no unauthorized-access indications.'),
 0, ARRAY['Access Road']::text[], 'completed', 'Danielle Pearce',
 '44cc521d-5850-0faa-8f92-c030a19fce37','44cc521d-5850-0faa-8f92-c030a19fce37',
 timestamptz '2026-07-10 12:20:00+00', timestamptz '2026-07-10 12:02:00+00',
 timestamptz '2026-07-10 12:20:00+00', timestamptz '2026-07-10 12:20:00+00',
 NULL, NULL, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F6 Standing water on West Apron
(md5('kdra-check-find-6')::uuid, 'AC-0206', 'fod',
 jsonb_build_object('issues', jsonb_build_array(jsonb_build_object(
   'comment','Standing water accumulating on the West Apron near the fuel pits following rain; area coned and flagged for drainage review. No aircraft affected.',
   'location', jsonb_build_object('lat',42.6118,'lon',-82.8402),
   'location_text','West Apron — near fuel pits',
   'log_as_discrepancy', true,
   'discrepancy_title','Standing water on West Apron','discrepancy_type','pavement'))),
 0, ARRAY['West Ramp']::text[], 'completed', 'Brian Okafor',
 '00b4cdd3-cbf0-0269-a366-3514870b0474','00b4cdd3-cbf0-0269-a366-3514870b0474',
 timestamptz '2026-07-08 16:40:00+00', timestamptz '2026-07-08 16:20:00+00',
 timestamptz '2026-07-08 16:40:00+00', timestamptz '2026-07-08 16:40:00+00',
 42.6118, -82.8402, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F7 FOD hardware on runway
(md5('kdra-check-find-7')::uuid, 'AC-0207', 'fod',
 jsonb_build_object('issues', jsonb_build_array(jsonb_build_object(
   'comment','Loose bolt and hardware fragment recovered on the RWY 01/19 surface near the TWY B intersection; removed and area re-swept. Source traced to a maintenance vehicle and reported.',
   'location', jsonb_build_object('lat',42.6101,'lon',-82.8312),
   'location_text','RWY 01/19 — near TWY B intersection',
   'log_as_discrepancy', true,
   'discrepancy_title','FOD hardware on runway','discrepancy_type','fod_hazard'))),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Olivia Brenner',
 '57a1c585-209a-5012-9983-ff95142a9ff0','57a1c585-209a-5012-9983-ff95142a9ff0',
 timestamptz '2026-07-05 13:15:00+00', timestamptz '2026-07-05 12:55:00+00',
 timestamptz '2026-07-05 13:15:00+00', timestamptz '2026-07-05 13:15:00+00',
 42.6101, -82.8312, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F8 Cracked pavement TWY B
(md5('kdra-check-find-8')::uuid, 'AC-0208', 'other',
 jsonb_build_object(
   'other_subject','Pavement condition inspection — 14 CFR §139.305.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','Longitudinal cracking with minor spalling observed on TWY B near the apron entrance; sealed on an interim basis and added to the pavement maintenance program.',
     'location', jsonb_build_object('lat',42.6142,'lon',-82.8358),
     'location_text','TWY B — near apron entrance',
     'log_as_discrepancy', true,
     'discrepancy_title','Cracked pavement — TWY B','discrepancy_type','pavement'))),
 0, ARRAY['TWY B']::text[], 'completed', 'Marcus Delgado',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 timestamptz '2026-07-02 11:50:00+00', timestamptz '2026-07-02 11:30:00+00',
 timestamptz '2026-07-02 11:50:00+00', timestamptz '2026-07-02 11:50:00+00',
 42.6142, -82.8358, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F9 Suspected bird strike remains (bash)
(md5('kdra-check-find-9')::uuid, 'AC-0209', 'bash',
 jsonb_build_object(
   'condition_code','MODERATE',
   'species_observed','Gull remains recovered on the runway during a wildlife patrol, consistent with a possible strike; remains collected for reporting and the runway re-inspected.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','Suspected bird strike remains found on RWY 01/19; collected and logged for wildlife reporting. Increased patrols implemented.',
     'location', jsonb_build_object('lat',42.6095,'lon',-82.8301),
     'location_text','RWY 01/19 — mid-field',
     'log_as_discrepancy', true,
     'discrepancy_title','Suspected bird strike — RWY 01/19','discrepancy_type','wildlife'))),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Danielle Pearce',
 '44cc521d-5850-0faa-8f92-c030a19fce37','44cc521d-5850-0faa-8f92-c030a19fce37',
 timestamptz '2026-06-28 21:30:00+00', timestamptz '2026-06-28 21:08:00+00',
 timestamptz '2026-06-28 21:30:00+00', timestamptz '2026-06-28 21:30:00+00',
 42.6095, -82.8301, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F10 Unlit barricade light — West Ramp construction
(md5('kdra-check-find-10')::uuid, 'AC-020A', 'construction',
 jsonb_build_object(
   'construction_items','{"barricades":"F","fencing":"P","fod_mgmt":"P","markings":"P","movement":"P","notams":"P","obstruction":"P","rwy_taxi":"P","signage":"P","stockpile":"P","vehicles":"P"}'::jsonb,
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','One low-intensity barricade light unlit at the NE corner of the West Ramp rehabilitation area; contractor replaced the battery unit and relit before end of shift. Area stayed delineated by daylight barricades.',
     'location', jsonb_build_object('lat',42.6165,'lon',-82.8345),
     'location_text','West Ramp — NE corner, rehab area',
     'log_as_discrepancy', true,
     'discrepancy_title','Unlit barricade light — West Ramp construction','discrepancy_type','lighting'))),
 0, ARRAY['West Ramp']::text[], 'completed', 'Brian Okafor',
 '00b4cdd3-cbf0-0269-a366-3514870b0474','00b4cdd3-cbf0-0269-a366-3514870b0474',
 timestamptz '2026-06-24 23:10:00+00', timestamptz '2026-06-24 22:48:00+00',
 timestamptz '2026-06-24 23:10:00+00', timestamptz '2026-06-24 23:10:00+00',
 42.6165, -82.8345, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F11 Damaged guidance sign — TWY A
(md5('kdra-check-find-11')::uuid, 'AC-020B', 'other',
 jsonb_build_object(
   'other_subject','Signs and markings inspection — 14 CFR §139.311.',
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','TWY A location/direction sign panel cracked and partially illegible; replacement panel ordered. Temporary reference provided to pilots via ground control.',
     'location', jsonb_build_object('lat',42.6130,'lon',-82.8352),
     'location_text','TWY A — location/direction sign',
     'log_as_discrepancy', true,
     'discrepancy_title','Damaged guidance sign — TWY A','discrepancy_type','signage'))),
 0, ARRAY['TWY A']::text[], 'completed', 'Olivia Brenner',
 '57a1c585-209a-5012-9983-ff95142a9ff0','57a1c585-209a-5012-9983-ff95142a9ff0',
 timestamptz '2026-06-20 14:05:00+00', timestamptz '2026-06-20 13:45:00+00',
 timestamptz '2026-06-20 14:05:00+00', timestamptz '2026-06-20 14:05:00+00',
 42.6130, -82.8352, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F12 IFE response (in-flight emergency)
(md5('kdra-check-find-12')::uuid, 'AC-020C', 'ife',
 jsonb_build_object(
   'aircraft_type','B737-800',
   'callsign','Meridian 512',
   'nature','Hydraulic system caution; crew requested a precautionary landing with ARFF standby.',
   'actions', jsonb_build_array('ARFF positioned for standby','Runway inspected after landing','Aircraft taxied to gate under own power'),
   'agencies_notified', jsonb_build_array('ARFF','Air Traffic','Airport Operations')),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Anthony Ruiz',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 timestamptz '2026-06-16 18:45:00+00', timestamptz '2026-06-16 18:20:00+00',
 timestamptz '2026-06-16 18:45:00+00', timestamptz '2026-06-16 18:45:00+00',
 NULL, NULL, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F13 Ground emergency — brake fire
(md5('kdra-check-find-13')::uuid, 'AC-020D', 'ground_emergency',
 jsonb_build_object(
   'aircraft_type','Cessna Citation CJ3',
   'nature','Reported brake overheat and small fire on rollout; extinguished by ARFF.',
   'actions', jsonb_build_array('ARFF response and extinguishment','Aircraft towed clear of runway','Runway swept and inspected before reopening'),
   'agencies_notified', jsonb_build_array('ARFF','Air Traffic','Airport Operations'),
   'issues', jsonb_build_array(jsonb_build_object(
     'comment','Brake debris and extinguishing residue removed from the RWY 01/19 rollout area; runway inspected and returned to service.',
     'location', jsonb_build_object('lat',42.6098,'lon',-82.8305),
     'location_text','RWY 01/19 — rollout area',
     'log_as_discrepancy', false,
     'discrepancy_title','Debris removal after ground emergency','discrepancy_type','fod_hazard'))),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Marcus Delgado',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 timestamptz '2026-06-12 20:15:00+00', timestamptz '2026-06-12 19:52:00+00',
 timestamptz '2026-06-12 20:15:00+00', timestamptz '2026-06-12 20:15:00+00',
 42.6098, -82.8305, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
-- F14 Heavy aircraft movement check
(md5('kdra-check-find-14')::uuid, 'AC-020E', 'heavy_aircraft',
 jsonb_build_object('aircraft_type','B767-300F (cargo)'),
 0, ARRAY['RWY 01/19']::text[], 'completed', 'Danielle Pearce',
 '44cc521d-5850-0faa-8f92-c030a19fce37','44cc521d-5850-0faa-8f92-c030a19fce37',
 timestamptz '2026-06-30 10:30:00+00', timestamptz '2026-06-30 10:12:00+00',
 timestamptz '2026-06-30 10:30:00+00', timestamptz '2026-06-30 10:30:00+00',
 NULL, NULL, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3) check_comments — follow-up notes / coordination
--    ~23 on routine checks (every 7th) + 12 on findings = ~35 rows.
-- ---------------------------------------------------------------------
INSERT INTO check_comments (id, check_id, comment, user_name, created_at, base_id)
SELECT
  md5('kdra-checkcmt-'||i)::uuid,
  md5('kdra-check-'||i)::uuid,
  (ARRAY[
    'Coordinated with the FBO to sweep the affected area; re-inspected and confirmed clear.',
    'Condition noted and forwarded to maintenance for corrective action.',
    'Reviewed against NOTAM criteria — did not meet the reporting threshold; monitoring continued.',
    'Follow-up inspection completed next shift; no recurrence noted.',
    'Ground handler notified; origin of the debris under review.',
    'Airport Operations Manager briefed at shift change.',
    'Photos added to the work order for the maintenance crew.',
    'Re-checked after precipitation cleared; surfaces returned to normal.',
    'Verified corrective action closed out; area returned to service.',
    'Passed to the next shift for continued monitoring.'
  ])[1 + (i % 10)],
  (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1 + (i % 5)],
  ( timestamptz '2026-07-22 13:00:00+00'
      - make_interval(days => (178.0 * power((i-1)/165.0, 1.7))::int)
      - make_interval(hours => (i*5) % 16)
      - make_interval(mins  => (i*13) % 60)
      + make_interval(hours => 3 + (i % 5)) ),
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid
FROM generate_series(7,161,7) AS g(i)
ON CONFLICT (id) DO NOTHING;

INSERT INTO check_comments (id, check_id, comment, user_name, created_at, base_id)
VALUES
(md5('kdra-findcmt-1')::uuid,  md5('kdra-check-find-1')::uuid,  'Swept TWY A a second time and confirmed clear before releasing to ground control.', 'Anthony Ruiz', timestamptz '2026-07-20 15:05:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-2')::uuid,  md5('kdra-check-find-2')::uuid,  'Repainting added to the maintenance schedule; NOTAM not required at this stage.', 'Marcus Delgado', timestamptz '2026-07-18 12:30:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-3')::uuid,  md5('kdra-check-find-3')::uuid,  'Lamp replaced by maintenance the following morning; light back in service.', 'Brian Okafor', timestamptz '2026-07-15 14:20:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-4')::uuid,  md5('kdra-check-find-4')::uuid,  'Replacement wind cone fabric on order; secondary cone remains the primary reference.', 'Danielle Pearce', timestamptz '2026-07-12 17:00:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-6')::uuid,  md5('kdra-check-find-6')::uuid,  'Engineering walked the West Apron and confirmed a low spot; drain cleaning tasked.', 'Marcus Delgado', timestamptz '2026-07-09 10:15:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-7')::uuid,  md5('kdra-check-find-7')::uuid,  'Maintenance vehicle inspected; loose hardware secured and crew reminded on FOD control.', 'Anthony Ruiz', timestamptz '2026-07-05 15:40:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-8')::uuid,  md5('kdra-check-find-8')::uuid,  'Interim crack seal holding; TWY B added to the next pavement rehab cycle.', 'Brian Okafor', timestamptz '2026-07-03 09:20:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-9')::uuid,  md5('kdra-check-find-9')::uuid,  'Remains forwarded for wildlife strike reporting; patrol frequency increased for the week.', 'Olivia Brenner', timestamptz '2026-06-29 08:45:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-10')::uuid, md5('kdra-check-find-10')::uuid, 'Contractor confirmed all barricade lights checked at dusk going forward.', 'Marcus Delgado', timestamptz '2026-06-25 12:10:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-11')::uuid, md5('kdra-check-find-11')::uuid, 'Replacement sign panel received; install scheduled with the grounds crew.', 'Anthony Ruiz', timestamptz '2026-06-22 11:00:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-12')::uuid, md5('kdra-check-find-12')::uuid, 'Aircraft released after maintenance check; no runway impact. Event logged.', 'Marcus Delgado', timestamptz '2026-06-16 20:05:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid),
(md5('kdra-findcmt-13')::uuid, md5('kdra-check-find-13')::uuid, 'Runway reopened after sweep and inspection; ARFF report filed.', 'Anthony Ruiz', timestamptz '2026-06-12 21:00:00+00', 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4a) inspections — airfield periodic inspections (all-pass 23 + 4 findings)
--     Reuses the real 40-item airfield template snapshot (all "pass").
--     display_id namespace: AI-2026-01xx (all-pass), AI-2026-02xx (findings)
-- ---------------------------------------------------------------------
WITH tpl AS (
  SELECT $json$[
    {"id":"af-1","item":"Primary Surface — 1000' from runway centerline","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-2","item":"Transitional Slope (7:1)","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-3","item":"Runway Clear Zones — 3000'L x 3000'W","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-4","item":"Graded Portion of Clear Zone — 1000'L x 3000'W","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-5","item":"Approach / Departure Surface (50:1)","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-6","item":"Taxiway — 200' from centerline","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-7","item":"Apron — 110' from boundary marking","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-8","item":"Construction Areas","section":"Section 1 — Obstacle Clearance Criteria","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-11","item":"VFR Holding Positions","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-12","item":"Instrument Holding Positions","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-13","item":"Elevation Signs","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-14","item":"Taxiway Signs","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-15","item":"Windcone","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-16","item":"FOD/STOP","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-17","item":"Runway Signs","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-18","item":"NAVAID Ground Receiver Checkpoints","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-19","item":"Closed Areas","section":"Section 2 — Signs/Lights","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-20","item":"Parking","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-21","item":"Rules Compliance","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-22","item":"Construction Site Lighting/Marking","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-23","item":"Storage","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-24","item":"Vehicles Lighted/Marked","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-25","item":"FOD Control (Debris/Trash/Vehicle Routes)","section":"Section 3 — Construction","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-26","item":"Grass Height (7–14\")","section":"Section 4 — Habitat Management","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-27","item":"Ponding Effects","section":"Section 4 — Habitat Management","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-28","item":"Bird/Animal Survey","section":"Section 4 — Habitat Management","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-29","item":"Bird Watch Condition (BWC)","section":"Section 4 — Habitat Management","response":"pass","notes":"LOW","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-30","item":"Runway/Overruns 01/19","section":"Section 5 — Pavement Condition / Markings","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-31","item":"Taxiways","section":"Section 5 — Pavement Condition / Markings","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-32","item":"Access Roads / FOD Checks","section":"Section 5 — Pavement Condition / Markings","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-33","item":"Grounding Points","section":"Section 5 — Pavement Condition / Markings","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-34","item":"FOD Control","section":"Section 6 — Airfield Driving","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-35","item":"Compliance with Procedures","section":"Section 6 — Airfield Driving","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-36","item":"Properly Stowed/Secured Equipment","section":"Section 6 — Airfield Driving","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-37","item":"Runways/Overruns, Taxiways/Shoulders","section":"Section 7 — FOD Control","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-38","item":"Parking Aprons","section":"Section 7 — FOD Control","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-39","item":"Infield Areas Between Runways/Taxiways","section":"Section 7 — FOD Control","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-40","item":"Perimeter/Access Roads","section":"Section 7 — FOD Control","response":"pass","notes":"","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-rsc","item":"Runway Surface Condition (RSC)","section":"Runway Conditions","response":"pass","notes":"Dry","location":null,"photo_id":null,"generated_discrepancy_id":null},
    {"id":"af-rcr","item":"Runway Condition Reading (RCR)","section":"Runway Conditions","response":"pass","notes":"N/A — RSC only","location":null,"photo_id":null,"generated_discrepancy_id":null}
  ]$json$::jsonb AS items
),
allpass AS (
  SELECT
    i,
    (date '2026-07-22' - (176.0 * power((i-1)/22.0, 1.7))::int) AS d
  FROM generate_series(1,23) AS g(i)
),
finds(n, faildx, itemnote, insnote, dstr, authname, authid) AS (
  VALUES
   (1, 14, 'RWY 01 distance-remaining sign panel faded and partially illegible; maintenance work order submitted.',
        'One runway distance-remaining sign panel faded (RWY 01). Work order opened with maintenance; interim NOTAM not required. All other items satisfactory.',
        '2026-07-19', 'Brian Okafor', '00b4cdd3-cbf0-0269-a366-3514870b0474'),
   (2, 24, 'Standing water pooling along the West Ramp edge following overnight rain; drainage review requested.',
        'Ponding noted on West Ramp after precipitation; drainage review requested with Engineering. No impact to the movement area.',
        '2026-07-14', 'Danielle Pearce', '44cc521d-5850-0faa-8f92-c030a19fce37'),
   (3, 11, 'TWY A guidance sign partially obscured by vegetation; grounds crew tasked to clear.',
        'TWY A guidance sign obscured by overgrowth; grounds crew tasked. No operational restriction.',
        '2026-06-27', 'Olivia Brenner', '57a1c585-209a-5012-9983-ff95142a9ff0'),
   (4, 27, 'Rubber deposit buildup in the RWY 01 touchdown zone approaching the friction-review threshold; monitoring and scheduling rubber removal.',
        'Rubber buildup in the RWY 01 touchdown zone trending toward the friction threshold; rubber removal being scheduled. Continued monitoring.',
        '2026-05-30', 'Marcus Delgado', 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6')
)
INSERT INTO inspections
  (id, display_id, inspection_type, inspector_id, inspector_name, inspection_date,
   status, items, total_items, passed_count, failed_count, na_count, completion_percent,
   notes, completed_at, created_at, updated_at, construction_meeting, joint_monthly,
   bwc_value, weather_conditions, temperature_f, personnel,
   completed_by_name, completed_by_id, filed_by_name, filed_by_id, filed_at,
   base_id, rsc_condition, started_at)
-- all-pass airfield inspections (23)
SELECT
  md5('kdra-insp-ap-'||i)::uuid,
  'AI-2026-' || upper(lpad(to_hex(256 + i), 4, '0')),
  'airfield',
  (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1 + (i % 8)],
  (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1 + (i % 8)],
  d,
  'completed',
  tpl.items, 40, 40, 0, 0, 100,
  NULL,
  ((d + interval '14 hours' + make_interval(mins => (i*11) % 45)) AT TIME ZONE 'UTC'),
  ((d + interval '14 hours' + make_interval(mins => (i*11) % 45)) AT TIME ZONE 'UTC'),
  ((d + interval '14 hours' + make_interval(mins => (i*11) % 45)) AT TIME ZONE 'UTC'),
  false, false,
  (ARRAY['LOW','LOW','LOW','MOD'])[1 + (i % 4)],
  (ARRAY['Clear','Scattered clouds','Overcast','Few clouds','Broken clouds','Light rain'])[1 + (i % 6)],
  (28 + (extract(month from d)::int - 1) * 9 + (i % 5)),
  '{}'::text[],
  (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1 + (i % 8)],
  (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1 + (i % 8)],
  (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1 + (i % 8)],
  (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1 + (i % 8)],
  ((d + interval '14 hours 5 minutes' + make_interval(mins => (i*11) % 45)) AT TIME ZONE 'UTC'),
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  (ARRAY['Dry','Dry','Wet'])[1 + (i % 3)],
  ((d + interval '13 hours 20 minutes' + make_interval(mins => (i*11) % 45)) AT TIME ZONE 'UTC')
FROM allpass CROSS JOIN tpl
UNION ALL
-- airfield inspections with one finding (4)
SELECT
  md5('kdra-insp-find-'||n)::uuid,
  'AI-2026-' || upper(lpad(to_hex(512 + n), 4, '0')),
  'airfield',
  authid::uuid, authname,
  dstr::date,
  'completed',
  jsonb_set(
    jsonb_set(tpl.items, ARRAY[faildx::text,'response'], '"fail"'::jsonb, false),
    ARRAY[faildx::text,'notes'], to_jsonb(itemnote), false),
  40, 39, 1, 0, 100,
  insnote,
  ((dstr::date + interval '15 hours') AT TIME ZONE 'UTC'),
  ((dstr::date + interval '15 hours') AT TIME ZONE 'UTC'),
  ((dstr::date + interval '15 hours') AT TIME ZONE 'UTC'),
  false, false,
  'LOW',
  'Scattered clouds',
  (28 + (extract(month from dstr::date)::int - 1) * 9 + n),
  '{}'::text[],
  authname, authid::uuid, authname, authid::uuid,
  ((dstr::date + interval '15 hours 6 minutes') AT TIME ZONE 'UTC'),
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  'Dry',
  ((dstr::date + interval '14 hours 20 minutes') AT TIME ZONE 'UTC')
FROM finds CROSS JOIN tpl
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4b) inspections — construction meetings (4) + joint monthly (4)
--     Meeting-style records: items [], counts 0 (matches the app's new-forms).
--     display_id namespace: AI-2026-03xx
-- ---------------------------------------------------------------------
INSERT INTO inspections
  (id, display_id, inspection_type, inspector_id, inspector_name, inspection_date,
   status, items, total_items, passed_count, failed_count, na_count, completion_percent,
   notes, completed_at, created_at, updated_at, construction_meeting, joint_monthly,
   bwc_value, weather_conditions, temperature_f, personnel,
   completed_by_name, completed_by_id, filed_by_name, filed_by_id, filed_at, base_id, started_at)
VALUES
-- Construction coordination meetings
(md5('kdra-insp-con-1')::uuid, 'AI-2026-0301', 'construction_meeting',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado', date '2026-02-11', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Monthly construction coordination — West Ramp rehabilitation kickoff. Reviewed active work areas, barricade and lighting plan, haul routes, FOD control, and NOTAM coverage. Work windows confirmed with the contract tower; no safety-of-flight impacts.',
 (timestamptz '2026-02-11 15:00:00+00'), (timestamptz '2026-02-11 15:00:00+00'), (timestamptz '2026-02-11 15:00:00+00'),
 true, false, NULL, 'Overcast', 34,
 ARRAY['Airport Operations — Marcus Delgado','ARFF — Ramon Castellano','Engineering / Maintenance','Prime Contractor Superintendent','FAA ADO (teleconference)']::text[],
 'Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 (timestamptz '2026-02-11 15:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-02-11 14:15:00+00')),
(md5('kdra-insp-con-2')::uuid, 'AI-2026-0302', 'construction_meeting',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz', date '2026-04-08', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Construction coordination — West Ramp phase 2. Reviewed marking and signage changes, closed-area delineation, and vehicle escort procedures. Confirmed barricade lighting checks at dusk and updated NOTAMs.',
 (timestamptz '2026-04-08 15:00:00+00'), (timestamptz '2026-04-08 15:00:00+00'), (timestamptz '2026-04-08 15:00:00+00'),
 true, false, NULL, 'Few clouds', 55,
 ARRAY['Airport Operations — Anthony Ruiz','ARFF — Ramon Castellano','Engineering / Maintenance','Prime Contractor Superintendent','FAA ADO (teleconference)']::text[],
 'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 (timestamptz '2026-04-08 15:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-04-08 14:15:00+00')),
(md5('kdra-insp-con-3')::uuid, 'AI-2026-0303', 'construction_meeting',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado', date '2026-06-10', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Construction coordination — cargo apron rehabilitation. Reviewed stockpile locations, obstruction clearance, FOD management, and after-hours work approvals. No open safety items.',
 (timestamptz '2026-06-10 15:00:00+00'), (timestamptz '2026-06-10 15:00:00+00'), (timestamptz '2026-06-10 15:00:00+00'),
 true, false, NULL, 'Clear', 74,
 ARRAY['Airport Operations — Marcus Delgado','ARFF — Ramon Castellano','Engineering / Maintenance','Prime Contractor Superintendent','FAA ADO (teleconference)']::text[],
 'Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 (timestamptz '2026-06-10 15:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-06-10 14:15:00+00')),
(md5('kdra-insp-con-4')::uuid, 'AI-2026-0304', 'construction_meeting',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz', date '2026-07-15', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Construction coordination — cargo apron closeout planning. Reviewed punch-list items, restoration of markings, and return-to-service inspection scope. Final walk scheduled.',
 (timestamptz '2026-07-15 15:00:00+00'), (timestamptz '2026-07-15 15:00:00+00'), (timestamptz '2026-07-15 15:00:00+00'),
 true, false, NULL, 'Scattered clouds', 82,
 ARRAY['Airport Operations — Anthony Ruiz','ARFF — Ramon Castellano','Engineering / Maintenance','Prime Contractor Superintendent','FAA ADO (teleconference)']::text[],
 'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 (timestamptz '2026-07-15 15:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-07-15 14:15:00+00')),
-- Joint monthly airfield inspections
(md5('kdra-insp-jm-1')::uuid, 'AI-2026-0311', 'joint_monthly',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado', date '2026-03-19', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Joint monthly airfield inspection — Airport Operations, ARFF, contract tower, and Engineering. Reviewed pavement condition, markings/signs/lighting, safety areas, and open discrepancies. Action items assigned; no Part 139 findings.',
 (timestamptz '2026-03-19 16:00:00+00'), (timestamptz '2026-03-19 16:00:00+00'), (timestamptz '2026-03-19 16:00:00+00'),
 false, true, NULL, 'Broken clouds', 46,
 ARRAY['Airport Operations — Marcus Delgado','ARFF — Ramon Castellano','Air Traffic (contract tower)','Airport Engineering','FAA ADO']::text[],
 'Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 (timestamptz '2026-03-19 16:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-03-19 15:00:00+00')),
(md5('kdra-insp-jm-2')::uuid, 'AI-2026-0312', 'joint_monthly',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz', date '2026-05-21', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Joint monthly airfield inspection walk. Reviewed pavement, markings, signage, lighting, and NAVAID critical areas. Two prior-month action items closed; one drainage item carried forward. No Part 139 findings.',
 (timestamptz '2026-05-21 16:00:00+00'), (timestamptz '2026-05-21 16:00:00+00'), (timestamptz '2026-05-21 16:00:00+00'),
 false, true, NULL, 'Clear', 66,
 ARRAY['Airport Operations — Anthony Ruiz','ARFF — Ramon Castellano','Air Traffic (contract tower)','Airport Engineering','FAA ADO']::text[],
 'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 (timestamptz '2026-05-21 16:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-05-21 15:00:00+00')),
(md5('kdra-insp-jm-3')::uuid, 'AI-2026-0313', 'joint_monthly',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado', date '2026-06-18', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Joint monthly airfield inspection. Emphasis on the active construction area interfaces, wildlife habitat management, and lighting serviceability. Coordinated NOTAM review. No Part 139 findings.',
 (timestamptz '2026-06-18 16:00:00+00'), (timestamptz '2026-06-18 16:00:00+00'), (timestamptz '2026-06-18 16:00:00+00'),
 false, true, NULL, 'Few clouds', 76,
 ARRAY['Airport Operations — Marcus Delgado','ARFF — Ramon Castellano','Air Traffic (contract tower)','Airport Engineering','FAA ADO']::text[],
 'Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6','Marcus Delgado','af9a39db-76fd-4bcc-8d50-7afbc292eaf6',
 (timestamptz '2026-06-18 16:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-06-18 15:00:00+00')),
(md5('kdra-insp-jm-4')::uuid, 'AI-2026-0314', 'joint_monthly',
 '4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz', date '2026-07-16', 'completed',
 '[]'::jsonb, 0, 0, 0, 0, 100,
 'Joint monthly airfield inspection. Reviewed summer pavement condition, rubber removal planning for RWY 01, markings refresh, and open work orders. Action items assigned; no Part 139 findings.',
 (timestamptz '2026-07-16 16:00:00+00'), (timestamptz '2026-07-16 16:00:00+00'), (timestamptz '2026-07-16 16:00:00+00'),
 false, true, NULL, 'Scattered clouds', 83,
 ARRAY['Airport Operations — Anthony Ruiz','ARFF — Ramon Castellano','Air Traffic (contract tower)','Airport Engineering','FAA ADO']::text[],
 'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f','Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f',
 (timestamptz '2026-07-16 16:05:00+00'), 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, (timestamptz '2026-07-16 15:00:00+00'))
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5) inspection_item_system_links — link template items -> lighting systems
--    item_id -> base_inspection_items.id (real);  system_id -> lighting_systems.id (real)
--    component_id NULL (whole-system links).  12 rows.
-- ---------------------------------------------------------------------
INSERT INTO inspection_item_system_links (id, item_id, system_id, component_id, created_at)
VALUES
-- af-15 Windcone -> the three wind cones
(md5('kdra-iisl-1')::uuid,  '8016ea5a-32ef-4c1f-83ed-78a0ff3785ca', 'deb19b28-1a73-c1f5-b0cf-08da9070a183', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-2')::uuid,  '8016ea5a-32ef-4c1f-83ed-78a0ff3785ca', '6b3dd0ce-7a65-11f9-4a70-7518b07e84f0', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-3')::uuid,  '8016ea5a-32ef-4c1f-83ed-78a0ff3785ca', '19436d90-7bba-d8e9-fcb0-ded531ceeffe', NULL, timestamptz '2026-02-01 12:00:00+00'),
-- af-17 Runway Signs -> RWY 01/19 Airfield Signage
(md5('kdra-iisl-4')::uuid,  'a035debf-9488-48c7-9392-3f29385f1023', 'eed59c82-04b1-3c6b-66d7-1206cedbd6a4', NULL, timestamptz '2026-02-01 12:00:00+00'),
-- af-14 Taxiway Signs -> taxiway signage systems
(md5('kdra-iisl-5')::uuid,  '4470412c-361e-4998-985e-f71ccaa562a8', '2ac2d44a-6657-b455-eddb-6330c7446617', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-6')::uuid,  '4470412c-361e-4998-985e-f71ccaa562a8', 'ea8c69f1-a5ee-2930-8074-384d0a40573f', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-7')::uuid,  '4470412c-361e-4998-985e-f71ccaa562a8', '9d30f66c-61ee-a5a2-10ae-eddd683145a9', NULL, timestamptz '2026-02-01 12:00:00+00'),
-- af-30 Runway/Overruns 01/19 -> runway edge lights + PAPIs
(md5('kdra-iisl-8')::uuid,  'cd33fe19-4a4f-4686-858f-7504d516591b', '250ce902-a01e-982b-a811-812f925fb543', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-9')::uuid,  'cd33fe19-4a4f-4686-858f-7504d516591b', 'a5d8dca4-8d56-5c73-e5bf-9e3755975e8d', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-10')::uuid, 'cd33fe19-4a4f-4686-858f-7504d516591b', 'e27dcaa7-5fd3-e9d2-ce54-a9091ed72c18', NULL, timestamptz '2026-02-01 12:00:00+00'),
-- af-31 Taxiways -> taxiway edge lights
(md5('kdra-iisl-11')::uuid, '0217d394-3984-4956-a9d0-3441844d80a3', 'ada67b5e-3f01-c176-c3e5-a2d3f3e6e139', NULL, timestamptz '2026-02-01 12:00:00+00'),
(md5('kdra-iisl-12')::uuid, '0217d394-3984-4956-a9d0-3441844d80a3', 'cc2e0d90-de8e-d5d6-e725-5b74b68028fe', NULL, timestamptz '2026-02-01 12:00:00+00')
ON CONFLICT (id) DO NOTHING;

COMMIT;
