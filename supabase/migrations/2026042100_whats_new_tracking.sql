-- ============================================================
-- Track which release notes each user has already dismissed so
-- the "What's New" modal only pops once per release per user.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_release_version TEXT;
