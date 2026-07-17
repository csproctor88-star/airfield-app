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
-- Because no tracked migration ever created this constraint (it came
-- from the pre-tracking inline CHECK), its live name can't be read
-- from the migrations directory. Rather than guess it — a wrong guess
-- would silently no-op a name-based DROP CONSTRAINT IF EXISTS and
-- leave the old two-member CHECK alive alongside the new one, failing
-- 'Army_B' writes at runtime — the DO block below discovers the
-- actual CHECK constraint(s) on the column via pg_constraint and
-- drops them by their real names, then the widened CHECK is re-added
-- under the conventional name. No name verification needed before
-- applying; to confirm the result afterwards:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'obstruction_evaluations'::regclass
--      AND contype = 'c';
-- ============================================================

ALTER TABLE obstruction_evaluations
  ALTER COLUMN runway_class DROP NOT NULL;

-- Drop every existing CHECK on runway_class by its discovered name
-- (name-independent — survives whatever the pre-tracking inline CHECK
-- was actually auto-named). The definition-text match is safe here:
-- no other CHECK on this table references runway_class.
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.obstruction_evaluations'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%runway_class%'
  LOOP
    EXECUTE format('ALTER TABLE public.obstruction_evaluations DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE obstruction_evaluations
  ADD CONSTRAINT obstruction_evaluations_runway_class_check
  CHECK (runway_class IS NULL OR runway_class IN ('A', 'B', 'Army_B'));

COMMENT ON COLUMN obstruction_evaluations.runway_class IS
  'UFC 3-260-01 runway class evaluated (A / B / Army_B) for ufc_3_260_01 evaluations. NULL for faa_part77 / icao_annex14 evaluations, which key their surfaces off base_runways instead.';
