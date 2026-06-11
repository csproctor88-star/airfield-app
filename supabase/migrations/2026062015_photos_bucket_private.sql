-- =====================================================================
-- H-5 — make the `photos` bucket PRIVATE and add a base-scoped SELECT
-- policy on storage.objects.
--
-- ┌───────────────────────────────────────────────────────────────────┐
-- │  DO NOT APPLY THIS MIGRATION YET.                                   │
-- │                                                                     │
-- │  The bucket is currently public; every consumer resolves images    │
-- │  with getPublicUrl(). Flipping it private serves those public      │
-- │  URLs a 400/403, so ALL airfield imagery (PDF embeds, photo        │
-- │  galleries, exports) breaks until every getPublicUrl('photos')     │
-- │  call site is converted to a short-TTL createSignedUrl AND the     │
-- │  result is visually verified (PDF generation + galleries +         │
-- │  exports). Call sites to convert (grep `from('photos')`):          │
-- │    lib/supabase/photos.ts (central helper)                         │
-- │    lib/acsi-pdf.ts, lib/supabase/aep.ts, whmp.ts,                  │
-- │    training-part139.ts, obstructions.ts                            │
-- │    lib/reports/daily-ops-data.ts, open-discrepancies-data.ts       │
-- │    lib/export/export-photos.ts                                     │
-- │    app/(app)/inspections/[id]/page.tsx, discrepancies/page.tsx,    │
-- │    settings/exports/page.tsx                                       │
-- │    app/api/admin/airfield-diagram/route.ts                         │
-- │                                                                     │
-- │  Apply ONLY after that conversion deploys. The SELECT policy below  │
-- │  is correct-by-construction (mirrors the live photos_insert /       │
-- │  photos_delete path-scoped policies) but is unreachable while the   │
-- │  bucket is public, so it cannot be exercised until the flip.        │
-- │                                                                     │
-- │  STATUS (2026-06-11): all READ call sites are converted to the      │
-- │  authenticated /api/photos proxy (lib/supabase/photos.ts +          │
-- │  app/api/photos/route.ts). New entity/diagram photos resolve from   │
-- │  storage_path, so they work once private. REMAINING before flip:    │
-- │  some legacy AEP / WHMP / §139-training / obstruction rows           │
-- │  PERSISTED the old public URL (https://…/object/public/photos/…),    │
-- │  which will 404 when the bucket goes private. Before applying,       │
-- │  rewrite those stored URLs to the proxy form, e.g.:                  │
-- │    UPDATE <table> SET <url_col> =                                    │
-- │      '/api/photos?path=' || split_part(<url_col>,                    │
-- │        '/object/public/photos/', 2)                                  │
-- │    WHERE <url_col> LIKE '%/object/public/photos/%';                  │
-- │  (audit aep_*, whmp_*, training_part139_*, obstruction photo cols)   │
-- │  — then visually confirm those galleries/PDFs still render.          │
-- └───────────────────────────────────────────────────────────────────┘
--
-- Why this matters: the bucket holds CUI-adjacent USAF imagery — airfield
-- diagrams, discrepancy/FOD/damage photos, ACSI compliance-inspection
-- photos. While public, anyone with (or who can enumerate) a URL reads it
-- with no auth, no base membership, and no audit trail. Private + signed
-- URLs confines reads to base members and expires the links.
-- =====================================================================

-- ── SELECT: base-scoped reads, authenticated only ──────────────────
-- Mirrors the per-prefix base resolution of photos_insert_path_scoped:
--   entity photos  → join the parent entity, require base access
--   diagram/aep/whmp/training → base_id is path segment 2
--   obstruction-photos → prefix-only (no entity UUID in path; base-ambiguous,
--                        consistent with the existing INSERT/DELETE model)
--   email-temp     → authenticated (short-lived PDF attachment staging)
CREATE POLICY "photos_select_path_scoped"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'photos'
    AND (
      ((name LIKE 'discrepancy-photos/%') AND EXISTS (
        SELECT 1 FROM discrepancies d
        WHERE d.id = (NULLIF(split_part(name, '/', 2), ''))::uuid
          AND user_has_base_access(auth.uid(), d.base_id)))
      OR ((name LIKE 'check-photos/%') AND EXISTS (
        SELECT 1 FROM airfield_checks c
        WHERE c.id = (NULLIF(split_part(name, '/', 2), ''))::uuid
          AND user_has_base_access(auth.uid(), c.base_id)))
      OR ((name LIKE 'inspection-photos/%') AND EXISTS (
        SELECT 1 FROM inspections i
        WHERE i.id = (NULLIF(split_part(name, '/', 2), ''))::uuid
          AND user_has_base_access(auth.uid(), i.base_id)))
      OR ((name LIKE 'acsi-photos/%') AND EXISTS (
        SELECT 1 FROM acsi_inspections a
        WHERE a.id = (NULLIF(split_part(name, '/', 2), ''))::uuid
          AND user_has_base_access(auth.uid(), a.base_id)))
      OR ((name LIKE 'airfield-diagrams/%') AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 2), ''))::uuid))
      OR ((name LIKE 'aep-plans/%' OR name LIKE 'aep-drills/%') AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 2), ''))::uuid))
      OR ((name LIKE 'whmp/%') AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 2), ''))::uuid))
      OR ((name LIKE 'training-evidence/%') AND user_has_base_access(auth.uid(), (NULLIF(split_part(name, '/', 2), ''))::uuid))
      -- Prefix-only paths with no base segment (pre-existing model; see L-8).
      OR (name LIKE 'obstruction-photos/%')
      OR (name LIKE 'email-temp/%')
    )
  );

-- ── Flip the bucket private ────────────────────────────────────────
-- After this, /storage/v1/object/public/photos/* stops serving; clients
-- must use createSignedUrl (storage RLS SELECT above then applies).
UPDATE storage.buckets SET public = false WHERE id = 'photos';
