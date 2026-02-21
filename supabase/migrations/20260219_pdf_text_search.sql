-- ═══════════════════════════════════════════════════════════════
-- PDF Text Search Tables & Functions
-- Stores extracted text from regulation PDFs for full-text search
-- ═══════════════════════════════════════════════════════════════

-- Extraction status tracker
CREATE TABLE IF NOT EXISTS pdf_extraction_status (
  file_name TEXT PRIMARY KEY,
  total_pages INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | extracting | complete | failed
  file_size BIGINT,
  error_message TEXT,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-page text content (the search index)
CREATE TABLE IF NOT EXISTS pdf_text_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  text_content TEXT NOT NULL DEFAULT '',
  text_search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', text_content)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_file_page UNIQUE (file_name, page_number)
);

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_pdf_text_search
  ON pdf_text_pages USING GIN (text_search_vector);

-- Index for filtering by file
CREATE INDEX IF NOT EXISTS idx_pdf_text_file
  ON pdf_text_pages (file_name);

-- ── Search functions ─────────────────────────────────────────

-- Search across ALL PDFs
CREATE OR REPLACE FUNCTION search_all_pdfs(
  search_query TEXT,
  max_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  file_name TEXT,
  page_number INTEGER,
  headline TEXT,
  rank REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.file_name,
    p.page_number,
    ts_headline('english', p.text_content, plainto_tsquery('english', search_query),
      'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') AS headline,
    ts_rank(p.text_search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM pdf_text_pages p
  WHERE p.text_search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
$$;

-- Search within a SINGLE PDF
CREATE OR REPLACE FUNCTION search_pdf(
  target_file TEXT,
  search_query TEXT
)
RETURNS TABLE (
  page_number INTEGER,
  headline TEXT,
  rank REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.page_number,
    ts_headline('english', p.text_content, plainto_tsquery('english', search_query),
      'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15') AS headline,
    ts_rank(p.text_search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM pdf_text_pages p
  WHERE p.file_name = target_file
    AND p.text_search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC;
$$;

-- ── RLS Policies ─────────────────────────────────────────────
-- Allow all authenticated users to read text (for search)
-- Only service role can write (edge function or admin)

ALTER TABLE pdf_extraction_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_text_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read extraction status"
  ON pdf_extraction_status FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read text pages"
  ON pdf_text_pages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert text pages"
  ON pdf_text_pages FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update text pages"
  ON pdf_text_pages FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete text pages"
  ON pdf_text_pages FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert extraction status"
  ON pdf_extraction_status FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update extraction status"
  ON pdf_extraction_status FOR UPDATE
  USING (auth.role() = 'authenticated');
