-- ============================================================
-- Phase D1 — Swap operational-table RLS to the permission matrix
--
-- Tables in this batch (7):
--   inspections, airfield_checks, acsi_inspections,
--   obstruction_evaluations, notams, waivers, airfield_contractors
--
-- Pattern per table:
--   INSERT / UPDATE → user_has_permission(<module>:write)
--   DELETE          → user_has_permission(<module>:delete)
--   SELECT          → user_has_base_access (unchanged)
--
-- NOTAMs intentionally uses `notams:write` for delete too, since
-- deleting is an admin/write action — the narrower `notams:cancel`
-- is for soft-cancellation (sets status='cancelled').
--
-- user_can_write / user_is_admin remain callable; other tables still
-- use them until their Phase D batch lands.
-- ============================================================

-- ── inspections ────────────────────────────────────────────
DROP POLICY IF EXISTS "inspections_insert" ON inspections;
CREATE POLICY "inspections_insert" ON inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'inspections:write')
  );

DROP POLICY IF EXISTS "inspections_update" ON inspections;
CREATE POLICY "inspections_update" ON inspections
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'inspections:write')
  );

DROP POLICY IF EXISTS "inspections_delete" ON inspections;
CREATE POLICY "inspections_delete" ON inspections
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'inspections:delete')
  );

-- ── airfield_checks ────────────────────────────────────────
DROP POLICY IF EXISTS "airfield_checks_insert" ON airfield_checks;
CREATE POLICY "airfield_checks_insert" ON airfield_checks
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'checks:write')
  );

DROP POLICY IF EXISTS "airfield_checks_update" ON airfield_checks;
CREATE POLICY "airfield_checks_update" ON airfield_checks
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'checks:write')
  );

DROP POLICY IF EXISTS "airfield_checks_delete" ON airfield_checks;
CREATE POLICY "airfield_checks_delete" ON airfield_checks
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'checks:delete')
  );

-- ── acsi_inspections ───────────────────────────────────────
DROP POLICY IF EXISTS "acsi_inspections_insert" ON acsi_inspections;
CREATE POLICY "acsi_inspections_insert" ON acsi_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'acsi:write')
  );

DROP POLICY IF EXISTS "acsi_inspections_update" ON acsi_inspections;
CREATE POLICY "acsi_inspections_update" ON acsi_inspections
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'acsi:write')
  );

DROP POLICY IF EXISTS "acsi_inspections_delete" ON acsi_inspections;
CREATE POLICY "acsi_inspections_delete" ON acsi_inspections
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'acsi:delete')
  );

-- ── obstruction_evaluations ────────────────────────────────
DROP POLICY IF EXISTS "obstruction_evaluations_insert" ON obstruction_evaluations;
CREATE POLICY "obstruction_evaluations_insert" ON obstruction_evaluations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'obstructions:write')
  );

DROP POLICY IF EXISTS "obstruction_evaluations_update" ON obstruction_evaluations;
CREATE POLICY "obstruction_evaluations_update" ON obstruction_evaluations
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'obstructions:write')
  );

DROP POLICY IF EXISTS "obstruction_evaluations_delete" ON obstruction_evaluations;
CREATE POLICY "obstruction_evaluations_delete" ON obstruction_evaluations
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'obstructions:delete')
  );

-- ── notams ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "notams_insert" ON notams;
CREATE POLICY "notams_insert" ON notams
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'notams:write')
  );

DROP POLICY IF EXISTS "notams_update" ON notams;
CREATE POLICY "notams_update" ON notams
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'notams:write')
  );

DROP POLICY IF EXISTS "notams_delete" ON notams;
CREATE POLICY "notams_delete" ON notams
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'notams:write')
  );

-- ── waivers ────────────────────────────────────────────────
DROP POLICY IF EXISTS "waivers_insert" ON waivers;
CREATE POLICY "waivers_insert" ON waivers
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'waivers:write')
  );

DROP POLICY IF EXISTS "waivers_update" ON waivers;
CREATE POLICY "waivers_update" ON waivers
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'waivers:write')
  );

DROP POLICY IF EXISTS "waivers_delete" ON waivers;
CREATE POLICY "waivers_delete" ON waivers
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'waivers:delete')
  );

-- ── read_only seed correction ─────────────────────────────
-- The Phase A scaffold seeded `read_only` with every `*:view` key,
-- which accidentally included `feedback:view`, `users:view`, and
-- `library:view`. Those three were gated by `canManageUsers` in the
-- old system — read-only users should not see the corresponding
-- admin pages. Revoke them.
DELETE FROM role_permissions
WHERE role = 'read_only'
  AND permission_key IN ('feedback:view','users:view','library:view');

-- ── airfield_contractors ───────────────────────────────────
DROP POLICY IF EXISTS "airfield_contractors_insert" ON airfield_contractors;
CREATE POLICY "airfield_contractors_insert" ON airfield_contractors
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'contractors:write')
  );

DROP POLICY IF EXISTS "airfield_contractors_update" ON airfield_contractors;
CREATE POLICY "airfield_contractors_update" ON airfield_contractors
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'contractors:write')
  );

DROP POLICY IF EXISTS "airfield_contractors_delete" ON airfield_contractors;
CREATE POLICY "airfield_contractors_delete" ON airfield_contractors
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'contractors:delete')
  );
