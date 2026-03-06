-- Add RSC/BWC columns to airfield_status (single source of truth for dashboard)
ALTER TABLE airfield_status ADD COLUMN rsc_condition TEXT;
ALTER TABLE airfield_status ADD COLUMN rsc_updated_at TIMESTAMPTZ;
ALTER TABLE airfield_status ADD COLUMN bwc_value TEXT;
ALTER TABLE airfield_status ADD COLUMN bwc_updated_at TIMESTAMPTZ;
