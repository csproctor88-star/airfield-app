-- ============================================================
-- AMTR — Migration 13: editable DAF 623A entry-type list.
--
-- The 623A "Entry Type" dropdown was a hard-coded list. This makes it
-- a base-shared, NAMT-editable catalog (managed in Training Admin),
-- seeded with the standard entry types.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_623a_entry_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_623a_types_base ON amtr_623a_entry_types(base_id, sort_order);

ALTER TABLE amtr_623a_entry_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_623a_types_select" ON amtr_623a_entry_types FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_623a_types_write" ON amtr_623a_entry_types FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));
