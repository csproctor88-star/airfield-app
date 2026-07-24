-- =====================================================================
-- Cluster I — Shift Checklist demo history for KDRA (Demo Regional Airport)
-- base_id ea2b542e-72cc-4300-9037-bfe18c0bf7ae
--
-- Structure learned from schema + migrations:
--   * shift_checklists has UNIQUE (base_id, checklist_date) -> exactly ONE
--     instance per calendar day (daily 0600L reset). The shift concept lives
--     on the ITEMS (day/mid/swing), not the instance. All 7 KDRA template
--     items are shift='day', frequency='daily', is_active=true, so one
--     checklist per day covers every item.
--   * status enum (CHECK): 'in_progress' | 'completed'.
--   * shift_checklist_responses UNIQUE (checklist_id, item_id); is_na col
--     added by migration 2026040500 (NOT NULL default false).
--
-- Seeds:
--   1) One shift_checklists row per day 2026-05-16..2026-07-23 (~69 days,
--      minus the 8 pre-existing dates), mostly 'completed', 2026-07-21 left
--      in_progress (today 2026-07-23 already exists as in_progress).
--   2) One shift_checklist_responses row per (checklist, item) for the 7 real
--      template items, for EVERY KDRA checklist (the ~61 seeded ones AND the
--      8 pre-existing checklists, which currently have zero responses -- so a
--      completed checklist reads 7/7 instead of 0/7). Purely additive INSERTs.
--
-- INSERT-only. No existing row is updated or deleted. Re-apply safe:
--   * checklists skip any date already present (WHERE NOT EXISTS) + ON CONFLICT (id)
--   * responses ON CONFLICT (checklist_id, item_id) DO NOTHING
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Daily checklist instances
--    Author (completed_by) rotates one-per-day across the 3 Ops Specialists
--    + Anthony (supervisor) + Marcus (manager). created_at = 0615Z (just
--    after the 0600L reset), completed_at = 2100Z (end-of-day close-out).
-- ---------------------------------------------------------------------
INSERT INTO shift_checklists
  (id, base_id, checklist_date, status, completed_by, completed_at, created_at, updated_at)
SELECT
  md5('kdra-shift_checklists-' || g.d::date) ::uuid,
  'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid,
  g.d::date,
  CASE WHEN g.d::date = DATE '2026-07-21' THEN 'in_progress' ELSE 'completed' END,
  CASE WHEN g.d::date = DATE '2026-07-21' THEN NULL
       ELSE (ARRAY[
         '44cc521d-5850-0faa-8f92-c030a19fce37',  -- Danielle Pearce (Ops Specialist)
         '00b4cdd3-cbf0-0269-a366-3514870b0474',  -- Brian Okafor    (Ops Specialist)
         '57a1c585-209a-5012-9983-ff95142a9ff0',  -- Olivia Brenner  (Ops Specialist)
         '4f8ab1a5-c662-a906-7ae3-2730db18551f',  -- Anthony Ruiz    (Ops Supervisor)
         'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'   -- Marcus Delgado  (Airport Ops Manager)
       ]::uuid[])[1 + ((g.d::date - DATE '2026-01-01') % 5)]
  END,
  CASE WHEN g.d::date = DATE '2026-07-21' THEN NULL
       ELSE (g.d::date + interval '21 hours') AT TIME ZONE 'UTC'
  END,
  (g.d::date + interval '6 hours 15 minutes') AT TIME ZONE 'UTC',
  CASE WHEN g.d::date = DATE '2026-07-21'
         THEN (g.d::date + interval '6 hours 15 minutes') AT TIME ZONE 'UTC'
       ELSE (g.d::date + interval '21 hours') AT TIME ZONE 'UTC'
  END
