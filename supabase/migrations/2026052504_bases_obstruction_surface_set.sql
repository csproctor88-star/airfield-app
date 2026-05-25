-- ============================================================
-- Phase 1.5 — bases.obstruction_surface_set
--
-- Selects which imaginary-surface enum the obstruction engine
-- evaluates against for a given base. UFC 3-260-01 (military) or
-- FAA Part 77 (civilian Part 139). The geometry engine in
-- lib/calculations/geometry.ts is reused; only the surface
-- definitions branch.
--
-- All existing bases keep their UFC surfaces. New civilian bases
-- default to Part 77 via the base-setup wizard. The column is a
-- base-wide default; if per-runway overrides are ever needed
-- (joint-use civil-military airfields), a runways.surface_set
-- column can be added later as an override.
-- ============================================================

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS obstruction_surface_set TEXT NOT NULL DEFAULT 'ufc_3_260_01'
    CHECK (obstruction_surface_set IN ('ufc_3_260_01','faa_part77'));

COMMENT ON COLUMN bases.obstruction_surface_set IS
  'Which imaginary-surface set the obstruction engine uses. ufc_3_260_01 = military (UFC 3-260-01 Ch.3); faa_part77 = civilian (14 CFR Part 77 + AC 150/5300-13B).';
