-- ============================================================================
-- KDRA Demo-Data Seed — CLUSTER D: Wildlife/BASH + WHMP + Field Conditions
-- Base: Demo Regional Airport (KDRA)  base_id ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- Runway 01/19 id 633cedfb-555a-4440-a5a0-9c734a4123da
-- Window 2026-01-24 .. 2026-07-23 (UTC), recent/spring-summer weighted.
-- Idempotent: deterministic md5 ids + ON CONFLICT (id) DO NOTHING.
-- INSERT-only. Enums/shape sampled from existing rows; RWYCC/FICON verified
-- against lib/calculations/rwycc.ts (AC 150/5200-30D).
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1) wildlife_sightings  (~130 rows)
--    species_group CHECK: bird|mammal|reptile|bat   size_category CHECK: small|medium|large
--    time_of_day/sky/precip/action lowercase (per existing rows).
--    observed_at recent-weighted via power curve; author civilian roster only.
-- ----------------------------------------------------------------------------
WITH s0 AS (
  SELECT i,
    (ARRAY[1,1,1,1,2,2,2,3,3,3,4,4,5,6,7,7,8,9,10])[1+(i%19)] AS sp
  FROM generate_series(1,130) AS i
),
s1 AS (
  SELECT s0.*,
    (ARRAY['Canada Goose','European Starling','Ring-billed Gull','Mallard','Killdeer','Mourning Dove','Red-tailed Hawk','Turkey Vulture','White-tailed Deer','Coyote'])[sp] AS species_common,
    (ARRAY['Branta canadensis','Sturnus vulgaris','Larus delawarensis','Anas platyrhynchos','Charadrius vociferus','Zenaida macroura','Buteo jamaicensis','Cathartes aura','Odocoileus virginianus','Canis latrans'])[sp] AS species_scientific,
    (ARRAY['bird','bird','bird','bird','bird','bird','bird','bird','mammal','mammal'])[sp] AS species_group,
    (ARRAY['large','small','medium','medium','medium','medium','large','large','large','large'])[sp] AS size_category,
    (ARRAY['dawn','day','day','dusk'])[1+(i%4)] AS time_of_day,
    ('2026-07-23 00:00:00+00'::timestamptz - (floor(power(i::numeric/130,1.7)*180))::int * interval '1 day') AS day0
  FROM s0
),
s2 AS (
  SELECT s1.*,
    (day0
      + (CASE time_of_day WHEN 'dawn' THEN 10+(i%2) WHEN 'day' THEN 14+(i%6) ELSE 22+(i%2) END) * interval '1 hour'
      + ((i*7)%60) * interval '1 minute') AS observed_at,
    CASE sp
      WHEN 1 THEN (ARRAY[4,1,7])[1+(i%3)]
      WHEN 2 THEN (ARRAY[3,5,7])[1+(i%3)]
      WHEN 3 THEN (ARRAY[1,2,5])[1+(i%3)]
      WHEN 4 THEN (ARRAY[4,1,7])[1+(i%3)]
      WHEN 5 THEN (ARRAY[3,7,8])[1+(i%3)]
      WHEN 6 THEN (ARRAY[3,7,8])[1+(i%3)]
      WHEN 7 THEN (ARRAY[9,10,6])[1+(i%3)]
      WHEN 8 THEN (ARRAY[9,10,6])[1+(i%3)]
      WHEN 9 THEN (ARRAY[8,6,3])[1+(i%3)]
      ELSE (ARRAY[8,6,7])[1+(i%3)]
    END AS loc_idx
  FROM s1
),
s3 AS (
  SELECT s2.*,
    (ARRAY['Rwy 01 approach end','Rwy 19 approach end','Infield grass east of Rwy 01/19','Retention pond, south infield','West Apron edge','North perimeter fence line','Grass shoulder, Rwy 01/19 midfield','South grass, perimeter side','Mid-field, over infield','Over RWY 01/19 approach corridor'])[loc_idx] AS location_text,
    (ARRAY[42.6221,42.6052,42.6131,42.6044,42.6098,42.6268,42.6120,42.6040,42.6127,42.6233])[loc_idx] + ((i%9)-4)*0.00035 AS latitude,
    (ARRAY[-82.8368,-82.8375,-82.8421,-82.8395,-82.8412,-82.8360,-82.8400,-82.8388,-82.8416,-82.8357])[loc_idx] + ((i%7)-3)*0.00035 AS longitude,
    CASE sp
      WHEN 1 THEN 5+(i%36) WHEN 2 THEN 20+(i%51) WHEN 3 THEN 8+(i%38) WHEN 4 THEN 3+(i%13)
      WHEN 5 THEN 1+(i%4) WHEN 6 THEN 2+(i%5) WHEN 7 THEN 1+(i%3) WHEN 8 THEN 1+(i%3)
      WHEN 9 THEN 1+(i%4) ELSE 1+(i%2) END AS count_observed,
    CASE sp
      WHEN 1 THEN (ARRAY['loafing','grazing','feeding'])[1+(i%3)]
      WHEN 2 THEN (ARRAY['feeding','transiting','loafing'])[1+(i%3)]
      WHEN 3 THEN (ARRAY['loafing','transiting','feeding'])[1+(i%3)]
      WHEN 4 THEN (ARRAY['loafing','feeding','transiting'])[1+(i%3)]
      WHEN 5 THEN (ARRAY['feeding','foraging','transiting'])[1+(i%3)]
      WHEN 6 THEN (ARRAY['feeding','perching','transiting'])[1+(i%3)]
      WHEN 7 THEN (ARRAY['soaring','perching','hunting'])[1+(i%3)]
      WHEN 8 THEN (ARRAY['soaring','circling','roosting'])[1+(i%3)]
      WHEN 9 THEN (ARRAY['grazing','bedded','transiting'])[1+(i%3)]
      ELSE (ARRAY['transiting','hunting','patrolling'])[1+(i%3)]
    END AS behavior
  FROM s2
),
s4 AS (
  SELECT s3.*,
    CASE
      WHEN sp IN (1,2,3,4) THEN (ARRAY['dispersed','hazed','dispersed'])[1+(i%3)]
      WHEN sp IN (9,10) THEN (ARRAY['hazed','none','hazed'])[1+(i%3)]
      ELSE 'none'
    END AS action_taken,
    (ARRAY['clear','some_cloud','overcast'])[1+(i%3)] AS sky_condition,
    (ARRAY['none','none','none','rain','fog'])[1+(i%5)] AS precipitation,
    (ARRAY['Danielle Pearce','Brian Okafor','Olivia Brenner','Anthony Ruiz','Marcus Delgado'])[1+(i%5)] AS observed_by,
    (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[])[1+(i%5)] AS observed_by_id
  FROM s3
),
s5 AS (
  SELECT s4.*,
    CASE
      WHEN action_taken='none' THEN NULL
      WHEN sp IN (1,4) THEN (ARRAY['pyrotechnics','propane_cannon','vehicle_hazing'])[1+(i%3)]
      WHEN sp IN (2,3) THEN (ARRAY['bioacoustics','pyrotechnics','vehicle_hazing'])[1+(i%3)]
      ELSE 'vehicle_hazing'
    END AS dispersal_method,
    CASE WHEN action_taken='none' THEN NULL WHEN (i%7)=0 THEN false ELSE true END AS dispersal_effective,
    CASE WHEN count_observed>=25 THEN 'MOD' ELSE 'LOW' END AS bwc_at_time
  FROM s4
)
INSERT INTO wildlife_sightings (
  id, base_id, display_id, species_common, species_scientific, species_group,
  size_category, count_observed, behavior, latitude, longitude, location_text,
  airfield_zone, observed_at, time_of_day, sky_condition, precipitation,
  action_taken, dispersal_method, dispersal_effective, observed_by, observed_by_id,
  photo_count, notes, bwc_at_time, created_at, updated_at)
