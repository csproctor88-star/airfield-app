-- ============================================================
-- AMTR — Migration 16: standard DAF 803 task-evaluation catalog.
--
-- The Air Force has a standard list of required 803 task evaluations
-- (STS items) per upgrade section. This base-shared catalog holds that
-- standard list (seeded from the 1C7X1 record); a member's 803 tab can
-- one-click populate the required evaluations from it, and the NAMT can
-- edit/add/remove both the catalog and the per-member rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_803_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  section     TEXT NOT NULL,
  sts_item    TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_803_catalog_base ON amtr_803_catalog(base_id, section, sort_order);

ALTER TABLE amtr_803_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_803_catalog_select" ON amtr_803_catalog FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_803_catalog_write" ON amtr_803_catalog FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));
