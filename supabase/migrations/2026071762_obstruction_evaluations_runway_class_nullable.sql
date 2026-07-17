-- ============================================================
-- Surface-set expansion step 3 — obstruction_evaluations.runway_class nullable
--
-- runway_class was UFC-only from the original CREATE TABLE (NOT NULL,
-- inline CHECK IN ('A','B') — this table predates migration tracking;
-- see supabase/schema.sql). Part 77 and ICAO Annex 14 evaluations
-- don't use a UFC runway class at all: Part 77 keys its surfaces off
-- base_runways.faa_approach_type, and ICAO Annex 14 keys off
-- base_runways.icao_code_number / icao_approach_classification. The
-- column must accept NULL for those evaluations.
--
-- Widens the CHECK the same way 2026061101 widened
-- base_runways.runway_class: allow NULL, and add 'Army_B' alongside
-- 'A'/'B' so UFC evaluations can still record the Army_B class.
-- Existing rows ('A'/'B') are untouched.
--
-- Note: the auto-generated constraint name below follows this repo's
-- consistent Postgres default-naming convention for a single inline
-- column CHECK (<table>_<column>_check — see base_runways_runway_
-- class_check, base_taxiways_runway_class_check). No tracked migration
-- created or renamed this constraint, so this is inferred, not
-- confirmed against the live catalog; the owner should verify
-- `SELECT conname FROM pg_constraint WHERE conrelid =
-- 'obstruction_evaluations'::regclass AND contype = 'c'` before or
-- after applying.
-- ============================================================

ALTER TABLE obstruction_evaluations
  ALTER COLUMN runway_class DROP NOT NULL;

ALTER TABLE obstruction_evaluations
  DROP CONSTRAINT IF EXISTS obstruction_evaluations_runway_class_check;

ALTER TABLE obstruction_evaluations
  ADD CONSTRAINT obstruction_evaluations_runway_class_check
  CHECK (runway_class IS NULL OR runway_class IN ('A', 'B', 'Army_B'));

COMMENT ON COLUMN obstruction_evaluations.runway_class IS
  'UFC 3-260-01 runway class evaluated (A / B / Army_B) for ufc_3_260_01 evaluations. NULL for faa_part77 / icao_annex14 evaluations, which key their surfaces off base_runways instead.';
