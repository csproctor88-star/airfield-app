-- ============================================================================
-- KDRA Demo-Data Seed — Cluster C: Prior Permission Required (PPR)
--
-- Base:   Demo Regional Airport (KDRA)  ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- Window: 2026-01-24 .. 2026-07-23 ("today" = 2026-07-23), recent-weighted.
--
-- Tables seeded (parents first):
--   ppr_agencies          6  (4 coordinating, 2 info-only / notify_only)
--   ppr_agency_emails     6  (one external distribution address per agency)
--   ppr_agency_members    7  (roster links: Airport Ops, ARFF, Administration)
--   ppr_entries          90  (mixed statuses, GA/corporate/charter/cargo/medevac)
--   ppr_coordination     70  (concur / non-concur / pending across 19 entries)
--   ppr_remarks          88  (68 coordination-mirror + 20 free-text ops notes)
--   ppr_number_sequence  (per arrival_date, consistent with all entries)
--
-- Enum sources (learned from live DB + app code):
--   ppr_entries.status         CHECK: pending_amops_triage | pending_coordination
--                              | pending_amops_approval | approved | denied | canceled
--   ppr_coordination.status    CHECK: pending | concur | non_concur
--   ppr_agencies.notify_only   info-only recipient (no coordination row) — lib/ppr-agency-notify.ts
--   column_values keys         = the 11 non-info ppr_columns ids (sampled live)
--   ppr_number format          LPAD(DOY,3)-LPAD(seq,3)-OI  (2026042803 RPC;
--                              OI rewritten to approver on approval)
--
-- All ids deterministic (md5) + ON CONFLICT DO NOTHING → safe to re-apply.
-- INSERT-only; references real roster / column / runway ids. No UPDATE/DELETE.
-- ============================================================================

BEGIN;

