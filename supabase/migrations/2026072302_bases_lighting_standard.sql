-- ============================================================
-- Per-base lighting-compliance standard selector.
--
-- The Visual NAVAID outage engine had two standards (DAFMAN A3.1 for USAF,
-- FAA Part 139 for civilian), chosen implicitly from bases.airport_type.
-- This adds a THIRD standard (ICAO Annex 14 §10.5) and decouples the choice
-- from airport_type with an explicit per-base selector — so an overseas USAF
-- airfield or an international civilian airport can run ICAO lighting
-- compliance regardless of its airport_type or obstruction surface set.
--
--   NULL  -> derive the historical default in code (getLightingCompliance):
--            usaf -> 'dafman', faa_part139 -> 'faa'. Existing bases are
--            therefore UNCHANGED until an admin explicitly picks a standard.
--   'dafman' | 'faa' | 'icao' -> explicit override.
--
-- Additive, nullable, no default — safe expand-phase migration; live code
-- reads it with a null-derives-default fallback.
--
-- Verify after apply:
--   SELECT lighting_standard, COUNT(*) FROM bases GROUP BY lighting_standard;
--   -- expect: all rows NULL (nothing overridden yet)
-- ============================================================

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS lighting_standard TEXT
    CHECK (lighting_standard IS NULL OR lighting_standard IN ('dafman', 'faa', 'icao'));

COMMENT ON COLUMN bases.lighting_standard IS 'Explicit lighting-compliance standard for the Visual NAVAID outage engine: dafman (DAFMAN 13-204v2 A3.1) / faa (14 CFR 139.311, AC 150/5340-26C) / icao (Annex 14 Vol I 10.5). NULL derives from airport_type in getLightingCompliance (usaf->dafman, faa_part139->faa).';
