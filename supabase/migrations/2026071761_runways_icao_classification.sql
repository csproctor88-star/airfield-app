-- ============================================================
-- Surface-set expansion step 2 — per-runway ICAO Annex 14 classification
--
-- ICAO Annex 14 Vol I obstacle-limitation-surface dimensions vary by:
--
--   icao_code_number              — Table 1-1 code number (1-4), keyed
--                                    to reference field length and
--                                    wingspan / outer main gear wheel
--                                    span. Drives which OLS dimensions
--                                    apply.
--   icao_approach_classification  — Table 4-1 approach classification,
--                                    drives approach- and transitional-
--                                    surface slopes and dimensions.
--   icao_strip_width_m            — §3.4 graded runway strip width, in
--                                    meters (code-number-driven default,
--                                    but sites may record an as-built
--                                    survey value).
--
-- All three nullable, mirroring faa_approach_type's per-runway shape
-- (2026060800): USAF and Part 77 runways leave these NULL; the ICAO
-- Annex 14 obstruction engine (later task) reads them when
-- bases.obstruction_surface_set = 'icao_annex14'. New columns inherit
-- base_runways' existing matrix RLS policies — no policy changes here.
-- ============================================================

ALTER TABLE base_runways
  ADD COLUMN IF NOT EXISTS icao_code_number SMALLINT
    CHECK (icao_code_number IS NULL OR icao_code_number BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS icao_approach_classification TEXT
    CHECK (icao_approach_classification IS NULL OR icao_approach_classification IN (
      'non_instrument',
      'non_precision',
      'precision_cat_i',
      'precision_cat_ii_iii'
    )),
  ADD COLUMN IF NOT EXISTS icao_strip_width_m NUMERIC
    CHECK (icao_strip_width_m IS NULL OR icao_strip_width_m > 0);

COMMENT ON COLUMN base_runways.icao_code_number IS 'ICAO Annex 14 Vol I Table 1-1 code number (1-4), keyed to reference field length and wingspan/outer main gear wheel span. Drives Annex 14 obstacle-limitation-surface dimensions. NULL on non-ICAO-mode runways.';
COMMENT ON COLUMN base_runways.icao_approach_classification IS 'ICAO Annex 14 Vol I Table 4-1 approach classification (non_instrument / non_precision / precision_cat_i / precision_cat_ii_iii). Drives Annex 14 approach- and transitional-surface slopes. NULL on non-ICAO-mode runways.';
COMMENT ON COLUMN base_runways.icao_strip_width_m IS 'ICAO Annex 14 Vol I §3.4 graded runway strip width, in meters. NULL on non-ICAO-mode runways.';
