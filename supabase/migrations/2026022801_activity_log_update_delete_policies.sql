-- Allow authenticated users to update and delete activity_log entries for their base
CREATE POLICY "activity_log_update" ON activity_log
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id))
  WITH CHECK (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "activity_log_delete" ON activity_log
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));
