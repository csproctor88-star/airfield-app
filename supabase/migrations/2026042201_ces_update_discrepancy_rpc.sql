-- ============================================================
-- Phase B — CES write path: ces_update_discrepancy RPC
--
-- Background:
--   The StatusUpdateModal lets CES users change a discrepancy's
--   current_status, resolution_notes, and add notes. Those writes
--   go directly from the browser to the discrepancies /
--   status_updates tables — but RLS on both uses user_can_write(),
--   which rejects `ces`. Every CES save silently failed.
--
-- Fix: a SECURITY DEFINER RPC that:
--   1. Requires the caller to hold
--      `discrepancies:transition:ces_statuses` in the permission
--      matrix (seeded below for the `ces` role).
--   2. Requires base access.
--   3. Constrains target current_status to the 3 CES-allowed
--      values.
--   4. Updates only the CES-allowed columns on the discrepancy.
--   5. Writes the matching audit row to status_updates.
--   6. Accepts an optional free-form note that also lands in
--      status_updates as a standalone entry.
--
-- Also grants CES the three new permission keys so the UI can gate
-- on `usePermissions().has(...)` instead of hard-coded role checks.
-- ============================================================

-- ── Grant CES the new permission keys ──────────────────────
INSERT INTO role_permissions (role, permission_key) VALUES
  ('ces', 'discrepancies:transition:ces_statuses'),
  ('ces', 'discrepancies:update:resolution_notes'),
  ('ces', 'discrepancies:add_note')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ── CES discrepancy update RPC ─────────────────────────────
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

  -- Audit the current_status transition if it actually changed
  IF p_current_status IS NOT NULL AND p_current_status IS DISTINCT FROM v_old_current THEN
    INSERT INTO status_updates (discrepancy_id, old_status, new_status, notes, updated_by, base_id)
    VALUES (p_id, NULL, NULL, 'CURRENT_STATUS: ' || p_current_status, v_caller, v_base_id);
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
