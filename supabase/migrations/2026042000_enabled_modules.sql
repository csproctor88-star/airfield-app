-- ============================================================
-- Add per-base module enablement + setup progress tracking.
--
-- Goal: let each base choose which Glidepath modules are
-- available in its UI, and track which setup-wizard steps have
-- been completed. The source of truth for the list of toggleable
-- modules lives in client code (lib/modules-config.ts). This
-- migration only provides storage.
--
-- Backfill: every existing base gets the full toggleable set so
-- nothing disappears for current users. Guarded by cardinality
-- so an admin who has already touched the column isn't clobbered
-- on re-run.
-- ============================================================

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS enabled_modules TEXT[] NOT NULL DEFAULT ARRAY[
    'checks',
    'inspections',
    'acsi',
    'discrepancies',
    'ces',
    'infrastructure',
    'parking',
    'obstructions',
    'qrc',
    'shift-checklist',
    'scn',
    'wildlife',
    'waivers',
    'notams',
    'ppr',
    'feedback',
    'contractors'
  ]::text[];

ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS setup_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill: rows inserted before the DEFAULT was attached may have
-- NULL or empty arrays. Restore the full toggleable set for them.
UPDATE bases
SET enabled_modules = ARRAY[
  'checks',
  'inspections',
  'acsi',
  'discrepancies',
  'ces',
  'infrastructure',
  'parking',
  'obstructions',
  'qrc',
  'shift-checklist',
  'wildlife',
  'waivers',
  'notams',
  'ppr',
  'feedback',
  'contractors'
]::text[]
WHERE enabled_modules IS NULL OR cardinality(enabled_modules) = 0;
