-- Multi-advisory support: JSONB array of {id, type, text, created_at}
ALTER TABLE airfield_status
  ADD COLUMN IF NOT EXISTS advisories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrate any existing single advisory into the array
UPDATE airfield_status
  SET advisories = jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', advisory_type,
      'text', advisory_text,
      'created_at', now()::text
    )
  )
  WHERE advisory_type IS NOT NULL AND advisory_text IS NOT NULL
    AND (advisories = '[]'::jsonb OR advisories IS NULL);
