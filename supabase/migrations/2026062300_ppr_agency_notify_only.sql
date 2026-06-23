-- ============================================================
-- PPR — Info-Only Recipients
--
-- notify_only marks a ppr_agencies row as an information-only recipient
-- group: it receives the FINAL APPROVAL email (and the .ics if its
-- send_calendar_invite flag is on) on every approved PPR, but it is NOT a
-- coordinating agency — it is hidden from the coordinating-agency picker,
-- never gets a ppr_coordination row, never concurs/non-concurs, and never
-- gates approval. It reuses the existing ppr_agency_members /
-- ppr_agency_emails / send_calendar_invite machinery.
--
-- Additive + default false, so every existing agency stays a coordinating
-- agency until one is explicitly flipped in Base Setup.
-- ============================================================

ALTER TABLE ppr_agencies
  ADD COLUMN IF NOT EXISTS notify_only BOOLEAN NOT NULL DEFAULT FALSE;
