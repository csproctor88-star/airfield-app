-- ============================================================
-- Phase D2b — Swap parking / infrastructure / daily reviews /
--              audit tables / photos to the permission matrix
--
-- Tables in this batch (14):
--   parking_plans, parking_spots, parking_obstacles,
--   parking_taxilanes, parking_apron_boundaries,
--   infrastructure_features,
--   lighting_systems, lighting_system_components,
--   daily_reviews,
--   activity_log,
--   status_updates,
--   runway_status_log, arff_status_log,
--   photos
--
-- Also adds `photos:write` + `photos:delete` permission keys and
-- seeds them to the roles that already write to any operational
-- module, preserving today's effective behavior.
-- ============================================================

-- ── New permission keys for photos ─────────────────────────
INSERT INTO permissions (key, label, category, description) VALUES
  ('photos:write',  'Upload / attach photos',  'ops', 'Attach photos to any operational record (discrepancies, wildlife, inspections, etc.)'),
  ('photos:delete', 'Delete photos',           'ops', NULL)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label, description = EXCLUDED.description;

-- Seed photos:write to roles that currently can upload via user_can_write
-- plus the Phase C narrow roles (CES, Safety, PPR) since each of those
-- roles owns writes to at least one module that attaches photos.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('sys_admin',        'photos:write'),
  ('airfield_manager', 'photos:write'),
  ('namo',             'photos:write'),
  ('base_admin',       'photos:write'),
  ('amops',            'photos:write'),
  ('ces',              'photos:write'),
  ('safety',           'photos:write'),
  ('ppr',              'photos:write'),
  ('sys_admin',        'photos:delete'),
  ('airfield_manager', 'photos:delete'),
  ('namo',             'photos:delete'),
  ('base_admin',       'photos:delete'),
  ('amops',            'photos:delete')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ── Parking (5 tables) ─────────────────────────────────────
DROP POLICY IF EXISTS "parking_plans_insert" ON parking_plans;
CREATE POLICY "parking_plans_insert" ON parking_plans
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_plans_update" ON parking_plans;
CREATE POLICY "parking_plans_update" ON parking_plans
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_plans_delete" ON parking_plans;
CREATE POLICY "parking_plans_delete" ON parking_plans
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:delete'));

DROP POLICY IF EXISTS "parking_spots_insert" ON parking_spots;
CREATE POLICY "parking_spots_insert" ON parking_spots
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_spots_update" ON parking_spots;
CREATE POLICY "parking_spots_update" ON parking_spots
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_spots_delete" ON parking_spots;
CREATE POLICY "parking_spots_delete" ON parking_spots
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_obstacles_insert" ON parking_obstacles;
CREATE POLICY "parking_obstacles_insert" ON parking_obstacles
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_obstacles_update" ON parking_obstacles;
CREATE POLICY "parking_obstacles_update" ON parking_obstacles
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_obstacles_delete" ON parking_obstacles;
CREATE POLICY "parking_obstacles_delete" ON parking_obstacles
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_taxilanes_insert" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_insert" ON parking_taxilanes
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_taxilanes_update" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_update" ON parking_taxilanes
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_taxilanes_delete" ON parking_taxilanes;
CREATE POLICY "parking_taxilanes_delete" ON parking_taxilanes
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_apron_boundaries_insert" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_insert" ON parking_apron_boundaries
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_apron_boundaries_update" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_update" ON parking_apron_boundaries
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

DROP POLICY IF EXISTS "parking_apron_boundaries_delete" ON parking_apron_boundaries;
CREATE POLICY "parking_apron_boundaries_delete" ON parking_apron_boundaries
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'parking:write'));

-- ── Infrastructure features ────────────────────────────────
DROP POLICY IF EXISTS "infrastructure_features_insert" ON infrastructure_features;
CREATE POLICY "infrastructure_features_insert" ON infrastructure_features
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "infrastructure_features_update" ON infrastructure_features;
CREATE POLICY "infrastructure_features_update" ON infrastructure_features
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "infrastructure_features_delete" ON infrastructure_features;
CREATE POLICY "infrastructure_features_delete" ON infrastructure_features
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:delete'));

-- ── Lighting systems + components ──────────────────────────
DROP POLICY IF EXISTS "lighting_systems_insert" ON lighting_systems;
CREATE POLICY "lighting_systems_insert" ON lighting_systems
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "lighting_systems_update" ON lighting_systems;
CREATE POLICY "lighting_systems_update" ON lighting_systems
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "lighting_systems_delete" ON lighting_systems;
CREATE POLICY "lighting_systems_delete" ON lighting_systems
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:delete'));

DROP POLICY IF EXISTS "lighting_system_components_insert" ON lighting_system_components;
CREATE POLICY "lighting_system_components_insert" ON lighting_system_components
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'infrastructure:write')
    AND EXISTS (
      SELECT 1 FROM lighting_systems s
      WHERE s.id = system_id
        AND user_has_base_access(auth.uid(), s.base_id)
    )
  );

