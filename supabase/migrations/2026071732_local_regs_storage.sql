-- ============================================================
-- Local Regulations (Base Regs) — Migration 3/4: storage bucket
--
-- Spec: docs/superpowers/specs/2026-07-16-local-regulations-review-design.md
--       (§Data model & migrations)
--
-- Bucket 'local-regulations'. Path convention:
-- {base_id}/{timestamp}-{safeName} — the first path segment is the base
-- UUID directly (the 2026062102_read_file_storage.sql pattern). Access =
-- base access + the local_regs permission.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('local-regulations', 'local-regulations', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "local_regs_storage_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'local-regulations'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'local_regs:view')
  );

CREATE POLICY "local_regs_storage_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'local-regulations'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  );

CREATE POLICY "local_regs_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'local-regulations'
    AND user_has_base_access(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  );
