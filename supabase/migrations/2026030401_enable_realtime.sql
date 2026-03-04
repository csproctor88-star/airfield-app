-- Enable Supabase Realtime on dashboard-critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE airfield_status;
ALTER PUBLICATION supabase_realtime ADD TABLE airfield_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE inspections;

-- FULL replica identity on airfield_status so UPDATE payloads include all columns
ALTER TABLE airfield_status REPLICA IDENTITY FULL;
