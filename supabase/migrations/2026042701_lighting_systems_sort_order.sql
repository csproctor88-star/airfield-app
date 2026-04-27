-- ============================================================
-- Lighting Systems — manual sort order
--
-- Today the systems list orders by `name`, which means renaming
-- a system reshuffles the whole base-setup list. Adding a manual
-- sort_order matches the pattern every other base-setup list
-- already uses (base_areas, base_navaids, base_facilities,
-- ppr_columns, qrc_templates, shift_checklist_items, etc.) and
-- enables drag-to-reorder in the Lighting Systems tab.
--
-- New rows default to 0; existing rows are seeded by current
-- alphabetical name order so the visual list is unchanged
-- immediately after deploy.
-- ============================================================

ALTER TABLE lighting_systems
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- Seed existing rows: 0..n-1 within each base, ordered by name to
-- preserve current display.
WITH ordered AS (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY base_id ORDER BY name) - 1 AS new_order
  FROM lighting_systems
)
UPDATE lighting_systems ls
SET sort_order = o.new_order
FROM ordered o
WHERE ls.id = o.id;

CREATE INDEX IF NOT EXISTS idx_lighting_systems_base_sort
  ON lighting_systems(base_id, sort_order);
