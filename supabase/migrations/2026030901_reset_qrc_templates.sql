-- ============================================================================
-- Reset QRC Templates
-- Clears all existing QRC templates and executions so they can be re-seeded
-- from the corrected qrc-seed-data.ts (rebuilt from actual source PDFs).
--
-- Run in: Supabase Dashboard > SQL Editor
-- Date:   2026-03-09
-- ============================================================================

-- Clear templates and executions together (FK constraint requires simultaneous truncate)
TRUNCATE qrc_templates, qrc_executions;
