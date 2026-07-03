-- Seed: KDRA (Demo Regional Airport) wildlife + extra completed
-- self-inspections, for the Phase 3 civilian marketing captures.
--
-- Why: the phase-3 civilian seed staged SMS/AEP/WHMP but left the wildlife
-- module empty (0 sightings / 0 strikes / 0 species) and only one completed
-- self-inspection — the `civ-wildlife` still had nothing to photograph and
-- the `civ-self-inspections` list looked unused (2026-07-03 session).
--
-- Marketing hardening (claims guardrail = identifiability):
--   * every new row is attributed to the fictional persona "TSgt Demo"
--     (matches the existing KDMO sightings); no real names/units/emails
--   * location_text uses generic field features only
--   * no depredation rows — actions are none / hazed / dispersed
-- Values are app-legal: species match lib/wildlife-species-data.ts exactly;
-- action/dispersal/sky/precip/time-of-day match lib/constants.ts option
-- lists; coordinates sit on the demo field (both demo bases are Selfridge
-- clones — KDMO's real sightings anchor the same envelope).
--
-- Idempotent: exits early if the WS-C%% display_ids already exist.
-- To reset:
--   DELETE FROM wildlife_sightings   WHERE display_id LIKE 'WS-C%'
--     AND base_id = (SELECT id FROM bases WHERE icao = 'KDRA');
--   DELETE FROM base_wildlife_species
--     WHERE base_id = (SELECT id FROM bases WHERE icao = 'KDRA');
--   DELETE FROM inspections WHERE display_id IN
--     ('AI-2026-CQAD','AI-2026-CPZR','AI-2026-CNKT');

DO $$
DECLARE
  kdra uuid;
  demo_uid uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN
    RAISE EXCEPTION 'KDRA (Demo Regional Airport) not found';
  END IF;
  SELECT id INTO demo_uid FROM profiles WHERE email = 'demo@glidepathops.com';

  IF EXISTS (SELECT 1 FROM wildlife_sightings
             WHERE base_id = kdra AND display_id LIKE 'WS-C%') THEN
    RAISE NOTICE 'KDRA wildlife already seeded — skipping';
    RETURN;
  END IF;

  -- ── 1. Quick-pick species list (base_wildlife_species) ──
  INSERT INTO base_wildlife_species (base_id, species_common, is_favorite, added_by)
  VALUES
    (kdra, 'Canada Goose',      true, demo_uid),
    (kdra, 'Ring-billed Gull',  true, demo_uid),
    (kdra, 'Killdeer',          true, demo_uid),
    (kdra, 'European Starling', true, demo_uid),
    (kdra, 'Mallard',           true, demo_uid),
    (kdra, 'Mourning Dove',     true, demo_uid),
    (kdra, 'Red-tailed Hawk',   true, demo_uid),
    (kdra, 'Turkey Vulture',    true, demo_uid),
    (kdra, 'White-tailed Deer', true, demo_uid),
    (kdra, 'Coyote',            true, demo_uid);

  -- ── 2. Sightings: 18 rows, ~6 weeks, three field clusters ──
  -- A: Rwy 01 approach end   (42.6215..35, -82.8375..55)
  -- B: infield grass, mid    (42.6115..35, -82.8425..05)
  -- C: south pond / grass    (42.6035..55, -82.8405..85)
  INSERT INTO wildlife_sightings
    (base_id, display_id, species_common, species_scientific, species_group,
     size_category, count_observed, behavior, latitude, longitude,
     location_text, observed_at, time_of_day, sky_condition, precipitation,
     action_taken, dispersal_method, dispersal_effective,
     observed_by, observed_by_id, bwc_at_time, created_at)
  VALUES
    -- Cluster A — approach end
    (kdra,'WS-CAAG','Canada Goose','Branta canadensis','bird','large',22,'loafing',
     42.62210,-82.83680,'Rwy 01 approach end','2026-07-03 10:45+00','dawn','clear','none',
     'dispersed','pyrotechnics',true,'TSgt Demo',demo_uid,'MOD','2026-07-03 10:52+00'),
    (kdra,'WS-CABG','Ring-billed Gull','Larus delawarensis','bird','medium',15,'transiting',
     42.62290,-82.83610,'Rwy 01 approach end','2026-07-02 14:20+00','day','some_cloud','none',
     'dispersed','vehicle_hazing',true,'TSgt Demo',demo_uid,'LOW','2026-07-02 14:26+00'),
    (kdra,'WS-CACG','Canada Goose','Branta canadensis','bird','large',12,'feeding',
     42.62180,-82.83730,'Grass shoulder, Rwy 01 approach','2026-06-30 11:05+00','dawn','overcast','fog',
     'dispersed','pyrotechnics',true,'TSgt Demo',demo_uid,'LOW','2026-06-30 11:12+00'),
    (kdra,'WS-CADV','Turkey Vulture','Cathartes aura','bird','large',3,'soaring',
     42.62330,-82.83570,'Over approach corridor','2026-06-25 01:10+00','dusk','clear','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-06-25 01:16+00'),
    (kdra,'WS-CAEG','Ring-billed Gull','Larus delawarensis','bird','medium',24,'loafing',
     42.62250,-82.83660,'Rwy 01 approach end','2026-06-15 13:40+00','day','overcast','none',
     'hazed','bioacoustics',false,'TSgt Demo',demo_uid,'MOD','2026-06-15 13:47+00'),

    -- Cluster B — infield grass
    (kdra,'WS-CBAK','Killdeer','Charadrius vociferus','bird','medium',3,'feeding',
     42.61240,-82.84120,'Infield grass east of Rwy 01/19','2026-07-03 15:10+00','day','clear','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-07-03 15:15+00'),
    (kdra,'WS-CBBS','European Starling','Sturnus vulgaris','bird','small',60,'feeding',
     42.61310,-82.84210,'Infield grass east of Rwy 01/19','2026-07-01 12:30+00','day','some_cloud','none',
     'dispersed','bioacoustics',true,'TSgt Demo',demo_uid,'MOD','2026-07-01 12:38+00'),
    (kdra,'WS-CBCD','White-tailed Deer','Odocoileus virginianus','mammal','large',2,'grazing',
     42.61180,-82.84080,'Infield grass, mid-field','2026-06-28 10:20+00','dawn','clear','none',
     'hazed','vehicle_hazing',true,'TSgt Demo',demo_uid,'LOW','2026-06-28 10:29+00'),
    (kdra,'WS-CBDH','Red-tailed Hawk','Buteo jamaicensis','bird','large',1,'soaring',
     42.61270,-82.84160,'Mid-field, over infield','2026-06-27 16:45+00','day','clear','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-06-27 16:50+00'),
    (kdra,'WS-CBES','European Starling','Sturnus vulgaris','bird','small',45,'transiting',
     42.61330,-82.84240,'Infield grass east of Rwy 01/19','2026-06-20 12:10+00','day','some_cloud','none',
     'hazed','bioacoustics',true,'TSgt Demo',demo_uid,'LOW','2026-06-20 12:17+00'),
    (kdra,'WS-CBFK','Killdeer','Charadrius vociferus','bird','medium',2,'feeding',
     42.61210,-82.84100,'Infield grass, mid-field','2026-06-10 09:55+00','dawn','clear','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-06-10 10:01+00'),
    (kdra,'WS-CBGD','White-tailed Deer','Odocoileus virginianus','mammal','large',1,'transiting',
     42.61160,-82.84050,'Infield grass, mid-field','2026-05-31 01:20+00','dusk','clear','none',
     'hazed','vehicle_hazing',true,'TSgt Demo',demo_uid,'LOW','2026-05-31 01:27+00'),

    -- Cluster C — south pond / grass
    (kdra,'WS-CCAM','Mallard','Anas platyrhynchos','bird','medium',7,'loafing',
     42.60440,-82.83950,'Retention pond, south infield','2026-07-02 11:35+00','dawn','clear','none',
     'dispersed','pyrotechnics',true,'TSgt Demo',demo_uid,'LOW','2026-07-02 11:41+00'),
    (kdra,'WS-CCBC','Coyote','Canis latrans','mammal','large',1,'transiting',
     42.60380,-82.83890,'South grass, perimeter side','2026-06-29 20:05+00','day','some_cloud','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-06-29 20:11+00'),
    (kdra,'WS-CCCD','Mourning Dove','Zenaida macroura','bird','medium',6,'feeding',
     42.60490,-82.84010,'South grass','2026-06-26 14:55+00','day','clear','none',
     'none',NULL,NULL,'TSgt Demo',demo_uid,'LOW','2026-06-26 15:00+00'),
    (kdra,'WS-CCDM','Mallard','Anas platyrhynchos','bird','medium',4,'feeding',
     42.60420,-82.83920,'Retention pond, south infield','2026-06-18 12:40+00','day','overcast','rain',
     'hazed','vehicle_hazing',true,'TSgt Demo',demo_uid,'LOW','2026-06-18 12:47+00'),
    (kdra,'WS-CCEG','Ring-billed Gull','Larus delawarensis','bird','medium',30,'loafing',
     42.60530,-82.83970,'South grass','2026-06-05 13:25+00','day','some_cloud','none',
     'dispersed','pyrotechnics',true,'TSgt Demo',demo_uid,'MOD','2026-06-05 13:33+00'),
    (kdra,'WS-CCFG','Canada Goose','Branta canadensis','bird','large',18,'grazing',
     42.60470,-82.83880,'South grass','2026-05-22 15:35+00','day','clear','none',
     'dispersed','propane_cannon',true,'TSgt Demo',demo_uid,'LOW','2026-05-22 15:44+00');

  -- ── 3. Three more completed daily self-inspections ──
  -- Clones of KDRA's one real completed inspection (AI-2026-PJLX): its
  -- items JSON is app-written and internally consistent (40 pass / 0 fail),
  -- so the list AND detail views render correctly. Only date/id/persona/
  -- weather vary. Distinct dates respect the one-inspection-per-day rule.
  INSERT INTO inspections
    (id, display_id, inspection_type, inspector_id, inspection_date, status,
     items, total_items, passed_count, failed_count, na_count,
     completion_percent, notes, completed_at, created_at, updated_at,
     construction_meeting, joint_monthly, bwc_value, inspector_name,
     weather_conditions, temperature_f, personnel, completed_by_name,
     completed_by_id, base_id, rsc_condition, rcr_value, rcr_condition,
     started_at)
  SELECT gen_random_uuid(), v.display_id, s.inspection_type, demo_uid,
         v.d, s.status,
         s.items, s.total_items, s.passed_count, s.failed_count, s.na_count,
         s.completion_percent, NULL,
         (v.d::timestamptz + v.tod), (v.d::timestamptz + v.tod), (v.d::timestamptz + v.tod),
         s.construction_meeting, s.joint_monthly, v.bwc, 'TSgt Demo',
         v.wx, v.temp, s.personnel, 'TSgt Demo',
         demo_uid, s.base_id, s.rsc_condition, s.rcr_value, s.rcr_condition,
         (v.d::timestamptz + v.tod - interval '40 minutes')
  FROM inspections s
  CROSS JOIN (VALUES
      ('AI-2026-CQAD', DATE '2026-07-03', interval '14 hours 30 minutes', 'LOW',      'Clear',            72::numeric),
      ('AI-2026-CPZR', DATE '2026-07-01', interval '13 hours 50 minutes', 'LOW',      'Scattered clouds', 68::numeric),
      ('AI-2026-CNKT', DATE '2026-06-29', interval '15 hours 05 minutes', 'MOD', 'Overcast',         64::numeric)
    ) AS v(display_id, d, tod, bwc, wx, temp)
  WHERE s.base_id = kdra AND s.display_id = 'AI-2026-PJLX';

  -- Reattribute the pre-existing completed inspection to the demo persona:
  -- it carried a real name that would land in-frame on the marketing still
  -- (owner approved the swap 2026-07-03).
  UPDATE inspections SET inspector_name = 'TSgt Demo',
                         completed_by_name = 'TSgt Demo'
    WHERE base_id = kdra AND display_id = 'AI-2026-PJLX';

  RAISE NOTICE 'KDRA seeded: 10 species, 18 sightings, 3 inspections';
END $$;

-- ── 4. NAVAID status rows (separate block — added after the first apply) ──
-- The civilian seed cloned KDRA's base_navaids CONFIG (10 rows) but not the
-- navaid_statuses rows the Airfield Status card renders, so the card sat on
-- "Loading NAVAIDs…" forever (the DEFAULT_NAVAIDS fallback does not render
-- either — noted as an app defect, tracked separately). One green status per
-- configured NAVAID, mirroring KDMO's shape.
DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN
    RAISE EXCEPTION 'KDRA (Demo Regional Airport) not found';
  END IF;

  INSERT INTO navaid_statuses (base_id, navaid_name, status, notes)
  SELECT c.base_id, c.navaid_name, 'green', NULL
  FROM base_navaids c
  WHERE c.base_id = kdra
    AND NOT EXISTS (SELECT 1 FROM navaid_statuses s
                    WHERE s.base_id = kdra AND s.navaid_name = c.navaid_name);

  RAISE NOTICE 'KDRA navaid_statuses backfilled from base_navaids';
END $$;
