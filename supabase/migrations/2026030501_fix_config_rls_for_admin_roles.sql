-- ============================================================
-- Fix: Allow all admin-tier roles (sys_admin, base_admin,
-- airfield_manager, namo) to manage base configuration tables.
--
-- Previously, base_runways / base_navaids / base_areas write
-- policies used user_is_sys_admin() which only allows sys_admin.
-- This replaces them with user_is_admin() which includes all 4
-- admin-tier roles, matching the frontend canEdit checks and
-- the base_inspection_templates policies.
--
-- Also opens bases UPDATE to admin-tier roles (scoped to own
-- base) so base_admin/namo can edit CE shops, which are stored
-- as a column on the bases table. bases INSERT/DELETE remain
-- sys_admin-only.
--
-- Adds base_id scoping via user_has_base_access() so admins
-- can only modify config for their assigned installation.
-- ============================================================

-- ── bases (UPDATE only — INSERT/DELETE stay sys_admin) ────────

DROP POLICY IF EXISTS "bases_update" ON bases;

CREATE POLICY "bases_update" ON bases
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), id) AND user_is_admin(auth.uid()));

-- ── base_runways ──────────────────────────────────────────────

DROP POLICY IF EXISTS "base_runways_write" ON base_runways;
DROP POLICY IF EXISTS "base_runways_insert" ON base_runways;
DROP POLICY IF EXISTS "base_runways_update" ON base_runways;
DROP POLICY IF EXISTS "base_runways_delete" ON base_runways;

CREATE POLICY "base_runways_insert" ON base_runways
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_runways_update" ON base_runways
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_runways_delete" ON base_runways
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- ── base_navaids ──────────────────────────────────────────────

DROP POLICY IF EXISTS "base_navaids_write" ON base_navaids;
DROP POLICY IF EXISTS "base_navaids_insert" ON base_navaids;
DROP POLICY IF EXISTS "base_navaids_update" ON base_navaids;
DROP POLICY IF EXISTS "base_navaids_delete" ON base_navaids;

CREATE POLICY "base_navaids_insert" ON base_navaids
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_navaids_update" ON base_navaids
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_navaids_delete" ON base_navaids
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- ── base_areas ────────────────────────────────────────────────

DROP POLICY IF EXISTS "base_areas_write" ON base_areas;
DROP POLICY IF EXISTS "base_areas_insert" ON base_areas;
DROP POLICY IF EXISTS "base_areas_update" ON base_areas;
DROP POLICY IF EXISTS "base_areas_delete" ON base_areas;

CREATE POLICY "base_areas_insert" ON base_areas
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_areas_update" ON base_areas
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_areas_delete" ON base_areas
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
