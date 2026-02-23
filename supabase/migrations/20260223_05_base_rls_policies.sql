-- ============================================================
-- Multi-Base RLS Policies
-- Scopes operational data to the user's base memberships
-- ============================================================

-- Helper function: check if a user belongs to a given base
CREATE OR REPLACE FUNCTION user_has_base_access(p_user_id UUID, p_base_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL base_id = legacy row, accessible to all authenticated users
  IF p_base_id IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM base_members
    WHERE user_id = p_user_id
      AND base_id = p_base_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function: check if user is sys_admin
CREATE OR REPLACE FUNCTION user_is_sys_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role = 'sys_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- bases table: readable by all authenticated, writable by sys_admin
-- ============================================================
ALTER TABLE bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bases_read" ON bases
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "bases_write" ON bases
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- base_runways: readable by all authenticated, writable by sys_admin
-- ============================================================
ALTER TABLE base_runways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_runways_read" ON base_runways
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_runways_write" ON base_runways
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- base_navaids: readable by all authenticated, writable by sys_admin
-- ============================================================
ALTER TABLE base_navaids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_navaids_read" ON base_navaids
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_navaids_write" ON base_navaids
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- base_areas: readable by all authenticated, writable by sys_admin
-- ============================================================
ALTER TABLE base_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_areas_read" ON base_areas
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_areas_write" ON base_areas
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- base_members: readable by members of that base, writable by sys_admin
-- ============================================================
ALTER TABLE base_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_members_read" ON base_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_base_access(auth.uid(), base_id)
    OR user_is_sys_admin(auth.uid())
  );

CREATE POLICY "base_members_write" ON base_members
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- Operational tables: base-scoped read/write
-- Pattern: SELECT if user has access to the row's base_id
--          INSERT/UPDATE/DELETE if user has access to the row's base_id
-- ============================================================

-- discrepancies
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discrepancies_select" ON discrepancies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "discrepancies_insert" ON discrepancies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "discrepancies_update" ON discrepancies
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "discrepancies_delete" ON discrepancies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- inspections
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspections_select" ON inspections
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "inspections_insert" ON inspections
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "inspections_update" ON inspections
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "inspections_delete" ON inspections
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- airfield_checks
ALTER TABLE airfield_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airfield_checks_select" ON airfield_checks
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_checks_insert" ON airfield_checks
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_checks_update" ON airfield_checks
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_checks_delete" ON airfield_checks
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- obstruction_evaluations
ALTER TABLE obstruction_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obstruction_evaluations_select" ON obstruction_evaluations
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "obstruction_evaluations_insert" ON obstruction_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "obstruction_evaluations_update" ON obstruction_evaluations
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "obstruction_evaluations_delete" ON obstruction_evaluations
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- notams
ALTER TABLE notams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notams_select" ON notams
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "notams_insert" ON notams
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "notams_update" ON notams
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "notams_delete" ON notams
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- navaid_statuses
ALTER TABLE navaid_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "navaid_statuses_select" ON navaid_statuses
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "navaid_statuses_insert" ON navaid_statuses
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "navaid_statuses_update" ON navaid_statuses
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- airfield_status
ALTER TABLE airfield_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airfield_status_select" ON airfield_status
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_status_insert" ON airfield_status
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_status_update" ON airfield_status
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- runway_status_log
ALTER TABLE runway_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runway_status_log_select" ON runway_status_log
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "runway_status_log_insert" ON runway_status_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

-- activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

-- photos
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON photos
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "photos_insert" ON photos
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "photos_delete" ON photos
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- status_updates
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_updates_select" ON status_updates
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "status_updates_insert" ON status_updates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

-- check_comments
ALTER TABLE check_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_comments_select" ON check_comments
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "check_comments_insert" ON check_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

-- ============================================================
-- profiles: users can read all profiles, update only their own
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- Shared tables (no base_id): accessible to all authenticated
-- ============================================================

-- regulations (shared reference data)
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regulations_read" ON regulations
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "regulations_write" ON regulations
  FOR ALL TO authenticated
  USING (user_is_sys_admin(auth.uid()));
