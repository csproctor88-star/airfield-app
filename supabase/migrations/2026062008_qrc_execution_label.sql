-- QRC executions: optional manual label that overrides the auto-derived
-- identifier shown in the Active list. Additive (expand) change — nullable,
-- no backfill, existing RLS row policies on qrc_executions already cover it.
ALTER TABLE qrc_executions ADD COLUMN IF NOT EXISTS label TEXT;
