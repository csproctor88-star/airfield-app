-- Enable realtime for airfield_contractors so personnel changes sync across devices
ALTER PUBLICATION supabase_realtime ADD TABLE airfield_contractors;
ALTER TABLE airfield_contractors REPLICA IDENTITY FULL;
