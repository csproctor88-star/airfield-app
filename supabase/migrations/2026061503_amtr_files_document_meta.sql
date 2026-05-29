-- ============================================================
-- AMTR files — capture a document title + the document's own date
--
-- The Files tab is moving from a name-only upload to a metadata
-- dialog: the operator records what a supporting document IS
-- (a human title) and the date it carries, distinct from
-- `uploaded_at` (when it was uploaded). Both columns are nullable
-- so existing rows stay valid; the upload form enforces required,
-- not the DB. Table created in 2026052002_amtr_member_forms.sql.
-- ============================================================

ALTER TABLE amtr_files ADD COLUMN IF NOT EXISTS document_title TEXT;
ALTER TABLE amtr_files ADD COLUMN IF NOT EXISTS document_date  DATE;
