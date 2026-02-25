-- User-uploaded regulation PDFs
-- Each user can upload their own personal copy of a regulation PDF.
-- These are scoped per-user and not shared with other users.

CREATE TABLE user_regulation_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reg_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One upload per user per regulation
  UNIQUE (user_id, reg_id)
);

CREATE INDEX idx_user_reg_pdfs_user ON user_regulation_pdfs(user_id);
CREATE INDEX idx_user_reg_pdfs_reg ON user_regulation_pdfs(reg_id);
