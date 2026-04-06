-- Add column_type to ppr_columns for field type selection
ALTER TABLE ppr_columns ADD COLUMN IF NOT EXISTS column_type TEXT NOT NULL DEFAULT 'text'
  CHECK (column_type IN ('text', 'date', 'time', 'yes_no_na', 'phone', 'number', 'email'));
