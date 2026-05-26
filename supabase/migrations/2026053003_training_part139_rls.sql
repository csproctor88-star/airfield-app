-- ============================================================
-- Phase 3a step 4 — §139.303 Training: RLS
--
-- Matrix-helper policies on the 4 training tables, gated by the
-- already-seeded training_part139:{read,write,export} keys (from
-- 2026052503). Pattern mirrors 2026052701_sms_rls.sql one-for-one.
--
-- Asymmetry on training_topics: SELECT must allow system rows
-- (base_id IS NULL) for any user with training_part139:read so the
-- 13 §139.303(e) seed topics show in the catalog regardless of which
-- base the user is at. INSERT/UPDATE/DELETE on system rows is
-- service-role-only (no policy permits it from authenticated).
-- ============================================================

-- ── training_topics ──────────────────────────────────────────
ALTER TABLE training_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_topics_select" ON training_topics;
CREATE POLICY "training_topics_select" ON training_topics
  FOR SELECT TO authenticated
  USING (
    user_has_permission(auth.uid(), 'training_part139:read')
    AND (base_id IS NULL OR user_has_base_access(auth.uid(), base_id))
  );

DROP POLICY IF EXISTS "training_topics_insert" ON training_topics;
CREATE POLICY "training_topics_insert" ON training_topics
  FOR INSERT TO authenticated
  WITH CHECK (
    base_id IS NOT NULL
    AND user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'training_part139:write')
  );

DROP POLICY IF EXISTS "training_topics_update" ON training_topics;
CREATE POLICY "training_topics_update" ON training_topics
  FOR UPDATE TO authenticated
  USING (
    base_id IS NOT NULL
    AND user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'training_part139:write')
  );

DROP POLICY IF EXISTS "training_topics_delete" ON training_topics;
CREATE POLICY "training_topics_delete" ON training_topics
  FOR DELETE TO authenticated
  USING (
    base_id IS NOT NULL
    AND user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'training_part139:write')
  );

-- ── training_records ─────────────────────────────────────────
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_records_select" ON training_records;
CREATE POLICY "training_records_select" ON training_records
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:read'));

DROP POLICY IF EXISTS "training_records_insert" ON training_records;
CREATE POLICY "training_records_insert" ON training_records
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

DROP POLICY IF EXISTS "training_records_update" ON training_records;
CREATE POLICY "training_records_update" ON training_records
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

DROP POLICY IF EXISTS "training_records_delete" ON training_records;
CREATE POLICY "training_records_delete" ON training_records
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

-- ── training_renewals ────────────────────────────────────────
ALTER TABLE training_renewals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_renewals_select" ON training_renewals;
CREATE POLICY "training_renewals_select" ON training_renewals
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:read'));

DROP POLICY IF EXISTS "training_renewals_insert" ON training_renewals;
CREATE POLICY "training_renewals_insert" ON training_renewals
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

DROP POLICY IF EXISTS "training_renewals_delete" ON training_renewals;
CREATE POLICY "training_renewals_delete" ON training_renewals
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

-- (No UPDATE policy on training_renewals — chain rows are append-only
-- by design; correct a mistake by deleting + re-inserting.)

-- ── training_certificates ────────────────────────────────────
ALTER TABLE training_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_certificates_select" ON training_certificates;
CREATE POLICY "training_certificates_select" ON training_certificates
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:read'));

DROP POLICY IF EXISTS "training_certificates_insert" ON training_certificates;
CREATE POLICY "training_certificates_insert" ON training_certificates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

DROP POLICY IF EXISTS "training_certificates_update" ON training_certificates;
CREATE POLICY "training_certificates_update" ON training_certificates
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));

DROP POLICY IF EXISTS "training_certificates_delete" ON training_certificates;
CREATE POLICY "training_certificates_delete" ON training_certificates
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'training_part139:write'));
