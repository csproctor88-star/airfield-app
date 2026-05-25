-- ============================================================
-- AMTR — Migration 18: 1098 per-task training resources.
--
-- Each DAF 1098 recurring-training task can carry NAMT-curated training
-- resources (links to websites, regulations, CBTs). Clicking a 1098
-- task on a record opens these. Base-shared, attached to the catalog
-- task so they apply to every member.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_1098_resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  catalog_id  UUID NOT NULL REFERENCES amtr_1098_catalog(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  url         TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_1098_resources ON amtr_1098_resources(base_id, catalog_id, sort_order);

ALTER TABLE amtr_1098_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_1098_resources_select" ON amtr_1098_resources FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_1098_resources_write" ON amtr_1098_resources FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));
