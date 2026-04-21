-- ============================================================
-- Sync discrepancies.current_status CHECK constraint with the
-- values the app actually uses.
--
-- The original `discrepancies_current_status_check` constraint
-- permitted only 4 values:
--   submitted_to_afm, submitted_to_ces, awaiting_action_by_ces,
--   work_completed_awaiting_verification
--
-- The app (types, constants, UI) also uses `waiting_for_project`
-- to track CE work-orders that are approved but awaiting funding
-- or a programmed project FY. Users picking that status via the
-- status dropdown would get 23514 errors because the DB rejected
-- it. Drop the old constraint and re-add with the full set.
-- ============================================================

ALTER TABLE discrepancies
  DROP CONSTRAINT IF EXISTS discrepancies_current_status_check;

ALTER TABLE discrepancies
  ADD CONSTRAINT discrepancies_current_status_check
  CHECK (current_status IN (
    'submitted_to_afm',
    'submitted_to_ces',
    'awaiting_action_by_ces',
    'waiting_for_project',
    'work_completed_awaiting_verification'
  ));
