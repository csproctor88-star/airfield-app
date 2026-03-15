-- Add support for both FAA (TDG) and UFC 3-260-01 (Class A/B) taxiway standards
-- Existing taxiways default to 'faa' standard to preserve current behavior.

ALTER TABLE base_taxiways
  ADD COLUMN standard TEXT NOT NULL DEFAULT 'faa'
    CHECK (standard IN ('faa', 'ufc')),
  ADD COLUMN runway_class TEXT
    CHECK (runway_class IN ('A', 'B')),
  ADD COLUMN service_branch TEXT
    CHECK (service_branch IN ('army', 'air_force', 'navy_mc'));

-- Make tdg nullable — only used for FAA standard
ALTER TABLE base_taxiways ALTER COLUMN tdg DROP NOT NULL;
ALTER TABLE base_taxiways ALTER COLUMN tdg DROP DEFAULT;

COMMENT ON COLUMN base_taxiways.standard IS 'faa = FAA AC 150/5300-13A TDG system; ufc = UFC 3-260-01 Table 5-1 Class A/B system';
COMMENT ON COLUMN base_taxiways.runway_class IS 'UFC only: A or B runway class';
COMMENT ON COLUMN base_taxiways.service_branch IS 'UFC only: army, air_force, or navy_mc';
