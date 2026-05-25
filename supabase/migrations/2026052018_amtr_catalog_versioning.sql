-- ============================================================
-- AMTR — Migration 19: standard-catalog versioning + soft-retire.
--
-- Enables seamless updates to a new HAF training-record version without
-- wiping member records: the sync merges the bundled standard catalogs
-- into each base BY NATURAL KEY (updating in place, so member progress
-- keeps its catalog_id FK), inserts new items, and SOFT-RETIRES items
-- that a managed (standard) row no longer has in the new version —
-- never deleting, so historical completions survive.
--
-- • managed  — row originated from / is tracked by the standard sync
--              (vs a NAMT-added custom item, which is left untouched).
-- • retired  — soft-deleted: hidden from new entry, kept for history.
-- • amtr_catalog_version — the standard version a base is currently on.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amtr_jqs_catalog','amtr_1098_catalog','amtr_formal_catalog','amtr_rat_catalog',
    'amtr_milestone_catalog','amtr_inspection_checklist','amtr_623a_entry_types',
    'amtr_803_catalog','amtr_qual_catalog'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS managed BOOLEAN NOT NULL DEFAULT FALSE;', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT FALSE;', t);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS amtr_catalog_version (
  base_id     UUID PRIMARY KEY REFERENCES bases(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE amtr_catalog_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_catalog_version_select" ON amtr_catalog_version FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_catalog_version_write" ON amtr_catalog_version FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));
