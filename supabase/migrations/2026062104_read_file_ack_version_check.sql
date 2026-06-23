-- ============================================================
-- Read File — Hardening: server-validate acknowledged_version
--
-- The original read_file_ack_insert policy trusted the client-supplied
-- acknowledged_version. A read_file:view user could insert an ack for a
-- version the file is not at (e.g. a future number), which would later
-- read as "already reviewed" once the file was replaced up to that
-- version — defeating the read-and-initial audit trail.
--
-- Recreate the insert policy so acknowledged_version MUST equal the
-- current version of the referenced file. The read_files subselect runs
-- under the inserter's RLS (they hold read_file:view at the base), so a
-- file they can't see yields NULL and the equality fails (insert denied).
-- ============================================================

DROP POLICY "read_file_ack_insert" ON read_file_acknowledgments;

CREATE POLICY "read_file_ack_insert" ON read_file_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'read_file:view')
    AND acknowledged_version = (
      SELECT version FROM read_files WHERE id = read_file_id
    )
  );
