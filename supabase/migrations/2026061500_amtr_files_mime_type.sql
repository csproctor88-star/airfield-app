-- ============================================================
-- AMTR files — add mime_type for icon/preview hints
--
-- The amtr-files bucket + path-scoped RLS already exist
-- (2026052005_amtr_storage.sql). The Files tab is moving from a
-- name-only stub to a real upload surface; mime_type lets the UI
-- pick the right file icon and decide preview vs download without
-- re-deriving from the extension every render.
-- ============================================================

ALTER TABLE amtr_files ADD COLUMN IF NOT EXISTS mime_type TEXT;
