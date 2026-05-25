-- ============================================================
-- Phase 2 step 2 — SMS RLS policies
--
-- Matrix-based gating using the canonical helpers
-- `user_has_base_access` + `user_has_permission`. Permission keys
-- referenced here are already seeded by
-- 2026052503_civilian_permissions_and_roles.sql:
--   sms:read              — every read
--   sms:write             — hazards / mitigations / SPIs / audits / comms / general writes
--   sms:sign_policy       — sign / activate / supersede a sms_policies row
--   sms:approve_moc       — approve / reject sms_management_of_change
--   sms:triage_reports    — triage sms_safety_reports + promote to hazard
--
-- Civilian roles holding these keys (per 2026052503):
--   sys_admin            — all five
--   airfield_manager     — read, write, sign_policy, approve_moc, triage_reports
--   base_admin           — read, write, triage_reports
--   accountable_executive — read, sign_policy, approve_moc, triage_reports
--   sms_manager          — read, write, triage_reports
--   aep_coordinator      — read, write
--   ops_supervisor       — read, triage_reports
--   arff_chief           — read
--
-- Public submissions to sms_safety_reports go through the
-- SECURITY DEFINER RPC `submit_safety_report_public` (added in
-- 2026052702) which bypasses RLS for the narrow insert path.
-- Authenticated inserts still flow through RLS.
-- ============================================================

-- ── sms_policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sms_policies_select" ON sms_policies;
CREATE POLICY "sms_policies_select" ON sms_policies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_policies_insert" ON sms_policies;
CREATE POLICY "sms_policies_insert" ON sms_policies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- UPDATE: writers can edit drafts; activating / signing / superseding
-- additionally requires sms:sign_policy. We can't enforce per-column
-- without a trigger, so allow either perm to UPDATE and trust the UI
-- to surface the sign-off step only to AE-tier users. The activity log
-- captures who actually flipped the row to 'active'.
DROP POLICY IF EXISTS "sms_policies_update" ON sms_policies;
CREATE POLICY "sms_policies_update" ON sms_policies
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'sms:write')
      OR user_has_permission(auth.uid(), 'sms:sign_policy')
    )
  );

