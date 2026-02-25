-- Add per-threshold elevation fields to base_runways.
-- The approach-departure clearance surface height calculation starts from the
-- threshold elevation, not the airfield-wide elevation.  These fields allow
-- each runway end to carry its own elevation MSL for accurate obstruction
-- evaluation on sloped terrain.

ALTER TABLE base_runways
  ADD COLUMN IF NOT EXISTS end1_elevation_msl NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS end2_elevation_msl NUMERIC(8,2);

-- Backfill from the parent base's airfield elevation where available.
UPDATE base_runways br
SET end1_elevation_msl = b.elevation_msl,
    end2_elevation_msl = b.elevation_msl
FROM bases b
WHERE br.base_id = b.id
  AND br.end1_elevation_msl IS NULL;
