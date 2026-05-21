-- ============================================================
-- AMTR — Migration 8: milestone target window
--
-- QTP/PCG milestones identify *when* a trainee should complete each
-- topic, not whether it is complete. Replace completion tracking with a
-- per-member target date-range window (e.g. "1-30 Days", "30-60 Days").
-- ============================================================

ALTER TABLE amtr_milestone_progress ADD COLUMN IF NOT EXISTS target_window TEXT;
