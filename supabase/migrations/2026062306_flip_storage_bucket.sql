-- 2026062306_flip_storage_bucket.sql
-- Private 'flip' bucket for reference docs + submitted-change PDFs.
-- Path: <base_id>/references/<uuid> | <base_id>/changes/<uuid>

INSERT INTO storage.buckets (id, name, public)
VALUES ('flip', 'flip', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY "flip_files_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
  );

CREATE POLICY "flip_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
    AND user_has_permission(auth.uid(), 'flip:write')
  );

CREATE POLICY "flip_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'flip'
    AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 1), ''))::uuid)
    AND user_has_permission(auth.uid(), 'flip:write')
  );
