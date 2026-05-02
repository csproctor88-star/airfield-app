-- 2026050200_profiles_setup_tour_flag.sql
--
-- Adds a per-user flag tracking whether the sys_admin has completed (or
-- skipped) the first-run onboarding tour on /base-config/setup. The
-- /base-config/setup page reads this flag to decide whether to launch
-- the OnboardingTour overlay; both Skip and Done write it true. A
-- "Replay tour" link in the wizard header re-launches without changing
-- the flag.
--
-- Stored on profiles (not a new user_settings table) since it is a
-- simple per-user boolean and profiles already exists with the right
-- RLS surface.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_completed_setup_tour BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.has_completed_setup_tour IS
  'True once the user has completed or skipped the /base-config/setup onboarding tour. Default FALSE so existing users see the tour on next visit; reset to FALSE to re-trigger.';
