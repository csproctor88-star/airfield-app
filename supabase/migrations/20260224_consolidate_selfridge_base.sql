-- Consolidate Selfridge base entries:
-- 1. Rename the canonical seeded base to "Selfridge ANG Base" (matches directory)
-- 2. Merge any duplicate Selfridge entries into the canonical base
-- 3. Reset all users to have only the canonical base

DO $$
DECLARE
  canonical_id UUID := '00000000-0000-0000-0000-000000000001';
  dup RECORD;
BEGIN
  -- 1. Rename the canonical seeded base
  UPDATE bases SET name = 'Selfridge ANG Base' WHERE id = canonical_id;

  -- 2. Find duplicate bases (same ICAO or similar name, different ID)
  FOR dup IN
    SELECT id FROM bases
    WHERE id != canonical_id
    AND (name ILIKE '%Selfridge%' OR icao = 'KMTC')
  LOOP
    -- Move members from duplicate to canonical
    INSERT INTO base_members (base_id, user_id, role)
    SELECT canonical_id, user_id, role FROM base_members WHERE base_id = dup.id
    ON CONFLICT (base_id, user_id) DO NOTHING;

    DELETE FROM base_members WHERE base_id = dup.id;

    -- Reassign operational data
    UPDATE inspections SET base_id = canonical_id WHERE base_id = dup.id;
    UPDATE discrepancies SET base_id = canonical_id WHERE base_id = dup.id;
    UPDATE obstruction_evaluations SET base_id = canonical_id WHERE base_id = dup.id;
    UPDATE airfield_checks SET base_id = canonical_id WHERE base_id = dup.id;
    UPDATE navaid_statuses SET base_id = canonical_id WHERE base_id = dup.id;
    UPDATE activity_log SET base_id = canonical_id WHERE base_id = dup.id;

    -- Update profiles pointing to the duplicate
    UPDATE profiles SET primary_base_id = canonical_id WHERE primary_base_id = dup.id;

    -- Delete the duplicate's child data, then the base itself
    DELETE FROM base_areas WHERE base_id = dup.id;
    DELETE FROM base_navaids WHERE base_id = dup.id;
    DELETE FROM base_runways WHERE base_id = dup.id;
    DELETE FROM bases WHERE id = dup.id;
  END LOOP;

  -- 3. Reset ALL users to the canonical base
  UPDATE profiles SET primary_base_id = canonical_id
  WHERE primary_base_id IS NULL OR primary_base_id != canonical_id;

  -- Ensure every user is a member
  INSERT INTO base_members (base_id, user_id, role)
  SELECT canonical_id, id, COALESCE(role, 'read_only')
  FROM profiles
  WHERE id NOT IN (SELECT user_id FROM base_members WHERE base_id = canonical_id)
  ON CONFLICT (base_id, user_id) DO NOTHING;

  -- Remove memberships to any non-canonical bases
  DELETE FROM base_members WHERE base_id != canonical_id;
END $$;