SELECT
  md5('kdra-wildlife_sightings-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  'WS-D'||to_char(i,'FM0000'),
  species_common, species_scientific, species_group, size_category,
  count_observed, behavior, latitude, longitude, location_text, NULL,
  observed_at, time_of_day, sky_condition, precipitation,
  action_taken, dispersal_method, dispersal_effective,
  observed_by, observed_by_id, 0,
  CASE WHEN action_taken='none' THEN NULL
    ELSE species_common||' ('||count_observed::text||' observed) '||behavior||' - '||location_text
      ||'. Action: '||action_taken||' ('||replace(dispersal_method,'_',' ')||'). '
      ||CASE WHEN dispersal_effective THEN 'BWC returned to LOW; movement area clear.'
             ELSE 'Flock reformed nearby; continued monitoring and reassessed BWC.' END
  END,
  bwc_at_time,
  observed_at + interval '5 minutes',
  observed_at + interval '5 minutes'
FROM s5
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2) wildlife_strikes  (12 rows)
--    damage_level CHECK: none|minor|substantial|destroyed. Most none/minor.
--    Title-case time_of_day/sky_condition (per existing rows); FAA NWSD voice.
-- ----------------------------------------------------------------------------
INSERT INTO wildlife_strikes (
  id, base_id, display_id, species_common, species_scientific, species_group, size_category,
  number_struck, number_seen, location_text, strike_date, time_of_day, sky_condition, precipitation,
  aircraft_type, aircraft_registration, engine_type, phase_of_flight, altitude_agl, speed_ias,
  pilot_warned, parts_struck, parts_damaged, damage_level, engine_ingested, engines_ingested,
  flight_effect, repair_cost, other_cost, hours_out_of_service, remains_collected, remains_sent_to_lab,
  lab_identification, reported_by, reported_by_id, photo_count, notes, created_at, updated_at)
