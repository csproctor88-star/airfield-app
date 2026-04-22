-- ============================================================
-- Phase D2a — Swap airfield_status, shift, SCN, QRC, feedback RLS
--
-- Tables in this batch (11):
--   airfield_status
--   shift_checklists, shift_checklist_responses, shift_checklist_items
--   scn_checks, scn_check_results, scn_agencies
--   qrc_templates, qrc_executions
--   customer_feedback (DELETE only)
--
-- Notes:
--   • airfield_status writes check `airfield_status:write`. Safety's
--     narrow RSC/BWC writer goes through the safety_update_rsc_bwc
--     SECURITY DEFINER RPC, so it bypasses RLS and is unaffected here.
--   • shift_checklist_items holds per-base checklist templates —
--     editing is an admin task; swap to `base_setup:write`.
--   • scn_agencies is template config; swap to `scn:manage_agencies`.
--   • scn_checks DELETE previously required `user_is_admin`; keep
--     the higher bar by swapping to `scn:manage_agencies` (which only
--     admin-tier roles hold). Log INSERT/UPDATE stays on `scn:write`.
--   • customer_feedback INSERT is anon-submittable (QR flow) —
--     handled by the separate 2026042101_feedback_public_access
--     migration. Only DELETE needs to swap here.
-- ============================================================

-- ── airfield_status ────────────────────────────────────────
DROP POLICY IF EXISTS "airfield_status_insert" ON airfield_status;
CREATE POLICY "airfield_status_insert" ON airfield_status
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:write')
  );

DROP POLICY IF EXISTS "airfield_status_update" ON airfield_status;
CREATE POLICY "airfield_status_update" ON airfield_status
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:write')
  );

DROP POLICY IF EXISTS "airfield_status_delete" ON airfield_status;
CREATE POLICY "airfield_status_delete" ON airfield_status
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:write')
  );

-- ── shift_checklists ───────────────────────────────────────
DROP POLICY IF EXISTS "shift_checklists_insert" ON shift_checklists;
CREATE POLICY "shift_checklists_insert" ON shift_checklists
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'shift_checklist:write')
  );

DROP POLICY IF EXISTS "shift_checklists_update" ON shift_checklists;
CREATE POLICY "shift_checklists_update" ON shift_checklists
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'shift_checklist:write')
  );

-- ── shift_checklist_responses ──────────────────────────────
DROP POLICY IF EXISTS "shift_checklist_responses_insert" ON shift_checklist_responses;
CREATE POLICY "shift_checklist_responses_insert" ON shift_checklist_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'shift_checklist:write')
    AND EXISTS (
      SELECT 1 FROM shift_checklists c
      WHERE c.id = checklist_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

DROP POLICY IF EXISTS "shift_checklist_responses_update" ON shift_checklist_responses;
CREATE POLICY "shift_checklist_responses_update" ON shift_checklist_responses
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'shift_checklist:write')
    AND EXISTS (
      SELECT 1 FROM shift_checklists c
      WHERE c.id = checklist_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

-- ── shift_checklist_items (per-base checklist templates) ──
DROP POLICY IF EXISTS "shift_checklist_items_insert" ON shift_checklist_items;
CREATE POLICY "shift_checklist_items_insert" ON shift_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

DROP POLICY IF EXISTS "shift_checklist_items_update" ON shift_checklist_items;
CREATE POLICY "shift_checklist_items_update" ON shift_checklist_items
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

DROP POLICY IF EXISTS "shift_checklist_items_delete" ON shift_checklist_items;
CREATE POLICY "shift_checklist_items_delete" ON shift_checklist_items
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'base_setup:write')
  );

-- ── scn_checks ─────────────────────────────────────────────
DROP POLICY IF EXISTS "scn_checks_insert" ON scn_checks;
CREATE POLICY "scn_checks_insert" ON scn_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:write')
  );

DROP POLICY IF EXISTS "scn_checks_update" ON scn_checks;
CREATE POLICY "scn_checks_update" ON scn_checks
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:write')
  );

DROP POLICY IF EXISTS "scn_checks_delete" ON scn_checks;
CREATE POLICY "scn_checks_delete" ON scn_checks
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:manage_agencies')
  );

-- ── scn_check_results ──────────────────────────────────────
DROP POLICY IF EXISTS "scn_check_results_insert" ON scn_check_results;
CREATE POLICY "scn_check_results_insert" ON scn_check_results
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'scn:write')
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

DROP POLICY IF EXISTS "scn_check_results_update" ON scn_check_results;
CREATE POLICY "scn_check_results_update" ON scn_check_results
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'scn:write')
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

DROP POLICY IF EXISTS "scn_check_results_delete" ON scn_check_results;
CREATE POLICY "scn_check_results_delete" ON scn_check_results
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'scn:write')
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

-- ── scn_agencies (per-base roster — admin task) ───────────
DROP POLICY IF EXISTS "scn_agencies_insert" ON scn_agencies;
CREATE POLICY "scn_agencies_insert" ON scn_agencies
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:manage_agencies')
  );

DROP POLICY IF EXISTS "scn_agencies_update" ON scn_agencies;
CREATE POLICY "scn_agencies_update" ON scn_agencies
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:manage_agencies')
  );

DROP POLICY IF EXISTS "scn_agencies_delete" ON scn_agencies;
CREATE POLICY "scn_agencies_delete" ON scn_agencies
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'scn:manage_agencies')
  );

-- ── qrc_templates (per-base QRC definitions — admin task) ─
DROP POLICY IF EXISTS "qrc_templates_insert" ON qrc_templates;
CREATE POLICY "qrc_templates_insert" ON qrc_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:write')
  );

DROP POLICY IF EXISTS "qrc_templates_update" ON qrc_templates;
CREATE POLICY "qrc_templates_update" ON qrc_templates
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:write')
  );

DROP POLICY IF EXISTS "qrc_templates_delete" ON qrc_templates;
CREATE POLICY "qrc_templates_delete" ON qrc_templates
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:write')
  );

-- ── qrc_executions (logging a QRC run) ─────────────────────
DROP POLICY IF EXISTS "qrc_executions_insert" ON qrc_executions;
CREATE POLICY "qrc_executions_insert" ON qrc_executions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:execute')
  );

DROP POLICY IF EXISTS "qrc_executions_update" ON qrc_executions;
CREATE POLICY "qrc_executions_update" ON qrc_executions
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:execute')
  );

DROP POLICY IF EXISTS "qrc_executions_delete" ON qrc_executions;
CREATE POLICY "qrc_executions_delete" ON qrc_executions
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'qrc:write')
  );

-- ── customer_feedback DELETE ───────────────────────────────
-- (INSERT remains anon-submittable via the public_access migration.)
DROP POLICY IF EXISTS "Admins can delete feedback" ON customer_feedback;
CREATE POLICY "customer_feedback_delete" ON customer_feedback
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'feedback:delete'));
