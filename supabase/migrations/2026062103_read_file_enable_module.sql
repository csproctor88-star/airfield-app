-- ============================================================
-- Read File — Migration 4/4: enable the module on existing bases
--
-- enabled_modules is a frozen text[] per base; new defaultEnabled modules
-- are invisible on existing bases until backfilled. Read File applies to
-- both airport types, so enable it everywhere it isn't already present.
-- ============================================================

UPDATE bases
SET enabled_modules = array_append(enabled_modules, 'read_file')
WHERE NOT ('read_file' = ANY(COALESCE(enabled_modules, '{}')));
