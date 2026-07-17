-- ============================================================
-- Airfield Licenses roster (imported from the ADDx "Airfield Licenses
-- Report") — Migration 1/1: table + RLS.
--
-- A per-base list of airfield drivers so a spot check can look a driver up
-- by last / first / unit and auto-fill their identity + AF Form 483 number.
-- This is a CONVENIENCE ROSTER, not a compliance record: a re-import
-- REPLACES it (lib/supabase/driving-checks.ts replaceDriverLicenses deletes
-- the base's rows, then bulk-inserts the new export).
--
-- Reuses the driving_checks permission family (NO new permission keys):
--   SELECT → driving_checks:view          (any checker can look drivers up)
--   INSERT / UPDATE / DELETE → driving_checks:manage_items
--                                         (admins who manage the module)
--
-- RLS uses ONLY user_has_base_access() + user_has_permission() — the
-- permission-matrix helpers (2026042200 onward). Never user_can_write /
-- user_is_admin / user_is_base_admin_at (dropped in 2026042208).
--
-- Columns mirror the ADDx report:
--   Last | First | Middle | Grade/Rank | Unit | Office | AF 483 Number |
--   Restrictions | Refresher Due Date
--
-- STAGED — NOT applied. Apply with:
--   npx supabase db query --linked --file supabase/migrations/2026071771_airfield_driver_licenses.sql
-- Post-apply verification:
--   SELECT rowsecurity FROM pg_tables WHERE tablename = 'airfield_driver_licenses';
--   -- expect true
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'airfield_driver_licenses' ORDER BY cmd;
--   -- expect 4 policies (SELECT / INSERT / UPDATE / DELETE)
-- ============================================================

CREATE TABLE IF NOT EXISTS airfield_driver_licenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  last_name     TEXT NOT NULL,
  first_name    TEXT,
  middle_name   TEXT,
  grade_rank    TEXT,
  unit          TEXT,
  office        TEXT,
  af_483_number TEXT,
  restrictions  TEXT,
  refresher_due DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_airfield_driver_licenses_base   ON airfield_driver_licenses(base_id);
CREATE INDEX IF NOT EXISTS idx_airfield_driver_licenses_lookup ON airfield_driver_licenses(base_id, last_name, first_name);

ALTER TABLE airfield_driver_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "airfield_driver_licenses_select" ON airfield_driver_licenses FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:view'));
CREATE POLICY "airfield_driver_licenses_insert" ON airfield_driver_licenses FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
CREATE POLICY "airfield_driver_licenses_update" ON airfield_driver_licenses FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
CREATE POLICY "airfield_driver_licenses_delete" ON airfield_driver_licenses FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