FROM generate_series('2026-05-16'::timestamp, '2026-07-23'::timestamp, interval '1 day') AS g(d)
WHERE NOT EXISTS (
  SELECT 1 FROM shift_checklists e
  WHERE e.base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid
    AND e.checklist_date = g.d::date
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2) Per-item responses (7 real template items) for every KDRA checklist
--    Rules:
--      * completed checklist  -> all 7 items actioned.
--      * in_progress checklist -> trailing items left pending (item 7, or
--        items 6+7) so it reads as genuinely in progress.
--      * Mostly completed=true; a sparse, item-appropriate few is_na=true
--        (no scheduled arrivals -> PPR item N/A; occasional lighting item N/A).
--      * completed_by = the same person who worked that day's checklist.
--      * completed_at staggered a few minutes after the checklist's created_at.
--      * a realistic scattering of operational notes.
-- ---------------------------------------------------------------------
WITH items(item_id, sort_order) AS (
  VALUES
    ('80fb6e7b-840a-4db4-b7c8-4641b28bf454'::uuid, 1),  -- Review overnight NOTAMs and current field conditions
    ('2146b01f-32f1-41af-842d-11b51ef5c07e'::uuid, 2),  -- Verify NAVAID and runway/taxiway lighting status
    ('5175394b-93c8-4416-9e6e-5ee77ad9cc96'::uuid, 3),  -- Confirm the day's lighting inspections are logged
    ('6d3b3356-da05-424f-8735-906bdccf5d4c'::uuid, 4),  -- Check active PPRs and expected arrivals
    ('bd81fbfe-355f-4dba-b3fb-1424fa32fe66'::uuid, 5),  -- Review open discrepancies and work orders
    ('09d83e1b-c940-42a5-8578-31634a4e48f6'::uuid, 6),  -- Confirm wildlife activity has been reviewed
    ('5ced8683-d9a4-4955-bf82-44ecc15aed05'::uuid, 7)   -- Brief the oncoming shift on outstanding items
),
cl AS (
  SELECT
    sc.id,
    sc.status,
    sc.created_at,
    (sc.checklist_date - DATE '2026-01-01') AS dn
  FROM shift_checklists sc
  WHERE sc.base_id = 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae'::uuid
),
resp AS (
  SELECT
    cl.id                          AS checklist_id,
    it.item_id,
    it.sort_order,
    cl.created_at,
    cl.dn,
    -- actioned: completed checklists action every item; in_progress ones
    -- leave the last item (or last two) pending.
    CASE
      WHEN cl.status = 'completed' THEN true
      WHEN (cl.dn % 2) = 0         THEN (it.sort_order <= 6)
      ELSE                             (it.sort_order <= 5)
    END AS actioned,
    -- is_na candidate (only ever true on always-actioned items 3 & 4)
    CASE
      WHEN it.sort_order = 4 AND (cl.dn % 6) = 0  THEN true
      WHEN it.sort_order = 3 AND (cl.dn % 13) = 0 THEN true
      ELSE false
    END AS is_na_raw,
    (ARRAY[
      '44cc521d-5850-0faa-8f92-c030a19fce37',
      '00b4cdd3-cbf0-0269-a366-3514870b0474',
      '57a1c585-209a-5012-9983-ff95142a9ff0',
      '4f8ab1a5-c662-a906-7ae3-2730db18551f',
      'af9a39db-76fd-4bcc-8d50-7afbc292eaf6'
    ]::uuid[])[1 + (cl.dn % 5)] AS author
  FROM cl CROSS JOIN items it
)
INSERT INTO shift_checklist_responses
  (id, checklist_id, item_id, completed, is_na, completed_by, completed_at, notes, created_at, updated_at)
SELECT
  md5('kdra-scr-' || checklist_id::text || '-' || item_id::text) ::uuid,
  checklist_id,
  item_id,
  (actioned AND NOT is_na_raw)                                        AS completed,
  (actioned AND is_na_raw)                                            AS is_na,
  CASE WHEN actioned THEN author ELSE NULL END                       AS completed_by,
  CASE WHEN actioned THEN created_at + (sort_order * interval '3 minutes') ELSE NULL END AS completed_at,
  CASE
    WHEN actioned AND NOT is_na_raw AND sort_order = 1 AND (dn % 9) = 0
      THEN 'Reviewed overnight NOTAMs and current field conditions - no operational impact to movement areas.'
    WHEN actioned AND NOT is_na_raw AND sort_order = 5 AND (dn % 7) = 0
      THEN 'Open discrepancies carried over; taxiway edge light replacement remains on the work order.'
    WHEN actioned AND NOT is_na_raw AND sort_order = 6 AND (dn % 11) = 0
      THEN 'Wildlife log reviewed - deer activity near the RWY 19 threshold earlier; dispersal completed, no strike.'
    WHEN actioned AND is_na_raw AND sort_order = 4
      THEN 'No prior-permission arrivals scheduled for the period.'
    ELSE NULL
  END                                                                AS notes,
  created_at                                                         AS created_at,
  CASE WHEN actioned THEN created_at + (sort_order * interval '3 minutes') ELSE created_at END AS updated_at
FROM resp
ON CONFLICT (checklist_id, item_id) DO NOTHING;

COMMIT;
