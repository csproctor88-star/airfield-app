-- QRC executions: free-form remarks captured before close.
-- Additive (expand) change — nullable column, no backfill, existing RLS row
-- policies on qrc_executions already cover it.
ALTER TABLE qrc_executions ADD COLUMN IF NOT EXISTS remarks TEXT;
