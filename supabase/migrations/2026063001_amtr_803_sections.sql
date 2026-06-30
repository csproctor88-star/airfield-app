-- ============================================================
-- AMTR — manager-addable DAF 803 sections.
--
-- 803 sections were a hardcoded const (apprenticeGrad/amslAmos/fiveLevel/
-- sevenLevel/afm) and the amtr_803 member table locked the same five keys via a
-- CHECK constraint. This makes sections a per-base table so a NAMT can add a new
-- section (chip) from the Admin page and add tasks under it. Tasks (amtr_803_catalog)
-- and member evals (amtr_803) still reference a section by its `section` text key.
-- ============================================================

CREATE TABLE IF NOT EXISTS amtr_803_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  label       TEXT NOT NULL,
  builtin     BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, section_key)
);
CREATE INDEX IF NOT EXISTS idx_amtr_803_sections_base ON amtr_803_sections(base_id, sort_order);

ALTER TABLE amtr_803_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_803_sections_select" ON amtr_803_sections FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_803_sections_write" ON amtr_803_sections FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));

-- Drop the member-table CHECK so custom section keys are insertable. Safe: it
-- only relaxes inserts; existing rows and old code (which inserts built-in keys)
-- are unaffected.
ALTER TABLE amtr_803 DROP CONSTRAINT IF EXISTS amtr_803_section_check;

-- Backfill the five built-in sections for every base (idempotent).
INSERT INTO amtr_803_sections (base_id, section_key, label, builtin, sort_order)
SELECT b.id, v.key, v.label, true, v.ord
FROM bases b
CROSS JOIN (VALUES
  ('apprenticeGrad', 'Apprentice Grad', 0),
  ('amslAmos',       'AMSL/AMOS',       1),
  ('fiveLevel',      '5-Level',         2),
  ('sevenLevel',     '7-Level',         3),
  ('afm',            'AFM',             4)
) AS v(key, label, ord)
ON CONFLICT (base_id, section_key) DO NOTHING;
