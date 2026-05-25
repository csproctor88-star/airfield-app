-- ============================================================
-- AMTR — Migration 6/6: storage bucket for supporting files
--
-- Bucket 'amtr-files'. Path convention: {member_id}/{filename}.
-- Access is derived from the member's base: the first path segment
-- is the amtr_members UUID, joined to resolve base_id, then gated
-- by base access + the amtr permission (view to read, write to
-- upload, delete to remove). Mirrors the path-scoped photos bucket.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('amtr-files', 'amtr-files', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Helper: resolve the base_id for the member UUID in the path's first segment.
CREATE OR REPLACE FUNCTION public.amtr_base_for_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT m.base_id
  FROM amtr_members m
  WHERE m.id = NULLIF((storage.foldername(p_name))[1], '')::uuid
$$;
GRANT EXECUTE ON FUNCTION public.amtr_base_for_path(TEXT) TO authenticated;

CREATE POLICY "amtr_files_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'amtr-files'
    AND user_has_base_access(auth.uid(), amtr_base_for_path(name))
    AND user_has_permission(auth.uid(), 'amtr:view')
  );

CREATE POLICY "amtr_files_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'amtr-files'
    AND user_has_base_access(auth.uid(), amtr_base_for_path(name))
    AND user_has_permission(auth.uid(), 'amtr:write')
  );

CREATE POLICY "amtr_files_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'amtr-files'
    AND user_has_base_access(auth.uid(), amtr_base_for_path(name))
    AND user_has_permission(auth.uid(), 'amtr:delete')
  );
