-- ============================================================
-- Phase 1.6 — discrepancy_statuses lookup table
--
-- The 5 discrepancy status values (`submitted_to_afm`,
-- `submitted_to_ces`, `awaiting_action_by_ces`, `waiting_for_project`,
-- `work_completed_awaiting_verification`) ship today as a hardcoded
-- enum-ish set in lib/constants.ts and as a text column on
-- discrepancies. Their LABELS are USAF-org-bound (AFM, CES) and
-- need civilian variants (Manager, Maintenance).
--
-- This migration creates a lookup table with per-mode labels. The
-- `current_status` text column on discrepancies is untouched —
-- existing data stays intact. UI reads the label via lookup keyed
-- by `airport_type`.
--
-- Status keys themselves stay USAF-derived for compatibility (no
-- DB rename). Civilian-mode UI just shows different labels.
-- ============================================================

CREATE TABLE IF NOT EXISTS discrepancy_statuses (
  key        TEXT PRIMARY KEY,
  label_usaf TEXT NOT NULL,
  label_faa  TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  description TEXT
);

INSERT INTO discrepancy_statuses (key, label_usaf, label_faa, sort_order, is_terminal, description) VALUES
  ('submitted_to_afm',
   'Submitted to AFM',
   'Submitted to Operations Manager',
   1, false,
   'Initial state — discrepancy filed, awaiting first triage by the airfield/airport manager.'),
  ('submitted_to_ces',
   'Submitted to CES',
   'Submitted to Maintenance',
   2, false,
   'Manager has routed the discrepancy to maintenance for action.'),
  ('awaiting_action_by_ces',
   'Awaiting CES Action',
   'Awaiting Maintenance Action',
   3, false,
   'Maintenance has acknowledged but work has not yet started.'),
  ('waiting_for_project',
   'Waiting for Project',
   'Waiting for Project',
   4, false,
   'Resolution requires a capital project or contract that has not been awarded; work paused.'),
  ('work_completed_awaiting_verification',
   'Work Completed (Awaiting Verification)',
   'Work Completed (Awaiting Verification)',
   5, false,
   'Maintenance has completed the work; manager review required before final close.')
ON CONFLICT (key) DO UPDATE SET
  label_usaf = EXCLUDED.label_usaf,
  label_faa = EXCLUDED.label_faa,
  sort_order = EXCLUDED.sort_order,
  is_terminal = EXCLUDED.is_terminal,
  description = EXCLUDED.description;

-- Lookup table is reference data — readable by all authenticated
-- users, no RLS modification needed (no base_id; not multi-tenant).
ALTER TABLE discrepancy_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discrepancy_statuses_read ON discrepancy_statuses;
CREATE POLICY discrepancy_statuses_read
  ON discrepancy_statuses
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE discrepancy_statuses IS
  'Lookup table for discrepancy status keys → per-mode display labels. UI selects label_usaf or label_faa based on bases.airport_type.';
