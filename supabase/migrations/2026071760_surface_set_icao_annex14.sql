-- ============================================================
-- 2026071760 — icao_annex14 surface set (bases + obstruction_evaluations)
--
-- Adds a third obstruction imaginary-surface set alongside
-- ufc_3_260_01 (military) and faa_part77 (civilian Part 139):
-- icao_annex14, for ICAO Annex 14 (civil / joint-use) airfields.
-- The evaluation engine itself and any UI are later tasks; this
-- migration only widens the two CHECK constraints that gate which
-- values the columns accept, plus refreshes the column comments.
-- Existing values ('ufc_3_260_01' / 'faa_part77' / NULL) remain
-- valid members — zero rows touched, default unchanged.
-- ============================================================

ALTER TABLE bases
  DROP CONSTRAINT IF EXISTS bases_obstruction_surface_set_check;

ALTER TABLE bases
  ADD CONSTRAINT bases_obstruction_surface_set_check
  CHECK (obstruction_surface_set IN ('ufc_3_260_01', 'faa_part77', 'icao_annex14'));

COMMENT ON COLUMN bases.obstruction_surface_set IS
  'Which imaginary-surface set the obstruction engine uses. ufc_3_260_01 = military (UFC 3-260-01 Ch.3); faa_part77 = civilian (14 CFR Part 77 + AC 150/5300-13B); icao_annex14 = ICAO Annex 14 Vol I Ch.4.';

ALTER TABLE obstruction_evaluations
  DROP CONSTRAINT IF EXISTS obstruction_evaluations_surface_set_check;

ALTER TABLE obstruction_evaluations
  ADD CONSTRAINT obstruction_evaluations_surface_set_check
  CHECK (surface_set IS NULL OR surface_set IN ('ufc_3_260_01', 'faa_part77', 'icao_annex14'));

COMMENT ON COLUMN obstruction_evaluations.surface_set IS
  'Surface set used when this evaluation was computed (ufc_3_260_01 / faa_part77 / icao_annex14). Pinned so the detail-page legend stays accurate after admin flips bases.obstruction_surface_set. NULL on legacy rows; read path falls back to bases.obstruction_surface_set.';
