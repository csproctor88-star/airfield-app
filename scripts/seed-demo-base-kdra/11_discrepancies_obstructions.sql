-- =====================================================================
-- KDRA "Demo Regional Airport" demo seed — CLUSTER B
-- Discrepancies / CES work orders / Obstruction evaluations
--
-- Base:    ea2b542e-72cc-4300-9037-bfe18c0bf7ae  (KDRA, faa_part139)
-- Runway:  633cedfb-555a-4440-a5a0-9c734a4123da  (RWY 01/19, elev 580 MSL)
-- "Today": 2026-07-23   History window: 2026-01-24 .. 2026-07-23 (UTC)
--
-- Idempotent: every row has a deterministic md5(...)::uuid id + ON CONFLICT
-- DO NOTHING. INSERT-only. Single transaction. Parents (discrepancies)
-- inserted before children (status_updates).
--
-- Tables seeded:
--   discrepancies          ~70 rows
--   status_updates         per-discrepancy history (1-3 rows each)
--   obstruction_evaluations 18 rows (OBS-2026-DR08 .. DR25)
--
-- NOTE: The task named "discrepancy_statuses" for per-discrepancy status
-- history. That table is actually a GLOBAL status-vocabulary lookup
-- (key/label_usaf/label_faa/sort_order/is_terminal/description) — already
-- fully populated, no base_id / discrepancy FK — so it is NOT seeded here.
-- The real per-discrepancy history table the app reads (detail page
-- "Notes History" via fetchStatusUpdates) is `status_updates`; that is what
-- is seeded below. See summary for details.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) DISCREPANCIES  (~70)
-- ---------------------------------------------------------------------
WITH arche(idx, dtype, shop, sev, title, descr, loc, fac) AS (
  VALUES
    (1,'lighting','Electrical','high','Runway 01 edge light out',
      'Self-inspection found a runway edge light out on the RWY 01 threshold row, west side. Lens dark with no illumination on the night check. Fixture tagged and a spare lamp staged for replacement.',
      'RWY 01/19','08024 — Lighting, Runway'),
    (2,'lighting','Electrical','medium','PAPI reading low on RWY 19',
      'RWY 19 PAPI showing one white over three red while established on glidepath; suspected lamp degradation in the near unit. Flagged for a photometric check and lamp swap.',
      'RWY 19','08026 — Light, Afld Special'),
    (3,'lighting','Electrical','low','Taxiway edge light out on TWY A',
      'Single blue edge light out on TWY A near the RWY 01/19 hold line. No effect on the taxi route; scheduled for routine lamp replacement.',
      'TWY A','08028 — Light, Taxiway'),
    (4,'lighting','Electrical','medium','Rotating beacon intermittent',
      'Airport rotating beacon flickering during the evening check; suspected motor or contactor fault. Beacon still visible but inconsistent between rotations.',
      'Beacon','03574 — Light, Beacon'),
    (5,'marking','Airfield Maintenance','medium','Faded runway centerline markings',
      'Runway centerline stripes worn and faded across the middle third of RWY 01/19, with reduced conspicuity in daylight. Recommend repaint to standard.',
      'RWY 01/19','06010 — Runway'),
    (6,'marking','Airfield Maintenance','medium','Faded hold-short markings at TWY B',
      'Enhanced taxiway centerline and hold-position markings at TWY B faded; the hold bars are losing definition. Repaint requested.',
      'TWY B',NULL),
    (7,'marking','Airfield Maintenance','low','Apron lead-in lines worn on West Ramp',
      'West Ramp lead-in lines and parking box outlines worn from ramp traffic. Touch-up painting needed to keep positions clear.',
      'West Ramp','06038 — Apron - West Ramp'),
    (8,'pavement','Airfield Maintenance','high','Pavement spalling on RWY 01/19',
      'Surface spalling and small FOD-generating fragments observed near a transverse joint at RWY 01/19 mid-field. Area cordoned and a patch scheduled.',
      'RWY 01/19','06010 — Runway'),
    (9,'pavement','Airfield Maintenance','medium','Joint sealant failure on TWY G',
      'Longitudinal joint sealant failed along a section of TWY G, allowing water intrusion into the joint. Route a seal repair before winter.',
      'TWY G',NULL),
    (10,'pavement','Airfield Maintenance','medium','Apron slab heaving on East Ramp',
      'Localized slab heave and faulting on the East Ramp is creating an uneven parking surface. Monitor and schedule grind/level.',
      'East Ramp',NULL),
    (11,'signage','Electrical','medium','Damaged guidance sign at TWY A',
      'Lighted taxiway direction sign at the TWY A / runway intersection damaged, with one panel cracked and unlit. Legend still legible in daylight.',
      'TWY A',NULL),
    (12,'signage','Electrical','low','Faded and rotated location sign at TWY G',
      'Taxiway location sign at TWY G rotated out of alignment with a sun-faded legend. Realign and refurbish.',
      'TWY G',NULL),
    (13,'fod_hazard','Airfield Maintenance','high','FOD on runway — metal fragment',
      'Self-inspection recovered a metal bracket fragment from RWY 01/19 near the 3,000 ft markers. Runway swept and cleared; source under review.',
      'RWY 01/19','06010 — Runway'),
    (14,'fod_hazard','Airfield Maintenance','medium','Loose gravel at apron edge',
      'Loose aggregate migrating onto the West Ramp from an unpaved shoulder edge, presenting a FOD risk to parked aircraft. Sweep and stabilize the edge.',
      'West Ramp',NULL),
    (15,'drainage','Grounds','medium','Standing water on RWY 01/19 shoulder',
      'Ponding along the east shoulder of RWY 01/19 after rainfall, with slow drainage near the turf edge. Check grade and clear the inlet.',
      'RWY 01/19',NULL),
    (16,'drainage','Grounds','low','Clogged culvert at Access Road',
      'Drainage culvert under the perimeter Access Road partially blocked with debris, backing up runoff. Clear and inspect the run.',
      'Access Road',NULL),
    (17,'other','Operations','low','Primary windsock frayed and faded',
      'Segmented windsock at the RWY 01 end is frayed at the trailing edge and sun-faded. Still serviceable but due for replacement.',
      'RWY 01/19',NULL),
    (18,'other','Operations','medium','Perimeter gate latch damaged',
      'Vehicle access gate on the east perimeter road has a damaged latch and is not securing fully. Interim chain applied; repair requested.',
      'Access Road',NULL),
    (19,'vegetation','Grounds','low','Vegetation encroachment at runway edge',
      'Grass and weeds encroaching over the paved edge along a section of RWY 01/19, obscuring the edge line. Mow and trim back.',
      'RWY 01/19',NULL),
    (20,'wildlife','Wildlife','high','Bird activity on and near RWY 01/19',
      'Increased gull activity loafing on RWY 01/19 during the morning check; dispersal conducted. Logged for wildlife hazard tracking and trend review.',
      'Entire Airfield',NULL),
    (21,'pavement','Snow Removal','medium','Ice and standing water on West Ramp',
      'Refreeze and standing water in West Ramp low spots created a slip hazard for ground crews. Treat, monitor, and note for the drainage list.',
      'West Ramp',NULL),
    (22,'signage','Electrical','medium','Runway distance-remaining sign unlit',
      'A runway distance-remaining marker sign along RWY 01/19 is unlit at night; suspected lamp or wiring fault. Legend visible in daylight.',
      'RWY 01/19','06009 — Runway Dist Markers')
),
openmap(oi, cs, days_ago) AS (
  VALUES
    (1,'submitted_to_ces',2.0),
    (2,'submitted_to_ces',1.4),
    (3,'submitted_to_ces',3.1),
    (4,'awaiting_action_by_ces',5.0),
    (5,'awaiting_action_by_ces',6.7),
    (6,'awaiting_action_by_ces',4.2),
    (7,'work_completed_awaiting_verification',9.0),
    (8,'work_completed_awaiting_verification',11.5),
    (9,'waiting_for_project',82.0),
    (10,'submitted_to_afm',0.6),
    (11,'submitted_to_afm',1.1),
    (12,'submitted_to_afm',0.3)
),
g0 AS (
  SELECT
    g.i AS i,
    a.dtype, a.shop, a.sev, a.title, a.descr, a.loc, a.fac,
    CASE WHEN g.i IN (25,41) THEN 'cancelled'
         WHEN om.oi IS NOT NULL THEN 'open'
         ELSE 'completed' END AS status,
    CASE WHEN g.i IN (25,41) THEN 'submitted_to_afm'
         WHEN om.oi IS NOT NULL THEN om.cs
         ELSE 'work_completed_awaiting_verification' END AS current_status,
    CASE WHEN om.oi IS NOT NULL
         THEN TIMESTAMPTZ '2026-07-23 12:00:00+00' - (om.days_ago * interval '1 day')
         ELSE TIMESTAMPTZ '2026-07-23 12:00:00+00'
              - ((power(g.i - 1, 1.55) * 0.25) * interval '1 day')
              - (((g.i * 7) % 20) * interval '1 hour')
    END AS created_at
  FROM generate_series(1,70) g(i)
  JOIN arche a ON a.idx = ((g.i - 1) % 22) + 1
  LEFT JOIN openmap om ON om.oi = g.i
),
g1 AS (
  SELECT
    g0.*,
    -- resolution timestamp
    CASE
      WHEN status = 'cancelled' THEN created_at + interval '1 day'
      WHEN status = 'completed' AND i BETWEEN 13 AND 20
        THEN TIMESTAMPTZ '2026-07-23 07:00:00+00' - ((i - 13) * interval '18 hours') - interval '3 hours'
      WHEN status = 'completed'
        THEN LEAST(TIMESTAMPTZ '2026-07-13 00:00:00+00', created_at + ((2 + (i % 8)) * interval '1 day') + interval '4 hours')
      ELSE NULL
    END AS resolution_date,
    -- shop routing: unassigned only while at AFM triage or when cancelled;
    -- everything else carries its maintenance shop ("other" -> Operations)
    CASE
      WHEN current_status = 'submitted_to_afm' OR status = 'cancelled' THEN NULL
      ELSE shop
    END AS assigned_shop,
    CASE
      WHEN current_status = 'submitted_to_afm' OR status = 'cancelled' THEN 'Pending'
      ELSE 'WO-26-' || lpad((100 + i)::text, 4, '0')
    END AS work_order_number,
    CASE
      WHEN status = 'cancelled'
        THEN 'Duplicate of an existing open discrepancy for the same location; cancelled after review.'
      WHEN status = 'completed' THEN
        CASE dtype
          WHEN 'lighting'   THEN 'Lamp and fixture replaced and photometrics checked; light restored to full output and verified on the night inspection.'
          WHEN 'marking'    THEN 'Markings repainted to standard and inspected; conspicuity restored in daylight and at night.'
          WHEN 'pavement'   THEN 'Pavement patched and sealed, then swept; surface returned to serviceable condition and FOD-checked.'
          WHEN 'signage'    THEN 'Sign panel and lamp repaired and realigned; legend legible day and night.'
          WHEN 'fod_hazard' THEN 'Area swept and FOD removed; surface re-inspected and cleared for operations.'
          WHEN 'drainage'   THEN 'Drainage cleared and regraded; ponding resolved and the area re-inspected after rainfall.'
          WHEN 'vegetation' THEN 'Vegetation mowed and trimmed back from the paved edge; edge line fully visible.'
          WHEN 'wildlife'   THEN 'Wildlife dispersed and habitat conditions addressed; activity monitored and logged for trend review.'
          ELSE 'Corrected and verified serviceable on follow-up inspection.'
        END
      ELSE NULL
    END AS resolution_notes
  FROM g0
)
INSERT INTO discrepancies
  (id, display_id, base_id, type, status, current_status, severity, title, description,
   location_text, latitude, longitude, assigned_shop, assigned_to, reported_by,
   work_order_number, facility_number, resolution_notes, resolution_date,
   estimated_completion_date, project_number, estimated_cost, risk_control_measure,
   photo_count, created_at, updated_at)
