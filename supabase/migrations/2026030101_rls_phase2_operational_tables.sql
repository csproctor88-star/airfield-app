-- ============================================================
-- Phase 2: Operational Table Policies (Role-Aware)
-- Pattern: SELECT = base access; INSERT/UPDATE/DELETE = base access + writable role
-- ============================================================

-- ============================================================
-- discrepancies
-- ============================================================
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discrepancies_select" ON discrepancies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "discrepancies_insert" ON discrepancies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "discrepancies_update" ON discrepancies
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "discrepancies_delete" ON discrepancies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- inspections
-- ============================================================
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select" ON inspections
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "inspections_insert" ON inspections
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "inspections_update" ON inspections
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "inspections_delete" ON inspections
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- airfield_checks
-- ============================================================
ALTER TABLE airfield_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airfield_checks_select" ON airfield_checks
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_checks_insert" ON airfield_checks
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "airfield_checks_update" ON airfield_checks
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "airfield_checks_delete" ON airfield_checks
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- obstruction_evaluations
-- ============================================================
ALTER TABLE obstruction_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obstruction_evaluations_select" ON obstruction_evaluations
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "obstruction_evaluations_insert" ON obstruction_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "obstruction_evaluations_update" ON obstruction_evaluations
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "obstruction_evaluations_delete" ON obstruction_evaluations
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- notams
-- ============================================================
ALTER TABLE notams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notams_select" ON notams
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "notams_insert" ON notams
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "notams_update" ON notams
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "notams_delete" ON notams
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- waivers
-- ============================================================
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waivers_select" ON waivers
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "waivers_insert" ON waivers
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "waivers_update" ON waivers
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "waivers_delete" ON waivers
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));
