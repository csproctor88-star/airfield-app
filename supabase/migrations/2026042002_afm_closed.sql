-- ============================================================
-- Airfield Management Closed — "closed for the day" overlay.
--
-- Distinct from out-of-office: OOO means AFM is temporarily away;
-- closed means operations are shut down, so on next open the
-- controller has a clean slate to re-report runway status, RSC,
-- RCR, and BWC from the opening check.
--
-- Activating closed is a separate action from OOO and writes
-- different state. They can coexist if both are relevant.
-- ============================================================

ALTER TABLE airfield_status
  ADD COLUMN IF NOT EXISTS afm_closed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS afm_closed_message TEXT;

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS default_closed_message TEXT;
