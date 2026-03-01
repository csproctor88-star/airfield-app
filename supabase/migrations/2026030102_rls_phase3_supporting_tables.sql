-- ============================================================
-- Phase 3: Supporting Table Policies (Role-Aware)
-- Includes special cases for comments, activity log, base_members
-- ============================================================

-- ============================================================
-- photos — standard write pattern
-- ============================================================
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON photos
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "photos_insert" ON photos
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "photos_update" ON photos
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "photos_delete" ON photos
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- status_updates — standard write pattern
-- ============================================================
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_updates_select" ON status_updates
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "status_updates_insert" ON status_updates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "status_updates_update" ON status_updates
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "status_updates_delete" ON status_updates
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- navaid_statuses — standard write pattern
-- ============================================================
ALTER TABLE navaid_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "navaid_statuses_select" ON navaid_statuses
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "navaid_statuses_insert" ON navaid_statuses
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "navaid_statuses_update" ON navaid_statuses
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "navaid_statuses_delete" ON navaid_statuses
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- airfield_status — standard write pattern
-- ============================================================
ALTER TABLE airfield_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airfield_status_select" ON airfield_status
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "airfield_status_insert" ON airfield_status
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "airfield_status_update" ON airfield_status
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "airfield_status_delete" ON airfield_status
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- check_comments — SPECIAL: all base members can INSERT (CES/safety/ATC
-- can comment on checks they observe); only writable roles can DELETE
-- ============================================================
ALTER TABLE check_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_comments_select" ON check_comments
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "check_comments_insert" ON check_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "check_comments_update" ON check_comments
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "check_comments_delete" ON check_comments
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

-- ============================================================
-- activity_log — SPECIAL: all base members can SELECT and INSERT
-- (logging must work for everyone); UPDATE/DELETE restricted to
-- own entries OR admin roles
-- ============================================================
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "activity_log_update" ON activity_log
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND (user_id = auth.uid() OR user_is_admin(auth.uid())));

CREATE POLICY "activity_log_delete" ON activity_log
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND (user_id = auth.uid() OR user_is_admin(auth.uid())));

-- ============================================================
-- runway_status_log — SELECT for base members; INSERT for base members
-- (trigger is SECURITY DEFINER, bypasses RLS anyway)
-- ============================================================
ALTER TABLE runway_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runway_status_log_select" ON runway_status_log
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "runway_status_log_insert" ON runway_status_log
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

-- ============================================================
-- base_members — SELECT if member of that base; write for admin only
-- ============================================================
ALTER TABLE base_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_members_select" ON base_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_has_base_access(auth.uid(), base_id)
  );

CREATE POLICY "base_members_insert" ON base_members
  FOR INSERT TO authenticated
  WITH CHECK (user_is_admin(auth.uid()));

CREATE POLICY "base_members_update" ON base_members
  FOR UPDATE TO authenticated
  USING (user_is_admin(auth.uid()));

CREATE POLICY "base_members_delete" ON base_members
  FOR DELETE TO authenticated
  USING (user_is_admin(auth.uid()));
