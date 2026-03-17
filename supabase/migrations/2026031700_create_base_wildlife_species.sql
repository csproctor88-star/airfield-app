-- Per-installation wildlife species configuration
CREATE TABLE IF NOT EXISTS base_wildlife_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  species_common TEXT NOT NULL,
  added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(base_id, species_common)
);

ALTER TABLE base_wildlife_species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their base species" ON base_wildlife_species FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "Admins can manage base species" ON base_wildlife_species FOR ALL USING (user_can_write(auth.uid()) AND user_has_base_access(auth.uid(), base_id));
