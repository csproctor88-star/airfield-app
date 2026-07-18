-- ============================================================
-- USAFE-AFAFRICA 32-1007 as a selectable base standard.
--
-- 32-1007 defers to ICAO/NATO imaginary surfaces for OBSTRUCTION evaluation, so
-- getSurfaceSet() normalizes 'usafe_32_1007' -> 'icao_annex14'. The obstruction
-- tool therefore writes 'icao_annex14' into obstruction_evaluations.surface_set
-- (never 'usafe_32_1007'), and that table's CHECK is intentionally left as-is.
--
-- Only bases.obstruction_surface_set gains the new value. It distinguishes a
-- USAFE base from a civil ICAO base for PARKING clearance: 32-1007 keeps the UFC
-- wingtip clearances (direct SI conversions of the inch-pound values) while
-- civil ICAO uses the Annex 14 §3.13.6 code-letter stand clearance. Resolved by
-- parkingStandardForBase() in lib/calculations/parking-clearance.ts.
--
-- STAGED — apply with:
--   npx supabase db query --linked --file supabase/migrations/2026071773_usafe_32_1007_surface_set.sql
-- Verify:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'bases_obstruction_surface_set_check';   -- lists 4 values
-- ============================================================

ALTER TABLE bases
  DROP CONSTRAINT IF EXISTS bases_obstruction_surface_set_check;

ALTER TABLE bases
  ADD CONSTRAINT bases_obstruction_surface_set_check
  CHECK (obstruction_surface_set IN ('ufc_3_260_01', 'faa_part77', 'icao_annex14', 'usafe_32_1007'));

COMMENT ON COLUMN bases.obstruction_surface_set IS
  'Base obstruction/airfield standard: ufc_3_260_01 / faa_part77 / icao_annex14 / usafe_32_1007. 32-1007 evaluates obstructions against ICAO/NATO surfaces (getSurfaceSet normalizes it to icao_annex14) and drives the USAFE parking clearance variant.';