VALUES
 (md5('kdra-wildlife_strikes-1')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0001',
  'Mourning Dove','Zenaida macroura','bird','medium',1,3,'Short final RWY 19',
  '2026-02-15T15:20:00+00'::timestamptz,'Day','Overcast','None','C172 Skyhawk','N472DR','Piston','Approach',300,75,
  false,ARRAY['Windshield']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,false,false,NULL,
  'Danielle Pearce','44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,0,
  $c$Single dove struck the windshield on short final to RWY 19; no damage and the flight landed normally. No remains recovered. Logged to the FAA National Wildlife Strike Database (AC 150/5200-33B).$c$,
  '2026-02-15T15:45:00+00'::timestamptz,'2026-02-15T15:45:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-2')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0002',
  'European Starling','Sturnus vulgaris','bird','small',4,30,'RWY 19 touchdown zone',
  '2026-03-08T21:40:00+00'::timestamptz,'Dusk','Some Cloud','None','E175','N204YX','Turbofan','Landing Roll',0,110,
  true,ARRAY['Fuselage','Wing/Rotor']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,true,false,NULL,
  'Brian Okafor','00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,0,
  $c$Flushed a flock of starlings on the RWY 19 landing roll; crew reported no damage. Carcasses recovered on the post-event sweep and disposed of per the Wildlife Hazard Management Program. Reported to the FAA National Wildlife Strike Database.$c$,
  '2026-03-08T22:05:00+00'::timestamptz,'2026-03-08T22:05:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-3')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0003',
  'Ring-billed Gull','Larus delawarensis','bird','medium',1,6,'Short final RWY 01',
  '2026-04-02T18:10:00+00'::timestamptz,'Day','No Cloud','None','C560 Citation V','N560DR','Turbofan','Approach',250,130,
  false,ARRAY['Wing/Rotor']::text[],ARRAY['Wing/Rotor']::text[],'minor',false,'{}'::int[],'None',4200,NULL,4,true,false,NULL,
  'Olivia Brenner','57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,0,
  $c$Gull struck the left wing on short final to RWY 01; minor leading-edge damage found on post-flight inspection. Remains bagged. Reported to the FAA National Wildlife Strike Database (AC 150/5200-33B) and reviewed under the airport SMS.$c$,
  '2026-04-02T18:35:00+00'::timestamptz,'2026-04-02T18:35:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-4')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0004',
  'Killdeer','Charadrius vociferus','bird','medium',1,2,'RWY 01 departure, mid-field',
  '2026-04-27T11:05:00+00'::timestamptz,'Dawn','Some Cloud','None','PA-28 Cherokee','N318RA','Piston','Takeoff Run',0,60,
  false,ARRAY['Landing Gear']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,false,false,NULL,
  'Danielle Pearce','44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,0,
  $c$Killdeer struck the nosewheel during the takeoff roll on RWY 01; no damage, departure continued. Logged to the FAA National Wildlife Strike Database.$c$,
  '2026-04-27T11:30:00+00'::timestamptz,'2026-04-27T11:30:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-5')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0005',
  'Mallard','Anas platyrhynchos','bird','medium',1,4,'Final RWY 19',
  '2026-05-11T20:35:00+00'::timestamptz,'Dusk','Overcast','Rain','DHC-8-400','N833HZ','Turboprop','Approach',400,140,
  false,ARRAY['Radome','Wing/Rotor']::text[],ARRAY['Radome']::text[],'minor',false,'{}'::int[],'None',6800,NULL,8,true,true,
  'Smithsonian Feather Identification Lab - Anas platyrhynchos.',
  'Brian Okafor','00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,0,
  $c$Mallard struck the radome on final to RWY 19 in light rain; minor cracking to the nose radome. Remains collected and shipped to the Smithsonian Feather Identification Lab. Reported to the FAA National Wildlife Strike Database (AC 150/5200-33B).$c$,
  '2026-05-11T21:00:00+00'::timestamptz,'2026-05-11T21:00:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-6')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0006',
  'Canada Goose','Branta canadensis','bird','large',2,18,'Departure end RWY 01, approx 90 ft AGL',
  '2026-05-29T10:15:00+00'::timestamptz,'Dawn','Some Cloud','None','B737-700','N7148W','Turbofan','Climb',90,155,
  false,ARRAY['Engine No. 1','Nose/Radome']::text[],ARRAY['Engine No. 1']::text[],'substantial',true,ARRAY[1]::int[],'Precautionary Landing',220000,15000,72,true,true,
  'Smithsonian Feather Identification Lab - confirmed Branta canadensis (whole feather and DNA).',
  'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,0,
  $c$Struck a flock of Canada Geese just after rotation off RWY 01; No. 1 engine ingestion with rising EGT. Crew declared and returned for a precautionary landing; ARFF stood by (Chief Castellano) with no further incident. Remains collected and shipped to the Smithsonian Feather Identification Lab. Reported to the FAA National Wildlife Strike Database IAW AC 150/5200-33B; reviewed under the Wildlife Hazard Management Program and 14 CFR 139.337.$c$,
  '2026-05-29T10:40:00+00'::timestamptz,'2026-05-29T10:40:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-7')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0007',
  'Red-tailed Hawk','Buteo jamaicensis','bird','large',1,1,'Departure corridor RWY 01',
  '2026-06-12T19:50:00+00'::timestamptz,'Dusk','No Cloud','None','C208 Caravan','N208DR','Turboprop','Departure',500,120,
  false,ARRAY['Wing/Rotor']::text[],ARRAY['Wing/Rotor']::text[],'minor',false,'{}'::int[],'None',3100,NULL,3,true,false,NULL,
  'Olivia Brenner','57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,0,
  $c$Hawk struck the right wing in the departure corridor off RWY 01; minor skin damage. Remains collected. Reported to the FAA National Wildlife Strike Database and reviewed under the airport SMS.$c$,
  '2026-06-12T20:15:00+00'::timestamptz,'2026-06-12T20:15:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-8')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0008',
  'Big Brown Bat','Eptesicus fuscus','bat','small',1,1,'Final RWY 19',
  '2026-06-20T23:15:00+00'::timestamptz,'Night','No Cloud','None','CRJ700','N512QX','Turbofan','Approach',350,135,
  false,ARRAY['Wing/Rotor']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,false,false,NULL,
  'Danielle Pearce','44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,0,
  $c$Night bat strike on final to RWY 19; no damage reported by the crew. No remains recovered. Logged to the FAA National Wildlife Strike Database (AC 150/5200-33B).$c$,
  '2026-06-20T23:40:00+00'::timestamptz,'2026-06-20T23:40:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-9')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0009',
  'European Starling','Sturnus vulgaris','bird','small',3,45,'RWY 01 rollout',
  '2026-06-28T14:40:00+00'::timestamptz,'Day','Some Cloud','None','E145','N636AE','Turbofan','Landing Roll',0,108,
  true,ARRAY['Fuselage']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,true,false,NULL,
  'Brian Okafor','00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,0,
  $c$Starling flock encountered on the RWY 01 rollout; no damage. Carcasses recovered on the sweep and disposed of per the WHMP. Reported to the FAA National Wildlife Strike Database.$c$,
  '2026-06-28T15:05:00+00'::timestamptz,'2026-06-28T15:05:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-10')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0010',
  'Ring-billed Gull','Larus delawarensis','bird','medium',1,10,'RWY 19 touchdown zone',
  '2026-07-05T16:25:00+00'::timestamptz,'Day','Some Cloud','None','B737-800','N8642A','Turbofan','Landing Roll',0,120,
  false,ARRAY['Wing/Rotor','Landing Gear']::text[],ARRAY['Landing Gear']::text[],'minor',false,'{}'::int[],'None',5200,NULL,5,true,false,NULL,
  'Olivia Brenner','57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,0,
  $c$Gull struck the main gear in the RWY 19 touchdown zone during landing roll; minor gear-door damage. Remains recovered. Reported to the FAA National Wildlife Strike Database (AC 150/5200-33B).$c$,
  '2026-07-05T16:50:00+00'::timestamptz,'2026-07-05T16:50:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-11')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0011',
  'Turkey Vulture','Cathartes aura','bird','large',1,2,'RWY 01 approach, approx 600 ft AGL',
  '2026-07-12T12:30:00+00'::timestamptz,'Day','No Cloud','None','PC-12','N912DR','Turboprop','Approach',600,130,
  false,ARRAY['Wing/Rotor']::text[],ARRAY['Wing/Rotor']::text[],'minor',false,'{}'::int[],'None',4900,NULL,6,true,true,
  'Smithsonian Feather Identification Lab - Cathartes aura.',
  'Anthony Ruiz','4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,0,
  $c$Vulture struck the left wing on the RWY 01 approach around 600 ft AGL; minor leading-edge damage. Remains collected and shipped to the Smithsonian Feather Identification Lab. Reported to the FAA National Wildlife Strike Database and reviewed under 14 CFR 139.337.$c$,
  '2026-07-12T12:55:00+00'::timestamptz,'2026-07-12T12:55:00+00'::timestamptz),
 (md5('kdra-wildlife_strikes-12')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'WX-D0012',
  'Mourning Dove','Zenaida macroura','bird','medium',1,5,'RWY 19 departure',
  '2026-07-19T18:00:00+00'::timestamptz,'Day','Some Cloud','None','SR22','N225DR','Piston','Takeoff Run',0,70,
  false,ARRAY['Propeller']::text[],'{}'::text[],'none',false,'{}'::int[],'None',NULL,NULL,NULL,false,false,NULL,
  'Danielle Pearce','44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,0,
  $c$Dove struck the propeller arc during the RWY 19 takeoff roll; no damage, departure continued. Logged to the FAA National Wildlife Strike Database (AC 150/5200-33B).$c$,
  '2026-07-19T18:25:00+00'::timestamptz,'2026-07-19T18:25:00+00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3) wildlife_hazard_assessments  (2 prior-year WHA records: 2024, 2025)
--    UNIQUE(base_id, assessment_year) — existing row is 2026, so we add
--    2024 + 2025 and chain replaced_by_id -> next year -> existing 2026.
--    assessment_year CHECK 2000..2100. §139.337 annual WHA cadence.
--    ae_user_id = accountable executive (Karen Whitfield); reviewer/creator = Marcus.
-- ----------------------------------------------------------------------------
INSERT INTO wildlife_hazard_assessments (
  id, base_id, assessment_year, performed_by_user_id, performed_by_external, performed_at,
  report_url, storage_path, faa_accepted_at, faa_acceptance_ref, ae_user_id, ae_signed_at,
  last_reviewed_at, reviewed_by_user_id, review_notes, hazardous_species, mitigation_summary,
  findings, notes, replaced_by_id, created_at, created_by, updated_at)
VALUES
 (md5('kdra-wha-2024')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,2024,NULL,'USDA Wildlife Services','2024-09-18',
  'https://demo.glidepathops.com/sample-whmp-2024.pdf',NULL,'2024-10-07','ATL-WS-2024-02',
  'af5eed97-5425-d64b-358f-8c1b0e8050af'::uuid,'2024-10-15T14:00:00+00'::timestamptz,
  '2024-10-15T14:00:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,NULL,
  $j$[
    {"id":"1f0a5b2c-0001-4a00-9000-a00000000001","species":"Canada Goose","hazard_level":"high","attractants":["Stormwater retention pond, south infield","Standing water near RWY 01 threshold"],"mitigations":["Weekly mowing Apr-Oct","Pyrotechnic and propane-cannon dispersal","USDA Wildlife Services on-call for large goose events"]},
    {"id":"1f0a5b2c-0001-4a00-9000-a00000000002","species":"White-tailed Deer","hazard_level":"severe","attractants":["Forested perimeter with deer trails","Crop fields on north boundary"],"mitigations":["8-foot perimeter fence, quarterly inspection","Quarterly deer-track survey","Coordination with state wildlife on a managed hunt"]},
    {"id":"1f0a5b2c-0001-4a00-9000-a00000000003","species":"Ring-billed Gull","hazard_level":"medium","attractants":["Loafing on approach-end grass","Regional landfill ~4 NM west"],"mitigations":["Grass height maintained 7-14 inches","Vehicle hazing and bioacoustics"]}
  ]$j$::jsonb,
  $c$Baseline WHA established goose and deer as the primary hazards. Instituted biweekly mowing (Apr-Oct), two propane cannons near the RWY 01 threshold, and a quarterly perimeter-fence inspection cadence. USDA Wildlife Services retained on-call for goose events exceeding 25 birds.$c$,
  $j$[
    {"id":"2f0a5b2c-0002-4a00-9000-b00000000001","category":"habitat","finding":"Grass height exceeded the 7-14 inch target on the east infield during the July survey","recommended_action":"Move mowing cadence from biweekly to weekly May-Sep","sms_hazard_id":null},
    {"id":"2f0a5b2c-0002-4a00-9000-b00000000002","category":"infrastructure","finding":"South-infield retention pond holds standing water and attracts waterfowl","recommended_action":"Evaluate pond aeration or netting; add a propane cannon at the pond perimeter","sms_hazard_id":null}
  ]$j$::jsonb,
  $c$Assessment performed by a USDA WS biologist over 2 days (2024-09-16 to 09-18). Report filed with the FAA Regional Office 2024-09-25; acceptance letter received 2024-10-07.$c$,
  md5('kdra-wha-2025')::uuid,'2024-09-18T20:00:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'2024-10-15T14:00:00+00'::timestamptz),
 (md5('kdra-wha-2025')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,2025,NULL,'USDA Wildlife Services','2025-09-16',
  'https://demo.glidepathops.com/sample-whmp-2025.pdf',NULL,'2025-10-03','ATL-WS-2025-03',
  'af5eed97-5425-d64b-358f-8c1b0e8050af'::uuid,'2025-10-12T14:00:00+00'::timestamptz,
  '2025-10-12T14:00:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
  $c$Annual review confirmed the goose and deer mitigations remain effective; added starlings as an emerging medium hazard following two spring strike events.$c$,
  $j$[
    {"id":"1f0a5b2c-0003-4a00-9000-c00000000001","species":"Canada Goose","hazard_level":"high","attractants":["Stormwater retention pond, south infield","Standing water near RWY 01 threshold"],"mitigations":["Weekly mowing Apr-Oct","Pyrotechnic and propane-cannon dispersal","USDA Wildlife Services on-call for large goose events"]},
    {"id":"1f0a5b2c-0003-4a00-9000-c00000000002","species":"White-tailed Deer","hazard_level":"severe","attractants":["Forested perimeter with deer trails","Crop fields on north boundary"],"mitigations":["8-foot perimeter fence, quarterly inspection","Quarterly deer-track survey","Managed-hunt coordination with state wildlife"]},
    {"id":"1f0a5b2c-0003-4a00-9000-c00000000003","species":"European Starling","hazard_level":"medium","attractants":["Infield grass foraging","Roosting in the hangar complex"],"mitigations":["Bioacoustic distress-call units","Vehicle hazing on the sweep"]},
    {"id":"1f0a5b2c-0003-4a00-9000-c00000000004","species":"Ring-billed Gull","hazard_level":"medium","attractants":["Loafing on approach-end grass","Regional landfill ~4 NM west"],"mitigations":["Grass height maintained 7-14 inches","Vehicle hazing and pyrotechnics"]}
  ]$j$::jsonb,
  $c$Sustained weekly mowing (May-Sep) and propane-cannon coverage at the pond. Added two bioacoustic units for starling roost dispersal near the hangar complex. Perimeter-fence inspections held to a quarterly cadence with no deer incursions logged in 2025.$c$,
  $j$[
    {"id":"2f0a5b2c-0004-4a00-9000-d00000000001","category":"operations","finding":"Two spring starling strikes on the landing roll indicate an emerging roost hazard","recommended_action":"Deploy bioacoustic units at the hangar complex and add starlings to the daily sweep watch list","sms_hazard_id":null},
    {"id":"2f0a5b2c-0004-4a00-9000-d00000000002","category":"infrastructure","finding":"Retention-pond aeration deferred; pond continues to hold standing water in wet periods","recommended_action":"Program pond aeration for the next capital cycle; maintain propane-cannon coverage in the interim","sms_hazard_id":null}
  ]$j$::jsonb,
  $c$Assessment performed by a USDA WS biologist over 2 days (2025-09-15 to 09-16). Report filed with the FAA Regional Office 2025-09-23; acceptance letter received 2025-10-03.$c$,
  '7b9406c4-d803-45b4-b441-f0101129d009'::uuid,'2025-09-16T20:00:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'2025-10-12T14:00:00+00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4) field_condition_reports  (30 rows) + supersede chains within each event.
--    Winter (Jan-Mar): snow/ice/slush.  Spring/Summer: rain/ponding, recent-weighted.
--    RWYCC + ficon_text verified against lib/calculations/rwycc.ts (AC 150/5200-30D).
--    idx_fcr_base_runway_active is NON-unique; all rows are historical
--    (valid_until in the past) so none read as the current active report.
-- ----------------------------------------------------------------------------
INSERT INTO field_condition_reports (
  id, base_id, runway_id, generated_at, generated_by, generated_by_oi, valid_until,
  temperature_f, treatments, conditions_unchanged_since, superseded_by_id, notes, ficon_text, created_at)
VALUES
 (md5('kdra-fcr-1')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-01-27T12:30:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-01-27T12:30:00+00'::timestamptz + interval '7 hours',
  27,ARRAY['plowed']::text[],NULL,md5('kdra-fcr-2')::uuid,
  $c$Overnight snow event; plow crews on RWY 01/19 since 0500L. PIREP braking action medium.$c$,
  'RWY 01/19 3/3/3 100/100/100 PCT DRY SN 1.5IN TRTD W/PLOW','2026-01-27T12:30:00+00'::timestamptz),
 (md5('kdra-fcr-2')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-01-27T18:15:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-01-27T18:15:00+00'::timestamptz + interval '6 hours',
  30,ARRAY['plowed','chemically_treated']::text[],NULL,md5('kdra-fcr-3')::uuid,
  $c$Runway plowed and chemically treated; accumulation reduced, conditions improving.$c$,
  'RWY 01/19 4/4/4 80/80/80 PCT DRY SN 0.5IN TRTD W/PLOW W/CHEM','2026-01-27T18:15:00+00'::timestamptz),
 (md5('kdra-fcr-3')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-01-28T01:45:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-01-28T01:45:00+00'::timestamptz + interval '8 hours',
  26,'{}'::text[],NULL,NULL,
  $c$Runway cleared to bare and dry; winter operations complete for this event.$c$,
  'RWY 01/19 6/6/6 100/100/100 PCT DRY','2026-01-28T01:45:00+00'::timestamptz),
 (md5('kdra-fcr-4')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-03T11:00:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-02-03T11:00:00+00'::timestamptz + interval '6 hours',
  30,ARRAY['sanded']::text[],NULL,md5('kdra-fcr-5')::uuid,
  $c$Freezing rain overnight; glaze ice at midpoint and rollout. Sand applied for traction. PIREP braking action poor; brief RWY closure considered.$c$,
  'RWY 01/19 3/1/1 40/60/50 PCT ICE PATCHES ICE TRTD W/SAND','2026-02-03T11:00:00+00'::timestamptz),
 (md5('kdra-fcr-5')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-03T16:30:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-02-03T16:30:00+00'::timestamptz + interval '6 hours',
  34,ARRAY['chemically_treated','sanded']::text[],NULL,md5('kdra-fcr-6')::uuid,
  $c$Temperatures rose above freezing; ice melted to a wet surface. Chemical treatment holding.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET TRTD W/CHEM W/SAND','2026-02-03T16:30:00+00'::timestamptz),
 (md5('kdra-fcr-6')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-03T23:00:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-02-03T23:00:00+00'::timestamptz + interval '8 hours',
  33,'{}'::text[],NULL,NULL,
  $c$Surface dried to bare/dry; report closed.$c$,
  'RWY 01/19 6/6/6 100/100/100 PCT DRY','2026-02-03T23:00:00+00'::timestamptz),
 (md5('kdra-fcr-7')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-11T13:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-02-11T13:00:00+00'::timestamptz + interval '5 hours',
  24,ARRAY['plowed']::text[],NULL,md5('kdra-fcr-8')::uuid,
  $c$Heavy snow, 2 inches and accumulating. Continuous plowing on RWY 01/19.$c$,
  'RWY 01/19 3/3/3 100/100/100 PCT DRY SN 2IN TRTD W/PLOW','2026-02-11T13:00:00+00'::timestamptz),
 (md5('kdra-fcr-8')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-11T17:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-02-11T17:00:00+00'::timestamptz + interval '5 hours',
  22,ARRAY['plowed']::text[],NULL,md5('kdra-fcr-9')::uuid,
  $c$Rollout compacting under traffic despite plowing; touchdown and midpoint still loose snow.$c$,
  'RWY 01/19 4/4/3 100/100/100 PCT DRY SN COMPACTED SN 1IN TRTD W/PLOW','2026-02-11T17:00:00+00'::timestamptz),
 (md5('kdra-fcr-9')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-12T02:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-02-12T02:00:00+00'::timestamptz + interval '8 hours',
  20,ARRAY['plowed','sanded']::text[],NULL,md5('kdra-fcr-10')::uuid,
  $c$Overnight compacted snow across all thirds; sanded for traction. Braking action medium.$c$,
  'RWY 01/19 3/3/3 100/100/100 PCT COMPACTED SN TRTD W/PLOW W/SAND','2026-02-12T02:00:00+00'::timestamptz),
 (md5('kdra-fcr-10')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-12T15:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-02-12T15:00:00+00'::timestamptz + interval '8 hours',
  31,'{}'::text[],NULL,NULL,
  $c$Daytime warm-up plus treatment cleared runway to bare and dry.$c$,
  'RWY 01/19 6/6/6 100/100/100 PCT DRY','2026-02-12T15:00:00+00'::timestamptz),
 (md5('kdra-fcr-11')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-19T14:00:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-02-19T14:00:00+00'::timestamptz + interval '6 hours',
  34,ARRAY['plowed']::text[],NULL,md5('kdra-fcr-12')::uuid,
  $c$Wet snow turned to deep slush near freezing across all thirds. Braking action medium to poor.$c$,
  'RWY 01/19 2/2/2 90/90/90 PCT SLUSH 0.75IN TRTD W/PLOW','2026-02-19T14:00:00+00'::timestamptz),
 (md5('kdra-fcr-12')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-02-19T20:30:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-02-19T20:30:00+00'::timestamptz + interval '8 hours',
  30,ARRAY['plowed','chemically_treated']::text[],NULL,NULL,
  $c$Slush plowed and chemically treated; surface now wet.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET TRTD W/PLOW W/CHEM','2026-02-19T20:30:00+00'::timestamptz),
 (md5('kdra-fcr-13')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-03-02T11:30:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'MD','2026-03-02T11:30:00+00'::timestamptz + interval '4 hours',
  30,'{}'::text[],NULL,md5('kdra-fcr-14')::uuid,
  $c$Radiation frost on the runway at dawn; monitored, expected to burn off by mid-morning.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT FROST','2026-03-02T11:30:00+00'::timestamptz),
 (md5('kdra-fcr-14')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-03-02T15:30:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'MD','2026-03-02T15:30:00+00'::timestamptz + interval '6 hours',
  40,'{}'::text[],NULL,NULL,
  $c$Frost dissipated with rising temperatures; runway dry.$c$,
  'RWY 01/19 6/6/6 100/100/100 PCT DRY','2026-03-02T15:30:00+00'::timestamptz),
 (md5('kdra-fcr-15')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-03-14T12:00:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-03-14T12:00:00+00'::timestamptz + interval '6 hours',
  28,ARRAY['plowed']::text[],NULL,md5('kdra-fcr-16')::uuid,
  $c$Late-season wet snow, heavy and adhering. Plowing in progress. PIREP braking action medium to poor.$c$,
  'RWY 01/19 2/2/2 100/100/100 PCT WET SN 1.5IN TRTD W/PLOW','2026-03-14T12:00:00+00'::timestamptz),
 (md5('kdra-fcr-16')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-03-14T19:00:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-03-14T19:00:00+00'::timestamptz + interval '8 hours',
  36,ARRAY['plowed','chemically_treated']::text[],NULL,NULL,
  $c$Snow cleared; surface wet with temperatures above freezing.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET TRTD W/PLOW W/CHEM','2026-03-14T19:00:00+00'::timestamptz),
 (md5('kdra-fcr-17')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-01-31T12:00:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-01-31T12:00:00+00'::timestamptz + interval '5 hours',
  31,ARRAY['sanded']::text[],NULL,NULL,
  $c$Isolated ice patches at midpoint and rollout from overnight refreeze; sanded. Touchdown dry.$c$,
  'RWY 01/19 6/3/3 100/30/30 PCT DRY ICE PATCHES TRTD W/SAND','2026-01-31T12:00:00+00'::timestamptz),
 (md5('kdra-fcr-18')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-04-18T20:00:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-04-18T20:00:00+00'::timestamptz + interval '4 hours',
  55,'{}'::text[],NULL,md5('kdra-fcr-19')::uuid,
  $c$Heavy thunderstorms; standing water at midpoint and rollout with partial ponding near centerline.$c$,
  'RWY 01/19 5/3/3 100/100/100 PCT WET 0.25IN','2026-04-18T20:00:00+00'::timestamptz),
 (md5('kdra-fcr-19')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-04-18T23:30:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-04-18T23:30:00+00'::timestamptz + interval '6 hours',
  58,'{}'::text[],NULL,NULL,
  $c$Rain ended; standing water drained, surface wet.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-04-18T23:30:00+00'::timestamptz),
 (md5('kdra-fcr-20')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-05-06T21:00:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-05-06T21:00:00+00'::timestamptz + interval '5 hours',
  60,'{}'::text[],NULL,NULL,
  $c$Steady rain; runway wet with no measurable standing water. Braking action good.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-05-06T21:00:00+00'::timestamptz),
 (md5('kdra-fcr-21')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-05-22T19:30:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-05-22T19:30:00+00'::timestamptz + interval '3 hours',
  66,'{}'::text[],NULL,md5('kdra-fcr-22')::uuid,
  $c$Intense downpour; ponding along the RWY 19 rollout. Pilots advised of standing water.$c$,
  'RWY 01/19 3/2/3 100/100/100 PCT WET 0.75IN','2026-05-22T19:30:00+00'::timestamptz),
 (md5('kdra-fcr-22')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-05-22T22:00:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-05-22T22:00:00+00'::timestamptz + interval '5 hours',
  64,'{}'::text[],NULL,NULL,
  $c$Cell passed; standing water receding, surface wet.$c$,
  'RWY 01/19 5/5/5 90/90/90 PCT WET','2026-05-22T22:00:00+00'::timestamptz),
 (md5('kdra-fcr-23')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-06-09T18:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-06-09T18:00:00+00'::timestamptz + interval '4 hours',
  70,'{}'::text[],NULL,NULL,
  $c$Afternoon convective rain; runway wet. Braking action good.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-06-09T18:00:00+00'::timestamptz),
 (md5('kdra-fcr-24')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-06-24T20:30:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-06-24T20:30:00+00'::timestamptz + interval '4 hours',
  72,'{}'::text[],NULL,md5('kdra-fcr-25')::uuid,
  $c$Line of storms; standing water at midpoint and rollout. Ponding photographed for the record.$c$,
  'RWY 01/19 5/3/3 100/100/100 PCT WET 0.25IN','2026-06-24T20:30:00+00'::timestamptz),
 (md5('kdra-fcr-25')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-06-24T23:30:00+00'::timestamptz,'57a1c585-209a-5012-9983-ff95142a9ff0'::uuid,'OB','2026-06-24T23:30:00+00'::timestamptz + interval '6 hours',
  71,'{}'::text[],NULL,NULL,
  $c$Water drained; surface wet.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-06-24T23:30:00+00'::timestamptz),
 (md5('kdra-fcr-26')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-07-07T19:00:00+00'::timestamptz,'00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid,'BO','2026-07-07T19:00:00+00'::timestamptz + interval '4 hours',
  78,'{}'::text[],NULL,NULL,
  $c$Brief heavy shower; runway wet, drained quickly.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-07-07T19:00:00+00'::timestamptz),
 (md5('kdra-fcr-27')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-07-15T21:30:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-07-15T21:30:00+00'::timestamptz + interval '3 hours',
  74,'{}'::text[],NULL,md5('kdra-fcr-28')::uuid,
  $c$Severe thunderstorm; heavy ponding at the RWY 19 end. Braking action medium to poor on rollout; advisory issued to traffic.$c$,
  'RWY 01/19 5/3/2 100/100/100 PCT WET 0.75IN','2026-07-15T21:30:00+00'::timestamptz),
 (md5('kdra-fcr-28')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-07-15T23:45:00+00'::timestamptz,'44cc521d-5850-0faa-8f92-c030a19fce37'::uuid,'DP','2026-07-15T23:45:00+00'::timestamptz + interval '5 hours',
  73,'{}'::text[],NULL,NULL,
  $c$Storm cleared; standing water drained, surface wet.$c$,
  'RWY 01/19 5/5/5 80/80/80 PCT WET','2026-07-15T23:45:00+00'::timestamptz),
 (md5('kdra-fcr-29')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-07-21T18:30:00+00'::timestamptz,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'MD','2026-07-21T18:30:00+00'::timestamptz + interval '4 hours',
  80,'{}'::text[],NULL,NULL,
  $c$Afternoon rain; runway wet. Braking action good. Routine wet-runway report.$c$,
  'RWY 01/19 5/5/5 100/100/100 PCT WET','2026-07-21T18:30:00+00'::timestamptz),
 (md5('kdra-fcr-30')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,'633cedfb-555a-4440-a5a0-9c734a4123da'::uuid,
  '2026-07-22T20:00:00+00'::timestamptz,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,'AR','2026-07-22T20:00:00+00'::timestamptz + interval '4 hours',
  79,'{}'::text[],NULL,NULL,
  $c$Standing water with pilot-reported medium braking; touchdown RwyCC manually downgraded per AC 150/5200-30D operator override.$c$,
  'RWY 01/19 3/3/3 100/100/100 PCT WET 0.25IN','2026-07-22T20:00:00+00'::timestamptz)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5) field_condition_thirds  (90 rows: 3 per report)
--    third CHECK: touchdown|midpoint|rollout ; contaminant CHECK (13 values);
--    rwycc/rwycc_derived 0..6 ; coverage 0..100. UNIQUE(report_id, third).
--    rwycc values are the AC 30D deriveRwycc() outputs; report 30 carries a
--    documented touchdown operator override (derived 5 -> final 3).
-- ----------------------------------------------------------------------------
INSERT INTO field_condition_thirds (
  id, report_id, third, contaminant, depth_in, coverage_percent, rwycc, rwycc_derived,
  rwycc_manual_override, override_reason, sort_order)
SELECT md5('kdra-fct-'||n::text||'-'||third)::uuid, md5('kdra-fcr-'||n::text)::uuid,
       third, contaminant, depth_in, coverage_percent, rwycc, rwycc_derived, override, reason, sort
FROM (VALUES
  (1,'touchdown','dry_snow',1.5,100,3,3,false,NULL,0),(1,'midpoint','dry_snow',1.5,100,3,3,false,NULL,1),(1,'rollout','dry_snow',1.5,100,3,3,false,NULL,2),
  (2,'touchdown','dry_snow',0.5,80,4,4,false,NULL,0),(2,'midpoint','dry_snow',0.5,80,4,4,false,NULL,1),(2,'rollout','dry_snow',0.5,80,4,4,false,NULL,2),
  (3,'touchdown','dry',NULL,100,6,6,false,NULL,0),(3,'midpoint','dry',NULL,100,6,6,false,NULL,1),(3,'rollout','dry',NULL,100,6,6,false,NULL,2),
  (4,'touchdown','ice_patches',NULL,40,3,3,false,NULL,0),(4,'midpoint','ice',NULL,60,1,1,false,NULL,1),(4,'rollout','ice',NULL,50,1,1,false,NULL,2),
  (5,'touchdown','wet',NULL,100,5,5,false,NULL,0),(5,'midpoint','wet',NULL,100,5,5,false,NULL,1),(5,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (6,'touchdown','dry',NULL,100,6,6,false,NULL,0),(6,'midpoint','dry',NULL,100,6,6,false,NULL,1),(6,'rollout','dry',NULL,100,6,6,false,NULL,2),
  (7,'touchdown','dry_snow',2.0,100,3,3,false,NULL,0),(7,'midpoint','dry_snow',2.0,100,3,3,false,NULL,1),(7,'rollout','dry_snow',2.0,100,3,3,false,NULL,2),
  (8,'touchdown','dry_snow',1.0,100,4,4,false,NULL,0),(8,'midpoint','dry_snow',1.0,100,4,4,false,NULL,1),(8,'rollout','compacted_snow',NULL,100,3,3,false,NULL,2),
  (9,'touchdown','compacted_snow',NULL,100,3,3,false,NULL,0),(9,'midpoint','compacted_snow',NULL,100,3,3,false,NULL,1),(9,'rollout','compacted_snow',NULL,100,3,3,false,NULL,2),
  (10,'touchdown','dry',NULL,100,6,6,false,NULL,0),(10,'midpoint','dry',NULL,100,6,6,false,NULL,1),(10,'rollout','dry',NULL,100,6,6,false,NULL,2),
  (11,'touchdown','slush',0.75,90,2,2,false,NULL,0),(11,'midpoint','slush',0.75,90,2,2,false,NULL,1),(11,'rollout','slush',0.75,90,2,2,false,NULL,2),
  (12,'touchdown','wet',NULL,100,5,5,false,NULL,0),(12,'midpoint','wet',NULL,100,5,5,false,NULL,1),(12,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (13,'touchdown','frost',NULL,100,5,5,false,NULL,0),(13,'midpoint','frost',NULL,100,5,5,false,NULL,1),(13,'rollout','frost',NULL,100,5,5,false,NULL,2),
  (14,'touchdown','dry',NULL,100,6,6,false,NULL,0),(14,'midpoint','dry',NULL,100,6,6,false,NULL,1),(14,'rollout','dry',NULL,100,6,6,false,NULL,2),
  (15,'touchdown','wet_snow',1.5,100,2,2,false,NULL,0),(15,'midpoint','wet_snow',1.5,100,2,2,false,NULL,1),(15,'rollout','wet_snow',1.5,100,2,2,false,NULL,2),
  (16,'touchdown','wet',NULL,100,5,5,false,NULL,0),(16,'midpoint','wet',NULL,100,5,5,false,NULL,1),(16,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (17,'touchdown','dry',NULL,100,6,6,false,NULL,0),(17,'midpoint','ice_patches',NULL,30,3,3,false,NULL,1),(17,'rollout','ice_patches',NULL,30,3,3,false,NULL,2),
  (18,'touchdown','wet',NULL,100,5,5,false,NULL,0),(18,'midpoint','wet',0.25,100,3,3,false,NULL,1),(18,'rollout','wet',0.25,100,3,3,false,NULL,2),
  (19,'touchdown','wet',NULL,100,5,5,false,NULL,0),(19,'midpoint','wet',NULL,100,5,5,false,NULL,1),(19,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (20,'touchdown','wet',NULL,100,5,5,false,NULL,0),(20,'midpoint','wet',NULL,100,5,5,false,NULL,1),(20,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (21,'touchdown','wet',0.5,100,3,3,false,NULL,0),(21,'midpoint','wet',0.75,100,2,2,false,NULL,1),(21,'rollout','wet',0.5,100,3,3,false,NULL,2),
  (22,'touchdown','wet',NULL,90,5,5,false,NULL,0),(22,'midpoint','wet',NULL,90,5,5,false,NULL,1),(22,'rollout','wet',NULL,90,5,5,false,NULL,2),
  (23,'touchdown','wet',NULL,100,5,5,false,NULL,0),(23,'midpoint','wet',NULL,100,5,5,false,NULL,1),(23,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (24,'touchdown','wet',NULL,100,5,5,false,NULL,0),(24,'midpoint','wet',0.25,100,3,3,false,NULL,1),(24,'rollout','wet',0.25,100,3,3,false,NULL,2),
  (25,'touchdown','wet',NULL,100,5,5,false,NULL,0),(25,'midpoint','wet',NULL,100,5,5,false,NULL,1),(25,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (26,'touchdown','wet',NULL,100,5,5,false,NULL,0),(26,'midpoint','wet',NULL,100,5,5,false,NULL,1),(26,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (27,'touchdown','wet',NULL,100,5,5,false,NULL,0),(27,'midpoint','wet',0.5,100,3,3,false,NULL,1),(27,'rollout','wet',0.75,100,2,2,false,NULL,2),
  (28,'touchdown','wet',NULL,80,5,5,false,NULL,0),(28,'midpoint','wet',NULL,80,5,5,false,NULL,1),(28,'rollout','wet',NULL,80,5,5,false,NULL,2),
  (29,'touchdown','wet',NULL,100,5,5,false,NULL,0),(29,'midpoint','wet',NULL,100,5,5,false,NULL,1),(29,'rollout','wet',NULL,100,5,5,false,NULL,2),
  (30,'touchdown','wet',NULL,100,3,5,true,'Downgraded per PIREP - braking action reported medium in the touchdown zone by an inbound CRJ.',0),(30,'midpoint','wet',0.25,100,3,3,false,NULL,1),(30,'rollout','wet',0.25,100,3,3,false,NULL,2)
) AS v(n, third, contaminant, depth_in, coverage_percent, rwycc, rwycc_derived, override, reason, sort)
ON CONFLICT (id) DO NOTHING;

COMMIT;
