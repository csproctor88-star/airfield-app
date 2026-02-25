-- Allow all users (including anonymous / not-logged-in) to read files from
-- the regulation-pdfs storage bucket.  Without this policy the browser
-- Supabase client cannot list objects or create signed URLs.

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'regulation-pdfs');
