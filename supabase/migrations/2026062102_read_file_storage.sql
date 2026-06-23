-- ============================================================
-- Read File — Migration 3/4: storage bucket
--
-- Bucket 'read-files'. Path convention: {base_id}/{timestamp}-{filename}.
-- The first path segment is the base UUID directly (simpler than AMTR's
-- member->base hop). Access = base access + the read_file permission.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('read-files', 'read-files', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "read_files_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_files_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'read-files'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );
