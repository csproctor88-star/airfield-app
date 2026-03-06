-- Expand item_type CHECK constraint to allow 'rsc' and 'rcr' types
ALTER TABLE base_inspection_items DROP CONSTRAINT IF EXISTS base_inspection_items_item_type_check;
ALTER TABLE base_inspection_items ADD CONSTRAINT base_inspection_items_item_type_check
  CHECK (item_type IN ('pass_fail', 'bwc', 'rsc', 'rcr'));
