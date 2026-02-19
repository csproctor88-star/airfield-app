-- 5.11 Regulations Database
-- AOMS Regulation Database — 74 entries across 7 sections
-- Source: AOMS_Regulation_Database_v6

CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_id TEXT NOT NULL UNIQUE,          -- e.g. 'DAFMAN 13-204, Vol. 1', '14 CFR Part 139'
  title TEXT NOT NULL,                   -- Short title
  description TEXT NOT NULL,             -- Full description
  publication_date TEXT,                 -- Date string or 'Current Ed.'
  url TEXT,                              -- Clickable hyperlink
  source_section TEXT NOT NULL,          -- Which section of the AOMS database (I–VII)
  source_volume TEXT,                    -- Parent DAFMAN volume or UFC if applicable
  category TEXT NOT NULL,                -- Functional category for filtering
  pub_type TEXT NOT NULL,                -- Publication type: DAF, FAA, UFC, DoD, NFPA, ICAO, IEEE
  is_core BOOLEAN NOT NULL DEFAULT false,
  is_cross_ref BOOLEAN NOT NULL DEFAULT false,
  is_scrubbed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',     -- Search tags
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regulations_category ON regulations(category);
CREATE INDEX idx_regulations_pub_type ON regulations(pub_type);
CREATE INDEX idx_regulations_source_section ON regulations(source_section);
CREATE INDEX idx_regulations_reg_id ON regulations(reg_id);

-- Full-text search index
CREATE INDEX idx_regulations_fts ON regulations USING gin(
  to_tsvector('english', coalesce(reg_id, '') || ' ' || coalesce(title, '') || ' ' || coalesce(description, ''))
);