-- ── 1. ppr_agencies ─────────────────────────────────────────────────────────
INSERT INTO ppr_agencies (id, base_id, agency_name, sort_order, is_active, created_at, send_calendar_invite, notify_only)
VALUES
  (md5('kdra-ppr-agency-airport-operations')::uuid,    'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'Airport Operations',     10, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', true,  false),
  (md5('kdra-ppr-agency-arff')::uuid,                  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'ARFF',                   20, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', true,  false),
  (md5('kdra-ppr-agency-security')::uuid,              'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'Security',               30, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', false, false),
  (md5('kdra-ppr-agency-maintenance')::uuid,           'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'Maintenance',            40, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', false, false),
  (md5('kdra-ppr-agency-fbo-line-service')::uuid,      'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'FBO / Line Service',     50, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', true,  true),
  (md5('kdra-ppr-agency-airport-administration')::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'Airport Administration', 60, true, TIMESTAMPTZ '2026-01-24 12:00:00+00', false, true)
ON CONFLICT DO NOTHING;

-- ── 2. ppr_agency_emails (external distribution addresses) ───────────────────
INSERT INTO ppr_agency_emails (id, agency_id, base_id, email, created_at)
VALUES
  (md5('kdra-ppr-agency-email-ops')::uuid,    md5('kdra-ppr-agency-airport-operations')::uuid,     'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'amops@draregional.com',        TIMESTAMPTZ '2026-01-24 12:05:00+00'),
  (md5('kdra-ppr-agency-email-arff')::uuid,   md5('kdra-ppr-agency-arff')::uuid,                   'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'firehouse@draregional.com',    TIMESTAMPTZ '2026-01-24 12:05:00+00'),
  (md5('kdra-ppr-agency-email-sec')::uuid,    md5('kdra-ppr-agency-security')::uuid,               'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'security@draregional.com',     TIMESTAMPTZ '2026-01-24 12:05:00+00'),
  (md5('kdra-ppr-agency-email-maint')::uuid,  md5('kdra-ppr-agency-maintenance')::uuid,            'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'maintenance@draregional.com',  TIMESTAMPTZ '2026-01-24 12:05:00+00'),
  (md5('kdra-ppr-agency-email-fbo')::uuid,    md5('kdra-ppr-agency-fbo-line-service')::uuid,       'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'linedesk@dra-fbo.example',     TIMESTAMPTZ '2026-01-24 12:05:00+00'),
  (md5('kdra-ppr-agency-email-admin')::uuid,  md5('kdra-ppr-agency-airport-administration')::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, 'admin@draregional.com',        TIMESTAMPTZ '2026-01-24 12:05:00+00')
ON CONFLICT DO NOTHING;

-- ── 3. ppr_agency_members (Glidepath account links) ──────────────────────────
INSERT INTO ppr_agency_members (id, agency_id, user_id, base_id, created_at)
VALUES
  (md5('kdra-ppr-member-ops-md')::uuid,   md5('kdra-ppr-agency-airport-operations')::uuid,     'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-ops-ar')::uuid,   md5('kdra-ppr-agency-airport-operations')::uuid,     '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-ops-dp')::uuid,   md5('kdra-ppr-agency-airport-operations')::uuid,     '44cc521d-5850-0faa-8f92-c030a19fce37'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-ops-bo')::uuid,   md5('kdra-ppr-agency-airport-operations')::uuid,     '00b4cdd3-cbf0-0269-a366-3514870b0474'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-ops-ob')::uuid,   md5('kdra-ppr-agency-airport-operations')::uuid,     '57a1c585-209a-5012-9983-ff95142a9ff0'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-arff-rc')::uuid,  md5('kdra-ppr-agency-arff')::uuid,                   '10bd2c31-e693-c4d5-2455-d3af3506d106'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00'),
  (md5('kdra-ppr-member-admin-kw')::uuid, md5('kdra-ppr-agency-airport-administration')::uuid, 'af5eed97-5425-d64b-358f-8c1b0e8050af'::uuid, 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid, TIMESTAMPTZ '2026-01-24 12:10:00+00')
ON CONFLICT DO NOTHING;

-- ── 4. ppr_entries (90 rows) ─────────────────────────────────────────────────
INSERT INTO ppr_entries (
  id, base_id, ppr_number, arrival_date, column_values, notes, approver_oi,
  created_by, updated_by, created_at, updated_at, status, requester_name,
  requester_email, triaged_by, triaged_at, approval_user_id, approval_at,
  denial_reason, public_submission, requester_phone, cancellation_reason,
  departed_at, departed_by
)
WITH base AS (
  SELECT
    i,
    (DATE '2026-07-23' - (floor(178.0 * power((90.0 - i) / 89.0, 1.7)))::int) AS arrival_date,
    (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'])[1 + (i % 5)] AS creator_id,
    (ARRAY['DP','BO','OB','AR','MD'])[1 + (i % 5)] AS creator_oi,
    (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','4f8ab1a5-c662-a906-7ae3-2730db18551f'])[1 + (i % 2)] AS approver_id,
    (ARRAY['MD','AR'])[1 + (i % 2)] AS approver_oi2,
    CASE
      WHEN i = 90 OR i = 89 THEN 'triage'
      WHEN i = 88 OR i = 87 THEN 'coord'
      WHEN i = 86 OR i = 85 THEN 'approval'
      WHEN i = 84 THEN 'coord_approved'
      WHEN i % 23 = 0 THEN 'canceled'
      WHEN i % 37 = 0 THEN 'denied'
      WHEN i % 6 = 0 THEN 'coord_approved'
      ELSE 'fast'
    END AS kind,
    (ARRAY['Meridian Air Charter','Summit Aviation Services','Cardinal Jet Center','Silverline Air Charter','Keystone Aviation','Northwind Air Cargo','Great Lakes Regional','Horizon Executive Flights','Demo Regional FBO','Apex Air Ambulance','Coastal Charter Group','Falcon Wing Aviation','Evergreen Freight Air','Blue Ridge Air','tenant FBO / Line Service'])[1 + (i % 15)] AS op_name,
    (ARRAY['MER','SMT','','SLV','KEY','NWC','GLR','HZN','','LIFEGUARD','CCG','FWA','EFA','BRA',''])[1 + (i % 15)] AS op_prefix,
    (ARRAY['meridianair','summitav','cardinaljet','silverlineair','keystoneav','northwindcargo','greatlakesreg','horizonexec','dra-fbo','apexairamb','coastalcharter','falconwing','evergreenfreight','blueridgeair','tenant-fbo'])[1 + (i % 15)] AS op_slug,
    (ARRAY['charter','charter','fbo','charter','charter','cargo','airline','charter','fbo','medevac','charter','charter','cargo','charter','based'])[1 + (i % 15)] AS op_cat,
    (ARRAY['Cessna Citation CJ3','Cessna Citation Latitude','Beechcraft King Air 350','Pilatus PC-12','Embraer Phenom 300','Bombardier Challenger 350','Gulfstream G280','Cirrus SR22','Daher TBM 940','Learjet 75','Hawker 900XP','Cessna 208 Caravan','Beechcraft 1900D','Embraer E175','Bombardier CRJ700','Pilatus PC-24','Cessna 172 Skyhawk','Piper M600'])[1 + ((i * 5) % 18)] AS aircraft,
    (ARRAY['KTEB','KPTK','KDTW','KORD','KMDW','KCLE','KBUF','KGRR','KFNT','CYYZ','KMKE','KIND','KCMH','KSDF','KSTL','KJVL','KLAN','KAZO','KTOL','KERI'])[1 + ((i * 3) % 20)] AS origin,
    (ARRAY['Fuel stop en route; requesting Jet-A and a quick turn.','Overnight maintenance at the FBO; hangar space requested.','Corporate charter drop-off; crew overnighting locally.','Transient GA — self-fuel at the 100LL island, no handling required.','Based aircraft returning from a cross-country.','Charter pickup; expedited ramp and GPU requested.','Cargo turn — pallet offload at the freight ramp.','Regional shuttle; standard handling requested.','Positioning flight; no passengers, fuel to tabs.',NULL])[1 + (i % 10)] AS notes_pick,
    'N' || (200 + (i * 13) % 799)::text || (ARRAY['MA','TC','QS','FX','DR','LX','JS','WN','AV','BX','GT','HK'])[1 + (i % 12)] AS tail,
    (ARRAY['313','248','586','734','216','440','419','614','502','810'])[1 + (i % 10)] || '-555-' || lpad(((i * 29) % 9000 + 100)::text, 4, '0') AS phone,
    lpad((6 + (i % 12))::text, 2, '0') || (ARRAY['00','15','30','45'])[1 + (i % 4)] AS eta,
    lpad((6 + (i % 12) + 1 + (i % 4))::text, 2, '0') || (ARRAY['30','45','00','15'])[1 + (i % 4)] AS etd
  FROM generate_series(1, 90) AS s(i)
),
derived AS (
  SELECT b.*,
    ((b.arrival_date::timestamp) AT TIME ZONE 'UTC') AS arrival_ts,
    GREATEST(
      ((b.arrival_date::timestamp) AT TIME ZONE 'UTC') - make_interval(days => 2 + (b.i % 6), hours => 7 + (b.i % 12), mins => (b.i * 11) % 60),
      TIMESTAMPTZ '2026-01-24 06:00:00+00'
    ) AS submit_ts,
    CASE WHEN b.op_prefix = '' THEN b.tail ELSE b.op_prefix || lpad((100 + (b.i * 17) % 899)::text, 3, '0') END AS callsign,
    CASE WHEN b.op_cat IN ('fbo','based') THEN 'linedesk@' || b.op_slug || '.example' ELSE 'dispatch@' || b.op_slug || '.example' END AS op_email,
    CASE b.op_cat
      WHEN 'cargo' THEN (ARRAY['2','2','3'])[1 + (b.i % 3)]
      WHEN 'airline' THEN (28 + (b.i % 45))::text
      WHEN 'medevac' THEN (ARRAY['3','4','2'])[1 + (b.i % 3)]
      ELSE (1 + (b.i % 8))::text END AS pax,
    (ARRAY['Yes','Yes','No','Yes','N/A'])[1 + (b.i % 5)] AS fuel,
    CASE b.op_cat WHEN 'fbo' THEN b.op_name || ' (Line Service)' WHEN 'based' THEN b.op_name WHEN 'medevac' THEN b.op_name || ' Ops' ELSE b.op_name || ' (Dispatch)' END AS requester_name,
    ((b.kind = 'triage') OR (b.kind = 'denied' AND b.i = 37) OR (b.kind = 'coord_approved' AND (b.i % 4) = 0)) AS is_public
  FROM base b
),
seqd AS (
  SELECT d.*,
    d.submit_ts + make_interval(hours => 3 + (d.i % 5), mins => (d.i * 7) % 60) AS triaged_ts,
    d.submit_ts + make_interval(hours => 5 + (d.i % 6)) AS denial_ts_public,
    d.arrival_ts + make_interval(days => 1 + (d.i % 3), hours => 9 + (d.i % 8)) AS departed_ts,
    d.submit_ts + make_interval(days => 1 + (d.i % 4), hours => (d.i % 12)) AS cancel_ts,
    (row_number() OVER (PARTITION BY d.arrival_date ORDER BY d.i)) + COALESCE(es.max_seq, 0) AS seq
  FROM derived d
  LEFT JOIN (
    SELECT arrival_date, COALESCE(MAX(NULLIF(split_part(ppr_number, '-', 2), '')::int), 0) AS max_seq
    FROM ppr_entries WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae' GROUP BY arrival_date
  ) es ON es.arrival_date = d.arrival_date
)
SELECT
  md5('kdra-ppr-entry-' || i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  lpad(EXTRACT(DOY FROM arrival_date)::int::text, 3, '0') || '-' || lpad(seq::text, 3, '0') || '-' ||
    CASE WHEN kind = 'triage' THEN 'XX' WHEN kind = 'denied' AND i = 37 THEN 'XX' WHEN kind = 'coord_approved' THEN approver_oi2 ELSE creator_oi END,
  arrival_date,
  jsonb_build_object(
    '3f06defd-b194-46b9-81e4-11b565f9e7fa', callsign,
    '9a451a06-2df8-4b3d-a12b-fbd67f604189', aircraft,
    'cf30840c-07d0-45d7-876f-9fde8241381b', pax,
    '31768f95-4989-4585-9c0c-9fa7c8f12e02', tail,
    '9b3d08dc-c185-436b-9235-ce68411952f6', eta,
    'c61adb92-0ea9-4a58-9d82-b936a6e63fed', etd,
    '5f00c419-3e46-4021-9d53-2dc25f3264d1', op_email,
    'c4b001e9-d968-4ebd-9de6-9b5b45e77118', origin,
    '34a7fc66-7b7d-4f3a-a773-f052b46c7221', op_name,
    'c155ecca-28b8-482f-a240-ec1aa142ba8d', phone,
    '75044268-37ec-41e0-a220-ba64e3ef9692', fuel
  ),
  CASE WHEN op_cat = 'medevac' THEN 'Medevac patient transfer — priority handling and ambulance ramp access requested.' ELSE notes_pick END,
  CASE WHEN kind = 'fast' OR kind = 'canceled' THEN creator_oi WHEN kind = 'coord_approved' THEN approver_oi2 ELSE NULL END,
  CASE WHEN is_public THEN NULL ELSE creator_id::uuid END,
  CASE WHEN kind = 'triage' THEN NULL WHEN kind = 'coord_approved' THEN approver_id::uuid WHEN kind = 'denied' THEN approver_id::uuid ELSE creator_id::uuid END,
  submit_ts,
  CASE
    WHEN kind = 'triage' THEN submit_ts
    WHEN kind = 'fast' THEN CASE WHEN arrival_date <= DATE '2026-07-18' THEN departed_ts ELSE submit_ts END
    WHEN kind = 'coord_approved' THEN CASE WHEN arrival_date <= DATE '2026-07-18' THEN departed_ts ELSE triaged_ts + make_interval(hours => 28 + (i % 10) * 2) END
    WHEN kind = 'coord' THEN triaged_ts + make_interval(hours => 12)
    WHEN kind = 'approval' THEN triaged_ts + make_interval(hours => 22)
    WHEN kind = 'canceled' THEN cancel_ts
    WHEN kind = 'denied' AND i = 37 THEN denial_ts_public
    ELSE triaged_ts + make_interval(hours => 28 + (i % 10) * 2)
  END,
  CASE
    WHEN kind = 'triage' THEN 'pending_amops_triage'
    WHEN kind = 'coord' THEN 'pending_coordination'
    WHEN kind = 'approval' THEN 'pending_amops_approval'
    WHEN kind = 'canceled' THEN 'canceled'
    WHEN kind = 'denied' THEN 'denied'
    ELSE 'approved'
  END,
  requester_name,
  CASE WHEN is_public THEN op_email WHEN (i % 2) = 0 THEN op_email ELSE NULL END,
  CASE WHEN kind IN ('coord','approval','coord_approved') OR (kind = 'denied' AND i = 74) THEN creator_id::uuid ELSE NULL END,
  CASE WHEN kind IN ('coord','approval','coord_approved') OR (kind = 'denied' AND i = 74) THEN triaged_ts ELSE NULL END,
  CASE WHEN kind IN ('fast','canceled') THEN creator_id::uuid WHEN kind = 'coord_approved' THEN approver_id::uuid WHEN kind = 'denied' THEN approver_id::uuid ELSE NULL END,
  CASE
    WHEN kind = 'fast' THEN submit_ts
    WHEN kind = 'canceled' THEN submit_ts
    WHEN kind = 'coord_approved' THEN triaged_ts + make_interval(hours => 28 + (i % 10) * 2)
    WHEN kind = 'denied' AND i = 37 THEN denial_ts_public
    WHEN kind = 'denied' AND i = 74 THEN triaged_ts + make_interval(hours => 28 + (i % 10) * 2)
    ELSE NULL
  END,
  CASE
    WHEN kind = 'denied' AND i = 37 THEN 'Requested arrival falls outside published operating hours (0600-2200 local) and no after-hours staffing is available for the slot.'
    WHEN kind = 'denied' AND i = 74 THEN 'ARFF non-concur — requested slot conflicts with scheduled foam-system maintenance; unable to guarantee required ARFF coverage for the aircraft category.'
    ELSE NULL
  END,
  is_public,
  phone,
  CASE WHEN kind = 'canceled' THEN (ARRAY['Trip canceled by the operator; slot released.','Aircraft diverted to an alternate; arrival no longer required.','Requester rescheduled to a later date under a new PPR.'])[1 + (i % 3)] ELSE NULL END,
  CASE WHEN kind IN ('fast','coord_approved') AND arrival_date <= DATE '2026-07-18' THEN departed_ts ELSE NULL END,
  CASE WHEN kind IN ('fast','coord_approved') AND arrival_date <= DATE '2026-07-18' THEN creator_id::uuid ELSE NULL END
FROM seqd
ON CONFLICT DO NOTHING;

-- ── 5. ppr_coordination (70 rows across 19 entries) ──────────────────────────
INSERT INTO ppr_coordination (id, entry_id, agency_id, agency_name, status, comment, coordinated_by, coordinated_at, created_at)
WITH base AS (
  SELECT
    i,
    (DATE '2026-07-23' - (floor(178.0 * power((90.0 - i) / 89.0, 1.7)))::int) AS arrival_date,
    (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'])[1 + (i % 5)] AS creator_id,
    CASE
      WHEN i = 90 OR i = 89 THEN 'triage'
      WHEN i = 88 OR i = 87 THEN 'coord'
      WHEN i = 86 OR i = 85 THEN 'approval'
      WHEN i = 84 THEN 'coord_approved'
      WHEN i % 23 = 0 THEN 'canceled'
      WHEN i % 37 = 0 THEN 'denied'
      WHEN i % 6 = 0 THEN 'coord_approved'
      ELSE 'fast'
    END AS kind
  FROM generate_series(1, 90) AS s(i)
),
ce AS (
  SELECT b.*,
    (GREATEST(((b.arrival_date::timestamp) AT TIME ZONE 'UTC') - make_interval(days => 2 + (b.i % 6), hours => 7 + (b.i % 12), mins => (b.i * 11) % 60), TIMESTAMPTZ '2026-01-24 06:00:00+00')
      + make_interval(hours => 3 + (b.i % 5), mins => (b.i * 7) % 60)) AS triaged_ts
  FROM base b
  WHERE b.kind IN ('coord','approval','coord_approved') OR (b.kind = 'denied' AND b.i = 74)
),
expanded AS (
  SELECT ce.*, a.slot, a.agency_id, a.agency_name
  FROM ce
  CROSS JOIN LATERAL (VALUES
    (1, md5('kdra-ppr-agency-airport-operations')::uuid, 'Airport Operations'),
    (2, md5('kdra-ppr-agency-arff')::uuid,               'ARFF'),
    (3, md5('kdra-ppr-agency-security')::uuid,           'Security'),
    (4, md5('kdra-ppr-agency-maintenance')::uuid,        'Maintenance')
  ) AS a(slot, agency_id, agency_name)
  WHERE a.slot IN (1, 2)
     OR (a.slot = 3 AND ce.i % 2 = 0)
     OR (a.slot = 4 AND ce.i % 3 = 0)
)
SELECT
  md5('kdra-ppr-coord-' || i || '-' || slot)::uuid,
  md5('kdra-ppr-entry-' || i)::uuid,
  agency_id,
  agency_name,
  CASE
    WHEN kind IN ('coord_approved','approval') THEN 'concur'
    WHEN kind = 'coord' THEN CASE WHEN slot IN (1,2) THEN 'concur' ELSE 'pending' END
    WHEN kind = 'denied' THEN CASE WHEN slot = 2 THEN 'non_concur' ELSE 'concur' END
  END,
  CASE
    WHEN kind = 'denied' AND slot = 2 THEN 'Requested slot conflicts with scheduled foam-system maintenance; unable to guarantee ARFF coverage.'
    WHEN kind = 'coord' AND slot NOT IN (1,2) THEN NULL
    WHEN slot = 1 THEN 'Ramp and movement-area availability confirmed for the arrival slot.'
    WHEN slot = 2 THEN 'ARFF index adequate for the aircraft category; standing by for arrival.'
    WHEN slot = 3 THEN 'Access and badging arrangements confirmed with the tenant FBO.'
    WHEN slot = 4 THEN 'No conflicting pavement or lighting work scheduled for the arrival window.'
  END,
  CASE
    WHEN kind = 'coord' AND slot NOT IN (1,2) THEN NULL
    WHEN slot = 1 THEN creator_id::uuid
    WHEN slot = 2 THEN '10bd2c31-e693-c4d5-2455-d3af3506d106'::uuid
    WHEN slot = 3 THEN '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid
    WHEN slot = 4 THEN 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid
  END,
  CASE WHEN kind = 'coord' AND slot NOT IN (1,2) THEN NULL ELSE triaged_ts + make_interval(hours => slot * 4 + (i % 6)) END,
  triaged_ts
FROM expanded
ON CONFLICT DO NOTHING;

-- ── 6. ppr_remarks — coordination mirror ([agency — decision] comment) ───────
-- Mirrors coordinatePprEntry: each concur / non-concur comment is echoed into
-- the remarks thread. Derived from the coord rows just inserted, scoped to KDRA.
INSERT INTO ppr_remarks (id, entry_id, base_id, remark, created_by, created_at, updated_at)
SELECT
  md5('kdra-ppr-remark-mirror-' || c.id::text)::uuid,
  c.entry_id,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  '[' || c.agency_name || ' — ' || CASE WHEN c.status = 'concur' THEN 'CONCUR' ELSE 'NON-CONCUR' END || '] ' || c.comment,
  c.coordinated_by,
  c.coordinated_at,
  NULL
FROM ppr_coordination c
JOIN ppr_entries e ON e.id = c.entry_id
WHERE e.base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'
  AND c.comment IS NOT NULL
  AND c.coordinated_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 7. ppr_remarks — free-text operational notes ─────────────────────────────
INSERT INTO ppr_remarks (id, entry_id, base_id, remark, created_by, created_at, updated_at)
WITH notes AS (
  SELECT
    i,
    (DATE '2026-07-23' - (floor(178.0 * power((90.0 - i) / 89.0, 1.7)))::int) AS arrival_date,
    (ARRAY['44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','4f8ab1a5-c662-a906-7ae3-2730db18551f','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'])[1 + (i % 5)] AS author_id,
    CASE
      WHEN i = 90 OR i = 89 THEN 'triage'
      WHEN i = 88 OR i = 87 THEN 'coord'
      WHEN i = 86 OR i = 85 THEN 'approval'
      WHEN i = 84 THEN 'coord_approved'
      WHEN i % 23 = 0 THEN 'canceled'
      WHEN i % 37 = 0 THEN 'denied'
      WHEN i % 6 = 0 THEN 'coord_approved'
      ELSE 'fast'
    END AS kind,
    (ARRAY[
      'Confirmed Jet-A availability with line service; fuel truck staged for the arrival window.',
      'Requester called to confirm passenger count; updated the ETA by 15 minutes.',
      'Aircraft marshalled to the transient ramp; chocks and GPU in place.',
      'Overnight hangar assigned; crew transport arranged through the FBO.',
      'Crew requested an early departure; coordinated a dawn pushback with line service.',
      'De-conflicted with a same-day arrival on the west apron; no spacing issues.',
      'Verified handling and insurance paperwork on file with the FBO.',
      'Light crosswind noted at the arrival time; no operational impact.'
    ])[1 + (i % 8)] AS remark_text
  FROM generate_series(1, 90) AS s(i)
  WHERE (i % 7 = 0 OR i % 9 = 0)
)
SELECT
  md5('kdra-ppr-remark-note-' || i)::uuid,
  md5('kdra-ppr-entry-' || i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  remark_text,
  author_id::uuid,
  GREATEST(((arrival_date::timestamp) AT TIME ZONE 'UTC') - make_interval(days => 2 + (i % 6)), TIMESTAMPTZ '2026-01-24 06:00:00+00') + make_interval(hours => 6 + (i % 12)),
  NULL
FROM notes
WHERE kind <> 'triage'
ON CONFLICT DO NOTHING;

-- ── 8. ppr_number_sequence (consistent with ALL entries on each arrival_date) ─
-- last_seq = max parsed middle segment across every KDRA entry (existing + new),
-- so the next real PPR submission on any seeded date continues the numbering
-- without colliding. Matches the 2026042803 backfill semantics.
INSERT INTO ppr_number_sequence (base_id, arrival_date, last_seq, updated_at)
SELECT
  base_id,
  arrival_date,
  MAX(NULLIF(split_part(ppr_number, '-', 2), '')::int),
  MAX(created_at)
FROM ppr_entries
WHERE base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'
GROUP BY base_id, arrival_date
ON CONFLICT DO NOTHING;

COMMIT;
