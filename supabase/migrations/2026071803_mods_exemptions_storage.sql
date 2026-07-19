-- ============================================================
-- Modifications & Exemptions — Migration 3/4: storage bucket
--
-- Spec: docs/superpowers/specs/2026-07-18-modifications-exemptions-design.md
--       (§Data model — attachments). Owner ruling (open question 4):
--       PDF-only, 25 MB — enforced client-side in
--       lib/supabase/mods-exemptions.ts like local-regulations.ts.
--
-- Bucket 'mods-exemptions'. Path convention:
-- {base_id}/{record_id}/{timestamp}-{safeName} — the first path segment
-- is the base UUID directly (the 2026071732 local-regulations pattern),
-- so the same storage.foldername()[1] policies apply. 5300.1G ¶11.c
-- expects supporting findings "in a non-editable format such as PDF".
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('mods-exemptions', 'mods-exemptions', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "mods_exemptions_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mods-exemptions'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'mods_exemptions:view')
  );

CREATE POLICY "mods_exemptions_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mods-exemptions'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );

CREATE POLICY "mods_exemptions_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mods-exemptions'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );
