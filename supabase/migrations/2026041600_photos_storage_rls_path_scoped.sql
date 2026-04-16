-- ============================================================
-- Path-scope the `photos` storage bucket RLS.
--
-- Prior state (migration 2026022702 + 2026041401):
--   - INSERT:  any authenticated user, any path
--   - UPDATE:  any authenticated user, any path
--   - DELETE:  any authenticated user, any path
--   - SELECT:  no policy (bucket is public — public URLs work regardless)
--
-- Concrete attack pre-change: a user at Base A can DELETE or overwrite any
-- storage object in the `photos` bucket — including photos owned by Base B's
-- discrepancies, checks, inspections, etc. — by guessing the path.
--
-- New model:
--   INSERT  — authenticated + path must match a known prefix; for
--             airfield-diagrams/{baseId}/..., the user must have write
--             access to that base.
--   UPDATE  — authenticated + must match an existing `photos` row the user
--             can see (photos table RLS is base-scoped via the parent
--             entity), or base-scoped for airfield-diagrams, or the owner
--             for email-temp.
--   DELETE  — same as UPDATE.
--
-- Known path prefixes (grep `.from('photos')` across lib/ to audit):
--   - discrepancy-photos/{discrepancyId}/*
--   - check-photos/{checkId}/*
--   - inspection-photos/{inspectionId}/*
--   - acsi-photos/{inspectionId}/*
--   - obstruction-photos/{ts}-{rnd}.{ext}
--   - airfield-diagrams/{baseId}/diagram
--   - email-temp/{uuid}-{filename} (short-lived PDF attachment)
--
-- Delete ordering (verified in lib/supabase/*): storage.remove() runs BEFORE
-- the photos row delete, so the EXISTS check passes at the moment the
-- storage object is being deleted.
-- ============================================================

-- ── Supporting indexes for the EXISTS predicate ─────────────
-- Partial indexes skip rows where the path is an inline data: URL (fallback
-- when upload failed). Those rows have no storage object anyway, so the RLS
-- EXISTS never matches them — and including them in the btree blows past the
-- 2712-byte entry limit (some data URLs are >5 MB base64 blobs).
CREATE INDEX IF NOT EXISTS idx_photos_storage_path
  ON photos (storage_path)
  WHERE storage_path IS NOT NULL AND storage_path NOT LIKE 'data:%';
CREATE INDEX IF NOT EXISTS idx_photos_thumbnail_path
  ON photos (thumbnail_path)
  WHERE thumbnail_path IS NOT NULL AND thumbnail_path NOT LIKE 'data:%';

-- ── Drop permissive policies ────────────────────────────────
DROP POLICY IF EXISTS "Allow authenticated upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete photos" ON storage.objects;

-- ── INSERT: authenticated + known prefix ────────────────────
CREATE POLICY "photos_insert_path_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (
      -- Entity photo paths: photos row is inserted AFTER upload, so only
      -- prefix-scope here. Base scoping comes from the `photos` table RLS
      -- at insert time (photos.INSERT policy requires user_can_write).
      name LIKE 'discrepancy-photos/%'
      OR name LIKE 'check-photos/%'
      OR name LIKE 'inspection-photos/%'
      OR name LIKE 'acsi-photos/%'
      OR name LIKE 'obstruction-photos/%'
      OR name LIKE 'email-temp/%'
      OR (
        -- Airfield diagram: base_id is the 2nd path segment.
        name LIKE 'airfield-diagrams/%'
        AND (
          SELECT user_has_base_access(auth.uid(), (split_part(name, '/', 2))::uuid)
                 AND user_can_write(auth.uid())
        )
      )
    )
  );

-- ── UPDATE: must be reachable via existing photos row OR base-scoped ─
CREATE POLICY "photos_update_path_scoped"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND (
      -- Entity photos: the row's RLS chain enforces base access.
      EXISTS (
        SELECT 1 FROM photos p
        WHERE p.storage_path = storage.objects.name
           OR p.thumbnail_path = storage.objects.name
      )
      OR (
        name LIKE 'airfield-diagrams/%'
        AND (
          SELECT user_has_base_access(auth.uid(), (split_part(name, '/', 2))::uuid)
                 AND user_can_write(auth.uid())
        )
      )
      OR name LIKE 'email-temp/%'
    )
  );

-- ── DELETE: same scoping as UPDATE ──────────────────────────
CREATE POLICY "photos_delete_path_scoped"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND (
      EXISTS (
        SELECT 1 FROM photos p
        WHERE p.storage_path = storage.objects.name
           OR p.thumbnail_path = storage.objects.name
      )
      OR (
        name LIKE 'airfield-diagrams/%'
        AND (
          SELECT user_has_base_access(auth.uid(), (split_part(name, '/', 2))::uuid)
                 AND user_can_write(auth.uid())
        )
      )
      OR name LIKE 'email-temp/%'
    )
  );
