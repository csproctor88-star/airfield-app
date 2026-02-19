-- Add offline PDF storage and date verification columns to regulations table
-- Run this AFTER the initial regulations table is created

ALTER TABLE regulations ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
ALTER TABLE regulations ADD COLUMN IF NOT EXISTS verified_date TEXT;

-- Create the Supabase Storage bucket for regulation PDFs
-- NOTE: This must be done via the Supabase dashboard or the script.
-- Bucket name: regulation-pdfs
-- Public: false (authenticated access only)
-- Max file size: 50MB
