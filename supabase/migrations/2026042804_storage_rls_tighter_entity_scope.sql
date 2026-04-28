-- ============================================================
-- Re-introduce path-scoped RLS on the photos bucket, with
-- entity-base scoping for entity photo paths.
--
-- State of prod before this migration (post-2026042208):
--   INSERT  — bucket_id='photos' AND user_has_permission(uid, 'photos:write')
--   UPDATE  — bucket_id='photos' AND user_has_permission(uid, 'photos:write')
--   DELETE  — bucket_id='photos' AND user_has_permission(uid, 'photos:delete')
--
-- The 2026042208 permission-matrix cleanup correctly replaced the
-- legacy `user_can_write` check with the matrix permission, but in
-- doing so it also dropped the path-scoping work from 2026041600.
-- That left a hygiene gap: a user with photos:write at any base can
-- upload to ANY discrepancy/check/inspection/acsi UUID's prefix —
-- including entities they don't have base access to. The orphan
-- file blocks at the photos-table-INSERT layer (the row write
-- requires base access via the parent entity), but the storage
-- object persists and burns space.
--
-- This migration restores path scoping on top of the matrix
-- permission. Both checks must pass:
--   1. user_has_permission(uid, 'photos:write' / 'photos:delete')
--   2. The path's entity UUID resolves to a base the user has access to.
--
-- Helper: 2026042208 dropped user_can_write/is_admin. We use
-- user_has_permission + user_has_base_access exclusively here.
--
-- Path conventions (verified in lib/supabase/*):
--   - discrepancy-photos/{discrepancyId}/*
--   - check-photos/{checkId}/*
--   - inspection-photos/{inspectionId}/*
--   - acsi-photos/{inspectionId}/*
--   - obstruction-photos/{ts}-{rnd}.{ext}   (no entity UUID; stays prefix-scoped)
--   - airfield-diagrams/{baseId}/diagram
--   - email-temp/{uuid}-{filename}          (short-lived; auth-only)
-- ============================================================

DROP POLICY IF EXISTS "photos_insert_path_scoped" ON storage.objects;
DROP POLICY IF EXISTS "photos_update_path_scoped" ON storage.objects;
DROP POLICY IF EXISTS "photos_delete_path_scoped" ON storage.objects;

-- ── INSERT: matrix permission + path-scoped to entity's base ────────
CREATE POLICY "photos_insert_path_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:write')
    AND (
      (
        name LIKE 'discrepancy-photos/%'
        AND EXISTS (
          SELECT 1 FROM discrepancies d
          WHERE d.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND public.user_has_base_access(auth.uid(), d.base_id)
        )
      )
      OR (
        name LIKE 'check-photos/%'
        AND EXISTS (
          SELECT 1 FROM airfield_checks c
          WHERE c.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND public.user_has_base_access(auth.uid(), c.base_id)
        )
      )
      OR (
        name LIKE 'inspection-photos/%'
        AND EXISTS (
          SELECT 1 FROM inspections i
          WHERE i.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND public.user_has_base_access(auth.uid(), i.base_id)
        )
      )
      OR (
        name LIKE 'acsi-photos/%'
        AND EXISTS (
          SELECT 1 FROM acsi_inspections a
          WHERE a.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND public.user_has_base_access(auth.uid(), a.base_id)
        )
      )
      -- Obstruction photos: no entity UUID in path. Filtered to the
      -- user's base via the parent obstruction's RLS at fetch time.
      OR name LIKE 'obstruction-photos/%'

      OR (
        name LIKE 'airfield-diagrams/%'
        AND public.user_has_base_access(
          auth.uid(),
          NULLIF(split_part(name, '/', 2), '')::uuid
        )
      )

      -- Email-temp: short-lived PDF attachments staged for delivery.
      -- Authenticated + photos:write is enough; not base-scoped.
      OR name LIKE 'email-temp/%'
    )
  );

-- ── UPDATE: same scoping; reachable via existing photos row OR
-- ── matching one of the base-scoped path shapes.
CREATE POLICY "photos_update_path_scoped"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:write')
    AND (
      EXISTS (
        SELECT 1 FROM photos p
        WHERE p.storage_path = storage.objects.name
           OR p.thumbnail_path = storage.objects.name
      )
      OR (
        name LIKE 'airfield-diagrams/%'
        AND public.user_has_base_access(
          auth.uid(),
          NULLIF(split_part(name, '/', 2), '')::uuid
        )
      )
      OR name LIKE 'email-temp/%'
    )
  );

-- ── DELETE: same shape as UPDATE, with photos:delete instead of write.
CREATE POLICY "photos_delete_path_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND public.user_has_permission(auth.uid(), 'photos:delete')
    AND (
      EXISTS (
        SELECT 1 FROM photos p
        WHERE p.storage_path = storage.objects.name
           OR p.thumbnail_path = storage.objects.name
      )
      OR (
        name LIKE 'airfield-diagrams/%'
        AND public.user_has_base_access(
          auth.uid(),
          NULLIF(split_part(name, '/', 2), '')::uuid
        )
      )
      OR name LIKE 'email-temp/%'
    )
  );
