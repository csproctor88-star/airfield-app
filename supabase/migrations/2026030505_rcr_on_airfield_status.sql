-- Add RCR (Runway Condition Reading) columns to airfield_status
ALTER TABLE airfield_status ADD COLUMN rcr_touchdown TEXT;
ALTER TABLE airfield_status ADD COLUMN rcr_midpoint TEXT;
ALTER TABLE airfield_status ADD COLUMN rcr_rollout TEXT;
ALTER TABLE airfield_status ADD COLUMN rcr_condition TEXT;
ALTER TABLE airfield_status ADD COLUMN rcr_updated_at TIMESTAMPTZ;
