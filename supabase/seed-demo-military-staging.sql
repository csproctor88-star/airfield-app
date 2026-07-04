-- Staging pass for KDMO (Demo AFB) ahead of the Phase 3 module-page
-- captures (owner-ordered 2026-07-03).
--
-- The lived-in demo tenant carried attributable data the claims guardrail
-- forbids in a marketing frame: the owner's real name + real phone numbers
-- in the PPR log, Selfridge's real wing designation (127th) in waiver
-- proponents, real construction companies (AECOM / Turner / Skanska /
-- Hensel Phelps / Kiewit) in Personnel on Airfield, plus leftover junk
-- "Test" rows. This pass fictionalizes all of it and deletes the junk.
--
-- Idempotent: updates are keyed on current values (no-op once applied);
-- the PPR rewrites are deterministic (same names/numbers every run).

DO $$
DECLARE
  kdmo uuid;
  col RECORD;
BEGIN
  SELECT id INTO kdmo FROM bases WHERE icao = 'KDMO';
  IF kdmo IS NULL THEN
    RAISE EXCEPTION 'KDMO (Demo AFB) not found';
  END IF;

  -- ── 1. Waivers: strip the real wing designation + real company ──
  UPDATE waivers SET proponent = 'Airfield Management / Civil Engineer'
    WHERE base_id = kdmo AND proponent = '127th OSS / Civil Engineer';
  UPDATE waivers SET proponent = 'Wing Plans / Civil Engineer Squadron'
    WHERE base_id = kdmo AND proponent = 'Wing Plans / 127th CES';
  UPDATE waivers SET proponent = 'Civil Engineer Squadron / Contractor'
    WHERE base_id = kdmo AND proponent = '127th CES / Contractor Hensel Phelps';
  DELETE FROM waivers
    WHERE base_id = kdmo AND description = 'Test' AND proponent IS NULL;

  -- ── 2. Personnel on Airfield: fictional companies; junk rows out ──
  UPDATE airfield_contractors SET company_name = 'Meridian Civil Group'
    WHERE base_id = kdmo AND company_name = 'AECOM';
  UPDATE airfield_contractors SET company_name = 'Northline Paving LLC'
    WHERE base_id = kdmo AND company_name = 'Turner Construction';
  UPDATE airfield_contractors SET company_name = 'Great Lakes Electrical Contractors'
    WHERE base_id = kdmo AND company_name = 'Skanska';
  UPDATE airfield_contractors SET company_name = 'Lakeshore Site Services'
    WHERE base_id = kdmo AND company_name = 'Hensel Phelps';
  UPDATE airfield_contractors SET company_name = 'Blue Water Fence & Barrier'
    WHERE base_id = kdmo AND company_name = 'Kiewit Infrastructure';
  UPDATE airfield_contractors SET company_name = 'Huron Airfield Services'
    WHERE base_id = kdmo AND company_name = 'CES' AND location <> 'Test';
  DELETE FROM airfield_contractors WHERE base_id = kdmo AND location = 'Test';

  -- ── 3. PPR log: fictional requesters, no real phones or emails ──
  -- Deterministic pool keyed to row order, so re-runs are stable and the
  -- log shows varied, plausible names ("Mickey Mouse" and the owner's
  -- real name both go away).
  WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM ppr_entries WHERE base_id = kdmo
  )
  UPDATE ppr_entries p
  SET requester_name = (ARRAY[
      'R. Alvarez','K. Osborne','J. Whitfield','M. Tanaka','D. Kowalski',
      'S. Bennett','A. Fitzgerald','L. Moreau','C. Ridley','P. Okafor',
      'H. Lindqvist','T. Carver'
    ])[(n.rn - 1) % 12 + 1]
  FROM numbered n
  WHERE p.id = n.id AND p.requester_name IS NOT NULL;

  UPDATE ppr_entries SET requester_email = NULL
    WHERE base_id = kdmo AND requester_email IS NOT NULL;

  -- Every phone-typed custom column → reserved fictional 555-01xx numbers.
  FOR col IN
    SELECT id FROM ppr_columns WHERE base_id = kdmo AND column_type = 'phone'
  LOOP
    WITH numbered AS (
      SELECT id, row_number() OVER (ORDER BY created_at) AS rn
      FROM ppr_entries
      WHERE base_id = kdmo AND column_values ? col.id::text
    )
    UPDATE ppr_entries p
    SET column_values = jsonb_set(
          p.column_values, ARRAY[col.id::text],
          to_jsonb('(586) 555-01' || lpad(((n.rn % 90) + 10)::text, 2, '0')))
    FROM numbered n
    WHERE p.id = n.id;
  END LOOP;

  -- Free-text "Point of Contact Name" values could carry real names —
  -- drop the key; the log renders the cell blank.
  FOR col IN
    SELECT id FROM ppr_columns
    WHERE base_id = kdmo AND column_name ILIKE 'point of contact name%'
  LOOP
    UPDATE ppr_entries
    SET column_values = column_values - col.id::text
    WHERE base_id = kdmo AND column_values ? col.id::text;
  END LOOP;

  RAISE NOTICE 'KDMO staging pass applied';
