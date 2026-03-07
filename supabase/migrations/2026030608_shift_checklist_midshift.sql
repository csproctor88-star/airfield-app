-- Add 'mid' as a valid shift option for shift checklist items
ALTER TABLE shift_checklist_items DROP CONSTRAINT IF EXISTS shift_checklist_items_shift_check;
ALTER TABLE shift_checklist_items ADD CONSTRAINT shift_checklist_items_shift_check CHECK (shift IN ('day', 'mid', 'swing'));
