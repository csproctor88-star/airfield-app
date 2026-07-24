-- =====================================================================
-- KDRA Demo Seed — CLUSTER G: §139.303 Training + Local Regs +
--   Mods & Exemptions + Read File
-- Base: Demo Regional Airport (KDRA) ea2b542e-72cc-4300-9037-bfe18c0bf7ae
-- "Today" = 2026-07-23. History window 2026-01-24 -> 2026-07-23.
-- INSERT-only. Deterministic md5 ids. Bare ON CONFLICT DO NOTHING
--   (covers id PK AND any secondary unique constraints -> safe re-apply).
-- Real 14 CFR Part 139 / AC 150 / Order 5300.1G citations only;
--   no fabricated verbatim regulatory text.
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- 1. training_topics  (7 KDRA-local topics; the 13 global §139.303(e)
--    topics + 2 existing KDRA topics already cover the FAA curriculum,
--    so we ADD local/practical modules with distinct codes rather than
--    duplicating the global set.)
-- ---------------------------------------------------------------------
INSERT INTO training_topics
  (id, base_id, code, title, description, source, applies_to,
   initial_required, recurrent_frequency_months, retention_months,
   active, sort_order, created_at, updated_at)
SELECT
  md5('kdra-training_topics-'||ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  t.code, t.title, t.descr, t.src,
  ARRAY['faa_part139']::text[],
  true, 12, 24, true, (200 + ord*10),
  ('2026-02-05'::timestamptz + (ord * interval '1 day')),
  ('2026-02-05'::timestamptz + (ord * interval '1 day'))
FROM unnest(
  ARRAY['KDRA-AEP','KDRA-FUEL','KDRA-DRV','KDRA-WX','KDRA-NOTAM','KDRA-FOD','KDRA-NEO']::text[],
  ARRAY[
    'Airport Emergency Plan familiarization',
    'Fuel farm and into-plane fueling safety',
    'Movement-area driving and radio phraseology',
    'Winter operations and FICON reporting',
    'NOTAM origination and coordination',
    'FOD prevention and control',
    'New-employee airfield orientation'
  ]::text[],
  ARRAY[
    'Overview of the Airport Emergency Plan required by 14 CFR 139.325 - roles, notification, and coordination with mutual-aid agencies during an emergency.',
    'Safe fuel storage and into-plane fueling practices inspected under 14 CFR 139.321 - bonding and grounding, spill prevention, and supervision of fueling agents.',
    'Rules and radio phraseology for driving in the movement and safety areas, including hold-short discipline and runway incursion prevention.',
    'Snow and ice control priorities, friction and FICON reporting, and winter NOTAM procedures.',
    'How to originate, maintain, and cancel airfield NOTAMs and coordinate with Flight Service.',
    'FOD sources, the FOD Check schedule, collection and reporting, and construction-area controls.',
    'First-week orientation to the airfield layout, access rules, and the self-inspection and reporting workflow for new operations staff.'
  ]::text[],
  ARRAY['14 CFR §139.325','14 CFR §139.321','FAA AC 150/5210-20A','14 CFR §139.313','14 CFR §139.339','FAA AC 150/5210-24','14 CFR §139.303']::text[]
) WITH ORDINALITY AS t(code, title, descr, src, ord)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. training_records  (main batch: 40 completions spread across the
--    9 staff x 15 known-good topics; initial/recurrent/remedial;
--    completed dates 2025-06..2026-07 so expiry gives current /
--    due-soon / overdue mix. created_at inside the window.)
-- ---------------------------------------------------------------------
INSERT INTO training_records
  (id, base_id, user_id, topic_id, completed_at, training_type,
   instructor_user_id, instructor_name_external, evidence_url,
   expires_at, notes, created_at, created_by, updated_at)
SELECT
  md5('kdra-training_records-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[])[1 + (i % 9)],
  (ARRAY['bef561a3-6ff8-459e-906c-7d6f00f3512a','bbe273e7-fb17-4c6d-becb-636e7b43299e','ce9884a1-8b8e-4607-8456-141b53275eb0','5456c23b-71f8-4200-9fe5-f6473566df4c','6cab9dcd-d93d-4765-8969-253b9d585363','1e6fb125-ebfc-419a-8505-261098d32221','6d625b9a-855a-4538-ae2a-a20cef0a75cb','d05c37d0-2d26-4aa5-b604-af5d9f8de09b','268cab88-e379-46bc-a62b-b79f962677eb','189f0268-9406-43b4-ad8e-009a2978e143','c6883504-0026-4d06-9292-95dfcddfcf06','2365fa9c-a9b1-439c-8d33-67b6d4668934','bd631f64-dd50-40fd-9b9b-cd6d37a43a5b','54f94744-acc1-4d23-a998-be19832eb237','bb251d1d-a000-4099-879e-bf6908071abc']::uuid[])[1 + (i % 15)],
  x.comp,
  (ARRAY['recurrent','recurrent','recurrent','initial','recurrent','recurrent','initial','remedial']::text[])[1 + (i % 8)],
  CASE WHEN i % 3 = 0 THEN (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','4f8ab1a5-c662-a906-7ae3-2730db18551f','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[])[1 + (i % 3)] ELSE NULL END,
  CASE WHEN i % 3 = 0 THEN NULL ELSE (ARRAY['L. Hartman','AAAE Interactive Employee Training','FAA Airport Safety and Standards Seminar','Regional Part 139 Workshop']::text[])[1 + (i % 4)] END,
  NULL,
  (x.comp + interval '12 months')::date,
  CASE WHEN i % 6 = 0 THEN (ARRAY['Completed via the AAAE Interactive Employee Training module.','Hands-on session with the airfield operations team.','Recurrent refresher; competency verified by the operations supervisor.']::text[])[1 + (i % 3)] ELSE NULL END,
  x.cr,
  (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','4f8ab1a5-c662-a906-7ae3-2730db18551f']::uuid[])[1 + (i % 2)],
  x.cr
FROM (
  SELECT i,
    ('2026-07-12'::date - (((i*47) % 400))::int) AS comp,
    ('2026-07-22'::timestamptz - (((i*i) % 170))::int * interval '1 day') AS cr
  FROM generate_series(1,40) AS g(i)
) x
ON CONFLICT DO NOTHING;

-- 2b. training_records referencing the 7 new KDRA-local topics
--     (so the local modules show completions too).
INSERT INTO training_records
  (id, base_id, user_id, topic_id, completed_at, training_type,
   instructor_user_id, instructor_name_external, evidence_url,
   expires_at, notes, created_at, created_by, updated_at)
SELECT
  md5('kdra-tr-newtopic-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[])[1 + (i % 9)],
  md5('kdra-training_topics-'||i)::uuid,
  ('2026-06-25'::date - (i*4))::date,
  'initial',
  NULL,
  'AAAE Interactive Employee Training',
  NULL,
  (('2026-06-25'::date - (i*4)) + interval '12 months')::date,
  NULL,
  ('2026-06-26'::timestamptz + (i * interval '2 days')),
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
  ('2026-06-26'::timestamptz + (i * interval '2 days'))
FROM generate_series(1,7) AS g(i)
ON CONFLICT DO NOTHING;

-- 2c. renewal chains: 10 "previous" records (older cycle, expired/expiring)
INSERT INTO training_records
  (id, base_id, user_id, topic_id, completed_at, training_type,
   instructor_user_id, instructor_name_external, evidence_url,
   expires_at, notes, created_at, created_by, updated_at)
SELECT
  md5('kdra-tr-prev-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[])[1 + (i % 9)],
  (ARRAY['bef561a3-6ff8-459e-906c-7d6f00f3512a','bbe273e7-fb17-4c6d-becb-636e7b43299e','ce9884a1-8b8e-4607-8456-141b53275eb0','5456c23b-71f8-4200-9fe5-f6473566df4c','6cab9dcd-d93d-4765-8969-253b9d585363','1e6fb125-ebfc-419a-8505-261098d32221','6d625b9a-855a-4538-ae2a-a20cef0a75cb','d05c37d0-2d26-4aa5-b604-af5d9f8de09b','268cab88-e379-46bc-a62b-b79f962677eb','189f0268-9406-43b4-ad8e-009a2978e143','c6883504-0026-4d06-9292-95dfcddfcf06','2365fa9c-a9b1-439c-8d33-67b6d4668934','bd631f64-dd50-40fd-9b9b-cd6d37a43a5b','54f94744-acc1-4d23-a998-be19832eb237','bb251d1d-a000-4099-879e-bf6908071abc']::uuid[])[1 + (i % 15)],
  (('2026-07-15'::date - (((i*97) % 470))::int) - interval '12 months')::date,
  CASE WHEN i % 2 = 0 THEN 'recurrent' ELSE 'initial' END,
  NULL, 'L. Hartman', NULL,
  ('2026-07-15'::date - (((i*97) % 470))::int)::date,
  'Prior training cycle; superseded by a renewal record.',
  ('2026-02-01'::timestamptz + (i * interval '3 days')),
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
  ('2026-02-01'::timestamptz + (i * interval '3 days'))
FROM generate_series(1,10) AS g(i)
ON CONFLICT DO NOTHING;

-- 2d. renewal chains: 10 "renewed" records (new cycle; mix current /
--     due-soon / overdue via the completed date spread)
INSERT INTO training_records
  (id, base_id, user_id, topic_id, completed_at, training_type,
   instructor_user_id, instructor_name_external, evidence_url,
   expires_at, notes, created_at, created_by, updated_at)
SELECT
  md5('kdra-tr-renew-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  (ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[])[1 + (i % 9)],
  (ARRAY['bef561a3-6ff8-459e-906c-7d6f00f3512a','bbe273e7-fb17-4c6d-becb-636e7b43299e','ce9884a1-8b8e-4607-8456-141b53275eb0','5456c23b-71f8-4200-9fe5-f6473566df4c','6cab9dcd-d93d-4765-8969-253b9d585363','1e6fb125-ebfc-419a-8505-261098d32221','6d625b9a-855a-4538-ae2a-a20cef0a75cb','d05c37d0-2d26-4aa5-b604-af5d9f8de09b','268cab88-e379-46bc-a62b-b79f962677eb','189f0268-9406-43b4-ad8e-009a2978e143','c6883504-0026-4d06-9292-95dfcddfcf06','2365fa9c-a9b1-439c-8d33-67b6d4668934','bd631f64-dd50-40fd-9b9b-cd6d37a43a5b','54f94744-acc1-4d23-a998-be19832eb237','bb251d1d-a000-4099-879e-bf6908071abc']::uuid[])[1 + (i % 15)],
  ('2026-07-15'::date - (((i*97) % 470))::int)::date,
  'recurrent',
  NULL, 'L. Hartman', NULL,
  (('2026-07-15'::date - (((i*97) % 470))::int) + interval '12 months')::date,
  'Recurrent renewal of a prior training cycle.',
  ('2026-06-20'::timestamptz + (i * interval '2 days')),
  '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
  ('2026-06-20'::timestamptz + (i * interval '2 days'))
FROM generate_series(1,10) AS g(i)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. training_renewals  (10; links each previous -> renewed record)
-- ---------------------------------------------------------------------
INSERT INTO training_renewals
  (id, base_id, previous_record_id, renewed_record_id, renewed_at)
SELECT
  md5('kdra-training_renewals-'||i)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  md5('kdra-tr-prev-'||i)::uuid,
  md5('kdra-tr-renew-'||i)::uuid,
  (('2026-07-15'::date - (((i*97) % 470))::int)::timestamptz + interval '9 hours')
FROM generate_series(1,10) AS g(i)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. training_certificates  (18; credential enum = training_credential:
--    AAAE-CM / ACE-Ops / ACE-Comm / ACE-Sec / ACE-WHC. Some expiries
--    NULL (ongoing), some 5-yr so a few land 2026-2028 = due soon.)
-- ---------------------------------------------------------------------
INSERT INTO training_certificates
  (id, base_id, user_id, credential, issued_at, expires_at,
   certificate_url, notes, created_at, created_by, updated_at)
SELECT
  md5('kdra-training_certificates-'||u.ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  u.uid,
  u.cred::training_credential,
  u.issued,
  CASE WHEN u.ord % 3 = 0 THEN NULL ELSE (u.issued + interval '5 years')::date END,
  NULL,
  CASE u.cred
    WHEN 'AAAE-CM' THEN 'AAAE Certified Member (C.M.).'
    WHEN 'ACE-Ops' THEN 'Airport Certified Employee - Operations.'
    WHEN 'ACE-Comm' THEN 'Airport Certified Employee - Communications.'
    WHEN 'ACE-Sec' THEN 'Airport Certified Employee - Security.'
    WHEN 'ACE-WHC' THEN 'Airport Certified Employee - Wildlife Hazard Control.'
  END,
  u.cat,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
  u.cat
FROM (
  SELECT uid, cred, ord,
    ('2025-12-01'::date - (((ord*97) % 1500))::int) AS issued,
    ('2026-03-01'::timestamptz + (ord * interval '5 days')) AS cat
  FROM unnest(
    ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af9a39db-76fd-4bcc-8d50-7afbc292eaf6','4f8ab1a5-c662-a906-7ae3-2730db18551f','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106','10bd2c31-e693-c4d5-2455-d3af3506d106','af5eed97-5425-d64b-358f-8c1b0e8050af','af9a39db-76fd-4bcc-8d50-7afbc292eaf6']::uuid[],
    ARRAY['AAAE-CM','ACE-Ops','ACE-Ops','ACE-Comm','ACE-Ops','ACE-WHC','ACE-Ops','ACE-Comm','ACE-Ops','ACE-Sec','ACE-Ops','AAAE-CM','ACE-Ops','ACE-Sec','ACE-Ops','ACE-WHC','AAAE-CM','ACE-Sec']::text[]
  ) WITH ORDINALITY AS t(uid, cred, ord)
) u
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. local_regulations  (9 new civilian rules/directives; distinct from
--    the 4 existing. storage_path mirrors existing shape; files 404 by
--    design. review_interval in {monthly,quarterly}.)
-- ---------------------------------------------------------------------
INSERT INTO local_regulations
  (id, base_id, title, description, storage_path, file_name, mime_type,
   file_size_bytes, version, review_interval, is_archived,
   created_by, created_at, updated_at)
SELECT
  md5('kdra-local_regulations-'||t.ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  t.title, t.descr,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae/' || t.epoch::text || '-' || t.fname,
  t.fname, 'application/pdf', t.sz, 1, t.rint, false,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
  t.cat, t.cat
FROM unnest(
  ARRAY[
    'Noise Abatement Procedures',
    'Construction Safety and Phasing Plan (CSPP)',
    'FBO and Tenant Operating Rules',
    'Aircraft Fueling Safety and Fuel Storage Standards',
    'Airport Self-Inspection Program SOP',
    'NOTAM Management SOP',
    'Foreign Object Debris (FOD) Control Program',
    'Low-Visibility Operations Plan',
    'Vehicle and Pedestrian Escort Procedures'
  ]::text[],
  ARRAY[
    'Voluntary noise abatement departure and arrival procedures, preferred runway use, and quiet hours for Runway 01/19, coordinated with based operators and the surrounding community.',
    'Construction safety and phasing plan per 14 CFR 139.341 and FAA AC 150/5370-2G - haul routes, marking and lighting of closures, and NOTAM coordination for airfield projects.',
    'Operating rules and minimum standards for the fixed-base operator and airport tenants - apron conduct, self-fueling permits, vehicle access, and insurance requirements under the Airport Certification Manual.',
    'Fuel storage, handling, and into-plane fueling safety standards inspected under 14 CFR 139.321 and NFPA 407 - bonding and grounding, spill prevention, and recordkeeping.',
    'Standard operating procedure for the daily and special self-inspection program required by 14 CFR 139.327 - inspection areas, checklists, discrepancy handling, and recordkeeping.',
    'Procedures for originating, maintaining, and cancelling NOTAMs for airfield conditions per 14 CFR 139.339 - coordination with the Flight Service Station and internal review.',
    'Airport FOD control program per FAA AC 150/5210-24 - FOD Check schedule, collection and reporting, and construction-area controls.',
    'Low-visibility operations procedures - activation criteria, movement-area controls, and surface-movement guidance during reduced visibility.',
    'Escort procedures for vehicles and pedestrians in the movement and safety areas per FAA AC 150/5210-20A - authorization, radio requirements, and runway incursion prevention.'
  ]::text[],
  ARRAY['Noise-Abatement-Procedures.pdf','Construction-Safety-Phasing-Plan-CSPP.pdf','FBO-and-Tenant-Operating-Rules.pdf','Aircraft-Fueling-Safety-Standards.pdf','Self-Inspection-Program-SOP.pdf','NOTAM-Management-SOP.pdf','FOD-Control-Program.pdf','Low-Visibility-Operations-Plan.pdf','Vehicle-Pedestrian-Escort-Procedures.pdf']::text[],
  ARRAY[1773360000000,1775433600000,1776988800000,1778294400000,1779753600000,1780963200000,1782086400000,1783123200000,1784073600000]::bigint[],
  ARRAY[1876544,4325376,2097152,3145728,2621440,1572864,1310720,2883584,1179648]::bigint[],
  ARRAY['quarterly','monthly','quarterly','monthly','monthly','monthly','quarterly','quarterly','monthly']::text[],
  ARRAY['2026-03-12T13:00:00+00','2026-04-02T13:00:00+00','2026-04-20T13:00:00+00','2026-05-05T13:00:00+00','2026-05-22T13:00:00+00','2026-06-05T13:00:00+00','2026-06-18T13:00:00+00','2026-06-30T13:00:00+00','2026-07-10T13:00:00+00']::timestamptz[]
) WITH ORDINALITY AS t(title, descr, fname, epoch, sz, rint, cat, ord)
ON CONFLICT DO NOTHING;

-- 5b. local_regulation_reviews for the 9 new regulations (one each,
--     Marcus/Anthony alternating; reviewed after the doc was added).
INSERT INTO local_regulation_reviews
  (id, base_id, regulation_id, user_id, reviewed_at, version_at_review,
   initials_snapshot, created_at)
SELECT
  md5('kdra-reg_review-new-'||t.ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  md5('kdra-local_regulations-'||t.ord)::uuid,
  CASE WHEN t.ord % 2 = 0 THEN '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid ELSE 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid END,
  t.rev, 1,
  CASE WHEN t.ord % 2 = 0 THEN 'AR' ELSE 'MD' END,
  t.rev
FROM unnest(
  ARRAY['2026-03-30T15:00:00+00','2026-04-16T15:00:00+00','2026-05-04T15:00:00+00','2026-05-19T15:00:00+00','2026-06-05T15:00:00+00','2026-06-19T15:00:00+00','2026-07-01T15:00:00+00','2026-07-13T15:00:00+00','2026-07-21T15:00:00+00']::timestamptz[]
) WITH ORDINALITY AS t(rev, ord)
ON CONFLICT DO NOTHING;

-- 5c. local_regulation_reviews on the 4 EXISTING regulations (recent
--     cadence sign-off by Anthony) - INSERT only, references real ids.
INSERT INTO local_regulation_reviews
  (id, base_id, regulation_id, user_id, reviewed_at, version_at_review,
   initials_snapshot, created_at)
SELECT
  md5('kdra-reg_review-exist-'||t.ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  t.rid, '4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
  t.rev, 1, 'AR', t.rev
FROM unnest(
  ARRAY['1a2b3c4d-0001-4a00-9000-000000000001','1a2b3c4d-0002-4a00-9000-000000000002','1a2b3c4d-0003-4a00-9000-000000000003','1a2b3c4d-0004-4a00-9000-000000000004']::uuid[],
  ARRAY['2026-07-20T14:00:00+00','2026-07-15T14:00:00+00','2026-07-12T14:00:00+00','2026-07-21T14:00:00+00']::timestamptz[]
) WITH ORDINALITY AS t(rid, rev, ord)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 6. mods_exemptions  (9 new; mos/exemption/deviation across many
--    statuses. Real 14 CFR / AC 150/5300-13B / Order 5300.1G / Part 11
--    citations; section numbers + plain purpose only, no invented quotes.
--    Distinct from the 5 existing records.)
-- ---------------------------------------------------------------------
INSERT INTO mods_exemptions
  (id, base_id, record_type, title, status, standard_reference,
   baseline_summary, relief_summary, justification, public_interest,
   safety_justification, mos_category, mos_subcategory, approval_authority,
   agis_tracking, docket_number, arff_small_airport, date_submitted,
   date_decided, effective_date, expiration_date, decision_summary,
   decision_conditions, last_reviewed_date, next_review_due,
   deviation_date, notified_date, written_notice_requested,
   written_notice_provided, notes, created_by, updated_by,
   created_at, updated_at)
VALUES
-- M1: MOS approved - RSA / declared distances
('a1b2c3d4-1001-4c01-9c01-000000000001'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Runway Safety Area length via declared distances (Runway 19 end)','approved',
 'AC 150/5300-13B, Table 3-5 - Runway Safety Area (RSA) dimensions',
 'The graded Runway Safety Area beyond the Runway 19 end does not achieve the full standard RSA length because of terrain and the airport perimeter road.',
 'Apply declared distances (TORA/TODA/ASDA/LDA) with the existing partial RSA in lieu of achieving the full standard RSA length.',
 'Achieving the full graded RSA would require relocating the perimeter road and regrading a protected slope at a cost disproportionate to the incremental safety benefit.',
 NULL,
 'A safety risk management panel determined that the declared distances together with the existing runway end siting maintain an acceptable level of safety (FAA Order 5300.1G basis).',
 'Design','Runway Safety Area / Declared Distances','regional',
 'AGIS MOS 2025-DRA-021',NULL,false,
 '2025-03-05','2025-06-18','2025-06-18','2030-06-18',
 'FAA Regional Airports Division approved the modification with declared distances applied, subject to the stated conditions.',
 'Publish declared distances in the Chart Supplement; revalidate at each annual Airport Certification/Safety Inspection; modification expires five years from approval unless renewed (Order 5300.1G para 8.f).',
 '2026-06-15','2027-06-15',NULL,NULL,false,false,
 'Airport tracking record; the FAA system of record is the Airports GIS MOS Tool (Order 5300.1G para 12.a).',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
 '2026-06-16T14:00:00+00','2026-06-16T14:00:00+00'),
-- M2: MOS under_review - taxilane object free area to fuel farm
('a1b2c3d4-1002-4c02-9c02-000000000002'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Taxilane object free area encroachment near the fuel farm','under_review',
 'AC 150/5300-13B, Table 4-1 - Taxiway/Taxilane Object Free Area (OFA)',
 'A portion of the fuel farm containment structure lies within the standard taxilane object free area for the apron taxilane.',
 'Accept the existing encroachment on an interim basis while a relocation project is programmed in the Airport Capital Improvement Plan.',
 'Relocating the fuel farm containment is a multi-year capital project; interim operational limits keep the affected taxilane restricted to lower design-group aircraft.',
 NULL,
 'Interim marking and a taxilane use restriction are under evaluation by the safety risk management panel.',
 'Design','Object Free Area','regional',
 'AGIS MOS 2026-DRA-011',NULL,false,
 '2026-05-22',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,false,
 'Awaiting FAA Regional Airports Division disposition.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-05-23T10:00:00+00','2026-05-23T10:00:00+00'),
-- M3: MOS draft - runway shoulder width
('a1b2c3d4-1003-4c03-9c03-000000000003'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Runway 01/19 shoulder width (draft)','draft',
 'AC 150/5300-13B, Table 3-8 - Runway Shoulder Width',
 'Existing paved runway shoulders are narrower than the current standard for the runway design code.',
 'Retain the existing shoulder width pending a future rehabilitation project.',
 'The existing shoulders predate the current standard and have performed without erosion or jet-blast issues; widening will be evaluated at the next pavement rehabilitation.',
 NULL,
 'Draft pending a safety risk management review.',
 'Design','Runway Shoulder','ado',
 NULL,NULL,false,
 NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,false,
 'Draft for internal review before submission to the FAA.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-07-14T09:00:00+00','2026-07-14T09:00:00+00'),
-- M4: deviation closed - temporary reduction in self-inspection frequency
('a1b2c3d4-1004-4c04-9c04-000000000004'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'deviation','Emergency Deviation - temporary self-inspection frequency reduction (vehicle outage)','closed',
 '14 CFR 139.327 (self-inspection program) - emergency deviation under 14 CFR 139.113',
 'Daily self-inspections are conducted at the frequency established in the Airport Certification Manual.',
 'Temporary deviation reducing the special-inspection cadence for two days after both inspection vehicles were out of service, using a walking/hand-off inspection method for the minimum period necessary.',
 'A short-term equipment outage prevented normal vehicle-based inspection; the deviation was limited to the extent required to continue operations safely.',
 NULL,
 'A NOTAM was issued, movement-area activity was reduced, and inspections continued on foot until a vehicle was returned to service.',
 NULL,NULL,NULL,
 NULL,NULL,false,
 NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
 '2026-04-02','2026-04-05',true,true,
 'Regional Airports Division Manager notified within the 14-day window (14 CFR 139.113 / Order 5280.5D 2.13). Normal operations resumed; record retained.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
 '2026-04-06T16:00:00+00','2026-04-06T16:00:00+00'),
-- M5: exemption denied - alternate ARFF response-time demonstration
('a1b2c3d4-1005-4c05-9c05-000000000005'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'exemption','Part 139 Exemption - alternate ARFF response-time demonstration method (denied)','denied',
 '14 CFR 139.319 (ARFF operational requirements: response time) - petitioned under 14 CFR 139.111 / 14 CFR Part 11',
 'ARFF response time is demonstrated by the timed response drill required under 139.319.',
 'Petition to substitute a modeling-based response-time demonstration for the on-airport timed drill.',
 'The airport sought to reduce drill frequency by using a validated response-time model.',
 'Continued Part 139 air carrier service was cited in support of the petition (14 CFR 11.81(d)).',
 'The existing timed response-time drill provides the required verification of ARFF response capability; no reduction in the level of safety was accepted.',
 NULL,NULL,'headquarters',
 NULL,'FAA-2025-0412',false,
 '2025-04-10','2025-09-30',NULL,NULL,
 'FAA denied the petition; the existing timed response-time demonstration is retained.',
 NULL,NULL,NULL,NULL,NULL,false,false,
 'Denied; recommend resubmission only with additional validated data (see review record).',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-02-20T11:00:00+00','2026-02-20T11:00:00+00'),
-- M6: MOS approved - runway protection zone land use
('a1b2c3d4-1006-4c06-9c06-000000000006'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Runway Protection Zone incompatible land use (perimeter road)','approved',
 'AC 150/5300-13B, Section 3 - Runway Protection Zone (RPZ); FAA RPZ interim guidance',
 'A segment of the airport perimeter road crosses the Runway 01 approach Runway Protection Zone, an incompatible land use under current RPZ guidance.',
 'Retain the existing perimeter road alignment within the RPZ subject to the FAA RPZ evaluation and mitigation measures.',
 'Relocating the perimeter road outside the RPZ is constrained by property boundaries and wetlands; a full RPZ alternatives analysis found the existing alignment acceptable with mitigations.',
 NULL,
 'Signage, controlled access, and the RPZ alternatives analysis support an acceptable level of safety (FAA RPZ interim guidance).',
 'Design','Runway Protection Zone Land Use','regional',
 'AGIS MOS 2025-DRA-009',NULL,false,
 '2024-11-12','2025-04-22','2025-04-22','2030-04-22',
 'FAA Regional Airports Division approved retention of the existing alignment subject to the RPZ mitigations.',
 'Maintain controlled access and signage; reassess at the next Airport Layout Plan update; revalidate at the annual inspection.',
 '2026-04-20','2027-04-20',NULL,NULL,false,false,
 'Tracked in Airports GIS; alternatives analysis on file.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
 '2026-04-21T13:00:00+00','2026-04-21T13:00:00+00'),
-- M7: deviation notified - temporary lighting outage exceeding standard
('a1b2c3d4-1007-4c07-9c07-000000000007'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'deviation','Emergency Deviation - temporary PAPI outage on Runway 01','notified',
 '14 CFR 139.311 (marking, signs, and lighting) - emergency deviation under 14 CFR 139.113',
 'Visual approach slope indicator (PAPI) for Runway 01 is required to be operational per the Airport Certification Manual.',
 'Temporary deviation while the Runway 01 PAPI is out of service pending a replacement component, with a NOTAM in effect.',
 'A power-supply component failure took the PAPI out of service; the deviation is limited to the repair period.',
 NULL,
 'A NOTAM was issued for the PAPI outage and daytime visual-approach procedures remain available; night operations are advised via NOTAM.',
 NULL,NULL,NULL,
 NULL,NULL,false,
 NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,
 '2026-07-08','2026-07-09',true,false,
 'Regional Airports Division Manager notification submitted; written notice in progress. Replacement component on order.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-07-09T08:30:00+00','2026-07-09T08:30:00+00'),
-- M8: MOS notification_pending - declared distances documentation
('a1b2c3d4-1008-4c08-9c08-000000000008'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Declared distances documentation update','notification_pending',
 'AC 150/5300-13B, Appendix G - Declared Distances',
 'Declared distances documentation requires an update to reflect a re-surveyed displaced threshold on Runway 19.',
 'Update the published declared distances to match the re-surveyed geometry.',
 'A recent survey refined the displaced threshold location; the declared distances package must be updated and coordinated.',
 NULL,
 'No change to available runway length for landing; the update improves documentation accuracy.',
 'Design','Declared Distances','regional',
 'AGIS MOS 2026-DRA-014',NULL,false,
 '2026-06-30',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,false,
 'Package prepared; FAA notification pending.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-07-01T15:00:00+00','2026-07-01T15:00:00+00'),
-- M9: MOS closed (superseded) - perimeter service road within RSA
('a1b2c3d4-1009-4c09-9c09-000000000009'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'mos','MOS - Perimeter service road within RSA graded area (superseded)','closed',
 'AC 150/5300-13B, Table 3-5 - Runway Safety Area (RSA)',
 'A perimeter service road segment previously encroached on the Runway 19 RSA graded area.',
 'Prior modification accepting the encroachment pending a long-term RSA solution.',
 'Interim relief while the RSA improvement approach was studied.',
 NULL,
 'The prior interim measures maintained an acceptable level of safety until superseded.',
 'Design','Runway Safety Area','regional',
 'AGIS MOS 2022-DRA-003',NULL,false,
 '2022-05-01','2022-09-15','2022-09-15','2025-09-15',
 'Superseded by the RSA declared-distances modification; this record is closed.',
 'None; superseded.',
 '2025-08-01',NULL,NULL,NULL,false,false,
 'Superseded by AGIS MOS 2025-DRA-021; retained for history.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 '2026-02-10T10:00:00+00','2026-02-10T10:00:00+00')
ON CONFLICT DO NOTHING;

-- 6b. mods_exemption_reviews  (4; retain/resubmit/terminate; Marcus/Anthony)
INSERT INTO mods_exemption_reviews
  (id, base_id, record_id, review_date, reviewed_by,
   justification_still_valid, recommendation, notes, created_at)
VALUES
('b1c2d3e4-1001-4b01-9b01-000000000001'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1001-4c01-9c01-000000000001'::uuid,'2026-06-15','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 true,'retain','Annual currency review: the runway safety area declared-distances modification and its mitigations remain valid; no change in conditions.',
 '2026-06-15T14:30:00+00'),
('b1c2d3e4-1002-4b02-9b02-000000000002'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1006-4c06-9c06-000000000006'::uuid,'2026-04-20','4f8ab1a5-c662-a906-7ae3-2730db18551f'::uuid,
 true,'retain','Annual review: runway protection zone land-use conditions unchanged; access controls and signage in place. Retain.',
 '2026-04-20T15:00:00+00'),
('b1c2d3e4-1003-4b03-9b03-000000000003'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1009-4c09-9c09-000000000009'::uuid,'2025-08-01','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 false,'terminate','Superseded by the runway safety area declared-distances modification; terminate and close this record.',
 '2026-02-10T11:00:00+00'),
('b1c2d3e4-1004-4b04-9b04-000000000004'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1005-4c05-9c05-000000000005'::uuid,'2026-03-01','af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,
 true,'resubmit','Denied petition reviewed; recommend resubmission with additional validated response-time modeling data.',
 '2026-03-01T12:00:00+00')
ON CONFLICT DO NOTHING;

-- 6c. mods_exemption_attachments  (3; decision_letter / srm / petition.
--     Attachment rows only - the underlying files 404 by design.)
INSERT INTO mods_exemption_attachments
  (id, base_id, record_id, file_path, file_name, file_size_bytes,
   mime_type, kind, caption, uploaded_by, created_at)
VALUES
('c1d2e3f4-1001-4d01-9d01-000000000001'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1001-4c01-9c01-000000000001'::uuid,
 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae/mods/2025-DRA-021-decision-letter.pdf',
 'FAA-Regional-MOS-Approval-2025-DRA-021.pdf',512000,'application/pdf',
 'decision_letter','FAA Regional Airports Division modification approval letter.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'2026-06-16T14:10:00+00'),
('c1d2e3f4-1002-4d02-9d02-000000000002'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1001-4c01-9c01-000000000001'::uuid,
 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae/mods/RSA-SRM-panel-report.pdf',
 'SRM-Panel-Report-RSA-Declared-Distances.pdf',890000,'application/pdf',
 'srm','Safety risk management panel report supporting the modification.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'2026-06-16T14:12:00+00'),
('c1d2e3f4-1003-4d03-9d03-000000000003'::uuid,'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
 'a1b2c3d4-1005-4c05-9c05-000000000005'::uuid,
 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae/mods/FAA-2025-0412-petition.pdf',
 'Exemption-Petition-FAA-2025-0412.pdf',640000,'application/pdf',
 'petition','Exemption petition as filed to the FAA docket.',
 'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid,'2026-02-20T11:10:00+00')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. read_files  (9 new bulletins/memos/SOPs staff must acknowledge;
--    distinct from the 3 existing. storage_path uses the demo/ prefix
--    like existing rows; files 404 by design.)
-- ---------------------------------------------------------------------
INSERT INTO read_files
  (id, base_id, title, description, storage_path, file_name, mime_type,
   file_size_bytes, version, is_archived, created_by, created_at, updated_at)
SELECT
  md5('kdra-read_files-'||t.ord)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  t.title, t.descr,
  'demo/' || t.fname, t.fname, 'application/pdf', t.sz, 1, false,
  'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'::uuid, t.cat, t.cat
FROM unnest(
  ARRAY[
    'Runway Incursion Prevention Bulletin',
    'FOD Awareness Memo',
    'Wildlife Strike Reporting Procedure',
    'Fuel Spill Response Quick Reference',
    'NOTAM Origination Cheat Sheet',
    'Movement Area Radio Phraseology Guide',
    'Construction Area Access Notice',
    'Low-Visibility Operations Bulletin',
    'Self-Inspection Checklist Update Notice'
  ]::text[],
  ARRAY[
    'Guidance on hot spots, hold-short discipline, and radio read-back to prevent runway incursions in the movement area.',
    'FOD Check expectations, common FOD sources on the apron and Runway 01/19, and reporting.',
    'How to document and report wildlife strikes to the FAA National Wildlife Strike Database and internal SMS.',
    'Immediate actions for a fuel spill on the apron or fuel farm - containment, notification, and cleanup.',
    'Quick reference for originating airfield NOTAMs, keywords, and coordination with Flight Service.',
    'Standard radio phraseology for vehicle operations in the movement area and hold-short instructions.',
    'Access, escort, and marking requirements for the active taxiway rehabilitation project area.',
    'Activation criteria and movement-area controls when visibility drops below the low-visibility threshold.',
    'Summary of changes to the daily self-inspection checklist effective this quarter.'
  ]::text[],
  ARRAY['runway-incursion-prevention-bulletin.pdf','fod-awareness-memo.pdf','wildlife-strike-reporting.pdf','fuel-spill-response.pdf','notam-origination-cheat-sheet.pdf','radio-phraseology-guide.pdf','construction-area-access-notice.pdf','low-visibility-operations-bulletin.pdf','self-inspection-checklist-update.pdf']::text[],
  ARRAY[210000,165000,240000,195000,150000,175000,205000,185000,160000]::bigint[],
  ARRAY['2026-02-14T12:00:00+00','2026-03-03T12:00:00+00','2026-03-20T12:00:00+00','2026-04-08T12:00:00+00','2026-04-25T12:00:00+00','2026-05-12T12:00:00+00','2026-05-28T12:00:00+00','2026-06-15T12:00:00+00','2026-07-02T12:00:00+00']::timestamptz[]
) WITH ORDINALITY AS t(title, descr, fname, sz, cat, ord)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 8. read_file_acknowledgments  (~76; 12 files [3 existing + 9 new] x
--    9 staff, ~30% left un-acked so the read/ack tracking looks active,
--    not 100%. acknowledged_at is after each file was posted and inside
--    the window.)
-- ---------------------------------------------------------------------
INSERT INTO read_file_acknowledgments
  (id, base_id, read_file_id, user_id, acknowledged_version,
   initials_snapshot, acknowledged_at)
SELECT
  md5('kdra-rfa-'||f.fi||'-'||s.si)::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  f.fid, s.sid, 1, s.oi,
  LEAST('2026-07-22T18:00:00+00'::timestamptz,
        f.fcreated + (((f.fi*2 + s.si) % 22) + 1)::int * interval '1 day')
FROM unnest(
  ARRAY[
    '10ee45fb-f4a2-4fb9-9f64-14d38b71e272'::uuid,
    '157e5ce9-d4a2-4c23-901a-27e46f1b5a9c'::uuid,
    '5cf1f134-40b5-4dfa-867b-692bfaa09972'::uuid,
    md5('kdra-read_files-1')::uuid, md5('kdra-read_files-2')::uuid,
    md5('kdra-read_files-3')::uuid, md5('kdra-read_files-4')::uuid,
    md5('kdra-read_files-5')::uuid, md5('kdra-read_files-6')::uuid,
    md5('kdra-read_files-7')::uuid, md5('kdra-read_files-8')::uuid,
    md5('kdra-read_files-9')::uuid
  ]::uuid[],
  ARRAY[
    '2026-07-06T02:36:38+00','2026-07-06T02:36:38+00','2026-07-06T02:36:38+00',
    '2026-02-14T12:00:00+00','2026-03-03T12:00:00+00','2026-03-20T12:00:00+00',
    '2026-04-08T12:00:00+00','2026-04-25T12:00:00+00','2026-05-12T12:00:00+00',
    '2026-05-28T12:00:00+00','2026-06-15T12:00:00+00','2026-07-02T12:00:00+00'
  ]::timestamptz[]
) WITH ORDINALITY AS f(fid, fcreated, fi)
CROSS JOIN unnest(
  ARRAY['af9a39db-76fd-4bcc-8d50-7afbc292eaf6','af5eed97-5425-d64b-358f-8c1b0e8050af','4f8ab1a5-c662-a906-7ae3-2730db18551f','44cc521d-5850-0faa-8f92-c030a19fce37','00b4cdd3-cbf0-0269-a366-3514870b0474','57a1c585-209a-5012-9983-ff95142a9ff0','d3666d88-527f-b006-2afe-96b9573674e2','f7403a05-ae4d-a9e2-29e2-5327e6e5c6fd','10bd2c31-e693-c4d5-2455-d3af3506d106']::uuid[],
  ARRAY['MD','KW','AR','DP','BO','OB','SL','JH','RC']::text[]
) WITH ORDINALITY AS s(sid, oi, si)
WHERE ((f.fi*7 + s.si*5) % 10) < 7
ON CONFLICT DO NOTHING;

COMMIT;
