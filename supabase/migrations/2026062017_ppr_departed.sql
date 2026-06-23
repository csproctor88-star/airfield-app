-- PPR "Departed" tracking for the Transient Aircraft board.
--
-- A PPR now stays on the dashboard's Transient Aircraft (PPR) board from
-- arrival until staff with ppr:write mark it departed — instead of
-- dropping off when its arrival_date rolls into the past. `departed_at`
-- is orthogonal to `status` (a departed PPR is still 'approved'); it only
-- governs board visibility.
--
-- Expand-only: both columns are nullable and additive. The existing
-- ppr_entries_update RLS policy (ppr:write) already covers the new
-- writes — no policy change. No new permission key.

ALTER TABLE ppr_entries
  ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- One-time rollout backfill: treat every PPR that arrived BEFORE today as
-- already departed, so switching the board from "arrival == today" to
-- "on field until departed" doesn't flood it with historical entries.
-- Today's and future arrivals stay on-field (departed_at NULL) until staff
-- mark them departed. Reversible: SET departed_at = NULL WHERE ... to undo.
UPDATE ppr_entries
  SET departed_at = now()
  WHERE departed_at IS NULL
    AND arrival_date < CURRENT_DATE;

-- Partial index for the board query (base + still-on-field).
CREATE INDEX IF NOT EXISTS idx_ppr_entries_on_field
  ON ppr_entries(base_id, arrival_date)
  WHERE departed_at IS NULL;
