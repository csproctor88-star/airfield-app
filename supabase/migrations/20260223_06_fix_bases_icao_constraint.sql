-- Fix bases.icao constraint: allow NULL for directory-sourced bases
-- The UNIQUE NOT NULL constraint on icao prevented creating bases
-- from the directory list (which don't have ICAO codes).

-- 1. Drop the existing unique constraint on icao
ALTER TABLE bases DROP CONSTRAINT IF EXISTS bases_icao_key;
DROP INDEX IF EXISTS bases_icao_key;

-- 2. Allow NULL values in icao column
ALTER TABLE bases ALTER COLUMN icao DROP NOT NULL;

-- 3. Re-add uniqueness only for non-null, non-empty ICAO codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_bases_icao_unique
  ON bases (icao) WHERE icao IS NOT NULL AND icao != '';

-- 4. Clean up any rows with empty-string ICAO → set to NULL
UPDATE bases SET icao = NULL WHERE icao = '';
