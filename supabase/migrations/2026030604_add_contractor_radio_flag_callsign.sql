-- Add radio number, flag number, and callsign to airfield_contractors
ALTER TABLE airfield_contractors ADD COLUMN radio_number TEXT;
ALTER TABLE airfield_contractors ADD COLUMN flag_number TEXT;
ALTER TABLE airfield_contractors ADD COLUMN callsign TEXT;
