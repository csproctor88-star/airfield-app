-- AMTR — sysadmin "seed to new bases" flag for custom 803 sections.
-- When set, a custom section (and its catalog tasks) is seeded into newly-created
-- bases by seedBaseCatalogs, alongside the five built-in sections.
ALTER TABLE amtr_803_sections ADD COLUMN IF NOT EXISTS seed_default BOOLEAN NOT NULL DEFAULT false;
