-- 2026061200 — obstruction_evaluations.surface_set persisted per row
--
-- Phase 3c shipped the UFC / Part 77 surface-set picker but only the
-- engine output (results JSONB) was persisted — the surface_set
-- choice itself was inferred at render time from the base's current
-- bases.obstruction_surface_set. If an admin flipped the base
-- setting after a row was saved, the detail-page legend re-rendered
-- with the new set's surfaces even though the evaluation's results
-- were computed against the old set — visually inconsistent.
--
-- This migration pins the surface_set on the evaluation row so the
-- detail page can render the right legend regardless of any later
-- base-setting changes. Backfill maps each existing row to its
-- base's current default (best available signal — there's no per-
-- row history before this column existed).

ALTER TABLE obstruction_evaluations
  ADD COLUMN IF NOT EXISTS surface_set TEXT
    CHECK (surface_set IS NULL OR surface_set IN ('ufc_3_260_01','faa_part77'));

-- Backfill existing rows from the base's current default. Rows
-- where base_id is null (rare) stay null and the read path falls
-- back to the base default at render time (same behavior as today).
UPDATE obstruction_evaluations e
   SET surface_set = b.obstruction_surface_set
  FROM bases b
 WHERE e.base_id = b.id
   AND e.surface_set IS NULL;

COMMENT ON COLUMN obstruction_evaluations.surface_set IS
  'Surface set used when this evaluation was computed. Pinned so the detail-page legend stays accurate after admin flips bases.obstruction_surface_set. NULL on legacy rows; read path falls back to bases.obstruction_surface_set.';