DROP POLICY IF EXISTS "lighting_system_components_update" ON lighting_system_components;
CREATE POLICY "lighting_system_components_update" ON lighting_system_components
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'infrastructure:write')
    AND EXISTS (
      SELECT 1 FROM lighting_systems s
      WHERE s.id = system_id
        AND user_has_base_access(auth.uid(), s.base_id)
    )
  );

DROP POLICY IF EXISTS "lighting_system_components_delete" ON lighting_system_components;
CREATE POLICY "lighting_system_components_delete" ON lighting_system_components
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'infrastructure:delete')
    AND EXISTS (
      SELECT 1 FROM lighting_systems s
      WHERE s.id = system_id
        AND user_has_base_access(auth.uid(), s.base_id)
    )
  );

-- ── Daily Reviews ──────────────────────────────────────────
-- Anyone who can sign at least one slot can upsert the row. The app
-- layer enforces WHICH slot a given role is allowed to populate.
DROP POLICY IF EXISTS "daily_reviews_insert" ON daily_reviews;
CREATE POLICY "daily_reviews_insert" ON daily_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'daily_reviews:sign:amsl')
      OR user_has_permission(auth.uid(), 'daily_reviews:sign:namo')
      OR user_has_permission(auth.uid(), 'daily_reviews:sign:afm')
    )
  );

DROP POLICY IF EXISTS "daily_reviews_update" ON daily_reviews;
CREATE POLICY "daily_reviews_update" ON daily_reviews
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'daily_reviews:sign:amsl')
      OR user_has_permission(auth.uid(), 'daily_reviews:sign:namo')
      OR user_has_permission(auth.uid(), 'daily_reviews:sign:afm')
    )
  );

-- ── Activity Log ───────────────────────────────────────────
-- INSERT: anyone with activity_log:write_manual (drives the Events
-- Log "Log Entry" form). Modules that write their own activity_log
-- rows should also succeed because the writable roles in those
-- modules (AFM/NAMO/AMOPS/admins) all have write_manual in their
-- Phase A bundle.
DROP POLICY IF EXISTS "activity_log_insert" ON activity_log;
CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'activity_log:write_manual')
  );

-- UPDATE / DELETE: own row OR activity_log:delete (admin-tier)
DROP POLICY IF EXISTS "activity_log_update" ON activity_log;
CREATE POLICY "activity_log_update" ON activity_log
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_permission(auth.uid(), 'activity_log:delete')
  );

DROP POLICY IF EXISTS "activity_log_delete" ON activity_log;
CREATE POLICY "activity_log_delete" ON activity_log
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_permission(auth.uid(), 'activity_log:delete')
  );

-- ── Status updates (discrepancy audit / notes) ─────────────
-- Writes happen from several code paths: the CES RPC (bypasses RLS),
-- AFM/NAMO/AMOPS direct updates (discrepancies:write), and explicit
-- notes via the modal (discrepancies:add_note or :transition).
DROP POLICY IF EXISTS "status_updates_insert" ON status_updates;
CREATE POLICY "status_updates_insert" ON status_updates
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_has_permission(auth.uid(), 'discrepancies:write')
      OR user_has_permission(auth.uid(), 'discrepancies:add_note')
      OR user_has_permission(auth.uid(), 'discrepancies:transition:ces_statuses')
    )
  );

DROP POLICY IF EXISTS "status_updates_update" ON status_updates;
CREATE POLICY "status_updates_update" ON status_updates
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'discrepancies:write')
  );

DROP POLICY IF EXISTS "status_updates_delete" ON status_updates;
CREATE POLICY "status_updates_delete" ON status_updates
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'discrepancies:delete')
  );

-- ── Runway status log (no base_id — audit only) ────────────
-- Accept either the full airfield_status:write or the narrow
-- Safety RSC/BWC permission, since Safety's RPC writes here too.
DROP POLICY IF EXISTS "runway_status_log_insert" ON runway_status_log;
CREATE POLICY "runway_status_log_insert" ON runway_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'airfield_status:write')
    OR user_has_permission(auth.uid(), 'airfield_status:write:rsc_bwc_only')
  );

-- ── ARFF status log ────────────────────────────────────────
DROP POLICY IF EXISTS "arff_status_log_insert" ON arff_status_log;
CREATE POLICY "arff_status_log_insert" ON arff_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'airfield_status:write')
  );

-- ── Photos ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "photos_insert" ON photos;
CREATE POLICY "photos_insert" ON photos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'photos:write')
  );

DROP POLICY IF EXISTS "photos_update" ON photos;
CREATE POLICY "photos_update" ON photos
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'photos:write')
  );

DROP POLICY IF EXISTS "photos_delete" ON photos;
CREATE POLICY "photos_delete" ON photos
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'photos:delete')
  );
