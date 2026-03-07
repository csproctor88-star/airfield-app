-- Allow base users to delete QRC executions (for cancel functionality)
CREATE POLICY "qrc_exec_delete" ON qrc_executions FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id));
