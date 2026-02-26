-- Allow authenticated users full access to waiver-attachments bucket (RLS disabled for MVP)

CREATE POLICY "Allow authenticated upload waiver attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'waiver-attachments');

CREATE POLICY "Allow authenticated read waiver attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'waiver-attachments');

CREATE POLICY "Allow authenticated delete waiver attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'waiver-attachments');
