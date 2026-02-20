-- ═══════════════════════════════════════════════════════════════
-- User-Uploaded Personal Documents
-- ═══════════════════════════════════════════════════════════════

-- Metadata table: tracks each user's uploaded documents
CREATE TABLE IF NOT EXISTS user_documents (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  file_size     BIGINT,
  total_pages   INTEGER,
  status        TEXT NOT NULL DEFAULT 'uploaded'
                CHECK (status IN ('uploaded', 'extracting', 'ready', 'failed')),
  base_id       UUID,
  notes         TEXT,
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  extracted_at  TIMESTAMPTZ,

  UNIQUE (user_id, file_name)
);

CREATE INDEX idx_user_docs_user ON user_documents (user_id);
CREATE INDEX idx_user_docs_base ON user_documents (base_id) WHERE base_id IS NOT NULL;

-- Extracted text per page (mirrors pdf_text_pages structure)
CREATE TABLE IF NOT EXISTS user_document_pages (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id   UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  page_number   INTEGER NOT NULL,
  text_content  TEXT NOT NULL DEFAULT '',
  tsv           TSVECTOR GENERATED ALWAYS AS (
                  to_tsvector('english', text_content)
                ) STORED,
  extracted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (document_id, page_number)
);

CREATE INDEX idx_user_doc_pages_tsv ON user_document_pages USING GIN (tsv);
CREATE INDEX idx_user_doc_pages_user ON user_document_pages (user_id);
CREATE INDEX idx_user_doc_pages_doc ON user_document_pages (document_id);

-- ─── RLS Policies ────────────────────────────────────────────

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own documents"
  ON user_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents"
  ON user_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own documents"
  ON user_documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents"
  ON user_documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own document pages"
  ON user_document_pages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own document pages"
  ON user_document_pages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document pages"
  ON user_document_pages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own document pages"
  ON user_document_pages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Search Function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_user_documents(
  search_query TEXT,
  max_results  INTEGER DEFAULT 50
)
RETURNS TABLE (
  document_id  UUID,
  file_name    TEXT,
  page_number  INTEGER,
  headline     TEXT,
  rank         REAL
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.document_id,
    p.file_name,
    p.page_number,
    ts_headline('english', p.text_content, websearch_to_tsquery('english', search_query),
      'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15, MaxFragments=2'
    ) AS headline,
    ts_rank(p.tsv, websearch_to_tsquery('english', search_query)) AS rank
  FROM user_document_pages p
  WHERE p.user_id = auth.uid()
    AND p.tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
$$;

-- ─── Storage Policies for user-uploads bucket ────────────────
-- NOTE: You must first create the 'user-uploads' bucket in the
-- Supabase Dashboard (Storage → New Bucket):
--   Name: user-uploads
--   Public: No
--   File size limit: 50MB
--   Allowed MIME types: application/pdf

CREATE POLICY "Users can upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
