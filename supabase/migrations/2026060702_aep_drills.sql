-- ============================================================
-- Phase 3b step 3 — Airport Emergency Plan: drill program
--
-- §139.325(h) requires a full-scale exercise every 36 months and
-- §139.325(j) requires an annual tabletop / functional review in
-- the off-years. This table logs each drill (scheduled or
-- completed) with type, scenario, participating agencies, and the
-- after-action report.
--
-- Participants live as a JSONB snapshot rather than a join table so
-- historical drill rows keep their agency names readable even after
-- an agency is renamed or deleted from aep_response_agencies (same
-- shape as scn_check_results.agency_name).
--
-- Drill-type taxonomy follows AC 150/5200-31C App. 2:
--   full_scale           — full activation, real assets, multiple agencies
--   tabletop             — discussion-based scenario walk-through
--   functional           — partial activation (one or two functions live)
--   orientation          — familiarization briefing (new staff, plan changes)
--   arff_familiarization — ARFF-led equipment / route familiarization
-- ============================================================

CREATE TABLE IF NOT EXISTS aep_drills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  drill_date            DATE NOT NULL,
  drill_type            TEXT NOT NULL CHECK (drill_type IN (
                          'full_scale', 'tabletop', 'functional',
                          'orientation', 'arff_familiarization'
                        )),
  scenario              TEXT NOT NULL,                         -- 'Aircraft accident, mass casualty, RWY 13 midfield'
  status                TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                          'scheduled', 'completed', 'cancelled'
                        )),
  participants          JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{ agency_id, agency_name, role, attended }]
  after_action_notes    TEXT,
  findings              TEXT,                                  -- gaps surfaced during the drill
  evidence_url          TEXT,                                  -- AAR document URL
  storage_path          TEXT,                                  -- aep-drills/<base>/<drill>/aar-<ts>.<ext>
  next_due_at_override  DATE,                                  -- usually null; admin override if FAA agreement deviates
  completed_at          TIMESTAMPTZ,
  completed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aep_drills_base_date
  ON aep_drills (base_id, drill_date DESC);

CREATE INDEX IF NOT EXISTS idx_aep_drills_base_type
  ON aep_drills (base_id, drill_type) WHERE status = 'completed';

COMMENT ON TABLE  aep_drills IS 'AEP exercise log per §139.325(h/j). Triennial full-scale plus annual tabletop / functional in the off-years.';
COMMENT ON COLUMN aep_drills.participants IS 'Snapshot at save time: [{ agency_id, agency_name, role, attended }]. Survives agency renames / deletes.';
