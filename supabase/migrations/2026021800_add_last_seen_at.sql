-- Add last_seen_at to profiles for presence tracking (Online/Away/Inactive)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();
