-- Part 139 fiction polish for KDRA (Demo Regional Airport), owner-ordered
-- 2026-07-03: the Selfridge clone left military artifacts on the civilian
-- demo tenant that read wrong to the airport-operations audience.
--
--   * base_navaids carried "32 ILS" (the field has no runway 32) and
--     "TACAN" (military avionics) — both deleted, with the green
--     navaid_statuses rows seeded for them on 2026-07-03.
--   * The ARFF status card planned against "A-10" / "K35R" — renamed to
--     actual civilian regional types (CRJ-900 / E-175).
--
-- Idempotent: deletes and value-keyed renames no-op once applied.
-- Reshoot `civ-status` after applying (the status still frames both cards).

DO $$
DECLARE
  kdra uuid;
BEGIN
  SELECT id INTO kdra FROM bases WHERE icao = 'KDRA';
  IF kdra IS NULL THEN
    RAISE EXCEPTION 'KDRA (Demo Regional Airport) not found';
  END IF;

  DELETE FROM navaid_statuses
    WHERE base_id = kdra AND navaid_name IN ('32 ILS', 'TACAN');
  DELETE FROM base_navaids
    WHERE base_id = kdra AND navaid_name IN ('32 ILS', 'TACAN');

  UPDATE base_arff_aircraft SET aircraft_name = 'CRJ-900'
    WHERE base_id = kdra AND aircraft_name = 'A-10';
  UPDATE base_arff_aircraft SET aircraft_name = 'E-175'
    WHERE base_id = kdra AND aircraft_name = 'K35R';

  RAISE NOTICE 'KDRA Part 139 polish applied';
END $$;
