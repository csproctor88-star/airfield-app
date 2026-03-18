-- Add is_favorite flag to base_wildlife_species for priority display in species picker
ALTER TABLE base_wildlife_species ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
