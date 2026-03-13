-- Allow linking inspection items to specific system components (not just whole systems)
-- When component_id is NULL, all components in the system are shown in the feature picker.
-- When component_id is set, only features assigned to that specific component are shown.

ALTER TABLE inspection_item_system_links
  ADD COLUMN component_id UUID REFERENCES lighting_system_components(id) ON DELETE CASCADE;

CREATE INDEX idx_iisl_component_id ON inspection_item_system_links(component_id);

-- Drop the old unique constraint (item_id, system_id) and replace with one that includes component_id
ALTER TABLE inspection_item_system_links
  DROP CONSTRAINT IF EXISTS inspection_item_system_links_item_id_system_id_key;

ALTER TABLE inspection_item_system_links
  ADD CONSTRAINT iisl_item_system_component_unique UNIQUE (item_id, system_id, component_id);
