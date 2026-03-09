-- Add operating_initials column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS operating_initials text;