SELECT
  md5('kdra-discrepancy-' || i)::uuid,
  'D-2026-M' || lpad(i::text, 3, '0'),
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  dtype,
  status,
  current_status,
  sev,
  title,
  descr,
  loc,
  42.6142 + (((i % 9) - 4) * 0.0011),
  -82.8369 + (((i % 7) - 3) * 0.0013),
  assigned_shop,
  NULL::uuid,
  (ARRAY[
     '44cc521d-5850-0faa-8f92-c030a19fce37',  -- Danielle Pearce (amops)
     '00b4cdd3-cbf0-0269-a366-3514870b0474',  -- Brian Okafor (amops)
     '57a1c585-209a-5012-9983-ff95142a9ff0',  -- Olivia Brenner (amops)
     '4f8ab1a5-c662-a906-7ae3-2730db18551f',  -- Anthony Ruiz (ops_supervisor)
     'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'   -- Marcus Delgado (airfield_manager)
   ]::uuid[])[1 + ((i - 1) % 5)],
  work_order_number,
  fac,
  resolution_notes,
  resolution_date,
  CASE WHEN current_status = 'waiting_for_project' THEN DATE '2026-09-30' ELSE NULL END,
  CASE WHEN current_status = 'waiting_for_project' THEN 'CIP-2026-014' ELSE NULL END,
  CASE WHEN current_status = 'waiting_for_project' THEN '$185,000' ELSE NULL END,
  CASE WHEN status = 'open' AND sev IN ('high','critical')
       THEN 'NOTAM issued and an interim operating limitation is in effect until repair; the area is monitored on each self-inspection.'
       ELSE NULL END,
  0,
  created_at,
  COALESCE(
    resolution_date,
    CASE WHEN current_status = 'submitted_to_afm' THEN created_at + interval '25 minutes'
         ELSE created_at + interval '1 day' END
  )
