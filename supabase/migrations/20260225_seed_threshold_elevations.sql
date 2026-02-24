-- Seed per-threshold elevations for KMTC (Selfridge) and PGUA (Andersen).
--
-- PGUA threshold elevations are from the FAA AIP (DoD FLIP AP/1B Pacific):
--   06L/24R: 06L = 539.1 ft, 24R = 617.4 ft  (78 ft elevation change)
--   06R/24L: 06R = 556.8 ft, 24L = 607.2 ft  (50 ft elevation change)
--
-- KMTC threshold elevations are from the FAA Airport/Facility Directory:
--   01/19: both ends at 580 ft MSL (flat lakeside terrain).

-- PGUA — 06L/24R
UPDATE base_runways
SET end1_elevation_msl = 539.1,   -- 06L threshold
    end2_elevation_msl = 617.4    -- 24R threshold
WHERE base_id = '00000000-0000-0000-0000-000000000002'
  AND runway_id = '06L/24R';

-- PGUA — 06R/24L
UPDATE base_runways
SET end1_elevation_msl = 556.8,   -- 06R threshold
    end2_elevation_msl = 607.2    -- 24L threshold
WHERE base_id = '00000000-0000-0000-0000-000000000002'
  AND runway_id = '06R/24L';

-- KMTC — 01/19
UPDATE base_runways
SET end1_elevation_msl = 580,     -- 01 threshold
    end2_elevation_msl = 580      -- 19 threshold
WHERE base_id = '00000000-0000-0000-0000-000000000001'
  AND runway_id = '01/19';
