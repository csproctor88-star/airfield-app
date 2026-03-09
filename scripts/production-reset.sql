-- ============================================================================
-- GLIDEPATH PRODUCTION RESET
-- Clears all operational/test data while preserving configuration and reference
-- data. Retains discrepancy 202603070 at KMTC Selfridge and its linked photos.
--
-- Run in: Supabase Dashboard > SQL Editor
-- Date:   2026-03-09
-- ============================================================================

BEGIN;

-- ── 1. CLEAR CHILD TABLES FIRST (FK dependencies) ──

-- Check comments (FK → airfield_checks)
TRUNCATE check_comments;

-- Shift checklist responses (FK → shift_checklists)
TRUNCATE shift_checklist_responses;

-- Photos: delete all EXCEPT those linked to discrepancy 202603070
DELETE FROM photos
WHERE discrepancy_id IS NULL
   OR discrepancy_id NOT IN (
     SELECT id FROM discrepancies WHERE display_id = '202603070'
   );

-- ── 2. CLEAR OPERATIONAL TABLES ──

-- Discrepancies first (FK → notams via linked columns)
DELETE FROM discrepancies WHERE display_id != '202603070';

-- Events log
TRUNCATE activity_log;

-- Runway status audit trail
TRUNCATE runway_status_log;

-- Airfield checks
TRUNCATE airfield_checks CASCADE;

-- Daily inspections
TRUNCATE inspections CASCADE;

-- ACSI annual inspections
TRUNCATE acsi_inspections CASCADE;

-- Obstruction evaluations
TRUNCATE obstruction_evaluations CASCADE;

-- QRC executions
TRUNCATE qrc_executions;

-- Shift checklists (daily instances)
TRUNCATE shift_checklists CASCADE;

-- Personnel on airfield
TRUNCATE airfield_contractors;

-- Local NOTAM drafts (use DELETE — discrepancies FK references this table)
DELETE FROM notams;

-- ── 3. RESET AIRFIELD STATUS TO DEFAULTS (keep rows) ──

UPDATE airfield_status SET
  advisory_type = NULL,
  advisory_text = NULL,
  advisories = '[]'::jsonb,
  runway_status = 'open',
  runway_statuses = '{}',
  arff_cat = NULL,
  arff_statuses = '{}',
  rsc_condition = NULL,
  rsc_updated_at = NULL,
  rcr_touchdown = NULL,
  rcr_midpoint = NULL,
  rcr_rollout = NULL,
  rcr_condition = NULL,
  rcr_updated_at = NULL,
  bwc_value = NULL,
  bwc_updated_at = NULL,
  construction_remarks = NULL,
  misc_remarks = NULL,
  updated_at = NOW();

-- ── 4. RESET NAVAID STATUSES TO GREEN ──

UPDATE navaid_statuses SET
  status = 'green',
  notes = NULL,
  updated_at = NOW();

-- ── 5. RESET USER PRESENCE (optional — clears "last seen" timestamps) ──

UPDATE profiles SET
  last_seen_at = NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after to confirm)
-- ============================================================================
-- SELECT count(*) AS activity_log_count FROM activity_log;
-- SELECT count(*) AS checks_count FROM airfield_checks;
-- SELECT count(*) AS inspections_count FROM inspections;
-- SELECT count(*) AS discrepancies_count FROM discrepancies;
-- SELECT display_id FROM discrepancies;  -- should show only 202603070
-- SELECT count(*) AS photos_count FROM photos;  -- should be only disc photos
-- SELECT advisory_type, rsc_condition, bwc_value FROM airfield_status;
