-- inspection_item_system_links: many-to-many join between inspection template items and lighting systems
-- Allows base admins to link specific checklist items to lighting systems so inspectors
-- can pick exact infrastructure features when an item fails.

CREATE TABLE IF NOT EXISTS inspection_item_system_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES base_inspection_items(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES lighting_systems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, system_id)
);

CREATE INDEX idx_iisl_item_id ON inspection_item_system_links(item_id);
CREATE INDEX idx_iisl_system_id ON inspection_item_system_links(system_id);

-- RLS
ALTER TABLE inspection_item_system_links ENABLE ROW LEVEL SECURITY;

-- SELECT: any base member can read (join through items → sections → templates → base_id)
CREATE POLICY "iisl_select" ON inspection_item_system_links FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM base_inspection_items bi
    JOIN base_inspection_sections bs ON bs.id = bi.section_id
    JOIN base_inspection_templates bt ON bt.id = bs.template_id
    JOIN base_members bm ON bm.base_id = bt.base_id
    WHERE bi.id = inspection_item_system_links.item_id
      AND bm.user_id = auth.uid()
  )
);

-- INSERT/UPDATE/DELETE: writers (via user_can_write helper)
CREATE POLICY "iisl_write" ON inspection_item_system_links FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM base_inspection_items bi
    JOIN base_inspection_sections bs ON bs.id = bi.section_id
    JOIN base_inspection_templates bt ON bt.id = bs.template_id
    WHERE bi.id = inspection_item_system_links.item_id
      AND user_can_write(bt.base_id)
  )
);
