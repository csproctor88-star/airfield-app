-- ============================================================
-- Airfield Driving Spot Check ("43 Check", DAFI 13-213) — Migration 2/2:
-- tables + RLS
--
-- Spec: docs/superpowers/specs/2026-07-16-airfield-driving-spot-check-design.md
--       (§Data model & migrations)
--
-- driving_check_items — per-base config (mirror of scn_agencies /
--   fpr_checklist_items): label, optional guidance, sort_order,
--   is_active soft-delete.
-- driving_checks — one row per spot check. Deliberately NO natural key
--   (unlike scn_checks / fpr_checks): spot checks are random and
--   unbounded per day — plain inserts, like an event log (design spec
--   §Architecture decision). Driver/vehicle/483 columns are typed (not
--   JSONB) because the history filters and the AOB report query them.
--   overall_result is derived client-side by deriveOverallResult() and
--   stored (not just derived at read time) so filters/reports stay cheap.
-- driving_check_results — per-item result snapshot. item_label is
--   denormalized ON PURPOSE (mirrors scn_check_results.agency_name /
--   fpr_check_results.item_label — see 2026042001_scn_daily_check.sql
--   header): item-list edits, renames, or deletes never corrupt
--   completed-check history.
--
-- RLS uses ONLY user_has_base_access() + user_has_permission() — the
-- permission-matrix helpers (2026042200_permission_matrix_scaffold.sql
-- onward). Never user_can_write / user_is_admin / user_is_base_admin_at
-- (all dropped in 2026042208).
--
-- No storage bucket, no RPC — a completed check is editable/deletable by
-- any driving_checks:write holder, same as SCN/FPR (no signature
-- semantics — "a log, not a certified review").
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review in the
-- morning; apply in order with `npx supabase db query --linked --file
-- <path>` — 2026071750_driving_check_permissions.sql first, then this
-- file.
--
-- Post-apply verification:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'driving_check%';
--   -- expect rowsecurity = true for all three tables
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'driving_check%' ORDER BY tablename, cmd;
--   -- expect 4 policies each on driving_check_items / driving_checks / driving_check_results
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid = 'driving_checks'::regclass AND contype = 'f' AND conname LIKE '%contractor%';
--   -- expect a FK to airfield_contractors(id) ON DELETE SET NULL
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conrelid = 'driving_checks'::regclass AND contype = 'u';
--   -- expect ZERO rows — deliberately no natural-key UNIQUE constraint (see header)
-- ============================================================

-- Per-base spot-check item list (locally-editable proposed defaults; scn_agencies pattern).
CREATE TABLE IF NOT EXISTS driving_check_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  guidance   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_check_items_base ON driving_check_items(base_id, sort_order);

-- One row per spot check (no natural key — random checks, unbounded per day).
-- Driver columns are typed (not JSONB) because filters and the AOB report
-- query them; the field set follows the DAFI 13-213 spot-check log list
-- (§Assumptions).
CREATE TABLE IF NOT EXISTS driving_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  checked_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  driver_name           TEXT NOT NULL,
  driver_rank           TEXT, driver_unit TEXT, driver_office_symbol TEXT, driver_phone TEXT,
  contractor_id         UUID REFERENCES airfield_contractors(id) ON DELETE SET NULL,
  form_483_status       TEXT NOT NULL CHECK (form_483_status IN ('valid', 'expired', 'not_in_possession', 'none')),
  form_483_expires      DATE,
  vehicle_type          TEXT CHECK (vehicle_type IN ('government', 'contractor', 'pov', 'other')),
  vehicle_id            TEXT, pov_pass_number TEXT,
  location              TEXT NOT NULL,
  overall_result        TEXT NOT NULL CHECK (overall_result IN ('pass', 'discrepancy', 'violation')),
  violation_description TEXT,
  notes                 TEXT,
  completed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_oi       TEXT,
  completed_by_name     TEXT,  -- snapshot; feeds the by-checker report table
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_checks_base_time   ON driving_checks(base_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_driving_checks_base_result ON driving_checks(base_id, overall_result);

-- Per-item result snapshot. item_label denormalized ON PURPOSE (scn_check_results /
-- fpr_check_results pattern): item-list edits never corrupt completed checks.
CREATE TABLE IF NOT EXISTS driving_check_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id   UUID NOT NULL REFERENCES driving_checks(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES driving_check_items(id) ON DELETE SET NULL,
  item_label TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('pass', 'discrepancy', 'na')),
  notes      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_driving_check_results_check ON driving_check_results(check_id);

ALTER TABLE driving_check_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_checks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_check_results ENABLE ROW LEVEL SECURITY;

-- driving_check_items: read on :view, mutate on :manage_items.
CREATE POLICY "driving_check_items_select" ON driving_check_items FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:view'));
CREATE POLICY "driving_check_items_insert" ON driving_check_items FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
CREATE POLICY "driving_check_items_update" ON driving_check_items FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));
CREATE POLICY "driving_check_items_delete" ON driving_check_items FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:manage_items'));

-- driving_checks: read on :view, log/edit/delete on :write.
CREATE POLICY "driving_checks_select" ON driving_checks FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:view'));
CREATE POLICY "driving_checks_insert" ON driving_checks FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:write'));
CREATE POLICY "driving_checks_update" ON driving_checks FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:write'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:write'));
CREATE POLICY "driving_checks_delete" ON driving_checks FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'driving_checks:write'));

-- driving_check_results: base-scoped via the parent check (scn_check_results /
-- fpr_check_results pattern, 2026042205 / 2026071721). SELECT requires :view;
-- INSERT/UPDATE/DELETE require :write — all four through the same
-- EXISTS-parent shape.
CREATE POLICY "driving_check_results_select" ON driving_check_results FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM driving_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'driving_checks:view')));
CREATE POLICY "driving_check_results_insert" ON driving_check_results FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM driving_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'driving_checks:write')));
CREATE POLICY "driving_check_results_update" ON driving_check_results FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM driving_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'driving_checks:write')));
CREATE POLICY "driving_check_results_delete" ON driving_check_results FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM driving_checks c WHERE c.id = check_id
      AND user_has_base_access(auth.uid(), c.base_id)
      AND user_has_permission(auth.uid(), 'driving_checks:write')));
