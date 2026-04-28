-- ============================================================
-- Tighten the photos-bucket INSERT policy for entity photo paths.
--
-- Migration 2026041600 introduced path-scoped RLS on the `photos`
-- bucket. INSERT for entity photos (discrepancy/check/inspection/
-- acsi) was deliberately permissive — the comment said "base
-- scoping comes from the photos table RLS at insert time."
--
-- That's true for the row-level link, but it leaves a storage
-- hygiene gap: any authenticated user can upload to ANY
-- discrepancy/check/inspection/acsi UUID's prefix, even on a base
-- they don't have access to. The file becomes orphaned (the
-- photos table insert blocks), but it persists — wasting storage
-- and obscuring the audit trail.
--
-- This migration scopes the INSERT to require the user have base
-- access to the entity referenced by the path's UUID segment. The
-- entity must exist at upload time (the app flow always creates
-- the entity row first, then uploads photos), so the EXISTS join
-- holds for legitimate flows.
--
-- obstruction-photos paths use a `{ts}-{rnd}.{ext}` shape with no
-- entity UUID, so they remain prefix-scoped. They're filtered to
-- the user's photos at the app layer.
-- ============================================================

DROP POLICY IF EXISTS "photos_insert_path_scoped" ON storage.objects;

CREATE POLICY "photos_insert_path_scoped"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND (
      -- Discrepancy photos: 2nd path segment is the discrepancy UUID.
      (
        name LIKE 'discrepancy-photos/%'
        AND EXISTS (
          SELECT 1 FROM discrepancies d
          WHERE d.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND user_has_base_access(auth.uid(), d.base_id)
        )
      )

      -- Check photos: 2nd path segment is the airfield_checks UUID.
      OR (
        name LIKE 'check-photos/%'
        AND EXISTS (
          SELECT 1 FROM airfield_checks c
          WHERE c.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND user_has_base_access(auth.uid(), c.base_id)
        )
      )

      -- Inspection photos: 2nd path segment is the inspections UUID.
      OR (
        name LIKE 'inspection-photos/%'
        AND EXISTS (
          SELECT 1 FROM inspections i
          WHERE i.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND user_has_base_access(auth.uid(), i.base_id)
        )
      )

      -- ACSI photos: 2nd path segment is the acsi_inspections UUID.
      OR (
        name LIKE 'acsi-photos/%'
        AND EXISTS (
          SELECT 1 FROM acsi_inspections a
          WHERE a.id = NULLIF(split_part(name, '/', 2), '')::uuid
            AND user_has_base_access(auth.uid(), a.base_id)
        )
      )

      -- Obstruction photos: no entity UUID in the path
      -- (`{ts}-{rnd}.{ext}` shape). Stays prefix-scoped; app filters
      -- at fetch time via the obstructions row's RLS.
      OR name LIKE 'obstruction-photos/%'

      -- Airfield diagrams: 2nd path segment is the base UUID.
      OR (
        name LIKE 'airfield-diagrams/%'
        AND user_has_base_access(auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
        AND user_can_write(auth.uid())
      )

      -- Email-temp: short-lived PDF attachments. Keyed by random UUID,
      -- not base-scoped. Authenticated-only is appropriate.
      OR name LIKE 'email-temp/%'
    )
  );
