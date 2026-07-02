-- ============================================================
-- photos bucket — base-scope obstruction-photos reads + email-temp
--
-- Finding (audit 2026-07-01, LOW; pentest L-8): the 'photos' bucket policies left
-- two path prefixes unscoped —
--   • obstruction-photos/%  : readable by ANY authenticated user (cross-tenant read)
--   • email-temp/%          : readable/updatable/deletable by ANY authenticated user
--                             (overwrite/delete another user's staged email PDFs)
--
-- Fix (only these two prefixes change; every other clause is reproduced verbatim):
--   • email-temp: scope all of SELECT/INSERT/UPDATE/DELETE to owner = auth.uid()
--     (each temp file is per-user staging; verified all live rows have owner set).
--   • obstruction-photos SELECT: allow the uploader (owner) OR anyone who can see the
--     tracking row in public.photos (which is base-scoped by its own RLS). INSERT is
--     left open (photos:write) because the flat path carries no base id and the
--     base-scoped public.photos row is created immediately after upload.
--
-- All CRUD policies are PERMISSIVE / TO authenticated. Verified against pg_policies
-- after apply.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS photos_select_path_scoped ON storage.objects;
CREATE POLICY photos_select_path_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos' AND (
      (name LIKE 'discrepancy-photos/%' AND EXISTS (SELECT 1 FROM public.discrepancies d WHERE d.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), d.base_id)))
      OR (name LIKE 'check-photos/%' AND EXISTS (SELECT 1 FROM public.airfield_checks c WHERE c.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), c.base_id)))
      OR (name LIKE 'inspection-photos/%' AND EXISTS (SELECT 1 FROM public.inspections i WHERE i.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), i.base_id)))
      OR (name LIKE 'acsi-photos/%' AND EXISTS (SELECT 1 FROM public.acsi_inspections a WHERE a.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), a.base_id)))
      OR (name LIKE 'airfield-diagrams/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR ((name LIKE 'aep-plans/%' OR name LIKE 'aep-drills/%') AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'whmp/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'training-evidence/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'obstruction-photos/%' AND (owner = auth.uid() OR EXISTS (SELECT 1 FROM public.photos p WHERE p.storage_path = objects.name OR p.thumbnail_path = objects.name)))
      OR (name LIKE 'email-temp/%' AND owner = auth.uid())
    )
  );

DROP POLICY IF EXISTS photos_insert_path_scoped ON storage.objects;
CREATE POLICY photos_insert_path_scoped ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'photos' AND user_has_permission(auth.uid(), 'photos:write') AND (
      (name LIKE 'discrepancy-photos/%' AND EXISTS (SELECT 1 FROM public.discrepancies d WHERE d.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), d.base_id)))
      OR (name LIKE 'check-photos/%' AND EXISTS (SELECT 1 FROM public.airfield_checks c WHERE c.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), c.base_id)))
      OR (name LIKE 'inspection-photos/%' AND EXISTS (SELECT 1 FROM public.inspections i WHERE i.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), i.base_id)))
      OR (name LIKE 'acsi-photos/%' AND EXISTS (SELECT 1 FROM public.acsi_inspections a WHERE a.id = NULLIF(split_part(objects.name,'/',2),'')::uuid AND user_has_base_access(auth.uid(), a.base_id)))
      OR (name LIKE 'obstruction-photos/%')
      OR (name LIKE 'airfield-diagrams/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'email-temp/%' AND owner = auth.uid())
    )
  );

DROP POLICY IF EXISTS photos_update_path_scoped ON storage.objects;
CREATE POLICY photos_update_path_scoped ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'photos' AND user_has_permission(auth.uid(), 'photos:write') AND (
      EXISTS (SELECT 1 FROM public.photos p WHERE p.storage_path = objects.name OR p.thumbnail_path = objects.name)
      OR (name LIKE 'airfield-diagrams/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'email-temp/%' AND owner = auth.uid())
    )
  );

DROP POLICY IF EXISTS photos_delete_path_scoped ON storage.objects;
CREATE POLICY photos_delete_path_scoped ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'photos' AND user_has_permission(auth.uid(), 'photos:delete') AND (
      EXISTS (SELECT 1 FROM public.photos p WHERE p.storage_path = objects.name OR p.thumbnail_path = objects.name)
      OR (name LIKE 'airfield-diagrams/%' AND user_has_base_access(auth.uid(), NULLIF(split_part(name,'/',2),'')::uuid))
      OR (name LIKE 'email-temp/%' AND owner = auth.uid())
    )
  );

COMMIT;
