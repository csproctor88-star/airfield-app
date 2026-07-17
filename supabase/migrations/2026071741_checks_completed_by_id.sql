-- ============================================================
-- NAMO/NAMT Report Tool — Migration 2/3: airfield_checks.completed_by_id
--
-- Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md
--       (§Data model & migrations)
--
-- airfield_checks.completed_by is free text and saved_by_id is draft-save-
-- named. Add a real "who completed it" uuid, populated going forward by
-- createCheck() (lib/supabase/checks.ts).
--
-- Deterministic same-row copy (NOT a fuzzy historic backfill): on completed
-- rows, saved_by_id was captured from auth.uid() at creation
-- (lib/supabase/checks.ts:70-87), so it is the completer for every in-app
-- completed check since the column existed.
--
-- RLS is unchanged — existing airfield_checks policies already cover the
-- new column (matrix policies gate row access, not columns).
--
-- DEPLOY-ORDER WARNING: lib/supabase/checks.ts (this repo, staged in the
-- same batch) writes completed_by_id on every createCheck() call. Do not
-- deploy that app code before this migration is applied — the column must
-- exist in the linked/prod database first, or check creation breaks.
--
-- STAGED — NOT applied. Staged tonight (2026-07-17) for owner review in
-- the morning; apply after 2026071740 and before 2026071742 (all three are
-- independent of each other in content, but this ordering matches the
-- spec's numbering and the report-writeup sequence).
--
-- Post-apply verification:
--   SELECT count(*) FROM airfield_checks
--    WHERE status = 'completed' AND completed_by_id IS DISTINCT FROM saved_by_id;
--   -- expect: 0 (every completed row's completed_by_id now matches its
--   --         same-row saved_by_id, or both are NULL)
-- ============================================================

ALTER TABLE airfield_checks
  ADD COLUMN IF NOT EXISTS completed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Deterministic same-row copy (NOT a fuzzy historic backfill): on completed
-- rows, saved_by_id was captured from auth.uid() at creation
-- (lib/supabase/checks.ts:70-87), so it is the completer for every in-app
-- completed check since the column existed.
UPDATE airfield_checks
SET completed_by_id = saved_by_id
WHERE status = 'completed' AND completed_by_id IS NULL AND saved_by_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_airfield_checks_completed_by
  ON airfield_checks (base_id, completed_by_id) WHERE status = 'completed';
