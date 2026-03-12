-- Add rotation column for orienting sign/feature icons on the map
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infrastructure_features' AND column_name = 'rotation') THEN
    ALTER TABLE infrastructure_features ADD COLUMN rotation SMALLINT NOT NULL DEFAULT 0;
  END IF;
END $$;
