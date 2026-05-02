-- 2026050201_bases_quick_setup_pending.sql
--
-- Adds a per-base JSONB column that stores Quick Setup pre-filled
-- drafts before the admin reviews and confirms each step. Quick Setup
-- (triggered from the wizard's [Quick Setup] button) derives defaults
-- from ICAO data + DAFMAN A3.1 templates for the 5 derivable steps
-- (runways, areas, navaids, lighting, templates) and stages them here.
-- Confirming a step writes to the live tables via the same INSERT path
-- as manual entry and clears that step's entry from this column.
--
-- Schema is intentionally loose JSONB: each top-level key is a
-- WizardStepKey, value is the per-step draft (shape determined by the
-- tab that consumes it). Default '{}' so existing bases without Quick
-- Setup don't render pre-fill banners.
--
-- RLS unchanged — bases policies already gate writes through the
-- permission matrix (base_setup:write + user_has_base_access).

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS quick_setup_pending JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bases.quick_setup_pending IS
  'Per-step Quick Setup pre-fill drafts staged for admin review. Cleared when the admin confirms each step. Top-level keys are WizardStepKey values from lib/modules-config.ts.';
