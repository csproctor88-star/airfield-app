-- ============================================================
-- Phase 3b step 6 — Airport Emergency Plan: storage RLS
--
-- AEP artifacts (plan document PDFs and drill after-action reports)
-- upload to the existing `photos` bucket under two prefixes:
--
--   aep-plans/<base_id>/<plan_id>/plan-<ts>.<ext>
--   aep-drills/<base_id>/<drill_id>/aar-<ts>.<ext>
--
-- Same rationale as 2026053005_training_storage_rls.sql: we do NOT
-- extend the existing path-scoped photos_insert policy. Instead a
-- separate INSERT policy gates only on aep:write, because a role
-- like accountable_executive holds aep:write (and aep:sign) but
-- not photos:write. RLS policies of the same role/op are OR'd so
-- the two paths coexist without conflict.
--
-- Base scoping comes from path segment 2 (the base_id UUID); the
-- plan_id / drill_id segment isn't validated at the storage layer
-- (the row-write RLS on aep_plans / aep_drills handles that).
--
-- UPDATE / DELETE not added — supersede + AAR replacement are append-
-- only (orphans tracked for a future maintenance sweep, same trade-
-- off as training-evidence/).
-- ============================================================

DROP POLICY IF EXISTS "aep_artifacts_insert" ON storage.objects;
CREATE POLICY "aep_artifacts_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (name LIKE 'aep-plans/%' OR name LIKE 'aep-drills/%')
    AND public.user_has_permission(auth.uid(), 'aep:write')
    AND public.user_has_base_access(
      auth.uid(),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );
