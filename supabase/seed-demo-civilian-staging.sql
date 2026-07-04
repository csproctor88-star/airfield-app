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

-- ── 2. GPS coordinates for the staged discrepancies ──
-- Without coordinates the /discrepancies map renders a full-frame
-- "No GPS Coordinates" overlay and the list sits below the fold.
-- Fictional points inside the demo tenant's map area (same area the
-- wildlife sightings already use).
DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;

  UPDATE discrepancies SET latitude = v.lat, longitude = v.lng
  FROM (VALUES
    ('D-2026-CQ1A', 42.6105, -82.8420),
    ('D-2026-CQ2B', 42.6150, -82.8365),
    ('D-2026-CQ3C', 42.6118, -82.8402)
  ) AS v(did, lat, lng)
  WHERE discrepancies.base_id = kdra
    AND discrepancies.display_id = v.did
    AND discrepancies.latitude IS NULL;

  RAISE NOTICE 'KDRA discrepancy coordinates staged';
END $$;

-- ── 3. Stage the demo user's KDRA dashboard board ──
-- Both KDRA boards were EMPTY (lg: []); the four widgets seen on screen
-- were the app's runtime starter fallback for an empty board, which any
-- saved widget suppresses. So this writes the demo user's default board
-- (resolved via dashboard_user_defaults — NOT by name; the owner has a
-- same-named board this must never touch) with the complete layout:
-- the starter four (geometry copied from KDMO's stored working board)
-- plus three status boards. Deterministic full replace = idempotent.
DO $$
DECLARE
  kdra uuid;
  demo_board uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;

  SELECT dud.board_id INTO demo_board
  FROM dashboard_user_defaults dud
  JOIN profiles p ON p.id = dud.user_id
  WHERE dud.base_id = kdra AND p.email = 'demo@glidepathops.com';
  IF demo_board IS NULL THEN RAISE EXCEPTION 'demo user default board not found'; END IF;

  UPDATE dashboard_boards
  SET layout = jsonb_build_object('gridScale', 2, 'lg', '[
    {"h": 4,  "i": "w-insp",      "w": 4,  "x": 0,  "y": 0, "type": "inspection-status",  "config": {}},
    {"h": 6,  "i": "w-disc",      "w": 10, "x": 6,  "y": 0, "type": "open-discrepancies", "config": {}},
    {"h": 2,  "i": "w-last",      "w": 8,  "x": 16, "y": 0, "type": "last-check",         "config": {}},
    {"h": 4,  "i": "w-shift",     "w": 8,  "x": 16, "y": 2, "type": "shift-checklist",    "config": {}},
    {"h": 10, "i": "w-sb-navaid", "w": 8,  "x": 0,  "y": 6, "type": "status-board", "config": {"kind": "navaid"}},
    {"h": 5,  "i": "w-sb-runway", "w": 8,  "x": 8,  "y": 6, "type": "status-board", "config": {"kind": "runway"}},
    {"h": 5,  "i": "w-sb-arff",   "w": 8,  "x": 16, "y": 6, "type": "status-board", "config": {"kind": "arff"}}
  ]'::jsonb)
  WHERE id = demo_board;

  RAISE NOTICE 'KDRA demo dashboard board staged';
END $$;

-- ── 4. KDRA PPR log entries (Task 8 capture) ──
-- The PPR Log view defaults to today-forward and KDRA had zero entries.
-- Three approved, future-dated, fully fictional requests (pooled names,
-- 555-01xx phones, no emails). Guarded on the tenant having no PPRs at
-- all, so a re-run never duplicates and never touches owner-added rows.
DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM ppr_entries WHERE base_id = kdra) THEN
    INSERT INTO ppr_entries
      (base_id, ppr_number, arrival_date, column_values, status, approver_oi,
       requester_name, requester_phone, public_submission, created_at, updated_at)
    SELECT kdra, to_char(v.d, 'DDD') || '-001-TD', v.d, '{}'::jsonb, 'approved', 'TD',
           v.who, v.phone, false, now(), now()
    FROM (VALUES
        (CURRENT_DATE + 1, 'K. Osborne', '(586) 555-0142'),
        (CURRENT_DATE + 2, 'R. Alvarez', '(586) 555-0117'),
        (CURRENT_DATE + 5, 'H. Lindqvist', '(586) 555-0163')
      ) AS v(d, who, phone);
    RAISE NOTICE 'KDRA PPR entries staged';
  END IF;
