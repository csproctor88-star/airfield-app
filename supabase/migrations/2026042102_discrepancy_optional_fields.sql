-- ============================================================
-- Add optional project-tracking + risk-control fields to
-- discrepancies, so the airfield discrepancy component can
-- carry the same data the ACSI checklist collects for N items.
--
--   • project_number       — optional text (MP/FY programs)
--   • estimated_cost       — optional text (keeps "$25,000" /
--                            "TBD" style entries possible)
--   • risk_control_measure — optional text; required in the
--                            ACSI form when an item is marked N,
--                            but optional for standalone
--                            discrepancies.
-- ============================================================

ALTER TABLE discrepancies
  ADD COLUMN IF NOT EXISTS project_number TEXT,
  ADD COLUMN IF NOT EXISTS estimated_cost TEXT,
  ADD COLUMN IF NOT EXISTS risk_control_measure TEXT;
