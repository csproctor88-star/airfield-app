-- Add inspection photo support to existing photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS inspection_id uuid REFERENCES inspections(id) ON DELETE CASCADE;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS inspection_item_id text;
CREATE INDEX IF NOT EXISTS idx_photos_inspection_id ON photos(inspection_id);
