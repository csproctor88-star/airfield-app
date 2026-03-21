-- ============================================================
-- Tighten RLS write policies: enforce user_can_write() on all
-- operational tables that currently only check base_access.
-- Also: allow CES role to UPDATE discrepancies (work order status).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Discrepancies — allow CES to UPDATE (for work order status)
--    Current policy requires user_can_write(); CES is not in that set.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "discrepancies_update" ON discrepancies;
CREATE POLICY "discrepancies_update" ON discrepancies
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_can_write(auth.uid())
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ces')
    )
  );

-- ────────────────────────────────────────────────────────────
-- 2. Activity log — restrict INSERT to writable roles
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 3. Runway status log — restrict INSERT to writable roles
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "runway_status_log_insert" ON runway_status_log;
CREATE POLICY "runway_status_log_insert" ON runway_status_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 4. Check comments — restrict INSERT to writable roles
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "check_comments_insert" ON check_comments;
CREATE POLICY "check_comments_insert" ON check_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 5. Outage events — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "outage_events_insert" ON outage_events;
CREATE POLICY "outage_events_insert" ON outage_events
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 6. Wildlife sightings — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wildlife_sightings_insert" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_insert" ON wildlife_sightings
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "wildlife_sightings_update" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_update" ON wildlife_sightings
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "wildlife_sightings_delete" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_delete" ON wildlife_sightings
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 7. Wildlife strikes — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "wildlife_strikes_insert" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_insert" ON wildlife_strikes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "wildlife_strikes_update" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_update" ON wildlife_strikes
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "wildlife_strikes_delete" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_delete" ON wildlife_strikes
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 8. BWC history — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bwc_history_insert" ON bwc_history;
CREATE POLICY "bwc_history_insert" ON bwc_history
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "bwc_history_update" ON bwc_history;
CREATE POLICY "bwc_history_update" ON bwc_history
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "bwc_history_delete" ON bwc_history;
CREATE POLICY "bwc_history_delete" ON bwc_history
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 9. Parking plans — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parking_plans_insert" ON parking_plans;
CREATE POLICY "parking_plans_insert" ON parking_plans
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_plans_update" ON parking_plans;
CREATE POLICY "parking_plans_update" ON parking_plans
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_plans_delete" ON parking_plans;
CREATE POLICY "parking_plans_delete" ON parking_plans
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 10. Parking spots — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parking_spots_insert" ON parking_spots;
CREATE POLICY "parking_spots_insert" ON parking_spots
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_spots_update" ON parking_spots;
CREATE POLICY "parking_spots_update" ON parking_spots
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_spots_delete" ON parking_spots;
CREATE POLICY "parking_spots_delete" ON parking_spots
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 11. Parking obstacles — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parking_obstacles_insert" ON parking_obstacles;
CREATE POLICY "parking_obstacles_insert" ON parking_obstacles
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_obstacles_update" ON parking_obstacles;
CREATE POLICY "parking_obstacles_update" ON parking_obstacles
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_obstacles_delete" ON parking_obstacles;
CREATE POLICY "parking_obstacles_delete" ON parking_obstacles
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 12. Parking taxilanes — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parking_taxilanes_insert" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_insert" ON parking_taxilanes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_taxilanes_update" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_update" ON parking_taxilanes
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_taxilanes_delete" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_delete" ON parking_taxilanes
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 13. Parking apron boundaries — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parking_apron_boundaries_insert" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_insert" ON parking_apron_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_apron_boundaries_update" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_update" ON parking_apron_boundaries
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "parking_apron_boundaries_delete" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_delete" ON parking_apron_boundaries
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 14. Base taxiways — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "base_taxiways_insert" ON base_taxiways;
CREATE POLICY "base_taxiways_insert" ON base_taxiways
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "base_taxiways_update" ON base_taxiways;
CREATE POLICY "base_taxiways_update" ON base_taxiways
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "base_taxiways_delete" ON base_taxiways;
CREATE POLICY "base_taxiways_delete" ON base_taxiways
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 15. Base facilities — add base_id scoping (was missing)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Writers can manage facilities" ON base_facilities;
DROP POLICY IF EXISTS "base_facilities_write" ON base_facilities;
CREATE POLICY "base_facilities_write" ON base_facilities
  FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 16. Airfield contractors — add user_can_write() to INSERT/UPDATE
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "airfield_contractors_insert" ON airfield_contractors;
CREATE POLICY "airfield_contractors_insert" ON airfield_contractors
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "airfield_contractors_update" ON airfield_contractors;
CREATE POLICY "airfield_contractors_update" ON airfield_contractors
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 17. QRC executions — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "qrc_exec_insert" ON qrc_executions;
CREATE POLICY "qrc_exec_insert" ON qrc_executions
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "qrc_exec_update" ON qrc_executions;
CREATE POLICY "qrc_exec_update" ON qrc_executions
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "qrc_exec_delete" ON qrc_executions;
CREATE POLICY "qrc_exec_delete" ON qrc_executions
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 18. Shift checklists — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sc_insert" ON shift_checklists;
CREATE POLICY "sc_insert" ON shift_checklists
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

DROP POLICY IF EXISTS "sc_update" ON shift_checklists;
CREATE POLICY "sc_update" ON shift_checklists
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 19. Shift checklist responses — add user_can_write()
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "scr_insert" ON shift_checklist_responses;
CREATE POLICY "scr_insert" ON shift_checklist_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM shift_checklists sc WHERE sc.id = checklist_id AND user_has_base_access(auth.uid(), sc.base_id))
    AND user_can_write(auth.uid())
  );

DROP POLICY IF EXISTS "scr_update" ON shift_checklist_responses;
CREATE POLICY "scr_update" ON shift_checklist_responses
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM shift_checklists sc WHERE sc.id = checklist_id AND user_has_base_access(auth.uid(), sc.base_id))
    AND user_can_write(auth.uid())
  );
