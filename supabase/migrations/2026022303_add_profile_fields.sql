-- Add first_name and last_name columns to profiles table
-- These replace the single 'name' field for more structured profile data

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Backfill: split existing 'name' into first_name / last_name
UPDATE profiles
SET
  first_name = COALESCE(split_part(name, ' ', 1), ''),
  last_name  = CASE
    WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;
