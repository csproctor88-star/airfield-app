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
