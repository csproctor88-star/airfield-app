-- ============================================================
-- Phase 3c step 1 — Part 77 obstruction UI: per-runway FAA approach data
--
-- 14 CFR §77.19 surface dimensions vary by:
--   - Approach type:  visual / non-precision / precision
--   - Runway type:    utility / non-utility
--   - Visibility minimums for non-precision (≥ 3/4 mi or < 3/4 mi)
--
-- The base_runways row gains two columns:
--
--   faa_approach_type      — drives Part 77 surface dimensions in the
--                             obstruction engine (lib/calculations/
--                             obstructions.ts getPart77Surfaces()).
--                             6 explicit options per §77.19.
--   faa_approach_category  — FAA aircraft approach category per
--                             14 CFR §1.1 (A-E by landing speed).
--                             Informational — does NOT drive Part 77
--                             dimensions, but useful for circling
--                             minimums and runway design standards.
--
-- Both nullable: USAF runways leave both NULL (the engine uses the
-- existing runway_class column for UFC 3-260-01 surface lookup);
-- civilian runways default the engine to 'non_utility_non_precision_low'
-- in code when this column is NULL (matches the Phase 1 hardcoded
-- PART77_SURFACES default — preserves backward compatibility).
-- ============================================================

ALTER TABLE base_runways
  ADD COLUMN IF NOT EXISTS faa_approach_type TEXT
    CHECK (faa_approach_type IS NULL OR faa_approach_type IN (
      'utility_visual',
      'utility_non_precision',
      'non_utility_visual',
      'non_utility_non_precision_3_4',
      'non_utility_non_precision_low',
      'non_utility_precision'
    )),
  ADD COLUMN IF NOT EXISTS faa_approach_category TEXT
    CHECK (faa_approach_category IS NULL OR faa_approach_category IN ('A','B','C','D','E'));

COMMENT ON COLUMN base_runways.faa_approach_type IS 'Per 14 CFR §77.19, drives the Part 77 obstruction surface dimensions. NULL on USAF runways (engine uses runway_class for UFC 3-260-01 instead) and on civilian runways not yet configured (engine defaults to non_utility_non_precision_low).';
COMMENT ON COLUMN base_runways.faa_approach_category IS 'FAA aircraft approach category per 14 CFR §1.1 by landing speed (A < 91 kts, B 91-120, C 121-140, D 141-165, E > 166). Informational — does not drive Part 77 surface dimensions.';
