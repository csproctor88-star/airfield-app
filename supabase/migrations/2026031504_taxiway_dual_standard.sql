-- Add support for both FAA (TDG) and UFC 3-260-01 (Class A/B) taxiway standards
-- Existing taxiways default to 'faa' standard to preserve current behavior.

ALTER TABLE base_taxiways
  ADD COLUMN IF NOT EXISTS standard TEXT NOT NULL DEFAULT 'faa',
  ADD COLUMN IF NOT EXISTS runway_class TEXT,
  ADD COLUMN IF NOT EXISTS service_branch TEXT;

-- Add CHECK constraints only if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'base_taxiways_standard_check') THEN
    ALTER TABLE base_taxiways ADD CONSTRAINT base_taxiways_standard_check CHECK (standard IN ('faa', 'ufc'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'base_taxiways_runway_class_check') THEN
    ALTER TABLE base_taxiways ADD CONSTRAINT base_taxiways_runway_class_check CHECK (runway_class IN ('A', 'B'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'base_taxiways_service_branch_check') THEN
    ALTER TABLE base_taxiways ADD CONSTRAINT base_taxiways_service_branch_check CHECK (service_branch IN ('army', 'air_force', 'navy_mc'));
  END IF;
END $$;

-- Make tdg nullable — only used for FAA standard
ALTER TABLE base_taxiways ALTER COLUMN tdg DROP NOT NULL;
ALTER TABLE base_taxiways ALTER COLUMN tdg DROP DEFAULT;

COMMENT ON COLUMN base_taxiways.standard IS 'faa = FAA AC 150/5300-13A TDG system; ufc = UFC 3-260-01 Table 5-1 Class A/B system';
COMMENT ON COLUMN base_taxiways.runway_class IS 'UFC only: A or B runway class';
COMMENT ON COLUMN base_taxiways.service_branch IS 'UFC only: army, air_force, or navy_mc';
