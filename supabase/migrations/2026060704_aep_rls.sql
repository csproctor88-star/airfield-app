-- ============================================================
-- Phase 3b step 5 — Airport Emergency Plan: RLS
--
-- Matrix-helper policies on the 5 AEP tables, gated by the
-- already-seeded aep:{read,write,sign} keys (from 2026052503).
-- Pattern mirrors 2026053003_training_part139_rls.sql one-for-one,
-- with the parent-child gate on aep_comms_check_results using an
-- EXISTS against aep_comms_checks (mirrors the scn_check_results
-- pattern).
--
-- No DELETE policy on aep_plans — plans are versioned via
-- replaced_by_id, not deleted. (Application layer will offer a
-- "remove draft" path that's gated on the same write policy.)
-- ============================================================

-- ── aep_plans ────────────────────────────────────────────────
ALTER TABLE aep_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aep_plans_select" ON aep_plans;
CREATE POLICY "aep_plans_select" ON aep_plans
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:read'));

DROP POLICY IF EXISTS "aep_plans_insert" ON aep_plans;
CREATE POLICY "aep_plans_insert" ON aep_plans
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_plans_update" ON aep_plans;
CREATE POLICY "aep_plans_update" ON aep_plans
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

-- (No DELETE policy — plans are versioned via replaced_by_id.)

-- ── aep_response_agencies ────────────────────────────────────
ALTER TABLE aep_response_agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aep_response_agencies_select" ON aep_response_agencies;
CREATE POLICY "aep_response_agencies_select" ON aep_response_agencies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:read'));

DROP POLICY IF EXISTS "aep_response_agencies_insert" ON aep_response_agencies;
CREATE POLICY "aep_response_agencies_insert" ON aep_response_agencies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_response_agencies_update" ON aep_response_agencies;
CREATE POLICY "aep_response_agencies_update" ON aep_response_agencies
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_response_agencies_delete" ON aep_response_agencies;
CREATE POLICY "aep_response_agencies_delete" ON aep_response_agencies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

-- ── aep_drills ───────────────────────────────────────────────
ALTER TABLE aep_drills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aep_drills_select" ON aep_drills;
CREATE POLICY "aep_drills_select" ON aep_drills
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:read'));

DROP POLICY IF EXISTS "aep_drills_insert" ON aep_drills;
CREATE POLICY "aep_drills_insert" ON aep_drills
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_drills_update" ON aep_drills;
CREATE POLICY "aep_drills_update" ON aep_drills
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_drills_delete" ON aep_drills;
CREATE POLICY "aep_drills_delete" ON aep_drills
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

-- ── aep_comms_checks ─────────────────────────────────────────
ALTER TABLE aep_comms_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aep_comms_checks_select" ON aep_comms_checks;
CREATE POLICY "aep_comms_checks_select" ON aep_comms_checks
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:read'));

DROP POLICY IF EXISTS "aep_comms_checks_insert" ON aep_comms_checks;
CREATE POLICY "aep_comms_checks_insert" ON aep_comms_checks
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_comms_checks_update" ON aep_comms_checks;
CREATE POLICY "aep_comms_checks_update" ON aep_comms_checks
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

DROP POLICY IF EXISTS "aep_comms_checks_delete" ON aep_comms_checks;
CREATE POLICY "aep_comms_checks_delete" ON aep_comms_checks
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'aep:write'));

-- ── aep_comms_check_results ──────────────────────────────────
-- Child rows: gate via EXISTS against the parent's base_id since the
-- results table doesn't carry base_id directly (mirrors the SCN pattern).
ALTER TABLE aep_comms_check_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aep_comms_results_select" ON aep_comms_check_results;
CREATE POLICY "aep_comms_results_select" ON aep_comms_check_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aep_comms_checks c
       WHERE c.id = aep_comms_check_results.check_id
         AND user_has_base_access(auth.uid(), c.base_id)
         AND user_has_permission(auth.uid(), 'aep:read')
    )
  );

DROP POLICY IF EXISTS "aep_comms_results_insert" ON aep_comms_check_results;
CREATE POLICY "aep_comms_results_insert" ON aep_comms_check_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM aep_comms_checks c
       WHERE c.id = aep_comms_check_results.check_id
         AND user_has_base_access(auth.uid(), c.base_id)
         AND user_has_permission(auth.uid(), 'aep:write')
    )
  );

DROP POLICY IF EXISTS "aep_comms_results_update" ON aep_comms_check_results;
CREATE POLICY "aep_comms_results_update" ON aep_comms_check_results
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aep_comms_checks c
       WHERE c.id = aep_comms_check_results.check_id
         AND user_has_base_access(auth.uid(), c.base_id)
         AND user_has_permission(auth.uid(), 'aep:write')
    )
  );

DROP POLICY IF EXISTS "aep_comms_results_delete" ON aep_comms_check_results;
CREATE POLICY "aep_comms_results_delete" ON aep_comms_check_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM aep_comms_checks c
       WHERE c.id = aep_comms_check_results.check_id
         AND user_has_base_access(auth.uid(), c.base_id)
         AND user_has_permission(auth.uid(), 'aep:write')
    )
  );
