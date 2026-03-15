-- Tighten parking module RLS policies to use role-aware access checks
-- Replaces USING (true) policies from 2026031500_create_parking_module.sql

-- ── Drop permissive policies ──
DROP POLICY IF EXISTS "parking_plans_select" ON parking_plans;
DROP POLICY IF EXISTS "parking_plans_insert" ON parking_plans;
DROP POLICY IF EXISTS "parking_plans_update" ON parking_plans;
DROP POLICY IF EXISTS "parking_plans_delete" ON parking_plans;

DROP POLICY IF EXISTS "parking_spots_select" ON parking_spots;
DROP POLICY IF EXISTS "parking_spots_insert" ON parking_spots;
DROP POLICY IF EXISTS "parking_spots_update" ON parking_spots;
DROP POLICY IF EXISTS "parking_spots_delete" ON parking_spots;

DROP POLICY IF EXISTS "parking_obstacles_select" ON parking_obstacles;
DROP POLICY IF EXISTS "parking_obstacles_insert" ON parking_obstacles;
DROP POLICY IF EXISTS "parking_obstacles_update" ON parking_obstacles;
DROP POLICY IF EXISTS "parking_obstacles_delete" ON parking_obstacles;

-- ── Parking Plans ──
CREATE POLICY "parking_plans_select" ON parking_plans
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_plans_insert" ON parking_plans
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_plans_update" ON parking_plans
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_plans_delete" ON parking_plans
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));

-- ── Parking Spots ──
CREATE POLICY "parking_spots_select" ON parking_spots
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_spots_insert" ON parking_spots
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_spots_update" ON parking_spots
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_spots_delete" ON parking_spots
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));

-- ── Parking Obstacles ──
CREATE POLICY "parking_obstacles_select" ON parking_obstacles
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_obstacles_insert" ON parking_obstacles
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_obstacles_update" ON parking_obstacles
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_obstacles_delete" ON parking_obstacles
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));
