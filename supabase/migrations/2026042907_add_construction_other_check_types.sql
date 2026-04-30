-- 2026042907 — extend airfield_checks.check_type CHECK constraint
--
-- The TypeScript CheckType union and CHECK_TYPE_CONFIG were extended
-- to add 'construction' (FAA 11-item P/F/N/A airfield-construction
-- checklist) and 'other' (free-form Subject + standard skeleton) in
-- the same session. The DB still enforced the original 7-value
-- whitelist, so saving an Other check failed with:
--   new row for relation "airfield_checks" violates check constraint
--   "airfield_checks_check_type_check"
--
-- Drop the old constraint and re-add it with the two new values.
-- No data backfill needed — `data` is JSONB and the new types add
-- new optional keys (`construction_items` / `other_subject`) that
-- existing rows naturally don't have.

ALTER TABLE airfield_checks
  DROP CONSTRAINT IF EXISTS airfield_checks_check_type_check;

ALTER TABLE airfield_checks
  ADD CONSTRAINT airfield_checks_check_type_check
  CHECK (check_type IN (
    'fod',
    'rsc',
    'ife',
    'ground_emergency',
    'heavy_aircraft',
    'bash',
    'rcr',
    'construction',
    'other'
  ));
