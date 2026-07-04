-- Staging for KDRA (Demo Regional Airport) civilian marketing captures,
-- Phase 3 batch (2026-07-04). The tenant had zero discrepancies, so the
-- work-orders page framed an empty list. Three open, civilian-flavor
-- items — deliberately consistent with the SMS hazard register's
-- existing stories (clustered centerline outages near TWY A, apron
-- transverse cracking, plus a faded hold-position marking).
-- Values verified against production usage: status open, severities
-- low/medium, types lighting/pavement/markings, current_status keys
-- from lib/constants.ts. Idempotent via display_id.
DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;

  INSERT INTO discrepancies
    (base_id, display_id, type, severity, status, current_status, title,
     description, location_text, assigned_shop, photo_count, created_at, updated_at)
  SELECT kdra, v.did, v.typ, v.sev, 'open', v.cur, v.title, v.descr, v.loc, v.shop, 0,
         now() - v.age, now() - v.age
  FROM (VALUES
    ('D-2026-CQ1A', 'lighting', 'medium', 'awaiting_action_by_ces',
     'Taxiway A centerline lights out near RWY 01 intersection',
     'Four to six adjacent centerline fixtures dark across inspection cycles; pattern suggests buried cable damage rather than individual lamps.',
     'TWY A / RWY 01 intersection', 'Electrical', interval '2 days'),
    ('D-2026-CQ2B', 'pavement', 'low', 'submitted_to_ces',
     'Transverse cracking, north apron tie-down rows',
     'Three transverse cracks wider than 1/2 inch along the tie-down rows; monitoring for FOD as freeze-thaw cycles continue.',
     'North apron', 'Airfield Maintenance', interval '6 days'),
    ('D-2026-CQ3C', 'markings', 'medium', 'submitted_to_afm',
     'Hold-position marking faded, TWY B at RWY 01/19',
     'Surface marking below conspicuity standards on the TWY B hold position; repaint required.',
     'TWY B hold position', 'Airfield Maintenance', interval '9 days')
  ) AS v(did, typ, sev, cur, title, descr, loc, shop, age)
  WHERE NOT EXISTS (SELECT 1 FROM discrepancies WHERE base_id = kdra AND display_id = v.did);

  RAISE NOTICE 'KDRA discrepancies staged';
END $$;
