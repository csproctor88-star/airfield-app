-- Add sidebar_config JSONB column to profiles for per-user nav customization
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sidebar_config jsonb DEFAULT NULL;

COMMENT ON COLUMN profiles.sidebar_config IS 'User-customizable sidebar navigation layout. JSON array of {label, items[], collapsed?} sections.';
