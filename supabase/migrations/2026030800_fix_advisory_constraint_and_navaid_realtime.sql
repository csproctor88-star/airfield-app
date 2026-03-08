-- Fix advisory_type CHECK constraint to match app values (WATCH, WARNING, ADVISORY)
-- Old constraint allowed: INFO, CAUTION, WARNING
-- New constraint allows: WATCH, WARNING, ADVISORY
ALTER TABLE airfield_status
  DROP CONSTRAINT IF EXISTS airfield_status_advisory_type_check;

ALTER TABLE airfield_status
  ADD CONSTRAINT airfield_status_advisory_type_check
  CHECK (advisory_type IN ('WATCH', 'WARNING', 'ADVISORY'));

-- Enable realtime for navaid_statuses so cross-device updates work
ALTER PUBLICATION supabase_realtime ADD TABLE navaid_statuses;

-- Set FULL replica identity so UPDATE payloads include all columns
ALTER TABLE navaid_statuses REPLICA IDENTITY FULL;
