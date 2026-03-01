-- ============================================================
-- Phase 1: RLS Helpers & Config/Global Table Policies
-- Replaces 2026022305_base_rls_policies.sql with role-aware enforcement
-- ============================================================

-- ============================================================
-- Step 1: Drop ALL existing policies from the old migration
-- ============================================================

-- Config tables
DROP POLICY IF EXISTS "bases_read" ON bases;
DROP POLICY IF EXISTS "bases_write" ON bases;
DROP POLICY IF EXISTS "base_runways_read" ON base_runways;
DROP POLICY IF EXISTS "base_runways_write" ON base_runways;
DROP POLICY IF EXISTS "base_navaids_read" ON base_navaids;
DROP POLICY IF EXISTS "base_navaids_write" ON base_navaids;
DROP POLICY IF EXISTS "base_areas_read" ON base_areas;
DROP POLICY IF EXISTS "base_areas_write" ON base_areas;

-- base_members
DROP POLICY IF EXISTS "base_members_read" ON base_members;
DROP POLICY IF EXISTS "base_members_write" ON base_members;

-- Operational tables
DROP POLICY IF EXISTS "discrepancies_select" ON discrepancies;
DROP POLICY IF EXISTS "discrepancies_insert" ON discrepancies;
DROP POLICY IF EXISTS "discrepancies_update" ON discrepancies;
DROP POLICY IF EXISTS "discrepancies_delete" ON discrepancies;

DROP POLICY IF EXISTS "inspections_select" ON inspections;
DROP POLICY IF EXISTS "inspections_insert" ON inspections;
DROP POLICY IF EXISTS "inspections_update" ON inspections;
DROP POLICY IF EXISTS "inspections_delete" ON inspections;

DROP POLICY IF EXISTS "airfield_checks_select" ON airfield_checks;
DROP POLICY IF EXISTS "airfield_checks_insert" ON airfield_checks;
DROP POLICY IF EXISTS "airfield_checks_update" ON airfield_checks;
DROP POLICY IF EXISTS "airfield_checks_delete" ON airfield_checks;

DROP POLICY IF EXISTS "obstruction_evaluations_select" ON obstruction_evaluations;
DROP POLICY IF EXISTS "obstruction_evaluations_insert" ON obstruction_evaluations;
DROP POLICY IF EXISTS "obstruction_evaluations_update" ON obstruction_evaluations;
DROP POLICY IF EXISTS "obstruction_evaluations_delete" ON obstruction_evaluations;

DROP POLICY IF EXISTS "notams_select" ON notams;
DROP POLICY IF EXISTS "notams_insert" ON notams;
DROP POLICY IF EXISTS "notams_update" ON notams;
DROP POLICY IF EXISTS "notams_delete" ON notams;

DROP POLICY IF EXISTS "navaid_statuses_select" ON navaid_statuses;
DROP POLICY IF EXISTS "navaid_statuses_insert" ON navaid_statuses;
DROP POLICY IF EXISTS "navaid_statuses_update" ON navaid_statuses;

DROP POLICY IF EXISTS "airfield_status_select" ON airfield_status;
DROP POLICY IF EXISTS "airfield_status_insert" ON airfield_status;
DROP POLICY IF EXISTS "airfield_status_update" ON airfield_status;

DROP POLICY IF EXISTS "runway_status_log_select" ON runway_status_log;
DROP POLICY IF EXISTS "runway_status_log_insert" ON runway_status_log;

DROP POLICY IF EXISTS "activity_log_select" ON activity_log;
DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
DROP POLICY IF EXISTS "activity_log_update" ON activity_log;
DROP POLICY IF EXISTS "activity_log_delete" ON activity_log;

DROP POLICY IF EXISTS "photos_select" ON photos;
DROP POLICY IF EXISTS "photos_insert" ON photos;
DROP POLICY IF EXISTS "photos_delete" ON photos;

DROP POLICY IF EXISTS "status_updates_select" ON status_updates;
DROP POLICY IF EXISTS "status_updates_insert" ON status_updates;

DROP POLICY IF EXISTS "check_comments_select" ON check_comments;
DROP POLICY IF EXISTS "check_comments_insert" ON check_comments;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

DROP POLICY IF EXISTS "regulations_read" ON regulations;
DROP POLICY IF EXISTS "regulations_write" ON regulations;

-- ============================================================
-- Step 2: Fix user_has_base_access() — add sys_admin bypass
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_base_access(p_user_id UUID, p_base_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- NULL base_id = legacy row, accessible to all authenticated users
  IF p_base_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- sys_admin can access all bases
  IF user_is_sys_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM base_members
    WHERE user_id = p_user_id
      AND base_id = p_base_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Step 3: New helper — user_can_write(p_user_id)
-- TRUE for roles that can create/edit/delete operational records
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_write(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role IN ('sys_admin', 'base_admin', 'airfield_manager', 'namo', 'amops')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Step 4: New helper — user_is_admin(p_user_id)
-- TRUE for roles that can manage users and base config
-- ============================================================
CREATE OR REPLACE FUNCTION user_is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
      AND role IN ('sys_admin', 'base_admin', 'airfield_manager', 'namo')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Step 5: Config table policies
-- SELECT: all authenticated; INSERT/UPDATE/DELETE: sys_admin only
-- ============================================================

-- bases
ALTER TABLE bases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bases_select" ON bases
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "bases_insert" ON bases
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

CREATE POLICY "bases_update" ON bases
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

CREATE POLICY "bases_delete" ON bases
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- base_runways
ALTER TABLE base_runways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_runways_select" ON base_runways
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_runways_insert" ON base_runways
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_runways_update" ON base_runways
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_runways_delete" ON base_runways
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- base_navaids
ALTER TABLE base_navaids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_navaids_select" ON base_navaids
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_navaids_insert" ON base_navaids
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_navaids_update" ON base_navaids
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_navaids_delete" ON base_navaids
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- base_areas
ALTER TABLE base_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_areas_select" ON base_areas
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "base_areas_insert" ON base_areas
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_areas_update" ON base_areas
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

CREATE POLICY "base_areas_delete" ON base_areas
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- Step 6: profiles
-- SELECT: all authenticated
-- UPDATE: own row OR admin
-- INSERT: admin only (user creation flow)
-- DELETE: sys_admin only
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR user_is_admin(auth.uid()));

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_is_admin(auth.uid()));

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- Step 7: regulations
-- SELECT: all authenticated
-- INSERT/UPDATE/DELETE: sys_admin only
-- ============================================================
ALTER TABLE regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regulations_select" ON regulations
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "regulations_insert" ON regulations
  FOR INSERT TO authenticated
  WITH CHECK (user_is_sys_admin(auth.uid()));

CREATE POLICY "regulations_update" ON regulations
  FOR UPDATE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

CREATE POLICY "regulations_delete" ON regulations
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));

-- ============================================================
-- Step 8: user_regulation_pdfs
-- All operations scoped to user_id = auth.uid()
-- ============================================================
ALTER TABLE user_regulation_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_regulation_pdfs_select" ON user_regulation_pdfs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_regulation_pdfs_insert" ON user_regulation_pdfs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_regulation_pdfs_update" ON user_regulation_pdfs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_regulation_pdfs_delete" ON user_regulation_pdfs
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
