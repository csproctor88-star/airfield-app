-- Add BWC at time of observation/strike to wildlife tables
ALTER TABLE wildlife_sightings ADD COLUMN IF NOT EXISTS bwc_at_time text;
ALTER TABLE wildlife_strikes ADD COLUMN IF NOT EXISTS bwc_at_time text;