FROM g1
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) STATUS_UPDATES  (per-discrepancy Notes History; 1-3 rows each)
--    Reads the just-inserted discrepancy rows (visible in-transaction),
--    so lifecycle facts stay consistent with the parent row.
--    Plain INSERT..SELECT (no UNION) — uuid string literals coerce fine;
--    roster ids inside CASE are cast to ::uuid to unify with reported_by.
-- ---------------------------------------------------------------------
INSERT INTO status_updates
  (id, discrepancy_id, old_status, new_status, notes, updated_by, base_id, created_at)
SELECT
  md5('kdra-su-' || d.display_id || '-' || v.step)::uuid,
  d.id,
  -- old_status / new_status only populated on a lifecycle close (step 3 close)
  CASE WHEN v.step = 3 AND d.status IN ('completed','cancelled') THEN 'open' ELSE NULL END,
  CASE WHEN v.step = 3 AND d.status IN ('completed','cancelled') THEN d.status ELSE NULL END,
  CASE
    WHEN v.step = 1 THEN 'Status changed to: Submitted to Operations Manager'
    WHEN v.step = 2 THEN 'Status changed to: Submitted to Maintenance — routed to '
                         || d.assigned_shop || ' (' || d.work_order_number || ').'
    WHEN v.step = 3 AND d.status = 'completed'
      THEN COALESCE(d.resolution_notes, 'Work verified complete and discrepancy closed.')
    WHEN v.step = 3 AND d.status = 'cancelled'
      THEN COALESCE(d.resolution_notes, 'Cancelled after review.')
    WHEN v.step = 3 AND d.current_status = 'awaiting_action_by_ces'
      THEN 'Status changed to: Awaiting Maintenance Action'
    WHEN v.step = 3 AND d.current_status = 'waiting_for_project'
      THEN 'Status changed to: Waiting for Project'
    WHEN v.step = 3 AND d.current_status = 'work_completed_awaiting_verification'
      THEN 'Status changed to: Work Completed (Awaiting Verification)'
    ELSE NULL
  END,
  CASE
    WHEN v.step = 1 THEN d.reported_by
    WHEN v.step = 2 THEN 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid            -- Marcus routes to maintenance
    WHEN v.step = 3 AND d.status IN ('completed','cancelled')
                    THEN '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid            -- Anthony verifies/closes
    ELSE '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid
  END,
  d.base_id,
  CASE
    WHEN v.step = 1 THEN d.created_at + interval '6 minutes'
    WHEN v.step = 2 THEN LEAST(TIMESTAMPTZ '2026-07-23 11:30:00+00',
                               d.created_at + interval '1 day' + interval '3 hours')
    WHEN v.step = 3 AND d.status IN ('completed','cancelled')
      THEN GREATEST(COALESCE(d.resolution_date, d.updated_at), d.created_at + interval '1 day 6 hours')
    WHEN v.step = 3
      THEN LEAST(TIMESTAMPTZ '2026-07-23 11:45:00+00', d.created_at + interval '2 days 5 hours')
    ELSE d.created_at + interval '1 hour'
  END
