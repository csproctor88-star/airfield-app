-- ============================================================
-- Phase 1.2 — regulations.source authority tagging
--
-- Adds a `source` column so the reference library can filter by
-- regulatory authority. Civilian airports see FAA + ICAO + 'both';
-- USAF bases see USAF + UFC + ICAO + 'both'. Without this column,
-- a civilian airport would see DAFMAN-only regs that don't apply
-- and miss the FAA framing.
--
-- Backfill derives `source` from existing `pub_type`:
--   'DAF', 'DoD'       → 'usaf'
--   'FAA'              → 'faa'
--   'CFR'              → 'faa'   (all current CFR refs are Title 14/49 FAA-adjacent)
--   'UFC'              → 'ufc'
--   'ICAO'             → 'icao'
--   anything else      → 'usaf'  (safe default — USAF is the existing audience)
--
-- A subset of regs apply to BOTH USAF and FAA airports (e.g. AC
-- 150/5300-13B Airport Design is referenced by joint-use bases).
-- Those get manually upgraded to 'both' in the Phase 1.3 seed.
-- ============================================================

ALTER TABLE regulations
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IS NULL OR source IN ('usaf','faa','both','icao','ufc'));

UPDATE regulations
SET source = CASE
  WHEN pub_type IN ('DAF', 'DoD')    THEN 'usaf'
  WHEN pub_type IN ('FAA', 'CFR')    THEN 'faa'
  WHEN pub_type = 'UFC'              THEN 'ufc'
  WHEN pub_type = 'ICAO'             THEN 'icao'
  ELSE 'usaf'
END
WHERE source IS NULL;

ALTER TABLE regulations
  ALTER COLUMN source SET DEFAULT 'usaf',
  ALTER COLUMN source SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_regulations_source ON regulations(source);

COMMENT ON COLUMN regulations.source IS
  'Regulatory authority. Drives library filtering: civilian airports see {faa, both, icao}; USAF bases see {usaf, both, icao, ufc}.';
