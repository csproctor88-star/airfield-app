-- Audit H-4 (HIGH): base-scope the waiver-attachments storage bucket.
--
-- The bucket's original policies (2026022509) were "RLS disabled for MVP" —
-- TO authenticated USING (bucket_id = 'waiver-attachments') only, so any
-- authenticated user at any base could list / download / delete another base's
-- AF Form 505 supporting documents. Every other bucket (amtr-files, flip,
-- read-files) is base-scoped; this one predates that pattern.
--
-- PATH NOTE: the uploader (lib/supabase/waivers.ts) passes the path
-- `waiver-attachments/<waiver_id>/<ts>.<ext>` to .from('waiver-attachments')
-- .upload(...), so the stored object `name` is literally
-- "waiver-attachments/<waiver_id>/<ts>.<ext>" — the bucket name is duplicated
-- as segment 1 and the BASE ID IS NOT IN THE PATH. So we mirror the amtr-files
-- pattern: a SECURITY DEFINER helper resolves base_id from the waiver_id in
-- path segment [2]. This works for already-uploaded objects with no data
-- migration and no change to the uploader (expand-only).

BEGIN;

-- Helper: resolve the owning base for a waiver-attachments object path.
CREATE OR REPLACE FUNCTION public.waiver_base_for_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT w.base_id
  FROM waivers w
  WHERE w.id = NULLIF((storage.foldername(p_name))[2], '')::uuid
$$;
GRANT EXECUTE ON FUNCTION public.waiver_base_for_path(TEXT) TO authenticated;

-- Drop the wide-open MVP policies (exact names from 2026022509).
DROP POLICY IF EXISTS "Allow authenticated upload waiver attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read waiver attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete waiver attachments" ON storage.objects;

-- Base-scoped + permission-gated replacements (mirrors amtr-files triplet;
-- waivers table itself gates view/write/delete on these same keys).
CREATE POLICY "waiver_attachments_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'waiver-attachments'
    AND user_has_base_access(auth.uid(), waiver_base_for_path(name))
    AND user_has_permission(auth.uid(), 'waivers:view')
  );

CREATE POLICY "waiver_attachments_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'waiver-attachments'
    AND user_has_base_access(auth.uid(), waiver_base_for_path(name))
    AND user_has_permission(auth.uid(), 'waivers:write')
  );

CREATE POLICY "waiver_attachments_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'waiver-attachments'
    AND user_has_base_access(auth.uid(), waiver_base_for_path(name))
    AND user_has_permission(auth.uid(), 'waivers:delete')
  );

COMMIT;
