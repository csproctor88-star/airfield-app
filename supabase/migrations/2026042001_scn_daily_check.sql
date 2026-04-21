-- ============================================================
-- Secondary Crash Net (SCN) Daily Check Log.
--
-- Each base maintains its own list of SCN agencies. Once per day,
-- a controller runs through the list, marking each agency as
-- Loud & Clear, No Response, or Out of Service (with notes).
-- A separate "backup SCN" check can be recorded alongside.
--
-- Storage:
--   scn_agencies       — per-base agency list (name, sort order, active flag)
--   scn_checks         — one row per primary/backup daily check
--   scn_check_results  — per-agency result snapshot for each check
--
-- `agency_name` on scn_check_results is denormalized on purpose so
-- historical checks survive agency renames or deletions.
-- ============================================================

-- ── Agencies (per-base config) ──────────────────────────────
CREATE TABLE IF NOT EXISTS scn_agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, agency_name)
);

CREATE INDEX IF NOT EXISTS idx_scn_agencies_base ON scn_agencies(base_id, sort_order);

-- ── Checks (one row per daily primary/backup check) ────────
CREATE TABLE IF NOT EXISTS scn_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  check_type TEXT NOT NULL CHECK (check_type IN ('primary', 'backup')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id),
  completed_by_oi TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, check_date, check_type)
);

CREATE INDEX IF NOT EXISTS idx_scn_checks_base_date ON scn_checks(base_id, check_date DESC);

-- ── Per-agency results for each check ──────────────────────
CREATE TABLE IF NOT EXISTS scn_check_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES scn_checks(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES scn_agencies(id) ON DELETE SET NULL,
  agency_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('loud_clear', 'no_response', 'oos')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scn_check_results_check ON scn_check_results(check_id);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE scn_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE scn_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scn_check_results ENABLE ROW LEVEL SECURITY;

-- scn_agencies
DROP POLICY IF EXISTS "scn_agencies_select" ON scn_agencies;
DROP POLICY IF EXISTS "scn_agencies_insert" ON scn_agencies;
DROP POLICY IF EXISTS "scn_agencies_update" ON scn_agencies;
DROP POLICY IF EXISTS "scn_agencies_delete" ON scn_agencies;

CREATE POLICY "scn_agencies_select" ON scn_agencies
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "scn_agencies_insert" ON scn_agencies
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "scn_agencies_update" ON scn_agencies
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "scn_agencies_delete" ON scn_agencies
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- scn_checks
DROP POLICY IF EXISTS "scn_checks_select" ON scn_checks;
DROP POLICY IF EXISTS "scn_checks_insert" ON scn_checks;
DROP POLICY IF EXISTS "scn_checks_update" ON scn_checks;
DROP POLICY IF EXISTS "scn_checks_delete" ON scn_checks;

CREATE POLICY "scn_checks_select" ON scn_checks
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "scn_checks_insert" ON scn_checks
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "scn_checks_update" ON scn_checks
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "scn_checks_delete" ON scn_checks
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- scn_check_results (scoped via parent scn_checks.base_id)
DROP POLICY IF EXISTS "scn_check_results_select" ON scn_check_results;
DROP POLICY IF EXISTS "scn_check_results_insert" ON scn_check_results;
DROP POLICY IF EXISTS "scn_check_results_update" ON scn_check_results;
DROP POLICY IF EXISTS "scn_check_results_delete" ON scn_check_results;

CREATE POLICY "scn_check_results_select" ON scn_check_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = scn_check_results.check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

CREATE POLICY "scn_check_results_insert" ON scn_check_results
  FOR INSERT TO authenticated
  WITH CHECK (
    user_can_write(auth.uid())
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = scn_check_results.check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

CREATE POLICY "scn_check_results_update" ON scn_check_results
  FOR UPDATE TO authenticated
  USING (
    user_can_write(auth.uid())
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = scn_check_results.check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );

CREATE POLICY "scn_check_results_delete" ON scn_check_results
  FOR DELETE TO authenticated
  USING (
    user_can_write(auth.uid())
    AND EXISTS (
      SELECT 1 FROM scn_checks c
      WHERE c.id = scn_check_results.check_id
        AND user_has_base_access(auth.uid(), c.base_id)
    )
  );
