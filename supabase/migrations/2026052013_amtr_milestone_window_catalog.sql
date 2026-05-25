-- ============================================================
-- AMTR — Migration 14: milestone target window becomes uniform.
--
-- Milestone time windows are a program standard, not per-member, so
-- the target window now lives on the base-shared milestone catalog and
-- is displayed identically on every record. (The old per-member
-- amtr_milestone_progress.target_window is left in place but unused.)
-- ============================================================

ALTER TABLE amtr_milestone_catalog ADD COLUMN IF NOT EXISTS target_window TEXT;
