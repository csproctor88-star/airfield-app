-- Per-agency opt-in for the PPR approval calendar invite.
--
-- When a PPR is approved, coordinating groups with this flag on receive
-- the .ics (METHOD:PUBLISH "add to calendar") attached to their approval
-- notification email — so only the groups that want it (e.g. Fire, Tower)
-- get it. Default OFF: opt-in per the feature request.
--
-- Expand-only: single nullable-with-default column. Existing
-- ppr_agencies_update RLS (base_setup:write) already covers it; no policy
-- change, no new permission, no backfill.

ALTER TABLE ppr_agencies
  ADD COLUMN IF NOT EXISTS send_calendar_invite BOOLEAN NOT NULL DEFAULT false;
