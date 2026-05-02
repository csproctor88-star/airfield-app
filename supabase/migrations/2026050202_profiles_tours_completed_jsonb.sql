-- Tours-completed JSONB map on profiles.
--
-- Replaces the per-tour boolean column pattern (has_completed_setup_tour
-- from migration 2026050200) with a forward-compatible JSONB map keyed
-- by tour id (e.g. 'setup-wizard', 'app-sidebar', 'app-mobile-nav',
-- 'page-discrepancies', ...). Future tours register a new key without a
-- migration.
--
-- has_completed_setup_tour stays in place this release as a fallback so
-- a botched deploy can revert without losing tour state. A follow-up
-- migration drops it once nobody reads it.
--
-- RLS: profiles already has a policy allowing users to update their own
-- row; that policy covers writes to this column with no further work.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tours_completed JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'has_completed_setup_tour'
  ) THEN
    UPDATE profiles
       SET tours_completed = jsonb_build_object('setup-wizard', true)
     WHERE has_completed_setup_tour = TRUE
       AND tours_completed = '{}'::jsonb;
  END IF;
END $$;
