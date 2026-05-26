-- ============================================================
-- Phase 3b step 4 — Airport Emergency Plan: comms checks
--
-- AC 150/5200-31C §2.3 calls for periodic verification of comms with
-- response agencies. Industry-standard cadence at Class III/IV airports
-- is monthly; the schema also supports 'quarterly' and 'ad_hoc'.
--
-- Schema mirrors scn_checks + scn_check_results one-for-one (the
-- SCN-equivalent for civilian mode):
--   - aep_comms_checks         — one row per check event
--   - aep_comms_check_results  — one row per (check, agency)
--
-- Differences from SCN:
--   - check_period replaces check_type (monthly default vs SCN's daily/backup)
--   - results.status adds 'not_reached' (agency on roster but no contact
--     attempted this cycle — common when working agencies in batches)
-- ============================================================

CREATE TABLE IF NOT EXISTS aep_comms_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  check_date            DATE NOT NULL,                         -- Zulu YYYY-MM-DD
  check_period          TEXT NOT NULL DEFAULT 'monthly' CHECK (check_period IN (
                          'monthly', 'quarterly', 'ad_hoc'
                        )),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  completed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_by_oi       TEXT,                                  -- operating initials, for attribution
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, check_date, check_period)
);

CREATE INDEX IF NOT EXISTS idx_aep_comms_base_date
  ON aep_comms_checks (base_id, check_date DESC);

CREATE TABLE IF NOT EXISTS aep_comms_check_results (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id              UUID NOT NULL REFERENCES aep_comms_checks(id) ON DELETE CASCADE,
  agency_id             UUID REFERENCES aep_response_agencies(id) ON DELETE SET NULL,
  agency_name           TEXT NOT NULL,                         -- snapshot at check time
  agency_role           TEXT,                                  -- snapshot
  status                TEXT NOT NULL CHECK (status IN (
                          'loud_clear', 'no_response', 'oos', 'not_reached'
                        )),
  notes                 TEXT,
  sort_order            INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aep_comms_results_check
  ON aep_comms_check_results (check_id);

COMMENT ON TABLE  aep_comms_checks IS 'Per-cycle comms verification rollup per AC 150/5200-31C §2.3. UNIQUE(base, check_date, check_period) prevents duplicate cycles.';
COMMENT ON TABLE  aep_comms_check_results IS 'Per-agency status for a comms check. agency_name snapshotted so history is readable after agency renames / deletes.';