END $$;

-- ── 5. KDRA Personnel on Airfield (Task 8 capture) ──
-- Zero contractor rows on the tenant. Three fictional civilian-flavor
-- work parties; AF Form 483 fields stay NULL (military-only). Guarded
-- like block 4.
DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM airfield_contractors WHERE base_id = kdra) THEN
    INSERT INTO airfield_contractors
      (base_id, company_name, contact_name, contact_phone, location,
       work_description, status, start_date, end_date, callsign, created_at, updated_at)
    VALUES
      (kdra, 'Lakeview Paving Co.', 'M. Reyes', '(586) 555-0126', 'North apron',
       'Crack sealing and transverse joint repair, tie-down rows', 'active',
       CURRENT_DATE - 4, NULL, 'OPS 4', now(), now()),
      (kdra, 'TruNorth Electric', 'K. Sorensen', '(586) 555-0158', 'TWY B',
       'Taxiway edge light circuit troubleshooting and fixture replacement', 'active',
       CURRENT_DATE - 1, NULL, NULL, now(), now()),
      (kdra, 'Shoreline Grounds Services', 'J. Okonkwo', '(586) 555-0171', 'Infield — east',
       'Seasonal mowing and drainage swale clearing', 'completed',
       CURRENT_DATE - 21, CURRENT_DATE - 3, NULL, now(), now());
    RAISE NOTICE 'KDRA contractors staged';
  END IF;
END $$;

-- ── 6. KDRA §139.303 training completions for the demo persona ──
-- The tenant had records on one topic only; the compliance matrix framed
-- nearly empty. Completions for the demo user across eight of the global
-- default curriculum topics (base_id IS NULL catalog), staggered so some
-- currencies run toward their 12-month expiry. Idempotent per topic.
DO $$
DECLARE
  kdra uuid;
  demo_uid uuid;
  r RECORD;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN RAISE EXCEPTION 'KDRA not found'; END IF;
  SELECT id INTO demo_uid FROM profiles WHERE email = 'demo@glidepathops.com';
  IF demo_uid IS NULL THEN RAISE EXCEPTION 'demo profile not found'; END IF;

  FOR r IN
    SELECT t.id AS topic_id, v.months_ago, v.ttype
    FROM (VALUES
        ('139.303(e)(2)',  2::int, 'recurrent'),
        ('139.303(e)(3)',  9,      'recurrent'),
        ('139.303(e)(5)',  1,      'initial'),
        ('139.303(e)(6)',  4,      'recurrent'),
        ('139.303(e)(8)',  3,      'initial'),
        ('139.303(e)(9)',  7,      'recurrent'),
        ('139.303(e)(10)', 5,      'recurrent'),
        ('139.303(e)(12)', 10,     'recurrent')
      ) AS v(code, months_ago, ttype)
    JOIN training_topics t ON t.base_id IS NULL AND t.code = v.code
  LOOP
    IF NOT EXISTS (SELECT 1 FROM training_records
                   WHERE base_id = kdra AND user_id = demo_uid AND topic_id = r.topic_id) THEN
      INSERT INTO training_records
        (base_id, user_id, topic_id, completed_at, training_type,
         instructor_name_external, expires_at, created_at, updated_at)
      VALUES
        (kdra, demo_uid, r.topic_id,
         now() - (r.months_ago || ' months')::interval, r.ttype,
         'L. Hartman',
         now() - (r.months_ago || ' months')::interval + interval '12 months',
         now(), now());
    END IF;
  END LOOP;

  RAISE NOTICE 'KDRA training completions staged';
END $$;
