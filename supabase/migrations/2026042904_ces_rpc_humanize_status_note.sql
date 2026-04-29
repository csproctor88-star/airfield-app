-- ============================================================
-- Plain-language audit notes for CES discrepancy transitions
--
-- Background:
--   ces_update_discrepancy (introduced in 2026042201) writes the
--   current_status transition into status_updates.notes as a synthetic
--   "CURRENT_STATUS: <enum>" string. That field is rendered verbatim in
--   the discrepancy detail "Notes History" panel, so an Airfield Manager
--   reviewing the audit trail saw raw snake_case enum values like
--   "CURRENT_STATUS: awaiting_action_by_ces".
--
-- Fix: recreate the RPC so the audit note is human-readable from the
--   start, e.g. "Status changed to: Awaiting Action by CES".
--
-- The label map mirrors CURRENT_STATUS_OPTIONS in lib/constants.ts.
-- The TypeScript update path (lib/supabase/discrepancies.ts) was fixed
-- in the same change set; the rendering side also defensively reformats
-- legacy "CURRENT_STATUS: <enum>" rows so historical data displays
-- cleanly without a backfill.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ces_update_discrepancy(
  p_id UUID,
  p_current_status TEXT DEFAULT NULL,
  p_resolution_notes TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS discrepancies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_base_id UUID;
  v_old_current TEXT;
  v_updated discrepancies;
  v_status_label TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Permission check (matrix-based — no role string test)
  IF NOT public.user_has_permission(v_caller, 'discrepancies:transition:ces_statuses') THEN
    RAISE EXCEPTION 'permission denied: discrepancies:transition:ces_statuses';
  END IF;

  -- Fetch existing row for base access + old current_status
  SELECT base_id, current_status INTO v_base_id, v_old_current
  FROM discrepancies WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'discrepancy not found: %', p_id;
  END IF;

  IF v_base_id IS NOT NULL AND NOT public.user_has_base_access(v_caller, v_base_id) THEN
    RAISE EXCEPTION 'permission denied: no access to base %', v_base_id;
  END IF;

  -- Constrain target current_status to the CES-allowed values
  IF p_current_status IS NOT NULL AND p_current_status NOT IN (
    'awaiting_action_by_ces',
    'waiting_for_project',
    'work_completed_awaiting_verification'
  ) THEN
    RAISE EXCEPTION 'invalid target current_status for CES: %', p_current_status;
  END IF;

  -- Apply updates. Only the explicitly allowed columns.
  UPDATE discrepancies
  SET
    current_status   = COALESCE(p_current_status, current_status),
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    updated_at       = now()
  WHERE id = p_id
  RETURNING * INTO v_updated;

  -- Audit the current_status transition if it actually changed.
  -- The note text is plain language — it shows up verbatim in the
  -- discrepancy detail Notes History panel.
  IF p_current_status IS NOT NULL AND p_current_status IS DISTINCT FROM v_old_current THEN
    v_status_label := CASE p_current_status
      WHEN 'submitted_to_afm'                       THEN 'Submitted to AFM'
      WHEN 'submitted_to_ces'                       THEN 'Submitted to CES'
      WHEN 'awaiting_action_by_ces'                 THEN 'Awaiting Action by CES'
      WHEN 'waiting_for_project'                    THEN 'Waiting for Project Design/Execution'
      WHEN 'work_completed_awaiting_verification'   THEN 'Work Completed and Awaiting Verification'
      ELSE p_current_status
    END;
    INSERT INTO status_updates (discrepancy_id, old_status, new_status, notes, updated_by, base_id)
    VALUES (p_id, NULL, NULL, 'Status changed to: ' || v_status_label, v_caller, v_base_id);
  END IF;

  -- Optional free-form note (addStatusNote equivalent)
  IF p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN
    INSERT INTO status_updates (discrepancy_id, old_status, new_status, notes, updated_by, base_id)
    VALUES (p_id, NULL, NULL, p_note, v_caller, v_base_id);
  END IF;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ces_update_discrepancy(UUID, TEXT, TEXT, TEXT) TO authenticated;
