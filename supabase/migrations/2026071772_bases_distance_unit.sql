-- ============================================================
-- Base-wide distance unit preference (feet vs metres).
--
-- Airfields outside the US work in metres. Dimensions stay STORED in feet
-- everywhere (runway length_ft / width_ft, elevations, obstruction heights);
-- this column only drives DISPLAY + INPUT units via lib/distance-units.ts.
-- Additive + defaulted; read through a cast (same idiom as bases.shift_count),
-- so no lib/supabase/types.ts change is strictly required.
--
-- STAGED — apply with:
--   npx supabase db query --linked --file supabase/migrations/2026071772_bases_distance_unit.sql
-- Verify:
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--     WHERE table_name = 'bases' AND column_name = 'distance_unit';   -- 1 row, default 'ft'
-- ============================================================

ALTER TABLE bases ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'ft'
  CHECK (distance_unit IN ('ft', 'm'));
