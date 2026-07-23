-- ============================================================
-- Runway edge lights: CAT II/III serviceability flag.
--
-- AC 150/5340-26C Appendix A, Table A-8: runway edge lights (REDL) are
-- serviceable at 85% on (15% allowable out) for CAT I runways, but at
-- 95% on (5% allowable out) for CAT II/III runways.
--
-- The outage engine reads the edge-light threshold from the runway_edge
-- 'overall' component (allowable_outage_pct = 15). Nothing FAA-side
-- currently records which runways are CAT II/III — faa_approach_type
-- only distinguishes precision vs non-precision, and faa_approach_category
-- is the A-E landing-speed category. This adds an explicit per-system
-- flag; lib/outage-rules.ts (resolveEdgeThreshold) tightens the runway_edge
-- 'overall' component from 15% to 5% when it is set. Default false =
-- existing CAT I behavior, so this is inert until a base opts a runway in.
--
-- The Base Config lighting tab only exposes the toggle on civilian
-- (faa_part139) bases for runway_edge systems, so it never applies the
-- FAA-sourced 5% to a DAFMAN base (we have no DAFMAN CAT II/III source).
--
-- Additive column with a default — safe expand-phase migration; live code
-- reads the flag with a falsy default when the column is absent.
--
-- Verify after apply:
--   SELECT COUNT(*) FROM lighting_systems WHERE is_cat_ii_iii;  -- expect 0
--   SELECT column_name, data_type, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'lighting_systems' AND column_name = 'is_cat_ii_iii';
-- ============================================================

ALTER TABLE lighting_systems
  ADD COLUMN IF NOT EXISTS is_cat_ii_iii BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN lighting_systems.is_cat_ii_iii IS 'Runway is CAT II/III: tightens runway edge-light serviceability from 85% (CAT I) to 95% per AC 150/5340-26C Table A-8. Civilian (faa_part139) runway_edge systems only; UI-gated in Base Config. Default false = CAT I.';
