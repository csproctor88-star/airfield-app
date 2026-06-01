-- ============================================================
-- AMTR — editable DAF 623A comment templates.
--
-- The "Insert DAFMAN template…" comment shells were a hard-coded const
-- (COMMENT_TEMPLATES). This makes them a base-shared, NAMT/AFM-editable
-- catalog (managed in Training Admin -> 623A Comment Templates), seeded
-- from the shipped defaults. `body` holds the labeled-blank lines; the
-- "(Label — IAW Cite)" header is recomposed on insert.
--
-- Mirrors amtr_623a_entry_types (migration 2026052012). Expand-only.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_623a_comment_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  cite        TEXT NOT NULL DEFAULT '',
  body        TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_623a_templates_base ON amtr_623a_comment_templates(base_id, sort_order);

ALTER TABLE amtr_623a_comment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_623a_templates_select" ON amtr_623a_comment_templates FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_623a_templates_write" ON amtr_623a_comment_templates FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));
