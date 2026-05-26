-- ============================================================
-- Phase 3a step 6 — §139.303 Training: evidence storage RLS
--
-- Training evidence (PDF certificates, photos of attendance sheets,
-- screenshots of LMS completion pages) uploads to the existing
-- `photos` bucket under the prefix:
--
--   training-evidence/<base_id>/<user_id>/<record_id>/<filename>
--
-- The existing path-scoped INSERT policy (from 2026042804) ORs over
-- known entity prefixes (discrepancy-photos, check-photos, etc.) and
-- gates them all on `photos:write`. We deliberately do NOT extend
-- that policy here. Instead this migration adds a *separate* INSERT
-- policy gated only on `training_part139:write`. RLS policies of the
-- same role/op are OR'd, so:
--
--   - A user with photos:write can still upload to the existing
--     entity prefixes via the 2026042804 policy.
--   - A user with training_part139:write can upload under the new
--     training-evidence/* prefix via THIS policy.
--   - arff_chief — who holds training_part139:write but NOT
--     photos:write — can upload training evidence without us having
--     to broaden their photo permissions further.
--
-- Base scoping comes from path segment 2 (the base_id UUID). The
-- user must hold base access to that base. The user_id (seg 3) and
-- record_id (seg 4) segments are not validated at the storage layer;
-- they're enforced by the training_records RLS at row-write time.
--
-- Path convention enforced at the app layer (uploads happen from
-- lib/supabase/training-part139.ts only).
--
-- UPDATE / DELETE policies are intentionally not added. Training
-- evidence is append-only; deleted-record orphans are accepted as a
-- known trade-off and tracked for a future maintenance sweep.
-- ============================================================

DROP POLICY IF EXISTS "training_evidence_insert" ON storage.objects;
CREATE POLICY "training_evidence_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND name LIKE 'training-evidence/%'
    AND public.user_has_permission(auth.uid(), 'training_part139:write')
    AND public.user_has_base_access(
      auth.uid(),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );
