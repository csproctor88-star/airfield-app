-- ═══════════════════════════════════════════════════════════════
-- AOMS: Pre-extracted PDF Text Storage
-- Run this migration in Supabase SQL Editor or via CLI
-- ═══════════════════════════════════════════════════════════════

-- Table: stores extracted text per page per PDF file
CREATE TABLE IF NOT EXISTS pdf_text_pages (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name     TEXT NOT NULL,                          -- matches Storage object name
  page_number   INTEGER NOT NULL,
  text_content  TEXT NOT NULL DEFAULT '',                -- raw extracted text
  tsv           TSVECTOR GENERATED ALWAYS AS (           -- auto-generated search vector
                  to_tsvector('english', text_content)
                ) STORED,
  extracted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (file_name, page_number)                       -- one row per page per file
);

-- Index for fast full-text search across all pages
CREATE INDEX IF NOT EXISTS idx_pdf_text_tsv 
  ON pdf_text_pages USING GIN (tsv);

-- Index for fast lookups by file
CREATE INDEX IF NOT EXISTS idx_pdf_text_file 
  ON pdf_text_pages (file_name);

-- Composite index for fetching all pages of a file in order
CREATE INDEX IF NOT EXISTS idx_pdf_text_file_page 
  ON pdf_text_pages (file_name, page_number);

-- ─── Metadata table: tracks extraction status per file ───────
CREATE TABLE IF NOT EXISTS pdf_extraction_status (
  file_name       TEXT PRIMARY KEY,
  total_pages     INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending'        -- pending | extracting | complete | failed
                  CHECK (status IN ('pending', 'extracting', 'complete', 'failed')),
  error_message   TEXT,
  extracted_at    TIMESTAMPTZ,
  file_size       BIGINT,                                -- bytes, for cache management
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RLS Policies ────────────────────────────────────────────
-- Adjust these based on your auth setup. For development:

ALTER TABLE pdf_text_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_extraction_status ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Authenticated users can read pdf text"
  ON pdf_text_pages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read extraction status"
  ON pdf_extraction_status FOR SELECT
  TO authenticated
  USING (true);

-- Service role (Edge Functions) can do everything
CREATE POLICY "Service role full access to pdf text"
  ON pdf_text_pages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to extraction status"
  ON pdf_extraction_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- SEARCH FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Search across ALL PDFs — returns matching pages ranked by relevance
CREATE OR REPLACE FUNCTION search_all_pdfs(
  search_query TEXT,
  max_results  INTEGER DEFAULT 50
)
RETURNS TABLE (
  file_name    TEXT,
  page_number  INTEGER,
  headline     TEXT,          -- snippet with <b> highlighted matches
  rank         REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.file_name,
    p.page_number,
    ts_headline('english', p.text_content, websearch_to_tsquery('english', search_query),
      'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15, MaxFragments=2'
    ) AS headline,
    ts_rank(p.tsv, websearch_to_tsquery('english', search_query)) AS rank
  FROM pdf_text_pages p
  WHERE p.tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT max_results;
$$;

-- Search within a SINGLE PDF — returns matching pages
CREATE OR REPLACE FUNCTION search_pdf(
  target_file  TEXT,
  search_query TEXT
)
RETURNS TABLE (
  page_number  INTEGER,
  headline     TEXT,
  rank         REAL
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.page_number,
    ts_headline('english', p.text_content, websearch_to_tsquery('english', search_query),
      'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15, MaxFragments=2'
    ) AS headline,
    ts_rank(p.tsv, websearch_to_tsquery('english', search_query)) AS rank
  FROM pdf_text_pages p
  WHERE p.file_name = target_file
    AND p.tsv @@ websearch_to_tsquery('english', search_query)
  ORDER BY p.page_number;
$$;

-- ═══════════════════════════════════════════════════════════════
-- OPTIONAL: Storage webhook trigger
-- If you want auto-extraction when files are uploaded,
-- create a Database Webhook in Supabase Dashboard:
--   Table: storage.objects
--   Events: INSERT
--   URL: your Edge Function URL
-- ═══════════════════════════════════════════════════════════════