END $$;

-- ── 4. Contractor contact names (added after the 2026-07-03 Task-4 review) ──
-- The first pass fictionalized companies but kept full contact names
-- ("Sarah Johnson" et al) — still name-shaped data in marketing frames.
-- Same initial+surname pool convention as the PPR requester scrub.
DO $$
DECLARE
  kdmo uuid;
BEGIN
  SELECT id INTO kdmo FROM bases WHERE icao = 'KDMO';
  IF kdmo IS NULL THEN RAISE EXCEPTION 'KDMO not found'; END IF;

  WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at) AS rn
    FROM airfield_contractors
    WHERE base_id = kdmo AND contact_name IS NOT NULL
  )
  UPDATE airfield_contractors c
  SET contact_name = (ARRAY[
      'M. Reyes','T. Callahan','J. Okonkwo','L. Hartman','D. Vasquez','K. Sorensen'
    ])[(n.rn - 1) % 6 + 1]
  FROM numbered n WHERE c.id = n.id;

  RAISE NOTICE 'KDMO contractor contact names fictionalized';
END $$;

-- ── 5. AMTR roster names + daily-review signers (Task-5 review, 2026-07-03) ──
-- The AMTR roster carried real full names ("Proctor, Christopher" et al)
-- and the daily-review sign-offs resolve through the owner's real profile
-- (surname + operating initials in frame). Roster names move to the
-- fictional pool in the module's own "Last, F." style; review signatures
-- re-point to the demo persona's profile.
DO $$
DECLARE
  kdmo uuid;
  demo_uid uuid;
BEGIN
  SELECT id INTO kdmo FROM bases WHERE icao = 'KDMO';
  IF kdmo IS NULL THEN RAISE EXCEPTION 'KDMO not found'; END IF;
  SELECT id INTO demo_uid FROM profiles WHERE email = 'demo@glidepathops.com';

  WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM amtr_members WHERE base_id = kdmo
  )
  UPDATE amtr_members m
  SET full_name = (ARRAY[
      'Hartman, L.','Reyes, M.','Callahan, T.','Okonkwo, J.','Sorensen, K.',
      'Vasquez, D.','Lindqvist, H.','Whitfield, J.'
    ])[(n.rn - 1) % 8 + 1]
  FROM numbered n WHERE m.id = n.id;

  UPDATE daily_reviews SET
    day_amsl_signed_by   = CASE WHEN day_amsl_signed_by   IS NOT NULL THEN demo_uid ELSE NULL END,
    swing_amsl_signed_by = CASE WHEN swing_amsl_signed_by IS NOT NULL THEN demo_uid ELSE NULL END,
    mid_amsl_signed_by   = CASE WHEN mid_amsl_signed_by   IS NOT NULL THEN demo_uid ELSE NULL END,
    namo_signed_by       = CASE WHEN namo_signed_by       IS NOT NULL THEN demo_uid ELSE NULL END,
    afm_signed_by        = CASE WHEN afm_signed_by        IS NOT NULL THEN demo_uid ELSE NULL END
  WHERE base_id = kdmo;

  RAISE NOTICE 'KDMO AMTR roster + daily-review signers fictionalized';
END $$;

-- ── 6. Future-dated PPR entries (Task-6 capture, 2026-07-03) ──
-- The PPR Log view defaults to today-forward; every staged entry was
-- past-dated, so the marketing still framed an empty log. Clone three
-- approved entries onto upcoming dates (idempotent via ppr_number).
DO $$
DECLARE
  kdmo uuid;
BEGIN
  SELECT id INTO kdmo FROM bases WHERE icao = 'KDMO';
  IF kdmo IS NULL THEN RAISE EXCEPTION 'KDMO not found'; END IF;

  INSERT INTO ppr_entries
    (base_id, ppr_number, arrival_date, column_values, notes, status,
     requester_name, public_submission, created_at, updated_at)
  SELECT kdmo, v.num, v.d, s.column_values, NULL, s.status,
         v.who, s.public_submission, now(), now()
  FROM (SELECT * FROM ppr_entries
        WHERE base_id = kdmo AND status = 'approved'
        ORDER BY created_at DESC LIMIT 1) s
  CROSS JOIN (VALUES
      ('186-001-TD', CURRENT_DATE + 1, 'K. Osborne'),
      ('188-001-TD', CURRENT_DATE + 3, 'M. Tanaka'),
      ('192-001-TD', CURRENT_DATE + 7, 'L. Moreau')
    ) AS v(num, d, who)
  WHERE NOT EXISTS (SELECT 1 FROM ppr_entries WHERE base_id = kdmo AND ppr_number = v.num);

  RAISE NOTICE 'KDMO future-dated PPR entries staged';
END $$;
