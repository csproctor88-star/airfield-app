-- 2026061101 — base_runways.runway_class nullable + extended for civilian
--
-- Original constraint (2026022402): runway_class TEXT NOT NULL DEFAULT
-- 'B' CHECK (runway_class IN ('B', 'Army_B')) — narrowly UFC-tactical
-- coded. Civilian Part 139 airports don't use UFC runway classes at
-- all; the new base_runways.faa_approach_type field (2026060800) is
-- the civilian-correct driver of obstruction surface dimensions.
--
-- Change: drop the CHECK, allow NULL, drop the DEFAULT, then add the
-- CHECK back with NULL allowed plus UFC Class A added (UFC 3-260-01
-- defines both A and B — Phase 1 only seeded B). Existing rows are
-- untouched ('B'/'Army_B' remain valid).

ALTER TABLE base_runways
  DROP CONSTRAINT IF EXISTS base_runways_runway_class_check;

ALTER TABLE base_runways
  ALTER COLUMN runway_class DROP NOT NULL;

ALTER TABLE base_runways
  ALTER COLUMN runway_class DROP DEFAULT;

ALTER TABLE base_runways
  ADD CONSTRAINT base_runways_runway_class_check
  CHECK (runway_class IS NULL OR runway_class IN ('A', 'B', 'Army_B'));
