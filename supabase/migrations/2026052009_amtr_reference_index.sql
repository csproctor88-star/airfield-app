-- ============================================================
-- AMTR — Migration 9: Master Training Reference Index
--
-- A base-scoped, manually-curated index of governing publications the
-- training manager (NAMT/AFM) maintains: publication name + link.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_reference_index (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  publication TEXT,
  link        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_reference_index_base ON amtr_reference_index(base_id);

ALTER TABLE amtr_reference_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY amtr_reference_index_select ON amtr_reference_index
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY amtr_reference_index_insert ON amtr_reference_index
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY amtr_reference_index_update ON amtr_reference_index
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY amtr_reference_index_delete ON amtr_reference_index
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:delete'));