FROM discrepancies d
CROSS JOIN (VALUES (1),(2),(3)) AS v(step)
WHERE d.base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid
  AND d.display_id LIKE 'D-2026-M%'
  AND (
        v.step = 1
     OR (v.step = 2 AND d.assigned_shop IS NOT NULL)
     OR (v.step = 3 AND (
            d.status IN ('completed','cancelled')
         OR d.current_status IN ('awaiting_action_by_ces','waiting_for_project','work_completed_awaiting_verification')
        ))
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3) OBSTRUCTION_EVALUATIONS  (18; OBS-2026-DR08 .. DR25)
--    Civilian FAA Part 77 voice: surface_set='faa_part77', runway_class NULL.
--    5-surface results payload (primary/approach/transitional/horizontal/
--    conical) mirrors the existing KDRA FAA rows; the controlling surface
--    is the only one flagged violated / within-bounds.
-- ---------------------------------------------------------------------
WITH obase(n, ckey, endlabel, dthr, h_agl, obj_elev, dcl, lat, lon, evaluator, offset_days, descr, notes) AS (
  VALUES
    (8 ,'approach'    ,'RWY 01',3200::numeric,52::numeric,582::numeric,80::numeric ,42.5905,-82.8378,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 5::numeric,
      'Stand of mature deciduous trees ~0.6 NM south of the RWY 01 threshold, along the extended approach centerline.',
      'Seasonal canopy surveyed at 52 ft AGL; clears the 34:1 approach surface by roughly 30 ft. Re-survey after the next growing season.'),
    (9 ,'transitional','RWY 19',8000::numeric,46::numeric,585::numeric,640::numeric,42.6180,-82.8332,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6', 8::numeric,
      'Power distribution pole with overhead lines on the perimeter road east of the RWY 01/19 midpoint.',
      'Pole penetrates the 7:1 transitional surface. Coordinate with the utility to lower or relocate the line; interim obstruction marking requested. Logged as a discrepancy.'),
    (10,'approach'    ,'RWY 19',2600::numeric,120::numeric,596::numeric,140::numeric,42.6335,-82.8351,'4f8ab1a5-c662-a906-7ae3-2730db18551f', 3::numeric,
      'Mobile construction crane (jib raised) at the terminal apron expansion site, ~2,500 ft north of the RWY 19 threshold.',
      'Crane penetrates the 34:1 approach surface. Temporary — contractor NOTAM issued and the crane is lowered below the surface outside operational hours. FAA Form 7460-1 on file.'),
    (11,'horizontal'  ,'RWY 01',8000::numeric,118::numeric,585::numeric,3100::numeric,42.5760,-82.8300,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',22::numeric,
      'Communications monopole ~1.9 NM south of the field within the horizontal-surface radius.',
      'Surveyed below the 150 ft horizontal surface; no penetration. Charted as an obstruction for awareness.'),
    (12,'transitional','RWY 01',8000::numeric,15::numeric,583::numeric,560::numeric,42.5990,-82.8352,'44cc521d-5850-0faa-8f92-c030a19fce37',33::numeric,
      'Tree line lateral to the RWY 01 end, west of the primary surface.',
      'Canopy clears the transitional surface. Monitor growth and re-survey annually.'),
    (13,'approach'    ,'RWY 01',3600::numeric,58::numeric,590::numeric,200::numeric,42.5885,-82.8395,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',41::numeric,
      'Rooftop antenna on an off-airport commercial building near the RWY 01 approach corridor.',
      'Clears the approach surface by roughly 20 ft. Charted obstruction; no action required.'),
    (14,'approach'    ,'RWY 01',2400::numeric,95::numeric,600::numeric,90::numeric ,42.5930,-82.8377,'4f8ab1a5-c662-a906-7ae3-2730db18551f',12::numeric,
      'Temporary construction crane south of the RWY 01 threshold supporting a drainage project.',
      'Crane penetrates the approach surface. Lowered below the surface outside published hours; contractor NOTAM active. 7460-1 on file.'),
    (15,'transitional','RWY 19',8000::numeric,16::numeric,584::numeric,480::numeric,42.6230,-82.8342,'57a1c585-209a-5012-9983-ff95142a9ff0',55::numeric,
      'Lighted taxiway guidance sign structure lateral to the RWY 19 end.',
      'Clears the transitional surface. Charted for awareness.'),
    (16,'approach'    ,'RWY 19',3400::numeric,100::numeric,597::numeric,130::numeric,42.6360,-82.8360,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',60::numeric,
      'Tree ~0.6 NM north of the RWY 19 threshold along the extended approach centerline.',
      'Penetrates the approach surface. Trim or removal coordinated with the landowner; interim charting in place.'),
    (17,'horizontal'  ,'RWY 19',8000::numeric,132::numeric,592::numeric,4200::numeric,42.6400,-82.8250,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',78::numeric,
      'Municipal water tower northeast of the field within the horizontal-surface radius.',
      'Surveyed below the horizontal surface; no penetration. Charted obstruction.'),
    (18,'transitional','RWY 01',8000::numeric,42::numeric,582::numeric,600::numeric,42.6010,-82.8330,'4f8ab1a5-c662-a906-7ae3-2730db18551f',95::numeric,
      'Utility pole lateral to the RWY 01/19 primary surface on the west perimeter.',
      'Penetrates the transitional surface. Marked; relocation is on the utility work plan.'),
    (19,'approach'    ,'RWY 01',2800::numeric,62::numeric,585::numeric,60::numeric ,42.5934,-82.8389,'44cc521d-5850-0faa-8f92-c030a19fce37',110::numeric,
      'Deciduous stand ~0.5 NM south of the RWY 01 threshold along the approach centerline.',
      'Clears the 34:1 approach surface by roughly 15 ft. Re-survey scheduled after leaf-out.'),
    (20,'transitional','RWY 19',8000::numeric,85::numeric,586::numeric,720::numeric,42.6205,-82.8300,'4f8ab1a5-c662-a906-7ae3-2730db18551f',15::numeric,
      'Mobile crane at the apron expansion project, east of the RWY 19 primary surface.',
      'Crane boom penetrates the 7:1 transitional surface during lifts. Lift height restricted and a contractor NOTAM issued until the work window closes; 7460-1 on file.'),
    (21,'approach'    ,'RWY 19',3300::numeric,100::numeric,588::numeric,110::numeric,42.6355,-82.8345,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',130::numeric,
      'Temporary meteorological tower north of the RWY 19 threshold.',
      'Penetrates the approach surface. NOTAM issued; removal scheduled with the study sponsor.'),
    (22,'horizontal'  ,'RWY 01',8000::numeric,96::numeric,596::numeric,3800::numeric,42.5820,-82.8420,'44cc521d-5850-0faa-8f92-c030a19fce37',150::numeric,
      'Tree line within the horizontal-surface radius southwest of the field.',
      'Below the 150 ft horizontal surface; no penetration. Charted.'),
    (23,'transitional','RWY 19',8000::numeric,15::numeric,585::numeric,520::numeric,42.6225,-82.8330,'57a1c585-209a-5012-9983-ff95142a9ff0',40::numeric,
      'Roadway light pole lateral to the RWY 19 end.',
      'Clears the transitional surface. Charted for awareness.'),
    (24,'approach'    ,'RWY 01',3900::numeric,66::numeric,594::numeric,240::numeric,42.5875,-82.8405,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6',70::numeric,
      'Commercial building near the RWY 01 approach corridor, off airport property.',
      'Clears the approach surface. Charted obstruction; no action required.'),
    (25,'approach'    ,'RWY 19',2700::numeric,110::numeric,586::numeric,100::numeric,42.6340,-82.8355,'4f8ab1a5-c662-a906-7ae3-2730db18551f', 2::numeric,
      'Active construction crane during a lift north of the RWY 19 threshold.',
      'Penetrates the approach surface during operations. Contractor NOTAM in effect; lifts restricted to non-operational windows.')
),
ocalc AS (
  SELECT
    b.*,
    (b.obj_elev + b.h_agl) AS obstruction_top,
    CASE b.ckey
      WHEN 'approach'     THEN round(580 + b.dthr / 34.0, 1)
      WHEN 'transitional' THEN 601.4::numeric
      WHEN 'horizontal'   THEN 730::numeric
    END AS ctrl_max,
    CASE b.ckey
      WHEN 'approach'     THEN 'Approach Surface (RWY 01/19)'
      WHEN 'transitional' THEN 'Transitional Surface (RWY 01/19)'
      WHEN 'horizontal'   THEN 'Horizontal Surface (RWY 01/19)'
    END AS ctrl_surface
  FROM obase b
),
ocalc2 AS (
  SELECT
    c.*,
    ((c.obstruction_top - c.ctrl_max) > 0) AS has_violation,
    CASE WHEN (c.obstruction_top - c.ctrl_max) > 0 THEN round(c.obstruction_top - c.ctrl_max, 1) ELSE 0 END AS pen
  FROM ocalc c
)
INSERT INTO obstruction_evaluations
  (id, base_id, surface_set, runway_class, display_id, description, notes,
   controlling_surface, violated_surfaces, has_violation,
   object_height_agl, object_distance_ft, object_elevation_msl, obstruction_top_msl,
   distance_from_centerline_ft, latitude, longitude, evaluated_by, results, created_at)
