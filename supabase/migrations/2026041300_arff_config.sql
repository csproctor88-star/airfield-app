-- ARFF configuration per base
-- Currently stores: { show_cat_dropdown: boolean }
-- Future fields can be added without further migrations.

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS arff_config JSONB NOT NULL DEFAULT '{}'::jsonb;