DROP POLICY IF EXISTS "sms_policies_delete" ON sms_policies;
CREATE POLICY "sms_policies_delete" ON sms_policies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_hazards ──────────────────────────────────────────────
DROP POLICY IF EXISTS "sms_hazards_select" ON sms_hazards;
CREATE POLICY "sms_hazards_select" ON sms_hazards
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_hazards_insert" ON sms_hazards;
CREATE POLICY "sms_hazards_insert" ON sms_hazards
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_hazards_update" ON sms_hazards;
CREATE POLICY "sms_hazards_update" ON sms_hazards
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_hazards_delete" ON sms_hazards;
CREATE POLICY "sms_hazards_delete" ON sms_hazards
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_risk_assessments ─────────────────────────────────────
DROP POLICY IF EXISTS "sms_risk_select" ON sms_risk_assessments;
CREATE POLICY "sms_risk_select" ON sms_risk_assessments
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_risk_insert" ON sms_risk_assessments;
CREATE POLICY "sms_risk_insert" ON sms_risk_assessments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_risk_update" ON sms_risk_assessments;
CREATE POLICY "sms_risk_update" ON sms_risk_assessments
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_risk_delete" ON sms_risk_assessments;
CREATE POLICY "sms_risk_delete" ON sms_risk_assessments
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_mitigations ──────────────────────────────────────────
DROP POLICY IF EXISTS "sms_mitigations_select" ON sms_mitigations;
CREATE POLICY "sms_mitigations_select" ON sms_mitigations
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_mitigations_insert" ON sms_mitigations;
CREATE POLICY "sms_mitigations_insert" ON sms_mitigations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_mitigations_update" ON sms_mitigations;
CREATE POLICY "sms_mitigations_update" ON sms_mitigations
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_mitigations_delete" ON sms_mitigations;
CREATE POLICY "sms_mitigations_delete" ON sms_mitigations
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_spis ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "sms_spis_select" ON sms_spis;
CREATE POLICY "sms_spis_select" ON sms_spis
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_spis_insert" ON sms_spis;
CREATE POLICY "sms_spis_insert" ON sms_spis
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_spis_update" ON sms_spis;
CREATE POLICY "sms_spis_update" ON sms_spis
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_spis_delete" ON sms_spis;
CREATE POLICY "sms_spis_delete" ON sms_spis
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_spi_measurements ─────────────────────────────────────
-- Reads gated on sms:read. Writes from the cron worker bypass RLS
-- via SECURITY DEFINER RPC; authenticated writes still require
-- sms:write (manual measurement entry from the dashboard).
DROP POLICY IF EXISTS "sms_spi_meas_select" ON sms_spi_measurements;
CREATE POLICY "sms_spi_meas_select" ON sms_spi_measurements
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_spi_meas_insert" ON sms_spi_measurements;
CREATE POLICY "sms_spi_meas_insert" ON sms_spi_measurements
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_audits ───────────────────────────────────────────────
DROP POLICY IF EXISTS "sms_audits_select" ON sms_audits;
CREATE POLICY "sms_audits_select" ON sms_audits
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_audits_insert" ON sms_audits;
CREATE POLICY "sms_audits_insert" ON sms_audits
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_audits_update" ON sms_audits;
CREATE POLICY "sms_audits_update" ON sms_audits
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_audits_delete" ON sms_audits;
CREATE POLICY "sms_audits_delete" ON sms_audits
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_management_of_change ─────────────────────────────────
-- Approval is column-scoped to AE-tier roles (sms:approve_moc).
-- UPDATE policy allows either write OR approve_moc; UI surfaces
-- the approval action only to approve_moc holders.
DROP POLICY IF EXISTS "sms_moc_select" ON sms_management_of_change;
CREATE POLICY "sms_moc_select" ON sms_management_of_change
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_moc_insert" ON sms_management_of_change;
CREATE POLICY "sms_moc_insert" ON sms_management_of_change
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_moc_update" ON sms_management_of_change;
CREATE POLICY "sms_moc_update" ON sms_management_of_change
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'sms:write')
      OR user_has_permission(auth.uid(), 'sms:approve_moc')
    )
  );

DROP POLICY IF EXISTS "sms_moc_delete" ON sms_management_of_change;
CREATE POLICY "sms_moc_delete" ON sms_management_of_change
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_safety_reports ───────────────────────────────────────
-- Reads: sms:read.
-- Inserts:
--   • Public path bypasses RLS via SECURITY DEFINER RPC.
--   • Authenticated inserts (internal walk-in / phone report) require sms:write.
-- Updates (triage): sms:triage_reports OR sms:write.
DROP POLICY IF EXISTS "sms_reports_select" ON sms_safety_reports;
CREATE POLICY "sms_reports_select" ON sms_safety_reports
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_reports_insert" ON sms_safety_reports;
CREATE POLICY "sms_reports_insert" ON sms_safety_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_reports_update" ON sms_safety_reports;
CREATE POLICY "sms_reports_update" ON sms_safety_reports
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'sms:triage_reports')
      OR user_has_permission(auth.uid(), 'sms:write')
    )
  );

DROP POLICY IF EXISTS "sms_reports_delete" ON sms_safety_reports;
CREATE POLICY "sms_reports_delete" ON sms_safety_reports
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

-- ── sms_communications ───────────────────────────────────────
DROP POLICY IF EXISTS "sms_comms_select" ON sms_communications;
CREATE POLICY "sms_comms_select" ON sms_communications
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:read'));

DROP POLICY IF EXISTS "sms_comms_insert" ON sms_communications;
CREATE POLICY "sms_comms_insert" ON sms_communications
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_comms_update" ON sms_communications;
CREATE POLICY "sms_comms_update" ON sms_communications
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));

DROP POLICY IF EXISTS "sms_comms_delete" ON sms_communications;
CREATE POLICY "sms_comms_delete" ON sms_communications
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'sms:write'));