SELECT
  md5('kdra-obstruction-' || c.n)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  'faa_part77',
  NULL,
  'OBS-2026-DR' || lpad(c.n::text, 2, '0'),
  c.descr,
  c.notes,
  c.ctrl_surface,
  CASE WHEN c.has_violation THEN ARRAY[c.ctrl_surface]::text[] ELSE '{}'::text[] END,
  c.has_violation,
  c.h_agl,
  c.dcl,
  c.obj_elev,
  c.obstruction_top,
  c.dcl,
  c.lat,
  c.lon,
  c.evaluator::uuid,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'surfaceKey', su.key,
        'surfaceName', su.name,
        'baselineElevation', 580,
        'baselineLabel', CASE WHEN su.key = 'approach' THEN c.endlabel || ' threshold' ELSE 'Airport elevation' END,
        'obstructionTopMSL', c.obstruction_top,
        'maxAllowableHeightMSL', CASE WHEN su.key = c.ckey THEN c.ctrl_max ELSE su.defmax END,
        'maxAllowableHeightAGL', round((CASE WHEN su.key = c.ckey THEN c.ctrl_max ELSE su.defmax END) - 580, 1),
        'penetrationFt', CASE WHEN su.key = c.ckey AND c.has_violation THEN c.pen ELSE 0 END,
        'violated', (su.key = c.ckey AND c.has_violation),
        'isWithinBounds', (su.key = c.ckey),
        'ufcReference', su.ref,
        'ufcCriteria', su.crit,
        'calculationBreakdown', CASE
            WHEN su.key = 'approach' AND c.ckey = 'approach'
              THEN '580 ft (' || c.endlabel || ' threshold) + ' || round(c.dthr, 0) || ' ft / 34 (slope) = ' || c.ctrl_max || ' ft MSL'
            WHEN su.key = 'approach'
              THEN '580 ft (airport elev) + 2,720 ft / 34 (slope) = 660 ft MSL'
            WHEN su.key = 'primary'
              THEN '580 ft (airport elev) + 0 ft = 580 ft MSL'
            WHEN su.key = 'transitional'
              THEN '580 ft (airport elev) + 150 ft / 7 (slope) = 601.4 ft MSL'
            WHEN su.key = 'horizontal'
              THEN '580 ft (airport elev) + 150 ft = 730 ft MSL'
            ELSE '580 ft (airport elev) + 150 ft + 0 ft / 20 (slope) = 730 ft MSL'
          END
      ) ORDER BY su.ord
    )
    FROM (VALUES
      (1,'primary'     ,'Primary Surface'     ,580::numeric  ,'14 CFR §77.19(c) — Primary surface (non-utility non-precision <¾ mi)','No object may protrude above the primary surface elevation within 500 ft of centerline (1,000 ft total width) and 200 ft beyond each runway end.'),
      (2,'approach'    ,'Approach Surface'    ,660::numeric  ,'14 CFR §77.19(d) — Approach surface (non-utility non-precision <¾ mi)','34:1 slope extending 10,000 ft from the runway end, expanding from 1,000 ft to 4,000 ft wide (visibility < ¾ mile).'),
      (3,'transitional','Transitional Surface',601.4::numeric,'14 CFR §77.19(e) — Transitional surface','7:1 slope from primary/approach edges upward to horizontal surface (150 ft above airport elevation).'),
      (4,'horizontal'  ,'Horizontal Surface'  ,730::numeric  ,'14 CFR §77.19(a) — Horizontal surface (non-utility)','No object may protrude above 150 ft above the established airport elevation within a 10,000 ft radius of each runway end (non-utility runway).'),
      (5,'conical'     ,'Conical Surface'     ,730::numeric  ,'14 CFR §77.19(b) — Conical surface','20:1 slope extending 4,000 ft outward from the horizontal surface boundary.')
    ) su(ord, key, name, defmax, ref, crit)
  ) AS results,
  TIMESTAMPTZ '2026-07-23 12:00:00+00' - (c.offset_days * interval '1 day')
FROM ocalc2 c
ON CONFLICT (id) DO NOTHING;

COMMIT;
