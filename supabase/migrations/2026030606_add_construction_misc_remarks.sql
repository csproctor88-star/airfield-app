-- Add construction/closures remarks and miscellaneous info to airfield_status
ALTER TABLE airfield_status ADD COLUMN IF NOT EXISTS construction_remarks TEXT;
ALTER TABLE airfield_status ADD COLUMN IF NOT EXISTS misc_remarks TEXT;
