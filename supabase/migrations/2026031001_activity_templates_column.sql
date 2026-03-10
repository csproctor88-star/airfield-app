-- Add custom activity templates JSONB column to bases table
-- Stores per-installation overrides of the default hardcoded templates.
-- Structure: array of TemplateCategory objects (same shape as ACTIVITY_TEMPLATES in code).
-- When NULL, the app falls back to the hardcoded defaults.
ALTER TABLE bases ADD COLUMN IF NOT EXISTS activity_templates JSONB DEFAULT NULL;
